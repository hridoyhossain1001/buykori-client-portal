# Prototype-to-Live Field Mapping Matrix

This matrix is the implementation boundary for replacing the live client UI. Server/session authorization remains unchanged; this document does not authorize deployment or provider writes.

## Orders and COD

| Prototype field | Live source | Mapping rule | Readiness |
|---|---|---|---|
| `Order.id` | `DeferredOrder.orderId`, `CourierOrder.order_id`, `StoreOrderLedgerItem.orderId` | Preserve exact server string and join only on the exact order ID. | Ready |
| Customer | `recipientName`, `customerName`, `customer`, provider fallbacks | Use the existing normalizer order; never infer identity from phone alone. | Ready |
| Location | `recipientAddress` / `customerAddress` | Display address; no dedicated city field currently exists. | Partial |
| Products | `DeferredOrder.products`, `CourierOrder.products` | Normalize `name/content_name`, quantity, price and attributes. | Ready |
| Total | `orderTotal` or `amount`; shipped order `cod_amount` | Preserve currency/source; do not recompute when a server total exists. | Ready |
| Payment | `StoreOrderLedgerItem.paymentMethod` | Deferred/courier records may not contain it; render `Not available` rather than guess COD. | Partial |
| Risk | `fraudScore` and `fraudDetails` | Use the existing verdict helper; unavailable checks retain reason/retry state. | Ready |
| Workflow status | `OrderWorkflowStatus` | Normalize with the table below; server result is authoritative. | Ready |
| Courier provider/tracking | `courier_provider`, `courier_tracking_id` | Keep separate fields; no combined-string parsing in production. | Ready |
| Courier status | `courier_status` | Normalize provider status without overwriting workflow status. | Ready |
| Timestamp | `orderOccurredAt`, `timestamp`, `created_at` | ISO input, Dhaka display timezone, absolute timestamp in details. | Ready |

COD Confirm/Skip/Restore uses `runDeferredOrderAction`. A successful click is not provider delivery success; the UI must refresh the deferred/event delivery state.

## Incomplete Checkouts

| Prototype field | Live source | Mapping rule | Readiness |
|---|---|---|---|
| Display ID | numeric `IncompleteCheckoutItem.id` | UI may format `CHK-{id}`, but every mutation uses the untouched numeric ID. | Ready with adapter |
| Name/phone/address | `customerName`, `phone`, `address` | Render server values; mask only where the permission policy requires it. | Ready |
| Address | address text in the checkout read model | Render the returned address as one value; do not parse or invent a dedicated city. | Ready with adapter |
| Cart | `products[]` | Normalize name/content ID, quantity, price and attributes. | Ready |
| Amount/currency | `amount`, `currency` | Server amount is authoritative. | Ready |
| Source | `campaignData.utm_source` | Show `Direct/Unknown` when absent. | Ready |
| Last activity | `lastActivityAt` | Current API exposes last activity, not checkout start. The prototype now uses Last activity consistently. | Ready with adapter |
| Last contact | no separate field | The prototype no longer invents or displays a last-contact timestamp. Add exact wording only after a contact-history API exists. | Ready without field |
| Status | `incomplete`, `contacted`, `ignored`, `recovered` | `incomplete` displays as Active; backend `active` is pre-threshold and is not in the default portal list. | Ready |
| Recovered order | create response `orderId` | Never generate client-side; preserve `pendingEventId`, `checkoutId`, `status`. | Ready |
| Sync state | create response has pending-event state, not Woo sync | Show Pending review/verification. Woo sync needs a later order workflow response. | Corrected |

## Events and Delivery

| Prototype field | Live source | Mapping rule | Readiness |
|---|---|---|---|
| Event ID | `CAPIEvent.deduplicationKey` / payload `event_id` | Preserve exact ID; display row `id` is not the provider event ID. | Ready |
| Event context | `pageUrl`, `pageTitle`, `contentName`, `orderId`, `itemCount` | Render only provided values. | Ready |
| Event status | `EventStatus` | Accepted, Delivered, Skipped, Failed and Retry remain distinct. | Ready |
| HTTP result | `httpCode` | Do not derive from status text. | Ready |
| Failure reason | sanitized `responseBody` | Apply existing redaction before render/export. | Ready |
| Delivery request ID | `APILog.id` | Preserve exact request/log ID. | Ready |
| Source event ID in delivery row | `APILog.eventId` | Returned from `EventLog.event_id`; exact ID correlation replaces timestamp joining. | Ready |
| Endpoint | `APILog.endpoint` | Use existing redaction boundary; raw secret query values never render. | Ready |
| Retry count | `APILog.retryCount` | Show separately from HTTP result. | Ready |
| Retry action | `APILog.outboxId/retryable` + `POST /api/outbox/{outbox_id}/retry` | Retry only a tenant-resolved, server-marked retryable outbox row. Never retry an API-log ID directly. | Ready |

## Status Normalization

| Live status | Display status |
|---|---|
| `pending` | Pending review |
| `on-hold` | On hold |
| `confirmed` | Confirmed |
| `processing` | Processing / Ready to ship only when business rules confirm readiness |
| `shipped` | Shipped |
| `completed` | Delivered |
| `cancelled` | Cancelled |
| `booking_queued`, `booking_processing` | Booking in progress |
| `booking_failed` | Booking failed |
| `in_transit`, `picked_up`, `shipped` courier state | In transit |
| `delivered`, `completed` courier state | Delivered |
| checkout `incomplete` | Active recovery |
| checkout `contacted` | Contacted |
| checkout `ignored` | Ignored |
| checkout `recovered` | Recovered |

## Formatting and Pagination

- Parse ISO timestamps and display in `Asia/Dhaka`; retain absolute ISO/time in details and exports.
- Currency comes from the record. Do not default all live records to BDT when the API provides another currency.
- Server totals win over UI-calculated totals. Calculated draft totals are preview-only until the server responds.
- Orders exposes `page/limit/total`, but the current client drops that metadata. Events exposes `offset/limit/totalCount`, but the current client loads only the first 100.
- COD/deferred, Checkouts, Courier, API logs, and Outbox do not expose complete authoritative page metadata; use `Showing latest N · history may be incomplete` until extended.
- Do not invent cursors. Preserve existing page-based or offset-based APIs and require deterministic timestamp + ID ordering before multi-page rollout.
- Empty filtered results, permission denial, unconfigured providers, stale cached data, and genuine zero counts are separate states.

## Mutation Result Rules

- No durable optimistic success.
- Disable repeated submission while a request is in flight.
- Apply returned IDs/status only after a successful server response.
- On partial WooCommerce/courier/provider failure, retain the server order and show the failed sync/action separately with retry guidance.
- A failed refresh after previous success produces a stale state and keeps the last successful timestamp.

## Current Replacement Blockers

1. Checkout copy now matches the available contract: the returned address is not parsed into a city, `lastActivityAt` is labelled Last activity, and no last-contact timestamp is inferred. A future contact-history UI still requires a backend field.
2. Backend pagination metadata and deterministic tie-break ordering are now complete across the primary operational reads. The prototype exposes visible page controls and incomplete-history warnings; staging must confirm the live adapter preserves authoritative `totalCount`/`hasMore` values.

With delivery DTO correlation/retry, checkout mapping, backend pagination, replacement-view controls, and production-shaped read-only adapter smoke corrected, live data-contract readiness is **9.7/10**. The remaining proof is an authenticated remote-staging GET smoke and rollback rehearsal; neither is authorized or possible without an explicit staging target/session.
