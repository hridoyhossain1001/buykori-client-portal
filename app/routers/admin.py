import os
import html
import secrets
import logging
import hashlib
import hmac
import time
from urllib.parse import urlencode
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, Form, Request, Header
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete as sql_delete, select, update, func
from pydantic import BaseModel
from app.database import get_db
from app.models.client import Client
from app.models.audit_log import AuditLog
from app.models.event_dedup import EventDedup
from app.models.event_log import EventLog
from app.models.event_outbox import EventOutbox
from app.models.failed_event import FailedEvent
from app.models.pending_event import PendingEvent
from app.models.usage_counter import UsageCounter
from app.security import encrypt_token
from app.services.webhook_service import _webhook_url_allowed
from app.limiter import limiter
from app.dependencies import clear_client_cache

logger = logging.getLogger(__name__)
router = APIRouter()
security = HTTPBasic()

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    raise RuntimeError("⛔ ADMIN_PASSWORD environment variable is required!")

CSRF_MAX_AGE_SECONDS = 60 * 60


class AdminClientCreate(BaseModel):
    name: str
    pixel_id: str
    access_token: str
    test_event_code: str | None = None
    domain: str | None = None
    tiktok_pixel_id: str | None = None
    tiktok_access_token: str | None = None
    tiktok_test_event_code: str | None = None
    ga4_measurement_id: str | None = None
    ga4_api_secret: str | None = None
    enable_facebook: bool = True
    enable_tiktok: bool = True
    enable_ga4: bool = True
    deferred_purchase: bool = False
    webhook_url: str | None = None


class AdminClientUpdate(BaseModel):
    name: str | None = None
    domain: str | None = None
    monthly_limit: int | None = None
    is_active: bool | None = None
    enable_facebook: bool | None = None
    enable_tiktok: bool | None = None
    enable_ga4: bool | None = None
    deferred_purchase: bool | None = None
    webhook_url: str | None = None
    test_event_code: str | None = None
    tiktok_test_event_code: str | None = None


def verify_admin(credentials: HTTPBasicCredentials = Depends(security)):
    is_user_ok = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    is_pass_ok = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
    if not (is_user_ok and is_pass_ok):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


def verify_admin_api_key(x_admin_api_key: str = Header("", alias="X-Admin-API-Key")) -> str:
    admin_key = os.getenv("ADMIN_API_KEY", "")
    if not admin_key:
        raise HTTPException(status_code=503, detail="Admin API key is not configured")
    if not x_admin_api_key or not hmac.compare_digest(x_admin_api_key, admin_key):
        raise HTTPException(status_code=403, detail="Admin access required")
    return "admin-api"


def create_admin_csrf_token(username: str) -> str:
    nonce = secrets.token_urlsafe(24)
    issued_at = str(int(time.time()))
    payload = f"{username}:{issued_at}:{nonce}"
    signature = hmac.new(
        ADMIN_PASSWORD.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{issued_at}:{nonce}:{signature}"


def verify_admin_csrf_token(token: str, username: str) -> None:
    try:
        issued_at, nonce, signature = token.split(":", 2)
        issued_ts = int(issued_at)
    except (AttributeError, TypeError, ValueError):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")

    if time.time() - issued_ts > CSRF_MAX_AGE_SECONDS:
        raise HTTPException(status_code=403, detail="Expired CSRF token")

    payload = f"{username}:{issued_at}:{nonce}"
    expected = hmac.new(
        ADMIN_PASSWORD.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=403, detail="Invalid CSRF token")


# ─── Shared display utilities (imported from shared module) ──────────────────
from app.utils.display import normalize_domain_input, display_domain_url, mask_secret

from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="app/templates")


def admin_redirect(msg: str, msg_type: str = "success") -> RedirectResponse:
    query = urlencode({"msg": msg, "msg_type": msg_type})
    return RedirectResponse(url=f"/api/v1/admin?{query}", status_code=303)


templates.env.globals["mask_secret"] = mask_secret
templates.env.globals["display_domain_url"] = display_domain_url


def request_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


async def log_admin_action(
    db: AsyncSession,
    request: Request,
    actor: str,
    action: str,
    client_id: int | None = None,
    details: str | None = None,
) -> None:
    db.add(
        AuditLog(
            actor=actor,
            action=action,
            client_id=client_id,
            ip_address=request_ip(request),
            details=details,
        )
    )


# ─── JSON API ROUTES FOR SPLIT ADMIN FRONTEND ────────────────────────────────

def client_to_api_dict(client: Client, event_total: int = 0, last_event_at=None) -> dict:
    return {
        "id": client.id,
        "name": client.name,
        "domain": client.domain,
        "display_domain": display_domain_url(client.domain),
        "is_active": bool(client.is_active),
        "api_key": client.api_key,
        "public_key": getattr(client, "public_key", None),
        "portal_key": getattr(client, "portal_key", None),
        "pixel_id": client.pixel_id,
        "test_event_code": client.test_event_code,
        "monthly_limit": getattr(client, "monthly_limit", None),
        "rate_limit": client.rate_limit,
        "daily_quota": client.daily_quota,
        "enable_facebook": getattr(client, "enable_facebook", True),
        "enable_tiktok": getattr(client, "enable_tiktok", True),
        "enable_ga4": getattr(client, "enable_ga4", True),
        "deferred_purchase": getattr(client, "deferred_purchase", False),
        "webhook_url": getattr(client, "webhook_url", None),
        "tiktok_pixel_id": getattr(client, "tiktok_pixel_id", None),
        "ga4_measurement_id": getattr(client, "ga4_measurement_id", None),
        "created_at": client.created_at.isoformat() if client.created_at else None,
        "event_total": int(event_total or 0),
        "last_event_at": last_event_at.isoformat() if last_event_at else None,
    }


def validate_webhook_url_or_400(webhook_url: str | None) -> str | None:
    clean_webhook_url = webhook_url.strip() if webhook_url and webhook_url.strip() else None
    if not clean_webhook_url:
        return None
    parsed_webhook = urlparse(clean_webhook_url)
    if parsed_webhook.scheme not in ("https", "http") or not parsed_webhook.netloc:
        raise HTTPException(status_code=400, detail="Webhook URL must be a valid http(s) URL.")
    if not _webhook_url_allowed(clean_webhook_url):
        raise HTTPException(status_code=400, detail="Webhook URL is not allowed.")
    return clean_webhook_url


@router.get("/admin/api/summary")
async def admin_api_summary(
    _: str = Depends(verify_admin_api_key),
    db: AsyncSession = Depends(get_db),
):
    clients_r = await db.execute(select(Client))
    clients = clients_r.scalars().all()
    events_r = await db.execute(select(func.coalesce(func.sum(EventLog.event_count), 0)))
    total_events = int(events_r.scalar() or 0)
    failed_r = await db.execute(
        select(func.coalesce(func.sum(EventLog.event_count), 0)).where(EventLog.status == "failed")
    )
    failed_events = int(failed_r.scalar() or 0)
    return {
        "status": "success",
        "total_clients": len(clients),
        "active_clients": sum(1 for c in clients if c.is_active),
        "inactive_clients": sum(1 for c in clients if not c.is_active),
        "total_events": total_events,
        "failed_events": failed_events,
    }


@router.get("/admin/api/clients")
async def admin_api_clients(
    _: str = Depends(verify_admin_api_key),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(
            Client,
            func.coalesce(func.sum(EventLog.event_count), 0).label("event_total"),
            func.max(EventLog.created_at).label("last_event_at"),
        )
        .outerjoin(EventLog, EventLog.client_id == Client.id)
        .group_by(Client.id)
        .order_by(Client.created_at.desc())
    )
    return {
        "status": "success",
        "clients": [client_to_api_dict(client, event_total, last_event_at) for client, event_total, last_event_at in rows],
    }


@router.post("/admin/api/clients")
async def admin_api_create_client(
    payload: AdminClientCreate,
    request: Request,
    actor: str = Depends(verify_admin_api_key),
    db: AsyncSession = Depends(get_db),
):
    name = payload.name.strip()
    pixel_id = payload.pixel_id.strip()
    access_token = payload.access_token.strip()
    if not name or len(name) > 100:
        raise HTTPException(status_code=400, detail="Client name must be 1-100 characters.")
    if not pixel_id.isdigit():
        raise HTTPException(status_code=400, detail="Pixel ID must be numeric.")
    if len(access_token) < 10:
        raise HTTPException(status_code=400, detail="Access token must be at least 10 characters.")

    client = Client(
        name=name,
        pixel_id=pixel_id,
        access_token=encrypt_token(access_token),
        test_event_code=payload.test_event_code.strip() if payload.test_event_code else None,
        domain=normalize_domain_input(payload.domain),
        api_key=secrets.token_urlsafe(32),
        public_key=secrets.token_urlsafe(24),
        portal_key=secrets.token_urlsafe(24),
        enable_facebook=payload.enable_facebook,
        enable_tiktok=payload.enable_tiktok,
        enable_ga4=payload.enable_ga4,
        tiktok_pixel_id=payload.tiktok_pixel_id.strip() if payload.tiktok_pixel_id else None,
        tiktok_access_token=encrypt_token(payload.tiktok_access_token.strip()) if payload.tiktok_access_token else None,
        tiktok_test_event_code=payload.tiktok_test_event_code.strip() if payload.tiktok_test_event_code else None,
        ga4_measurement_id=payload.ga4_measurement_id.strip() if payload.ga4_measurement_id else None,
        ga4_api_secret=encrypt_token(payload.ga4_api_secret.strip()) if payload.ga4_api_secret else None,
        deferred_purchase=payload.deferred_purchase,
        webhook_url=validate_webhook_url_or_400(payload.webhook_url),
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    await log_admin_action(db, request, actor, "client.api_added", client.id, f"Client {name} added from admin frontend")
    await db.commit()
    return {"status": "success", "client": client_to_api_dict(client)}


@router.patch("/admin/api/clients/{client_id}")
async def admin_api_update_client(
    client_id: int,
    payload: AdminClientUpdate,
    request: Request,
    actor: str = Depends(verify_admin_api_key),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    old_api_key = client.api_key
    if payload.name is not None:
        clean_name = payload.name.strip()
        if not clean_name or len(clean_name) > 100:
            raise HTTPException(status_code=400, detail="Client name must be 1-100 characters.")
        client.name = clean_name
    if payload.domain is not None:
        client.domain = normalize_domain_input(payload.domain)
    if payload.monthly_limit is not None:
        if payload.monthly_limit < 0:
            raise HTTPException(status_code=400, detail="Monthly limit cannot be negative.")
        client.monthly_limit = payload.monthly_limit
    if payload.is_active is not None:
        client.is_active = payload.is_active
    for field in ("enable_facebook", "enable_tiktok", "enable_ga4", "deferred_purchase"):
        value = getattr(payload, field)
        if value is not None:
            setattr(client, field, value)
    if payload.webhook_url is not None:
        client.webhook_url = validate_webhook_url_or_400(payload.webhook_url)
    if payload.test_event_code is not None:
        client.test_event_code = payload.test_event_code.strip() or None
    if payload.tiktok_test_event_code is not None:
        client.tiktok_test_event_code = payload.tiktok_test_event_code.strip() or None

    await db.commit()
    await db.refresh(client)
    clear_client_cache(old_api_key)
    await log_admin_action(db, request, actor, "client.api_updated", client.id, f"Client {client.name} updated from admin frontend")
    await db.commit()
    return {"status": "success", "client": client_to_api_dict(client)}




@router.get("/admin/api/clients/{client_id}")
async def admin_api_get_client(
    client_id: int,
    actor: str = Depends(verify_admin_api_key),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Return full data needed for edit forms and keys
    data = client_to_api_dict(client)
    data["access_token"] = client.access_token
    data["portal_key"] = client.portal_key
    data["public_key"] = getattr(client, "public_key", None)
    return {"status": "success", "client": data}


@router.post("/admin/api/clients/{client_id}/keys/rotate")
async def admin_api_rotate_key(
    client_id: int,
    request: Request,
    payload: dict,
    actor: str = Depends(verify_admin_api_key),
    db: AsyncSession = Depends(get_db),
):
    key_type = payload.get("key_type")
    if key_type not in ["api_key", "portal_key", "public_key"]:
        raise HTTPException(status_code=400, detail="Invalid key type")

    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    old_key = client.api_key
    if key_type == "api_key":
        client.api_key = secrets.token_urlsafe(32)
        clear_client_cache(old_key)
    elif key_type == "portal_key":
        client.portal_key = secrets.token_urlsafe(16)
    elif key_type == "public_key" and hasattr(client, "public_key"):
        client.public_key = secrets.token_hex(16)

    await log_admin_action(db, request, actor, f"client.{key_type}_rotated", client.id, f"{key_type} rotated via admin API")
    await db.commit()
    await db.refresh(client)
    return {"status": "success", "key_type": key_type, "new_value": getattr(client, key_type)}


@router.delete("/admin/api/clients/{client_id}")
async def admin_api_delete_client(
    client_id: int,
    request: Request,
    actor: str = Depends(verify_admin_api_key),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client_name = client.name
    client_api_key = client.api_key

    # Delete all related records first (FK constraints)
    await db.execute(sql_delete(EventOutbox).where(EventOutbox.client_id == client_id))
    await db.execute(sql_delete(FailedEvent).where(FailedEvent.client_id == client_id))
    await db.execute(sql_delete(PendingEvent).where(PendingEvent.client_id == client_id))
    await db.execute(sql_delete(EventDedup).where(EventDedup.client_id == client_id))
    await db.execute(sql_delete(UsageCounter).where(UsageCounter.client_id == client_id))
    await db.execute(sql_delete(EventLog).where(EventLog.client_id == client_id))
    await db.delete(client)
    clear_client_cache(client_api_key)

    await log_admin_action(db, request, actor, "client.deleted", client_id, f"Client {client_name} deleted via API")
    await db.commit()
    return {"status": "success", "message": f"Client {client_name} deleted"}


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@router.get("/admin", response_class=HTMLResponse, include_in_schema=False)
@limiter.limit("10/minute")
async def admin_dashboard(
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    msg: str = "",
    msg_type: str = "success",
):
    csrf_token = create_admin_csrf_token(username)
    result = await db.execute(select(Client).order_by(Client.created_at.desc()))
    clients = result.scalars().all()
    active_count = sum(1 for c in clients if c.is_active)

    audit_r = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(12))
    audit_logs = audit_r.scalars().all()

    # ─── Event Analytics Query ────────────────────────────────────────────
    from datetime import datetime, timezone
    from sqlalchemy import func as sql_func, and_
    from app.models.event_log import EventLog
    from app.models.failed_event import FailedEvent
    from app.models.event_outbox import EventOutbox

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # আজকের সফল ইভেন্ট (Global)
    success_r = await db.execute(
        select(sql_func.coalesce(sql_func.sum(EventLog.event_count), 0)).where(
            and_(EventLog.status == "success", EventLog.created_at >= today)
        )
    )
    events_today = success_r.scalar() or 0

    # প্রতি ক্লায়েন্টের আজকের সফল ইভেন্ট
    client_events_r = await db.execute(
        select(EventLog.client_id, sql_func.coalesce(sql_func.sum(EventLog.event_count), 0))
        .where(and_(EventLog.status == "success", EventLog.created_at >= today))
        .group_by(EventLog.client_id)
    )
    client_events_map = {row[0]: row[1] for row in client_events_r}

    # আজকের ব্যর্থ (SUM ব্যবহার করো — একটি row-তে একাধিক ইভেন্ট থাকতে পারে)
    fail_r = await db.execute(
        select(sql_func.coalesce(sql_func.sum(EventLog.event_count), 0)).where(
            and_(EventLog.status == "failed", EventLog.created_at >= today)
        )
    )
    failed_today = fail_r.scalar() or 0

    # Pending retries
    retry_r = await db.execute(
        select(sql_func.count(FailedEvent.id)).where(
            FailedEvent.status.in_(["pending", "retrying"])
        )
    )
    retries = retry_r.scalar() or 0

    outbox_r = await db.execute(
        select(sql_func.count(EventOutbox.id)).where(
            EventOutbox.status.in_(["queued", "processing"])
        )
    )
    queued_events = outbox_r.scalar() or 0

    dead_outbox_r = await db.execute(
        select(sql_func.count(EventOutbox.id)).where(EventOutbox.status == "dead")
    )
    dead_outbox = dead_outbox_r.scalar() or 0

    oldest_outbox_r = await db.execute(
        select(sql_func.min(EventOutbox.created_at)).where(
            EventOutbox.status.in_(["queued", "processing"])
        )
    )
    oldest_outbox_at = oldest_outbox_r.scalar()

    last_outbox_error_r = await db.execute(
        select(EventOutbox.last_error)
        .where(and_(EventOutbox.status == "dead", EventOutbox.last_error.is_not(None)))
        .order_by(EventOutbox.created_at.desc())
        .limit(1)
    )
    last_outbox_error = last_outbox_error_r.scalar()

    if oldest_outbox_at:
        if oldest_outbox_at.tzinfo is None:
            oldest_outbox_at = oldest_outbox_at.replace(tzinfo=timezone.utc)
        oldest_seconds = max(0, int((datetime.now(timezone.utc) - oldest_outbox_at).total_seconds()))
        if oldest_seconds >= 3600:
            oldest_outbox_age = f"{oldest_seconds // 3600}h"
        elif oldest_seconds >= 60:
            oldest_outbox_age = f"{oldest_seconds // 60}m"
        else:
            oldest_outbox_age = f"{oldest_seconds}s"
    else:
        oldest_outbox_age = "none"

    outbox_error_title = html.escape(last_outbox_error or "")

    total_calls = events_today + failed_today
    success_rate = round(events_today / total_calls * 100, 1) if total_calls > 0 else 100.0

    return templates.TemplateResponse(
        request,
        "admin/dashboard.html",
        {
            "title": "Dashboard",
            "active_page": "dashboard",
            "csrf_token": csrf_token,
            "clients": clients,
            "client_events_map": client_events_map,
            "events_today": events_today,
            "failed_today": failed_today,
            "retries": retries,
            "queued_events": queued_events,
            "dead_outbox": dead_outbox,
            "oldest_outbox_age": oldest_outbox_age,
            "outbox_error_title": outbox_error_title,
            "success_rate": success_rate,
            "msg": msg,
            "msg_type": msg_type,
        }
    )


@router.post("/admin/add-client", include_in_schema=False)
@limiter.limit("10/minute")
async def add_client(
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    name: str = Form(...),
    pixel_id: str = Form(...),
    access_token: str = Form(...),
    test_event_code: str = Form(None),
    domain: str = Form(None),
    tiktok_pixel_id: str = Form(None),
    tiktok_access_token: str = Form(None),
    tiktok_test_event_code: str = Form(None),
    ga4_measurement_id: str = Form(None),
    ga4_api_secret: str = Form(None),
    enable_facebook: str = Form(None),
    enable_tiktok: str = Form(None),
    enable_ga4: str = Form(None),
    deferred_purchase: str = Form(None),
    webhook_url: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)

    # ─── Input Validation ──────────────────────────────────────────────────
    name = name.strip()
    pixel_id = pixel_id.strip()
    access_token = access_token.strip()

    errors = []
    if not name or len(name) > 100:
        errors.append("নাম ১-১০০ অক্ষরের মধ্যে হতে হবে।")
    if not pixel_id.isdigit():
        errors.append("Pixel ID শুধু সংখ্যা হতে হবে।")
    if len(access_token) < 10:
        errors.append("Access Token কমপক্ষে ১০ অক্ষরের হতে হবে।")

    if errors:
        error_msg = " | ".join(errors)
        return admin_redirect(error_msg, "error")

    clean_webhook_url = webhook_url.strip() if webhook_url and webhook_url.strip() else None
    if clean_webhook_url:
        parsed_webhook = urlparse(clean_webhook_url)
        if parsed_webhook.scheme not in ("https", "http") or not parsed_webhook.netloc:
            return admin_redirect("Webhook URL must be a valid http(s) URL.", "error")
        if not _webhook_url_allowed(clean_webhook_url):
            return admin_redirect("Webhook URL is not allowed. Use a public http(s) endpoint.", "error")

    clean_domain = normalize_domain_input(domain)

    new_client = Client(
        name=name,
        pixel_id=pixel_id,
        access_token=encrypt_token(access_token),  # 🔐 Encrypted at rest
        test_event_code=test_event_code.strip() if test_event_code else None,
        domain=clean_domain,
        api_key=secrets.token_urlsafe(32),
        public_key=secrets.token_urlsafe(24),
        portal_key=secrets.token_urlsafe(24),
        enable_facebook=enable_facebook == "1",
        enable_tiktok=enable_tiktok == "1",
        enable_ga4=enable_ga4 == "1",
        tiktok_pixel_id=tiktok_pixel_id.strip() if tiktok_pixel_id and tiktok_pixel_id.strip() else None,
        tiktok_access_token=encrypt_token(tiktok_access_token.strip()) if tiktok_access_token and tiktok_access_token.strip() else None,
        tiktok_test_event_code=tiktok_test_event_code.strip() if tiktok_test_event_code and tiktok_test_event_code.strip() else None,
        ga4_measurement_id=ga4_measurement_id.strip() if ga4_measurement_id and ga4_measurement_id.strip() else None,
        ga4_api_secret=encrypt_token(ga4_api_secret.strip()) if ga4_api_secret and ga4_api_secret.strip() else None,
        deferred_purchase=deferred_purchase == "1",
        webhook_url=clean_webhook_url,
    )
    db.add(new_client)
    await db.commit()
    await db.refresh(new_client)
    await log_admin_action(db, request, username, "client.added", new_client.id, f"Client {name} added")
    await db.commit()
    logger.info(f"New client added: {name}")

    return admin_redirect(f"✅ {name} সফলভাবে যোগ হয়েছে!")


@router.get("/admin/client/{client_id}/instructions", response_class=HTMLResponse, include_in_schema=False)
async def client_instructions(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    base_url = str(request.base_url).rstrip("/")
    endpoint = f"{base_url}/api/v1/events"
    tracker_key = getattr(client, "public_key", None) or client.api_key
    tracker_url = f"{base_url}/t.js?key={tracker_key}"

    return templates.TemplateResponse(
        request,
        "admin/instructions.html",
        {
            "title": f"Instructions — {client.name}",
            "active_page": "clients",
            "client": client,
            "portal_key": getattr(client, "portal_key", None) or client.api_key,
            "masked_api_key": mask_secret(client.api_key),
            "masked_portal_key": mask_secret(getattr(client, "portal_key", None) or client.api_key),
            "masked_public_key": mask_secret(getattr(client, "public_key", None) or ""),
            "endpoint": endpoint,
            "tracker_url": tracker_url,
            "capi_origin": display_domain_url(client.domain) or "https://www.your-domain.com",
        }
    )


async def rotate_client_key(
    db: AsyncSession,
    request: Request,
    username: str,
    client_id: int,
    key_type: str,
) -> RedirectResponse:
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    old_api_key = client.api_key
    if key_type == "api":
        client.api_key = secrets.token_urlsafe(32)
        message = "API key rotated. Update WordPress plugin/server integrations."
        action = "client.api_key_rotated"
    elif key_type == "public":
        client.public_key = secrets.token_urlsafe(24)
        message = "Public tracker key rotated. Update t.js script URLs."
        action = "client.public_key_rotated"
    elif key_type == "portal":
        client.portal_key = secrets.token_urlsafe(24)
        message = "Portal login key rotated."
        action = "client.portal_key_rotated"
    else:
        raise HTTPException(status_code=400, detail="Invalid key type")

    await log_admin_action(db, request, username, action, client_id)
    await db.commit()

    from app.dependencies import clear_client_cache
    clear_client_cache(old_api_key)

    return admin_redirect(message)


@router.post("/admin/client/{client_id}/rotate-api-key", include_in_schema=False)
async def rotate_api_key(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)
    return await rotate_client_key(db, request, username, client_id, "api")


@router.post("/admin/client/{client_id}/rotate-public-key", include_in_schema=False)
async def rotate_public_key(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)
    return await rotate_client_key(db, request, username, client_id, "public")


@router.post("/admin/client/{client_id}/rotate-portal-key", include_in_schema=False)
async def rotate_portal_key(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)
    return await rotate_client_key(db, request, username, client_id, "portal")


@router.post("/admin/client/{client_id}/deactivate", include_in_schema=False)
async def deactivate_client(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)

    result = await db.execute(update(Client).where(Client.id == client_id).values(is_active=False).returning(Client.api_key))
    api_key = result.scalar()
    await log_admin_action(db, request, username, "client.deactivated", client_id)
    await db.commit()

    if api_key:
        from app.dependencies import clear_client_cache
        clear_client_cache(api_key)

    return admin_redirect("ক্লায়েন্ট Deactivate করা হয়েছে")


@router.post("/admin/client/{client_id}/activate", include_in_schema=False)
async def activate_client(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)

    result = await db.execute(update(Client).where(Client.id == client_id).values(is_active=True).returning(Client.api_key))
    api_key = result.scalar()
    await log_admin_action(db, request, username, "client.activated", client_id)
    await db.commit()

    if api_key:
        from app.dependencies import clear_client_cache
        clear_client_cache(api_key)

    return admin_redirect("ক্লায়েন্ট Activate করা হয়েছে")


# ═══════════════════════════════════════════════════════════════════════════════
@router.post("/admin/client/{client_id}/delete", include_in_schema=False)
async def delete_client(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)

    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        return admin_redirect("Client not found", "error")

    client_name = client.name
    api_key = client.api_key

    await db.execute(sql_delete(EventOutbox).where(EventOutbox.client_id == client_id))
    await db.execute(sql_delete(FailedEvent).where(FailedEvent.client_id == client_id))
    await db.execute(sql_delete(PendingEvent).where(PendingEvent.client_id == client_id))
    await db.execute(sql_delete(EventDedup).where(EventDedup.client_id == client_id))
    await db.execute(sql_delete(UsageCounter).where(UsageCounter.client_id == client_id))
    await db.execute(sql_delete(EventLog).where(EventLog.client_id == client_id))
    await db.delete(client)
    await log_admin_action(db, request, username, "client.deleted", client_id, f"Deleted client: {client_name}")
    await db.commit()

    if api_key:
        from app.dependencies import clear_client_cache
        clear_client_cache(api_key)

    return admin_redirect(f"Client deleted: {client_name}")


# CLIENTS PAGE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/clients", response_class=HTMLResponse, include_in_schema=False)
@limiter.limit("10/minute")
async def admin_clients(
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    msg: str = "",
    msg_type: str = "success",
):
    csrf_token = create_admin_csrf_token(username)
    result = await db.execute(select(Client).order_by(Client.created_at.desc()))
    clients = result.scalars().all()
    active_count = sum(1 for c in clients if c.is_active)
    inactive_count = len(clients) - active_count

    from datetime import datetime, timezone
    from sqlalchemy import func as sql_func, and_
    from app.models.event_log import EventLog
    from app.models.usage_counter import UsageCounter
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    now = datetime.now(timezone.utc)
    monthly_key_prefix = f"monthly:{now.strftime('%Y-%m')}"

    # Per-client events today
    client_events_r = await db.execute(
        select(EventLog.client_id, sql_func.coalesce(sql_func.sum(EventLog.event_count), 0))
        .where(and_(EventLog.status == "success", EventLog.created_at >= today))
        .group_by(EventLog.client_id)
    )
    client_events_map = {row[0]: row[1] for row in client_events_r}

    # Per-client monthly usage
    monthly_usage_r = await db.execute(
        select(UsageCounter.client_id, UsageCounter.count)
        .where(UsageCounter.window_key == monthly_key_prefix)
    )
    monthly_usage_map = {row[0]: row[1] for row in monthly_usage_r}

    return templates.TemplateResponse(
        request,
        "admin/clients.html",
        {
            "title": "Clients",
            "active_page": "clients",
            "csrf_token": csrf_token,
            "clients": clients,
            "active_count": active_count,
            "inactive_count": inactive_count,
            "client_events_map": client_events_map,
            "monthly_usage_map": monthly_usage_map,
            "msg": msg,
            "msg_type": msg_type,
        }
    )


# ═══════════════════════════════════════════════════════════════════════════════
# EDIT CLIENT — GET & POST
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/client/{client_id}/edit", response_class=HTMLResponse, include_in_schema=False)
async def edit_client_form(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
    msg: str = "",
    msg_type: str = "success",
):
    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    csrf_token = create_admin_csrf_token(username)

    return templates.TemplateResponse(
        request,
        "admin/edit.html",
        {
            "title": f"Edit — {client.name}",
            "active_page": "clients",
            "client": client,
            "csrf_token": csrf_token,
            "display_domain": display_domain_url(client.domain),
            "has_access_token": bool(client.access_token),
            "has_tiktok_token": bool(client.tiktok_access_token),
            "has_ga4_secret": bool(client.ga4_api_secret),
            "msg": msg,
            "msg_type": msg_type,
        }
    )


@router.post("/admin/client/{client_id}/edit", include_in_schema=False)
async def edit_client_submit(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    name: str = Form(...),
    pixel_id: str = Form(...),
    access_token: str = Form(""),
    test_event_code: str = Form(""),
    domain: str = Form(""),
    tiktok_pixel_id: str = Form(""),
    tiktok_access_token: str = Form(""),
    tiktok_test_event_code: str = Form(""),
    ga4_measurement_id: str = Form(""),
    ga4_api_secret: str = Form(""),
    enable_facebook: str = Form(None),
    enable_tiktok: str = Form(None),
    enable_ga4: str = Form(None),
    deferred_purchase: str = Form(None),
    webhook_url: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)

    result = await db.execute(select(Client).where(Client.id == client_id))
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # ─── Validate ───────────────────────────────────────────────────────────
    name = name.strip()
    pixel_id = pixel_id.strip()
    if not name or len(name) > 100:
        q = urlencode({"msg": "নাম ১-১০০ অক্ষরের মধ্যে হতে হবে।", "msg_type": "error"})
        return RedirectResponse(url=f"/api/v1/admin/client/{client_id}/edit?{q}", status_code=303)
    if not pixel_id.isdigit():
        q = urlencode({"msg": "Pixel ID শুধু সংখ্যা হতে হবে।", "msg_type": "error"})
        return RedirectResponse(url=f"/api/v1/admin/client/{client_id}/edit?{q}", status_code=303)

    # ─── Domain sanitize ─────────────────────────────────────────────────────
    clean_domain = normalize_domain_input(domain)

    # ─── Webhook validation ──────────────────────────────────────────────────
    clean_webhook = webhook_url.strip() if webhook_url and webhook_url.strip() else None
    if clean_webhook:
        parsed = urlparse(clean_webhook)
        if parsed.scheme not in ("https", "http") or not parsed.netloc:
            q = urlencode({"msg": "Webhook URL must be a valid http(s) URL.", "msg_type": "error"})
            return RedirectResponse(url=f"/api/v1/admin/client/{client_id}/edit?{q}", status_code=303)
        if not _webhook_url_allowed(clean_webhook):
            q = urlencode({"msg": "Webhook URL is not allowed.", "msg_type": "error"})
            return RedirectResponse(url=f"/api/v1/admin/client/{client_id}/edit?{q}", status_code=303)

    # ─── Apply updates ───────────────────────────────────────────────────────
    client.name = name
    client.pixel_id = pixel_id
    client.domain = clean_domain
    client.test_event_code = test_event_code.strip() if test_event_code and test_event_code.strip() else None
    client.enable_facebook = (enable_facebook == "1")
    client.enable_tiktok = (enable_tiktok == "1")
    client.enable_ga4 = (enable_ga4 == "1")
    client.deferred_purchase = (deferred_purchase == "1")
    client.webhook_url = clean_webhook
    client.tiktok_pixel_id = tiktok_pixel_id.strip() if tiktok_pixel_id and tiktok_pixel_id.strip() else None
    client.tiktok_test_event_code = tiktok_test_event_code.strip() if tiktok_test_event_code and tiktok_test_event_code.strip() else None
    client.ga4_measurement_id = ga4_measurement_id.strip() if ga4_measurement_id and ga4_measurement_id.strip() else None

    # Only update encrypted tokens if new value was provided
    if access_token and access_token.strip():
        client.access_token = encrypt_token(access_token.strip())
    if tiktok_access_token and tiktok_access_token.strip():
        client.tiktok_access_token = encrypt_token(tiktok_access_token.strip())
    if ga4_api_secret and ga4_api_secret.strip():
        client.ga4_api_secret = encrypt_token(ga4_api_secret.strip())

    await log_admin_action(db, request, username, "client.updated", client_id, f"Client {name} updated")
    await db.commit()

    from app.dependencies import clear_client_cache
    clear_client_cache(client.api_key)

    q = urlencode({"msg": f"✅ {name} সফলভাবে আপডেট হয়েছে!", "msg_type": "success"})
    return RedirectResponse(url=f"/api/v1/admin/clients?{q}", status_code=303)


# ═══════════════════════════════════════════════════════════════════════════════
# UPDATE MONTHLY LIMIT
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/admin/client/{client_id}/update-monthly-limit", include_in_schema=False)
async def update_monthly_limit(
    client_id: int,
    request: Request,
    username: str = Depends(verify_admin),
    csrf_token: str = Form(...),
    monthly_limit: int = Form(...),
    db: AsyncSession = Depends(get_db),
):
    verify_admin_csrf_token(csrf_token, username)

    if monthly_limit < 0:
        query = urlencode({"msg": "Monthly limit must be >= 0", "msg_type": "error"})
        return RedirectResponse(url=f"/api/v1/admin/clients?{query}", status_code=303)

    await db.execute(
        update(Client).where(Client.id == client_id).values(monthly_limit=monthly_limit)
    )
    await log_admin_action(db, request, username, "client.monthly_limit_updated", client_id, f"New limit: {monthly_limit:,}")
    await db.commit()

    # Clear cache
    result = await db.execute(select(Client.api_key).where(Client.id == client_id))
    api_key = result.scalar()
    if api_key:
        from app.dependencies import clear_client_cache
        clear_client_cache(api_key)

    query = urlencode({"msg": f"Monthly limit updated to {monthly_limit:,} events", "msg_type": "success"})
    return RedirectResponse(url=f"/api/v1/admin/clients?{query}", status_code=303)

# ═══════════════════════════════════════════════════════════════════════════════
# API LOGS PAGE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/logs", response_class=HTMLResponse, include_in_schema=False)
@limiter.limit("10/minute")
async def admin_logs(
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timezone
    from sqlalchemy import func as sql_func, and_
    from app.models.event_log import EventLog
    from app.models.failed_event import FailedEvent

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    success_r = await db.execute(
        select(sql_func.coalesce(sql_func.sum(EventLog.event_count), 0)).where(
            and_(EventLog.status == "success", EventLog.created_at >= today)
        )
    )
    events_today = success_r.scalar() or 0

    fail_r = await db.execute(
        select(sql_func.coalesce(sql_func.sum(EventLog.event_count), 0)).where(
            and_(EventLog.status == "failed", EventLog.created_at >= today)
        )
    )
    failed_today = fail_r.scalar() or 0

    retry_r = await db.execute(
        select(sql_func.count(FailedEvent.id)).where(
            FailedEvent.status.in_(["pending", "retrying"])
        )
    )
    retries = retry_r.scalar() or 0

    total = events_today + failed_today

    # Recent event logs (last 100)
    logs_r = await db.execute(
        select(EventLog).order_by(EventLog.created_at.desc()).limit(100)
    )
    event_logs = logs_r.scalars().all()

    # Client name map
    clients_r = await db.execute(select(Client.id, Client.name))
    client_map = {row[0]: row[1] for row in clients_r}

    # Failed events (last 50)
    failed_r = await db.execute(
        select(FailedEvent).order_by(FailedEvent.created_at.desc()).limit(50)
    )
    failed_events = failed_r.scalars().all()

    return templates.TemplateResponse(
        request,
        "admin/logs.html",
        {
            "title": "API Logs",
            "active_page": "logs",
            "events_today": events_today,
            "failed_today": failed_today,
            "total": total,
            "retries": retries,
            "event_logs": event_logs,
            "client_map": client_map,
            "failed_events": failed_events,
        }
    )


# ═══════════════════════════════════════════════════════════════════════════════
# SETTINGS PAGE
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/settings", response_class=HTMLResponse, include_in_schema=False)
@limiter.limit("10/minute")
async def admin_settings(
    request: Request,
    username: str = Depends(verify_admin),
    db: AsyncSession = Depends(get_db),
):
    import sys

    # Environment checks
    env_checks = {
        "ADMIN_PASSWORD": bool(os.getenv("ADMIN_PASSWORD")),
        "ENCRYPTION_KEY": bool(os.getenv("ENCRYPTION_KEY")),
        "ADMIN_API_KEY": bool(os.getenv("ADMIN_API_KEY")),
        "DATABASE_URL": bool(os.getenv("DATABASE_URL")),
    }

    # System info
    python_ver = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    admin_user = ADMIN_USERNAME

    # Audit logs (last 50)
    audit_r = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(50))
    audit_logs = audit_r.scalars().all()

    return templates.TemplateResponse(
        request,
        "admin/settings.html",
        {
            "title": "Settings",
            "active_page": "settings",
            "python_ver": python_ver,
            "admin_user": admin_user,
            "env_checks": env_checks,
            "audit_logs": audit_logs,
        }
    )
