/**
 * COD review: the queue of cash-on-delivery orders whose Purchase event is being
 * held back until a human decides.
 *
 * This is the prototype's `CodReview` information architecture rebuilt on the
 * live portal's primitives. It is a presentation layer only — no fetch, no
 * mutation, no API import. Every action still dispatches through the handler
 * App.tsx already owns, so the same endpoints are called in the same order as
 * before this redesign.
 *
 * The page has exactly one job: release a tracked event, or withhold it. So the
 * Decision column states that consequence once, in its own header, instead of
 * repeating it on every row — and the row leads with the two facts a hold is
 * decided on: how risky the buyer looks, and how long the order has waited.
 *
 * That one job is also why the row is deliberately short. Everything an order
 * carries that belongs to *fulfilling* it — the delivery address, the product
 * photo, the variant, the item count — lives on the Orders page, which is where
 * a merchant packs and ships. Here it only competed with the decision. What is
 * left is what the decision is actually made on: who is buying, for how much,
 * what the courier history says, and how long it has waited.
 *
 * Deliberate omission from the prototype: its "Recent decisions" audit panel.
 * No endpoint lists already-decided orders, and inventing rows for a client is
 * worse than leaving the panel out. The lifetime confirmed / skipped totals
 * under the table are real (`confirmedTotal` / `cancelledTotal`), so the honest
 * part of that idea survives.
 */
import React, { Fragment, useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock3, Loader2, Search, Settings2, ShieldCheck, X } from 'lucide-react';
import type { DeferredData, DeferredOrder } from '../types';
import {
  Button, Card, Drawer, EmptyState, MetricStrip, PageHeader, PaginationControls, Select,
  TableHeaderCell, type MetricStripItem,
} from './common';
import { CourierDetailPanel, FraudRiskCell } from './CourierFraudDetail';
import { getFraudVerdictKey, hasCourierData } from './FraudVerdictBadge';
import { LOCKED_FEATURE_MINIMUM_PLAN } from './LockedFeatureModal';

/** One screen of held orders. Matches the prototype's COD table page size. */
const COD_PAGE_SIZE = 20;

interface CodProtectionViewProps {
  deferredData: DeferredData;
  selectedOrderIds: string[];
  setSelectedOrderIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleBulkConfirm: () => Promise<void>;
  handleBulkCancel: () => Promise<void>;
  handleConfirmOrder: (orderId: string) => Promise<void>;
  handleCancelOrder: (orderId: string) => Promise<void>;
  /** Runs the on-demand RedX/Pathao lookup for one order. */
  handleCourierCheck: (order: DeferredOrder) => Promise<void>;
  /** Pending-event IDs with a courier lookup currently in flight. */
  courierCheckBusyIds: number[];
  /** Order IDs with a confirm/skip request currently in flight. */
  codBusyOrderIds: string[];
  /** True while a bulk confirm/skip request is in flight. */
  codBulkBusy: boolean;
  deferredEnabled: boolean;
  setDeferredEnabled: (val: boolean) => void;
  autoConfirmDays: number;
  setAutoConfirmDays: (val: number) => void;
  autoConfirmStatus: string;
  setAutoConfirmStatus: (val: string) => void;
  courierAutoCheck: boolean;
  setCourierAutoCheck: (val: boolean) => void;
  savingDeferredSettings: boolean;
  handleSaveDeferredSettings: () => Promise<void>;
  growthFeaturesEnabled?: boolean;
}
function formatHeldTime(rawHours: number | string | undefined) {
  const hours = typeof rawHours === 'number'
    ? rawHours
    : Number.parseFloat(String(rawHours || '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(hours) || hours < 0) return 'N/A';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.floor(hours)} hr${Math.floor(hours) === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

/**
 * Name and phone, pulled from whichever field spelling the store sent. Hashed
 * values are never printed: an order whose PII was hashed for the ad platforms
 * would otherwise show a 32-character digest as the "name".
 *
 * No address: this page decides an event, not a delivery. The full address is on
 * the Orders page, where it is used.
 */
function customerDetails(order: DeferredOrder) {
  const isHash = (value: string) => /^[a-f0-9]{32,}$/i.test(value);
  const name = String(
    order.customerName || order.customer_name || order.recipientName ||
    order.recipient_name || order.name || order.customer || '',
  ).trim();
  const phone = String(
    order.customerPhone || order.customer_phone || order.recipientPhone ||
    order.recipient_phone || order.phone || '',
  ).trim();
  return {
    name: !name || isHash(name) ? 'Protected customer' : name,
    phone: isHash(phone) ? '' : phone,
  };
}

function currency(value: number | string | undefined) {
  if (typeof value === 'string' && /bdt/i.test(value)) return value;
  return `BDT ${(Number(value) || 0).toLocaleString()}`;
}

const shortStamp = (iso?: string) => {
  const parsed = Date.parse(iso || '');
  if (!Number.isFinite(parsed)) return '';
  return new Date(parsed).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};
/**
 * The prototype's `.fraud-reason`: the one fact behind the badge, in the words a
 * merchant would use. Every branch reads a value the API actually sent, and an
 * order nobody has checked yet gets no line at all rather than an invented one.
 */
function fraudReason(order: DeferredOrder): string {
  const details = order.fraudDetails;
  if (!details) return '';
  if (details.velocity_limit) return 'Several orders from this number just now';
  if (details.gibberish_name) return 'The name does not look real';
  if (details.disposable_email) return 'Throwaway email address';
  const summary = details.courier_summary;
  if (summary) {
    const total = Number(summary.total_orders) || 0;
    const cancelled = Number(summary.total_cancelled) || 0;
    if (total > 0 && cancelled > 0) return `Refused ${cancelled} of ${total} past parcels`;
    if (total > 0) return `${total} past parcel${total === 1 ? '' : 's'}, none refused`;
    return 'No delivery history at RedX or Pathao';
  }
  if (details.ip_mismatch) return 'Ordered from outside the delivery area';
  return '';
}

/**
 * The same switch the WhatsApp and Event activity settings already use, with two
 * things the prototype does and they do not.
 *
 * The "on" fill is `indigo-600`, which this portal remaps to the prototype's own
 * accent — the same token the checkboxes in the table above already paint with
 * via `accent-indigo-600`. `emerald-600` resolves to a lighter, separate green
 * that reads as a second brand colour beside them.
 *
 * `btn-touch-expand` is the prototype's `.toggle::after` rule: a 44px hit area
 * grown around a switch that stays 44×24 of ink, so a thumb has the full target
 * without the row growing. The prototype scopes that to phones; here it costs
 * nothing at any width, because the switch sits alone at the end of a 76px row.
 */
function ToggleSwitch({ checked, disabled, onChange, label }: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`btn-touch-expand relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-slate-200'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

/** The prototype's `.setting-row`: what the switch does, then the switch. */
function SettingRow({ title, detail, control }: {
  title: string;
  detail: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-cell-line)] px-5 py-4">
      <span className="min-w-0">
        <strong className="block text-caption font-semibold text-[var(--bk-console-text)]">{title}</strong>
        <small className="mt-1 block text-[11px] leading-[1.45] text-[var(--bk-console-text-muted)]">{detail}</small>
      </span>
      {control}
    </div>
  );
}
export function CodProtectionView({
  deferredData,
  selectedOrderIds,
  setSelectedOrderIds,
  handleBulkConfirm,
  handleBulkCancel,
  handleConfirmOrder,
  handleCancelOrder,
  handleCourierCheck,
  courierCheckBusyIds,
  codBusyOrderIds,
  codBulkBusy,
  deferredEnabled,
  setDeferredEnabled,
  autoConfirmDays,
  setAutoConfirmDays,
  autoConfirmStatus,
  setAutoConfirmStatus,
  courierAutoCheck,
  setCourierAutoCheck,
  savingDeferredSettings,
  handleSaveDeferredSettings,
  growthFeaturesEnabled,
}: CodProtectionViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  const pendingList = (deferredData?.deferredPendingList || deferredData?.pendingList || [])
    .filter(order => !order.operationsOnly);
  const pendingCount = deferredData?.deferredPendingCount ?? deferredData?.pendingCount ?? pendingList.length;
  const pendingValueRaw = deferredData?.deferredPendingValue ?? deferredData?.pendingValue;
  const pendingValueNumber = typeof pendingValueRaw === 'number'
    ? pendingValueRaw
    : Number.parseFloat(String(pendingValueRaw || '').replace(/[^\d.]/g, ''));
  const pendingValue = Number.isFinite(pendingValueNumber) && pendingValueNumber > 0
    ? currency(pendingValueNumber)
    : currency(pendingList.reduce((sum, order) => sum + (Number(order.amount) || 0), 0));
  const confirmedTotal = deferredData?.confirmedTotal ?? 0;
  const cancelledTotal = deferredData?.cancelledTotal ?? 0;
  const highRiskCount = pendingList.filter(
    order => getFraudVerdictKey(order.fraudDetails, order.fraudScore) === 'HIGH_RISK',
  ).length;
  const checkedCount = pendingList.filter(order => hasCourierData(order.fraudDetails)).length;
  /**
   * Newest first, and no control to change it: a queue this page can clear in one
   * pass does not need a sort, and the age is on every row for the merchant who
   * wants the oldest.
   */
  const visibleOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matched = query
      ? pendingList.filter(order => {
          const customer = customerDetails(order);
          return [
            order.orderId,
            customer.name,
            customer.phone,
            ...(order.products || []).map(product => product?.name || product?.content_name || ''),
          ].join(' ').toLowerCase().includes(query);
        })
      : pendingList;
    const stamp = (order: DeferredOrder) => Date.parse(order.orderOccurredAt || order.timestamp || '') || 0;
    const idNumber = (order: DeferredOrder) => Number.parseInt(String(order.orderId).replace(/\D/g, ''), 10) || 0;
    return [...matched].sort((a, b) => -((stamp(a) - stamp(b)) || (idNumber(a) - idNumber(b))));
  }, [pendingList, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(visibleOrders.length / COD_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pageRows = visibleOrders.slice((safePage - 1) * COD_PAGE_SIZE, safePage * COD_PAGE_SIZE);
  const pageIds = pageRows.map(order => order.orderId);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedOrderIds.includes(id));

  const toggleOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds(current => (checked
      ? (current.includes(orderId) ? current : current.concat(orderId))
      : current.filter(id => id !== orderId)));
  };
  const togglePage = () => {
    setSelectedOrderIds(current => (allPageSelected
      ? current.filter(id => !pageIds.includes(id))
      : current.concat(pageIds.filter(id => !current.includes(id)))));
  };

  const settingsSummary = `Auto-confirm: ${
    autoConfirmDays === 0 ? 'Off — manual only' : `After ${autoConfirmDays} day${autoConfirmDays === 1 ? '' : 's'}`
  } · Confirm status: ${autoConfirmStatus === 'processing' ? 'Processing / Confirmed' : 'Completed / Delivered'}`;

  const reviewedTotal = confirmedTotal + cancelledTotal;
  const skipShare = reviewedTotal > 0 ? Math.round((cancelledTotal / reviewedTotal) * 100) : null;
  /**
   * Two numbers, both about the events waiting on a decision: how many there are
   * with the money they hold, and how many of them look unsafe to release.
   *
   * "Oldest in review" and "Confirmed today" were here too. They went because the
   * auto-confirm rule is already stated under the page title, every row shows its
   * own age, and the all-time confirmed / skipped line sits under the table.
   */
  const metricItems: MetricStripItem[] = [
    {
      label: 'Waiting for review',
      shortLabel: 'Waiting',
      value: pendingCount.toLocaleString(),
      hint: `${pendingValue} held`,
      icon: <Clock3 className="h-4 w-4" aria-hidden="true" />,
    },
    {
      label: 'Flagged high risk',
      shortLabel: 'High risk',
      value: highRiskCount.toLocaleString(),
      hint: pendingList.length === 0
        ? 'Nothing to check'
        : checkedCount >= pendingList.length
          ? 'Courier check run on all of them'
          : `Courier check run on ${checkedCount} of ${pendingList.length}`,
      icon: <AlertTriangle className="h-4 w-4" aria-hidden="true" />,
    },
  ];

  const rowsBusy = codBulkBusy;
  const selectedCount = selectedOrderIds.length;
  return (
    <div id="cod-review">
      <PageHeader
        eyebrow="COD protection"
        title="COD review"
        description={(
          <>
            Every cash-on-delivery order waits here until you decide. Confirm to send its Purchase
            event to your ad platforms, or skip to keep it unsent.
            <span className="mt-2 flex items-center gap-2 text-caption">
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${deferredEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
              />
              {deferredEnabled ? settingsSummary : 'Protection is off — COD purchases are sent as soon as they are placed.'}
            </span>
          </>
        )}
        action={(
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Review settings
          </Button>
        )}
      />

      <MetricStrip items={metricItems} className="mb-5" />

      <Card padding="none" flush>
        {/* Search only. The sort control went with the extra columns: this list is
            newest-first, and the wait on each row is what a merchant sorts by in
            their head anyway. */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[var(--bk-console-border)] px-3.5 py-3">
          {/* 44px on a phone, the prototype's 38px field from md up — the same
              boundary `.bk-touch-44` uses. The `<label>` wraps the input, so the
              whole box forwards the tap. */}
          <label className="flex h-11 w-full min-w-0 items-center gap-2 rounded-md border border-[var(--bk-control-border)] bg-white px-2.5 focus-within:border-[var(--bk-console-blue)] focus-within:ring-2 focus-within:ring-[var(--bk-console-blue)] md:h-[38px] sm:w-[min(420px,44%)]">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={event => { setSearchQuery(event.target.value); setPage(1); }}
              placeholder="Search order, customer or phone"
              aria-label="Search the orders waiting for review"
              className="min-w-0 flex-1 border-0 bg-transparent text-label font-medium text-[var(--bk-console-text)] placeholder:text-slate-400 focus:outline-none"
            />
          </label>
        </div>

        {/* Bulk actions live in the selection bar, not the toolbar: a Confirm
            button that is permanently visible but only works after a tick reads
            as broken, and this is the shape Orders already uses. */}
        {selectedCount > 0 && (
          <div className="bk-touch-44 flex min-h-[46px] flex-wrap items-center gap-[9px] bg-[var(--bk-selection-bar)] px-3.5 py-[7px] text-[var(--bk-selection-bar-ink)]">
            <span className="text-body font-bold">{selectedCount} selected</span>
            <span aria-hidden="true" className="hidden h-[22px] w-px bg-white/20 sm:block" />
            <button
              type="button"
              disabled={rowsBusy}
              onClick={() => { void handleBulkConfirm(); }}
              className="inline-flex min-h-[31px] cursor-pointer items-center gap-1.5 rounded-[5px] border border-white/16 bg-white/8 px-[9px] text-label font-bold transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/70 disabled:hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {rowsBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
              Confirm purchases
            </button>
            <button
              type="button"
              disabled={rowsBusy}
              onClick={() => { void handleBulkCancel(); }}
              className="inline-flex min-h-[31px] cursor-pointer items-center gap-1.5 rounded-[5px] border border-white/16 bg-white/8 px-[9px] text-label font-bold transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/70 disabled:hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              Skip selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedOrderIds([])}
              className="ml-auto inline-flex min-h-[31px] cursor-pointer items-center rounded-[5px] px-2 text-label font-bold text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Clear
            </button>
          </div>
        )}
        {visibleOrders.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={searchQuery.trim() ? 'No held order matches that search' : 'No orders are waiting for review'}
            description={searchQuery.trim()
              ? 'Search by order number, customer name or phone.'
              : 'Every cash-on-delivery order has been decided. New ones appear here as they come in.'}
            action={searchQuery.trim()
              ? <Button variant="secondary" size="sm" onClick={() => { setSearchQuery(''); setPage(1); }}>Clear search</Button>
              : undefined}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              {/* Five columns, each sized to its longest real value. The table lost
                  ~190px of width with the product and address, so on a normal
                  laptop the decision buttons now sit on screen without scrolling. */}
              <table className="w-full min-w-[942px] table-fixed border-collapse">
                <colgroup>
                  <col className="w-[42px]" />
                  <col className="w-[196px]" />
                  <col className="w-[184px]" />
                  <col className="w-[200px]" />
                  <col className="w-[110px]" />
                  <col className="w-[210px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--bk-console-border)] bg-[var(--color-table-head)]">
                    <th scope="col" className="px-3.5 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={togglePage}
                        aria-label="Select every order on this page"
                        /* 16px of ink, 46px of target. `btn-touch-expand` is
                           sized for a 24px control — Tooltip's info button,
                           where its flat -10px lands on exactly 44 — so on a
                           16px box it stops at 36 and the helper's own comment
                           overstates what it does here. Hence a halo of its own.
                           15px is the largest even growth this cell can hold:
                           the header gives the box 15.7px of slack above and
                           21.2 below, so the halo stays inside the cell it
                           belongs to, and 46 clears the rule without sitting on
                           the floor. */
                        className="relative h-4 w-4 cursor-pointer accent-indigo-600 before:absolute before:-inset-[15px] before:content-['']"
                      />
                    </th>
                    <TableHeaderCell className="text-caption">Order</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Customer</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Fraud check</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Waiting</TableHeaderCell>
                    <TableHeaderCell className="align-top text-caption">
                      Decision
                      <span className="mt-1.5 block max-w-[186px] text-[10.5px] font-semibold normal-case leading-[1.35] tracking-normal text-[var(--bk-console-text-subtle)]">
                        Confirm sends the event · Skip keeps it unsent
                      </span>
                    </TableHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(order => {
                    const customer = customerDetails(order);
                    const product = order.products?.[0];
                    const extraItems = Math.max(0, (order.products?.length || 0) - 1);
                    const productName = product?.name || product?.content_name || '';
                    const selected = selectedOrderIds.includes(order.orderId);
                    const courierSummary = order.fraudDetails?.courier_summary;
                    const courierOpen = expandedOrderId === order.orderId;
                    const courierBusy = courierCheckBusyIds.includes(Number(order.id));
                    const busy = codBusyOrderIds.includes(order.orderId);
                    const reason = fraudReason(order);
                    const verdict = getFraudVerdictKey(order.fraudDetails, order.fraudScore);
                    // The left rail is the only place risk is repeated, and it is
                    // there so a dangerous row is findable while scrolling.
                    const rail = verdict === 'HIGH_RISK'
                      ? 'border-l-rose-500'
                      : verdict === 'RISKY' ? 'border-l-amber-400' : 'border-l-transparent';
                    return (
                      <Fragment key={order.orderId}>
                        <tr
                          className={`border-b border-[var(--bk-console-border)] align-middle transition-colors ${
                            selected ? 'bg-[var(--color-surface-selected)]' : 'hover:bg-[var(--color-row-hover)]'
                          }`}
                        >
                          <td className={`box-border border-l-[3px] px-3.5 py-3.5 ${rail}`}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={event => toggleOrder(order.orderId, event.target.checked)}
                              aria-label={`Select order ${order.orderId}`}
                              /* Same 15px halo as the header box above. A row is
                                 85px tall here and the box is centred in it, so
                                 32px of slack sits above and below — two rows'
                                 halos cannot meet, and the 3px that spills past
                                 the cell on the right lands in the Order
                                 column's padding, which is not a target. */
                              className="relative h-4 w-4 cursor-pointer accent-indigo-600 before:absolute before:-inset-[15px] before:content-['']"
                            />
                          </td>
                          {/* Order number, then the money the decision is about,
                              then what was bought as one plain line. The product
                              is named but not pictured: the photo belongs on the
                              Orders page, where the parcel is packed. */}
                          <td className="px-3 py-3.5">
                            <span className="block font-mono text-[11px] font-medium tracking-[0.01em] text-[var(--bk-console-blue)]">
                              #{order.orderId}
                            </span>
                            <strong className="mt-1 block text-[13px] font-extrabold leading-[1.3] tabular-nums text-[var(--bk-console-text)]">
                              {currency(order.amount)}
                            </strong>
                            <span
                              className="mt-1 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]"
                              title={productName || undefined}
                            >
                              {productName || 'Product not listed'}
                              {extraItems > 0 ? ` · +${extraItems} more` : ''}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <strong className="block truncate text-[12px] font-semibold leading-[1.35] text-[var(--bk-console-text)]" title={customer.name}>
                              {customer.name}
                            </strong>
                            {customer.phone ? (
                              <span className="mt-1 block font-mono text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]">{customer.phone}</span>
                            ) : (
                              <span className="mt-1 block text-[11px] leading-[1.35] text-[var(--bk-console-text-subtle)]">Phone hidden</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <FraudRiskCell
                              order={order}
                              expanded={courierOpen}
                              onToggle={() => setExpandedOrderId(courierOpen ? null : order.orderId)}
                              onCheck={() => { void handleCourierCheck(order); }}
                              busy={courierBusy}
                            />
                            {/* The prototype's .fraud-reason: the badge says how
                                bad, this says why, so the merchant is not left
                                guessing what a colour means. */}
                            {reason && (
                              <span className="mt-1.5 block text-[11px] leading-[1.3] text-amber-700">
                                {courierBusy ? 'Re-running the check…' : reason}
                              </span>
                            )}
                          </td>
                          {/* The header says "Waiting", so the wait leads and the
                              placed-at date sits under it: a hold needs the age
                              to act on and the date to trust it. */}
                          <td className="px-3 py-3.5">
                            <strong className="block text-[13px] font-semibold leading-[1.3] text-[var(--bk-console-text)]">
                              {formatHeldTime(order.ageHours)}
                            </strong>
                            <span className="mt-1 block text-[11px] leading-[1.3] text-[var(--bk-console-text-muted)]">
                              {shortStamp(order.orderOccurredAt || order.timestamp) || 'in review'}
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <Button
                                variant="primary"
                                size="sm"
                                loading={busy}
                                onClick={() => { void handleConfirmOrder(order.orderId); }}
                              >
                                {busy
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                  : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                                Confirm
                              </Button>
                              {/* Skip is the other half of the decision, so it has
                                  to look like a button too. `ghost` drew it as bare
                                  text next to a solid Confirm, which read as "there
                                  is no skip". `danger` is the pale-red treatment:
                                  visibly the destructive choice, and this one is
                                  undoable from the toast it raises. */}
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={busy}
                                onClick={() => { void handleCancelOrder(order.orderId); }}
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                Skip
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {courierOpen && courierSummary && (
                          <tr className={selected ? 'bg-[var(--color-surface-selected)]' : 'bg-[var(--color-row-hover)]'}>
                            <td colSpan={6} className="px-3.5 pb-3.5">
                              <CourierDetailPanel
                                summary={courierSummary}
                                onRecheck={() => { void handleCourierCheck(order); }}
                                busy={courierBusy}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* One card per order below md. Same facts, stacked in the same
                reading order, with the decision buttons at full width. */}
            <div className="grid gap-2.5 px-3 py-3 md:hidden">
              {pageRows.map(order => {
                const customer = customerDetails(order);
                const product = order.products?.[0];
                const extraItems = Math.max(0, (order.products?.length || 0) - 1);
                const productName = product?.name || product?.content_name || '';
                const selected = selectedOrderIds.includes(order.orderId);
                const courierSummary = order.fraudDetails?.courier_summary;
                const courierOpen = expandedOrderId === order.orderId;
                const courierBusy = courierCheckBusyIds.includes(Number(order.id));
                const busy = codBusyOrderIds.includes(order.orderId);
                const reason = fraudReason(order);
                const verdict = getFraudVerdictKey(order.fraudDetails, order.fraudScore);
                const rail = verdict === 'HIGH_RISK'
                  ? 'border-l-rose-500'
                  : verdict === 'RISKY' ? 'border-l-amber-400' : 'border-l-transparent';
                return (
                  <article
                    key={order.orderId}
                    className={`rounded-[7px] border border-[var(--bk-panel-border)] border-l-[3px] bg-white p-3.5 shadow-[0_1px_3px_rgba(25,39,51,.04)] ${rail} ${
                      selected ? 'bg-[var(--color-surface-selected)]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* `cursor-pointer` on the label, not only on the box
                          inside it: the label is what makes this a 122×70
                          target, so the 106px of it that is text was showing an
                          arrow or an I-beam and reading as unclickable. Same
                          pairing as the "Failed only" filter pill on API logs. */}
                      <label className="flex min-w-0 cursor-pointer items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={event => toggleOrder(order.orderId, event.target.checked)}
                          aria-label={`Select order ${order.orderId}`}
                          /* `btn-touch-expand` for the same reason as the table
                             row's box above: 16px of ink is 36px of hit area.
                             The label around it forwards the tap as well, so the
                             order number and the customer's name select the row
                             too — the 16px square is the smallest way in, not the
                             only one. */
                          className="btn-touch-expand mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-indigo-600"
                        />
                        <span className="min-w-0">
                          <span className="block font-mono text-[11px] font-medium tracking-[0.01em] text-[var(--bk-console-blue)]">#{order.orderId}</span>
                          <strong className="mt-1 block truncate text-[12px] font-semibold leading-[1.35] text-[var(--bk-console-text)]">{customer.name}</strong>
                          {customer.phone && (
                            <span className="mt-0.5 block font-mono text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]">{customer.phone}</span>
                          )}
                          <span className="mt-0.5 block truncate text-[11px] leading-[1.35] text-[var(--bk-console-text-muted)]" title={productName || undefined}>
                            {productName || 'Product not listed'}
                            {extraItems > 0 ? ` · +${extraItems} more` : ''}
                          </span>
                        </span>
                      </label>
                      <span className="shrink-0 text-right">
                        <strong className="block whitespace-nowrap text-[13px] font-extrabold leading-[1.35] tabular-nums text-[var(--bk-console-text)]">
                          {currency(order.amount)}
                        </strong>
                        <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[var(--bk-console-text-muted)]">
                          <Clock3 className="h-3 w-3" aria-hidden="true" />
                          {formatHeldTime(order.ageHours)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--color-cell-line)] pt-2.5">
                      {/* Not `compact` here on purpose. The prototype shrinks the
                          fraud control inside a dense desktop row, but its phone
                          card gives it a full 44px height at 11px type
                          (.cod-mobile-reason .p-button) — this is the one place a
                          merchant taps it with a thumb. */}
                      <FraudRiskCell
                        order={order}
                        expanded={courierOpen}
                        onToggle={() => setExpandedOrderId(courierOpen ? null : order.orderId)}
                        onCheck={() => { void handleCourierCheck(order); }}
                        busy={courierBusy}
                      />
                      {reason && (
                        <span className="min-w-0 text-[11px] leading-[1.3] text-amber-700">
                          {courierBusy ? 'Re-running the check…' : reason}
                        </span>
                      )}
                    </div>
                    {courierOpen && courierSummary && (
                      <div className="mt-2.5">
                        <CourierDetailPanel
                          summary={courierSummary}
                          onRecheck={() => { void handleCourierCheck(order); }}
                          busy={courierBusy}
                        />
                      </div>
                    )}
                    <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--color-cell-line)] pt-2.5">
                      <Button
                        variant="primary"
                        size="sm"
                        loading={busy}
                        onClick={() => { void handleConfirmOrder(order.orderId); }}
                        className="w-full justify-center"
                      >
                        {busy
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        Confirm
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busy}
                        onClick={() => { void handleCancelOrder(order.orderId); }}
                        className="w-full justify-center"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Skip
                      </Button>
                    </div>
                    <p className="mt-2 text-[10.5px] leading-[1.4] text-[var(--bk-console-text-subtle)]">
                      Confirm sends the event · Skip keeps it unsent and restorable
                    </p>
                  </article>
                );
              })}
            </div>
            {/* The prototype put a decision-history panel here. No endpoint
                lists already-decided orders, so this states the two totals the
                API does return instead of showing invented rows. */}
            {reviewedTotal > 0 && (
              <p className="border-t border-[var(--bk-console-border)] px-4 py-2.5 text-[11px] leading-[1.45] text-[var(--bk-console-text-muted)]">
                All time · <strong className="font-semibold text-[var(--bk-console-text)]">{confirmedTotal.toLocaleString()}</strong> confirmed
                {' · '}
                <strong className="font-semibold text-[var(--bk-console-text)]">{cancelledTotal.toLocaleString()}</strong> skipped
                {skipShare === null ? '' : ` — ${skipShare}% of the COD orders you reviewed never reached your ad data`}
              </p>
            )}
            <PaginationControls
              page={safePage}
              pageSize={COD_PAGE_SIZE}
              total={visibleOrders.length}
              onPageChange={setPage}
              noun="COD orders"
            />
          </>
        )}
      </Card>

      {settingsOpen && (
        <Drawer eyebrow="COD protection" title="Review settings" onClose={() => setSettingsOpen(false)}>
          <div className="flex-1">
            <SettingRow
              title="Hold Purchase events for review"
              detail="Every cash-on-delivery order waits on this page until you confirm it. Off sends each one the moment it is placed."
              control={(
                <ToggleSwitch
                  checked={deferredEnabled}
                  disabled={!growthFeaturesEnabled}
                  onChange={setDeferredEnabled}
                  label="Hold COD Purchase events until reviewed"
                />
              )}
            />
            <div className="border-b border-[var(--color-cell-line)] px-5 py-4">
              <Select
                label="Auto-confirm after"
                value={String(autoConfirmDays)}
                disabled={!deferredEnabled}
                onChange={event => setAutoConfirmDays(Number(event.target.value))}
                hint="Anything still waiting this long is confirmed for you. Off keeps every decision in your hands."
                options={[
                  { value: '0', label: 'Off — manual only' },
                  ...[1, 2, 3, 5, 7].map(day => ({ value: String(day), label: `${day} day${day === 1 ? '' : 's'}` })),
                ]}
              />
            </div>
            <div className="border-b border-[var(--color-cell-line)] px-5 py-4">
              <Select
                label="Confirm status"
                value={autoConfirmStatus}
                disabled={!deferredEnabled}
                onChange={event => setAutoConfirmStatus(event.target.value)}
                hint="The status an order must reach in your store before an automatic confirm releases its Purchase event."
                options={[
                  { value: 'completed', label: 'Completed / Delivered' },
                  { value: 'processing', label: 'Processing / Confirmed' },
                ]}
              />
            </div>
            <SettingRow
              title="Run the fraud check automatically"
              detail="Leave this off to save courier API quota — you can check any order with one click. On, RedX and Pathao are checked for every held order."
              control={(
                <ToggleSwitch
                  checked={courierAutoCheck}
                  disabled={!growthFeaturesEnabled}
                  onChange={setCourierAutoCheck}
                  label="Run the courier fraud check for every held order"
                />
              )}
            />
            {!growthFeaturesEnabled && (
              <p className="px-5 py-4 text-[11px] leading-[1.5] text-[var(--bk-console-text-muted)]">
                Changing these needs the {LOCKED_FEATURE_MINIMUM_PLAN} plan or an active trial. Your held
                orders stay reviewable either way.
              </p>
            )}
          </div>
          <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] px-5 py-4">
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={savingDeferredSettings}
              disabled={savingDeferredSettings || !growthFeaturesEnabled}
              onClick={async () => {
                await handleSaveDeferredSettings();
                setSettingsOpen(false);
              }}
            >
              {savingDeferredSettings ? 'Saving…' : 'Save settings'}
            </Button>
          </footer>
        </Drawer>
      )}
    </div>
  );
}

export default CodProtectionView;

