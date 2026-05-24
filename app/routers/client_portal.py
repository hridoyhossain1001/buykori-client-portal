from fastapi import APIRouter, Depends, Request, Form, Response, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_
import datetime
import secrets
from typing import Optional

from app.database import get_db
from app.models.client import Client
from app.models.event_log import EventLog
from app.models.pending_event import PendingEvent
from app.utils.display import display_domain_url, mask_secret
from app.security import encrypt_token, decrypt_token
from app.limiter import limiter
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="app/templates")
templates.env.globals["mask_secret"] = mask_secret
templates.env.globals["display_domain_url"] = display_domain_url

router = APIRouter(tags=["Client Portal"])


def get_client_from_cookie(request: Request) -> Optional[str]:
    """Cookie থেকে encrypted session token পড়ে decrypt করে API key রিটার্ন করে।"""
    encrypted = request.cookies.get("client_session")
    if not encrypted:
        return None
    try:
        return decrypt_token(encrypted, allow_legacy_plaintext=False)
    except Exception:
        return None


async def get_client_from_portal_session(request: Request, db: AsyncSession) -> Optional[Client]:
    session_value = get_client_from_cookie(request)
    if not session_value:
        return None

    if session_value.startswith("client:"):
        try:
            _, client_id, session_secret = session_value.split(":", 2)
            result = await db.execute(select(Client).where(Client.id == int(client_id)))
            client = result.scalar_one_or_none()
            expected_secret = getattr(client, "portal_key", None) if client else None
            if client and expected_secret and secrets.compare_digest(session_secret, expected_secret):
                return client
            return None
        except (TypeError, ValueError):
            return None

    # Backward compatibility for old cookies that stored the API key directly.
    result = await db.execute(select(Client).where(Client.api_key == session_value))
    return result.scalar_one_or_none()


@router.get("/client", response_class=HTMLResponse, include_in_schema=False)
async def client_login_page(request: Request):
    api_key = get_client_from_cookie(request)
    if api_key:
        return RedirectResponse(url="/client/dashboard", status_code=303)

    return templates.TemplateResponse(
        request,
        "client_portal/login.html",
        {"title": "Client Login"}
    )


@router.post("/client/login", include_in_schema=False)
@limiter.limit("5/minute")
async def client_login(request: Request, response: Response, api_key: str = Form(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Client).where(or_(Client.portal_key == api_key, Client.api_key == api_key))
    )
    client = result.scalar_one_or_none()
    portal_key = getattr(client, "portal_key", None) if client else None
    portal_key_ok = bool(portal_key) and secrets.compare_digest(portal_key, api_key)
    legacy_api_key_ok = bool(client and not portal_key) and secrets.compare_digest(client.api_key, api_key)

    if not client or not client.is_active or not (portal_key_ok or legacy_api_key_ok):
        return templates.TemplateResponse(
            request,
            "client_portal/login_failed.html",
            {"title": "Login Failed"},
            status_code=401
        )

    redirect = RedirectResponse(url="/client/dashboard", status_code=303)
    redirect.set_cookie(
        key="client_session",
        value=encrypt_token(f"client:{client.id}:{getattr(client, 'portal_key', None) or client.api_key}"),
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=86400 * 7,  # 7 days
    )
    return redirect


@router.get("/client/logout", include_in_schema=False)
async def client_logout():
    redirect = RedirectResponse(url="/client", status_code=303)
    redirect.delete_cookie("client_session")
    return redirect


@router.get("/client/dashboard", response_class=HTMLResponse, include_in_schema=False)
async def client_dashboard(request: Request, db: AsyncSession = Depends(get_db)):
    client = await get_client_from_portal_session(request, db)
    if not client:
        return RedirectResponse(url="/client", status_code=303)

    if not client.is_active:
        redirect = RedirectResponse(url="/client", status_code=303)
        redirect.delete_cookie("client_session")
        return redirect

    # Get today's stats
    today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    events_result = await db.execute(
        select(EventLog.status, func.coalesce(func.sum(EventLog.event_count), 0))
        .where(EventLog.client_id == client.id)
        .where(EventLog.created_at >= today_start)
        .group_by(EventLog.status)
    )

    success_count = 0
    failed_count = 0

    for row in events_result:
        status, count = row
        if status == "success":
            success_count = count
        elif status == "failed":
            failed_count = count

    total = success_count + failed_count
    success_rate = round((success_count / total * 100) if total > 0 else 0, 1)

    # ─── 7-Day Chart Data ─────────────────────────────────────────────
    from sqlalchemy import cast, Date
    seven_days_ago = today_start - datetime.timedelta(days=6)

    chart_result = await db.execute(
        select(
            cast(EventLog.created_at, Date).label("day"),
            EventLog.status,
            func.coalesce(func.sum(EventLog.event_count), 0),
        )
        .where(EventLog.client_id == client.id)
        .where(EventLog.created_at >= seven_days_ago)
        .group_by("day", EventLog.status)
        .order_by("day")
    )

    # Build chart data
    chart_data = {}
    for row in chart_result:
        day_str = str(row[0])
        status_val = row[1]
        count_val = row[2]
        if day_str not in chart_data:
            chart_data[day_str] = {"success": 0, "failed": 0}
        chart_data[day_str][status_val] = count_val

    # Fill missing days
    labels = []
    success_data = []
    failed_data = []
    for i in range(7):
        d = seven_days_ago + datetime.timedelta(days=i)
        day_str = d.strftime("%Y-%m-%d")
        short_label = d.strftime("%b %d")
        labels.append(short_label)
        success_data.append(chart_data.get(day_str, {}).get("success", 0))
        failed_data.append(chart_data.get(day_str, {}).get("failed", 0))

    import json as json_mod
    labels_json = json_mod.dumps(labels)
    success_json = json_mod.dumps(success_data)
    failed_json = json_mod.dumps(failed_data)

    # ─── Recent Event Logs (last 50) ──────────────────────────────────
    logs_result = await db.execute(
        select(EventLog)
        .where(EventLog.client_id == client.id)
        .order_by(EventLog.created_at.desc())
        .limit(50)
    )
    recent_logs = logs_result.scalars().all()

    # Dashboard Recent Events (last 15)
    recent_logs_15 = recent_logs[:15]

    # Purchase Event Logs (Filter only Purchase)
    purchase_logs = [
        log for log in recent_logs
        if (log.event_name or "").lower() in ["purchase", "order_completed"]
    ]

    # General Event Logs (All)
    all_logs = recent_logs

    # ─── Pending Events Query (Deferred Purchase) ─────────────────────
    pending_events = []
    pending_count = 0
    confirmed_total = 0
    cancelled_total = 0
    expired_total = 0
    confirmed_today = 0
    pending_value_str = "৳0"
    oldest_pending_str = "—"
    action_note = ""

    if getattr(client, 'deferred_purchase', False):
        pending_result = await db.execute(
            select(PendingEvent)
            .where(and_(
                PendingEvent.client_id == client.id,
                PendingEvent.status == "pending",
            ))
            .order_by(PendingEvent.created_at.desc())
            .limit(50)
        )
        pending_events = pending_result.scalars().all()

        # Pending count
        pending_count_r = await db.execute(
            select(func.count(PendingEvent.id)).where(and_(
                PendingEvent.client_id == client.id,
                PendingEvent.status == "pending",
            ))
        )
        pending_count = pending_count_r.scalar() or 0

        status_counts_r = await db.execute(
            select(PendingEvent.status, func.count(PendingEvent.id))
            .where(PendingEvent.client_id == client.id)
            .group_by(PendingEvent.status)
        )
        deferred_counts = {status: int(count or 0) for status, count in status_counts_r}
        confirmed_total = deferred_counts.get("confirmed", 0)
        cancelled_total = deferred_counts.get("cancelled", 0)
        expired_total = deferred_counts.get("expired", 0)

        # Today's confirmed
        confirmed_r = await db.execute(
            select(func.count(PendingEvent.id)).where(and_(
                PendingEvent.client_id == client.id,
                PendingEvent.status == "confirmed",
                PendingEvent.confirmed_at >= today_start,
            ))
        )
        confirmed_today = confirmed_r.scalar() or 0

        now_utc = datetime.datetime.now(datetime.timezone.utc)

        pending_value = 0.0
        oldest_pending_hours = None
        for pe in pending_events:
            edata = pe.event_data or {}
            cdata = edata.get("custom_data", {})
            try:
                pending_value += float(cdata.get("value") or 0)
            except (TypeError, ValueError):
                pass
            created = pe.created_at
            if created:
                if created.tzinfo is None:
                    created = created.replace(tzinfo=datetime.timezone.utc)
                age_sec = (now_utc - created).total_seconds()
                age_hours = round(age_sec / 3600, 1)
                if oldest_pending_hours is None or age_hours > oldest_pending_hours:
                    oldest_pending_hours = age_hours

        pending_value_str = f"৳{pending_value:,.0f}" if pending_value else "৳0"
        oldest_pending_str = f"{oldest_pending_hours}h" if oldest_pending_hours is not None else "—"
        if oldest_pending_hours is not None and oldest_pending_hours >= 24:
            action_note = (
                f"<div style='margin-bottom:14px;padding:10px 14px;border:1px solid rgba(255,171,0,0.28);background:rgba(255,171,0,0.08);border-radius:10px;color:#ffd166;font-size:12px;'>"
                f"⚠️ Oldest pending order is {oldest_pending_str}. Confirm or cancel old COD orders so Meta/TikTok learn only from verified purchases.</div>"
            )

    # Base URL detection
    base_url = str(request.base_url).rstrip("/")
    if "x-forwarded-proto" in request.headers:
        scheme = request.headers.get("x-forwarded-proto")
        host = request.headers.get("host", "localhost")
        gateway_origin = f"{scheme}://{host}"
    else:
        gateway_origin = base_url
    endpoint = f"{base_url}/api/v1/events"
    tracker_key = getattr(client, "public_key", None) or client.api_key
    tracker_url = f"{gateway_origin}/t.js?key={tracker_key}"

    safe_api_key = client.api_key
    masked_api_key = mask_secret(client.api_key)
    safe_endpoint = endpoint
    safe_tracker_url = tracker_url
    safe_capi_origin = display_domain_url(client.domain) or "https://www.your-domain.com"

    settings_msg = request.query_params.get("settings_msg")
    settings_type = request.query_params.get("settings_type")

    return templates.TemplateResponse(
        request,
        "client_portal/dashboard.html",
        {
            "title": f"Dashboard — {client.name}",
            "active_page": "dashboard",
            "client": client,
            "settings_msg": settings_msg,
            "settings_type": settings_type,
            "success_count": success_count,
            "success_rate": success_rate,
            "failed_count": failed_count,
            "total": total,
            "recent_logs_15": recent_logs_15,
            "timezone_utc": datetime.timezone.utc,
            "purchase_logs": purchase_logs,
            "all_logs": all_logs,
            "pending_count": pending_count,
            "pending_value_str": pending_value_str,
            "confirmed_total": confirmed_total,
            "cancelled_total": cancelled_total,
            "expired_total": expired_total,
            "confirmed_today": confirmed_today,
            "oldest_pending_str": oldest_pending_str,
            "action_note": action_note,
            "pending_events": pending_events,
            "labels_json": labels_json,
            "success_json": success_json,
            "failed_json": failed_json,
            "safe_capi_origin": safe_capi_origin,
            "safe_endpoint": safe_endpoint,
            "safe_tracker_url": safe_tracker_url,
            "masked_api_key": masked_api_key,
            "gateway_origin": gateway_origin,
        }
    )


@router.post("/client/settings/update", include_in_schema=False)
@limiter.limit("10/minute")
async def client_settings_update(
    request: Request,
    pixel_id: str = Form(""),
    access_token: str = Form(""),
    test_event_code: str = Form(""),
    tiktok_pixel_id: str = Form(""),
    tiktok_access_token: str = Form(""),
    tiktok_test_event_code: str = Form(""),
    ga4_measurement_id: str = Form(""),
    ga4_api_secret: str = Form(""),
    enable_facebook: str = Form(None),
    enable_tiktok: str = Form(None),
    enable_ga4: str = Form(None),
    deferred_purchase: str = Form(None),
    domain: str = Form(None),
    auto_confirm_days: int = Form(0),
    auto_confirm_status: str = Form("completed"),
    db: AsyncSession = Depends(get_db),
):
    client = await get_client_from_portal_session(request, db)
    if not client or not client.is_active:
        return RedirectResponse(url="/client", status_code=303)

    # ─── Validate Pixel ID if provided ─────────────────────────────────────
    if pixel_id and pixel_id.strip():
        if not pixel_id.strip().isdigit():
            from urllib.parse import urlencode
            q = urlencode({"settings_msg": "Pixel ID শুধু সংখ্যা হতে হবে।", "settings_type": "error"})
            return RedirectResponse(url=f"/client/dashboard?{q}#tab-settings", status_code=303)
        client.pixel_id = pixel_id.strip()

    # ─── Update non-sensitive fields always ─────────────────────────────────
    client.test_event_code = test_event_code.strip() if test_event_code and test_event_code.strip() else None
    client.enable_facebook = (enable_facebook == "1")
    client.enable_tiktok = (enable_tiktok == "1")
    client.enable_ga4 = (enable_ga4 == "1")
    client.deferred_purchase = (deferred_purchase == "1")

    # Update domain(s) if provided
    if domain is not None:
        parts = []
        for raw_part in domain.split(","):
            d = raw_part.strip().lower()
            if not d:
                continue
            import re
            d = re.sub(r"^https?://", "", d).split("/", 1)[0].rstrip(".")
            if d.startswith("www."):
                d = d[4:]
            if d and ("." not in d or len(d) > 255):
                from urllib.parse import urlencode
                q = urlencode({"settings_msg": f"ভুল ডোমেন ফরম্যাট: {raw_part}", "settings_type": "error"})
                return RedirectResponse(url=f"/client/dashboard?{q}#settings", status_code=303)
            parts.append(d)
        client.domain = ",".join(parts) if parts else None

    # Update COD Auto-Confirm Settings
    client.auto_confirm_days = min(max(0, auto_confirm_days), 7)
    client.auto_confirm_status = auto_confirm_status.strip() or "completed"

    client.tiktok_pixel_id = tiktok_pixel_id.strip() if tiktok_pixel_id and tiktok_pixel_id.strip() else None
    client.tiktok_test_event_code = tiktok_test_event_code.strip() if tiktok_test_event_code and tiktok_test_event_code.strip() else None
    client.ga4_measurement_id = ga4_measurement_id.strip() if ga4_measurement_id and ga4_measurement_id.strip() else None

    # ─── Only update encrypted tokens if new value provided ──────────────────
    if access_token and access_token.strip():
        client.access_token = encrypt_token(access_token.strip())
    if tiktok_access_token and tiktok_access_token.strip():
        client.tiktok_access_token = encrypt_token(tiktok_access_token.strip())
    if ga4_api_secret and ga4_api_secret.strip():
        client.ga4_api_secret = encrypt_token(ga4_api_secret.strip())

    await db.commit()

    # Clear cache so changes take effect immediately
    from app.dependencies import clear_client_cache
    clear_client_cache(client.api_key)

    from urllib.parse import urlencode
    q = urlencode({"settings_msg": "✅ Settings সফলভাবে আপডেট হয়েছে!", "settings_type": "success"})
    return RedirectResponse(url=f"/client/dashboard?{q}#settings", status_code=303)
