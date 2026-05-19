import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.event_outbox import EventOutbox

# Convert postgres:// to postgresql+asyncpg://
db_url = "postgres://udkpb48hprqfvc:p7b7b481e4c1c4bc1395f6e41dc6937ddd8481674b737cda9557e97fa790d1ac8@c1k8s6ugvmiskq.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/dej8gv9nr07p42"
db_url = db_url.replace("postgres://", "postgresql+asyncpg://")

engine = create_async_engine(db_url)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def check_stuck():
    async with async_session() as db:
        res = await db.execute(select(EventOutbox).where(EventOutbox.status != 'sent'))
        rows = res.scalars().all()
        print(f"Total pending outbox rows: {len(rows)}")
        for r in rows:
            print("====================================")
            print(f"ID: {r.id}")
            print(f"Client ID: {r.client_id}")
            print(f"Status: {r.status}")
            print(f"Attempts: {r.attempts}")
            print(f"Next attempt: {r.next_attempt_at}")
            print(f"Last error: {r.last_error}")
            print(f"Payload event: {r.event_payload[0].get('event_name') if r.event_payload and len(r.event_payload) > 0 else 'None'}")
            print(f"Payload ID: {r.event_payload[0].get('event_id') if r.event_payload and len(r.event_payload) > 0 else 'None'}")
            print(f"Full payload: {r.event_payload}")

if __name__ == "__main__":
    asyncio.run(check_stuck())
