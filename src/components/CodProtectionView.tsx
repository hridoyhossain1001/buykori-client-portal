import React from 'react';
import { CheckCircle2, XCircle, Truck, Zap, Package } from 'lucide-react';

interface CodProtectionViewProps {
  deferredData: any;
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
  orderManagementDraftEnabled: boolean;
  setOrderManagementDraftEnabled: (val: boolean) => void;
  savingOrderMgmt: boolean;
  handleSaveOrderManagement: () => Promise<void>;
  growthFeaturesEnabled?: boolean;
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
  orderManagementDraftEnabled,
  setOrderManagementDraftEnabled,
  savingOrderMgmt,
  handleSaveOrderManagement,
  growthFeaturesEnabled = false,
}: CodProtectionViewProps) {
  const pendingList = (deferredData?.deferredPendingList || deferredData?.pendingList || [])
    .filter((order: any) => !order?.operationsOnly);
  const pendingCount = deferredData?.deferredPendingCount ?? deferredData?.pendingCount ?? pendingList.length;
  const pendingValue = deferredData?.deferredPendingValue ?? deferredData?.pendingValue ?? 0;
  const confirmedToday = deferredData?.confirmedToday ?? 0;
  const oldestPending = deferredData?.deferredOldestPending ?? deferredData?.oldestPending ?? 'None';

  const getCustomerSummary = (order: any) => {
    const rawCustomer = String(order.customer || '').trim();
    const isHash = (val: string) => /^[a-f0-9]{32,}$/i.test(val.trim());

    const name = String(order.customerName || order.customer_name || order.recipientName || order.recipient_name || order.name || '').trim();
    const phone = String(order.phone || order.customerPhone || order.customer_phone || order.recipientPhone || order.recipient_phone || '').trim();
    const address = String(order.address || order.customerAddress || order.customer_address || order.recipientAddress || order.recipient_address || '').trim();

    const isCustomerHash = isHash(rawCustomer);
    const isNameHash = isHash(name);
    const isPhoneHash = isHash(phone);

    const protectedHash = isCustomerHash || isNameHash || isPhoneHash;
    const displayHash = isCustomerHash ? rawCustomer : (isNameHash ? name : (isPhoneHash ? phone : ''));

    const cleanName = isNameHash ? '' : name;
    const cleanPhone = isPhoneHash ? '' : phone;
    const cleanAddress = isHash(address) ? '' : address;

    return {
      primary: cleanName || (protectedHash ? 'Protected customer' : rawCustomer || 'Customer unavailable'),
      secondary: cleanPhone || (protectedHash && displayHash ? `ID ${displayHash.slice(0, 10)}...` : ''),
      tertiary: cleanAddress,
      title: protectedHash ? (displayHash || 'Protected') : [cleanName || rawCustomer, cleanPhone, cleanAddress].filter(Boolean).join(' | '),
    };
  };

  const summaryItems = [
    { label: 'Pending', value: pendingCount, helper: 'COD orders', tone: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Held', value: pendingValue, helper: 'Revenue', tone: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: 'Verified', value: confirmedToday, helper: 'Today', tone: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Oldest', value: oldestPending, helper: 'Waiting', tone: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100' },
  ];

  const toggleOrderSelection = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrderIds(prev => prev.includes(orderId) ? prev : [...prev, orderId]);
    } else {
      setSelectedOrderIds(prev => prev.filter(id => id !== orderId));
    }
  };

  const renderRiskGauge = (scoreValue: number) => {
    const score = Math.max(0, Math.min(100, Number(scoreValue) || 0));
    const tone = score >= 75
      ? { label: 'High', text: 'text-rose-700', bar: 'bg-rose-500' }
      : score >= 35
        ? { label: 'Medium', text: 'text-amber-700', bar: 'bg-amber-500' }
        : { label: 'Low', text: 'text-green-700', bar: 'bg-green-500' };

    return (
      <div className="min-w-[120px]">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={`text-[10px] font-black uppercase tracking-wide ${tone.text}`}>{tone.label}</span>
          <span className="font-mono text-[10px] font-bold text-slate-500">{score}/100</span>
        </div>
        <div className="grid h-2 grid-cols-3 overflow-hidden rounded-full bg-slate-100">
          <span className="bg-green-400" />
          <span className="bg-amber-400" />
          <span className="bg-rose-400" />
        </div>
        <div className="mt-1 h-1 rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    );
  };

  const desktopSummaryRow = (
    <div className="hidden grid-cols-4 gap-2 md:grid">
      {summaryItems.map((item) => (
        <div key={item.label} className={`flex items-center justify-between rounded-lg border ${item.border} ${item.bg} px-3 py-2`}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
            <p className="text-[10px] text-slate-400">{item.helper}</p>
          </div>
          <p className={`font-mono text-lg font-black leading-none ${item.tone}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );

  const mobileSummaryTab = (
    <aside
      aria-label="COD queue summary"
      className="fixed right-2 top-[222px] z-30 w-[58px] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur md:hidden"
    >
      {summaryItems.map((item) => (
        <div key={item.label} className={`border-b ${item.border} ${item.bg} px-1.5 py-2 text-center last:border-b-0`}>
          <p className={`font-mono text-sm font-black leading-none ${item.tone}`}>{item.value}</p>
          <p className="mt-1 text-[8px] font-black uppercase leading-tight tracking-wide text-slate-600">{item.label}</p>
        </div>
      ))}
    </aside>
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <details className="group md:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wide text-slate-800">COD controls</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Courier {orderManagementDraftEnabled ? 'on' : 'off'} · Protection {deferredEnabled ? 'on' : 'off'}
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">
              Configure
            </span>
          </summary>
          <div className="space-y-4 border-t border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${orderManagementDraftEnabled ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                  <Truck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Order Management</p>
                  <p className="text-[11px] text-slate-500">Courier workflow</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={orderManagementDraftEnabled}
                disabled={!growthFeaturesEnabled}
                onChange={(e) => setOrderManagementDraftEnabled(e.target.checked)}
                aria-label="Toggle order management courier integration"
                className="h-5 w-5 rounded accent-indigo-600"
              />
            </div>
            <button
              type="button"
              disabled={savingOrderMgmt || !growthFeaturesEnabled}
              onClick={handleSaveOrderManagement}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {savingOrderMgmt ? 'Saving...' : 'Save order settings'}
            </button>

            <div className="h-px bg-slate-100" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${deferredEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  <Zap className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900">COD Protection</p>
                  <p className="text-[11px] text-slate-500">Verify before tracking</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={deferredEnabled}
                disabled={!growthFeaturesEnabled}
                onChange={(e) => setDeferredEnabled(e.target.checked)}
                aria-label="Toggle COD protection"
                className="h-5 w-5 rounded accent-emerald-700"
              />
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="cod-auto-confirm-days-mobile" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Auto-confirm after</label>
                <select
                  id="cod-auto-confirm-days-mobile"
                  value={autoConfirmDays}
                  onChange={(e) => setAutoConfirmDays(Number(e.target.value))}
                  disabled={!deferredEnabled}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="0">Off (Manual only)</option>
                  <option value="1">1 Day</option>
                  <option value="2">2 Days</option>
                  <option value="3">3 Days</option>
                  <option value="5">5 Days</option>
                  <option value="7">7 Days</option>
                </select>
              </div>
              <div>
                <label htmlFor="cod-auto-confirm-status-mobile" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Confirm when status is</label>
                <select
                  id="cod-auto-confirm-status-mobile"
                  value={autoConfirmStatus}
                  onChange={(e) => setAutoConfirmStatus(e.target.value)}
                  disabled={!deferredEnabled}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 outline-none focus:border-emerald-500 disabled:opacity-50"
                >
                  <option value="completed">Completed / Delivered</option>
                  <option value="processing">Processing / Confirmed</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              disabled={savingDeferredSettings || !growthFeaturesEnabled}
              onClick={handleSaveDeferredSettings}
              className="w-full rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-900 disabled:opacity-50"
            >
              {savingDeferredSettings ? 'Saving...' : 'Save COD settings'}
            </button>
          </div>
        </details>

        <div className="hidden items-end gap-3 p-3 md:grid md:grid-cols-[minmax(0,.8fr)_minmax(0,.8fr)_minmax(0,1.4fr)]">
          <div className="flex items-stretch gap-1.5">
            <label className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-slate-900">Order Management</span>
                <span className="block truncate text-[9px] text-slate-500">Courier workflow</span>
              </span>
              <input
                type="checkbox"
                checked={orderManagementDraftEnabled}
                disabled={!growthFeaturesEnabled}
                onChange={(e) => setOrderManagementDraftEnabled(e.target.checked)}
                aria-label="Toggle order management courier integration"
                className="h-4 w-4 rounded accent-indigo-600"
              />
            </label>
            <button
              type="button"
              disabled={savingOrderMgmt || !growthFeaturesEnabled}
              onClick={handleSaveOrderManagement}
              className="rounded-lg border border-slate-200 bg-white px-2.5 text-[9px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {savingOrderMgmt ? 'Saving' : 'Save'}
            </button>
          </div>

          <div className="flex items-stretch gap-1.5">
            <label className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-slate-900">COD Protection</span>
                <span className="block truncate text-[9px] text-slate-500">Verify tracking</span>
              </span>
              <input
                type="checkbox"
                checked={deferredEnabled}
                disabled={!growthFeaturesEnabled}
                onChange={(e) => setDeferredEnabled(e.target.checked)}
                aria-label="Toggle COD protection"
                className="h-4 w-4 rounded accent-emerald-700"
              />
            </label>
            <button
              type="button"
              disabled={savingDeferredSettings || !growthFeaturesEnabled}
              onClick={handleSaveDeferredSettings}
              className="rounded-lg bg-emerald-800 px-2.5 text-[9px] font-bold text-white hover:bg-emerald-900 disabled:opacity-50"
            >
              {savingDeferredSettings ? 'Saving' : 'Save'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="cod-auto-confirm-days" className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Auto-confirm after</label>
              <select
                id="cod-auto-confirm-days"
                value={autoConfirmDays}
                onChange={(e) => setAutoConfirmDays(Number(e.target.value))}
                disabled={!deferredEnabled}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value="0">Off (Manual only)</option>
                <option value="1">1 Day</option>
                <option value="2">2 Days</option>
                <option value="3">3 Days</option>
                <option value="5">5 Days</option>
                <option value="7">7 Days</option>
              </select>
            </div>
            <div>
              <label htmlFor="cod-auto-confirm-status" className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500">Confirm status</label>
              <select
                id="cod-auto-confirm-status"
                value={autoConfirmStatus}
                onChange={(e) => setAutoConfirmStatus(e.target.value)}
                disabled={!deferredEnabled}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 outline-none focus:border-emerald-500 disabled:opacity-50"
              >
                <option value="completed">Completed / Delivered</option>
                <option value="processing">Processing / Confirmed</option>
              </select>
            </div>
          </div>

        </div>
      </section>

      {desktopSummaryRow}
      {mobileSummaryTab}

      <div className="grid grid-cols-1 gap-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">Pending COD Orders</h2>
              <p className="text-xs text-slate-400">Verify orders before sending purchase data to your ad platforms.</p>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              {selectedOrderIds.length === 0 && (
                <span className="text-[10px] font-medium text-slate-400">Select orders to enable bulk actions.</span>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={selectedOrderIds.length === 0}
                  onClick={handleBulkConfirm}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                </button>
                <button
                  type="button"
                  disabled={selectedOrderIds.length === 0}
                  onClick={handleBulkCancel}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                >
                  <XCircle className="h-3.5 w-3.5" /> Skip Selected
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3 md:hidden">
            {pendingList.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                <p className="text-xs font-semibold">No pending COD orders to verify.</p>
              </div>
            ) : pendingList.map((order: any) => {
              const isSelected = selectedOrderIds.includes(order.orderId);
              const customer = getCustomerSummary(order);
              return (
                <article key={order.orderId} className={`rounded-xl border bg-white p-4 shadow-sm ${isSelected ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(event) => toggleOrderSelection(order.orderId, event.target.checked)}
                        className="mt-1 rounded accent-indigo-600"
                      />
                      <span>
                        <span className="block font-mono text-sm font-bold text-slate-900">#{order.orderId}</span>
                        <span className="mt-1 block text-sm font-semibold text-slate-800">{customer.primary}</span>
                        {customer.secondary && <span className="block truncate font-mono text-[11px] text-slate-500">{customer.secondary}</span>}
                      </span>
                    </label>
                    <span className="font-bold text-slate-900">{(Number(order.amount) || 0).toLocaleString()}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="font-bold uppercase text-slate-400">Risk</p>
                      <div className="mt-1">{renderRiskGauge(order.fraudScore)}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      <p className="font-bold uppercase text-slate-400">Held</p>
                      <p className="mt-1 font-mono font-bold text-slate-700">{order.ageHours}h</p>
                    </div>
                  </div>
                  {order.products && order.products.length > 0 && (
                    <details className="mt-3 group/prod">
                      <summary className="flex cursor-pointer items-center justify-between text-[11px] font-bold text-indigo-700 select-none">
                        <span>Order Items ({order.products.length})</span>
                        <span className="text-[9px] text-indigo-500 group-open/prod:hidden">Show</span>
                        <span className="text-[9px] text-indigo-500 hidden group-open/prod:inline">Hide</span>
                      </summary>
                      <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                        {order.products.map((p: any, idx: number) => {
                          const pName = p.name || p.content_name || `Item ${idx + 1}`;
                          const qty = p.quantity ? ` x${p.quantity}` : '';
                          const category = p.category || p.content_category || '';
                          const attrs = p.attributes && typeof p.attributes === 'object'
                            ? Object.entries(p.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')
                            : '';
                          const meta = [category, attrs].filter(Boolean).join(' - ');
                          return (
                            <div key={idx} className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-tight">
                              <Package className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                              <div>
                                <span className="font-medium text-slate-700">{pName}</span>
                                {qty && <span className="font-bold text-slate-500">{qty}</span>}
                                {meta && <span className="block text-slate-400 font-normal">{meta}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleConfirmOrder(order.orderId)} className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white">Confirm</button>
                    <button type="button" onClick={() => handleCancelOrder(order.orderId)} className="rounded-lg bg-rose-900 px-3 py-2 text-xs font-bold text-white">Skip Event</button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[750px] divide-y divide-slate-100 text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-10 px-6 py-3">
                    <input
                      type="checkbox"
                      checked={pendingList.length > 0 && pendingList.every((order: any) => selectedOrderIds.includes(order.orderId))}
                      aria-label="Select all pending COD orders"
                      onChange={(event) => setSelectedOrderIds(event.target.checked ? pendingList.map((order: any) => order.orderId) : [])}
                      className="rounded accent-indigo-600"
                    />
                  </th>
                  <th className="px-6 py-3">Order ID</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Amount</th>
                  <th className="px-6 py-3">Risk Score</th>
                  <th className="px-6 py-3">Held Time</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center font-medium text-slate-400">
                      <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                      No pending COD orders to verify.
                    </td>
                  </tr>
                ) : pendingList.map((order: any) => {
                  const isSelected = selectedOrderIds.includes(order.orderId);
                  const customer = getCustomerSummary(order);
                  const products: any[] = order.products || [];
                  return (
                    <tr key={order.orderId} className={`transition-colors hover:bg-slate-50/50 ${isSelected ? 'bg-indigo-50/10' : ''}`}>
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          aria-label={`Select pending COD order ${order.orderId}`}
                          onChange={(event) => toggleOrderSelection(order.orderId, event.target.checked)}
                          className="rounded accent-indigo-600"
                        />
                      </td>
                      <td className="px-6 py-2.5 font-mono font-bold text-slate-800">{order.orderId}</td>
                      <td className="px-6 py-2" title={customer.title}>
                        <div className="flex max-w-[300px] flex-col gap-0.5">
                          <span className="truncate font-semibold text-slate-800">{customer.primary}</span>
                          {customer.secondary && <span className="truncate font-mono text-[10px] text-slate-500">{customer.secondary}</span>}
                          {products.length > 0 && (
                            <div className="mt-0.5">
                              {products.slice(0, 1).map((p: any, idx: number) => {
                                const pName = p.name || p.content_name || `Item ${idx + 1}`;
                                const qty = p.quantity ? ` x${p.quantity}` : '';
                                const category = p.category || p.content_category || '';
                                const attrs = p.attributes && typeof p.attributes === 'object'
                                  ? Object.entries(p.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')
                                  : '';
                                const meta = [category, attrs].filter(Boolean).join(' - ');
                                return (
                                  <div key={idx} className="flex items-start gap-1 text-[10px] text-slate-500 leading-tight" title={[pName + qty, meta].filter(Boolean).join(' | ')}>
                                    <Package className="h-3 w-3 mt-0.5 shrink-0 text-slate-400" />
                                    <div className="min-w-0">
                                      <p className="truncate font-medium text-slate-700">{pName}{qty && <span className="font-bold text-slate-500">{qty}</span>}</p>
                                      {meta && <p className="truncate text-[9px] font-normal text-slate-400">{meta}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                              {products.length > 1 && (
                                <p className="mt-0.5 pl-4 text-[9px] font-semibold text-indigo-600">+{products.length - 1} more items</p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-2.5 font-semibold text-slate-800">
                        <span className="text-[10px] font-bold text-slate-400">BDT </span>{(Number(order.amount) || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-2.5">
                        {renderRiskGauge(order.fraudScore)}
                      </td>
                      <td className="px-6 py-2.5 font-mono text-slate-500">{order.ageHours}h ago</td>
                      <td className="space-x-2 whitespace-nowrap px-6 py-2.5 text-right">
                        <button type="button" onClick={() => handleConfirmOrder(order.orderId)} className="rounded bg-emerald-800 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-900">Confirm</button>
                        <button type="button" onClick={() => handleCancelOrder(order.orderId)} className="rounded bg-rose-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-rose-950">Skip Event</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
