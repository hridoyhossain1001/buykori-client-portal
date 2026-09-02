import { apiFetch } from '../lib/http';
import type { DeferredData, DeferredOrder, DeferredOrderUpdatePayload, OrderIntakeHealth, OrderWorkflowStatus, PaginatedResult, SidebarStatus, StoreInfo, StoreOrderLedgerItem } from '../types';

interface ActionResponse {
  message?: string;
  confirmed?: number;
  cancelled?: number;
  failed?: number;
}

export interface PendingOrderCancellationResponse {
  success: boolean;
  orderId: string;
  status: string;
  message?: string;
  wooSync?: {
    status: string;
    commandId?: number;
    message?: string;
  };
}

export interface OrderWorkflowStatusResponse extends PendingOrderCancellationResponse {
  courierStatus?: string | null;
  purchaseStatus?: string | null;
}

/** Change-detection probe for the captured-order ledger. */
export interface StoreOrderWatermark {
  count: number;
  lastChangedAt: string | null;
}

/** What one on-demand courier history check writes back onto an order. */
export interface CourierFraudCheckResult {
  fraudScore: number;
  fraudDetails: NonNullable<DeferredOrder['fraudDetails']>;
}

interface OrderWorkflowSnapshot {
  statuses: Record<string, OrderWorkflowStatus>;
  cancelledOrders: DeferredOrder[];
}

interface StoreDomainResponse {
  domain: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readObject = async (response: Response): Promise<Record<string, unknown>> => {
  const value: unknown = await response.json().catch(() => ({}));
  return isRecord(value) ? value : {};
};

const requestError = async (response: Response, fallback: string) => {
  const body = await readObject(response);
  return new Error(typeof body.detail === 'string' ? body.detail : fallback);
};

export async function fetchDeferredData(signal?: AbortSignal): Promise<DeferredData> {
  const [response, workflow] = await Promise.all([
    apiFetch('/api/deferred', { signal }),
    fetchOrderWorkflowSnapshot(signal).catch(() => ({ statuses: {}, cancelledOrders: [] })),
  ]);
  if (!response.ok) throw await requestError(response, `Could not load verification queue (${response.status}).`);
  const data = await response.json() as DeferredData;
  const merge = (orders?: DeferredOrder[]) => orders?.map(order => ({
    ...order,
    workflowStatus: workflow.statuses[order.orderId] || order.workflowStatus || (
      order.status === 'confirmed' ? 'confirmed' : order.status === 'cancelled' ? 'cancelled' : 'pending'
    ),
  }));
  const activeOperations = merge(data.operationsPendingList || data.pendingList) || [];
  const activeOrderIds = new Set(activeOperations.map(order => order.orderId));

  /**
   * Orders a failed courier booking left behind.
   *
   * `GET /deferred` builds `operationsPendingList` with
   * `PendingEvent.order_id.not_in(booked_order_ids_subq)`, and that subquery
   * selects *every* CourierOrder of the client with no status filter — so an
   * order whose booking the courier rejected is treated as booked and dropped
   * from the list. But the booking worker, on terminal failure, resets its
   * PendingEvent back to `status="pending"` (courier_booking_service.py), which
   * keeps the row in `pendingList` in the very same response, carrying the
   * `pending_event_id` that `POST /courier/send` needs to re-queue it.
   *
   * So the rows below are exactly the bookings that still need action, and
   * folding them back in is what makes a retry reachable. A *successful*
   * booking cannot arrive here: the worker sets its PendingEvent to
   * `status="courier_booked"`, so it is absent from `pendingList` too and
   * cannot be resurrected into the queue by this fold.
   */
  const unbookedOrders = (merge(data.pendingList) || [])
    .filter(order => !activeOrderIds.has(order.orderId));
  for (const order of unbookedOrders) activeOrderIds.add(order.orderId);

  const cancelledOrders = workflow.cancelledOrders
    .filter(order => !activeOrderIds.has(order.orderId))
    .map(order => ({ ...order, status: 'cancelled', workflowStatus: 'cancelled' as const }));
  return {
    ...data,
    pendingList: merge(data.pendingList),
    operationsPendingList: [...activeOperations, ...unbookedOrders, ...cancelledOrders],
    deferredPendingList: merge(data.deferredPendingList),
  };
}

async function fetchOrderWorkflowSnapshot(signal?: AbortSignal): Promise<OrderWorkflowSnapshot> {
  const response = await apiFetch('/api/v1/orders/workflow-statuses', { signal });
  if (!response.ok) return { statuses: {}, cancelledOrders: [] };
  const body = await readObject(response);
  const statuses = body.statuses && typeof body.statuses === 'object' && !Array.isArray(body.statuses)
    ? body.statuses as Record<string, OrderWorkflowStatus>
    : {};
  const cancelledOrders = Array.isArray(body.cancelledOrders)
    ? body.cancelledOrders.filter(isRecord) as unknown as DeferredOrder[]
    : [];
  return { statuses, cancelledOrders };
}

export async function fetchOrderWorkflowStatuses(signal?: AbortSignal): Promise<Record<string, OrderWorkflowStatus>> {
  return (await fetchOrderWorkflowSnapshot(signal)).statuses;
}

export async function fetchStoreOrderLedger(signal?: AbortSignal): Promise<PaginatedResult<StoreOrderLedgerItem>> {
  const response = await apiFetch('/api/v1/orders?limit=100', { signal });
  if (!response.ok) throw await requestError(response, `Could not load captured orders (${response.status}).`);
  const body = await readObject(response);
  const items = Array.isArray(body.orders) ? body.orders as StoreOrderLedgerItem[] : [];
  const totalCount = Number(body.totalCount ?? body.total ?? items.length);
  const limit = Number(body.limit ?? 100);
  const page = Number(body.page ?? 1);
  return {
    items,
    totalCount: Number.isFinite(totalCount) ? totalCount : items.length,
    limit: Number.isFinite(limit) ? limit : 100,
    page: Number.isFinite(page) ? page : 1,
    hasMore: typeof body.hasMore === 'boolean' ? body.hasMore : page * limit < totalCount,
  };
}

export async function fetchOrderIntakeHealth(signal?: AbortSignal): Promise<OrderIntakeHealth> {
  const response = await apiFetch('/api/v1/orders/intake-health?hours=24', { signal });
  if (!response.ok) throw await requestError(response, `Could not load Order Intake health (${response.status}).`);
  return await response.json() as OrderIntakeHealth;
}

/**
 * One aggregate row that changes whenever the captured-order ledger changes.
 * Lets the Orders workspace poll often without refetching 100 orders each tick;
 * the heavy fetch only runs when this value actually moves.
 *
 * Returns `null` — rather than throwing — when the backend does not serve the
 * route (404). The probe is an optimisation, not a feature: a backend that
 * predates it must make the workspace fall back to its slower full refresh
 * quietly, not fail an order screen or retry a missing route every 2.5s. Every
 * other failure still throws, because a 500 or a dropped session is a real
 * problem the caller has to handle.
 */
export async function fetchStoreOrderWatermark(signal?: AbortSignal): Promise<StoreOrderWatermark | null> {
  const response = await apiFetch('/api/v1/orders/watermark', { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw await requestError(response, `Could not check for new orders (${response.status}).`);
  const body = await readObject(response);
  const count = Number(body.count ?? 0);
  return {
    count: Number.isFinite(count) ? count : 0,
    lastChangedAt: typeof body.lastChangedAt === 'string' ? body.lastChangedAt : null,
  };
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

export async function updateOrderWorkflowStatus(
  orderId: string,
  status: OrderWorkflowStatus,
): Promise<OrderWorkflowStatusResponse> {
  const response = await apiFetch(`/api/v1/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) throw await requestError(response, 'Could not update this order status.');
  return await response.json() as OrderWorkflowStatusResponse;
}

export async function cancelPendingOrder(orderId: string): Promise<PendingOrderCancellationResponse> {
  return await updateOrderWorkflowStatus(orderId, 'cancelled');
}

export async function updateDeferredOrder(
  pendingEventId: number,
  payload: DeferredOrderUpdatePayload,
): Promise<DeferredOrder> {
  const response = await apiFetch(`/api/deferred/orders/${pendingEventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await requestError(response, 'Could not update this order.');
  const body = await readObject(response);
  if (!body.order || typeof body.order !== 'object' || Array.isArray(body.order)) {
    throw new Error('The updated order response was incomplete.');
  }
  return body.order as DeferredOrder;
}

export async function runCourierFraudCheck(pendingEventId: number): Promise<CourierFraudCheckResult> {
  const response = await apiFetch(`/api/deferred/orders/${pendingEventId}/courier-check`, {
    method: 'POST',
  });
  if (!response.ok) throw await requestError(response, 'Could not check courier history for this order.');
  const body = await readObject(response);
  return {
    fraudScore: Number(body.fraudScore) || 0,
    fraudDetails: (body.fraudDetails || {}) as NonNullable<DeferredOrder['fraudDetails']>,
  };
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
  courierAutoCheck: boolean;
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
