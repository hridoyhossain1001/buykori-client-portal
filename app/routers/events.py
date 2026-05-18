import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from sqlalchemy import and_, func as sql_func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.dependencies import get_current_client, CachedClient
from app.models.event_dedup import EventDedup
from app.models.event_log import EventLog
from app.schemas.event import EventsPayload, EventsResponse
from app.services.geoip_service import get_location_data
from app.services.event_worker import enqueue_events
from app.services.retry_service import save_failed_event
from app.services.usage_service import check_and_reserve_usage
from app.models.pending_event import PendingEvent

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_EVENTS_PER_REQUEST = int(os.getenv("MAX_EVENTS_PER_REQUEST", "500"))
CAPI_SIGNATURE_WINDOW_SECONDS = int(os.getenv("CAPI_SIGNATURE_WINDOW_SECONDS", "300"))

# ─── Domain Validation Helper ────────────────────────────────────────────────
def _is_domain_allowed(request_host: str, allowed_domain: str) -> bool:
    """Check if request_host is exactly allowed_domain or a real subdomain of it."""
    if not request_host:
        return False
    return request_host == allowed_domain or request_host.endswith("." + allowed_domain)


def _verify_capi_signature(
    raw_body: bytes,
    api_key: str,
    timestamp: str,
    signature: str,
) -> bool:
    """Verify signed X-CAPI-Origin proof without trusting a spoofable header alone."""
    if not raw_body or not api_key or not timestamp or not signature:
        return False
    try:
        issued_at = int(timestamp)
    except (TypeError, ValueError):
        return False

    now = int(datetime.now(timezone.utc).timestamp())
    if abs(now - issued_at) > CAPI_SIGNATURE_WINDOW_SECONDS:
        return False

    signed_payload = timestamp.encode("utf-8") + b"." + raw_body
    expected = hmac.new(
        api_key.encode("utf-8"),
        signed_payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def reserve_unique_events(
    db: AsyncSession,
    client: CachedClient,
    events: list,
) -> list:
    """
    Reserve event IDs atomically before sending to Facebook.
    The unique index on (client_id, event_id) closes the concurrent duplicate race.
    commit/rollback এখানে করা হয় না — caller নিজে transaction manage করবে।
    """
    candidate_ids: list[str] = []
    seen_ids: set[str] = set()
    for event in events:
        if not event.event_id or event.event_id in seen_ids:
            continue
        seen_ids.add(event.event_id)
        candidate_ids.append(event.event_id)

    if not candidate_ids:
        return [event for event in events if not event.event_id]

    rows = [{"client_id": client.id, "event_id": event_id} for event_id in candidate_ids]
    stmt = (
        pg_insert(EventDedup)
        .values(rows)
        .on_conflict_do_nothing(index_elements=["client_id", "event_id"])
        .returning(EventDedup.event_id)
    )

    result = await db.execute(stmt)
    reserved_ids = set(result.scalars().all())

    unique_events = []
    accepted_ids: set[str] = set()
    for event in events:
        if not event.event_id:
            unique_events.append(event)
            continue
        if event.event_id in accepted_ids:
            logger.info(f"[{client.name}] Duplicate event skipped in request: {event.event_id}")
            continue
        accepted_ids.add(event.event_id)
        if event.event_id not in reserved_ids:
            logger.info(f"[{client.name}] Duplicate event skipped: {event.event_id}")
            continue
        unique_events.append(event)

    return unique_events


async def save_success_logs_bg(
    client_id: int,
    events_data: list,
    fb_result: dict | None,
    client_ip: str | None,
) -> None:
    try:
        async with AsyncSessionLocal() as db:
            log_entries = [
                EventLog(
                    client_id=client_id,
                    event_name=event.get("event_name") or "unknown",
                    event_id=event.get("event_id"),
                    event_count=1,
                    status="success",
                    fb_response=json.dumps(fb_result) if fb_result else None,
                    ip_address=client_ip,
                )
                for event in events_data
            ]
            db.add_all(log_entries)
            await db.commit()
    except Exception as e:
        logger.error(f"Background success log save error: {e}")


async def save_failure_log_and_retry_bg(
    client_id: int,
    event_names: str,
    events_data: list,
    error_msg: str,
    client_ip: str | None,
) -> None:
    try:
        async with AsyncSessionLocal() as db:
            log_entry = EventLog(
                client_id=client_id,
                event_name=event_names,
                event_count=len(events_data),
                status="failed",
                error_message=error_msg[:500],
                ip_address=client_ip,
            )
            db.add(log_entry)
            await db.commit()

            saved = await save_failed_event(db, client_id, events_data, error_msg)
            if not saved:
                logger.error(f"[Client {client_id}] Failed events were not saved to retry queue.")
    except Exception as e:
        logger.error(f"Background failure log save error: {e}")


@router.post(
    "/events",
    response_model=EventsResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Facebook CAPI Events Endpoint",
)
async def receive_events(
    request: Request,
    payload: EventsPayload,
    client: CachedClient = Depends(get_current_client),
    db: AsyncSession = Depends(get_db),
    hold: bool = Query(False, description="True হলে Purchase event hold হবে"),
):
    """
    ক্লায়েন্টের API Key ভেরিফাই করে ইভেন্ট durable outbox queue-তে জমা করে।
    Deduplication DB unique constraint দিয়ে atomic করা হয়েছে।

    Transaction Flow:
    ─────────────────
    1. reserve_unique_events()       → dedup entries INSERT করে
    2. check_and_reserve_usage()     → non-held events quota reserve করে
    3. enqueue_events()              → outbox row একই transaction-এ save করে
    4. db.commit()                   → dedup + usage + outbox durable
    5. worker                        → পরে Facebook/TikTok/GA4/Webhook delivery করে
    """
    if not payload.data:
        raise HTTPException(status_code=400, detail="ইভেন্ট ডাটা খালি!")
    if len(payload.data) > MAX_EVENTS_PER_REQUEST:
        raise HTTPException(
            status_code=413,
            detail=f"Too many events in one request. Max {MAX_EVENTS_PER_REQUEST}.",
        )

    # ─── Domain Whitelisting (API Key চুরি প্রতিরোধ) ─────────────────
    # Client-এর domain সেট করা থাকলে, শুধু সেই ডোমেইন থেকে রিকোয়েস্ট নেবে
    # urlparse দিয়ে hostname extract করে exact match বা real subdomain চেক
    if client.domain:
        origin = request.headers.get("origin", "") or ""
        referer = request.headers.get("referer", "") or ""
        declared_origin = request.headers.get("x-capi-origin", "") or ""
        allowed_domain = client.domain.lower().strip()
        origin_host = (urlparse(origin).hostname or "").lower()
        referer_host = (urlparse(referer).hostname or "").lower()
        declared_host = (urlparse(declared_origin).hostname or declared_origin).lower().strip()
        signed_declared_origin_ok = False
        if declared_host:
            signed_declared_origin_ok = (
                _is_domain_allowed(declared_host, allowed_domain)
                and _verify_capi_signature(
                    await request.body(),
                    client.api_key,
                    request.headers.get("x-capi-timestamp", ""),
                    request.headers.get("x-capi-signature", ""),
                )
            )

        if not (origin_host or referer_host or signed_declared_origin_ok):
            logger.warning(f"[{client.name}] Domain header missing for locked domain: {allowed_domain}")
            raise HTTPException(
                status_code=403,
                detail="Missing domain proof. Send Origin, Referer, or signed X-CAPI-Origin for this API Key.",
            )
        if not (
            _is_domain_allowed(origin_host, allowed_domain)
            or _is_domain_allowed(referer_host, allowed_domain)
            or signed_declared_origin_ok
        ):
            logger.warning(
                f"[{client.name}] Domain mismatch! "
                f"Allowed: {allowed_domain}, Origin: {origin_host}, Referer: {referer_host}, Declared: {declared_host}"
            )
            raise HTTPException(
                status_code=403,
                detail="Unauthorized domain. এই API Key আপনার ডোমেইনে রেজিস্টার্ড নয়।",
            )

    # ─── Real IP Detection (Heroku/Cloudflare X-Forwarded-For হেডার থেকে) ──
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else None

    # ─── Auto-inject real IP & User-Agent into user_data ─────────────────
    # ফ্রন্টএন্ড থেকে placeholder IP (8.8.8.8) বা কোনো IP না আসলে
    # সার্ভার নিজেই ইউজারের আসল IP বসিয়ে দেবে
    PLACEHOLDER_IPS = {"8.8.8.8", "127.0.0.1", "0.0.0.0", None, ""}
    for event in payload.data:
        # Ensure user_data exists (schema now allows Optional)
        if not event.user_data:
            from app.schemas.event import UserData
            event.user_data = UserData()
        if event.user_data.client_ip_address in PLACEHOLDER_IPS:
            event.user_data.client_ip_address = client_ip
        if not event.user_data.client_user_agent:
            event.user_data.client_user_agent = request.headers.get("user-agent")

        # ─── GeoIP Enrichment ──────────────────────────────────────────
        if event.user_data.client_ip_address:
            loc_data = get_location_data(event.user_data.client_ip_address)
            if loc_data:
                from app.schemas.event import _clean_and_hash
                if loc_data.get("ct") and not event.user_data.ct:
                    event.user_data.ct = [_clean_and_hash(loc_data["ct"], "ct")]
                if loc_data.get("st") and not event.user_data.st:
                    event.user_data.st = [_clean_and_hash(loc_data["st"], "st")]
                if loc_data.get("country") and not event.user_data.country:
                    event.user_data.country = [_clean_and_hash(loc_data["country"], "country")]
                if loc_data.get("zp") and not event.user_data.zp:
                    event.user_data.zp = [_clean_and_hash(loc_data["zp"], "zp")]

    # ─── Durable Outbox Transaction ───────────────────────────────────
    # Dedup + usage reserve + queue insert একই transaction-এ commit হবে।
    should_hold = hold or client.deferred_purchase
    deferred_count = 0
    queued_count = 0
    try:
        unique_events = await reserve_unique_events(db, client, payload.data)
        if not unique_events:
            await db.commit()
            return EventsResponse(
                status="accepted",
                events_received=0,
                message="All events were already received earlier (deduplicated).",
            )

        deferred_events = []
        queue_events = []
        for event in unique_events:
            if should_hold and event.event_name == "Purchase":
                deferred_events.append(event)
            else:
                queue_events.append(event)

        reserved_keys = {}
        if queue_events:
            reserved_keys = await check_and_reserve_usage(db, client, len(queue_events))

        # Purchase events → pending_events table; confirm flow sends these later.
        for event in deferred_events:
            event_dict = event.model_dump(exclude_none=True)
            if event.custom_data and getattr(event.custom_data, "order_id", None):
                order_id = event.custom_data.order_id
            elif event.event_id:
                order_id = event.event_id
            else:
                order_id = f"auto-{event.event_time}-{id(event)}"

            try:
                async with db.begin_nested():
                    pending = PendingEvent(
                        client_id=client.id,
                        order_id=order_id,
                        event_data=event_dict,
                        status="pending",
                    )
                    db.add(pending)
                    await db.flush()  # unique constraint check
                deferred_count += 1
                logger.info(f"[{client.name}] Purchase hold: {order_id}")
            except Exception:
                logger.warning(f"[{client.name}] Duplicate pending order: {order_id}")

        if queue_events:
            events_as_dicts = [event.model_dump(exclude_none=True) for event in queue_events]
            request_context = {
                "ip_address": client_ip,
                "user_agent": request.headers.get("user-agent", ""),
                "cookies": {
                    key: value
                    for key, value in request.cookies.items()
                    if key in {"_ga", "_fbp", "_fbc"}
                },
            }
            await enqueue_events(
                db,
                client_id=client.id,
                events_data=events_as_dicts,
                request_context=request_context,
                usage_reserved=reserved_keys,
            )
            queued_count = len(queue_events)

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception:
        await db.rollback()
        logger.exception(f"[{client.name}] Event enqueue failed")
        raise HTTPException(status_code=500, detail="Failed to enqueue events") from None

    total_received = queued_count + deferred_count
    message_parts = []
    if queued_count:
        message_parts.append(f"{queued_count} event(s) queued for delivery")
    if deferred_count:
        message_parts.append(f"{deferred_count} Purchase event(s) held for confirmation")

    return EventsResponse(
        status="accepted",
        events_received=total_received,
        message="; ".join(message_parts) if message_parts else "No new events accepted.",
    )
