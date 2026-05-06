"""
Usage Service — PostgreSQL-backed rate limit ও daily quota enforcement।

দুইটি আলাদা function:
  - check_usage_limits_db()   → শুধু READ করে, limit ছাড়ালে 429 দেয়
  - increment_usage_counters_db() → সফল send-এর পরে counter বাড়ায়

In-memory counter-এর বদলে DB-তে atomic INSERT ... ON CONFLICT DO UPDATE
ব্যবহার করে। সকল uvicorn worker একই counter শেয়ার করে।
"""
import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.usage_counter import UsageCounter

logger = logging.getLogger(__name__)


async def check_usage_limits_db(
    db: AsyncSession,
    client,
    incoming_event_count: int,
) -> None:
    """
    Usage limits READ-ONLY check — counter বাড়ায় না।
    Limit ছাড়ালে HTTPException(429) raise করে।
    Counter increment আলাদা function-এ করা হয়, শুধু successful send-এর পরে।
    """
    now = datetime.now(timezone.utc)
    rate_limit = client.rate_limit or 5000

    # ─── Per-Minute Rate Limit Check ───────────────────────────────────
    minute_key = f"rate:{now.strftime('%Y-%m-%dT%H:%M')}"

    result = await db.execute(
        select(UsageCounter.count).where(
            UsageCounter.client_id == client.id,
            UsageCounter.window_key == minute_key,
        )
    )
    current_rate = result.scalar() or 0

    if current_rate + incoming_event_count > rate_limit:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded! {current_rate + incoming_event_count}/{rate_limit} events/min",
        )

    # ─── Daily Quota Check ─────────────────────────────────────────────
    if client.daily_quota:
        daily_key = f"daily:{now.strftime('%Y-%m-%d')}"

        daily_result = await db.execute(
            select(UsageCounter.count).where(
                UsageCounter.client_id == client.id,
                UsageCounter.window_key == daily_key,
            )
        )
        current_daily = daily_result.scalar() or 0

        if current_daily + incoming_event_count > client.daily_quota:
            raise HTTPException(
                status_code=429,
                detail=f"Daily quota exceeded! Today {current_daily + incoming_event_count}/{client.daily_quota} events sent.",
            )


async def increment_usage_counters_db(
    db: AsyncSession,
    client,
    event_count: int,
) -> None:
    """
    Usage counters atomic increment — শুধু সফল Facebook send-এর পরে কল করো।
    Atomic upsert দিয়ে counter increment করে — সব worker জুড়ে accurate।
    """
    now = datetime.now(timezone.utc)

    # ─── Per-Minute Rate Counter ───────────────────────────────────────
    minute_key = f"rate:{now.strftime('%Y-%m-%dT%H:%M')}"
    rate_stmt = (
        pg_insert(UsageCounter)
        .values(
            client_id=client.id,
            window_key=minute_key,
            count=event_count,
        )
        .on_conflict_do_update(
            constraint="uq_client_window",
            set_={"count": UsageCounter.count + event_count},
        )
    )
    await db.execute(rate_stmt)

    # ─── Daily Quota Counter ───────────────────────────────────────────
    if client.daily_quota:
        daily_key = f"daily:{now.strftime('%Y-%m-%d')}"
        daily_stmt = (
            pg_insert(UsageCounter)
            .values(
                client_id=client.id,
                window_key=daily_key,
                count=event_count,
            )
            .on_conflict_do_update(
                constraint="uq_client_window",
                set_={"count": UsageCounter.count + event_count},
            )
        )
        await db.execute(daily_stmt)

    await db.commit()
