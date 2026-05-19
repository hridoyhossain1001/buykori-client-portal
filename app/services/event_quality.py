import hashlib
import os
import uuid
from typing import Any

from app.schemas.event import CustomData, EventData, UserData


COMMERCE_EVENTS = {"ViewContent", "AddToCart", "ViewCart", "RemoveFromCart", "InitiateCheckout", "AddPaymentInfo", "Purchase"}
EVENT_ALIASES = {
    "page_view": "PageView",
    "view_item": "ViewContent",
    "add_to_cart": "AddToCart",
    "view_cart": "ViewCart",
    "remove_from_cart": "RemoveFromCart",
    "begin_checkout": "InitiateCheckout",
    "add_payment_info": "AddPaymentInfo",
    "purchase": "Purchase",
    "lead": "Lead",
    "search": "Search",
}
DEFAULT_CURRENCY = os.getenv("DEFAULT_EVENT_CURRENCY", "BDT").upper()


def _as_list(value: Any) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def _clean_ids(values: Any) -> list[str]:
    seen = set()
    cleaned = []
    for value in _as_list(values):
        if value is None:
            continue
        text = str(value).strip()
        if not text or text in seen:
            continue
        seen.add(text)
        cleaned.append(text)
    return cleaned


def _contents_from_ids(content_ids: list[str], content_type: str) -> list[dict]:
    return [{"content_id": cid, "content_type": content_type} for cid in content_ids]


def _ids_from_contents(contents: Any) -> list[str]:
    ids = []
    for item in _as_list(contents):
        if not isinstance(item, dict):
            continue
        content_id = item.get("content_id") or item.get("id") or item.get("item_id")
        if content_id:
            ids.append(content_id)
    return _clean_ids(ids)


def _numeric(value: Any) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _quantity(value: Any) -> int:
    try:
        return max(int(float(value)), 1)
    except (TypeError, ValueError):
        return 1


def _stable_event_suffix(event: EventData) -> str:
    custom_data = event.custom_data.model_dump(exclude_none=True) if event.custom_data else {}
    basis = "|".join(
        [
            event.event_name or "",
            str(event.event_time or ""),
            event.event_source_url or "",
            ",".join(custom_data.get("content_ids") or []),
            str(custom_data.get("value") or ""),
        ]
    )
    digest = hashlib.sha1(basis.encode("utf-8")).hexdigest()[:10]
    return f"{digest}_{uuid.uuid4().hex[:8]}"


def boost_event_quality(
    event: EventData,
    *,
    cookies: dict[str, str] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> EventData:
    """Normalize and enrich an event before it is saved/sent to ad platforms."""
    cookies = cookies or {}
    event.event_name = EVENT_ALIASES.get(event.event_name, event.event_name)

    if not event.user_data:
        event.user_data = UserData()
    if ip_address and not event.user_data.client_ip_address:
        event.user_data.client_ip_address = ip_address
    if user_agent and not event.user_data.client_user_agent:
        event.user_data.client_user_agent = user_agent

    if not event.user_data.fbp and cookies.get("_fbp"):
        event.user_data.fbp = cookies["_fbp"]
    if not event.user_data.fbc and cookies.get("_fbc"):
        event.user_data.fbc = cookies["_fbc"]
    if not event.user_data.ttp and cookies.get("_ttp"):
        event.user_data.ttp = cookies["_ttp"]
    if not event.user_data.ttclid and cookies.get("_ttclid"):
        event.user_data.ttclid = cookies["_ttclid"]

    if not event.event_id:
        event.event_id = f"auto_{event.event_name}_{_stable_event_suffix(event)}"

    if event.event_name in COMMERCE_EVENTS:
        if not event.custom_data:
            event.custom_data = CustomData()
        cd = event.custom_data
        cd.content_type = cd.content_type or "product"

        contents = getattr(cd, "contents", None) or []
        content_ids = _clean_ids(cd.content_ids) or _ids_from_contents(contents)
        if content_ids:
            cd.content_ids = content_ids
        if content_ids and not contents:
            setattr(cd, "contents", _contents_from_ids(content_ids, cd.content_type))

        numeric_value = _numeric(cd.value)
        if numeric_value is not None:
            cd.value = numeric_value
        if numeric_value is not None and not cd.currency:
            cd.currency = DEFAULT_CURRENCY
        if cd.currency:
            cd.currency = str(cd.currency).upper()

        if cd.num_items is None:
            if contents:
                cd.num_items = sum(_quantity(item.get("quantity")) for item in contents if isinstance(item, dict))
            elif content_ids:
                cd.num_items = len(content_ids)

        if event.event_name == "Purchase" and not cd.order_id:
            for key in ("transaction_id", "order_number", "orderId"):
                value = getattr(cd, key, None)
                if value:
                    cd.order_id = str(value)
                    break

    return event


def event_signal_flags(event_data: dict) -> dict[str, bool]:
    custom_data = event_data.get("custom_data") or {}
    user_data = event_data.get("user_data") or {}
    content_ids = custom_data.get("content_ids") or []
    contents = custom_data.get("contents") or []
    has_email_phone = bool(user_data.get("em") or user_data.get("ph"))
    has_browser = bool(user_data.get("fbp") or user_data.get("fbc") or user_data.get("ttp") or user_data.get("ttclid"))
    return {
        "has_content_ids": bool(content_ids),
        "has_contents": bool(contents),
        "has_value": custom_data.get("value") is not None,
        "has_currency": bool(custom_data.get("currency")),
        "has_user_match": bool(has_email_phone or has_browser or (user_data.get("client_ip_address") and user_data.get("client_user_agent"))),
        "has_email_phone": has_email_phone,
        "has_click_id": bool(user_data.get("fbc") or user_data.get("ttclid")),
        "has_event_id": bool(event_data.get("event_id")),
        "has_utm": bool(custom_data.get("utm_source") or custom_data.get("utm_campaign")),
    }
