import { apiFetch } from '../lib/http';
import type { DeferredData, OrderIntakeHealth, SidebarStatus, StoreInfo, StoreOrderLedgerItem } from '../types';

interface ActionResponse {
  message?: string;
  confirmed?: number;
  cancelled?: number;
  failed?: number;
}

interface StoreDomainResponse {
  domain: string;
}

const readObject = async (response: Response): Promise<Record<string, unknown>> => {
  const value: unknown = await response.json().catch(() => ({}));
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
};

const requestError = async (response: Response, fallback: string) => {
  const body = await readObject(response);
  return new Error(typeof body.detail === 'string' ? body.detail : fallback);
};

export async function fetchDeferredData(signal?: AbortSignal): Promise<DeferredData> {
  const response = await apiFetch('/api/deferred', { signal });
  if (!response.ok) throw await requestError(response, `Could not load verification queue (${response.status}).`);
  return await response.json() as DeferredData;
}

export async function fetchStoreOrderLedger(signal?: AbortSignal): Promise<StoreOrderLedgerItem[]> {
  const response = await apiFetch('/api/v1/orders?limit=100', { signal });
  if (!response.ok) throw await requestError(response, `Could not load captured orders (${response.status}).`);
  const body = await readObject(response);
  return Array.isArray(body.orders) ? body.orders as StoreOrderLedgerItem[] : [];
}

export async function fetchOrderIntakeHealth(signal?: AbortSignal): Promise<OrderIntakeHealth> {
  const response = await apiFetch('/api/v1/orders/intake-health?hours=24', { signal });
  if (!response.ok) throw await requestError(response, `Could not load Order Intake health (${response.status}).`);
  return await response.json() as OrderIntakeHealth;
}

export async function runDeferredOrderAction(
  action: 'confirm' | 'cancel' | 'restore',
  orderId: string,
): Promise<ActionResponse> {
  const response = await apiFetch(`/api/deferred/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  if (!response.ok) throw await requestError(response, 'COD order action failed.');
  return await response.json() as ActionResponse;
}

export async function runDeferredBulkAction(
  action: 'confirm-bulk' | 'cancel-bulk',
  orderIds: string[],
): Promise<ActionResponse> {
  const response = await apiFetch(`/api/deferred/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_ids: orderIds }),
  });
  if (!response.ok) throw await requestError(response, 'Bulk COD order action failed.');
  return await response.json() as ActionResponse;
}

export async function saveDeferredSettings(settings: {
  deferredEnabled: boolean;
  autoConfirmDays: number;
  autoConfirmStatus: string;
}) {
  const response = await apiFetch('/api/deferred/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw await requestError(response, 'Failed to save COD Protection settings.');
}

export async function fetchClientStores(signal?: AbortSignal): Promise<StoreInfo[]> {
  const response = await apiFetch('/api/stores', { signal });
  if (!response.ok) throw await requestError(response, 'Could not load stores.');
  const body = await readObject(response);
  if (!Array.isArray(body.stores)) return [];
  return body.stores.flatMap((value) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return [];
    const store = value as Record<string, unknown>;
    const clientId = Number(store.client_id ?? store.id);
    if (!Number.isFinite(clientId) || clientId <= 0) return [];
    return [{
      client_id: clientId,
      name: String(store.name || ''),
      domain: String(store.domain || ''),
      is_current: Boolean(store.is_current),
    }];
  });
}

export async function saveClientStoreDomain(domain: string): Promise<StoreDomainResponse> {
  const response = await apiFetch('/api/store/domain', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain: domain.trim() || null }),
  });
  if (!response.ok) throw await requestError(response, 'Could not save the store domain.');
  const body = await readObject(response);
  return { domain: typeof body.domain === 'string' ? body.domain : '' };
}

export async function switchClientStore(clientId: number) {
  const response = await apiFetch('/api/switch-store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_client_id: clientId }),
  });
  if (!response.ok) throw await requestError(response, 'Failed to switch store.');
}

export async function markClientSidebarSeen(section: 'order_verification' | 'orders_delivery') {
  const response = await apiFetch('/api/sidebar/mark-seen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section }),
  });
  if (!response.ok) throw await requestError(response, 'Could not update sidebar status.');

  const statusResponse = await apiFetch('/api/sidebar/status');
  return statusResponse.ok ? await statusResponse.json() as SidebarStatus : null;
}
