import React from 'react';
import { DollarSign, Loader2, MapPin, Phone, Send, Truck, User, XCircle } from 'lucide-react';
import type { FulfillmentOrder } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import type { PathaoStore } from '../../services/courierApi';
import { normalizeBDPhone, productMeta } from './ordersUtils';

interface RedxArea {
  id: number | string;
  name: string;
  post_code?: number;
}

interface CourierBookingModalProps {
  selectedOrder: FulfillmentOrder;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submittingCourier: boolean;
  courierProvider: string;
  setCourierProvider: (value: string) => void;
  recipientName: string;
  setRecipientName: (value: string) => void;
  recipientPhone: string;
  setRecipientPhone: (value: string) => void;
  recipientAddress: string;
  setRecipientAddress: (value: string) => void;
  codAmount: number;
  setCodAmount: (value: number) => void;
  itemWeight: number;
  setItemWeight: (value: number) => void;
  itemQuantity: number;
  setItemQuantity: (value: number) => void;
  loadingStores: boolean;
  pathaoStores: PathaoStore[];
  selectedStoreId: number | string | '';
  setSelectedStoreId: (value: number) => void;
  loadingPathaoLocations: boolean;
  pathaoCities: Array<{ city_id: number; city_name: string }>;
  pathaoZones: Array<{ zone_id: number; zone_name: string }>;
  pathaoAreas: Array<{ area_id: number; area_name: string }>;
  selectedPathaoCity: number | '';
  setSelectedPathaoCity: (value: number | '') => void;
  selectedPathaoZone: number | '';
  setSelectedPathaoZone: (value: number | '') => void;
  selectedPathaoArea: number | '';
  setSelectedPathaoArea: (value: number | '') => void;
  loadingRedxAreas: boolean;
  redxAreas: RedxArea[];
  filteredRedxAreas: RedxArea[];
  redxAreaSearch: string;
  setRedxAreaSearch: (value: string) => void;
  redxDeliveryAreaId: string;
  setRedxDeliveryAreaId: (value: string) => void;
  redxDeliveryAreaName: string;
  setRedxDeliveryAreaName: (value: string) => void;
  redxPickupStoreId: string;
  setRedxPickupStoreId: (value: string) => void;
}

export function CourierBookingModal({
  selectedOrder,
  onClose,
  onSubmit,
  submittingCourier,
  courierProvider,
  setCourierProvider,
  recipientName,
  setRecipientName,
  recipientPhone,
  setRecipientPhone,
  recipientAddress,
  setRecipientAddress,
  codAmount,
  setCodAmount,
  itemWeight,
  setItemWeight,
  itemQuantity,
  setItemQuantity,
  loadingStores,
  pathaoStores,
  selectedStoreId,
  setSelectedStoreId,
  loadingPathaoLocations,
  pathaoCities,
  pathaoZones,
  pathaoAreas,
  selectedPathaoCity,
  setSelectedPathaoCity,
  selectedPathaoZone,
  setSelectedPathaoZone,
  selectedPathaoArea,
  setSelectedPathaoArea,
  loadingRedxAreas,
  redxAreas,
  filteredRedxAreas,
  redxAreaSearch,
  setRedxAreaSearch,
  redxDeliveryAreaId,
  setRedxDeliveryAreaId,
  redxDeliveryAreaName,
  setRedxDeliveryAreaName,
  redxPickupStoreId,
  setRedxPickupStoreId,
}: CourierBookingModalProps) {
  return (
    <Modal
      onClose={onClose}
      labelledBy="courier-booking-title"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm animate-fade-in sm:p-4"
      panelClassName="flex max-h-[calc(100vh-1.5rem)] w-full max-w-lg flex-col space-y-2 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl animate-slide-in-up sm:max-h-[calc(100vh-2rem)]"
    >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-indigo-600 " />
            <h3 id="courier-booking-title" className="font-bold text-slate-800  text-base">Book Consignment with Courier</h3>
          </div>
          <Button
            variant="icon"
            size="lg"
            onClick={onClose}
            aria-label="Close courier booking dialog"
          >
            <XCircle className="w-5 h-5" />
          </Button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={onSubmit} className="space-y-2">

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* Order Meta details read-only */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <span className="block text-xs text-slate-400 uppercase font-bold tracking-wider">Order Reference ID</span>
              <span className="font-mono font-bold text-sm text-slate-800 ">{selectedOrder.orderId || selectedOrder.order_id}</span>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
              <span className="block text-xs text-slate-400 uppercase font-bold tracking-wider">Original Value</span>
              <span className="font-bold text-sm text-slate-800 ">BDT {(selectedOrder.amount || selectedOrder.cod_amount || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Order Items (Products) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-500  uppercase tracking-wider">Order Items</label>
            <div className="bg-white  rounded-lg border border-slate-200  overflow-hidden">
              {(!selectedOrder?.products || selectedOrder.products.length === 0) ? (
                <div className="px-4 py-3 text-center">
                  <p className="text-xs text-slate-400">Product details not available</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 ">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-bold uppercase text-slate-400">Product</th>
                      <th className="px-3 py-1.5 text-center text-xs font-bold uppercase text-slate-400">Qty</th>
                      <th className="px-3 py-1.5 text-right text-xs font-bold uppercase text-slate-400">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 ">
                    {selectedOrder.products.map((p, i: number) => {
                      const meta = productMeta(p);
                      return (
                        <tr key={i} className="hover:bg-slate-50/50 ">
                          <td className="max-w-[260px] px-3 py-1.5">
                            <p className="font-medium leading-snug text-slate-700" title={p.name}>{p.name}</p>
                            {meta.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {meta.map((item) => (
                                  <span key={`${item.label}-${item.value}`} className={`rounded px-1.5 py-0.5 text-xs font-bold ${item.category ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700'}`}>
                                    {item.label}: {item.value}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-center font-bold text-slate-600 ">{p.quantity}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-slate-700 ">{Number(p.price || 0) > 0 ? `BDT ${Number(p.price || 0).toLocaleString()}` : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Courier Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-500  uppercase tracking-wider mb-1">Select Courier Partner</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-2 transition-all duration-200 ${
                courierProvider === 'steadfast'
                  ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700   '
                  : 'border-slate-200 hover:bg-slate-50  '
              }`}>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 ">SteadFast Courier</span>
                  <span className="text-xs text-slate-400 mt-0.5">Automated API Booking</span>
                </div>
                <input
                  type="radio"
                  name="provider"
                  value="steadfast"
                  checked={courierProvider === 'steadfast'}
                  onChange={() => setCourierProvider('steadfast')}
                  className="accent-indigo-600 cursor-pointer h-4 w-4"
                />
              </label>

              <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-2 transition-all duration-200 ${
                courierProvider === 'pathao'
                  ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700   '
                  : 'border-slate-200 hover:bg-slate-50  '
              }`}>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 ">Pathao Courier</span>
                  <span className="text-xs text-slate-400 mt-0.5">OAuth-secured Aladdin Booking</span>
                </div>
                <input
                  type="radio"
                  name="provider"
                  value="pathao"
                  checked={courierProvider === 'pathao'}
                  onChange={() => setCourierProvider('pathao')}
                  className="accent-indigo-600 cursor-pointer h-4 w-4"
                />
              </label>

              <label className={`flex cursor-pointer items-center justify-between rounded-xl border p-2 transition-all duration-200 ${
                courierProvider === 'redx'
                  ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700   '
                  : 'border-slate-200 hover:bg-slate-50  '
              }`}>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-800 ">RedX Courier</span>
                  <span className="text-xs text-slate-400 mt-0.5">Token-secured OpenAPI Booking</span>
                </div>
                <input
                  type="radio"
                  name="provider"
                  value="redx"
                  checked={courierProvider === 'redx'}
                  onChange={() => setCourierProvider('redx')}
                  className="accent-indigo-600 cursor-pointer h-4 w-4"
                />
              </label>
            </div>
          </div>

          {/* Recipient details */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-bold text-indigo-600  uppercase tracking-wider border-b border-slate-100  pb-1">
              Recipient Information
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">Customer Name</label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Hridoy Hossain"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    onBlur={(e) => {
                      // Auto-normalize BD phone format on field blur
                      const normalized = normalizeBDPhone(e.target.value);
                      setRecipientPhone(normalized);
                    }}
                    placeholder="e.g. 01712345678 or +8801712345678"
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">Delivery Address</label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <textarea
                  required
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="Enter complete shipping details (Street, District, Area)..."
                  rows={2}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">Cash on Delivery Amount to Collect (BDT)</label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="number"
                    required
                    value={codAmount}
                    onChange={(e) => setCodAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500    font-bold"
                  />
                </div>
              </div>

              {/* Pathao stores are fetched from the courier API when credentials are available. */}
              {courierProvider === 'pathao' && (
                <div className="space-y-3 md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">Pathao Store</label>
                  {loadingStores ? (
                    <div className="py-2 px-3 bg-slate-50  border border-slate-200  rounded-lg text-xs text-slate-500 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                      Stores loading...
                    </div>
                  ) : pathaoStores.length > 0 ? (
                    <select
                      value={selectedStoreId}
                      onChange={(e) => setSelectedStoreId(Number(e.target.value))}
                      className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                    >
                      {pathaoStores.map((store) => (
                        <option key={store.store_id} value={store.store_id}>
                          {store.store_name} (ID: {store.store_id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="py-2 px-3 bg-red-50  border border-red-200  rounded-lg text-xs text-red-600  font-semibold flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 shrink-0" />
                      Pathao is not connected yet. Add its API details in Settings.
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <select
                      value={selectedPathaoCity}
                      onChange={(e) => setSelectedPathaoCity(e.target.value ? Number(e.target.value) : '')}
                      disabled={loadingPathaoLocations || pathaoCities.length === 0}
                      className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-60"
                    >
                      <option value="">Auto-detect city</option>
                      {pathaoCities.map((city) => <option key={city.city_id} value={city.city_id}>{city.city_name}</option>)}
                    </select>
                    <select
                      value={selectedPathaoZone}
                      onChange={(e) => setSelectedPathaoZone(e.target.value ? Number(e.target.value) : '')}
                      disabled={selectedPathaoCity === '' || pathaoZones.length === 0}
                      className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-60"
                    >
                      <option value="">Auto-detect zone</option>
                      {pathaoZones.map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zone.zone_name}</option>)}
                    </select>
                    <select
                      value={selectedPathaoArea}
                      onChange={(e) => setSelectedPathaoArea(e.target.value ? Number(e.target.value) : '')}
                      disabled={selectedPathaoZone === '' || pathaoAreas.length === 0}
                      className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-60"
                    >
                      <option value="">Auto-detect area</option>
                      {pathaoAreas.map((area) => <option key={area.area_id} value={area.area_id}>{area.area_name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {courierProvider === 'redx' && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:col-span-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">RedX Delivery Area</label>
                    {loadingRedxAreas ? (
                      <div className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg   ">Loading areas...</div>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          type="search"
                          value={redxAreaSearch}
                          onChange={(e) => setRedxAreaSearch(e.target.value)}
                          placeholder="Search area, post code, or ID"
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                        />
                        <select
                          required
                          value={redxDeliveryAreaId}
                          onChange={(e) => {
                            const area = redxAreas.find((item) => String(item.id) === e.target.value);
                            setRedxDeliveryAreaId(e.target.value);
                            if (area) {
                              setRedxDeliveryAreaName(area.name);
                              setRedxAreaSearch(area.name);
                            }
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
                        >
                          <option value="">Select from matches</option>
                          {filteredRedxAreas.map((area) => <option key={area.id} value={area.id}>{area.name}{area.post_code ? ` (${area.post_code})` : ''} - ID {area.id}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">RedX Delivery Area Name</label>
                    <input required type="text" value={redxDeliveryAreaName} onChange={(e) => setRedxDeliveryAreaName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">RedX Pickup Store ID</label>
                    <input type="number" value={redxPickupStoreId} onChange={(e) => setRedxPickupStoreId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs" />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">Parcel Weight (KG)</label>
                <select
                  value={itemWeight}
                  onChange={(e) => setItemWeight(Number(e.target.value))}
                  className="w-full p-1.5 text-xs bg-slate-50  border border-slate-200  rounded-lg text-slate-800  focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value={0.5}>0.5 KG (Standard)</option>
                  <option value={1.0}>1.0 KG</option>
                  <option value={2.0}>2.0 KG</option>
                  <option value={3.0}>3.0 KG</option>
                  <option value={4.0}>4.0 KG</option>
                  <option value={5.0}>5.0 KG</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500  uppercase mb-1">Parcel Quantity</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full p-1.5 text-xs bg-slate-50  border border-slate-200  rounded-lg text-slate-800  focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={onClose}
              className="text-slate-500"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={submittingCourier}
              className="px-5 shadow-md"
            >
              {submittingCourier ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Booking on Courier...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Book on Courier
                </>
              )}
            </Button>
          </div>

        </form>

    </Modal>
  );
}

export default CourierBookingModal;
