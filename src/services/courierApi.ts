import { apiFetch } from '../lib/http';
import type { CourierOrder, DeferredOrderProduct } from '../types';

export interface PathaoStore {
  store_id: number | string;
  store_name: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readObject = async (response: Response): Promise<Record<string, unknown>> => {
  const payload: unknown = await response.json().catch(() => ({}));
  return isRecord(payload) ? payload : {};
};

/** Surfaces the server-provided `detail`, matching operationsApi / accountApi behaviour. */
const requestError = async (response: Response, fallback: string) => {
  const body = await readObject(response);
  return new Error(typeof body.detail === 'string' ? body.detail : fallback);
};

const normalizeCourierOrder = (value: unknown): CourierOrder | null => {
  if (!isRecord(value)) return null;
  return {
    id: Number(value.id || 0),
    order_id: String(value.order_id || ''),
    courier_provider: String(value.courier_provider || ''),
    courier_order_id: value.courier_order_id ? String(value.courier_order_id) : undefined,
    courier_tracking_id: value.courier_tracking_id ? String(value.courier_tracking_id) : undefined,
    courier_status: String(value.courier_status || 'pending'),
    recipient_name: String(value.recipient_name || ''),
    recipient_phone: String(value.recipient_phone || ''),
    recipient_address: String(value.recipient_address || ''),
    cod_amount: Number(value.cod_amount || 0),
    delivery_charge: Number(value.delivery_charge || 0),
    created_at: String(value.created_at || ''),
    purchase_event_sent: Boolean(value.purchase_event_sent),
    products: Array.isArray(value.products) ? value.products as DeferredOrderProduct[] : [],
  };
};

export const normalizeCourierOrdersPayload = (payload: unknown): CourierOrder[] => {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.orders) ? payload.orders : [];
  return rows.map(normalizeCourierOrder).filter((order): order is CourierOrder => order !== null);
};

export const normalizePathaoStoresPayload = (payload: unknown): PathaoStore[] => {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.stores) ? payload.stores : [];
  return rows.filter(isRecord).map(store => ({
    store_id: typeof store.store_id === 'number' ? store.store_id : String(store.store_id || ''),
    store_name: String(store.store_name || ''),
  }));
};

export async function loadCourierOrders(signal?: AbortSignal): Promise<CourierOrder[]> {
  const response = await apiFetch('/api/courier/orders', { signal });
  if (!response.ok) throw await requestError(response, 'Failed to fetch courier orders.');
  return normalizeCourierOrdersPayload(await response.json());
}

export async function loadPathaoStores(signal?: AbortSignal): Promise<PathaoStore[]> {
  const response = await apiFetch('/api/courier/pathao/stores', { signal });
  if (!response.ok) throw await requestError(response, 'Failed to fetch Pathao stores.');
  return normalizePathaoStoresPayload(await response.json());
}
