/**
 * The order detail drawer, ported from the prototype.
 *
 * Presentation only. Every action is a callback into the handler OrdersView
 * already owns, so the drawer adds no new API call and no new mutation path.
 * The status options come from `statusOptionsFor` in `unifiedOrders.ts`, which
 * the table's status control reads too — the backend rejects transitions outside
 * them, so the two places a merchant can change status must not drift.
 */
import type { ReactNode } from 'react';
import { Copy, Phone, Printer, Ticket, Truck, PencilLine } from 'lucide-react';
import type { OrderWorkflowStatus } from '../../types';
import { Button, Drawer, Status } from '../common';
import { formatHeldAge, productMeta } from './ordersUtils';
import { statusOptionsFor, courierBlocksBooking } from './unifiedOrders';
import type { UnifiedOrder } from './unifiedOrders';

const money = (value: number) => `৳${Math.round(value).toLocaleString('en-US')}`;
const humanise = (value: string) => value.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase());

const longDateTime = (iso: string) => {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

interface TimelineEntry {
  title: string;
  detail?: string;
  /** An amber dot: this step is still waiting on something. */
  open?: boolean;
}

/** One button in the Fulfillment row. `short` is what a phone has room for. */
interface DrawerAction {
  key: string;
  short: string;
  full: string;
  icon: ReactNode;
  run: () => void;
}

/**
 * Why "Send to courier" cannot run for this order, in the merchant's words —
 * `null` when it can. This is the exact negation of `bookable` in
 * `unifiedOrders.ts` (a queue record, no *blocking* consignment, not cancelled)
 * plus the phone and address the courier API rejects the booking without, so the
 * button is never enabled for a request the backend would refuse.
 *
 * The already-sent case is first because it is the common one: `GET /deferred`
 * leaves out every order that already has a consignment, so in production each
 * booked order arrives here with no queue record at all. A *rejected* booking is
 * the exception — the API will take that one again — so it must not be reported
 * as already sent, or the one order that needs a retry is the one order the
 * drawer refuses to retry.
 */
function sendBlockedReason(order: UnifiedOrder): string | null {
  if (courierBlocksBooking(order.courier)) {
    const provider = humanise(order.courierProvider || 'the courier');
    return `Already sent to ${provider}${order.trackingId ? ` · ${order.trackingId}` : ''}.`;
  }
  if (order.workflowStatus === 'cancelled') {
    return 'This order is cancelled, so it cannot be sent to a courier.';
  }
  if (!order.deferred) {
    return 'This order is not in the courier queue, so it cannot be sent from here.';
  }
  if (!order.phone || !order.address) {
    return 'A courier needs a phone number and a delivery address. Edit the order first.';
  }
  return null;
}

/** Built only from fields the record actually carries — no invented history. */
function timelineFor(order: UnifiedOrder): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  entries.push({
    title: 'Order placed',
    detail: order.placedAt ? longDateTime(order.placedAt) : 'Time not recorded',
  });

  if (order.deferred?.fraudDetails?.courier_summary) {
    const summary = order.deferred.fraudDetails.courier_summary;
    entries.push({
      title: 'Courier history checked',
      detail: `${humanise(summary.verdict)} · ${summary.total_delivered}/${summary.total_orders} delivered`,
    });
  }

  if (order.workflowStatus === 'confirmed' || order.workflowStatus === 'processing') {
    entries.push({ title: `Marked ${order.workflowStatus}`, detail: 'Status synced to your store' });
  }

  if (order.courier) {
    entries.push({
      title: `Booked with ${humanise(order.courierProvider || 'courier')}`,
      detail: order.courier.created_at ? longDateTime(order.courier.created_at) : undefined,
    });
    const state = (order.courier.courier_status || '').toLowerCase();
    const waiting = ['pending', 'booking_queued', 'booking_processing'].includes(state);
    entries.push({
      title: waiting ? 'Waiting for the courier to accept' : `Courier status: ${humanise(state)}`,
      detail: order.trackingId ? `Tracking ${order.trackingId}` : waiting ? 'No tracking ID yet' : undefined,
      open: waiting || state === 'booking_failed',
    });
    entries.push({
      title: order.purchaseSynced ? 'Purchase event sent to ad platforms' : 'Purchase event not sent yet',
      detail: order.purchaseSynced ? undefined : 'It fires once delivery is confirmed',
      open: !order.purchaseSynced,
    });
  } else if (order.workflowStatus !== 'cancelled') {
    entries.push({ title: 'Waiting for courier booking', open: true });
  }

  if (order.workflowStatus === 'cancelled') {
    entries.push({ title: 'Order cancelled', detail: 'No further tracking events will fire' });
  }

  return entries;
}

export interface OrderDetailDrawerProps {
  order: UnifiedOrder;
  onClose: () => void;
  onBookCourier: (order: UnifiedOrder) => void;
  onEditOrder: (order: UnifiedOrder) => void;
  onPrintInvoice: (order: UnifiedOrder) => void;
  onPrintLabel: (order: UnifiedOrder) => void;
  onStatusChange: (order: UnifiedOrder, status: OrderWorkflowStatus) => void;
  onCopyPhone: (phone: string) => void;
  statusBusy: boolean;
  /** The live fraud cell and WhatsApp cell, passed through unchanged. */
  risk?: ReactNode;
  whatsApp?: ReactNode;
  fraudDetail?: ReactNode;
}

export default function OrderDetailDrawer({
  order, onClose, onBookCourier, onEditOrder, onPrintInvoice, onPrintLabel,
  onStatusChange, onCopyPhone, statusBusy, risk, whatsApp, fraudDetail,
}: OrderDetailDrawerProps) {
  const initials = order.customerName
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '').join('') || '?';
  const statusOptions = statusOptionsFor(order);
  const timeline = timelineFor(order);
  const subtotal = Number(order.deferred?.productSubtotal) || 0;
  const delivery = Number(order.deferred?.deliveryCharge ?? order.courier?.delivery_charge) || 0;
  const discount = Number(order.deferred?.discount) || 0;
  const blocked = sendBlockedReason(order);
  /**
   * A consignment the courier rejected. `enqueue_courier_booking` resets that row
   * and its job and hands it back to the worker, so this is a second attempt at
   * the same order rather than a first send — and calling it "Send to courier"
   * next to a banner reading "Courier rejected the booking" would read as if
   * nothing had been sent at all.
   */
  const retrying = Boolean(order.courier) && !courierBlocksBooking(order.courier);
  /**
   * When the order *is* bookable the prerequisite note inside Fulfillment already
   * says what is missing, so repeating it above the footer would print the same
   * sentence twice in one panel. The footer only speaks for the cases that note
   * does not cover: already sent, cancelled, or not in the queue.
   */
  const footerNote = order.bookable ? null : blocked;

  const actions: DrawerAction[] = [];
  if (order.deferred && order.workflowStatus !== 'cancelled') {
    actions.push({
      key: 'edit', short: 'Edit', full: 'Edit order',
      icon: <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />,
      run: () => onEditOrder(order),
    });
  }
  actions.push({
    key: 'invoice', short: 'Invoice', full: 'Print invoice',
    icon: <Printer className="h-3.5 w-3.5" aria-hidden="true" />,
    run: () => onPrintInvoice(order),
  });
  if (order.courier) {
    actions.push({
      key: 'label', short: 'Label', full: 'Print label',
      icon: <Ticket className="h-3.5 w-3.5" aria-hidden="true" />,
      run: () => onPrintLabel(order),
    });
  }
  const actionCols = actions.length >= 3 ? 'grid-cols-3' : actions.length === 2 ? 'grid-cols-2' : 'grid-cols-1';

  return (
    <Drawer onClose={onClose} eyebrow={`Order #${order.orderId}`} title={order.customerName}>
      <div className="flex items-center gap-2 border-b border-[var(--bk-console-border)] bg-[var(--color-table-head)] px-5 py-3.5">
        <Status
          value={humanise(order.fulfillment)}
          tone={order.attention?.tone === 'danger' ? 'danger' : undefined}
          dot
        />
        {order.isCod && <span className="text-[11px] font-extrabold text-[var(--bk-console-text-muted)]">COD</span>}
        <span className="ml-auto text-[11px] text-[var(--bk-console-text-muted)]">
          {order.ageHours > 0 ? `Placed ${formatHeldAge(order.ageHours)}` : 'Just now'}
        </span>
      </div>

      {order.attention && (
        <div className={`mx-5 mt-4 flex gap-2 rounded-[7px] border p-2.5 text-[11px] font-semibold leading-relaxed ${
          order.attention.tone === 'danger'
            ? 'border-rose-200 bg-rose-50 text-rose-900'
            : 'border-amber-200 bg-amber-50 text-amber-900'
        }`}>
          {order.attention.reason}
        </div>
      )}

      <section className="border-b border-[var(--bk-console-border)] p-5">
        <h3 className="mb-3.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--bk-console-text-muted)]">
          Customer
        </h3>
        <div className="flex items-start gap-3">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-indigo-200 text-[11px] font-extrabold text-indigo-800">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-[13px] font-semibold text-[var(--bk-console-text)]">{order.customerName}</strong>
            {order.phone ? (
              <div className="mt-1 flex items-center gap-1.5">
                <Phone className="h-3 w-3 shrink-0 text-[var(--bk-console-text-muted)]" aria-hidden="true" />
                <a href={`tel:${order.phone}`} className="font-mono text-[11px] text-[var(--bk-console-blue)] hover:underline">
                  {order.phone}
                </a>
                <button
                  type="button"
                  onClick={() => onCopyPhone(order.phone)}
                  aria-label="Copy phone number"
                  className="grid h-7 w-7 cursor-pointer place-items-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <Copy className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                No usable phone number — the courier cannot deliver without one.
              </p>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--bk-console-text-muted)]">
              {order.address || 'No delivery address recorded'}
            </p>
          </div>
        </div>
        {(risk || whatsApp) && (
          // bk-touch-44 (index.css) raises both cells' buttons to a 44px minimum
          // on a phone. This is now the *only* place either action lives on a
          // small screen — the mobile order card carries no controls — so a
          // 20px "Fraud check" pill here would just relocate the defect.
          <div className="bk-touch-44 mt-3.5 flex flex-wrap items-center gap-2">
            {risk}
            {whatsApp}
          </div>
        )}
        {fraudDetail && <div className="mt-3">{fraudDetail}</div>}
        {order.deferred?.note && (
          <p className="mt-3 rounded-[7px] border border-[var(--bk-console-border)] bg-[var(--color-row-hover)] p-2.5 text-[11px] leading-relaxed text-[var(--bk-console-text)]">
            <span className="font-extrabold">Customer note: </span>{order.deferred.note}
          </p>
        )}
      </section>

      <section className="border-b border-[var(--bk-console-border)] p-5">
        <h3 className="mb-3.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--bk-console-text-muted)]">
          Fulfillment
        </h3>

        <div className="my-2.5 grid grid-cols-3 gap-2">
          {[
            { label: 'Courier', value: order.courier ? humanise(order.courierProvider || '—') : 'Not booked' },
            { label: 'Tracking', value: order.trackingId || '—' },
            { label: order.isCod ? 'To collect' : 'Order value', value: money(order.total) },
          ].map(cell => (
            <div key={cell.label} className="grid gap-1 rounded-[7px] border border-[var(--bk-console-border)] bg-[var(--color-row-hover)] p-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-[var(--bk-console-text-muted)]">
                {cell.label}
              </span>
              <strong className="truncate font-mono text-[11px] font-semibold text-[var(--bk-console-text)]" title={cell.value}>
                {cell.value}
              </strong>
            </div>
          ))}
        </div>

        {order.bookable && (
          <div className={`my-2.5 flex gap-2 rounded-[7px] border p-2.5 text-[11px] leading-relaxed ${
            order.phone && order.address
              ? 'border-blue-200 bg-blue-50 text-blue-900'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}>
            <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              {!order.phone || !order.address
                ? 'Booking needs a phone number and a delivery address. Edit the order first.'
                : retrying
                  ? 'The courier rejected this booking. Sending it again re-queues the same order — it does not create a second parcel.'
                  : 'Ready to book. The next screen asks for weight, pickup store and delivery area.'}
            </span>
          </div>
        )}

        <label className="mt-3 block">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.05em] text-[var(--bk-console-text-muted)]">
            Order status
          </span>
          <select
            value={statusOptions.includes(order.workflowStatus) ? order.workflowStatus : statusOptions[0]}
            disabled={statusBusy}
            onChange={event => onStatusChange(order, event.target.value as OrderWorkflowStatus)}
            className="mt-1.5 h-11 w-full cursor-pointer rounded-md border border-[var(--bk-control-border)] bg-white px-2.5 text-label font-semibold text-[var(--bk-console-text)] focus:border-[var(--bk-console-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--bk-console-blue)] disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>{humanise(status)}</option>
            ))}
          </select>
        </label>

        {/*
         * Edit order / Print invoice / Print label, all three on one row on a
         * phone. The count varies — Edit needs a queue record and Print label
         * needs a consignment — so the column count follows it, or a two-button
         * row would leave a third of itself empty.
         *
         * `min-w-0` is what lets a 1fr track shrink to a third of a 375px screen;
         * without it the widest label sizes the track and the row overflows. The
         * labels shorten to fit that third (the prototype's own third button is
         * just "Invoice"), while aria-label keeps the full wording for a screen
         * reader, so the accessible name does not change with the viewport.
         */}
        <div className={`mt-3 grid gap-2 sm:flex sm:flex-wrap ${actionCols}`}>
          {actions.map(action => (
            <Button
              key={action.key}
              variant="secondary"
              size="sm"
              className="min-w-0 sm:min-w-[120px] sm:flex-1"
              aria-label={action.full}
              onClick={action.run}
            >
              {action.icon}
              <span className="sm:hidden">{action.short}</span>
              <span className="hidden sm:inline">{action.full}</span>
            </Button>
          ))}
        </div>
      </section>

      <section className="border-b border-[var(--bk-console-border)] p-5">
        <h3 className="mb-3.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--bk-console-text-muted)]">
          Items
        </h3>
        {order.products.length === 0 ? (
          <p className="text-[11px] text-[var(--bk-console-text-muted)]">
            No line items were captured for this order.
          </p>
        ) : (
          <ul className="grid gap-3">
            {order.products.map((product, index) => {
              const meta = productMeta(product);
              const quantity = Number(product.quantity) || 1;
              const price = Number(product.price) || 0;
              return (
                <li key={`${product.name || product.content_name || 'item'}-${index}`} className="grid grid-cols-[42px_1fr_auto] items-center gap-2.5">
                  <span className="grid h-[42px] w-[42px] place-items-center rounded-md bg-indigo-50 text-[11px] font-extrabold text-slate-500">
                    ×{quantity}
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-[12px] font-semibold text-[var(--bk-console-text)]">
                      {product.name || product.content_name || 'Unnamed item'}
                    </strong>
                    {meta.length > 0 && (
                      <span className="mt-1 block truncate text-[11px] text-[var(--bk-console-text-muted)]">
                        {meta.map(entry => `${entry.label}: ${entry.value}`).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-[12px] font-extrabold text-[var(--bk-console-text)]">
                    {money(price * quantity)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <dl className="mt-4 grid gap-1.5 border-t border-[var(--bk-console-border)] pt-3 text-[11px]">
          {subtotal > 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--bk-console-text-muted)]">Items subtotal</dt>
              <dd className="font-semibold text-[var(--bk-console-text)]">{money(subtotal)}</dd>
            </div>
          )}
          {delivery > 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--bk-console-text-muted)]">Delivery charge</dt>
              <dd className="font-semibold text-[var(--bk-console-text)]">{money(delivery)}</dd>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--bk-console-text-muted)]">Discount</dt>
              <dd className="font-semibold text-emerald-700">−{money(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-[var(--bk-console-border)] pt-1.5">
            <dt className="font-extrabold text-[var(--bk-console-text)]">
              {order.isCod ? 'Collect on delivery' : 'Order total'}
            </dt>
            <dd className="text-[13px] font-extrabold text-[var(--bk-console-text)]">{money(order.total)}</dd>
          </div>
        </dl>
      </section>

      <section className="p-5">
        <h3 className="mb-3.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--bk-console-text-muted)]">
          Activity
        </h3>
        <ol className="grid list-none gap-[17px]">
          {timeline.map((entry, index) => (
            <li key={`${entry.title}-${index}`} className="grid grid-cols-[10px_1fr] gap-2.5">
              <i
                className={`mt-[3px] h-[9px] w-[9px] rounded-full border-2 border-white ring-1 ${
                  entry.open
                    ? 'bg-amber-500 ring-amber-200'
                    : 'bg-indigo-400 ring-indigo-300'
                }`}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <strong className={`block text-[12px] font-semibold ${entry.open ? 'text-amber-700' : 'text-[var(--bk-console-text)]'}`}>
                  {entry.title}
                </strong>
                {entry.detail && (
                  <span className="mt-1 block text-[11px] leading-relaxed text-[var(--bk-console-text-muted)]">
                    {entry.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/*
       * The bottom of the panel holds one action — the thing that moves the order
       * forward — and Close. It used to fall back to Print label, then Print
       * invoice, when booking was impossible, which put a second Print label
       * directly under the one in Fulfillment. In production that fallback fired
       * for *every* booked order, because `GET /deferred` drops orders that
       * already have a consignment, so `bookable` is false for all of them.
       *
       * Send to courier is now always the button, disabled with the reason
       * printed rather than swapped out, so "why can I not send this?" is
       * answered on the screen. Disabling is not cosmetic: with no queue record
       * OrdersView has no `pending_event_id` to POST to /courier/send, so the
       * click would be a silent no-op. The backend cannot create a second parcel
       * either way — `enqueue_courier_booking` answers `already_booked` for every
       * existing consignment except one it rejected, which it deliberately resets
       * and re-queues, and that one case is what the Retry label covers.
       */}
      <footer className="sticky bottom-0 mt-auto grid gap-2 border-t border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] px-5 py-3.5">
        {footerNote && (
          <p className="text-[11px] font-semibold leading-relaxed text-[var(--bk-console-text-muted)]">
            {footerNote}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            variant="primary"
            onClick={() => onBookCourier(order)}
            disabled={Boolean(blocked)}
            title={blocked || undefined}
          >
            <Truck className="h-4 w-4" aria-hidden="true" />
            {retrying ? 'Retry courier booking' : 'Send to courier'}
          </Button>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </footer>
    </Drawer>
  );
}
