import React from 'react';
import { CheckCircle2, ChevronDown, DollarSign, Loader2, MapPin, Pencil, Phone, Send, Truck, User, XCircle } from 'lucide-react';
import type { CourierSettings, FulfillmentOrder } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import type { PathaoStore } from '../../services/courierApi';

interface RedxArea {
  id: number | string;
  name: string;
  post_code?: number;
}

interface CourierBookingModalProps {
  selectedOrder: FulfillmentOrder;
  onClose: () => void;
  onEditOrder: () => void;
  onSubmit: (event: React.FormEvent) => void;
  submittingCourier: boolean;
  courierSettings: CourierSettings | null;
  courierProvider: string;
  setCourierProvider: (value: string) => void;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  codAmount: number;
  itemWeight: number;
  setItemWeight: (value: number) => void;
  itemQuantity: number;
  setItemQuantity: (value: number) => void;
  loadingStores: boolean;
  pathaoStores: PathaoStore[];
  selectedStoreId: number | string | '';
  setSelectedStoreId: (value: number | string | '') => void;
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

const PROVIDERS = [
  { id: 'steadfast', label: 'SteadFast' },
  { id: 'pathao', label: 'Pathao' },
  { id: 'redx', label: 'RedX' },
] as const;

const providerName = (provider: string) => PROVIDERS.find((item) => item.id === provider)?.label || 'Courier';

const isProviderConfigured = (provider: string, settings: CourierSettings | null): boolean | null => {
  if (!settings) return null;
  if (provider === 'pathao') {
    return Boolean(
      (settings.pathao_api_key && settings.pathao_secret_key)
      || (settings.pathao_client_id && settings.pathao_email && settings.pathao_client_secret && settings.pathao_password),
    );
  }
  if (provider === 'redx') return Boolean(settings.redx_access_token);
  return Boolean(settings.steadfast_api_key && settings.steadfast_secret_key);
};

const providerStatus = (configured: boolean | null) => {
  if (configured === null) return { label: 'Checking', className: 'border-slate-200 bg-slate-50 text-slate-500' };
  if (configured) return { label: 'Connected', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  return { label: 'Setup needed', className: 'border-amber-200 bg-amber-50 text-amber-700' };
};

export function CourierBookingModal({
  selectedOrder,
  onClose,
  onEditOrder,
  onSubmit,
  submittingCourier,
  courierSettings,
  courierProvider,
  setCourierProvider,
  recipientName,
  recipientPhone,
  recipientAddress,
  codAmount,
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
  const [showRedxAdvanced, setShowRedxAdvanced] = React.useState(false);
  const orderId = selectedOrder.orderId || selectedOrder.order_id || '';
  const selectedStore = pathaoStores.find((store) => String(store.store_id) === String(selectedStoreId));
  const redxAreaReady = Boolean(redxDeliveryAreaId && redxDeliveryAreaName);
  const products = selectedOrder.products || [];
  const redxConfigured = isProviderConfigured('redx', courierSettings);
  const selectedProviderConfigured = isProviderConfigured(courierProvider, courierSettings);
  const selectedProviderStatus = providerStatus(selectedProviderConfigured);

  return (
    <Modal
      onClose={onClose}
      labelledBy="courier-booking-title"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm animate-fade-in sm:p-4"
      panelClassName="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-slide-in-up sm:max-h-[calc(100vh-2rem)]"
    >
      <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Truck className="h-5 w-5 shrink-0 text-indigo-600" />
            <div className="min-w-0">
              <h3 id="courier-booking-title" className="truncate text-sm font-bold text-slate-900">Quick courier booking</h3>
              <p className="truncate text-xs text-slate-400">Order #{orderId} · choose once, book once</p>
            </div>
          </div>
          <Button variant="icon" size="lg" type="button" onClick={onClose} aria-label="Close courier booking dialog">
            <XCircle className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,.8fr)]">
            <div className="flex min-w-0 items-start gap-2">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">{recipientName || 'Customer unavailable'}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500"><Phone className="h-3 w-3" /> {recipientPhone || 'No phone'}</p>
                <p className="mt-1 flex items-start gap-1 text-xs leading-relaxed text-slate-500"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {recipientAddress || 'Address unavailable'}</p>
              </div>
            </div>
            <div className="flex min-w-0 items-start justify-between gap-3 border-t border-slate-200 pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Order summary</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{products.length} product{products.length === 1 ? '' : 's'} · Qty {itemQuantity}</p>
                <p className="mt-1 text-xs text-slate-500">{products.slice(0, 2).map((product) => product.name || product.content_name || 'Product').join(' · ')}{products.length > 2 ? ` +${products.length - 2} more` : ''}</p>
              </div>
              <strong className="shrink-0 text-sm text-indigo-700">BDT {Number(codAmount || 0).toLocaleString()}</strong>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Courier partner</h4>
                <p className="mt-1 text-xs text-slate-400">Your preferred courier is already selected.</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${selectedProviderStatus.className}`}>
                {selectedProviderConfigured && <CheckCircle2 className="h-3 w-3" />}
                {selectedProviderStatus.label}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {PROVIDERS.map((provider) => {
                const configured = isProviderConfigured(provider.id, courierSettings);
                const status = providerStatus(configured);
                return (
                  <label key={provider.id} className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-3 text-xs font-bold transition ${courierProvider === provider.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <span className="min-w-0">
                      <span className="block">{provider.label}</span>
                      <span className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${status.className}`}>{status.label}</span>
                    </span>
                    <input type="radio" name="courier-provider" value={provider.id} checked={courierProvider === provider.id} onChange={() => setCourierProvider(provider.id)} className="h-4 w-4 shrink-0 accent-indigo-600" />
                  </label>
                );
              })}
            </div>
            {selectedProviderConfigured === false && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                {providerName(courierProvider)} credentials are not ready. Connect this courier in Settings before booking.
              </p>
            )}
          </section>

          <section className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              COD to collect
              <span className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 font-bold text-slate-800"><DollarSign className="h-3.5 w-3.5 text-slate-400" /> BDT {Number(codAmount || 0).toLocaleString()}</span>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              Parcel weight
              <select value={itemWeight} onChange={(event) => setItemWeight(Number(event.target.value))} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-indigo-500">
                <option value={0.5}>0.5 KG</option>
                <option value={1}>1 KG</option>
                <option value={2}>2 KG</option>
                <option value={3}>3 KG</option>
                <option value={4}>4 KG</option>
                <option value={5}>5 KG</option>
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              Parcel quantity
              <input type="number" min={1} value={itemQuantity} onChange={(event) => setItemQuantity(Math.max(1, Number(event.target.value) || 1))} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500" />
            </label>
          </section>

          {courierProvider === 'pathao' && (
            <section className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Pathao pickup</h4>
                  <p className="mt-1 text-xs text-slate-400">The saved pickup store is used automatically.</p>
                </div>
                {selectedStore && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Ready</span>}
              </div>
              {loadingStores ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Loading pickup stores...</div>
              ) : pathaoStores.length > 1 ? (
                <select aria-label="Pathao pickup store" value={selectedStoreId} onChange={(event) => setSelectedStoreId(pathaoStores.find((item) => String(item.store_id) === event.target.value)?.store_id ?? '')} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-500">
                  {pathaoStores.map((store) => <option key={store.store_id} value={store.store_id}>{store.store_name}</option>)}
                </select>
              ) : pathaoStores.length === 1 && selectedStore ? (
                <div className="flex h-9 items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800"><span>{selectedStore.store_name}</span><span>Default store</span></div>
              ) : (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Pathao pickup store is unavailable. Connect Pathao or set a store in Settings.</div>
              )}

              <details className="group rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-600"><span>Optional location override</span><ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" /></summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <select aria-label="Pathao city override" value={selectedPathaoCity} onChange={(event) => setSelectedPathaoCity(event.target.value ? Number(event.target.value) : '')} disabled={loadingPathaoLocations || pathaoCities.length === 0} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:opacity-50"><option value="">Auto-detect city</option>{pathaoCities.map((city) => <option key={city.city_id} value={city.city_id}>{city.city_name}</option>)}</select>
                  <select aria-label="Pathao zone override" value={selectedPathaoZone} onChange={(event) => setSelectedPathaoZone(event.target.value ? Number(event.target.value) : '')} disabled={selectedPathaoCity === '' || pathaoZones.length === 0} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:opacity-50"><option value="">Auto-detect zone</option>{pathaoZones.map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zone.zone_name}</option>)}</select>
                  <select aria-label="Pathao area override" value={selectedPathaoArea} onChange={(event) => setSelectedPathaoArea(event.target.value ? Number(event.target.value) : '')} disabled={selectedPathaoZone === '' || pathaoAreas.length === 0} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:opacity-50"><option value="">Auto-detect area</option>{pathaoAreas.map((area) => <option key={area.area_id} value={area.area_id}>{area.area_name}</option>)}</select>
                </div>
              </details>
            </section>
          )}

          {courierProvider === 'redx' && (
            <section className="space-y-3 rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">RedX delivery area</h4>
                  <p className="mt-1 text-xs text-slate-400">The saved delivery area and pickup store are used automatically.</p>
                </div>
                {redxAreaReady && !showRedxAdvanced && <button type="button" onClick={() => setShowRedxAdvanced(true)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Change</button>}
              </div>
              {redxAreaReady && !showRedxAdvanced ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><span>{redxDeliveryAreaName}{redxPickupStoreId ? ` · Pickup ${redxPickupStoreId}` : ''}</span><CheckCircle2 className="h-4 w-4 shrink-0" /></div>
              ) : loadingRedxAreas ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">Loading RedX areas...</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">Delivery area<input type="search" value={redxAreaSearch} onChange={(event) => setRedxAreaSearch(event.target.value)} placeholder="Search area, post code, or ID" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500" /><select required value={redxDeliveryAreaId} onChange={(event) => { const area = redxAreas.find((item) => String(item.id) === event.target.value); setRedxDeliveryAreaId(event.target.value); if (area) { setRedxDeliveryAreaName(area.name); setRedxAreaSearch(area.name); } }} className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-indigo-500"><option value="">Select from matches</option>{filteredRedxAreas.map((area) => <option key={area.id} value={area.id}>{area.name}{area.post_code ? ` (${area.post_code})` : ''}</option>)}</select></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Area name<input required value={redxDeliveryAreaName} onChange={(event) => setRedxDeliveryAreaName(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500" /></label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Pickup store ID<input type="number" value={redxPickupStoreId} onChange={(event) => setRedxPickupStoreId(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500" /></label>
                </div>
              )}
              {redxConfigured === false && <p className="text-xs font-semibold text-amber-700">RedX credentials need to be connected in Settings before booking.</p>}
            </section>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" size="sm" type="button" onClick={onEditOrder}><Pencil className="h-3.5 w-3.5" /> Edit order</Button>
          <Button variant="primary" size="sm" type="submit" loading={submittingCourier} disabled={submittingCourier || selectedProviderConfigured !== true}><Send className="h-3.5 w-3.5" /> {submittingCourier ? 'Booking...' : `Book with ${providerName(courierProvider)}`}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default CourierBookingModal;
