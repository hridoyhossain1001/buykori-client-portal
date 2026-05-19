import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import update
from app.models.event_outbox import EventOutbox

db_url = "postgres://udkpb48hprqfvc:p7b7b481e4c1c4bc1395f6e41dc6937ddd8481674b737cda9557e97fa790d1ac8@c1k8s6ugvmiskq.cluster-czrs8kj4isg7.us-east-1.rds.amazonaws.com:5432/dej8gv9nr07p42"
db_url = db_url.replace("postgres://", "postgresql+asyncpg://")

engine = create_async_engine(db_url)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def reset_stuck():
    async with async_session() as db:
        # Reset any stuck 'processing' rows back to 'queued' and clear locks
        stmt = (
            update(EventOutbox)
            .where(EventOutbox.status == 'processing')
            .values(status='queued', locked_at=None, locked_by=None, attempts=0)
        )
        result = await db.execute(stmt)
        await db.commit()
        print(f"Successfully reset {result.rowcount} stuck outbox rows.")

if __name__ == "__main__":
    asyncio.run(reset_stuck())
