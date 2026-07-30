import {
  ExternalLink,
  FileText,
  Loader2,
  Package,
  Printer,
  Search,
  Truck,
  XCircle,
} from 'lucide-react';
import type { CourierOrder, FulfillmentOrder } from '../../types';
import { getCapiStatusBadge, getCourierTrackingUrl, getStatusBadge } from './orderBadges';

export interface ShippedStatItem {
  label: string;
  shortLabel: string;
  value: number;
  tone: string;
  dot: string;
}

interface ShippedOrdersPanelProps {
  courierOrders: CourierOrder[];
  filteredCourierOrders: CourierOrder[];
  loadingOrders: boolean;
  shippedStatItems: ShippedStatItem[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  providerFilter: string;
  setProviderFilter: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  selectedShippedOrderIds: number[];
  setSelectedShippedOrderIds: (ids: number[]) => void;
  toggleSelectShippedOrder: (orderId: number) => void;
  areAllFilteredSelected: boolean;
  toggleSelectAllFilteredShipped: () => void;
  cancellingOrderId: number | null;
  handleCancelCourierOrder: (order: CourierOrder) => void;
  openInvoice: (order: FulfillmentOrder) => void;
  openLabel: (order: FulfillmentOrder) => void;
  openBulkInvoices: (ordersList: FulfillmentOrder[]) => void;
  openBulkLabels: (ordersList: FulfillmentOrder[]) => void;
}

export function ShippedOrdersPanel({
  courierOrders,
  filteredCourierOrders,
  loadingOrders,
  shippedStatItems,
  searchQuery,
  setSearchQuery,
  providerFilter,
  setProviderFilter,
  statusFilter,
  setStatusFilter,
  selectedShippedOrderIds,
  setSelectedShippedOrderIds,
  toggleSelectShippedOrder,
  areAllFilteredSelected,
  toggleSelectAllFilteredShipped,
  cancellingOrderId,
  handleCancelCourierOrder,
  openInvoice,
  openLabel,
  openBulkInvoices,
  openBulkLabels,
}: ShippedOrdersPanelProps) {
  return (
    <div id="orders-shipped" className="scroll-mt-24 flex flex-col space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:space-y-4 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-800 md:text-sm">Shipped Orders &amp; Delivery Tracking</h2>
          <p className="hidden text-xs text-slate-400 sm:block">
            Track delivery statuses on SteadFast, Pathao, or RedX. Delivered orders send purchase data; returned orders send refund data.
          </p>
        </div>
      </div>

      <div className="hidden grid-cols-5 gap-2 md:grid">
        {shippedStatItems.map(item => (
          <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className={`text-base font-bold leading-none ${item.tone}`}>{item.value}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-1.5 md:hidden" aria-label="Shipment status summary">
        {shippedStatItems.map(item => (
          <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-1 py-2 text-center">
            <span className={`mx-auto block h-1.5 w-1.5 rounded-full ${item.dot}`} />
            <p className={`mt-1 font-mono text-[12px] font-black leading-none ${item.tone}`}>{item.value}</p>
            <p className="mt-1 truncate text-[7px] font-black uppercase tracking-[0.04em] text-slate-500">{item.shortLabel}</p>
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div className="relative min-w-full flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            placeholder="Search by Order ID, tracking or recipient..."
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="min-w-0 flex-1 sm:w-[140px] sm:flex-none">
          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
            aria-label="Filter shipped orders by courier"
            className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Couriers</option>
            <option value="steadfast">SteadFast</option>
            <option value="pathao">Pathao</option>
            <option value="redx">RedX</option>
          </select>
        </div>

        <div className="min-w-0 flex-1 sm:w-[140px] sm:flex-none">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter shipped orders by status"
            className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedShippedOrderIds.length > 0 && (
        <div className="flex items-center justify-between p-3.5 bg-indigo-50  rounded-xl border border-indigo-200  animate-fade-in mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-indigo-600 " />
            <span className="text-xs font-bold text-slate-800 ">
              {selectedShippedOrderIds.length} {selectedShippedOrderIds.length === 1 ? 'order' : 'orders'} selected for bulk actions
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const selectedOrders = courierOrders.filter(o => selectedShippedOrderIds.includes(o.id));
                openBulkLabels(selectedOrders);
              }}
              className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Package className="w-3.5 h-3.5" />
              Bulk Print Labels ({selectedShippedOrderIds.length})
            </button>
            <button
              onClick={() => {
                const selectedOrders = courierOrders.filter(o => selectedShippedOrderIds.includes(o.id));
                openBulkInvoices(selectedOrders);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Bulk Print Invoices ({selectedShippedOrderIds.length})
            </button>
            <button
              onClick={() => setSelectedShippedOrderIds([])}
              className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100    rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="space-y-3 md:hidden">
        {loadingOrders ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-slate-400  ">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-500" />
            <p className="text-xs font-semibold">Fetching shipment details...</p>
          </div>
        ) : filteredCourierOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-400  ">
            <Truck className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-xs font-bold text-slate-600 ">No courier orders found</p>
          </div>
        ) : filteredCourierOrders.map((order) => {
          const isCancellable = !['cancelled', 'delivered', 'returned'].includes((order.courier_status || '').toLowerCase());
          const isCancelling = cancellingOrderId === order.id;
          return (
            <div key={order.id} className={`rounded-xl border bg-white p-4 shadow-sm ${
              (order.courier_status || '').toLowerCase() === 'booking_failed' ? 'border-rose-200' : 'border-slate-200'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedShippedOrderIds.includes(order.id)}
                    onChange={() => toggleSelectShippedOrder(order.id)}
                    className="mt-1 rounded accent-indigo-600"
                  />
                  <span>
                    <span className="block font-mono text-sm font-bold text-slate-900 ">#{order.order_id}</span>
                    <span className="mt-1 block text-xs font-bold capitalize text-slate-800 ">{order.courier_provider}</span>
                    <span className="mt-0.5 block font-mono text-xs text-slate-500">{order.courier_tracking_id || 'No tracking'}</span>
                  </span>
                </label>
                <span className="font-bold text-slate-900 ">BDT {Number(order.cod_amount || 0).toLocaleString()}</span>
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs ">
                <p className="font-bold text-slate-900 ">{order.recipient_name || 'Customer'}</p>
                <p className="mt-1 font-mono text-slate-500">{order.recipient_phone || 'No phone'}</p>
                <p className="mt-0.5 line-clamp-2 text-slate-500">{order.recipient_address || 'No address'}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>{getStatusBadge(order.courier_status)}</div>
                <div className="text-right">{getCapiStatusBadge(order.purchase_event_sent)}</div>
                <span className="font-mono text-slate-500">{new Date(order.created_at).toLocaleDateString()}</span>
                <span className="text-right text-slate-500">{order.delivery_charge > 0 ? `Charge BDT ${order.delivery_charge}` : 'No charge'}</span>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button onClick={() => openInvoice(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                  <FileText className="h-3.5 w-3.5" />
                  Invoice
                </button>
                <button onClick={() => openLabel(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">
                  <Package className="h-3.5 w-3.5" />
                  Label
                </button>
                {isCancellable ? (
                  <button onClick={() => handleCancelCourierOrder(order)} disabled={isCancelling} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">
                    {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    {isCancelling ? 'Cancelling...' : 'Cancel'}
                  </button>
                ) : (
                  <span className="self-center text-xs italic text-slate-400">{(order.courier_status || '').toLowerCase()}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden min-h-64 overflow-x-auto rounded-lg border border-slate-200 md:block">
        <table className="w-full min-w-[820px] divide-y divide-slate-100 text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={areAllFilteredSelected}
                  onChange={toggleSelectAllFilteredShipped}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                />
              </th>
              <th className="px-4 py-3">Order &amp; recipient</th>
              <th className="px-4 py-3">Courier</th>
              <th className="px-4 py-3">Amount / booked</th>
              <th className="px-4 py-3">Delivery status</th>
              <th className="px-4 py-3">Purchase sync</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 ">
            {loadingOrders ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-indigo-500 mb-2" />
                  Fetching shipment details...
                </td>
              </tr>
            ) : filteredCourierOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <Truck className="h-7 w-7 text-slate-300" />
                    <p className="font-bold text-slate-600 ">No courier orders found</p>
                    <p className="text-xs font-normal text-slate-400">Confirmed COD orders will appear here after they are booked with a courier.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredCourierOrders.map((order) => {
                const isCancellable = !['cancelled', 'delivered', 'returned'].includes(
                  (order.courier_status || '').toLowerCase()
                );
                const isCancelling = cancellingOrderId === order.id;
                return (
                <tr key={order.id} className={`transition-colors hover:bg-slate-50/70 ${
                  (order.courier_status || '').toLowerCase() === 'booking_failed' ? 'bg-rose-50/30' : ''
                }`}>
                  <td className="px-4 py-3 text-center align-top">
                    <input
                      type="checkbox"
                      checked={selectedShippedOrderIds.includes(order.id)}
                      onChange={() => toggleSelectShippedOrder(order.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">#{order.order_id}</span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold uppercase text-slate-500">
                          {order.courier_provider}
                        </span>
                      </div>
                      <p className="mt-1 font-bold text-slate-800">{order.recipient_name || '-'}</p>
                      <p className="font-mono text-xs text-slate-500">{order.recipient_phone || '-'}</p>
                      <p className="mt-0.5 max-w-[260px] truncate text-xs text-slate-400" title={order.recipient_address}>
                        {order.recipient_address || '-'}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Tracking
                      </span>
                      {order.courier_tracking_id ? (
                        <span className="mt-1 flex items-center gap-1 font-mono text-xs font-semibold text-slate-700">
                          {order.courier_tracking_id}
                          <a
                            href={getCourierTrackingUrl(order.courier_provider, order.courier_tracking_id)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-500 hover:text-indigo-700 inline"
                          >
                            <ExternalLink className="w-2.5 h-2.5 inline" />
                          </a>
                        </span>
                      ) : (
                        <span className="mt-1 text-xs text-slate-400">No tracking yet</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col text-xs leading-tight">
                      <span className="font-bold text-slate-900">BDT {Number(order.cod_amount || 0).toLocaleString()}</span>
                      {order.delivery_charge > 0 && (
                        <span className="mt-0.5 text-xs font-medium text-slate-400">Charge BDT {order.delivery_charge}</span>
                      )}
                      <span className="mt-1 font-mono text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(order.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">{getStatusBadge(order.courier_status)}</td>
                  <td className="px-4 py-3 align-top">{getCapiStatusBadge(order.purchase_event_sent)}</td>
                  <td className="px-4 py-3 text-right align-top">
                    <div className="flex justify-end gap-1.5 whitespace-nowrap">
                    <button
                      onClick={() => openInvoice(order)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100"
                      title="View and Print Invoice"
                      aria-label="View and print invoice"
                    >
                      <FileText className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openLabel(order)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 transition-colors hover:bg-violet-100"
                      title="Preview and Print Courier Label"
                      aria-label="Preview and print courier label"
                    >
                      <Package className="h-3.5 w-3.5" />
                    </button>
                    {isCancellable ? (
                      <button
                        id={`cancel-courier-order-${order.id}`}
                        onClick={() => handleCancelCourierOrder(order)}
                        disabled={isCancelling}
                        title={`Cancel this ${order.courier_provider} order`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Cancel ${order.courier_provider} order`}
                      >
                        {isCancelling ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" />
                        )}
                      </button>
                    ) : (
                      <span className="self-center px-1 text-xs italic text-slate-400">
                        {(order.courier_status || '').toLowerCase() === 'cancelled' ? 'Cancelled' :
                         (order.courier_status || '').toLowerCase() === 'delivered' ? 'Delivered' : 'Returned'}
                      </span>
                    )}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ShippedOrdersPanel;
