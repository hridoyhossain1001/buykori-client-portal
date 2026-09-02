import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import OrderDetailDrawer from './OrderDetailDrawer';
import { buildUnifiedOrders } from './unifiedOrders';
import type { UnifiedOrder } from './unifiedOrders';
import type { CourierOrder, DeferredOrder } from '../../types';

/**
 * The drawer's footer is the one place a merchant sends an order to a courier, so
 * two things about it must not drift.
 *
 * It must offer exactly that one action plus Close. It used to swap the action for
 * "Print label" whenever booking was impossible, which printed a second Print
 * label under the one already in Fulfillment — and because `GET /deferred` leaves
 * out every order that already has a consignment, that fallback fired for every
 * booked order in production.
 *
 * And the button must be disabled for any order the API would refuse, with the
 * reason on screen. With no queue record OrdersView has no `pending_event_id` to
 * post, so an enabled button there is a click that does nothing at all.
 *
 * Rows are built through `buildUnifiedOrders` rather than hand-written, so a
 * change to `bookable` shows up here instead of being mirrored by a fixture.
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

const row = (deferredOrders: DeferredOrder[], courierOrders: CourierOrder[] = []): UnifiedOrder => {
  const rows = buildUnifiedOrders({ deferredOrders, courierOrders, ledger: [] });
  assert.equal(rows.length, 1, `expected one row, got ${rows.length}`);
  return rows[0];
};

const render = (order: UnifiedOrder) => renderToStaticMarkup(
  <OrderDetailDrawer
    order={order}
    onClose={() => {}}
    onBookCourier={() => {}}
    onEditOrder={() => {}}
    onPrintInvoice={() => {}}
    onPrintLabel={() => {}}
    onStatusChange={() => {}}
    onCopyPhone={() => {}}
    statusBusy={false}
  />,
);

/** The markup of the sticky footer only, so a match cannot come from elsewhere. */
const footerOf = (html: string) => {
  const start = html.indexOf('<footer');
  assert.ok(start > -1, 'the drawer must have a footer');
  return html.slice(start);
};

/** The `<button …>` whose visible label contains `label`, or null. */
const buttonWith = (html: string, label: string) =>
  html.split('<button').slice(1).map(part => `<button${part}`).find(part => {
    const end = part.indexOf('</button>');
    return end > -1 && part.slice(0, end).includes(label);
  }) ?? null;

/**
 * The rendered `disabled` attribute — not the substring "disabled", which every
 * button carries in its `disabled:*` utility classes.
 */
const isDisabled = (button: string | null) => Boolean(button?.includes('disabled=""'));

/** The Fulfillment action row's own class list, so a match cannot be another grid. */
const actionRowClass = (html: string) =>
  html.match(/class="mt-3 grid gap-2 sm:flex sm:flex-wrap ([a-z0-9-]+)"/)?.[1] ?? null;

// --- the footer's one action ------------------------------------------------

test('the footer offers Send to courier and Close, and never a print action', () => {
  const footer = footerOf(render(row([deferred()])));

  assert.ok(footer.includes('Send to courier'));
  assert.ok(footer.includes('>Close</button>'));
  assert.ok(!footer.includes('Print label'), 'Fulfillment already carries Print label');
  assert.ok(!footer.includes('Print invoice'), 'Fulfillment already carries Print invoice');
});

test('Send to courier is live for a queued order that has a phone and an address', () => {
  const order = row([deferred()]);
  assert.equal(order.bookable, true);

  const button = buttonWith(footerOf(render(order)), 'Send to courier');
  assert.ok(button, 'the footer must hold a Send to courier button');
  assert.ok(!isDisabled(button));
});

test('a booked order cannot be sent again, and the footer says where it went', () => {
  // Production shape: `GET /deferred` drops booked orders, so only the
  // consignment survives and `bookable` is false.
  const order = row([], [courier({ courier_provider: 'steadfast', courier_tracking_id: 'TRK9283BD' })]);
  assert.equal(order.bookable, false);

  const footer = footerOf(render(order));
  assert.ok(isDisabled(buttonWith(footer, 'Send to courier')), 'a booked order must not be sendable');
  assert.ok(footer.includes('Already sent to Steadfast'));
  assert.ok(footer.includes('TRK9283BD'), 'the tracking ID is how a merchant checks it themselves');
});

test('a rejected booking stays sendable, and the button says it is a retry', () => {
  /**
   * The one state where both records are live at once. On terminal failure the
   * booking worker sets the consignment to `booking_failed` *and* resets its
   * PendingEvent back to `status="pending"`
   * (app/services/courier/courier_booking_service.py), so the verification record
   * survives — which is what src/services/operationsApi.ts folds back into the
   * list, and what `enqueue_courier_booking` accepts a second time.
   */
  const order = row(
    [deferred({ orderId: '4001' })],
    [courier({ order_id: '4001', courier_status: 'booking_failed', courier_tracking_id: '' })],
  );
  assert.equal(order.bookable, true, 'the one courier state that does not close an order off');

  const footer = footerOf(render(order));
  const button = buttonWith(footer, 'Retry courier booking');
  assert.ok(button, 'the footer must offer the retry');
  assert.ok(!isDisabled(button), 'the API takes this one again, so the button must be live');
  assert.ok(!footer.includes('Already sent to'), 'nothing was sent — the courier refused the booking');
  assert.ok(!footer.includes('Send to courier'), 'a retry is not a first send');
});

test('the retry promises one parcel, not two', () => {
  const html = render(row(
    [deferred({ orderId: '4001' })],
    [courier({ order_id: '4001', courier_status: 'booking_failed', courier_tracking_id: '' })],
  ));

  // Sending the same order twice is the fear that stops a merchant clicking, and
  // it is unfounded here: the API resets the existing consignment row.
  assert.ok(html.includes('re-queues the same order'));
  assert.ok(!html.includes('Ready to book.'), 'this is not a first booking');
});

test('a cancelled order cannot be sent, and says so', () => {
  const order = row([deferred({ workflowStatus: 'cancelled' })]);
  const footer = footerOf(render(order));

  assert.ok(isDisabled(buttonWith(footer, 'Send to courier')));
  assert.match(footer, /cancelled/i);
});

test('a missing phone or address blocks sending without repeating itself', () => {
  const order = row([deferred({ recipientPhone: '', recipientAddress: '' })]);
  const html = render(order);
  const footer = footerOf(html);

  assert.ok(isDisabled(buttonWith(footer, 'Send to courier')));
  // The reason still reaches the pointer, so a disabled button is never mute.
  assert.ok(footer.includes('title="A courier needs a phone number'));
  // But Fulfillment's prerequisite note already spells it out on screen, so the
  // footer must not print a paragraph saying it a second time.
  assert.ok(!footer.includes('<p class'), 'the footer must stay quiet when Fulfillment already explains');
  assert.ok(html.includes('Edit the order first'));
});

// --- the Fulfillment action row --------------------------------------------

test('the three Fulfillment actions share one row, with the column count following them', () => {
  const both = render(row([deferred({ orderId: '3001' })], [courier({ order_id: '3001' })]));
  assert.equal(actionRowClass(both), 'grid-cols-3', 'three actions must sit in three columns on a phone');

  const queuedOnly = render(row([deferred()]));
  assert.equal(actionRowClass(queuedOnly), 'grid-cols-2', 'two actions must not leave a third of the row empty');
});

test('a shortened phone label never changes the accessible name', () => {
  const html = render(row([deferred({ orderId: '3001' })], [courier({ order_id: '3001' })]));

  for (const [short, full] of [['Edit', 'Edit order'], ['Invoice', 'Print invoice'], ['Label', 'Print label']]) {
    assert.ok(html.includes(`aria-label="${full}"`), `${full} must keep its full accessible name`);
    assert.ok(html.includes(`class="sm:hidden">${short}<`), `${full} must shorten to ${short} on a phone`);
  }
});
