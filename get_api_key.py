import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select
from app.models.client import Client
from app.database import SQLALCHEMY_DATABASE_URL

engine = create_async_engine(SQLALCHEMY_DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_key():
    async with async_session() as db:
        res = await db.execute(select(Client.api_key).where(Client.name.ilike('%My Own website%')))
        key = res.scalars().first()
        print(f"KEY={key}")

if __name__ == "__main__":
    asyncio.run(get_key())
