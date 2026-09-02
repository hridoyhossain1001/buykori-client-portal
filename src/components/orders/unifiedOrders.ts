import { getFraudVerdictKey, type VerdictKey } from '../FraudVerdictBadge';
import { realText, sourceLabel } from '../../lib/marketingSource';
import { usablePhone } from './ordersUtils';
import type {
  CourierOrder,
  DeferredOrder,
  DeferredOrderProduct,
  OrderWorkflowStatus,
  StoreOrderLedgerItem,
} from '../../types';

/**
 * One row model for the Orders workspace.
 *
 * The portal reads orders from three endpoints that each know a different part
 * of the same order, and the old two-tab layout showed two of them as two
 * separate lists. The prototype's Orders page is a single table with eight
 * views over it, so the three records have to be folded into one row first:
 *
 *   GET /api/deferred                  → DeferredOrder    (customer, products,
 *                                        fraud verdict, held age, COD value)
 *   GET /api/courier/orders            → CourierOrder     (provider, consignment,
 *                                        delivery state, purchase sync)
 *   GET /api/v1/orders?limit=100       → StoreOrderLedgerItem (payment method,
 *                                        capture source, data quality)
 *
 * Nothing here calls an API. It is a pure projection of what the workspace has
 * already fetched, so the design change cannot alter a request, a payload, or a
 * mutation: every row keeps a reference back to the record it came from, and
 * every action in the UI dispatches on that original record through the same
 * handler it used before.
 *
 * Merge key is the store's own order id, and rows are merged rather than
 * concatenated because the feeds do overlap. The operations query excludes any
 * order that has a courier row (`PendingEvent.order_id.not_in(
 * booked_order_ids_subq)` in app/routers/client_api.py), but that subquery has
 * no status filter, so a *failed* booking is excluded from it while its
 * verification record is still live — and operationsApi.ts folds those rows
 * back in on purpose, so they arrive here carrying both records. The other two
 * overlaps: an order cancelled after it was booked, which arrives from
 * /orders/workflow-statuses as a cancelled row *and* from /courier/orders as a
 * cancelled consignment, and the payment method, which only ever arrives on the
 * third list.
 */

/** The eight views of the prototype's Orders table. */
export type OrderViewKey =
  | 'all'
  | 'attention'
  | 'ready'
  | 'transit'
  | 'delivered'
  | 'courier'
  | 'cancelled'
  | 'returned';

/** Why a row is flagged for attention, or null when it is not. */
export interface OrderAttention {
  reason: string;
  tone: 'danger' | 'warning';
}

export interface UnifiedOrder {
  /** The store's order id. Stable React key, and the selection id. */
  orderId: string;
  /** The COD/verification record, when this order still has one. */
  deferred: DeferredOrder | null;
  /** The courier consignment, once the order has been booked. */
  courier: CourierOrder | null;
  /** The captured-order ledger row, the only source of payment method. */
  ledger: StoreOrderLedgerItem | null;

  customerName: string;
  /** Normalised 01XXXXXXXXX, or '' when the store sent nothing usable. */
  phone: string;
  /** Raw phone as received, for display when it is not dialable. */
  rawPhone: string;
  address: string;

  products: DeferredOrderProduct[];
  itemCount: number;

  /** Human label: 'Cash on delivery', 'bKash', 'Card'… or 'Not recorded'. */
  paymentLabel: string;
  isCod: boolean;

  /**
   * Channel the store tagged this order with — 'Facebook', 'TikTok', 'Direct'…
   * Comes from the order's own captured UTM/platform keys, never inferred.
   */
  source: string;
  /** Campaign or medium beside that source, '' when only the source was tagged. */
  sourceDetail: string;

  total: number;
  risk: VerdictKey;
  /** Courier state when booked, otherwise the workflow state. */
  fulfillment: string;
  courierProvider: string;
  trackingId: string;
  workflowStatus: OrderWorkflowStatus;
  purchaseSynced: boolean;

  placedAt: string;
  ageHours: number;

  attention: OrderAttention | null;
  /** True when this order can still be sent to a courier. */
  bookable: boolean;
}

const text = (value: unknown): string => String(value ?? '').trim();

const firstText = (...values: unknown[]): string => {
  for (const value of values) {
    const found = text(value);
    if (found) return found;
  }
  return '';
};

const lower = (value: unknown): string => text(value).toLowerCase();

/** Courier states that mean the parcel is moving. */
const TRANSIT_STATES = ['in_transit', 'picked_up', 'shipped'];
/** Courier states that mean the parcel arrived. */
const DELIVERED_STATES = ['delivered', 'completed'];
/** Courier states that mean the parcel came back. */
const RETURNED_STATES = ['returned', 'partial_returned'];
/** Courier states that mean the booking has not left our side yet. */
const BOOKING_STATES = ['pending', 'booking_queued', 'booking_processing'];
/**
 * The one courier state that does not close an order off.
 *
 * `enqueue_courier_booking` refuses a second booking for any consignment except
 * this one (`courier_booking_service.py`: `if courier_order and
 * courier_order.courier_status != "booking_failed": return already_booked`), and
 * for this one it resets the row and its job and hands it back to the worker. So
 * a rejected booking is the single case where the same order may be sent again,
 * and the UI has to keep offering it or the merchant's only route is to give up
 * on the order.
 */
const RETRYABLE_BOOKING_STATE = 'booking_failed';

/** An order held this long converts far worse, so the table flags it. */
export const STALE_ORDER_HOURS = 168;

/**
 * Payment method as the merchant would name it. WooCommerce sends gateway slugs
 * ('cod', 'bkash', 'ppcp-gateway'), which are the store's internal wiring, not
 * something to print in a table.
 */
const PAYMENT_LABELS: ReadonlyArray<readonly [RegExp, string]> = [
  [/(^|_)cod($|_)|cash.?on.?deliver/i, 'Cash on delivery'],
  [/bkash/i, 'bKash'],
  [/nagad/i, 'Nagad'],
  [/rocket/i, 'Rocket'],
  [/upay/i, 'Upay'],
  [/sslcommerz|shurjopay|aamarpay/i, 'Online payment'],
  [/stripe|paypal|ppcp|card|cheque|bacs/i, 'Card or bank'],
  [/bank.?transfer/i, 'Bank transfer'],
];

/** Reads the gateway slug and returns the label plus whether it is COD. */
export function describePayment(
  raw: unknown,
  fallbackIsCod: boolean,
): { paymentLabel: string; isCod: boolean } {
  const slug = text(raw);
  if (!slug) {
    // Every order in the verification queue is a COD hold by definition, so an
    // absent ledger row is still informative rather than unknown.
    return fallbackIsCod
      ? { paymentLabel: 'Cash on delivery', isCod: true }
      : { paymentLabel: 'Not recorded', isCod: false };
  }
  const matched = PAYMENT_LABELS.find(([pattern]) => pattern.test(slug));
  if (matched) return { paymentLabel: matched[1], isCod: matched[1] === 'Cash on delivery' };
  // An unmapped gateway is shown as the store spelled it, tidied up. Better a
  // real gateway name the merchant recognises than a blank cell.
  return { paymentLabel: slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), isCod: false };
}

/**
 * The one thing wrong with this order, or null. Most severe first, and only one
 * is returned: a row that says three things at once says nothing, and the point
 * of the flag is to tell the merchant which order to open next.
 */
export function attentionFor(order: {
  risk: VerdictKey;
  fulfillment: string;
  phone: string;
  ageHours: number;
  courier: CourierOrder | null;
  workflowStatus: OrderWorkflowStatus;
}): OrderAttention | null {
  if (order.workflowStatus === 'cancelled') return null;
  if (lower(order.fulfillment) === 'booking_failed') {
    return { reason: 'Courier rejected the booking', tone: 'danger' };
  }
  if (order.risk === 'HIGH_RISK') {
    return { reason: 'High fraud risk', tone: 'danger' };
  }
  if (!order.phone) {
    return { reason: 'No dialable phone number', tone: 'danger' };
  }
  if (!order.courier && order.ageHours >= STALE_ORDER_HOURS) {
    return { reason: `Waiting ${Math.floor(order.ageHours / 24)} days`, tone: 'warning' };
  }
  if (order.risk === 'RISKY') {
    return { reason: 'Courier history looks risky', tone: 'warning' };
  }
  return null;
}

/**
 * Whether this consignment still blocks a courier booking.
 *
 * Every state except a rejected booking does: the API answers `already_booked`
 * and changes nothing. A rejected one does not, so the button stays live and
 * clicking it re-queues the same order.
 */
export const courierBlocksBooking = (courier: CourierOrder | null): boolean =>
  Boolean(courier) && lower(courier?.courier_status) !== RETRYABLE_BOOKING_STATE;

/** Falls back through every alias the two APIs use for the same person. */
const personOf = (deferred: DeferredOrder | null, courier: CourierOrder | null) => ({
  name: firstText(
    deferred?.recipientName, deferred?.recipient_name, deferred?.customerName,
    deferred?.customer_name, deferred?.customer, courier?.recipient_name,
  ),
  rawPhone: firstText(
    deferred?.recipientPhone, deferred?.recipient_phone, deferred?.customerPhone,
    deferred?.customer_phone, courier?.recipient_phone,
  ),
  address: firstText(
    deferred?.recipientAddress, deferred?.recipient_address, deferred?.customerAddress,
    deferred?.customer_address, courier?.recipient_address,
  ),
});

/** Derives the workflow state when neither record states one outright. */
function resolveWorkflowStatus(
  deferred: DeferredOrder | null,
  courier: CourierOrder | null,
): OrderWorkflowStatus {
  const courierState = lower(courier?.courier_status);
  if (courierState === 'cancelled') return 'cancelled';
  if (DELIVERED_STATES.includes(courierState)) return 'completed';
  if (TRANSIT_STATES.includes(courierState)) return 'shipped';
  if (courier?.workflowStatus) return courier.workflowStatus;
  if (deferred?.workflowStatus) return deferred.workflowStatus;
  const status = lower(deferred?.status);
  if (status === 'cancelled') return 'cancelled';
  if (status === 'confirmed') return 'confirmed';
  return 'pending';
}

/**
 * Which statuses this order may move to, including the one it already has.
 *
 * One allowlist for the whole workspace: the table's status control and the
 * detail drawer both read it, so a row cannot offer a transition the drawer
 * refuses. The rules are the ones the live panels have always used — a
 * delivered parcel is finished, a returned or cancelled one cannot be revived
 * into transit, and a failed booking may only be retried or given up on.
 */
export function statusOptionsFor(order: UnifiedOrder): OrderWorkflowStatus[] {
  if (order.courier) {
    const courierStatus = lower(order.courier.courier_status);
    if (DELIVERED_STATES.includes(courierStatus)) return ['completed'];
    if (['returned', 'cancelled'].includes(courierStatus)) return ['cancelled'];
    if (courierStatus === 'booking_failed') return ['processing', 'cancelled'];
    return ['processing', 'shipped', 'cancelled'];
  }
  if (order.workflowStatus === 'completed') return ['completed'];
  if (order.workflowStatus === 'cancelled') return ['cancelled', 'pending', 'on-hold'];
  if (lower(order.deferred?.status) === 'confirmed') return ['confirmed', 'processing', 'completed'];
  return ['pending', 'on-hold', 'confirmed', 'processing', 'completed', 'cancelled'];
}

/**
 * Folds the three order feeds into one list of table rows, newest first.
 *
 * The `deferred` list is the spine: it is the one that carries the customer, the
 * products and the fraud verdict. Courier rows for orders that are no longer in
 * that list (every booked order, by design) are appended as rows of their own.
 */
export function buildUnifiedOrders({
  deferredOrders,
  courierOrders,
  ledger,
}: {
  deferredOrders: DeferredOrder[];
  courierOrders: CourierOrder[];
  ledger: StoreOrderLedgerItem[];
}): UnifiedOrder[] {
  const courierByOrderId = new Map<string, CourierOrder>();
  courierOrders.forEach(courier => {
    const id = text(courier.order_id);
    if (!id) return;
    const existing = courierByOrderId.get(id);
    // Re-booking an order writes a second consignment; the newest one is the
    // one whose state the merchant is watching.
    if (!existing || Date.parse(courier.created_at || '') > Date.parse(existing.created_at || '')) {
      courierByOrderId.set(id, courier);
    }
  });

  const ledgerByOrderId = new Map<string, StoreOrderLedgerItem>();
  ledger.forEach(item => {
    const id = text(item.orderId);
    if (id && !ledgerByOrderId.has(id)) ledgerByOrderId.set(id, item);
  });

  const seen = new Set<string>();
  const rows: UnifiedOrder[] = [];

  const push = (deferred: DeferredOrder | null, courier: CourierOrder | null) => {
    const orderId = text(deferred?.orderId ?? courier?.order_id);
    if (!orderId || seen.has(orderId)) return;
    seen.add(orderId);

    // Always the map, never the loop's own element: a re-booked order appears
    // twice in courierOrders, and the map is the one that resolved which of the
    // two consignments is current.
    const resolvedCourier = courierByOrderId.get(orderId) ?? courier ?? null;
    const ledgerRow = ledgerByOrderId.get(orderId) ?? null;
    const person = personOf(deferred, resolvedCourier);
    const products = (deferred?.products?.length ? deferred.products : resolvedCourier?.products) || [];
    const workflowStatus = resolveWorkflowStatus(deferred, resolvedCourier);
    const risk = getFraudVerdictKey(deferred?.fraudDetails, deferred?.fraudScore);
    const fulfillment = resolvedCourier ? text(resolvedCourier.courier_status) || 'pending' : workflowStatus;
    const phone = usablePhone(person.rawPhone);
    const placedAt = firstText(
      deferred?.orderOccurredAt, deferred?.timestamp,
      resolvedCourier?.created_at, ledgerRow?.occurredAt,
    );
    // /api/deferred sends ageHours; /courier/orders does not, so a booked order
    // would otherwise report "0m ago" forever. Fall back to the timestamp.
    const ageHours = Number(deferred?.ageHours)
      || (placedAt ? Math.max(0, (Date.now() - Date.parse(placedAt)) / 3600000) : 0);

    // The verification queue is COD by definition, so a missing ledger row for a
    // held order still means cash on delivery.
    const { paymentLabel, isCod } = describePayment(
      ledgerRow?.paymentMethod,
      Boolean(deferred) || Number(resolvedCourier?.cod_amount) > 0,
    );

    const total = Number(
      deferred?.orderTotal ?? deferred?.amount ?? resolvedCourier?.cod_amount ?? ledgerRow?.total ?? 0,
    ) || 0;

    // The held Purchase payload carries the tags; a booked order reads them from
    // the same event through /courier/orders. Neither is inferred, so an untagged
    // order is 'Direct' rather than a guessed channel.
    const marketing = deferred?.marketing || resolvedCourier?.marketing || null;

    rows.push({
      orderId,
      deferred,
      courier: resolvedCourier,
      ledger: ledgerRow,
      customerName: person.name || 'Unnamed customer',
      phone,
      rawPhone: person.rawPhone,
      address: person.address,
      products,
      itemCount: products.reduce((sum, product) => sum + (Number(product.quantity) || 1), 0)
        || Number(ledgerRow?.itemCount) || products.length,
      paymentLabel,
      isCod,
      source: sourceLabel(marketing?.source),
      sourceDetail: realText(marketing?.campaign),
      total,
      risk,
      fulfillment,
      courierProvider: text(resolvedCourier?.courier_provider),
      trackingId: firstText(resolvedCourier?.courier_tracking_id, resolvedCourier?.courier_order_id),
      workflowStatus,
      purchaseSynced: Boolean(resolvedCourier?.purchase_event_sent),
      placedAt,
      ageHours,
      attention: attentionFor({ risk, fulfillment, phone, ageHours, courier: resolvedCourier, workflowStatus }),
      bookable: Boolean(deferred) && !courierBlocksBooking(resolvedCourier) && workflowStatus !== 'cancelled',
    });
  };

  deferredOrders.forEach(order => push(order, null));
  courierOrders.forEach(courier => push(null, courier));

  return rows.sort((a, b) => Date.parse(b.placedAt || '') - Date.parse(a.placedAt || ''));
}

/** Tab labels, in the order the prototype's strip shows them. */
export const ORDER_VIEWS: ReadonlyArray<{ key: OrderViewKey; label: string; empty: string }> = [
  { key: 'all', label: 'All', empty: 'No orders yet. They appear here the moment your store sends one.' },
  { key: 'attention', label: 'Needs attention', empty: 'Nothing needs attention. No failed bookings, high-risk customers or orders held over a week.' },
  { key: 'ready', label: 'Ready to ship', empty: 'No orders are waiting for a courier. Confirm an order to queue it for booking.' },
  { key: 'transit', label: 'In transit', empty: 'No parcels are on the road right now.' },
  { key: 'delivered', label: 'Delivered', empty: 'No deliveries confirmed yet.' },
  { key: 'courier', label: 'Courier log', empty: 'No courier bookings yet. Book an order to start the log.' },
  { key: 'cancelled', label: 'Cancelled', empty: 'No cancelled orders.' },
  { key: 'returned', label: 'Returned', empty: 'No returns. Parcels the courier sends back land here.' },
];

/** Whether a row belongs in a view. Pure, so the tab counts and the table body
 *  cannot disagree — both call this. */
export function matchesView(order: UnifiedOrder, view: OrderViewKey): boolean {
  const state = lower(order.fulfillment);
  switch (view) {
    case 'all':
      return true;
    case 'attention':
      return order.attention !== null;
    case 'ready':
      // Confirmed or already moving through the store, but no consignment yet.
      return order.bookable && (order.workflowStatus === 'confirmed' || order.workflowStatus === 'processing');
    case 'transit':
      return TRANSIT_STATES.includes(state);
    case 'delivered':
      return DELIVERED_STATES.includes(state);
    case 'courier':
      return order.courier !== null;
    case 'cancelled':
      return order.workflowStatus === 'cancelled' || state === 'cancelled';
    case 'returned':
      return RETURNED_STATES.includes(state);
    default:
      return false;
  }
}

/** Rows still owed work: nothing cancelled, delivered or returned. */
const isOpen = (order: UnifiedOrder) => {
  const state = lower(order.fulfillment);
  return order.workflowStatus !== 'cancelled'
    && state !== 'cancelled'
    && !DELIVERED_STATES.includes(state)
    && !RETURNED_STATES.includes(state);
};

/**
 * The four headline numbers above the table.
 *
 * Delivery rate counts only parcels that actually reached an outcome —
 * delivered against delivered plus returned. Dividing by every booking instead
 * would move the number every time a new order is booked, which makes it read
 * as falling performance when nothing about delivery has changed.
 */
export function summariseOrders(orders: UnifiedOrder[]) {
  const open = orders.filter(isOpen);
  const delivered = orders.filter(order => DELIVERED_STATES.includes(lower(order.fulfillment))).length;
  const returned = orders.filter(order => RETURNED_STATES.includes(lower(order.fulfillment))).length;
  const settled = delivered + returned;

  return {
    openCount: open.length,
    openValue: open.reduce((sum, order) => sum + order.total, 0),
    readyCount: orders.filter(order => matchesView(order, 'ready')).length,
    delivered,
    returned,
    settled,
    /** null until at least one parcel has been delivered or returned. */
    deliveryRate: settled > 0 ? Math.round((delivered / settled) * 100) : null,
    /** Bookings we are still waiting on the courier to accept. */
    bookingPending: orders.filter(order => BOOKING_STATES.includes(lower(order.fulfillment)) && order.courier).length,
  };
}

export type OrderSort = 'newest' | 'oldest' | 'value-high' | 'value-low';

export interface OrderFilters {
  search: string;
  provider: string;
  risk: string;
  sort: OrderSort;
}

/**
 * Applies the toolbar to one view's rows. Search covers everything the merchant
 * is likely to paste in: order id, name, phone in any format, address, product
 * name, and the courier's consignment number.
 */
export function filterOrders(orders: UnifiedOrder[], filters: OrderFilters): UnifiedOrder[] {
  const needle = filters.search.trim().toLowerCase();
  // A phone pasted as +8801… must still match a stored 01… number.
  const phoneNeedle = usablePhone(needle);

  const matched = orders.filter(order => {
    if (filters.provider !== 'all' && lower(order.courierProvider) !== filters.provider) return false;
    if (filters.risk !== 'all' && order.risk !== filters.risk) return false;
    if (!needle) return true;
    if (phoneNeedle && order.phone.includes(phoneNeedle)) return true;
    return [
      order.orderId,
      order.customerName,
      order.rawPhone,
      order.phone,
      order.address,
      order.trackingId,
      order.paymentLabel,
      order.source,
      order.sourceDetail,
      ...order.products.map(product => firstText(product.name, product.content_name)),
    ].some(value => lower(value).includes(needle));
  });

  const byTime = (order: UnifiedOrder) => Date.parse(order.placedAt || '') || 0;
  return matched.sort((a, b) => {
    if (filters.sort === 'value-high') return b.total - a.total;
    if (filters.sort === 'value-low') return a.total - b.total;
    const difference = filters.sort === 'oldest' ? byTime(a) - byTime(b) : byTime(b) - byTime(a);
    // Same timestamp is common when a store imports a batch; fall back to the
    // order id so the page order is stable between renders.
    if (difference !== 0) return difference;
    return filters.sort === 'oldest'
      ? a.orderId.localeCompare(b.orderId, undefined, { numeric: true })
      : b.orderId.localeCompare(a.orderId, undefined, { numeric: true });
  });
}

/** Courier providers actually present in the data, for the filter select. */
export function providersIn(orders: UnifiedOrder[]): string[] {
  return [...new Set(orders.map(order => lower(order.courierProvider)).filter(Boolean))].sort();
}

/** Rows per page in the Orders table. */
export const ORDERS_PAGE_SIZE = 10;

/**
 * One page of rows, with the page number clamped to what exists.
 *
 * Lives here rather than inside the table because OrdersView needs the same
 * slice: the WhatsApp confirmation badges are polled for the orders currently on
 * screen, so the container and the table must agree on which rows those are.
 * Both call this, so they cannot drift.
 */
export function paginateOrders(
  orders: UnifiedOrder[],
  page: number,
  size: number = ORDERS_PAGE_SIZE,
): { rows: UnifiedOrder[]; safePage: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(orders.length / size));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return {
    rows: orders.slice((safePage - 1) * size, safePage * size),
    safePage,
    pageCount,
  };
}
