import asyncio
from app.database import AsyncSessionLocal
from app.models.client import Client
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Client.name, Client.rate_limit))
        print(f"CLIENTS: {res.all()}")

if __name__ == "__main__":
    asyncio.run(main())
