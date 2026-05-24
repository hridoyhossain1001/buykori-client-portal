"""
Retry Service — ব্যর্থ ইভেন্ট পুনরায় Facebook-এ পাঠানোর সার্ভিস।
Background task হিসেবে চলে, exponential backoff সহ।
"""
import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.dependencies import _snapshot
from app.models.client import Client
from app.models.event_log import EventLog
from app.models.failed_event import FailedEvent
from app.schemas.event import EventData
from app.services.capi_service import send_to_facebook
from app.services.ga4_service import send_to_ga4
from app.services.tiktok_service import send_to_tiktok
from app.services.webhook_service import send_webhook
from app.services.usage_service import increment_usage_counters_db

logger = logging.getLogger(__name__)

# Retry intervals (seconds): 30s, 2min, 10min, 30min, 1hr
RETRY_DELAYS = [30, 120, 600, 1800, 3600]


async def save_failed_event(
    db: AsyncSession,
    client_id: int,
    events_data: list,
    error_message: str,
) -> bool:
    """ব্যর্থ ইভেন্ট DB-তে সংরক্ষণ করো retry-এর জন্য"""
    try:
        failed = FailedEvent(
            client_id=client_id,
            event_payload=events_data,
            error_message=error_message[:500],
        )
        db.add(failed)
        await db.flush()
        logger.info(f"[Client {client_id}] Failed event saved for retry")
        return True
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save failed event: {e}")
        return False


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _retry_is_due(failed: FailedEvent, now: datetime) -> bool:
    delay_index = min(failed.retry_count, len(RETRY_DELAYS) - 1)
    if not failed.last_retry_at:
        return True
    elapsed = (now - _as_utc(failed.last_retry_at)).total_seconds()
    return elapsed >= RETRY_DELAYS[delay_index]


async def claim_due_failed_events(db: AsyncSession, limit: int = 20) -> list[FailedEvent]:
    """
    Retry করার আগে row lock করে claim করা হয়।
    একাধিক worker থাকলেও একই failed event একসাথে পাঠানো হবে না।
    SQL-এ due-time ফিল্টার করা হয় যেন LIMIT শুধু due ইভেন্টে প্রযোজ্য হয়।
    """
    from sqlalchemy import or_

    now = datetime.now(timezone.utc)
    # SQL-level: শুধুমাত্র due হতে পারে এমন row fetch করো
    # (last_retry_at NULL = pending, অথবা minimum 30s পার হয়ে গেছে)
    min_delay = RETRY_DELAYS[0]  # 30 seconds
    result = await db.execute(
        select(FailedEvent)
        .where(
            and_(
                FailedEvent.status.in_(["pending", "retrying"]),
                FailedEvent.retry_count < FailedEvent.max_retries,
                or_(
                    FailedEvent.last_retry_at.is_(None),
                    FailedEvent.last_retry_at <= now - timedelta(seconds=min_delay),
                ),
            )
        )
        .order_by(FailedEvent.created_at.asc())
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    failed_events = result.scalars().all()

    # Python-level: exact RETRY_DELAYS দিয়ে precise check
    due_events: list[FailedEvent] = []
    for failed in failed_events:
        if not _retry_is_due(failed, now):
            continue
        failed.status = "retrying"
        failed.last_retry_at = now
        due_events.append(failed)

    if due_events:
        await db.commit()
    else:
        await db.rollback()

    return due_events


async def retry_failed_events():
    """
    Background task — pending ব্যর্থ ইভেন্ট retry করে।
    প্রতি ৬০ সেকেন্ডে চলে।
    """
    while True:
        try:
            async with AsyncSessionLocal() as db:
                failed_events = await claim_due_failed_events(db)

                for failed in failed_events:
                    # Client তথ্য আনো
                    client_result = await db.execute(
                        select(Client).where(Client.id == failed.client_id)
                    )
                    client_row = client_result.scalar_one_or_none()
                    if not client_row or not client_row.is_active:
                        # Client inactive — dead letter queue-তে পাঠাও
                        failed.status = "dead"
                        await db.commit()
                        continue

                    # ORM object থেকে session-independent snapshot তৈরি করো
                    # DetachedInstanceError প্রতিরোধ করতে — event_worker.py-এর সাথে consistent
                    client = _snapshot(client_row)

                    try:
                        # ইভেন্ট ডাটা থেকে EventData অবজেক্ট তৈরি করো
                        events = [EventData(**e) for e in failed.event_payload]

                        # Check enabled platforms
                        facebook_enabled = bool(getattr(client, "enable_facebook", True) and client.pixel_id and client.access_token)
                        tiktok_enabled = bool(getattr(client, "enable_tiktok", True) and client.tiktok_pixel_id and client.tiktok_access_token)
                        ga4_enabled = bool(getattr(client, "enable_ga4", True) and client.ga4_measurement_id and client.ga4_api_secret)
                        webhook_enabled = bool(client.webhook_url)

                        if not any([facebook_enabled, tiktok_enabled, ga4_enabled, webhook_enabled]):
                            raise RuntimeError("No delivery platform enabled for this client")

                        result = None
                        primary_sent = False

                        # Try Facebook first if enabled
                        if facebook_enabled:
                            result = await send_to_facebook(client, events)
                            primary_sent = True

                        # If Facebook not enabled but TikTok is, TikTok is primary
                        primary_tiktok_sent = False
                        if not primary_sent and tiktok_enabled:
                            tiktok_result = await send_to_tiktok(client, events)
                            if not tiktok_result or tiktok_result.get("code") not in (0, None):
                                raise RuntimeError(f"TikTok primary send failed: {tiktok_result}")
                            primary_sent = True
                            primary_tiktok_sent = True

                        # If neither is enabled, try GA4 as primary
                        primary_ga4_sent = False
                        events_data = [event.model_dump(exclude_none=True) for event in events]
                        if not primary_sent and ga4_enabled:
                            first_user_data = events[0].user_data if (events and events[0].user_data) else None
                            cookies = {}
                            if first_user_data:
                                if first_user_data.fbp: cookies["_fbp"] = first_user_data.fbp
                                if first_user_data.fbc: cookies["_fbc"] = first_user_data.fbc
                                if first_user_data.ttp: cookies["_ttp"] = first_user_data.ttp
                            ga4_result = await send_to_ga4(
                                events=events_data,
                                measurement_id=client.ga4_measurement_id,
                                api_secret=client.ga4_api_secret,
                                cookies=cookies,
                                ip_address=first_user_data.client_ip_address if first_user_data else None,
                                user_agent=first_user_data.client_user_agent if first_user_data else "",
                            )
                            if ga4_result and not ga4_result.get("ok", True):
                                raise RuntimeError(f"GA4 primary send failed: {ga4_result.get('error') or ga4_result}")
                            primary_sent = True
                            primary_ga4_sent = True

                        # If primary succeeded, do secondary sends in parallel
                        if primary_sent:
                            secondary_tasks = []
                            first_user_data = events[0].user_data if (events and events[0].user_data) else None
                            ip_address = first_user_data.client_ip_address if first_user_data else None
                            user_agent = first_user_data.client_user_agent if first_user_data else ""
                            event_names = ", ".join(sorted({event.event_name for event in events}))

                            if tiktok_enabled and not primary_tiktok_sent:
                                async def _tiktok_sec(client=client, events=events):
                                    try:
                                        await send_to_tiktok(client, events)
                                    except Exception as se:
                                        logger.warning(f"Secondary TikTok retry failed: {se}")
                                secondary_tasks.append(_tiktok_sec())

                            if ga4_enabled and not primary_ga4_sent:
                                cookies = {}
                                if first_user_data:
                                    if first_user_data.fbp: cookies["_fbp"] = first_user_data.fbp
                                    if first_user_data.fbc: cookies["_fbc"] = first_user_data.fbc
                                    if first_user_data.ttp: cookies["_ttp"] = first_user_data.ttp
                                async def _ga4_sec(
                                    events_data=events_data,
                                    measurement_id=client.ga4_measurement_id,
                                    api_secret=client.ga4_api_secret,
                                    cookies=cookies,
                                    ip_address=ip_address,
                                    user_agent=user_agent,
                                ):
                                    try:
                                        await send_to_ga4(
                                            events=events_data,
                                            measurement_id=measurement_id,
                                            api_secret=api_secret,
                                            cookies=cookies,
                                            ip_address=ip_address,
                                            user_agent=user_agent,
                                        )
                                    except Exception as se:
                                        logger.warning(f"Secondary GA4 retry failed: {se}")
                                secondary_tasks.append(_ga4_sec())

                            if webhook_enabled:
                                async def _webhook_sec(
                                    webhook_url=client.webhook_url,
                                    client_name=client.name,
                                    events_data=events_data,
                                ):
                                    for event_data in events_data:
                                        try:
                                            await send_webhook(
                                                webhook_url,
                                                "event.sent",
                                                {
                                                    "client_name": client_name,
                                                    "event_name": event_data.get("event_name"),
                                                    "event_id": event_data.get("event_id"),
                                                    "custom_data": event_data.get("custom_data", {}),
                                                },
                                            )
                                        except Exception as se:
                                            logger.warning(f"Secondary Webhook retry failed: {se}")
                                secondary_tasks.append(_webhook_sec())

                            if secondary_tasks:
                                await asyncio.gather(*secondary_tasks)

                        # সফল! স্ট্যাটাস আপডেট করো
                        failed.status = "success"
                        failed.last_retry_at = datetime.now(timezone.utc)
                        event_names = ", ".join(sorted({event.event_name for event in events}))
                        db.add(EventLog(
                            client_id=client.id,
                            event_name=event_names,
                            event_count=len(events),
                            status="success",
                            fb_response=json.dumps(result) if result else None,
                        ))
                        await db.commit()

                        try:
                            # Usage counter errors should not undo the already persisted retry success.
                            async with db.begin_nested():
                                await increment_usage_counters_db(db, client, len(events))
                            await db.commit()
                        except Exception as usage_error:
                            await db.rollback()
                            logger.warning(
                                f"[{client.name}] Retry usage counter failed (non-fatal): {usage_error}"
                            )

                        logger.info(
                            f"[{client.name}] Retry #{failed.retry_count + 1} সফল! "
                            f"{len(events)} ইভেন্ট পাঠানো হয়েছে।"
                        )

                    except Exception as e:
                        failed.retry_count += 1
                        failed.last_retry_at = datetime.now(timezone.utc)
                        failed.status = "retrying" if failed.retry_count < failed.max_retries else "dead"
                        failed.error_message = str(e)[:500]
                        await db.commit()

                        logger.warning(
                            f"[{client.name}] Retry #{failed.retry_count} ব্যর্থ: {str(e)[:100]}"
                        )

        except Exception as e:
            logger.error(f"Retry service error: {e}")

        # ৬০ সেকেন্ড অপেক্ষা করো
        await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(retry_failed_events())
