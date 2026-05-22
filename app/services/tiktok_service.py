"""TikTok Events API service."""

import logging
from datetime import datetime, timezone
from typing import List

from app.schemas.event import EventData
from app.security import decrypt_token
from app.services.capi_service import get_http_client

logger = logging.getLogger(__name__)

TIKTOK_API_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/"
TIKTOK_PIXEL_TRACK_URL = "https://business-api.tiktok.com/open_api/v1.3/pixel/track/"


def _number(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _quantity(value) -> int:
    number = _number(value)
    if number is None:
        return 0
    return max(0, int(number))


def _map_event_name(fb_event_name: str) -> str:
    mapping = {
        "PageView": "PageView",
        "ViewContent": "ViewContent",
        "AddToCart": "AddToCart",
        "InitiateCheckout": "InitiateCheckout",
        "AddPaymentInfo": "AddPaymentInfo",
        "Purchase": "Purchase",
        "CompletePayment": "CompletePayment",
        "Lead": "SubmitForm",
        "Contact": "Contact",
        "Search": "Search",
        "Subscribe": "Subscribe",
        "CompleteRegistration": "CompleteRegistration",
    }
    return mapping.get(fb_event_name, fb_event_name)


def _normalize_tiktok_contents(cd) -> list[dict]:
    content_type = cd.content_type or "product"
    raw_contents = getattr(cd, "contents", None) or []
    normalized = []

    for item in raw_contents:
        if not isinstance(item, dict):
            continue

        content_id = item.get("content_id") or item.get("id")
        if not content_id:
            continue

        normalized_item = {
            "content_id": str(content_id),
            "content_type": item.get("content_type") or content_type,
        }

        if item.get("content_name"):
            normalized_item["content_name"] = item.get("content_name")
        if item.get("content_category"):
            normalized_item["content_category"] = item.get("content_category")

        quantity = _quantity(item.get("quantity"))
        if quantity:
            normalized_item["quantity"] = quantity

        price = _number(item.get("price"))
        if price is None:
            price = _number(item.get("item_price"))
        if price is not None:
            normalized_item["price"] = price

        normalized.append(normalized_item)

    if normalized:
        return normalized

    if cd.content_ids:
        return [
            {"content_id": str(cid), "content_type": content_type}
            for cid in cd.content_ids
            if cid
        ]

    return []


def _build_properties(event: EventData) -> dict:
    if not event.custom_data:
        return {}

    cd = event.custom_data
    properties = {}

    if cd.value is not None:
        properties["value"] = cd.value
    if cd.currency:
        properties["currency"] = cd.currency
    if cd.content_type:
        properties["content_type"] = cd.content_type
    if cd.content_ids:
        properties["content_ids"] = [str(cid) for cid in cd.content_ids if cid]
        if len(properties["content_ids"]) == 1:
            properties["content_id"] = properties["content_ids"][0]
        properties.setdefault("content_type", cd.content_type or "product")

    contents = _normalize_tiktok_contents(cd)
    if contents:
        properties["contents"] = contents
        total_quantity = sum(_quantity(item.get("quantity")) for item in contents)
        if total_quantity:
            properties["quantity"] = total_quantity
        if contents[0].get("content_name"):
            properties["description"] = contents[0]["content_name"]

    if cd.order_id:
        properties["order_id"] = cd.order_id
    if cd.num_items is not None:
        properties["num_items"] = cd.num_items
        properties.setdefault("quantity", cd.num_items)

    return properties


def _build_context(event: EventData) -> dict:
    context = {
        "page": {
            "url": event.event_source_url or "",
        }
    }

    if not event.user_data:
        return context

    ud = event.user_data
    if ud.client_user_agent:
        context["user_agent"] = ud.client_user_agent
    if ud.client_ip_address:
        context["ip"] = ud.client_ip_address
    if ud.ttclid:
        context["ad"] = {"callback": ud.ttclid}

    user = {}
    if ud.em:
        user["email"] = ud.em[0]
    if ud.ph:
        user["phone_number"] = ud.ph[0]
    if ud.external_id:
        user["external_id"] = ud.external_id[0]
    if ud.ttp:
        user["ttp"] = ud.ttp
    if user:
        context["user"] = user

    return context


def _build_tiktok_payload(client, events: List[EventData]) -> dict:
    tiktok_events = []

    for event in events:
        tt_event = {
            "event": _map_event_name(event.event_name),
            "event_id": event.event_id or "",
            "event_time": int(event.event_time),
            "page": {
                "url": event.event_source_url or "",
            },
        }

        if event.user_data:
            ud = event.user_data
            context = {
                "user_agent": ud.client_user_agent or "",
                "ip": ud.client_ip_address or "",
            }
            user = {}
            if ud.em:
                user["email"] = ud.em[0]
            if ud.ph:
                user["phone_number"] = ud.ph[0]
            if ud.external_id:
                user["external_id"] = ud.external_id[0]
            if ud.ttp:
                user["ttp"] = ud.ttp
            if ud.ttclid:
                context["ad"] = {"callback": ud.ttclid}
            context["user"] = user
            tt_event["context"] = context

        properties = _build_properties(event)
        if properties:
            tt_event["properties"] = properties

        tiktok_events.append(tt_event)

    return {
        "pixel_code": client.tiktok_pixel_id,
        "event_source": "web",
        "event_source_id": client.tiktok_pixel_id,
        "data": tiktok_events,
    }


def _build_pixel_track_payload(client, event: EventData) -> dict:
    payload = {
        "pixel_code": client.tiktok_pixel_id,
        "event": _map_event_name(event.event_name),
        "event_id": event.event_id or "",
        "timestamp": datetime.fromtimestamp(int(event.event_time), timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
        "event_source": "web",
        "test_event_code": getattr(client, "tiktok_test_event_code", None),
        "context": _build_context(event),
    }

    properties = _build_properties(event)
    if properties:
        payload["properties"] = properties

    return payload


async def send_to_tiktok(client, events: List[EventData]) -> dict | None:
    """Send events to TikTok. Test-code mode uses pixel/track so Events Manager displays them."""
    if not client.tiktok_pixel_id or not client.tiktok_access_token:
        return None

    try:
        http_client = await get_http_client()
        headers = {
            "Access-Token": decrypt_token(client.tiktok_access_token),
            "Content-Type": "application/json",
        }

        if getattr(client, "tiktok_test_event_code", None):
            responses = []
            for event in events:
                response = await http_client.post(
                    TIKTOK_PIXEL_TRACK_URL,
                    json=_build_pixel_track_payload(client, event),
                    headers=headers,
                )
                responses.append(response.json())

            failed = [item for item in responses if item.get("code") != 0]
            result = {
                "code": 0 if not failed else failed[0].get("code"),
                "message": "OK" if not failed else failed[0].get("message", "TikTok test event failed"),
                "test_event_code_used": True,
                "responses": responses,
            }
            response_status = 200 if not failed else 400
        else:
            response = await http_client.post(
                TIKTOK_API_URL,
                json=_build_tiktok_payload(client, events),
                headers=headers,
            )
            result = response.json()
            response_status = response.status_code

        if response_status == 200 and result.get("code") == 0:
            logger.info(
                f"[{client.name}] TikTok: {len(events)} event(s) successful. "
                f"Response: {result.get('message', 'OK')}"
            )
        else:
            logger.warning(
                f"[{client.name}] TikTok API warning: "
                f"Status={response_status}, Response={result}"
            )

        return result

    except Exception as e:
        logger.error(f"[{client.name}] TikTok error (non-fatal): {e}")
        return None
