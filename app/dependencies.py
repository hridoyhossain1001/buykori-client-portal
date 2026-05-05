from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.client import Client


async def get_current_client(
    x_api_key: str = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> Client:
    """
    প্রতিটি /events রিকোয়েস্টে X-API-Key হেডার চেক করে
    ক্লায়েন্ট ভেরিফাই করে।
    """
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="API Key প্রয়োজন। X-API-Key header পাঠান।"
        )

    result = await db.execute(
        select(Client).where(
            Client.api_key == x_api_key,
            Client.is_active == True
        )
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(
            status_code=401,
            detail="Invalid বা Inactive API Key।"
        )

    return client
