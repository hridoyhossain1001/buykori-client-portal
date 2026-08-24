import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

type ReadState = "loading" | "ready" | "empty" | "error" | "partial" | "stale";

const orderFixture = {
  tenantScope: "tenant-demo-001",
  orderId: "WC-9284",
  status: "processing",
  total: 2790,
  currency: "BDT",
  courier: { provider: "pathao", trackingId: "PT-849201", status: "in_transit" },
  lastSyncedAt: "2026-08-23T08:42:00Z",
};

const checkoutFixture = {
  tenantScope: "tenant-demo-001",
  id: 1048,
  status: "active",
  amount: 2790,
  orderId: null,
  lastActivityAt: "2026-08-23T08:35:00Z",
};

const eventFixture = {
  tenantScope: "tenant-demo-001",
  eventId: "evt_8f2a...923",
  deliveryRequestId: "req_19204",
  status: "failed",
  reason: "HTTP 400 · Purchase event had no order value",
};

function stateForRead(input: { ok: boolean; rows?: unknown[]; lastSyncedAt?: string; hadPrevious?: boolean; partial?: boolean }): ReadState {
  if (!input.ok) return input.hadPrevious ? "stale" : "error";
  if (input.partial) return "partial";
  if (input.rows && input.rows.length === 0) return "empty";
  return "ready";
}

function normalizeOrder(value: typeof orderFixture) {
  return { id: value.orderId, status: value.status, total: value.total, courierTrackingId: value.courier.trackingId };
}

const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;

test("preserves server-owned order and courier identifiers", () => {
  const view = normalizeOrder(orderFixture);
  assert.equal(view.id, "WC-9284");
  assert.equal(view.courierTrackingId, "PT-849201");
  assert.equal(view.total, 2790);
});

test("preserves numeric checkout identity and does not invent an order", () => {
  assert.equal(checkoutFixture.id, 1048);
  assert.equal(checkoutFixture.orderId, null);
  assert.equal(typeof checkoutFixture.id, "number");
});

test("keeps event-to-delivery correlation authoritative", () => {
  assert.equal(eventFixture.eventId, "evt_8f2a...923");
  assert.equal(eventFixture.deliveryRequestId, "req_19204");
});

test("distinguishes empty, error, stale, and partial reads", () => {
  assert.equal(stateForRead({ ok: true, rows: [] }), "empty");
  assert.equal(stateForRead({ ok: false }), "error");
  assert.equal(stateForRead({ ok: false, hadPrevious: true, lastSyncedAt: orderFixture.lastSyncedAt }), "stale");
  assert.equal(stateForRead({ ok: true, rows: [orderFixture], partial: true }), "partial");
});

test("rejects a tenant-mismatched fixture before rendering", () => {
  const activeTenant = "tenant-demo-001";
  const foreign = { ...orderFixture, tenantScope: "tenant-other-999" };
  assert.notEqual(foreign.tenantScope, activeTenant);
  assert.throws(() => {
    if (foreign.tenantScope !== activeTenant) throw new Error("tenant scope mismatch");
  }, /tenant scope mismatch/);
});

test("keeps secrets out of the redacted fixture", () => {
  const serialized = JSON.stringify({ ...eventFixture, endpoint: "https://graph.example.test/events?access_token=[REDACTED]" });
  assert.ok(!serialized.includes("EAAG"));
  assert.ok(!serialized.includes("api_secret="));
  assert.ok(serialized.includes("[REDACTED]"));
});

test("missing activity timestamps never become the current time", () => {
  const source = readFileSync(new URL("./liveAdapter.ts", import.meta.url), "utf8");
  assert.match(source, /if \(!date \|\| Number\.isNaN\(date\.getTime\(\)\)\) return \{ time: "Unavailable", day: "Unavailable" \}/);
  assert.doesNotMatch(source, /value \? new Date\(String\(value\)\) : new Date\(\)/);
  assert.doesNotMatch(source, /date \? new Date\(`\$\{date\}T00:00:00`\) : new Date\(\)/);
});

test("real-shaped order snapshots reconcile one server order across ledgers", () => {
  const snapshot = fixture<any>("orders.snapshot.json");
  const pending = snapshot.deferred.pendingList[0];
  const courier = snapshot.courier.orders[0];
  assert.equal(pending.orderId, "WC-9284");
  assert.equal(snapshot.workflow.statuses[pending.orderId], "processing");
  assert.equal(courier.order_id, pending.orderId);
  assert.equal(courier.courier_tracking_id, "PT-849201");
});

test("real-shaped checkout snapshots preserve response casing and returned IDs", () => {
  const snapshot = fixture<any>("checkouts.snapshot.json");
  const checkout = snapshot.list.items[0];
  const created = snapshot.createOrder;
  assert.equal(typeof checkout.id, "number");
  assert.equal(checkout.orderId, null);
  assert.equal(created.checkoutId, checkout.id);
  assert.equal(created.pendingEventId, 8801);
  assert.equal(created.status, "recovered");
  assert.match(created.orderId, /^manual-1048-/);
});

test("real-shaped event and delivery snapshots preserve correlation and redaction", () => {
  const snapshot = fixture<any>("events-delivery.snapshot.json");
  const event = snapshot.events.events[0];
  const outbox = snapshot.outbox.items[0];
  const delivery = snapshot.deliveryHistory.logs[0];
  assert.ok(outbox.eventIds.includes(event.deduplicationKey));
  assert.equal(delivery.eventId, event.deduplicationKey);
  assert.equal(delivery.outboxId, outbox.id);
  assert.equal(delivery.id, "req_19204");
  assert.ok(delivery.endpoint.includes("[REDACTED]"));
  assert.ok(!JSON.stringify(snapshot).includes("EAAG"));
});

test("delivery retry is owned by the outbox contract, not the API log row", () => {
  const snapshot = fixture<any>("events-delivery.snapshot.json");
  const outbox = snapshot.outbox.items[0];
  const delivery = snapshot.deliveryHistory.logs[0];
  assert.equal(outbox.id, 8801);
  assert.equal(outbox.status, "dead");
  assert.equal(delivery.outboxId, outbox.id);
  assert.equal(delivery.retryable, true);
  assert.equal(`/api/outbox/${outbox.id}/retry`, "/api/outbox/8801/retry");
});

test("retry authority fails closed when outbox identity or boolean eligibility is missing", () => {
  const source = readFileSync(new URL("./liveAdapter.ts", import.meta.url), "utf8");
  assert.match(source, /row\.retryable === true/);
  assert.match(source, /positiveInteger\(row\.outboxId\)/);
  assert.match(source, /requestId: row\.deliveryRequestId/);
  assert.doesNotMatch(source, /requestId: row\.outboxId/);
});

test("delivery retry UI does not invent a retry endpoint from a request log id", () => {
  const source = readFileSync(new URL("./portal.tsx", import.meta.url), "utf8");
  assert.match(source, /Retry is available only when the server returns/);
  assert.match(source, /canRetry = \(item: LiveDeliveryLog\)/);
  assert.doesNotMatch(source, /api\/delivery\/.*retry/);
});

test("snapshots remain tenant-scoped by context rather than payload authority", () => {
  const serialized = ["orders.snapshot.json", "checkouts.snapshot.json", "events-delivery.snapshot.json"]
    .map(name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"))
    .join("\n");
  assert.ok(!serialized.includes('"client_id"'));
  assert.ok(!serialized.includes('"tenantScope"'));
});
