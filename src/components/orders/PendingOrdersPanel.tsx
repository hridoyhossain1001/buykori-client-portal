import React from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Search,
  Send,
  Truck,
} from 'lucide-react';
import type { DeferredOrder } from '../../types';
import { formatHeldAge, usablePhone } from './ordersUtils';

interface PendingOrdersPanelProps {
  pendingSearch: string;
  setPendingSearch: (value: string) => void;
  pendingFraudFilter: string;
  setPendingFraudFilter: (value: string) => void;
  pendingSort: 'oldest' | 'newest';
  setPendingSort: (value: 'oldest' | 'newest') => void;
  selectedPendingOrderIds: string[];
  setSelectedPendingOrderIds: (ids: string[]) => void;
  togglePendingOrder: (orderId: string, checked: boolean) => void;
  openFirstSelectedPendingOrder: () => void;
  pendingPageOrders: DeferredOrder[];
  pendingFilteredCount: number;
  pendingPageSize: number;
  pendingPageSafe: number;
  pendingTotalPages: number;
  setPendingPage: (updater: (page: number) => number) => void;
  goToPendingPage: (page: number) => void;
  expandedOrderId: string | null;
  toggleExpand: (id: string) => void;
  openInvoice: (order: DeferredOrder) => void;
  openPendingCourierModal: (order: DeferredOrder) => void;
  renderCourierVerdict: (details?: DeferredOrder['fraudDetails'], scoreValue?: number, compact?: boolean) => React.ReactNode;
  copyPhone: (phone: unknown) => void;
}

export function PendingOrdersPanel({
  pendingSearch,
  setPendingSearch,
  pendingFraudFilter,
  setPendingFraudFilter,
  pendingSort,
  setPendingSort,
  selectedPendingOrderIds,
  setSelectedPendingOrderIds,
  togglePendingOrder,
  openFirstSelectedPendingOrder,
  pendingPageOrders,
  pendingFilteredCount,
  pendingPageSize,
  pendingPageSafe,
  pendingTotalPages,
  setPendingPage,
  goToPendingPage,
  expandedOrderId,
  toggleExpand,
  openInvoice,
  openPendingCourierModal,
  renderCourierVerdict,
  copyPhone,
}: PendingOrdersPanelProps) {
  return (
    <div id="orders-pending" className="scroll-mt-24 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-3 md:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={pendingSearch}
              onChange={(event) => setPendingSearch(event.target.value)}
              placeholder="Search order ID, name or phone…"
              className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-2 text-[10px] outline-none focus:border-[#2f80df]"
            />
          </div>
          <select
            value={pendingFraudFilter}
            onChange={(event) => setPendingFraudFilter(event.target.value)}
            aria-label="Filter pending orders by fraud level"
            className="h-9 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold text-slate-700"
          >
            <option value="all">All fraud levels</option>
            <option value="EXCELLENT">Best customers</option>
            <option value="GOOD">Good customers</option>
            <option value="MODERATE">Moderate risk</option>
            <option value="RISKY">Risky customers</option>
            <option value="HIGH_RISK">High risk</option>
            <option value="NEW_CUSTOMER">New customers</option>
            <option value="UNKNOWN">Check unavailable</option>
          </select>
        </div>
        <div className="mt-2 grid grid-cols-[104px_1fr_116px] items-center gap-2">
          <select
            value={pendingSort}
            onChange={(event) => setPendingSort(event.target.value as 'oldest' | 'newest')}
            aria-label="Sort pending courier orders"
            className="h-8 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold text-slate-700"
          >
            <option value="newest">Latest first ▼</option>
            <option value="oldest">Oldest first ▼</option>
          </select>
          <span className="truncate text-[9px] font-bold text-slate-400">{selectedPendingOrderIds.length} selected</span>
          <button
            type="button"
            disabled={selectedPendingOrderIds.length === 0}
            onClick={openFirstSelectedPendingOrder}
            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[#2f80df] px-2 text-[9px] font-bold text-white disabled:border disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <Truck className="h-3 w-3" />
            Book selected
          </button>
        </div>
      </div>

      <div className="hidden flex-col gap-3 border-b border-slate-200 p-4 md:flex lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            value={pendingSearch}
            onChange={(event) => setPendingSearch(event.target.value)}
            placeholder="Search order ID, name or phone…"
            className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <select
          value={pendingFraudFilter}
          onChange={(event) => setPendingFraudFilter(event.target.value)}
          aria-label="Filter pending orders by fraud level"
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
        >
          <option value="all">All fraud levels</option>
          <option value="EXCELLENT">Best customers</option>
          <option value="GOOD">Good customers</option>
          <option value="MODERATE">Moderate risk</option>
          <option value="RISKY">Risky customers</option>
          <option value="HIGH_RISK">High risk</option>
          <option value="NEW_CUSTOMER">New customers</option>
          <option value="UNKNOWN">Check unavailable</option>
        </select>
        <select
          value={pendingSort}
          onChange={(event) => setPendingSort(event.target.value as 'oldest' | 'newest')}
          aria-label="Sort pending courier orders"
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
        >
          <option value="newest">Latest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <span className="text-xs font-bold text-slate-500">{selectedPendingOrderIds.length} selected</span>
        <button
          type="button"
          disabled={selectedPendingOrderIds.length === 0}
          onClick={openFirstSelectedPendingOrder}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          <Truck className="h-4 w-4" />
          Book selected
        </button>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {pendingPageOrders.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
            <p className="text-xs font-semibold">No COD orders are waiting for your review.</p>
          </div>
        ) : pendingPageOrders.map((order) => {
          const isExpanded = expandedOrderId === order.orderId;
          const products = order.products || [];
          const selected = selectedPendingOrderIds.includes(order.orderId);
          const productSubtotal = Number(order.productSubtotal ?? products.reduce((sum, product) => sum + (Number(product.price || 0) * Number(product.quantity || 1)), 0));
          const deliveryAndAdjustments = Number(order.deliveryCharge || 0) + Number(order.otherAdjustment || 0);
          return (
            <article key={order.orderId} className={`px-3 py-2.5 ${selected ? 'bg-blue-50/40' : 'bg-white'}`}>
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => togglePendingOrder(order.orderId, event.target.checked)}
                  aria-label={`Select pending courier order ${order.orderId}`}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#2f80df]"
                />
                <button type="button" onClick={() => toggleExpand(order.orderId)} className="min-w-0 flex-1 text-left" aria-expanded={isExpanded}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1 font-mono text-[12px] font-bold leading-none text-slate-900">
                        #{order.orderId}
                        {isExpanded ? <ChevronUp className="h-3 w-3 text-[#2f80df]" /> : <ChevronDown className="h-3 w-3 text-slate-400" />}
                      </p>
                      <p className="mt-1 truncate text-[10px] font-semibold text-slate-800">
                        {order.recipientName || 'Customer unavailable'}
                        <span className="ml-1 font-normal text-slate-400">· {usablePhone(order.recipientPhone) || usablePhone(order.customer) || 'No phone'}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-right">
                      <strong className="block text-[13px] font-black leading-none text-slate-900">BDT {Number(order.amount || 0).toLocaleString()}</strong>
                      <span className={`mt-1 block text-[8px] font-bold ${(Number(order.ageHours) || 0) >= 168 ? 'text-orange-600' : 'text-slate-400'}`}>
                        {formatHeldAge(order.ageHours)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    {renderCourierVerdict(order.fraudDetails, order.fraudScore, true)}
                    <span className="text-[8px] font-medium text-slate-400">{isExpanded ? 'Hide details' : 'View details'}</span>
                  </div>
                </button>
              </div>

              {isExpanded && (
                <div className="mt-2 grid gap-2 border-t border-slate-100 pt-2">
                  <div className="rounded-lg bg-slate-50 p-2.5">
                    <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Customer details</p>
                    <div className="mt-1.5 grid grid-cols-[44px_1fr] gap-x-2 gap-y-1 text-[9px]">
                      <span className="font-bold text-slate-400">Name</span>
                      <strong className="truncate text-slate-700">{order.recipientName || 'Customer unavailable'}</strong>
                      <span className="font-bold text-slate-400">Phone</span>
                      <span className="font-mono font-semibold text-slate-700">{usablePhone(order.recipientPhone) || 'No phone'}</span>
                      <span className="font-bold text-slate-400">Address</span>
                      <span className="leading-3 text-slate-700">{order.recipientAddress || 'Address unavailable'}</span>
                    </div>
                  </div>
                  {products.length > 0 && (
                    <div className="rounded-lg border border-slate-200 p-2.5">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-slate-400">Order items · {products.length}</p>
                      <div className="mt-1.5 space-y-1.5">
                        {products.slice(0, 3).map((product, index) => (
                          <div key={index} className="flex items-start justify-between gap-2 text-[9px]">
                            <span className="min-w-0 truncate font-semibold text-slate-700">{product.name || product.content_name || 'Product'} · Qty {product.quantity || 1}</span>
                            <strong className="shrink-0 text-slate-700">BDT {Number(product.price || 0).toLocaleString()}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[9px]">
                        <div className="flex justify-between text-slate-500"><span>Product subtotal</span><strong className="text-slate-700">BDT {productSubtotal.toLocaleString()}</strong></div>
                        <div className="flex justify-between text-slate-500"><span>Delivery &amp; adjustments</span><strong className="text-slate-700">BDT {deliveryAndAdjustments.toLocaleString()}</strong></div>
                        <div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-slate-800"><span>Total order value</span><strong className="text-[#285ac7]">BDT {Number(order.orderTotal ?? order.amount ?? 0).toLocaleString()}</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button onClick={() => openInvoice(order)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold text-slate-700">Invoice</button>
                <button onClick={() => openPendingCourierModal(order)} className="h-8 rounded-lg bg-[#2f80df] px-2 text-[9px] font-bold text-white">Book courier</button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto min-h-64 md:block">
        <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[750px]  ">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500  ">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={pendingPageOrders.length > 0 && pendingPageOrders.every((order) => selectedPendingOrderIds.includes(order.orderId))}
                  onChange={(event) => setSelectedPendingOrderIds(event.target.checked ? pendingPageOrders.map((order) => order.orderId) : [])}
                  aria-label="Select all visible pending courier orders"
                  className="accent-indigo-600"
                />
              </th>
              <th className="px-6 py-3">Order ID</th>
              <th className="px-6 py-3">Customer Info</th>
              <th className="px-6 py-3">Value</th>
              <th className="px-6 py-3">Fraud Check</th>
              <th className="px-6 py-3">Time Held</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 ">
            {pendingPageOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium ">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                  No COD orders are waiting for your review.
                </td>
              </tr>
            ) : (
              pendingPageOrders.map((order) => {
                const isExpanded = expandedOrderId === order.orderId;
                const products = order.products || [];
                const isSelected = selectedPendingOrderIds.includes(order.orderId);
                return (
                  <React.Fragment key={order.orderId}>
                    <tr className={`hover:bg-slate-50/50 transition-colors ${isExpanded || isSelected ? 'bg-indigo-50/20' : ''}`}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(event) => togglePendingOrder(order.orderId, event.target.checked)}
                          aria-label={`Select pending courier order ${order.orderId}`}
                          className="accent-indigo-600"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => toggleExpand(order.orderId)}
                          className="flex items-center gap-1.5 font-mono font-bold text-slate-800  hover:text-indigo-600  transition-colors cursor-pointer"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                          {order.orderId}
                        </button>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-col gap-0.5">
                          {order.recipientName && order.recipientName !== '-' && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(order.orderId)}
                              className="w-fit text-left font-semibold text-slate-700 hover:text-indigo-600   transition-colors cursor-pointer"
                              aria-expanded={isExpanded}
                              title="View customer and order details"
                            >
                              {order.recipientName}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 font-semibold text-slate-800 ">BDT {Number(order.amount || 0).toLocaleString()}</td>
                      <td className="px-6 py-3">
                        {renderCourierVerdict(order.fraudDetails, order.fraudScore)}
                      </td>
                      <td className="px-6 py-3 text-slate-400 font-mono ">{formatHeldAge(order.ageHours)}</td>
                      <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                        <button
                          onClick={() => openInvoice(order)}
                          className="btn-touch-expand px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700    text-xs font-bold rounded shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="View and Print Invoice"
                        >
                          <FileText className="w-2.5 h-2.5" /> Invoice
                        </button>
                        <button
                          onClick={() => openPendingCourierModal(order)}
                          className="btn-touch-expand px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <Send className="w-2.5 h-2.5" /> Book Courier
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,.9fr)_minmax(0,1.2fr)]">
                            <section className="max-h-[210px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
                              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                <span>Customer details</span>
                                <span className="text-slate-300">·</span>
                                <span className="font-mono">#{order.orderId}</span>
                              </div>
                              <dl className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
                                <dt className="font-bold uppercase text-slate-400">Name</dt>
                                <dd className="truncate font-semibold text-slate-800">{order.recipientName || '-'}</dd>
                                <dt className="font-bold uppercase text-slate-400">Phone</dt>
                                <dd className="flex min-w-0 items-center gap-1.5">
                                  <span className="truncate font-mono font-semibold text-slate-800">{usablePhone(order.recipientPhone) || '-'}</span>
                                  {usablePhone(order.recipientPhone) && (
                                    <button
                                      type="button"
                                      onClick={() => copyPhone(order.recipientPhone)}
                                      className="shrink-0 rounded p-1 text-indigo-500 hover:bg-indigo-50"
                                      title="Copy phone number"
                                      aria-label="Copy phone number"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                  )}
                                </dd>
                                <dt className="font-bold uppercase text-slate-400">Address</dt>
                                <dd className="line-clamp-2 font-semibold leading-relaxed text-slate-800" title={order.recipientAddress}>
                                  {order.recipientAddress || '-'}
                                </dd>
                              </dl>
                            </section>

                            <section className="max-h-[210px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
                              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                <span>Order items</span>
                                <span className="text-slate-300">·</span>
                                <span>{products.length} item{products.length === 1 ? '' : 's'}</span>
                              </div>
                              {products.length === 0 ? (
                                <p className="py-3 text-center text-xs text-slate-400">Product details not available.</p>
                              ) : (
                                <div className="space-y-2">
                                  {products.slice(0, 3).map((product, index) => (
                                    <div key={index} className="flex items-start justify-between gap-4 border-b border-dashed border-slate-100 pb-2 last:border-0">
                                      <div className="min-w-0">
                                        <p className="truncate text-xs font-semibold text-slate-800" title={product.name || product.content_name}>
                                          {product.name || product.content_name || 'Product'}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">Qty {product.quantity || 1}</p>
                                      </div>
                                      <strong className="shrink-0 text-xs text-slate-800">
                                        BDT {Number(product.price || 0).toLocaleString()}
                                      </strong>
                                    </div>
                                  ))}
                                  {products.length > 3 && (
                                    <p className="text-xs font-semibold text-indigo-600">+{products.length - 3} more items</p>
                                  )}
                                </div>
                              )}
                              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
                                <div className="flex items-center justify-between text-slate-500">
                                  <span>Product subtotal</span>
                                  <strong className="text-slate-700">BDT {Number(order.productSubtotal ?? order.amount ?? 0).toLocaleString()}</strong>
                                </div>
                                <div className="flex items-center justify-between text-slate-500">
                                  <span>Delivery &amp; adjustments</span>
                                  <strong className="text-slate-700">BDT {Number((order.deliveryCharge || 0) + (order.otherAdjustment || 0)).toLocaleString()}</strong>
                                </div>
                                <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 font-bold text-slate-800">
                                  <span>Total order value</span>
                                  <strong className="text-indigo-700">BDT {Number(order.orderTotal ?? order.amount ?? 0).toLocaleString()}</strong>
                                </div>
                              </div>
                            </section>
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
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
        <p className="text-xs text-slate-400">
          Showing {pendingFilteredCount === 0 ? 0 : (pendingPageSafe - 1) * pendingPageSize + 1}–{Math.min(pendingPageSafe * pendingPageSize, pendingFilteredCount)} of {pendingFilteredCount} pending orders
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={pendingPageSafe <= 1}
            onClick={() => setPendingPage((page) => Math.max(1, page - 1))}
            className="h-8 min-w-8 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-600 disabled:opacity-40"
          >
            ‹
          </button>
          {Array.from({ length: pendingTotalPages }, (_, index) => index + 1).slice(0, 5).map((page) => (
            <button
              type="button"
              key={page}
              onClick={() => goToPendingPage(page)}
              className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold ${page === pendingPageSafe ? 'bg-indigo-600 text-white' : 'border border-slate-200 text-slate-600'}`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            disabled={pendingPageSafe >= pendingTotalPages}
            onClick={() => setPendingPage((page) => Math.min(pendingTotalPages, page + 1))}
            className="h-8 min-w-8 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-600 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

export default PendingOrdersPanel;
