/**
 * The Orders workspace: one table, eight views.
 *
 * This is the prototype's Orders information architecture rebuilt on the live
 * portal's own primitives. It is a *presentation* layer only — it holds no
 * fetch, no mutation and no API import. Every row keeps its original
 * `deferred` / `courier` / `ledger` record (see `unifiedOrders.ts`) so each
 * action dispatches through the handler OrdersView already owns.
 *
 * Column order follows the merchant's own reading order: who ordered, what they
 * bought, where they came from, what it is worth, what the shop owes them next,
 * whether they are safe to ship to, whether they confirmed on WhatsApp, where the
 * parcel is, and how long it has been waiting. Only **Items** is auto-width: in a
 * `table-fixed` table where every column is pinned, the browser spreads the
 * surplus over all of them and opens a gap in the middle of the row, so exactly
 * one column has to absorb it.
 *
 * There is no Payment column. Cash-on-delivery is the default here and the
 * method never decides an action, so it prints as a line under the total and the
 * space goes to Status — the one cell a merchant actually reaches for.
 *
 * Deliberate deviation from the prototype: WhatsApp confirmation is a column of
 * its own. It is a live one-tap action on the held COD queue and the prototype
 * predates it, so burying it in the drawer would regress a shipped feature. The
 * column is dropped whole when the server has the feature off — the cell renders
 * nothing in that case, and a permanently blank column reads as a bug.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle, ChevronRight, Copy, Package, Printer, RefreshCw, Search, SlidersHorizontal, Ticket, Truck,
} from 'lucide-react';
import type { OrderWorkflowStatus } from '../../types';
import { copyTextWithFeedback } from '../../lib/clipboard';
import { useIsWide } from '../../lib/useIsWide';
import {
  Button, Card, MetricStrip, PageHeader, PaginationControls, Status, TabPanel, TableHeaderCell, Tabs, tabId,
} from '../common';
import { ProductThumb } from '../common/ProductThumb';
import { FraudVerdictBadge } from '../FraudVerdictBadge';
import type { MetricStripItem, TabItem } from '../common';
import { formatHeldAge } from './ordersUtils';
import { OrderStatusPicker } from './OrderStatusControl';
import {
  ORDERS_PAGE_SIZE, ORDER_VIEWS, filterOrders, matchesView, paginateOrders,
  providersIn, statusOptionsFor, summariseOrders,
} from './unifiedOrders';
import type { OrderFilters, OrderViewKey, UnifiedOrder } from './unifiedOrders';

/**
 * The product tour highlights two of these tabs by `data-guide` attribute. The
 * old page had a two-button strip for the same two lists, so the hooks move onto
 * the views that replaced them rather than disappearing.
 */
const VIEW_GUIDE_HOOKS: Partial<Record<OrderViewKey, string>> = {
  ready: 'orders-pending-tab',
  courier: 'orders-shipped-tab',
};

const RISK_OPTIONS = [
  { value: 'all', label: 'Any risk' },
  { value: 'HIGH_RISK', label: 'High risk' },
  { value: 'RISKY', label: 'Risky' },
  { value: 'MODERATE', label: 'Moderate' },
  { value: 'GOOD', label: 'Good' },
  { value: 'EXCELLENT', label: 'Best' },
  { value: 'NEW_CUSTOMER', label: 'New customer' },
  { value: 'NOT_CHECKED', label: 'Not checked' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'value-high', label: 'Highest value' },
  { value: 'value-low', label: 'Lowest value' },
];

/**
 * Courier and workflow states, given a tone explicitly. `statusTone` guesses
 * from keywords and would read 'picked_up' as neutral grey, which is wrong for
 * a parcel that is already moving.
 */
const FULFILLMENT_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning',
  'on-hold': 'warning',
  booking_queued: 'warning',
  booking_processing: 'warning',
  booking_failed: 'danger',
  confirmed: 'success',
  processing: 'info',
  picked_up: 'info',
  in_transit: 'info',
  shipped: 'info',
  delivered: 'success',
  completed: 'success',
  returned: 'danger',
  partial_returned: 'warning',
  cancelled: 'danger',
};

const humanise = (value: string) => value.replace(/[_-]+/g, ' ').replace(/^\w/, c => c.toUpperCase());

const money = (value: number) => `৳${Math.round(value).toLocaleString('en-US')}`;

const shortDate = (iso: string) => {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

/**
 * The selection bar's own disabled treatment. Button's flat grey is for a light
 * panel; on the indigo bar a light grey pill would read as the *most* prominent
 * control on it. So the same idea in reverse: a fixed dim white instead of a 45%
 * opacity fade, which thinned label and translucent fill together down to
 * 3.31:1 — under the 4.5:1 floor for 11px text. `white/70` on the bar measures
 * 5.2:1 and still reads as clearly inert next to the near-white live labels.
 * `disabled:hover:` is needed because `:hover` matches a disabled button.
 */
const disabledOnBar = 'disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 '
  + 'disabled:text-white/70 disabled:hover:bg-white/5';

/**
 * The prototype's `.compact-select`: label and control inside one pill. 44px on a
 * phone and 38px from sm up — portal.css raises every control to a 44px minimum
 * inside its phone block, and this one carried three of the page's five
 * under-sized targets.
 */
function CompactSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex h-11 items-center gap-1.5 rounded-md border border-[var(--bk-control-border)] bg-white px-2.5 text-label font-extrabold text-[var(--bk-console-text-muted)] focus-within:border-[var(--bk-console-blue)] focus-within:ring-2 focus-within:ring-[var(--bk-console-blue)] sm:h-[38px]">
      <span className="whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 w-full min-w-0 cursor-pointer border-0 bg-transparent px-0.5 text-label font-extrabold text-[var(--bk-console-text)] focus:outline-none sm:h-[34px] sm:w-auto sm:min-w-[92px]"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export interface OrdersWorkspaceProps {
  orders: UnifiedOrder[];
  loading: boolean;
  view: OrderViewKey;
  onViewChange: (view: OrderViewKey) => void;
  filters: OrderFilters;
  onFiltersChange: (next: OrderFilters) => void;
  page: number;
  onPageChange: (page: number) => void;
  /** Selection is keyed by `orderId` so one set covers held and booked rows. */
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  intakeError: string | null;
  onRefresh: () => void;
  onOpenOrder: (order: UnifiedOrder) => void;
  onBookCourier: (order: UnifiedOrder) => void;
  onPrintInvoices: (orders: UnifiedOrder[]) => void;
  onPrintLabels: (orders: UnifiedOrder[]) => void;
  /**
   * Dispatches to the status handler OrdersView already owns, which calls
   * `PATCH /orders/{id}/status` and queues the WooCommerce update. The table adds
   * no new mutation path — it only reaches the one that already ships.
   */
  onStatusChange: (order: UnifiedOrder, status: OrderWorkflowStatus) => void;
  /** The single order whose status change is in flight, so only its cell waits. */
  statusBusyOrderId: string | null;
  /** Supplied by OrdersView so the existing fraud + WhatsApp cells are reused. */
  renderRisk: (order: UnifiedOrder) => ReactNode;
  renderWhatsApp: (order: UnifiedOrder) => ReactNode;
  /**
   * The server's WhatsApp flag. False removes the column entirely rather than
   * leaving eleven blank cells behind, because the cell itself renders nothing
   * when the feature is dark.
   */
  whatsappAvailable: boolean;
  /** OrdersView's toast, so the tracking-ID copy confirms the same way phone copy does. */
  showToast: (message: string, isError?: boolean) => void;
}

export default function OrdersWorkspace({
  orders, loading, view, onViewChange, filters, onFiltersChange, page, onPageChange,
  selectedIds, onSelectionChange, intakeError, onRefresh,
  onOpenOrder, onBookCourier, onPrintInvoices, onPrintLabels,
  onStatusChange, statusBusyOrderId,
  renderRisk, renderWhatsApp, whatsappAvailable, showToast,
}: OrdersWorkspaceProps) {
  const metrics = useMemo(() => summariseOrders(orders), [orders]);
  const providers = useMemo(() => providersIn(orders), [orders]);

  const inView = useMemo(
    () => orders.filter(order => matchesView(order, view)),
    [orders, view],
  );
  const rows = useMemo(() => filterOrders(inView, filters), [inView, filters]);

  /** Phone only: the courier/risk/sort row is folded away until asked for. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  /** sm and up gets the tab strip; below it, a view picker. See the render. */
  const isWide = useIsWide(640);
  /** Badge on the phone "Filters" button — how many of the three are off default. */
  const activeFilterCount = [
    filters.provider !== 'all',
    filters.risk !== 'all',
    filters.sort !== 'newest',
  ].filter(Boolean).length;

  const { rows: pageRows, safePage } = paginateOrders(rows, page);

  const tabs: Array<TabItem<OrderViewKey>> = ORDER_VIEWS.map(entry => ({
    id: entry.key,
    label: entry.label,
    count: orders.filter(order => matchesView(order, entry.key)).length,
    dataGuide: VIEW_GUIDE_HOOKS[entry.key],
  }));
  const activeView = ORDER_VIEWS.find(entry => entry.key === view) ?? ORDER_VIEWS[0];

  const selected = orders.filter(order => selectedIds.includes(order.orderId));
  const pageIds = pageRows.map(order => order.orderId);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id));
  const bookableSelected = selected.filter(order => order.bookable);
  const labelableSelected = selected.filter(order => order.courier);

  const toggleRow = (orderId: string, checked: boolean) => {
    onSelectionChange(checked
      ? (selectedIds.includes(orderId) ? selectedIds : [...selectedIds, orderId])
      : selectedIds.filter(id => id !== orderId));
  };

  const togglePage = () => {
    onSelectionChange(allPageSelected
      ? selectedIds.filter(id => !pageIds.includes(id))
      : Array.from(new Set([...selectedIds, ...pageIds])));
  };

  /**
   * A tracking ID is what the merchant pastes into the courier's own site or
   * reads out on the phone, and the 146px column truncates it. Reading it off
   * the screen was impossible; copying it now takes one click.
   */
  const copyTracking = (trackingId: string) => {
    void copyTextWithFeedback(trackingId, showToast, {
      success: `Tracking ID ${trackingId} copied.`,
      error: 'Could not copy the tracking ID.',
    });
  };

  const setFilter = <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const metricItems: MetricStripItem[] = [
    {
      label: 'Open orders',
      shortLabel: 'Open',
      value: metrics.openCount,
      hint: metrics.bookingPending > 0 ? `${metrics.bookingPending} waiting on the courier` : 'Not delivered or returned yet',
    },
    { label: 'Open order value', shortLabel: 'Value', value: money(metrics.openValue), hint: 'Cash still in transit' },
    {
      label: 'Ready to ship',
      shortLabel: 'Ready',
      value: metrics.readyCount,
      hint: metrics.readyCount > 0 ? 'Confirmed, no consignment yet' : 'Nothing waiting to be booked',
    },
    {
      label: 'Delivery rate',
      shortLabel: 'Delivered',
      value: metrics.deliveryRate === null ? '—' : `${metrics.deliveryRate}%`,
      hint: metrics.settled > 0
        ? `${metrics.delivered} delivered · ${metrics.returned} returned`
        : 'Shows once the first parcel settles',
    },
  ];

  /**
   * The line under the title talks about the merchant's own orders, never about
   * our ingestion. Captured-row counts, `data_quality` labels and the intake
   * health badge are banned from the Client Portal (CLAUDE.md → "Never show
   * order-intake diagnostics"): one sale can write several rows, so those numbers
   * describe our pipeline and read to a shop owner as lost orders. What is left
   * is the only thing they can act on — how many orders are still open, and how
   * many of those are waiting on a courier booking.
   */
  const feedTone = intakeError
    ? 'bg-amber-500'
    : metrics.readyCount > 0 ? 'bg-amber-500' : orders.length > 0 ? 'bg-emerald-500' : 'bg-slate-300';
  const feedLine = intakeError
    ? 'Could not refresh from your store just now. Press Sync now to try again.'
    : orders.length === 0
      ? 'Waiting for the first sale from your connected store.'
      : metrics.readyCount > 0
        ? `${metrics.openCount} open order${metrics.openCount === 1 ? '' : 's'} — ${metrics.readyCount} ready to book a courier.`
        : `${metrics.openCount} open order${metrics.openCount === 1 ? '' : 's'}, none waiting to be booked.`;

  /**
   * Header labels, in the one order the body uses. Kept beside the colgroup so a
   * column can never be added to one and forgotten in the other.
   */
  const headings = whatsappAvailable
    ? ['Order', 'Customer', 'Items', 'Source', 'Total', 'Status', 'Risk', 'WhatsApp', 'Fulfillment', 'Placed']
    : ['Order', 'Customer', 'Items', 'Source', 'Total', 'Status', 'Risk', 'Fulfillment', 'Placed'];

  const searchTerm = filters.search.trim();

  return (
    <div id="orders-workspace">
      {/* Desktop-only page head.
          On a phone the top bar already prints "Orders" as the current page and
          carries its own circular refresh button, so this block repeated the page
          title, repeated the refresh glyph directly under it, and then repeated
          "2 open orders" — which the Open orders tile states as a number one row
          below. Three restatements for ~150px of the first screen. The sync
          action is not lost: it moves into the toolbar row below, where it is a
          labelled button rather than a second bare icon (the top bar's icon
          checks the store connection, which is a different job). */}
      <div className="hidden sm:block">
        <PageHeader
          eyebrow="Store operations"
          title="Orders"
          description={(
            <>
              <span>
                Held, booked, delivered and returned — the whole journey in one table. Open any row to
                book a courier, print an invoice, or change status.
              </span>
              <span className="mt-2 flex items-center gap-2 text-caption">
                <span className={`h-2 w-2 shrink-0 rounded-full ${feedTone}`} aria-hidden="true" />
                {feedLine}
              </span>
            </>
          )}
          action={(
            <Button variant="secondary" onClick={onRefresh} disabled={loading} aria-label="Sync now">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Sync now
            </Button>
          )}
        />
      </div>

      {/* The one thing the head said that no tile repeats: whether the last sync
          failed. It only appears when it has something to report, so a healthy
          page spends no space on it. */}
      {intakeError && (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-caption text-amber-900 sm:hidden">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
          {feedLine}
        </p>
      )}

      <MetricStrip items={metricItems} phoneLayout="row" />

      <Card flush padding="none" id="orders-pending">
        {/* The sidebar and the product tour both jump to the courier log; with one
            table that is the same panel, so this anchor sits on it too. */}
        <span id="orders-shipped" className="block scroll-mt-24" aria-hidden="true" />

        {/* A phone gets a picker, a desktop gets the strip.
            Eight views are 869px of tabs in a 362px box, so five of them lived
            off the right edge behind a horizontal swipe that a merchant has no
            reason to attempt — the strip simply looked as if it ended at "Ready
            to ship". A `<select>` shows all eight with their counts, needs no
            scrolling, and is the control a phone already knows how to open. Only
            one of the two is rendered (not hidden with CSS) so the other does not
            sit in the accessibility tree as a duplicate set of tabs. */}
        {isWide ? (
          <Tabs
            tabs={tabs}
            activeId={view}
            onChange={next => { onViewChange(next); onPageChange(1); }}
            label="Order views"
            idPrefix="orders-view"
            className="px-3.5"
          />
        ) : (
          <div
            id={tabId('orders-view', view)}
            data-guide="orders-shipped-tab"
            className="border-b border-[var(--bk-console-border)] px-3.5 py-2.5"
          >
            <label className="flex h-11 items-center gap-2 rounded-md border border-[var(--bk-control-border)] bg-white px-2.5 text-label font-extrabold text-[var(--bk-console-text-muted)] focus-within:border-[var(--bk-console-blue)] focus-within:ring-2 focus-within:ring-[var(--bk-console-blue)]">
              <span className="whitespace-nowrap">View</span>
              <select
                value={view}
                data-guide="orders-pending-tab"
                onChange={event => { onViewChange(event.target.value as OrderViewKey); onPageChange(1); }}
                className="h-10 w-full min-w-0 cursor-pointer border-0 bg-transparent px-0.5 text-label font-extrabold text-[var(--bk-console-text)] focus:outline-none"
              >
                {tabs.map(tab => (
                  <option key={tab.id} value={tab.id}>
                    {`${ORDER_VIEWS.find(entry => entry.key === tab.id)?.label ?? tab.id} (${tab.count ?? 0})`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {/* One row on a phone.
            The three filters used to sit in a 2-up grid under the search box, so
            the toolbar was 145px of chrome above a two-order list — a full order
            card's worth. They now open from a "Filters" button that carries the
            number of filters currently narrowing the list, so a merchant can see
            the list is filtered without the controls being permanently on screen.
            From sm up nothing changes: the row is the same wrapped flex line it
            was, and `filtersOpen` is ignored. */}
        <div className="flex flex-col items-stretch gap-2.5 border-b border-[var(--bk-console-border)] px-3.5 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <div className="flex items-center gap-2 sm:contents">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--bk-control-border)] bg-white px-2.5 focus-within:border-[var(--bk-console-blue)] focus-within:ring-2 focus-within:ring-[var(--bk-console-blue)] sm:h-[38px] sm:w-[min(480px,48%)] sm:flex-none">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={filters.search}
                onChange={event => { setFilter('search', event.target.value); onPageChange(1); }}
                placeholder={isWide ? 'Order, name, phone, tracking ID' : 'Search orders'}
                aria-label="Search orders"
                className="min-w-0 flex-1 border-0 bg-transparent text-label font-medium text-[var(--bk-console-text)] placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen(open => !open)}
              aria-expanded={filtersOpen}
              aria-controls="orders-filter-controls"
              className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-[var(--bk-control-border)] bg-white px-3 text-label font-semibold text-[var(--bk-console-text)] sm:hidden"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-500" aria-hidden="true" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-grid min-w-[18px] place-items-center rounded-full bg-[var(--bk-console-blue)] px-1 text-label font-extrabold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {/* The page head's Sync now, relocated for the phone. It reads the
                sales and courier feeds again; the top bar's circular icon checks
                the store connection. Two identical glyphs stacked 40px apart
                looked like one button drawn twice, so this one keeps its word. */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-[var(--bk-control-border)] bg-white px-3 text-label font-semibold text-[var(--bk-console-text)] disabled:cursor-not-allowed disabled:border-[var(--bk-control-disabled-border)] disabled:bg-[var(--bk-control-disabled-bg)] disabled:text-[var(--bk-control-disabled-text)] sm:hidden"
            >
              <RefreshCw className={`h-4 w-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Sync
            </button>
          </div>
          <div
            id="orders-filter-controls"
            className={`grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center ${filtersOpen ? '' : 'hidden sm:flex'}`}
          >
            <CompactSelect
              label="Courier"
              value={filters.provider}
              onChange={value => { setFilter('provider', value); onPageChange(1); }}
              options={[
                { value: 'all', label: 'Any courier' },
                ...providers.map(provider => ({ value: provider, label: humanise(provider) })),
              ]}
            />
            <CompactSelect
              label="Risk"
              value={filters.risk}
              onChange={value => { setFilter('risk', value); onPageChange(1); }}
              options={RISK_OPTIONS}
            />
            <CompactSelect
              label="Sort"
              value={filters.sort}
              onChange={value => setFilter('sort', value as OrderFilters['sort'])}
              options={SORT_OPTIONS}
            />
          </div>
        </div>

        {/* Only the active view is rendered, so the panel's id follows the
            selection — that keeps the active tab's aria-controls resolvable
            instead of pointing at seven regions that do not exist. */}
        <TabPanel idPrefix="orders-view" tabId={view} activeId={view}>
          {selected.length > 0 && (
          <div className="bk-touch-44 flex min-h-[46px] flex-wrap items-center gap-[9px] bg-[var(--bk-selection-bar)] px-3.5 py-[7px] text-[var(--bk-selection-bar-ink)]">
            <span className="text-body font-bold">{selected.length} selected</span>
            <span className="hidden h-[22px] w-px bg-white/20 sm:block" aria-hidden="true" />
            <button
              type="button"
              onClick={() => onPrintInvoices(selected)}
              className="inline-flex min-h-[31px] cursor-pointer items-center gap-1.5 rounded-[5px] border border-white/16 bg-white/8 px-[9px] text-label font-bold transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              Print invoices
            </button>
            <button
              type="button"
              onClick={() => onPrintLabels(labelableSelected)}
              disabled={labelableSelected.length === 0}
              title={labelableSelected.length === 0 ? 'Labels need a booked consignment' : undefined}
              className={`inline-flex min-h-[31px] cursor-pointer items-center gap-1.5 rounded-[5px] border border-white/16 bg-white/8 px-[9px] text-label font-bold transition-colors hover:bg-white/20 ${disabledOnBar} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
            >
              <Ticket className="h-3.5 w-3.5" aria-hidden="true" />
              Print labels{labelableSelected.length > 0 && labelableSelected.length !== selected.length ? ` (${labelableSelected.length})` : ''}
            </button>
            <button
              type="button"
              onClick={() => bookableSelected[0] && onBookCourier(bookableSelected[0])}
              disabled={bookableSelected.length === 0}
              title={bookableSelected.length === 0 ? 'Only an order with no consignment, or one the courier rejected, can be sent' : undefined}
              className={`inline-flex min-h-[31px] cursor-pointer items-center gap-1.5 rounded-[5px] border border-white/16 bg-white/8 px-[9px] text-label font-bold transition-colors hover:bg-white/20 ${disabledOnBar} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
            >
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              Send to courier
            </button>
            {/* Each booking needs its own weight, pickup store and delivery area,
                so there is no bulk booking endpoint. Say so instead of implying one. */}
            {bookableSelected.length > 1 && (
              <span className="text-label text-white/70">Opens one order at a time</span>
            )}
            <button
              type="button"
              onClick={() => onSelectionChange([])}
              className="ml-auto inline-flex min-h-[31px] cursor-pointer items-center rounded-[5px] px-2 text-label font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Clear
            </button>
          </div>
        )}

        {pageRows.length === 0 ? (
          <div className="grid min-h-[160px] place-items-center gap-2 px-4 py-10 text-center">
            <Package className="h-6 w-6 text-slate-300" aria-hidden="true" />
            <p className="text-label font-extrabold text-[var(--bk-console-text)]">
              {loading ? 'Loading…' : searchTerm ? 'No matches' : 'Nothing here yet'}
            </p>
            <p className="max-w-[380px] text-caption leading-relaxed text-[var(--bk-console-text-muted)]">
              {loading
                ? 'Reading the sales, courier and store feeds.'
                : searchTerm
                  ? `Nothing in this view matches “${searchTerm}”. Clear the search box to see the full list.`
                  : activeView.empty}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className={`w-full table-fixed border-collapse ${whatsappAvailable ? 'min-w-[1374px]' : 'min-w-[1250px]'}`}>
                <colgroup>
                  <col className="w-[42px]" />{/* select */}
                  <col className="w-[76px]" />{/* Order — a number, not a sentence */}
                  <col className="w-[208px]" />{/* Customer */}
                  {/* Items is the only unpinned column. It takes whatever the
                      viewport has spare, which stops `table-fixed` from sharing
                      that surplus out and tearing a gap open after Customer. */}
                  <col />
                  <col className="w-[112px]" />{/* Source */}
                  <col className="w-[92px]" />{/* Total */}
                  <col className="w-[130px]" />{/* Status */}
                  <col className="w-[126px]" />{/* Risk */}
                  {whatsappAvailable && <col className="w-[124px]" />}
                  <col className="w-[146px]" />{/* Fulfillment */}
                  <col className="w-[86px]" />{/* Placed */}
                  <col className="w-[52px]" />{/* open */}
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--bk-console-border)] bg-[var(--color-table-head)]">
                    <th scope="col" className="px-3.5 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={togglePage}
                        aria-label="Select every order on this page"
                        /* 16px of ink, 46px of target — the same halo the COD
                           table's boxes carry, and for the same reason:
                           `btn-touch-expand`'s flat -10px is sized for a 24px
                           control and leaves a 16px box at 36.
                           Lopsided on purpose, and this is the only box in
                           either table that is. This header row is 42px tall
                           and the box sits 10px below its top, so a symmetric
                           15px halo cannot reach 44: the wrapper above is
                           `overflow-x-auto`, which makes the y axis clip too,
                           and the top of the halo is cut off at the table's
                           own edge — measured 11px of it survives, for 41px of
                           usable height. So the missing height is taken from
                           below instead, where nothing clips: 11 + 16 + 19 =
                           46. The 3px that reaches past this cell lands in the
                           first row's checkbox cell, on padding whose click
                           handler only stops the row from opening, and stops
                           18px short of that row's own halo. */
                        className="relative h-4 w-4 cursor-pointer accent-indigo-600 before:absolute before:-inset-x-[15px] before:-top-[15px] before:-bottom-[19px] before:content-['']"
                      />
                    </th>
                    {headings.map(heading => (
                      <TableHeaderCell key={heading} className="text-caption">
                        {heading}
                      </TableHeaderCell>
                    ))}
                    {/* Sticky, not just positioned. The table needs 1374px and a
                        1440px screen leaves it 1142 after the rail and the page
                        padding, so the two right-hand columns were off the edge —
                        including the only *keyboard* path into an order, since the
                        row's own onClick is not focusable. Pinning this column to
                        the right edge keeps that button on screen at any width,
                        and its left shadow is what tells the reader the row
                        continues underneath it.

                        `sticky` also does the job `relative` used to do here:
                        `.sr-only` is `position: absolute`, so without a positioned
                        ancestor its containing block is <body>, its static
                        position inside the 1374px table put it at left 1638px, and
                        the whole document — not the table — grew a 1639px
                        scrollWidth and slid the rows under the fixed rail. */}
                    <th
                      scope="col"
                      className="sticky right-0 z-10 bg-[var(--color-table-head)] px-2 py-2.5 text-right shadow-[-8px_0_8px_-8px_rgba(25,39,51,0.18)]"
                    >
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(order => {
                    const rail = order.attention?.tone === 'danger'
                      ? 'border-l-rose-500'
                      : order.attention?.tone === 'warning' ? 'border-l-amber-400' : 'border-l-transparent';
                    const firstProduct = order.products[0];
                    const extraProducts = Math.max(0, order.products.length - 1);
                    // The same list the drawer offers, so the two places a status
                    // can change never disagree — and the backend never sees a
                    // transition it rejects.
                    const statusOptions = statusOptionsFor(order);
                    return (
                      <tr
                        key={order.orderId}
                        onClick={() => onOpenOrder(order)}
                        className="group cursor-pointer border-b border-[var(--bk-console-border)] align-middle transition-colors last:border-b-0 hover:bg-[var(--color-row-hover)]"
                      >
                        <td
                          className={`box-border border-l-[3px] px-3.5 py-3.5 ${rail}`}
                          onClick={event => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(order.orderId)}
                            onChange={event => toggleRow(order.orderId, event.target.checked)}
                            aria-label={`Select order ${order.orderId}`}
                            /* Same 15px halo as the header box. Here the row's
                               own onClick opens the order and this cell stops
                               that click, so the few pixels the halo reaches
                               into the next cell's padding select the row
                               instead of opening it — the same thing the box
                               itself does, which is why it is safe to spill. */
                            className="relative h-4 w-4 cursor-pointer accent-indigo-600 before:absolute before:-inset-[15px] before:content-['']"
                          />
                        </td>
                        <td className="px-3 py-3.5">
                          <span
                            className="block truncate font-mono text-[11px] font-medium tracking-[0.01em] text-[var(--bk-console-blue)]"
                            title={`Order #${order.orderId}`}
                          >
                            #{order.orderId}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <strong className="block truncate text-[12px] font-semibold leading-[1.35] text-[var(--bk-console-text)]">
                            {order.customerName}
                          </strong>
                          {order.phone ? (
                            <span className="mt-1 block font-mono text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]">
                              {order.phone}
                            </span>
                          ) : (
                            <span className="mt-1 flex items-center gap-1 text-[11px] leading-[1.35] text-rose-600">
                              <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
                              No usable phone
                            </span>
                          )}
                          {/* One line, always. A Dhaka delivery address runs long enough
                              to double the row height if it is allowed to wrap, so the
                              full text lives in the tooltip and the drawer. */}
                          <span
                            className="mt-1 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]"
                            title={order.address || undefined}
                          >
                            {order.address || 'Address not shared'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <ProductThumb
                              src={firstProduct?.image}
                              name={firstProduct?.name || firstProduct?.content_name}
                              size="md"
                            />
                            <span className="min-w-0">
                              <strong
                                className="block truncate text-[12px] font-semibold leading-[1.35] text-[var(--bk-console-text)]"
                                title={firstProduct?.name || firstProduct?.content_name || undefined}
                              >
                                {firstProduct?.name || firstProduct?.content_name || `${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`}
                              </strong>
                              <span className="mt-1 block text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]">
                                {order.itemCount} item{order.itemCount === 1 ? '' : 's'}
                                {extraProducts > 0 ? ` · +${extraProducts} more` : ''}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3.5">
                          {/* Only what the store actually tagged. 'Direct' is a
                              statement about our data, not a claim about the
                              customer, so it stays deliberately quiet. */}
                          <strong
                            className={`block truncate text-[12px] font-semibold leading-[1.35] ${
                              order.source === 'Direct' ? 'text-[var(--bk-console-text-muted)]' : 'text-[var(--bk-console-text)]'
                            }`}
                            title={order.source === 'Direct' ? 'No campaign tag was captured with this order' : order.source}
                          >
                            {order.source}
                          </strong>
                          {order.sourceDetail && (
                            <span
                              className="mt-1 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]"
                              title={order.sourceDetail}
                            >
                              {order.sourceDetail}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5">
                          <strong className="block text-[13px] font-extrabold leading-[1.35] tabular-nums text-[var(--bk-console-text)]">
                            {money(order.total)}
                          </strong>
                          {/* The Payment column is gone, so the one fact it carried
                              — is this cash to collect or already paid — rides
                              under the amount it applies to. */}
                          <span
                            className="mt-1 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]"
                            title={order.paymentLabel}
                          >
                            {order.isCod ? 'Cash on delivery' : 'Paid'}
                          </span>
                        </td>
                        <td className="px-3 py-3.5" onClick={event => event.stopPropagation()}>
                          <OrderStatusPicker
                            status={order.workflowStatus}
                            options={statusOptions}
                            busy={statusBusyOrderId === order.orderId}
                            onChange={next => onStatusChange(order, next)}
                            orderId={order.orderId}
                          />
                        </td>
                        <td className="px-3 py-3.5" onClick={event => event.stopPropagation()}>
                          {renderRisk(order)}
                          {order.attention && (
                            <span
                              className={`mt-1.5 line-clamp-2 text-[11px] leading-[1.25] ${
                                order.attention.tone === 'danger' ? 'text-rose-700' : 'text-amber-700'
                              }`}
                              title={order.attention.reason}
                            >
                              {order.attention.reason}
                            </span>
                          )}
                        </td>
                        {whatsappAvailable && (
                          <td className="px-2 py-3.5" onClick={event => event.stopPropagation()}>
                            {order.deferred ? renderWhatsApp(order) : (
                              <span
                                className="text-[11px] font-semibold text-[var(--bk-console-text-subtle)]"
                                title="A confirmation only goes out while the order is still held. This one is already booked with a courier."
                              >
                                —
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-3 py-3.5">
                          <Status
                            value={humanise(order.fulfillment)}
                            tone={FULFILLMENT_TONE[order.fulfillment.toLowerCase()] ?? 'neutral'}
                            dot
                          />
                          {order.courier ? (
                            <>
                              <span
                                className="mt-1 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]"
                                title={humanise(order.courierProvider || 'courier')}
                              >
                                {humanise(order.courierProvider || 'courier')}
                              </span>
                              {order.trackingId && (
                                <button
                                  type="button"
                                  onClick={event => {
                                    event.stopPropagation();
                                    copyTracking(order.trackingId as string);
                                  }}
                                  title={`Copy tracking ID ${order.trackingId}`}
                                  aria-label={`Copy tracking ID ${order.trackingId}`}
                                  className="mt-0.5 -ml-1 inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-[var(--bk-radius-control)] px-1 py-0.5 text-left text-[11px] font-medium leading-[1.35] text-[var(--bk-console-blue)] transition-colors hover:bg-[var(--color-row-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--bk-console-blue)]"
                                >
                                  <span className="min-w-0 truncate font-mono tracking-[0.01em]">
                                    {order.trackingId}
                                  </span>
                                  <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
                                </button>
                              )}
                            </>
                          ) : (
                            <span className="mt-1 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]">
                              {order.bookable ? 'Not booked yet' : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          <strong className="block text-[12px] font-semibold leading-[1.35] text-[var(--bk-console-text)]">
                            {order.ageHours > 0 ? formatHeldAge(order.ageHours) : '—'}
                          </strong>
                          <span className="mt-1 block text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]">
                            {shortDate(order.placedAt)}
                          </span>
                        </td>
                        {/* The pinned action cell. It carries its own background
                            because a sticky cell sits over the ones it scrolls
                            past, and a transparent one would let them show
                            through; `group-hover` keeps it on the same colour as
                            the rest of the row. */}
                        <td
                          className="sticky right-0 z-10 bg-[var(--bk-console-surface)] px-2 py-3.5 shadow-[-8px_0_8px_-8px_rgba(25,39,51,0.18)] transition-colors group-hover:bg-[var(--color-row-hover)]"
                          onClick={event => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onOpenOrder(order)}
                            aria-label={`Open order ${order.orderId}`}
                            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--bk-console-blue)]"
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* The phone list.
                Ported from the prototype's `.mobile-order-list`, including the
                decision that makes it work: **the card carries no controls.** The
                whole article is one tap target and it opens the drawer, where the
                status select is a full-width 44px control and the fraud and
                WhatsApp cells render at full size.

                The first port kept the desktop row's inline controls and shrank
                them to fit, which put a 24px select and three 20px buttons on the
                card — five sub-44px targets on a 302px card, and four different
                things a thumb could hit by accident while trying to open an order.
                The prototype has none, so neither does this. Nothing became
                unreachable: OrderDetailDrawer already renders all three (see its
                `risk` / `whatsApp` props and its Order status field).

                What each line earns its place with: who ordered and for how much,
                where it is going, what state it is in and whether they are safe to
                ship to, what they bought, and how long it has waited. Phone,
                payment method, source and the attention sentence all moved to the
                drawer — the left rail still carries attention as colour. */}
            <div className="grid gap-2.5 px-3.5 py-3 md:hidden">
              {pageRows.map(order => {
                const rail = order.attention?.tone === 'danger'
                  ? 'border-l-rose-500'
                  : order.attention?.tone === 'warning' ? 'border-l-amber-400' : 'border-l-transparent';
                const firstProduct = order.products[0];
                const extraProducts = Math.max(0, order.products.length - 1);
                return (
                  <article
                    key={order.orderId}
                    onClick={() => onOpenOrder(order)}
                    className={`cursor-pointer rounded-[7px] border border-[var(--bk-panel-border)] border-l-[3px] bg-white p-4 shadow-[0_1px_3px_rgba(25,39,51,.04)] ${rail}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-mono text-[11px] font-medium text-[var(--bk-console-blue)]">
                        #{order.orderId}
                      </span>
                      <strong className="shrink-0 text-[14px] font-extrabold tabular-nums text-[var(--bk-console-text)]">
                        {money(order.total)}
                      </strong>
                    </div>

                    <strong className="mt-1.5 block truncate text-[14px] font-bold leading-[1.3] text-[var(--bk-console-text)]">
                      {order.customerName}
                    </strong>
                    <span
                      className="mt-0.5 block truncate text-[12px] leading-[1.35] text-[var(--bk-console-text-muted)]"
                      title={order.address || undefined}
                    >
                      {order.address || 'Address not shared'}
                    </span>

                    {/* Two pills, as the prototype has: what the shop owes this
                        order next, and whether the customer is safe to ship to.
                        Both are read-only here — the drawer is where either one
                        changes. */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Status
                        value={humanise(order.fulfillment)}
                        tone={FULFILLMENT_TONE[order.fulfillment.toLowerCase()] ?? 'neutral'}
                        dot
                      />
                      {order.deferred && (
                        <FraudVerdictBadge
                          details={order.deferred.fraudDetails}
                          score={order.deferred.fraudScore}
                        />
                      )}
                    </div>

                    <footer className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-cell-line)] pt-2.5 text-[12px] text-[var(--bk-console-text-muted)]">
                      <span className="min-w-0 truncate">
                        {firstProduct?.name || firstProduct?.content_name || `${order.itemCount} item${order.itemCount === 1 ? '' : 's'}`}
                        {extraProducts > 0 ? ` · +${extraProducts} more` : ''}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        {order.ageHours > 0 ? formatHeldAge(order.ageHours) : shortDate(order.placedAt)}
                        <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      </span>
                    </footer>
                  </article>
                );
              })}
            </div>

            <PaginationControls
              page={safePage}
              pageSize={ORDERS_PAGE_SIZE}
              total={rows.length}
              onPageChange={onPageChange}
              noun="orders"
            />
          </>
        )}
        </TabPanel>
      </Card>
    </div>
  );
}
