"""
Event Deduplication Service — Shared by events.py and tracker.py.

PostgreSQL এ INSERT ... ON CONFLICT DO NOTHING ... RETURNING ব্যবহার করে,
SQLite এ fallback logic ব্যবহার করে।
"""
import logging
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import engine
from app.models.event_dedup import EventDedup

logger = logging.getLogger(__name__)


async def reserve_unique_event_ids(
    db: AsyncSession,
    client_id: int,
    candidate_ids: list[str],
) -> set[str]:
    """
    Atomically reserve event IDs for deduplication.
    Returns set of successfully reserved (new) event IDs.

    caller নিজে transaction manage করবে — এখানে commit/rollback হয় না।
    """
    if not candidate_ids:
        return set()

    if engine.dialect.name == "postgresql":
        rows = [{"client_id": client_id, "event_id": eid} for eid in candidate_ids]
        stmt = (
            pg_insert(EventDedup)
            .values(rows)
            .on_conflict_do_nothing(index_elements=["client_id", "event_id"])
            .returning(EventDedup.event_id)
        )
        result = await db.execute(stmt)
        return set(result.scalars().all())
    else:
        # SQLite fallback
        stmt = select(EventDedup.event_id).where(
            and_(
                EventDedup.client_id == client_id,
                EventDedup.event_id.in_(candidate_ids),
            )
        )
        res = await db.execute(stmt)
        existing_ids = set(res.scalars().all())
        reserved = set()
        for event_id in candidate_ids:
            if event_id not in existing_ids:
                db.add(EventDedup(client_id=client_id, event_id=event_id))
                reserved.add(event_id)
        if reserved:
            await db.flush()
        return reserved
