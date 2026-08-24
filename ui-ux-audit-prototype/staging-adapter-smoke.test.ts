import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as T;

type PageEnvelope = {
  [key: string]: unknown;
  totalCount: number;
  limit: number;
  hasMore: boolean;
  page?: number;
  offset?: number;
};

function assertPageEnvelope(name: string, value: PageEnvelope, itemKey: string) {
  assert.ok(Array.isArray(value[itemKey]), `${name}.${itemKey} must be an array`);
  assert.equal(typeof value.totalCount, "number", `${name}.totalCount must be numeric`);
  assert.equal(typeof value.limit, "number", `${name}.limit must be numeric`);
  assert.ok(value.limit > 0, `${name}.limit must be positive`);
  assert.equal(typeof value.hasMore, "boolean", `${name}.hasMore must be boolean`);
  assert.ok(value.totalCount >= (value[itemKey] as unknown[]).length, `${name} total cannot be below returned rows`);
  if (value.page !== undefined) assert.ok(value.page >= 1, `${name}.page must be one-based`);
  if (value.offset !== undefined) assert.ok(value.offset >= 0, `${name}.offset cannot be negative`);
}

test("read-only staging snapshot exposes every primary pagination envelope", () => {
  const orders = fixture<any>("orders.snapshot.json");
  const checkouts = fixture<any>("checkouts.snapshot.json");
  const delivery = fixture<any>("events-delivery.snapshot.json");

  assertPageEnvelope("orders", orders.orders, "orders");
  assertPageEnvelope("cod", orders.deferred, "pendingList");
  assertPageEnvelope("courier", orders.courier, "orders");
  assertPageEnvelope("checkouts", checkouts.list, "items");
  assertPageEnvelope("events", delivery.events, "events");
  assertPageEnvelope("apiLogs", delivery.deliveryHistory, "logs");
  assertPageEnvelope("outbox", delivery.outbox, "items");
});

test("read-only snapshots preserve server-owned identifiers across surfaces", () => {
  const orders = fixture<any>("orders.snapshot.json");
  const checkouts = fixture<any>("checkouts.snapshot.json");
  const delivery = fixture<any>("events-delivery.snapshot.json");

  const orderId = orders.orders.orders[0].orderId;
  assert.equal(orders.deferred.pendingList[0].orderId, orderId);
  assert.equal(orders.courier.orders[0].order_id, orderId);
  assert.equal(typeof checkouts.list.items[0].id, "number");
  assert.equal(checkouts.createOrder.checkoutId, checkouts.list.items[0].id);
  assert.equal(delivery.deliveryHistory.logs[0].eventId, delivery.events.events[0].deduplicationKey);
  assert.equal(delivery.deliveryHistory.logs[0].outboxId, delivery.outbox.items[0].id);
});

test("read-only smoke input contains no tenant or secret authority", () => {
  const names = ["orders.snapshot.json", "checkouts.snapshot.json", "events-delivery.snapshot.json"];
  const serialized = names.map((name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")).join("\n");
  assert.ok(!serialized.includes('"client_id"'));
  assert.ok(!serialized.includes("EAAG"));
  assert.ok(!serialized.includes("api_secret="));
  assert.match(serialized, /REDACTED/);
});

test("smoke contract is read-only and cannot encode provider mutations", () => {
  const source = readFileSync(new URL("./staging-adapter-smoke.test.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\s*\(/i);
  assert.doesNotMatch(source, /method\s*:/i);
});
