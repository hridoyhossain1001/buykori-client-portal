import React, { useState } from 'react';
import { CheckCircle2, XCircle, Truck, Zap, ChevronDown, ChevronUp, User, Phone, MapPin, Package } from 'lucide-react';

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
  // Order Management (courier integration)
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
  const getCustomerSummary = (order: any) => {
    const rawCustomer = String(order.customer || '').trim();
    const protectedHash = /^[a-f0-9]{32,}$/i.test(rawCustomer);
    const name = order.customerName || order.customer_name || order.name || '';
    const phone = order.phone || order.customerPhone || order.customer_phone || '';
    const address = order.address || order.customerAddress || order.customer_address || '';

    return {
      primary: name || (protectedHash ? 'Protected customer' : rawCustomer || 'Customer unavailable'),
      secondary: phone || (protectedHash ? `ID ${rawCustomer.slice(0, 10)}...` : ''),
      tertiary: address,
      title: protectedHash ? rawCustomer : [name || rawCustomer, phone, address].filter(Boolean).join(' | '),
    };
  };

  return (
    <div className="space-y-6">

      {/* ── Unified Settings Card (Split Layout) ──────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 mb-6">
        
        {/* Left Side: Order Management */}
        <div className="flex-1 p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors ${
                orderManagementDraftEnabled
                  ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}>
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm dark:text-white">Order Management</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Courier Integration</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {orderManagementDraftEnabled ? 'ON' : 'OFF'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={orderManagementDraftEnabled}
                  disabled={!growthFeaturesEnabled}
                  onChange={(e) => setOrderManagementDraftEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
              </label>
            </div>
          </div>
          
          <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
            {orderManagementDraftEnabled ? (
              <span><span className="font-semibold text-indigo-600 dark:text-indigo-400">Enabled:</span> Auto-book courier when an order is confirmed. Send purchase data when courier delivery is complete.</span>
            ) : (
              <span><span className="font-semibold text-slate-500">Disabled:</span> Instant conversion on Confirm. No courier tracking or automation active.</span>
            )}
          </div>

          <div className="flex items-center justify-between mt-auto">
             <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold ${
              orderManagementDraftEnabled
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                : 'bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400'
            }`}>
              {orderManagementDraftEnabled ? <><Truck className="w-3 h-3" /> Courier Tracking On</> : <><Zap className="w-3 h-3" /> Direct Confirm</>}
            </div>
            <button
              type="button"
              disabled={savingOrderMgmt || !growthFeaturesEnabled}
              onClick={handleSaveOrderManagement}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-[10px] font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {savingOrderMgmt ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
          {!growthFeaturesEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              Manual courier booking is available in Orders & Delivery. Automatic courier workflow requires a Growth trial or paid plan.
            </p>
          )}
        </div>

        {/* Right Side: COD Protection */}
        <div className="flex-1 p-6 flex flex-col justify-between gap-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-colors ${
                deferredEnabled
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}>
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm dark:text-white">COD Protection</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Verify before tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {deferredEnabled ? 'ON' : 'OFF'}
              </span>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={deferredEnabled}
                  disabled={!growthFeaturesEnabled}
                  onChange={(e) => setDeferredEnabled(e.target.checked)} 
                  className="sr-only peer"
              />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>
          </div>
          {!growthFeaturesEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              Deferred Purchase control is available with a Growth trial or paid plan.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Auto-confirm after</label>
              <select 
                value={autoConfirmDays}
                onChange={(e) => setAutoConfirmDays(Number(e.target.value))}
                disabled={!deferredEnabled}
                className="w-full p-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white cursor-pointer disabled:opacity-50"
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
              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Confirm when status is</label>
              <select 
                value={autoConfirmStatus}
                onChange={(e) => setAutoConfirmStatus(e.target.value)}
                disabled={!deferredEnabled}
                className="w-full p-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white cursor-pointer disabled:opacity-50"
              >
                <option value="completed">Completed / Delivered</option>
                <option value="processing">Processing / Confirmed</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end mt-auto">
            <button
              type="button"
              disabled={savingDeferredSettings || !growthFeaturesEnabled}
              onClick={handleSaveDeferredSettings}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-bold rounded-lg transition-colors"
            >
              {savingDeferredSettings ? 'Saving...' : 'Save COD Settings'}
            </button>
          </div>
        </div>
      </div>

      
      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Pending Count */}
        <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-gradient-to-br from-amber-100/70 to-amber-50/20 dark:from-amber-900/30 dark:to-slate-900/40 backdrop-blur-2xl p-6 shadow-xl shadow-amber-900/5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-400 border border-amber-300/30 bg-amber-100/50 dark:bg-amber-900/40 px-2 py-1 rounded-md">COD Protected</p>
          </div>
          <div className="mt-8 flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {deferredData.pendingCount}
            </p>
            <span className="text-xs font-semibold text-amber-750/70 dark:text-amber-300/70">Orders Pending</span>
          </div>
        </div>

        {/* Card 2: Pending Value */}
        <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-gradient-to-br from-indigo-100/70 to-indigo-50/20 dark:from-indigo-900/30 dark:to-slate-900/40 backdrop-blur-2xl p-6 shadow-xl shadow-indigo-900/5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-indigo-800 dark:text-indigo-400 border border-indigo-300/30 bg-indigo-100/50 dark:bg-indigo-900/40 px-2 py-1 rounded-md">Held Revenue</p>
          </div>
          <div className="mt-8 flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {deferredData.pendingValue}
            </p>
            <span className="text-xs font-semibold text-indigo-700/70 dark:text-indigo-300/70">Pending Orders</span>
          </div>
        </div>

        {/* Card 3: Confirmed Today */}
        <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-gradient-to-br from-emerald-200/50 to-emerald-50/20 dark:from-emerald-900/30 dark:to-slate-900/40 backdrop-blur-2xl p-6 shadow-xl shadow-emerald-900/5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 border border-emerald-300/30 bg-emerald-100/50 dark:bg-emerald-900/40 px-2 py-1 rounded-md">Verified Today</p>
          </div>
          <div className="mt-8 flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {deferredData.confirmedToday}
            </p>
            <span className="text-xs font-semibold text-emerald-750/70 dark:text-emerald-300/70">Confirmed Today</span>
          </div>
        </div>

        {/* Card 4: Oldest Pending */}
        <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-gradient-to-br from-rose-100/70 to-rose-50/20 dark:from-rose-900/30 dark:to-slate-900/40 backdrop-blur-2xl p-6 shadow-xl shadow-rose-900/5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-rose-800 dark:text-rose-400 border border-rose-300/30 bg-rose-100/50 dark:bg-rose-900/40 px-2 py-1 rounded-md">Oldest Pending</p>
          </div>
          <div className="mt-8 flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {deferredData.oldestPending}
            </p>
            <span className="text-xs font-semibold text-rose-750/70 dark:text-rose-300/70">Needs Review</span>
          </div>
        </div>

      </div>

      {/* Main Action Bar & Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col space-y-4 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Pending COD Orders</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Verify orders before sending purchase data to your ad platforms.</p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            {selectedOrderIds.length === 0 && (
              <span className="text-[10px] font-medium text-slate-400">Select orders to enable bulk actions.</span>
            )}
            <div className="flex gap-2">
            <button 
              disabled={selectedOrderIds.length === 0}
              onClick={handleBulkConfirm}
              className="px-3 py-1.5 bg-green-50 hover:bg-green-150 disabled:opacity-50 text-green-700 text-xs font-bold rounded-lg transition-colors border border-green-200 flex items-center gap-1.5 cursor-pointer dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/60"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Verify Selected
            </button>
            <button 
              disabled={selectedOrderIds.length === 0}
              onClick={handleBulkCancel}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-150 disabled:opacity-50 text-rose-700 text-xs font-bold rounded-lg transition-colors border border-rose-200 flex items-center gap-1.5 cursor-pointer dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/60"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel Selected
            </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {deferredData.pendingList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-950/40">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
              <p className="text-xs font-semibold">No pending COD orders to verify.</p>
            </div>
          ) : deferredData.pendingList.map((order: any) => {
            const isSelected = selectedOrderIds.includes(order.orderId);
            const customer = getCustomerSummary(order);
            const riskTone = order.fraudScore >= 75 ? 'rose' : order.fraudScore >= 35 ? 'amber' : 'green';
            return (
              <div key={order.orderId} className={`rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900 ${isSelected ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(el) => {
                        if (el.target.checked) {
                          setSelectedOrderIds(prev => [...prev, order.orderId]);
                        } else {
                          setSelectedOrderIds(prev => prev.filter(x => x !== order.orderId));
                        }
                      }}
                      className="mt-1 rounded accent-indigo-600"
                    />
                    <span>
                      <span className="block font-mono text-sm font-bold text-slate-900 dark:text-white">#{order.orderId}</span>
                      <span className="mt-1 block text-sm font-semibold text-slate-800 dark:text-slate-100">{customer.primary}</span>
                      {customer.secondary && <span className="block truncate font-mono text-[11px] text-slate-500">{customer.secondary}</span>}
                    </span>
                  </label>
                  <span className="font-bold text-slate-900 dark:text-white">৳{order.amount.toLocaleString()}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950/40">
                    <p className="font-bold uppercase text-slate-400">Risk</p>
                    <p className={`mt-1 font-bold ${riskTone === 'rose' ? 'text-rose-700' : riskTone === 'amber' ? 'text-amber-700' : 'text-green-700'}`}>{order.fraudScore}/100</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950/40">
                    <p className="font-bold uppercase text-slate-400">Held</p>
                    <p className="mt-1 font-mono font-bold text-slate-700 dark:text-slate-200">{order.ageHours}h</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => handleConfirmOrder(order.orderId)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Confirm</button>
                  <button onClick={() => handleCancelOrder(order.orderId)} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white">Cancel</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[750px] dark:text-slate-300 dark:divide-slate-800">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3 w-10">
                  <input 
                    type="checkbox"
                    checked={deferredData.pendingList.length > 0 && selectedOrderIds.length === deferredData.pendingList.length}
                    onChange={(el) => {
                      if (el.target.checked) {
                        setSelectedOrderIds(deferredData.pendingList.map((o: any) => o.orderId));
                      } else {
                        setSelectedOrderIds([]);
                      }
                    }}
                    className="rounded accent-indigo-600 cursor-pointer"
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {deferredData.pendingList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium dark:text-slate-500">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                    Hurrah! No pending COD orders to verify. Tracking is fully clean.
                  </td>
                </tr>
              ) : (
                deferredData.pendingList.map((order: any) => {
                  const isSelected = selectedOrderIds.includes(order.orderId);
                  const activeChecks = [];
                  if (order.fraudDetails) {
                    if (order.fraudDetails.ip_mismatch) activeChecks.push('IP Mismatch');
                    if (order.fraudDetails.disposable_email) activeChecks.push('Disposable Email');
                    if (order.fraudDetails.velocity_limit) activeChecks.push('Velocity Trigger');
                    if (order.fraudDetails.gibberish_name) activeChecks.push('Gibberish Name');
                  }
                  const tooltipText = activeChecks.length > 0 ? activeChecks.join(', ') : 'Passed structural checks';
                  const products: any[] = order.products || [];
                  const customer = getCustomerSummary(order);

                  return (
                    <React.Fragment key={order.orderId}>
                      <tr className={`hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/40 ${isSelected ? 'bg-indigo-50/10 dark:bg-indigo-950/20' : ''}`}>
                        <td className="px-6 py-3">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={(el) => {
                              if (el.target.checked) {
                                setSelectedOrderIds(prev => [...prev, order.orderId]);
                              } else {
                                setSelectedOrderIds(prev => prev.filter(x => x !== order.orderId));
                              }
                            }}
                            className="rounded accent-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-3 font-mono font-bold text-slate-800 dark:text-slate-100">
                          {order.orderId}
                        </td>
                        <td className="px-6 py-3" title={customer.title}>
                          <div className="flex max-w-[300px] flex-col gap-0.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">{customer.primary}</span>
                            {customer.secondary && (
                              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">{customer.secondary}</span>
                            )}
                            {customer.tertiary && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{customer.tertiary}</span>
                            )}
                            {products.length > 0 && (
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                <Package className="h-3 w-3" />
                                {products[0]?.name || products[0]?.content_name || `${products.length} item${products.length > 1 ? 's' : ''}`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 font-semibold text-slate-800 dark:text-slate-200">৳{order.amount.toLocaleString()}</td>
                        <td className="px-6 py-3">
                          <span 
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border cursor-help ${
                              order.fraudScore >= 75 ? 'bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/60' : 
                              order.fraudScore >= 35 ? 'bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/60' : 
                              'bg-green-50 text-green-700 border-green-150 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/60'
                            }`}
                            title={tooltipText}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              order.fraudScore >= 75 ? 'bg-rose-500' : 
                              order.fraudScore >= 35 ? 'bg-amber-500' : 'bg-green-500'
                            }`} />
                            Score: {order.fraudScore}/100
                          </span>
                        </td>
                        <td className="px-6 py-3 text-slate-400 font-mono dark:text-slate-500">{order.ageHours}h ago</td>
                        <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                          <button 
                            onClick={() => handleConfirmOrder(order.orderId)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => handleCancelOrder(order.orderId)}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
