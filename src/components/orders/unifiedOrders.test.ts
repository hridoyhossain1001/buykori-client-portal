import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ORDERS_PAGE_SIZE,
  attentionFor,
  buildUnifiedOrders,
  courierBlocksBooking,
  describePayment,
  filterOrders,
  matchesView,
  paginateOrders,
  providersIn,
  summariseOrders,
  type OrderFilters,
  type OrderViewKey,
  type UnifiedOrder,
} from './unifiedOrders';
import type { CourierOrder, DeferredOrder, StoreOrderLedgerItem } from '../../types';

/**
 * The Orders page now reads one table instead of two panels, and the whole join
 * that makes that possible lives in unifiedOrders.ts. Nothing here touches an
 * API: these tests pin the projection, because the two failure modes it can have
 * are both invisible in the UI until a merchant hits them.
 *
 * The first is a duplicated order — the same sale listed twice because it exists
 * in two feeds. The two lists do overlap: an order the courier rejected keeps its
 * verification record, an order cancelled after booking keeps both, and a
 * re-booked one can have two consignments. Every one of those is a moment when a
 * merchant is least able to tell which row is real, so the join merges on the
 * store's order id rather than concatenating.
 *
 * The second is a row landing in the wrong tab. Eight views over one list means
 * every bucket is a predicate, and a wrong predicate hides orders rather than
 * showing them wrong: an order missing from "Ready to ship" is an order nobody
 * books.
 */

const deferred = (overrides: Partial<DeferredOrder> = {}): DeferredOrder => ({
  id: 1,
  orderId: '1001',
  amount: 1200,
  status: 'pending',
  recipientName: 'Rumi Akter',
  recipientPhone: '01712-345678',
  recipientAddress: 'House 4, Road 7, Dhanmondi, Dhaka',
  ageHours: 3,
  orderOccurredAt: '2026-08-20T10:00:00Z',
  ...overrides,
});

const courier = (overrides: Partial<CourierOrder> = {}): CourierOrder => ({
  id: 501,
  order_id: '2001',
  courier_provider: 'pathao',
  courier_status: 'in_transit',
  courier_tracking_id: 'DA250820ABCD',
  recipient_name: 'Shafiq Rahman',
  recipient_phone: '01898765432',
  recipient_address: 'Sector 10, Uttara, Dhaka',
  cod_amount: 2400,
  delivery_charge: 70,
  created_at: '2026-08-19T09:00:00Z',
  purchase_event_sent: true,
  ...overrides,
});

const ledgerRow = (overrides: Partial<StoreOrderLedgerItem> = {}): StoreOrderLedgerItem => ({
  id: 9001,
  orderId: '1001',
  source: 'woocommerce',
  itemCount: 2,
  dataQuality: 'complete',
  syncStatus: 'sent',
  paymentMethod: 'cod',
  total: 1200,
  occurredAt: '2026-08-20T10:00:00Z',
  ...overrides,
});

const build = (
  deferredOrders: DeferredOrder[] = [],
  courierOrders: CourierOrder[] = [],
  ledger: StoreOrderLedgerItem[] = [],
) => buildUnifiedOrders({ deferredOrders, courierOrders, ledger });

const byId = (rows: UnifiedOrder[], orderId: string) => {
  const found = rows.filter(row => row.orderId === orderId);
  assert.equal(found.length, 1, `expected exactly one row for order ${orderId}, got ${found.length}`);
  return found[0];
};

const filters = (overrides: Partial<OrderFilters> = {}): OrderFilters => ({
  search: '', provider: 'all', risk: 'all', sort: 'newest', ...overrides,
});

const viewsHolding = (rows: UnifiedOrder[], orderId: string): OrderViewKey[] => {
  const all: OrderViewKey[] = ['all', 'attention', 'ready', 'transit', 'delivered', 'courier', 'cancelled', 'returned'];
  return all.filter(view => matchesView(byId(rows, orderId), view));
};

// --- the merge -------------------------------------------------------------

test('an order in both feeds becomes one row carrying both records', () => {
  // The overlap case: cancelled after booking, so it arrives from the
  // verification feed and from the courier feed at once.
  const rows = build(
    [deferred({ orderId: '3001', workflowStatus: 'cancelled' })],
    [courier({ order_id: '3001', courier_status: 'cancelled' })],
  );

  assert.equal(rows.length, 1);
  assert.ok(rows[0].deferred, 'the verification record must survive the merge');
  assert.ok(rows[0].courier, 'the consignment must survive the merge');
  assert.equal(rows[0].courierProvider, 'pathao');
  assert.equal(rows[0].customerName, 'Rumi Akter', 'the deferred record wins on customer fields');
});

test('re-booking an order keeps the newest consignment', () => {
  const rows = build([], [
    courier({ id: 1, order_id: '4001', courier_status: 'cancelled', courier_tracking_id: 'OLD', created_at: '2026-08-10T09:00:00Z' }),
    courier({ id: 2, order_id: '4001', courier_status: 'in_transit', courier_tracking_id: 'NEW', created_at: '2026-08-18T09:00:00Z' }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].trackingId, 'NEW');
  assert.equal(rows[0].fulfillment, 'in_transit');
});

test('rows come back newest first', () => {
  const rows = build([
    deferred({ orderId: 'A', orderOccurredAt: '2026-08-01T00:00:00Z' }),
    deferred({ orderId: 'C', orderOccurredAt: '2026-08-20T00:00:00Z' }),
    deferred({ orderId: 'B', orderOccurredAt: '2026-08-10T00:00:00Z' }),
  ]);

  assert.deepEqual(rows.map(row => row.orderId), ['C', 'B', 'A']);
});

test('an order with no id is dropped rather than rendered as a blank row', () => {
  const rows = build([deferred({ orderId: '' })], [courier({ order_id: '' })]);
  assert.equal(rows.length, 0);
});

test('a booked order gets its age from its timestamp, not zero', () => {
  // /api/courier/orders sends no ageHours, so without the fallback every booked
  // order reads "1m ago" forever.
  const placed = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const row = build([], [courier({ order_id: '5001', created_at: placed })])[0];

  assert.ok(row.ageHours >= 47 && row.ageHours <= 49, `expected ~48h, got ${row.ageHours}`);
});

// --- payment, the one column the courier and COD feeds never carry ----------

test('payment comes from the captured-order ledger', () => {
  const rows = build(
    [deferred({ orderId: '1001' })],
    [],
    [ledgerRow({ orderId: '1001', paymentMethod: 'bkash' })],
  );

  assert.equal(rows[0].paymentLabel, 'bKash');
  assert.equal(rows[0].isCod, false);
});

test('a held order with no ledger row is still cash on delivery', () => {
  // The verification queue only holds COD orders, so an absent ledger row is a
  // missing join, not an unknown payment method.
  const row = build([deferred({ orderId: '1002' })])[0];
  assert.equal(row.paymentLabel, 'Cash on delivery');
  assert.equal(row.isCod, true);
});

test('gateway slugs are named the way a merchant would name them', () => {
  assert.deepEqual(describePayment('cod', false), { paymentLabel: 'Cash on delivery', isCod: true });
  assert.deepEqual(describePayment('ppcp-gateway', false), { paymentLabel: 'Card or bank', isCod: false });
  assert.deepEqual(describePayment('nagad', false), { paymentLabel: 'Nagad', isCod: false });
  // Unmapped gateway: shown as the store spelled it, tidied, never blank.
  assert.deepEqual(describePayment('pay_at_shop', false), { paymentLabel: 'Pay At Shop', isCod: false });
  assert.deepEqual(describePayment('', false), { paymentLabel: 'Not recorded', isCod: false });
});

test('a courier-only row with a COD amount is labelled COD', () => {
  const row = build([], [courier({ order_id: '5002', cod_amount: 2400 })])[0];
  assert.equal(row.paymentLabel, 'Cash on delivery');
});

test('item count falls back to the ledger when no products were sent', () => {
  const withProducts = build([deferred({ orderId: '1003', products: [{ name: 'Kurti', quantity: 2 }, { name: 'Scarf', quantity: 1 }] })])[0];
  assert.equal(withProducts.itemCount, 3);

  const fromLedger = build([deferred({ orderId: '1004' })], [], [ledgerRow({ orderId: '1004', itemCount: 4 })])[0];
  assert.equal(fromLedger.itemCount, 4);
});

// --- the eight views -------------------------------------------------------

test('each view holds exactly the orders it claims to', () => {
  const rows = build(
    [
      deferred({ orderId: 'held', status: 'pending' }),
      deferred({ orderId: 'ready', workflowStatus: 'confirmed' }),
      deferred({ orderId: 'cancelled-hold', workflowStatus: 'cancelled' }),
    ],
    [
      courier({ order_id: 'moving', courier_status: 'in_transit' }),
      courier({ order_id: 'arrived', courier_status: 'delivered' }),
      courier({ order_id: 'came-back', courier_status: 'returned' }),
      courier({ order_id: 'rejected', courier_status: 'booking_failed' }),
      courier({ order_id: 'called-off', courier_status: 'cancelled' }),
    ],
  );

  assert.deepEqual(viewsHolding(rows, 'held'), ['all']);
  assert.deepEqual(viewsHolding(rows, 'ready'), ['all', 'ready']);
  assert.deepEqual(viewsHolding(rows, 'moving'), ['all', 'transit', 'courier']);
  assert.deepEqual(viewsHolding(rows, 'arrived'), ['all', 'delivered', 'courier']);
  assert.deepEqual(viewsHolding(rows, 'came-back'), ['all', 'courier', 'returned']);
  assert.deepEqual(viewsHolding(rows, 'rejected'), ['all', 'attention', 'courier']);
  assert.deepEqual(viewsHolding(rows, 'called-off'), ['all', 'courier', 'cancelled']);
  assert.deepEqual(viewsHolding(rows, 'cancelled-hold'), ['all', 'cancelled']);
});

test('only an unbooked, confirmed order is ready to ship', () => {
  const rows = build(
    [
      deferred({ orderId: 'unconfirmed', workflowStatus: 'pending' }),
      deferred({ orderId: 'confirmed', workflowStatus: 'confirmed' }),
      deferred({ orderId: 'processing', workflowStatus: 'processing' }),
      deferred({ orderId: 'booked', workflowStatus: 'confirmed' }),
    ],
    [courier({ order_id: 'booked', courier_status: 'pending' })],
  );

  const ready = rows.filter(row => matchesView(row, 'ready')).map(row => row.orderId).sort();
  assert.deepEqual(ready, ['confirmed', 'processing']);
  assert.equal(byId(rows, 'booked').bookable, false, 'an order with a consignment cannot be booked again');
  assert.equal(byId(rows, 'unconfirmed').bookable, true);
});

test('a rejected booking is the one consignment that can be sent again', () => {
  /**
   * `enqueue_courier_booking` answers `already_booked` and changes nothing for
   * every courier state except this one; for `booking_failed` it resets the row
   * and its job and hands it back to the worker
   * (app/services/courier/courier_booking_service.py). If the UI blocked it too,
   * the merchant's only remaining route for a rejected order would be to give up
   * on it.
   */
  assert.equal(courierBlocksBooking(null), false, 'no consignment, nothing to block');
  assert.equal(courierBlocksBooking(courier({ courier_status: 'booking_failed' })), false);
  assert.equal(courierBlocksBooking(courier({ courier_status: 'BOOKING_FAILED' })), false, 'the state is compared in one case');

  for (const state of ['booking_queued', 'booking_processing', 'pending', 'picked', 'in_transit', 'delivered', 'returned', 'cancelled']) {
    assert.equal(courierBlocksBooking(courier({ courier_status: state })), true, `${state} must stay closed off`);
  }

  const rows = build(
    [deferred({ orderId: 'rejected' }), deferred({ orderId: 'moving' })],
    [
      courier({ order_id: 'rejected', courier_status: 'booking_failed' }),
      courier({ order_id: 'moving', courier_status: 'in_transit' }),
    ],
  );
  assert.equal(byId(rows, 'rejected').bookable, true, 'the retry has to be reachable from the table');
  assert.equal(byId(rows, 'moving').bookable, false);
  // It is not "ready to ship" though: a rejected booking is unfinished business,
  // and it is the attention view that a merchant opens to find it.
  assert.deepEqual(viewsHolding(rows, 'rejected'), ['all', 'attention', 'courier']);
});

// --- the attention rule ----------------------------------------------------

test('attention names one reason, most severe first', () => {
  const base = {
    risk: 'NOT_CHECKED' as const, fulfillment: 'pending', phone: '01712345678',
    ageHours: 2, courier: null, workflowStatus: 'pending' as const,
  };

  assert.equal(attentionFor(base), null);
  assert.deepEqual(
    attentionFor({ ...base, fulfillment: 'booking_failed', risk: 'HIGH_RISK' }),
    { reason: 'Courier rejected the booking', tone: 'danger' },
    'a rejected booking outranks the risk verdict: it is the thing the merchant must act on',
  );
  assert.deepEqual(attentionFor({ ...base, risk: 'HIGH_RISK' }), { reason: 'High fraud risk', tone: 'danger' });
  assert.deepEqual(attentionFor({ ...base, phone: '' }), { reason: 'No dialable phone number', tone: 'danger' });
  assert.deepEqual(attentionFor({ ...base, ageHours: 200 }), { reason: 'Waiting 8 days', tone: 'warning' });
  assert.deepEqual(attentionFor({ ...base, risk: 'RISKY' }), { reason: 'Courier history looks risky', tone: 'warning' });

  // A cancelled order needs nothing, however bad it looked before it was cancelled.
  assert.equal(attentionFor({ ...base, risk: 'HIGH_RISK', workflowStatus: 'cancelled' }), null);
  // A booked parcel is no longer "waiting": the courier has it.
  assert.equal(attentionFor({ ...base, ageHours: 400, courier: courier() }), null);
});

test('a high-risk verdict and an unusable phone reach the attention view', () => {
  const rows = build([
    deferred({ orderId: 'risky', fraudDetails: { courier_verdict: 'high_risk' } }),
    deferred({ orderId: 'nophone', recipientPhone: '0171' }),
    deferred({ orderId: 'clean', fraudDetails: { courier_verdict: 'good' } }),
  ]);

  assert.equal(byId(rows, 'risky').risk, 'HIGH_RISK');
  assert.equal(byId(rows, 'nophone').phone, '', 'a short number is not dialable, so it is not stored as one');
  assert.equal(byId(rows, 'nophone').rawPhone, '0171', 'the raw number is kept so the table can still show it');
  assert.deepEqual(
    rows.filter(row => matchesView(row, 'attention')).map(row => row.orderId).sort(),
    ['nophone', 'risky'],
  );
  assert.equal(byId(rows, 'clean').risk, 'GOOD');
});

// --- the metric strip ------------------------------------------------------

test('the metric strip counts open work and settles the delivery rate', () => {
  const rows = build(
    [
      deferred({ orderId: 'open-1', orderTotal: 1000, workflowStatus: 'confirmed' }),
      deferred({ orderId: 'open-2', orderTotal: 500, workflowStatus: 'pending' }),
      deferred({ orderId: 'void', orderTotal: 9999, workflowStatus: 'cancelled' }),
    ],
    [
      courier({ order_id: 'waiting', courier_status: 'booking_queued', cod_amount: 300 }),
      courier({ order_id: 'road', courier_status: 'in_transit', cod_amount: 200 }),
      courier({ order_id: 'done-1', courier_status: 'delivered' }),
      courier({ order_id: 'done-2', courier_status: 'completed' }),
      courier({ order_id: 'back', courier_status: 'returned' }),
    ],
  );

  const metrics = summariseOrders(rows);
  assert.equal(metrics.openCount, 4, 'two held, one queued, one on the road');
  assert.equal(metrics.openValue, 2000, '1000 + 500 + 300 + 200, and nothing from the cancelled order');
  assert.equal(metrics.readyCount, 1);
  assert.equal(metrics.delivered, 2);
  assert.equal(metrics.returned, 1);
  assert.equal(metrics.settled, 3);
  // Two of the three parcels that reached an outcome arrived.
  assert.equal(metrics.deliveryRate, 67);
  assert.equal(metrics.bookingPending, 1);
});

test('the delivery rate is null until a parcel settles', () => {
  // Not 0%, and not 100%: with nothing delivered or returned there is no rate to
  // report, and printing 0% reads as total failure.
  const metrics = summariseOrders(build([], [courier({ order_id: 'road', courier_status: 'in_transit' })]));
  assert.equal(metrics.deliveryRate, null);
  assert.equal(metrics.settled, 0);
});

test('the delivery rate ignores parcels still in flight', () => {
  const rows = build([], [
    courier({ order_id: 'a', courier_status: 'delivered' }),
    courier({ order_id: 'b', courier_status: 'in_transit' }),
    courier({ order_id: 'c', courier_status: 'in_transit' }),
  ]);
  // 1 of 1 settled, not 1 of 3: booking a new order must not look like a drop
  // in delivery performance.
  assert.equal(summariseOrders(rows).deliveryRate, 100);
});

// --- the toolbar -----------------------------------------------------------

const searchable = () => build(
  [
    deferred({
      orderId: '7001',
      recipientName: 'Rumi Akter',
      recipientPhone: '01712-345678',
      recipientAddress: 'House 4, Dhanmondi, Dhaka',
      products: [{ name: 'Cotton Kurti', quantity: 1 }],
      fraudDetails: { courier_verdict: 'high_risk' },
      orderTotal: 1500,
    }),
  ],
  [
    courier({
      order_id: '7002',
      courier_provider: 'steadfast',
      courier_tracking_id: 'SF-99887',
      recipient_name: 'Shafiq Rahman',
      recipient_phone: '01898765432',
      cod_amount: 900,
    }),
  ],
  [ledgerRow({ orderId: '7001', paymentMethod: 'cod' })],
);

test('search finds an order by every handle a merchant would paste', () => {
  const rows = searchable();
  const found = (search: string) => filterOrders(rows, filters({ search })).map(row => row.orderId);

  assert.deepEqual(found('7002'), ['7002'], 'order id');
  assert.deepEqual(found('rumi'), ['7001'], 'customer name, case-insensitively');
  assert.deepEqual(found('dhanmondi'), ['7001'], 'address');
  assert.deepEqual(found('cotton kurti'), ['7001'], 'product name');
  assert.deepEqual(found('sf-99887'), ['7002'], 'consignment number');
  // The store stores 01712-345678; a merchant pastes what the customer wrote.
  assert.deepEqual(found('+8801712345678'), ['7001'], 'phone in any format');
  assert.deepEqual(found('nothing here'), []);
  assert.equal(filterOrders(rows, filters({ search: '   ' })).length, 2, 'blank search filters nothing');
});

test('provider and risk filters narrow the same list', () => {
  const rows = searchable();

  assert.deepEqual(filterOrders(rows, filters({ provider: 'steadfast' })).map(row => row.orderId), ['7002']);
  assert.deepEqual(filterOrders(rows, filters({ risk: 'HIGH_RISK' })).map(row => row.orderId), ['7001']);
  assert.equal(filterOrders(rows, filters({ provider: 'pathao' })).length, 0);
  assert.deepEqual(providersIn(rows), ['steadfast'], 'only providers present in the data are offered');
});

test('sorting covers newest, oldest and order value', () => {
  const rows = build([
    deferred({ orderId: 'small', orderTotal: 100, orderOccurredAt: '2026-08-05T00:00:00Z' }),
    deferred({ orderId: 'big', orderTotal: 5000, orderOccurredAt: '2026-08-01T00:00:00Z' }),
    deferred({ orderId: 'mid', orderTotal: 900, orderOccurredAt: '2026-08-10T00:00:00Z' }),
  ]);
  const sorted = (sort: OrderFilters['sort']) => filterOrders(rows, filters({ sort })).map(row => row.orderId);

  assert.deepEqual(sorted('newest'), ['mid', 'small', 'big']);
  assert.deepEqual(sorted('oldest'), ['big', 'small', 'mid']);
  assert.deepEqual(sorted('value-high'), ['big', 'mid', 'small']);
  assert.deepEqual(sorted('value-low'), ['small', 'mid', 'big']);
});

test('orders imported in one batch keep a stable page order', () => {
  // A bulk import gives every order the same timestamp. Without a tie-break the
  // rows can reshuffle between renders, so paging through them skips orders.
  const stamp = '2026-08-12T06:00:00Z';
  const rows = build([
    deferred({ orderId: '1002', orderOccurredAt: stamp }),
    deferred({ orderId: '1010', orderOccurredAt: stamp }),
    deferred({ orderId: '1003', orderOccurredAt: stamp }),
  ]);

  assert.deepEqual(filterOrders(rows, filters({ sort: 'newest' })).map(row => row.orderId), ['1010', '1003', '1002']);
  assert.deepEqual(filterOrders(rows, filters({ sort: 'oldest' })).map(row => row.orderId), ['1002', '1003', '1010']);
});

// --- paging ----------------------------------------------------------------

test('paging clamps to the pages that exist', () => {
  assert.equal(ORDERS_PAGE_SIZE, 10);
  const rows = build(Array.from({ length: 25 }, (_, index) => deferred({
    orderId: String(8000 + index),
    orderOccurredAt: new Date(Date.UTC(2026, 7, 1, index)).toISOString(),
  })));
  assert.equal(rows.length, 25);

  const first = paginateOrders(rows, 1);
  assert.equal(first.pageCount, 3);
  assert.equal(first.rows.length, 10);

  // Deleting the last page's rows must not leave the merchant on a blank page.
  const past = paginateOrders(rows, 99);
  assert.equal(past.safePage, 3);
  assert.equal(past.rows.length, 5);

  assert.equal(paginateOrders(rows, 0).safePage, 1);
  assert.deepEqual(paginateOrders([], 1), { rows: [], safePage: 1, pageCount: 1 });
});

test('every row appears on exactly one page', () => {
  const rows = build(Array.from({ length: 23 }, (_, index) => deferred({
    orderId: String(9000 + index),
    orderOccurredAt: new Date(Date.UTC(2026, 7, 2, index)).toISOString(),
  })));

  const paged = [1, 2, 3].flatMap(page => paginateOrders(rows, page).rows.map(row => row.orderId));
  assert.equal(new Set(paged).size, 23, 'no row is dropped or shown twice across the pages');
  assert.deepEqual(paged, rows.map(row => row.orderId), 'and the page order follows the sorted list');
});
