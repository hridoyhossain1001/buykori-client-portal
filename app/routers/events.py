import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.schemas.event import EventsPayload, EventsResponse
from app.dependencies import get_current_client
from app.services.capi_service import send_to_facebook
from app.models.client import Client

logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)
router = APIRouter()


@router.post(
    "/events",
    response_model=EventsResponse,
    summary="Facebook CAPI Events Endpoint",
    description="ক্লায়েন্টের GTM Server এই endpoint-এ ইভেন্ট পাঠাবে।"
)
@limiter.limit("300/minute")  # প্রতি IP থেকে প্রতি মিনিটে সর্বোচ্চ ৩০০ রিকোয়েস্ট
async def receive_events(
    request: Request,
    payload: EventsPayload,
    client: Client = Depends(get_current_client),
):
    """
    ক্লায়েন্টের API Key ভেরিফাই করে Facebook CAPI-তে ইভেন্ট ফরওয়ার্ড করে।
    """
    if not payload.data:
        raise HTTPException(status_code=400, detail="ইভেন্ট ডাটা খালি।")

    try:
        result = await send_to_facebook(client, payload.data)
        events_sent = result.get("events_received", len(payload.data))

        return EventsResponse(
            status="success",
            events_sent=events_sent,
            message=f"✅ {events_sent}টি ইভেন্ট সফলভাবে Facebook-এ পাঠানো হয়েছে।"
        )

    except Exception as e:
        logger.error(f"Event processing failed for client [{client.name}]: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Facebook CAPI-তে পাঠাতে সমস্যা হয়েছে: {str(e)}"
        )
