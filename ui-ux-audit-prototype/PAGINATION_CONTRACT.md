# Operational Pagination Contract

The replacement UI must not claim that a bounded first page is the complete customer history.

| Surface | Current backend | Current client state | Replacement behavior |
|---|---|---|---|
| Orders | `page`, `limit`, authoritative `totalCount`, `hasMore` | Service preserves the envelope | Add visible page controls before presenting more than the first page. |
| COD/deferred | `page`, `limit`, `hasMore`, `operationsHasMore` | Adapter preserves metadata | Keep the two queue totals separate and add visible pagination controls. |
| Checkouts | status + `offset`/`limit`, authoritative `totalCount`, `hasMore` | Response state preserves metadata | Reset offset on filters and add load-more/page controls. |
| Events | `offset`, `limit`, authoritative `totalCount`, `hasMore` | Stale request protection exists; UI still loads the first page | Retain metadata in view state and add visible paging/export-all behavior. |
| Courier | wrapped `orders` plus authoritative `totalCount`, `offset`, `limit`, `hasMore` | Service preserves the envelope | Add visible page controls before claiming full history. |
| API logs / Outbox | authoritative tenant-filtered total, offset, limit, has-more | Current view still renders the first page | Retain metadata in view state and expose paging without changing retry ownership. |

## Normalized adapter state

```ts
type PageInfo = {
  limit: number;
  page?: number;
  offset?: number;
  total?: number;
  hasMore?: boolean;
  historyMayBeIncomplete: boolean;
};
```

- Preserve page-based and offset-based APIs; do not invent cursors.
- Filters reset `page` to 1 or `offset` to 0.
- Abort or ignore stale requests using request IDs.
- A stable server order requires timestamp descending plus server-owned ID descending. Timestamp-only ordering can duplicate or skip rows between pages.
- Required tests: bounds, tenant-filtered totals, page-two non-overlap, filtered totals, empty final page, exact-multiple `hasMore`, and stale-request protection.

## Implementation Status

The backend contract blocker is resolved locally. Operational list queries now use tenant-filtered authoritative counts and deterministic timestamp-plus-ID ordering. Orders and courier client services preserve their pagination envelopes. The prototype now includes shared page controls on Orders, COD review, Incomplete checkouts, Event activity, and Delivery logs. These controls operate on preview fixtures only. When a fixture has no authoritative `totalCount`/`hasMore`, the control deliberately labels the count as **at least** and warns that history may be incomplete; it must not be read as the full customer history. Live wiring must consume server-returned metadata rather than derive totals from rendered rows.

The reusable preview helper is `paginationState.ts`. It preserves explicit server metadata, clamps unsafe page inputs, derives local page boundaries only for the fixture, and sets `historyMayBeIncomplete=true` when the server cannot prove completeness. `pagination-contract.test.ts` covers missing metadata, authoritative totals, final-page behavior, and bounded input normalization.
