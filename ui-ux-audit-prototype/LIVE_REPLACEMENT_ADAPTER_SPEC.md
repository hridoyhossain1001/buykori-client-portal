# Live Replacement Adapter Specification

This specification is for replacing the current client portal UI with the audited prototype direction. It is documentation only: the prototype does not call these endpoints, and no production adapter is implemented by this file.

## Non-negotiable adapter rules

- Server responses are authoritative for IDs, status, timestamps, totals, sync state, and provider delivery state.
- The adapter must preserve `ActorContext` tenant scope; browser-supplied store/client IDs never authorize a request.
- Read failures remain visible as errors or `Not available`; they must not become zero, empty success, or optimistic green states.
- Mutations return the server result before the UI changes a durable state. Failed or partial results remain retryable.
- Provider credentials, tokens, raw payload secrets, and unredacted endpoint query parameters never enter UI state.

## Surface mapping

| Prototype surface | Read endpoint/service | Server-owned identity | UI mapping | Mutation boundary |
|---|---|---|---|---|
| Orders | `fetchDeferredData` → `/api/deferred`; `fetchStoreOrderLedger` → `/api/v1/orders?limit=100`; `loadCourierOrders` → `/api/courier/orders` | `DeferredOrder.orderId`, `StoreOrderLedgerItem.orderId`, `CourierOrder.order_id` | Customer, amount, products, workflow status, courier provider/tracking/status, data quality | `updateOrderWorkflowStatus`; courier booking/cancel endpoints; never synthesize shipped/delivered |
| COD review | `fetchDeferredData` → `/api/deferred` | `pendingEventId`/order ID plus decision audit record | Pending, risk, age, confirm/skip, restore, delivery outcome | `runDeferredOrderAction('confirm'|'cancel'|'restore')`; provider delivery is a separate result |
| Incomplete checkouts | `/api/incomplete-checkouts` → `IncompleteCheckoutData` | numeric `IncompleteCheckoutItem.id` | Name, phone, address, cart, amount, status, last activity, returned `orderId` | `/api/incomplete-checkouts/{id}/status`; `/create-order`; never generate checkout/order IDs in the client |
| Event activity | `EventLogsView` event/delivery read model | event ID and grouped delivery IDs | Event, destinations, status, timestamp, sanitized reason, retry state | Retry endpoint/service must return queued/accepted/failed state; no direct provider call |
| Delivery logs | `/api/delivery/health` plus delivery-history read model | delivery request ID and source event ID | Provider health, HTTP result, retry count, endpoint host (redacted) | Retry only through registered application action; preserve request correlation |

## State contract

Every adapter result should expose or derive:

```ts
type AdapterState = {
  status: 'loading' | 'ready' | 'empty' | 'error' | 'partial' | 'stale';
  lastSyncedAt?: string;
  tenantScope?: string;
  retryable?: boolean;
  message?: string;
};
```

`partial` is required when a health request succeeds but history fails (or the reverse). `stale` is required when the last successful read is displayed after refresh failure. A filtered empty result must remain distinct from an unconfigured or permission-denied result.

## Replacement gate

The UI replacement is ready for staging only after:

1. Adapter contract tests cover every field above and malformed/missing fields.
2. Tenant-isolation tests prove the adapter cannot select another store from request-body data.
3. Mutation tests prove no UI state is marked successful before the server result.
4. Snapshot tests use real-shaped, redacted responses with stable IDs.
5. Rollback restores the previous UI bundle without a schema or provider change.

Until these gates pass, the audited prototype remains a visual and interaction reference, not a production replacement.
