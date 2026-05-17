import asyncio
from app.database import AsyncSessionLocal
from app.models.client import Client
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Client.name, Client.api_key, Client.is_active))
        rows = res.all()
        for r in rows:
            print(f"Name: {r[0]} | API Key: {r[1]} | Active: {r[2]}")

if __name__ == "__main__":
    asyncio.run(main())
