import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Info,
  Search,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { DeferredData, DeferredOrder } from '../types';
import { FraudVerdictBadge } from './FraudVerdictBadge';

interface CodProtectionViewProps {
  deferredData: DeferredData;
  selectedOrderIds: string[];
  setSelectedOrderIds: React.Dispatch<React.SetStateAction<string[]>>;
  handleBulkConfirm: () => Promise<void>;
  handleBulkCancel: () => Promise<void>;
  handleConfirmOrder: (orderId: string) => Promise<void>;
  handleCancelOrder: (orderId: string) => Promise<void>;
  deferredEnabled: boolean;
  setDeferredEnabled: (val: boolean) => void;
  autoConfirmDays: number;
  setAutoConfirmDays: (val: number) => void;
  autoConfirmStatus: string;
  setAutoConfirmStatus: (val: string) => void;
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

export function CodProtectionView({
  deferredData,
  selectedOrderIds,
  setSelectedOrderIds,
  handleBulkConfirm,
  handleBulkCancel,
  handleConfirmOrder,
  handleCancelOrder,
  deferredEnabled,
  setDeferredEnabled,
  autoConfirmDays,
  setAutoConfirmDays,
  autoConfirmStatus,
  setAutoConfirmStatus,
  savingDeferredSettings,
  handleSaveDeferredSettings,
  growthFeaturesEnabled = false,
}: CodProtectionViewProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');

  const pendingList = (deferredData?.deferredPendingList || deferredData?.pendingList || [])
    .filter((order) => !order.operationsOnly);
  const pendingCount = deferredData?.deferredPendingCount ?? deferredData?.pendingCount ?? pendingList.length;
  const pendingValueRaw = deferredData?.deferredPendingValue ?? deferredData?.pendingValue ?? 0;
  const pendingValueNumber = Number.parseFloat(String(pendingValueRaw).replace(/[^\d.]/g, '')) || 0;
  const pendingValue = pendingValueNumber > 0
    ? pendingValueRaw
    : pendingList.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);
  const confirmedToday = deferredData?.confirmedToday ?? 0;
  const oldestPending = deferredData?.deferredOldestPending ?? deferredData?.oldestPending ?? 0;

  const visibleOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return pendingList
      .filter((order) => {
        if (!query) return true;
        const customer = customerDetails(order);
        return [
          order.orderId,
          customer.name,
          customer.phone,
          order.products?.map((product) => product.name || product.content_name).join(' '),
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aHours = Number(a.ageHours) || 0;
        const bHours = Number(b.ageHours) || 0;
        return sortOrder === 'oldest' ? bHours - aHours : aHours - bHours;
      });
  }, [pendingList, searchQuery, sortOrder]);

  const toggleOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((current) => checked
      ? (current.includes(orderId) ? current : [...current, orderId])
      : current.filter((id) => id !== orderId));
  };

  const toggleAll = (checked: boolean) => {
    setSelectedOrderIds(checked ? visibleOrders.map((order) => order.orderId) : []);
  };

  const settingsSummary = `Auto-confirm: ${autoConfirmDays === 0 ? 'Off — manual only' : `After ${autoConfirmDays} day${autoConfirmDays === 1 ? '' : 's'}`} · Confirm status: ${autoConfirmStatus === 'processing' ? 'Processing / Confirmed' : 'Completed / Delivered'}`;

  return (
    <div className="space-y-2.5 md:space-y-4">
      <section className="rounded-[14px] border border-slate-200 bg-white p-2.5 shadow-sm md:hidden">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-stretch gap-2">
          <div className="flex flex-col items-center justify-center border-r border-slate-100 pr-2 text-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[#2f80df]">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <p className="mt-1.5 text-[8px] font-medium leading-[12px] text-slate-600">
              Purchases stay on hold until you confirm each COD order.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2">
            {[
              ['Pending', pendingCount, 'Waiting for you', 'text-slate-900'],
              ['Held revenue', currency(pendingValue), 'Not sent to platforms', 'text-slate-900'],
              ['Verified today', confirmedToday, 'Confirmed purchases', 'text-emerald-600'],
              ['Oldest waiting', formatHeldTime(oldestPending), 'Needs your review', 'text-orange-600'],
            ].map(([label, value, helper, tone], index) => (
              <div
                key={String(label)}
                className={`min-w-0 px-2 py-1.5 ${index % 2 === 1 ? 'border-l border-slate-100' : ''} ${index > 1 ? 'border-t border-slate-100' : ''}`}
              >
                <p className="whitespace-nowrap text-[7px] font-bold uppercase tracking-[0.09em] text-slate-500">{label}</p>
                <p className={`mt-0.5 text-[15px] font-black leading-none tracking-tight ${tone}`}>{value}</p>
                <p className="mt-1 break-words text-[7.5px] font-medium leading-[10px] text-slate-500">{helper}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="hidden rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm md:block">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_repeat(4,minmax(110px,.55fr))] lg:items-center">
          <div className="flex items-center gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">COD Protection</h2>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                Purchases stay on hold until you confirm each COD order.
              </p>
            </div>
          </div>
          {[
            ['Pending', pendingCount, 'Waiting for you', 'text-slate-900'],
            ['Held revenue', currency(pendingValue), 'Not sent to platforms', 'text-slate-900'],
            ['Verified today', confirmedToday, 'Confirmed purchases', 'text-emerald-700'],
            ['Oldest waiting', formatHeldTime(oldestPending), 'Needs your review', 'text-amber-700'],
          ].map(([label, value, helper, tone]) => (
            <div key={String(label)} className="border-t border-slate-100 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
              <p className={`mt-1 text-lg font-black ${tone}`}>{value}</p>
              <p className="mt-1 text-xs text-slate-400">{helper}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm md:rounded-xl">
        <button
          type="button"
          onClick={() => setSettingsOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left md:gap-4 md:px-5 md:py-4"
          aria-expanded={settingsOpen}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg md:h-10 md:w-10 md:rounded-xl ${deferredEnabled ? 'bg-blue-50 text-[#2f80df]' : 'bg-slate-100 text-slate-500'}`}>
              <ShieldCheck className="h-4 w-4 md:h-5 md:w-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-slate-900 md:text-sm">Protection settings</span>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold md:text-xs ${deferredEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                  {deferredEnabled ? 'On' : 'Off'}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-[9px] text-slate-500 md:mt-1 md:text-xs">
                <span className="md:hidden">Auto-confirm: {autoConfirmDays === 0 ? 'Off — manual only' : `After ${autoConfirmDays} days`}</span>
                <span className="hidden md:inline">{settingsSummary}</span>
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-[#2375d8] md:gap-3 md:text-xs md:text-indigo-600">
            {settingsOpen ? 'Close' : 'Edit'}
            <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>

        {settingsOpen && (
          <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 px-5 py-4 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
            <label className="flex min-h-10 items-center justify-between rounded-lg border border-slate-200 bg-white px-3">
              <span className="text-xs font-bold text-slate-700">Enable protection</span>
              <input
                type="checkbox"
                checked={deferredEnabled}
                disabled={!growthFeaturesEnabled}
                onChange={(event) => setDeferredEnabled(event.target.checked)}
                aria-label="Toggle COD protection"
                className="h-4 w-4 accent-indigo-600"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Auto-confirm after
              <select
                value={autoConfirmDays}
                onChange={(event) => setAutoConfirmDays(Number(event.target.value))}
                disabled={!deferredEnabled}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium normal-case tracking-normal text-slate-700 disabled:opacity-50"
              >
                <option value="0">Off — manual only</option>
                {[1, 2, 3, 5, 7].map((day) => <option key={day} value={day}>{day} day{day === 1 ? '' : 's'}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Confirm status
              <select
                value={autoConfirmStatus}
                onChange={(event) => setAutoConfirmStatus(event.target.value)}
                disabled={!deferredEnabled}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium normal-case tracking-normal text-slate-700 disabled:opacity-50"
              >
                <option value="completed">Completed / Delivered</option>
                <option value="processing">Processing / Confirmed</option>
              </select>
            </label>
            <button
              type="button"
              disabled={savingDeferredSettings || !growthFeaturesEnabled}
              onClick={async () => {
                await handleSaveDeferredSettings();
                setSettingsOpen(false);
              }}
              className="h-10 rounded-lg bg-indigo-600 px-5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingDeferredSettings ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm md:rounded-xl">
        <div className="border-b border-slate-200 p-3 md:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search order ID, name or phone…"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-2 text-[10px] outline-none focus:border-[#2f80df]"
              />
            </div>
            <select
              aria-label="Sort pending COD orders"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as 'oldest' | 'newest')}
              className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700"
            >
              <option value="oldest">Oldest first ▼</option>
              <option value="newest">Newest first ▼</option>
            </select>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_1.2fr_1fr] items-center gap-2">
            <span className="text-[9px] font-bold text-slate-400">{selectedOrderIds.length} selected</span>
            <button
              type="button"
              disabled={selectedOrderIds.length === 0}
              onClick={handleBulkConfirm}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[#2f80df] px-2 text-[9px] font-bold text-white disabled:border disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
            >
              <Check className="h-3 w-3" />
              Confirm orders
            </button>
            <button
              type="button"
              disabled={selectedOrderIds.length === 0}
              onClick={handleBulkCancel}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold text-slate-600 disabled:bg-slate-50 disabled:text-slate-400"
            >
              Skip selected
            </button>
          </div>
        </div>

        <div className="hidden flex-col gap-3 border-b border-slate-200 p-4 md:flex lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search order ID, name or phone…"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-indigo-400"
            />
          </div>
          <select
            aria-label="Sort pending COD orders"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as 'oldest' | 'newest')}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
          >
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
          <span className="hidden h-6 border-l border-slate-200 lg:block" />
          <span className="text-xs font-bold text-slate-500">{selectedOrderIds.length} selected</span>
          <button
            type="button"
            disabled={selectedOrderIds.length === 0}
            onClick={handleBulkConfirm}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Confirm {selectedOrderIds.length || ''} order{selectedOrderIds.length === 1 ? '' : 's'}
          </button>
          <button
            type="button"
            disabled={selectedOrderIds.length === 0}
            onClick={handleBulkCancel}
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Skip selected
          </button>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {visibleOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-xs font-medium text-slate-400">
              No pending COD orders.
            </div>
          ) : visibleOrders.map((order) => {
            const customer = customerDetails(order);
            const product = order.products?.[0];
            const selected = selectedOrderIds.includes(order.orderId);
            return (
              <article key={order.orderId} className={`px-3 py-2.5 ${selected ? 'bg-blue-50/40' : 'bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <label className="flex min-w-0 items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => toggleOrder(order.orderId, event.target.checked)}
                      aria-label={`Select COD order ${order.orderId}`}
                      className="mt-0.5 h-4 w-4 rounded accent-[#2f80df]"
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-[12px] font-bold leading-none text-slate-900">#{order.orderId}</span>
                      <span className="mt-1 block truncate text-[11px] font-semibold text-slate-800">{customer.name} <span className="font-normal text-slate-400">· {customer.phone}</span></span>
                    </span>
                  </label>
                  <span className="shrink-0 text-right">
                    <span className="block whitespace-nowrap text-[13px] font-black text-slate-900">{currency(order.amount)}</span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[9px] text-slate-400">
                      <Clock3 className="h-3 w-3" /> {formatHeldTime(order.ageHours)}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 pl-6">
                  <p className="min-w-0 truncate text-[9px] font-medium text-slate-500">{product?.name || product?.content_name || 'Product details unavailable'}</p>
                  <span className="shrink-0">
                    <FraudVerdictBadge details={order.fraudDetails} score={order.fraudScore} compact />
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => handleConfirmOrder(order.orderId)} className="h-8 rounded-lg bg-[#2f80df] text-[10px] font-bold text-white">Confirm</button>
                  <button type="button" onClick={() => handleCancelOrder(order.orderId)} className="h-8 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-700">Skip</button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-12 px-5 py-3">
                  <input
                    type="checkbox"
                    checked={visibleOrders.length > 0 && visibleOrders.every((order) => selectedOrderIds.includes(order.orderId))}
                    onChange={(event) => toggleAll(event.target.checked)}
                    aria-label="Select all pending COD orders"
                    className="accent-indigo-600"
                  />
                </th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Fraud risk</th>
                <th className="px-4 py-3">Waiting</th>
                <th className="px-5 py-3 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleOrders.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-400">No pending COD orders.</td></tr>
              ) : visibleOrders.map((order) => {
                const customer = customerDetails(order);
                const product = order.products?.[0];
                const selected = selectedOrderIds.includes(order.orderId);
                return (
                  <tr key={order.orderId} className={selected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/50'}>
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => toggleOrder(order.orderId, event.target.checked)}
                        aria-label={`Select COD order ${order.orderId}`}
                        className="accent-indigo-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold text-slate-900">#{order.orderId}</p>
                      <p className="mt-1 text-xs text-slate-400">{order.timestamp ? new Date(order.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{customer.name}</p>
                      <p className="mt-1 font-mono text-xs text-slate-400">{customer.phone}</p>
                    </td>
                    <td className="max-w-[250px] px-4 py-3">
                      <p className="truncate font-semibold text-slate-800" title={product?.name || product?.content_name}>
                        {product?.name || product?.content_name || 'Product details unavailable'}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{product ? `Qty ${product.quantity || 1}` : ''}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold text-slate-900">{currency(order.amount)}</td>
                    <td className="px-4 py-3"><FraudVerdictBadge details={order.fraudDetails} score={order.fraudScore} /></td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <p className="font-bold text-slate-800">{formatHeldTime(order.ageHours)}</p>
                      <p className="mt-1 text-xs text-slate-400">Pending review</p>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <button type="button" onClick={() => handleConfirmOrder(order.orderId)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white">
                        <Check className="h-3.5 w-3.5" /> Confirm
                      </button>
                      <button type="button" onClick={() => handleCancelOrder(order.orderId)} className="ml-2 h-8 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600">
                        Skip
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-3 py-2.5 text-[9px] leading-4 text-slate-400 md:px-5 md:py-3 md:text-xs">
          {visibleOrders.length} pending order{visibleOrders.length === 1 ? '' : 's'} · confirmed orders send Purchase to Meta, TikTok and GA4
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-3 text-[9px] leading-4 text-emerald-800 md:rounded-xl md:px-4 md:text-xs md:leading-relaxed">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p><strong>Why this matters:</strong> skipping fake COD orders keeps false purchases out of your ad data, so the platforms learn from real buyers.</p>
      </div>
    </div>
  );
}
