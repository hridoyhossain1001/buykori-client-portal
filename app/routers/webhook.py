"""
WooCommerce Webhook Router
────────────────────────────
WordPress-এর বিল্ট-ইন Webhook সিস্টেম দিয়ে অর্ডার স্ট্যাটাস চেঞ্জ রিসিভ করে।
প্লাগইন ব্যবহার না করলেও এই endpoint দিয়ে Deferred Purchase কনফার্ম করা যায়।

Endpoints:
  POST /api/v1/webhook/woocommerce  — WooCommerce Webhook রিসিভ করে
"""

import base64
import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException, BackgroundTasks, Depends
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.models.client import Client
from app.models.pending_event import PendingEvent
from app.models.event_log import EventLog
from app.schemas.event import EventData
from app.services.capi_service import send_to_facebook
from app.services.usage_service import increment_usage_counters_db
from app.dependencies import CachedClient, _snapshot

logger = logging.getLogger(__name__)
router = APIRouter()

REQUIRE_WC_WEBHOOK_SIGNATURE = os.getenv("REQUIRE_WC_WEBHOOK_SIGNATURE", "true").lower() in ("1", "true", "yes")


def _verify_wc_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    """Verify WooCommerce X-WC-Webhook-Signature (base64 HMAC-SHA256)."""
    if not signature or not secret:
        return False
    digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).digest()
    expected = base64.b64encode(digest).decode()
    return hmac.compare_digest(expected, signature)


async def _get_client_by_api_key(api_key: str, db: AsyncSession):
    """API Key দিয়ে ক্লায়েন্ট খুঁজে বের করে।"""
    result = await db.execute(
        select(Client).where(
            and_(Client.api_key == api_key, Client.is_active == True)
        )
    )
    return result.scalar_one_or_none()


@router.post(
    "/webhook/woocommerce",
    summary="WooCommerce Webhook Receiver",
    description="WooCommerce order status change webhook রিসিভ করে এবং pending Purchase event কনফার্ম করে।",
)
async def woocommerce_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    WooCommerce Webhook Format:
    Header: X-WC-Webhook-Topic: order.updated / order.completed
    Header: X-API-Key: <client_api_key>
    Body: Full WooCommerce order JSON
    """

    # ─── API Key Authentication ───────────────────────────────────────
    api_key = request.headers.get("x-api-key", "")
    if not api_key:
        raise HTTPException(status_code=401, detail="API Key missing")

    client_row = await _get_client_by_api_key(api_key, db)
    if not client_row:
        raise HTTPException(status_code=401, detail="Invalid API Key")

    client = _snapshot(client_row)
    raw_body = await request.body()
    signature = request.headers.get("x-wc-webhook-signature", "")
    webhook_secret = os.getenv("WC_WEBHOOK_SECRET", "") or api_key
    if REQUIRE_WC_WEBHOOK_SIGNATURE and not _verify_wc_signature(raw_body, signature, webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid WooCommerce webhook signature")

    # ─── Parse Webhook Body ───────────────────────────────────────────
    try:
        body = json.loads(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # WooCommerce sends order data directly
    order_id = body.get("id") or body.get("order_id")
    status = body.get("status", "")

    if not order_id:
        raise HTTPException(status_code=400, detail="Order ID not found in payload")

    logger.info(f"[{client.name}] 📬 WooCommerce webhook: order #{order_id}, status: {status}")

    # ─── Only process completed/processing orders ─────────────────────
    if status not in ("completed", "processing"):
        return {
            "status": "ignored",
            "message": f"Order #{order_id} status '{status}' — no action needed",
        }

    # ─── Find pending event for this order ────────────────────────────
    # Try both 'wc_purchase_<id>' (plugin format) and raw order_id
    possible_ids = [f"wc_purchase_{order_id}", str(order_id)]

    pending = None
    for pid in possible_ids:
        result = await db.execute(
            select(PendingEvent).where(
                and_(
                    PendingEvent.client_id == client.id,
                    PendingEvent.order_id == pid,
                    PendingEvent.status == "pending",
                )
            ).with_for_update()
        )
        pending = result.scalar_one_or_none()
        if pending:
            break

    if not pending:
        confirmed_result = await db.execute(
            select(PendingEvent).where(
                and_(
                    PendingEvent.client_id == client.id,
                    PendingEvent.order_id.in_(possible_ids),
                    PendingEvent.status == "confirmed",
                )
            )
        )
        if confirmed_result.scalar_one_or_none():
            return {
                "status": "success",
                "order_id": str(order_id),
                "message": "Purchase event was already confirmed.",
            }
        return {
            "status": "skipped",
            "message": f"No pending Purchase event found for order #{order_id}",
        }

    # ─── Send to Facebook ─────────────────────────────────────────────
    event_dict = pending.event_data.copy()
    event_dict["event_time"] = int(datetime.now(timezone.utc).timestamp())

    try:
        event = EventData(**event_dict)
        fb_result = await send_to_facebook(client, [event])
    except Exception as e:
        await db.rollback()
        logger.error(f"[{client.name}] Webhook confirm failed (order #{order_id}): {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Facebook send failed: {e}",
        )

    # ─── Update pending status ────────────────────────────────────────
    pending.status = "confirmed"
    pending.confirmed_at = datetime.now(timezone.utc)
    await db.commit()

    # ─── Background: Log + Usage ──────────────────────────────────────
    async def _log_and_count():
        try:
            async with AsyncSessionLocal() as log_db:
                log_entry = EventLog(
                    client_id=client.id,
                    event_name=event_dict.get("event_name", "Purchase"),
                    event_id=event_dict.get("event_id"),
                    event_count=1,
                    status="success",
                    fb_response=json.dumps(fb_result) if fb_result else None,
                    ip_address=event_dict.get("user_data", {}).get("client_ip_address"),
                )
                log_db.add(log_entry)
                await log_db.commit()
            async with AsyncSessionLocal() as usage_db:
                await increment_usage_counters_db(usage_db, client, 1)
        except Exception as e:
            logger.error(f"Webhook log/usage error: {e}")

    background_tasks.add_task(_log_and_count)

    logger.info(f"[{client.name}] ✅ Webhook confirmed order #{order_id} → Facebook")

    return {
        "status": "success",
        "order_id": str(order_id),
        "message": "Purchase event confirmed and sent to Facebook!",
    }
