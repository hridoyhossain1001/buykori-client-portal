/**
 * The Incomplete checkouts workspace: the prototype's Checkouts panel
 * (`ui-ux-audit-prototype/portal.tsx` → `Checkouts`) rebuilt on this portal's
 * primitives.
 *
 * Presentation only. Every fetch and every write still belongs to `App.tsx`,
 * which owns `/api/incomplete-checkouts`, `.../{id}/status` and
 * `.../{id}/create-order`; this file receives the loaded rows plus callbacks and
 * renders them. Reverting the page is therefore one import in
 * `IncompleteCheckoutsView.tsx`.
 *
 * Four things deliberately differ from the prototype, each because the live
 * backend says so:
 *
 *  - **The status control offers only what the API accepts.**
 *    `POST /incomplete-checkouts/{id}/status` allows
 *    `incomplete | contacted | recovered | ignored`, and answers 409 for a row
 *    that is already `recovered` or `expired`. So the in-row select carries those
 *    four and a finished row renders a read-only badge instead of a control that
 *    cannot work. The prototype's "Active" option is gone: production answers
 *    400 for it. `recovered` needs the paired backend change (the endpoint used to
 *    accept three) — it must not ship to a portal talking to an older API.
 *  - **"Still at checkout" is a note, not a filter.** The list endpoint returns
 *    `incomplete | contacted | recovered` by default while `counts` is grouped
 *    over every status, so `counts.active` describes carts that exist but have
 *    not entered this table yet. As a filter it would open an empty view.
 *  - **Undo never expires.** The prototype's undo bar clears itself after six
 *    seconds. Here an ignored row leaves the default list on the next fetch and
 *    the portal has no ignored view, so this bar is the only way back; it stays
 *    until it is used, dismissed, or replaced by the next change.
 *  - **The cart thumbnail is best-effort.** An abandoned cart is captured in the
 *    customer's browser and carries no photo, so the API fills each line in from
 *    the photos that arrived with the store's completed orders. A product nobody
 *    has ever ordered has no photo to borrow and draws the box icon instead.
 *    That is the honest state of the row, not a loading state.
 */

import { useMemo, useState } from 'react';
import { Activity, Check, Clock3, Copy, MessageSquareText, Phone, RefreshCw, RotateCcw, Search, ShoppingCart, X } from 'lucide-react';

import { Badge, Button, Card, ConfirmDialog, EmptyState, MetricStrip, PageHeader, PaginationControls, Status, TabPanel, TableHeaderCell, Tabs } from '../common';
import { ProductThumb } from '../common/ProductThumb';
import type { MetricStripItem, TabItem } from '../common';
import { copyTextWithFeedback } from '../../lib/clipboard';
import { realText, sourceLabel } from '../../lib/marketingSource';
import type { IncompleteCheckoutItem } from '../../types';
import { normalizePhone } from './incompleteCheckoutUtils';
import { useIsWide } from '../../lib/useIsWide';

/**
 * Which rows get a control at all. The backend answers 409 for a row that is
 * already `recovered` or `expired`, so those render a read-only badge instead of
 * a select that cannot save. `ignored` stays editable — a merchant who changed
 * their mind can put the cart back in play.
 */
const EDITABLE_FROM: ReadonlyArray<string> = ['incomplete', 'contacted', 'ignored'];

/**
 * What the select offers, in the order the work happens: nobody has called yet →
 * called → the sale was won → give up on it.
 *
 * `recovered` is here because merchants close these carts off-platform. They ring
 * the customer, the customer pays by bKash or reorders over WhatsApp, and no store
 * checkout is ever completed for us to match — so without this option the row a
 * merchant actually won stays "Contacted" forever and the Recovered tab stays
 * empty. It is deliberately terminal: `POST /{id}/status` stamps `convertedAt`
 * (which is what the recovery totals count) and then 409s every later change, so
 * the row settles into the badge. It does not create an order — "Create order" is
 * still the only thing that does, and only that path fills `orderId`.
 *
 * `active` is not offered: production answers 400 for it.
 */
const STATUS_CHOICES: ReadonlyArray<string> = ['incomplete', 'contacted', 'recovered', 'ignored'];

/**
 * Rows `POST /{id}/create-order` will accept: it requires `incomplete` or
 * `contacted` and no order id, so offering the button anywhere else would be a
 * button that answers 400.
 */
const CONVERTIBLE: ReadonlyArray<string> = ['incomplete', 'contacted'];

/** The card rail below md, which is the phone's version of the status column. */
const RAIL: Record<string, string> = {
  incomplete: 'border-l-amber-400',
  contacted: 'border-l-blue-400',
  recovered: 'border-l-emerald-400',
  ignored: 'border-l-slate-300',
  expired: 'border-l-slate-300',
};

/**
 * Backend words, in the merchant's words. `incomplete` is the whole page's name,
 * so printing it in every row said nothing; what the merchant needs to know
 * about that row is that nobody has called yet.
 */
const STATUS_LABEL: Record<string, string> = {
  incomplete: 'Not contacted',
  contacted: 'Contacted',
  recovered: 'Recovered',
  ignored: 'Ignored',
  expired: 'Expired',
  active: 'Still at checkout',
  open: 'Still at checkout',
};

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  incomplete: 'warning',
  contacted: 'info',
  recovered: 'success',
  ignored: 'neutral',
  expired: 'neutral',
  active: 'info',
  open: 'info',
};

type FilterKey = 'all' | 'incomplete' | 'contacted' | 'recovered';

/** Twelve three-line rows fill the panel without turning it into a scroll. */
const CHECKOUTS_PAGE_SIZE = 12;

/**
 * `৳` for taka, the code for anything else — the portal's convention in sixteen
 * other files. The prototype writes `BDT 2,790`; the live console does not.
 */
const money = (value: number, currency?: string) => {
  const amount = Math.round(Number(value) || 0).toLocaleString('en-US');
  const code = (currency || 'BDT').toUpperCase();
  return code === 'BDT' ? `৳${amount}` : `${code} ${amount}`;
};

/** A total is only honest in one currency; mixed rows fall back to the count. */
const sumMoney = (rows: IncompleteCheckoutItem[]) => {
  if (rows.length === 0) return '';
  const codes = new Set(rows.map(row => (row.currency || 'BDT').toUpperCase()));
  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  return codes.size === 1 ? money(total, rows[0].currency) : `${rows.length} carts`;
};

/** "1h 20m ago" — how cold the cart is, which is the thing that decides a call. */
const ageLabel = (iso: string) => {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours}h ${minutes % 60}m ago` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days}d ago`;
};

/** "29 Aug, 14:05" — the exact moment, under the age. */
const shortMoment = (iso: string) => {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

/** What the cart holds: first product name, then how many lines follow it. */
const productLine = (item: IncompleteCheckoutItem) => {
  const products = item.products || [];
  const first = products[0];
  const name = realText(first?.name || first?.content_name) || 'Cart contents not captured';
  const quantity = products.reduce((sum, product) => sum + (Number(product.quantity) || 1), 0);
  const extra = products.length > 1 ? ` · ${products.length} lines` : '';
  // The first line that has a photo stands for the cart, the same way the Orders
  // table prints one thumbnail per order. A cart of products the store has never
  // sold has none, and ProductThumb draws its box icon for those.
  const image = products.find((product) => product.image)?.image;
  return { name, meta: `${quantity} ${quantity === 1 ? 'item' : 'items'}${extra}`, image };
};

/**
 * Where the cart came from. Production returns `campaignData`, never a `source`
 * field, so the UTMs are the only answer available — and the checkout page path
 * is a better fallback than an empty cell. `sourceLabel` is shared with the Orders
 * table so both pages print one channel one way.
 */
const sourceLine = (item: IncompleteCheckoutItem) => {
  const campaign = item.campaignData || {};
  const source = sourceLabel(campaign.utm_source);
  let detail = realText(campaign.utm_campaign) || realText(campaign.utm_medium);
  if (!detail && item.pageUrl) {
    try { detail = new URL(item.pageUrl).pathname; } catch { detail = ''; }
  }
  return { source, detail: detail || 'No campaign tag' };
};

/**
 * What a recovered row's order id means. A `manual-` prefix is written by
 * `_create_manual_recovery_order`, which files a pending event — so that order is
 * waiting in COD review. Any other id came from the store itself, matched back to
 * this checkout by phone.
 */
const orderNote = (orderId: string) => (orderId.startsWith('manual-')
  ? { text: 'In COD review', hint: `${orderId} · created from this checkout, waiting for confirmation` }
  : { text: `#${orderId}`, hint: `${orderId} · placed in your store` });

/**
 * A `tel:` link cannot be a <Button>, so it wears the secondary button's shape by
 * hand — radius token and hairline lift included, because a bordered white box
 * with no shadow sitting beside a solid Create order reads as a disabled field
 * rather than something to press. Keep it in step with `common/Button.tsx`.
 */
const CALL_LINK = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--bk-radius-button)] border border-[var(--bk-control-border)] bg-white px-3 py-1.5 text-caption font-extrabold text-slate-700 shadow-[0_1px_2px_rgba(25,39,51,.06)] transition-colors hover:border-[var(--bk-console-border-strong)] hover:bg-slate-50';

export interface CheckoutsWorkspaceProps {
  items: IncompleteCheckoutItem[];
  /** Grouped over every status, server-side — including statuses not in `items`. */
  counts: Record<string, number>;
  /** How many rows exist behind the fetch's 100-row cap, when the API says. */
  totalCount?: number;
  updatingId: number | null;
  /** Resolves true only when the write landed, so Undo can never lie. */
  onUpdateStatus: (id: number, status: string) => Promise<boolean>;
  onOpenCreateOrder: (item: IncompleteCheckoutItem) => void;
  onRefresh: () => void | Promise<unknown>;
  showToast: (message: string, isError?: boolean) => void;
}

/** The last change, held so it can be put back. */
interface UndoState {
  id: number;
  name: string;
  from: string;
  to: string;
}

export default function CheckoutsWorkspace({
  items,
  counts,
  totalCount,
  updatingId,
  onUpdateStatus,
  onOpenCreateOrder,
  onRefresh,
  showToast,
}: CheckoutsWorkspaceProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<IncompleteCheckoutItem | null>(null);
  const [recoverTarget, setRecoverTarget] = useState<IncompleteCheckoutItem | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  /* Same 640px as the `sm:` classes in this file's toolbar. */
  const isWide = useIsWide(640);

  const refresh = async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  };

  /** What the loaded page holds, per status: the truth about this table. */
  const loaded = useMemo(() => {
    const tally: Record<string, number> = {};
    items.forEach(item => { tally[item.status] = (tally[item.status] || 0) + 1; });
    return tally;
  }, [items]);

  /**
   * `counts` is grouped over the whole table server-side, so it is the truth
   * about the store; the tiles read it. The tabs read `loaded`, because a tab
   * must promise only what clicking it will actually show.
   */
  const storeCount = (key: string) => counts[key] ?? loaded[key] ?? 0;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(item => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (!needle) return true;
      const products = (item.products || []).map(product => product.name || product.content_name || '').join(' ');
      return `${item.customerName} ${item.phone} ${item.email} ${item.address} ${products} ${item.orderId || ''}`
        .toLowerCase().includes(needle);
    });
  }, [items, filter, search]);

  const pageCount = Math.max(1, Math.ceil(rows.length / CHECKOUTS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * CHECKOUTS_PAGE_SIZE, safePage * CHECKOUTS_PAGE_SIZE);

  const queueRows = items.filter(item => item.status === 'incomplete' || item.status === 'contacted');
  const recoveredRows = items.filter(item => item.status === 'recovered');
  const waitingRows = items.filter(item => item.status === 'incomplete');
  // `Date.parse('')` is NaN and every comparison against NaN is false, so the
  // empty seed has to be tested for directly or the first row never wins.
  const latestWaiting = waitingRows.reduce<string>((latest, item) => (
    !latest || Date.parse(item.lastActivityAt) > Date.parse(latest) ? item.lastActivityAt : latest
  ), '');
  const stillAtCheckout = storeCount('active') + storeCount('open');
  const truncated = typeof totalCount === 'number' && totalCount > items.length;
  const stake = sumMoney(queueRows);

  const metricItems: MetricStripItem[] = [
    {
      label: 'In queue',
      shortLabel: 'Queue',
      value: (storeCount('incomplete') + storeCount('contacted')).toLocaleString(),
      hint: queueRows.length === 0
        ? 'Nothing waiting on a call'
        : truncated ? `${stake} in the newest ${items.length}` : `${stake} at stake`,
      icon: <Activity className="h-4 w-4" aria-hidden="true" />,
    },
    {
      label: 'Not contacted',
      shortLabel: 'To call',
      value: storeCount('incomplete').toLocaleString(),
      hint: latestWaiting ? `Newest ${ageLabel(latestWaiting)}` : 'Nobody is waiting',
      icon: <Clock3 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      label: 'Contacted',
      shortLabel: 'Called',
      value: storeCount('contacted').toLocaleString(),
      hint: storeCount('contacted') > 0 ? 'Waiting on a reply' : 'No calls made yet',
      icon: <MessageSquareText className="h-4 w-4" aria-hidden="true" />,
    },
    {
      label: 'Recovered',
      shortLabel: 'Saved',
      value: storeCount('recovered').toLocaleString(),
      hint: recoveredRows.length > 0 ? `${sumMoney(recoveredRows)} came back` : 'None recovered yet',
      icon: <Check className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  const tabs: Array<TabItem<FilterKey>> = [
    { id: 'all', label: 'All', count: items.length },
    {
      id: 'incomplete',
      label: <><span className="sm:hidden">To call</span><span className="hidden sm:inline">Not contacted</span></>,
      count: loaded.incomplete || 0,
    },
    {
      id: 'contacted',
      label: <><span className="sm:hidden">Called</span><span className="hidden sm:inline">Contacted</span></>,
      count: loaded.contacted || 0,
    },
    {
      id: 'recovered',
      label: <><span className="sm:hidden">Saved</span><span className="hidden sm:inline">Recovered</span></>,
      count: loaded.recovered || 0,
    },
  ];

  const oldestWaiting = queueRows.reduce<string>((oldest, item) => (
    !oldest || Date.parse(item.lastActivityAt) < Date.parse(oldest) ? item.lastActivityAt : oldest
  ), '');

  /**
   * `onUpdateStatus` reports whether the write landed, so a failed POST cannot
   * leave an "Undo" bar claiming a change that never happened.
   *
   * `recovered` gets no Undo bar, and that is not an omission: the endpoint answers
   * 409 for a row that is already recovered, so the bar's own button would fail. The
   * confirmation before the write is what stands in for it.
   */
  const applyStatus = async (item: IncompleteCheckoutItem, next: string) => {
    const previous = item.status;
    const ok = await onUpdateStatus(item.id, next);
    if (!ok) return;
    if (next === 'recovered') return;
    setUndo({ id: item.id, name: realText(item.customerName) || `Checkout ${item.id}`, from: previous, to: next });
  };

  const revertUndo = async () => {
    if (!undo) return;
    if (await onUpdateStatus(undo.id, undo.from)) setUndo(null);
  };

  /**
   * Both one-way doors ask first. Ignoring hides the row from every view the portal
   * can load; marking it recovered closes it for good, because the endpoint refuses
   * every later change to a recovered row.
   */
  const pickStatus = (item: IncompleteCheckoutItem, next: string) => {
    if (next === item.status) return;
    if (next === 'ignored') { setIgnoreTarget(item); return; }
    if (next === 'recovered') { setRecoverTarget(item); return; }
    void applyStatus(item, next);
  };

  const confirmIgnore = () => {
    const target = ignoreTarget;
    setIgnoreTarget(null);
    if (target) void applyStatus(target, 'ignored');
  };

  const confirmRecovered = () => {
    const target = recoverTarget;
    setRecoverTarget(null);
    if (target) void applyStatus(target, 'recovered');
  };

  const copyPhone = (phone: string) => {
    void copyTextWithFeedback(phone, showToast, {
      success: 'Phone number copied.',
      error: 'Could not copy phone number.',
    });
  };

  return (
    <div id="checkouts-workspace">
      <h1 className="sr-only sm:hidden">Incomplete checkouts</h1>
      <div className="hidden sm:block">
        <PageHeader
          eyebrow="Checkout recovery"
          title="Incomplete checkouts"
          phoneChrome="full"
          description={(
            <>
              Carts that reached checkout and stopped. Call the customer, record what happened, or
              place the order yourself — it arrives in COD review for confirmation.
              <span className="mt-2 flex items-center gap-2 text-caption">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${queueRows.length > 0 ? 'bg-amber-500' : 'bg-slate-300'}`}
                  aria-hidden="true"
                />
                {queueRows.length > 0
                  ? `${queueRows.length} waiting on a call · oldest ${ageLabel(oldestWaiting)}`
                  : 'Nothing is waiting on a call'}
              </span>
            </>
          )}
          action={(
            <Button variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh list
            </Button>
          )}
        />
      </div>

      <section className="mb-4 grid grid-cols-2 border-y border-[var(--bk-console-border)] lg:hidden" aria-label="Recovery summary">
        <div className="px-3 py-2.5">
          <span className="block text-label font-semibold text-[var(--bk-console-text-muted)]">To call</span>
          <strong className="mt-0.5 block text-[18px] font-bold tabular-nums text-[var(--bk-console-text)]">
            {storeCount('incomplete').toLocaleString()}
          </strong>
        </div>
        <div className="border-l border-[var(--bk-console-border)] px-3 py-2.5">
          <span className="block text-label font-semibold text-[var(--bk-console-text-muted)]">Value at stake</span>
          <strong className="mt-0.5 block text-[18px] font-bold tabular-nums text-[var(--bk-console-text)]">
            {stake || '৳0'}
          </strong>
        </div>
      </section>
      <div className="hidden lg:block">
        <MetricStrip items={metricItems} />
      </div>

      <Card flush padding="none">
        <Tabs
          tabs={tabs}
          activeId={filter}
          onChange={next => { setFilter(next); setPage(1); }}
          label="Checkout recovery views"
          idPrefix="checkouts-view"
          phoneLayout="scroll"
          className="px-3.5 max-sm:px-0 max-sm:[&>button]:!min-w-0 max-sm:[&>button]:!flex-1 max-sm:[&>button]:!justify-center max-sm:[&>button]:!px-1 max-sm:[&>button]:!text-[10px]"
        />

        <TabPanel idPrefix="checkouts-view" tabId={filter} activeId={filter}>
          {/* The list endpoint returns incomplete, contacted and recovered rows;
              `counts` is grouped over every status. So carts that are still at
              checkout are counted but not listed, and this is the only place that
              can say so without opening a filter onto an empty table. */}
          {stillAtCheckout > 0 && (
            <>
              <p className="flex items-center gap-2 border-b border-[var(--bk-console-border)] px-3.5 py-2.5 text-[11px] leading-snug text-[var(--bk-console-text-muted)] sm:hidden">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                {stillAtCheckout === 1
                  ? '1 active checkout · queues in ~5 min'
                  : `${stillAtCheckout} active checkouts · queue in ~5 min`}
              </p>
              <p className="hidden border-b border-indigo-100 bg-[var(--color-surface-selected)] px-3.5 py-3 text-caption font-semibold text-[var(--bk-console-text-body)] sm:block">
                {stillAtCheckout === 1
                  ? '1 cart is at checkout right now. It joins this queue after about five minutes without activity.'
                  : `${stillAtCheckout} carts are at checkout right now. They join this queue after about five minutes without activity.`}
              </p>
            </>
          )}

          <div className="flex items-center gap-2 border-b border-[var(--bk-console-border)] px-3.5 py-3">
            <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--bk-control-border)] bg-white px-2.5 focus-within:border-[var(--bk-console-blue)] focus-within:ring-2 focus-within:ring-[var(--bk-console-blue)] sm:h-[38px] sm:w-[min(420px,46%)] sm:flex-none">
              <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={event => { setSearch(event.target.value); setPage(1); }}
                /* 38 characters in a 160px box next to the phone Refresh button:
                   the prompt reached "Search name, phone, addre" and stopped, so
                   the reader never learns the field also matches products. The
                   phone gets the short form; the search itself is unchanged. */
                placeholder={isWide ? 'Search name, phone, address or product' : 'Search checkouts'}
                aria-label="Search incomplete checkouts"
                className="min-w-0 flex-1 border-0 bg-transparent text-label font-medium text-[var(--bk-console-text)] placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <Button
              variant="secondary"
              aria-label="Refresh checkouts"
              title="Refresh checkouts"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="w-11 shrink-0 px-0 sm:hidden"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
            <span className="ml-auto hidden text-label font-semibold text-[var(--bk-console-text-muted)] sm:block">
              {rows.length} of {items.length} shown
            </span>
          </div>

          {/* An ignored row leaves the default list and the portal has no ignored
              view, so this bar is the only route back. It does not time out. */}
          {undo && (
            <div className="flex flex-wrap items-center gap-2 border-b border-emerald-100 bg-emerald-50 px-3.5 py-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-caption font-semibold text-emerald-900">
                {undo.name} is now {STATUS_LABEL[undo.to]?.toLowerCase() || undo.to}
                {undo.to === 'ignored' ? ' and has left this list' : ''}.
              </p>
              {/* "Put back" re-posts the old status, so it only appears when the API
                  would accept that value as a target. */}
              {STATUS_CHOICES.includes(undo.from) && (
                <Button variant="ghost" size="sm" disabled={updatingId === undo.id} onClick={() => void revertUndo()}>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Put back as {STATUS_LABEL[undo.from]?.toLowerCase() || undo.from}
                </Button>
              )}
              <Button variant="icon" size="sm" aria-label="Dismiss this message" onClick={() => setUndo(null)}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}

          {pageRows.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title={items.length === 0 ? 'No incomplete checkouts yet' : 'No checkouts match this view'}
              description={items.length === 0
                ? 'A cart appears here once someone enters checkout details and then stops for about five minutes.'
                : 'Try another tab, or clear the search.'}
              action={items.length > 0 && (search || filter !== 'all')
                ? (
                  <Button variant="secondary" onClick={() => { setSearch(''); setFilter('all'); setPage(1); }}>
                    Clear filters
                  </Button>
                )
                : undefined}
            />
          ) : (
            <>
              {/* Six columns are pinned to their own longest real value; **Customer
                  alone is left bare** and that is the whole fix for the empty strip
                  the panel used to show on its right edge.

                  `table-fixed` + `w-full` means the browser has to place the surplus
                  between `min-w-[1122px]` and the panel's real width (up to 1540px on
                  `.bk-console-page`). When every `<col>` carries a width it spreads
                  that surplus proportionally over all of them, so each cell grew a
                  little padding and the row's last real content stopped well short of
                  the border — read as a hole. One auto column swallows the surplus
                  instead, and Customer is the honest place for it: name, phone and a
                  Dhaka address are what actually want the room, and they truncate. The
                  six pinned widths sum to 902, so `min-w` is that plus a 220px floor
                  for Customer — enough for a name and an 11-digit phone. Keeping it
                  there matters: on a 1440px laptop the panel is 1136px wide, and a
                  floor of 262 would have pushed the table 28px past it and hung a
                  horizontal scrollbar under a table that has room to spare. Below md
                  the same facts stack as cards. */}
              <div className="hidden overflow-x-auto min-[1360px]:block">
                <table className="w-full min-w-[1122px] table-fixed border-collapse">
                  <colgroup>
                    <col />
                    <col className="w-[188px]" />
                    <col className="w-[104px]" />
                    <col className="w-[112px]" />
                    <col className="w-[128px]" />
                    <col className="w-[154px]" />
                    {/* Call + Create order at full button height, side by side. */}
                    <col className="w-[216px]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-[var(--bk-console-border)] bg-[var(--color-table-head)]">
                      <TableHeaderCell className="text-caption">Customer</TableHeaderCell>
                      <TableHeaderCell className="text-caption">Cart</TableHeaderCell>
                      <TableHeaderCell className="text-caption" align="right">Value</TableHeaderCell>
                      <TableHeaderCell className="text-caption">Source</TableHeaderCell>
                      <TableHeaderCell className="text-caption">Last seen</TableHeaderCell>
                      <TableHeaderCell className="text-caption">Status</TableHeaderCell>
                      <TableHeaderCell className="text-caption">Actions</TableHeaderCell>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(item => {
                      const name = realText(item.customerName);
                      const phone = realText(item.phone);
                      const address = realText(item.address);
                      const cart = productLine(item);
                      const origin = sourceLine(item);
                      const busy = updatingId === item.id;
                      const note = item.orderId ? orderNote(item.orderId) : null;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-[var(--bk-console-border)] align-middle transition-colors last:border-b-0 hover:bg-[var(--color-row-hover)]"
                        >
                          <td className="px-3 py-3.5">
                            <strong
                              className="block truncate text-[12px] font-semibold leading-[1.35] text-[var(--bk-console-text)]"
                              title={name || undefined}
                            >
                              {name || 'Name not shared'}
                            </strong>
                            {phone ? (
                              <button
                                type="button"
                                onClick={() => copyPhone(phone)}
                                aria-label={`Copy ${phone}`}
                                title="Copy phone number"
                                className="group/phone mt-1 flex max-w-full items-center gap-1 leading-[1.35] text-[var(--bk-console-text-muted)] hover:text-[var(--bk-console-blue)]"
                              >
                                <span className="truncate font-mono text-[11px]">{phone}</span>
                                <Copy
                                  className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover/phone:opacity-100"
                                  aria-hidden="true"
                                />
                              </button>
                            ) : (
                              <span className="mt-1 block text-[11px] leading-[1.35] text-[var(--bk-console-text-subtle)]">
                                No phone shared
                              </span>
                            )}
                            {/* One line, always. A Dhaka address is long enough to
                                double the row height if it wraps, so the full text
                                lives in the tooltip. */}
                            <span
                              className="mt-1 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]"
                              title={address || undefined}
                            >
                              {address || 'No address shared'}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            {/* `sm` (32px), not the Orders table's `md` (44px):
                                Cart is pinned at 188px because Customer must keep
                                the surplus, and a 44px thumb would leave the
                                product name about 110px to live in. */}
                            <div className="flex items-center gap-2.5">
                              <ProductThumb src={cart.image} name={cart.name} size="sm" />
                              <span className="min-w-0">
                                <strong
                                  className="block truncate text-[12px] font-semibold leading-[1.35] text-[var(--bk-console-text)]"
                                  title={cart.name}
                                >
                                  {cart.name}
                                </strong>
                                <span className="mt-1 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]">
                                  {cart.meta}
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3.5 text-right">
                            <strong className="block text-[13px] font-extrabold leading-[1.35] tabular-nums text-[var(--bk-console-text)]">
                              {money(item.amount, item.currency)}
                            </strong>
                          </td>
                          <td className="px-3 py-3.5">
                            <strong
                              className="block truncate text-[12px] font-semibold capitalize leading-[1.35] text-[var(--bk-console-text)]"
                              title={origin.source}
                            >
                              {origin.source}
                            </strong>
                            <span
                              className="mt-1 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]"
                              title={origin.detail}
                            >
                              {origin.detail}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <strong className="block text-[12px] font-semibold leading-[1.35] text-[var(--bk-console-text)]">
                              {ageLabel(item.lastActivityAt) || '—'}
                            </strong>
                            <span className="mt-1 block text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]">
                              {shortMoment(item.lastActivityAt)}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            {EDITABLE_FROM.includes(item.status) ? (
                              <select
                                value={item.status}
                                disabled={busy}
                                aria-label={`Recovery status for ${name || `checkout ${item.id}`}`}
                                onChange={event => pickStatus(item, event.target.value)}
                                className="h-[34px] w-full cursor-pointer rounded-[var(--bk-radius-control)] border border-[var(--bk-control-border)] bg-white px-1.5 text-label font-extrabold text-[var(--bk-console-text)] focus:border-[var(--bk-console-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--bk-console-blue)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {STATUS_CHOICES.map(status => (
                                  <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                                ))}
                              </select>
                            ) : (
                              <Status
                                value={STATUS_LABEL[item.status] || item.status}
                                tone={STATUS_TONE[item.status] || 'neutral'}
                                dot
                              />
                            )}
                            {note && (
                              <span
                                className="mt-1.5 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]"
                                title={note.hint}
                              >
                                {note.text}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-2">
                              {phone && (
                                <a href={`tel:+${normalizePhone(phone)}`} className={CALL_LINK} title={`Call ${phone}`}>
                                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                                  Call
                                </a>
                              )}
                              {/* Full-size, not `sm`. Calling the customer and writing
                                  the order are the only two things this page exists to
                                  do, so they get the row's full button height and the
                                  12px label — at 11px in tight padding they read as
                                  captions rather than the actions they are. */}
                              {CONVERTIBLE.includes(item.status) ? (
                                <Button
                                  variant="primary"
                                  disabled={busy}
                                  className="whitespace-nowrap text-caption font-extrabold"
                                  onClick={() => onOpenCreateOrder(item)}
                                >
                                  Create order
                                </Button>
                              ) : item.orderId ? (
                                <Badge tone="success">Order created</Badge>
                              ) : (
                                <span className="text-[11px] text-[var(--bk-console-text-subtle)]">
                                  Nothing to do
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* One card per checkout below 1360px: the same facts in the same reading
                  order, with the status control and both actions at full width. */}
              <div className="grid gap-2.5 px-3.5 py-3 min-[1360px]:hidden">
                {pageRows.map(item => {
                  const name = realText(item.customerName);
                  const phone = realText(item.phone);
                  const address = realText(item.address);
                  const cart = productLine(item);
                  const origin = sourceLine(item);
                  const busy = updatingId === item.id;
                  const note = item.orderId ? orderNote(item.orderId) : null;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-[7px] border border-[var(--bk-panel-border)] border-l-[3px] bg-white p-3.5 shadow-[0_1px_3px_rgba(25,39,51,.04)] ${RAIL[item.status] || 'border-l-slate-300'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <strong className="block truncate text-[13px] font-semibold text-[var(--bk-console-text)]">
                            {name || 'Name not shared'}
                          </strong>
                          {phone && (
                            <button
                              type="button"
                              onClick={() => copyPhone(phone)}
                              aria-label={`Copy ${phone}`}
                              /* 16px of ink, 44px of target. The phone number has
                                 to stay a quiet second line under the name, so the
                                 height comes from an `::after` halo instead of
                                 padding: -14px on the y axis only, because the
                                 number is already 108px wide. The halo reaches over
                                 the name above and the address below, and neither
                                 is clickable, so nothing loses a tap to it. */
                              className="relative mt-0.5 flex max-w-full items-center gap-1 font-mono text-[11px] text-[var(--bk-console-text-muted)] after:absolute after:inset-x-0 after:-inset-y-3.5 after:content-['']"
                            >
                              <span className="truncate">{phone}</span>
                              <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                        <strong className="shrink-0 text-[14px] font-extrabold tabular-nums text-[var(--bk-console-text)]">
                          {money(item.amount, item.currency)}
                        </strong>
                      </div>
                      <p className="mt-2 truncate text-[11px] text-[var(--bk-console-text-muted)]" title={address || undefined}>
                        {address || 'No address shared'}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <ProductThumb src={cart.image} name={cart.name} size="sm" />
                        <p className="min-w-0 truncate text-[11px] text-[var(--bk-console-text-muted)]">
                          {cart.name} · {cart.meta}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-[var(--bk-console-text-subtle)]">
                        <span className="capitalize">{origin.source}</span> · {ageLabel(item.lastActivityAt)} · {shortMoment(item.lastActivityAt)}
                      </p>
                      <div className="mt-2.5 flex items-center gap-2 border-t border-[var(--color-cell-line)] pt-2.5">
                        {EDITABLE_FROM.includes(item.status) ? (
                          <select
                            value={item.status}
                            disabled={busy}
                            aria-label={`Recovery status for ${name || `checkout ${item.id}`}`}
                            onChange={event => pickStatus(item, event.target.value)}
                            className="h-11 min-w-0 flex-1 cursor-pointer rounded-[var(--bk-radius-control)] border border-[var(--bk-control-border)] bg-white px-2 text-label font-extrabold text-[var(--bk-console-text)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {STATUS_CHOICES.map(status => (
                              <option key={status} value={status}>{STATUS_LABEL[status]}</option>
                            ))}
                          </select>
                        ) : (
                          <Status
                            value={STATUS_LABEL[item.status] || item.status}
                            tone={STATUS_TONE[item.status] || 'neutral'}
                            dot
                          />
                        )}
                        {phone && (
                          <a href={`tel:+${normalizePhone(phone)}`} className={CALL_LINK} title={`Call ${phone}`}>
                            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                            Call
                          </a>
                        )}
                      </div>
                      {CONVERTIBLE.includes(item.status) && (
                        <Button
                          variant="primary"
                          disabled={busy}
                          className="mt-2 w-full text-caption font-extrabold"
                          onClick={() => onOpenCreateOrder(item)}
                        >
                          Create order
                        </Button>
                      )}
                      {note && (
                        <p className="mt-2 text-[11px] text-[var(--bk-console-text-muted)]" title={note.hint}>
                          {note.text}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="border-t border-[var(--bk-console-border)] px-3.5 py-2.5 text-[11px] leading-relaxed text-[var(--bk-console-text-subtle)]">
                Checkout details are kept for 30 days, then removed automatically.
                {truncated ? ` Showing the newest ${items.length} of ${totalCount}.` : ''}
              </p>

              <PaginationControls
                page={safePage}
                pageSize={CHECKOUTS_PAGE_SIZE}
                total={rows.length}
                onPageChange={setPage}
                noun="checkouts"
              />
            </>
          )}
        </TabPanel>
      </Card>

      {ignoreTarget && (
        <ConfirmDialog
          onClose={() => setIgnoreTarget(null)}
          title={`Ignore ${realText(ignoreTarget.customerName) || `checkout ${ignoreTarget.id}`}?`}
          actions={(
            <>
              <Button variant="secondary" onClick={() => setIgnoreTarget(null)}>Keep in queue</Button>
              <Button variant="danger" onClick={confirmIgnore}>Ignore checkout</Button>
            </>
          )}
        >
          The row leaves this list straight away. Undo puts it back, but only while you stay on this
          page — the portal has no view of ignored checkouts.
        </ConfirmDialog>
      )}

      {recoverTarget && (
        <ConfirmDialog
          onClose={() => setRecoverTarget(null)}
          title={`Mark ${realText(recoverTarget.customerName) || `checkout ${recoverTarget.id}`} recovered?`}
          actions={(
            <>
              <Button variant="secondary" onClick={() => setRecoverTarget(null)}>Keep working on it</Button>
              <Button variant="primary" onClick={confirmRecovered}>Mark recovered</Button>
            </>
          )}
        >
          Use this when the customer paid outside your store — bKash, WhatsApp, over the phone. The
          cart moves to Recovered and counts towards your recovery total. It cannot be changed back,
          and it does not create an order; use Create order for that.
        </ConfirmDialog>
      )}
    </div>
  );
}
