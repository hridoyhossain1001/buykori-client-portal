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
}: CodProtectionViewProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const toggleExpand = (orderId: string) => setExpandedOrderId(prev => prev === orderId ? null : orderId);
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
                <h3 className="font-bold text-slate-850 text-sm dark:text-white">Order Management</h3>
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
                  onChange={(e) => setOrderManagementDraftEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
              </label>
            </div>
          </div>
          
          <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800">
            {orderManagementDraftEnabled ? (
              <span><span className="font-semibold text-indigo-600 dark:text-indigo-400">Enabled:</span> Auto-book courier on Confirm. Conversion event fires upon Courier Delivery.</span>
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
              {orderManagementDraftEnabled ? <><Truck className="w-3 h-3" /> Full Flow Active</> : <><Zap className="w-3 h-3" /> Simple Flow Active</>}
            </div>
            <button
              type="button"
              disabled={savingOrderMgmt}
              onClick={handleSaveOrderManagement}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-200 dark:text-slate-900 text-[10px] font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {savingOrderMgmt ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
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
                <h3 className="font-bold text-slate-850 text-sm dark:text-white">COD Protection</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Hold & Release Triggers</p>
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
                  onChange={(e) => setDeferredEnabled(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Auto Cutoff</label>
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
              <label className="block text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Trigger Status</label>
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
              disabled={savingDeferredSettings}
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
            <span className="text-xs font-semibold text-indigo-750/70 dark:text-indigo-300/70">Pending Telemetry</span>
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
            <span className="text-xs font-semibold text-emerald-750/70 dark:text-emerald-300/70">Transited Events</span>
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
            <span className="text-xs font-semibold text-rose-750/70 dark:text-rose-300/70">Needs Audit</span>
          </div>
        </div>

      </div>

      {/* Main Action Bar & Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col space-y-4 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h3 className="font-bold text-slate-850 text-sm uppercase tracking-wide dark:text-white">COD Protected Purchases Queue</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Verifying customer purchase events ensures Meta and TikTok optimize on genuine conversion signals only.</p>
          </div>
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

        <div className="overflow-x-auto min-h-64">
          <table className="w-full text-left text-xs text-slate-650 divide-y divide-slate-100 min-w-[750px] dark:text-slate-300 dark:divide-slate-800">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-555 dark:bg-slate-950 dark:text-slate-400">
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
                <th className="px-6 py-3">Customer Identifier</th>
                <th className="px-6 py-3">Transaction Value</th>
                <th className="px-6 py-3">Fraud Risk Index</th>
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
                  const isExpanded = expandedOrderId === order.orderId;
                  const activeChecks = [];
                  if (order.fraudDetails) {
                    if (order.fraudDetails.ip_mismatch) activeChecks.push('IP Mismatch');
                    if (order.fraudDetails.disposable_email) activeChecks.push('Disposable Email');
                    if (order.fraudDetails.velocity_limit) activeChecks.push('Velocity Trigger');
                    if (order.fraudDetails.gibberish_name) activeChecks.push('Gibberish Name');
                  }
                  const tooltipText = activeChecks.length > 0 ? activeChecks.join(', ') : 'Passed structural checks';
                  const products: any[] = order.products || [];

                  return (
                    <React.Fragment key={order.orderId}>
                      <tr className={`hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/40 ${isSelected ? 'bg-indigo-50/10 dark:bg-indigo-950/20' : ''} ${isExpanded ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}>
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
                        <td className="px-6 py-3">
                          <button
                            onClick={() => toggleExpand(order.orderId)}
                            className="flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                            {order.orderId}
                          </button>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-col gap-0.5">
                            {order.recipientName && order.recipientName !== '—' && (
                              <span className="font-semibold text-slate-700 dark:text-slate-200">{order.recipientName}</span>
                            )}
                            <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{order.customer}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 font-semibold text-slate-850 dark:text-slate-200">৳{order.amount.toLocaleString()}</td>
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

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80 dark:bg-slate-900/60">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Customer Info Card */}
                              <div className="space-y-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Customer Details</p>
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                                      <User className="w-3.5 h-3.5 text-indigo-500" />
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase font-bold">Name</p>
                                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{order.recipientName || '—'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                                      <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase font-bold">Phone</p>
                                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 font-mono">{order.recipientPhone || order.customer || '—'}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                                      <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase font-bold">Address</p>
                                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{order.recipientAddress || '—'}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Products Card */}
                              <div className="space-y-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                  Order Items {products.length > 0 && <span className="ml-1 text-indigo-500">({products.length})</span>}
                                </p>
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                  {products.length === 0 ? (
                                    <div className="px-4 py-5 text-center">
                                      <Package className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                                      <p className="text-[10px] text-slate-400">Product details not available for this order</p>
                                    </div>
                                  ) : (
                                    <table className="w-full text-xs">
                                      <thead className="bg-slate-50 dark:bg-slate-950">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-[9px] font-bold uppercase text-slate-400">Product</th>
                                          <th className="px-3 py-2 text-center text-[9px] font-bold uppercase text-slate-400">Qty</th>
                                          <th className="px-3 py-2 text-right text-[9px] font-bold uppercase text-slate-400">Price</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {products.map((p: any, i: number) => (
                                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 max-w-[160px] truncate" title={p.name}>{p.name}</td>
                                            <td className="px-3 py-2 text-center font-bold text-slate-600 dark:text-slate-300">{p.quantity}</td>
                                            <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{p.price > 0 ? `৳${p.price.toLocaleString()}` : '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
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
