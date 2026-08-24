import { apiFetch } from "../src/lib/http";

export type LiveEvent = {
  id: string;
  event: string;
  provider: string;
  status: "Delivered" | "Failed" | "Retrying";
  time: string;
  day: string;
  page: string;
  product: string;
  destinations: string[];
  requestId?: string;
  outboxId?: number;
  retryable?: boolean;
  reason: string;
};

export type LiveDeliveryLog = {
  id: string;
  eventId?: string;
  outboxId?: number;
  retryable?: boolean;
  provider: string;
  host: string;
  endpoint: string;
  code: number;
  outcome: string;
  retry: string;
  time: string;
  day: string;
};

export type LiveSnapshot = {
  profile: {
    name: string;
    email: string;
    plan: string;
    eventsUsed: number;
    eventsQuota: number;
    clientId?: string;
  };
  connection: {
    workspace: string;
    domain: string;
    clientId?: string;
    status: string;
  };
  orders: Array<{
    id: string;
    customer: string;
    location: string;
    item: string;
    total: number;
    risk: string;
    status: string;
    age: string;
    payment: string;
    phone?: string;
    courier?: string;
    courierStatus?: "Not booked" | "Booked" | "In transit" | "Delivered" | "Booking failed";
    products?: Array<{ name: string; quantity: number; price: number; variant?: string }>;
  }>;
  checkouts: Array<{
    id: string; name: string; phone: string; address: string; unitPrice: number;
    status: "Active" | "Contacted" | "Ignored" | "Recovered"; source: string; lastActivity: string;
    today: boolean; item: string; quantity: number; recoveredOrderId?: string;
  }>;
  events: LiveEvent[];
  logs: LiveDeliveryLog[];
  dashboard: {
    eventsUsed: number;
    eventsLimit: number;
    ordersThisMonth: number;
    destinationsHealthy: number;
    destinationsTotal: number;
    codPending: number;
    failedEvents: number;
    trend: Array<{ label: string; value: number; date: string }>;
    platformDelivery: Array<{ name: string; host: string; requests: number; failed: number; lastSync: string; status: "Healthy" | "Degraded" | "Down" }>;
  };
};

const json = async (path: string, signal: AbortSignal) => {
  const response = await apiFetch(path, { signal });
  if (!response.ok) throw new Error(`Live read failed (${response.status})`);
  return response.json() as Promise<Record<string, any>>;
};

const dateParts = (value: unknown) => {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return { time: "Unavailable", day: "Unavailable" };
  return { time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }), day: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) };
};

const positiveInteger = (value: unknown): number | undefined => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

// Retry authority is a server decision. Do not coerce strings such as "false", and do not
// derive eligibility from a failed HTTP response, retry count, or a display-log identifier.
const retryAuthority = (row: any) => {
  const outboxId = positiveInteger(row.outboxId);
  return outboxId && row.retryable === true ? { outboxId, retryable: true as const } : {};
};

const orderFrom = (row: any) => ({
  id: String(row.orderId ?? row.externalOrderId ?? row.id),
  customer: String(row.customerName ?? row.customer ?? row.recipientName ?? "N/A"),
  location: String(row.address ?? row.recipientAddress ?? "N/A"),
  item: String(row.products?.[0]?.name ?? row.item ?? "Product details unavailable"),
  total: Number(row.orderTotal ?? row.amount ?? row.total ?? 0),
  risk: row.fraudScore == null ? "Not checked" : Number(row.fraudScore) >= 70 ? "High risk" : Number(row.fraudScore) >= 40 ? "Medium risk" : "Low risk",
  status: String(row.workflowStatus ?? row.status ?? "Pending review"),
  age: String(row.orderOccurredAt ?? row.timestamp ?? row.createdAt ?? ""),
  payment: "COD",
  phone: String(row.phone ?? row.recipientPhone ?? row.customer ?? ""),
  courier: row.courierProvider && row.courierTrackingId ? `${row.courierProvider} · ${row.courierTrackingId}` : undefined,
  courierStatus: row.courierStatus ? String(row.courierStatus).replace(/_/g, " ") as any : undefined,
  products: Array.isArray(row.products) ? row.products.map((item: any) => ({ name: String(item.name ?? item.title ?? "Product"), quantity: Number(item.quantity ?? 1), price: Number(item.price ?? item.item_price ?? 0), variant: item.variant })) : undefined,
});

export async function fetchLiveSnapshot(signal: AbortSignal): Promise<LiveSnapshot> {
  const [orders, deferred, checkouts, events, logs, trend, profile, connection] = await Promise.all([
    json("/api/v1/orders?limit=100&page=1", signal),
    json("/api/deferred?limit=100&page=1", signal),
    json("/api/incomplete-checkouts?limit=100&offset=0", signal),
    json("/api/events?limit=100&offset=0", signal),
    json("/api/api-logs?limit=100&offset=0", signal),
    json("/api/events/trend?days=7", signal),
    json("/api/profile", signal),
    json("/api/connection", signal),
  ]);
  const courier = await json("/api/courier/orders?limit=100&offset=0", signal).catch(() => ({ orders: [] }));
  const courierByOrder = new Map<string, any>((courier.orders ?? []).map((row: any) => [String(row.order_id ?? row.orderId), row] as [string, any]));
  const orderRows = [...(orders.orders ?? []), ...(deferred.pendingList ?? [])].map((row: any) => {
    const mapped = orderFrom(row);
    const courierRow = courierByOrder.get(mapped.id);
    return courierRow ? { ...mapped, courier: courierRow.courier_order_id ? `${courierRow.courier_provider} · ${courierRow.courier_order_id}` : undefined, courierStatus: courierRow.courier_status } : mapped;
  });
  const uniqueOrders = Array.from(new Map(orderRows.map((row) => [row.id, row])).values());
  const checkoutRows = (checkouts.items ?? []).map((row: any) => {
    const firstProduct = row.products?.[0];
    const quantity = Math.max(1, Number(firstProduct?.quantity ?? 1));
    const unitPrice = Number(firstProduct?.price ?? firstProduct?.item_price ?? (Number(row.amount ?? 0) / quantity));
    return { id: String(row.id), name: String(row.customerName ?? "N/A"), phone: String(row.phone ?? ""), address: String(row.address ?? "N/A"), unitPrice, status: ({ incomplete: "Active", contacted: "Contacted", ignored: "Ignored", recovered: "Recovered" } as any)[row.status] ?? "Active", source: String(row.campaignData?.utm_source ?? "Direct"), lastActivity: String(row.lastActivityAt ?? "Not available"), today: false, item: String(firstProduct?.name ?? firstProduct?.content_name ?? "Cart items"), quantity, recoveredOrderId: row.orderId ? String(row.orderId) : undefined };
  });
  const eventRows = (events.events ?? []).map((row: any) => { const stamp = dateParts(row.timestamp); return { id: String(row.id), event: String(row.name ?? "Event"), provider: String(row.platform ?? "Unknown"), status: row.status === "failed" ? "Failed" : row.status === "retry" ? "Retrying" : "Delivered", time: stamp.time, day: stamp.day, page: String(row.pageUrl ?? "N/A"), product: String(row.contentName ?? row.orderId ?? "Event activity"), destinations: [String(row.platform ?? "Unknown")], requestId: row.deliveryRequestId ? String(row.deliveryRequestId) : undefined, ...retryAuthority(row), reason: String(row.responseBody?.error?.message ?? row.responseBody?.message ?? "Accepted by destination") } as LiveEvent; });
  const logRows = (logs.logs ?? []).map((row: any) => { const stamp = dateParts(row.timestamp); const host = String(row.endpoint ?? "").replace(/^https?:\/\//, "").split("/")[0] || "Provider endpoint"; return { id: String(row.id), eventId: row.eventId ? String(row.eventId) : undefined, ...retryAuthority(row), provider: String(row.platform ?? "Unknown"), host, endpoint: host, code: Number(row.statusCode ?? 0), outcome: Number(row.statusCode ?? 0) >= 400 ? String(row.responseBody?.error?.message ?? "Rejected by destination") : "Accepted by destination", retry: row.retryCount ? `${row.retryCount} retries` : "No retry", time: stamp.time, day: stamp.day } as LiveDeliveryLog; });
  const trendRows = (trend.trend ?? []).map((row: any) => {
    const date = String(row.date ?? "");
    const parsed = date ? new Date(`${date}T00:00:00`) : null;
    const label = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "Unavailable";
    return { date, label, value: Number(row.success ?? row.total ?? 0) };
  });
  const platformMap = new Map<string, { name: string; host: string; requests: number; failed: number; lastSync: string }>();
  logRows.forEach((row) => {
    const current = platformMap.get(row.provider) ?? { name: row.provider, host: row.host, requests: 0, failed: 0, lastSync: `${row.day} · ${row.time}` };
    current.requests += 1;
    if (row.code >= 400) current.failed += 1;
    platformMap.set(row.provider, current);
  });
  const platformDelivery = Array.from(platformMap.values()).map((row) => ({ ...row, status: row.requests === 0 ? "Down" as const : row.failed / row.requests > 0.1 ? "Degraded" as const : "Healthy" as const }));
  const profileEventsUsed = Number(profile.eventsUsed ?? profile.events_used ?? 0);
  const profileEventsLimit = Number(profile.eventsQuota ?? profile.events_quota ?? 0);
  return {
    profile: {
      name: String(profile.name ?? profile.displayName ?? "Workspace owner"),
      email: String(profile.email ?? ""),
      plan: String(profile.plan ?? profile.plan_name ?? "Plan"),
      eventsUsed: profileEventsUsed,
      eventsQuota: profileEventsLimit,
      clientId: profile.clientId != null ? String(profile.clientId) : profile.client_id != null ? String(profile.client_id) : undefined,
    },
    connection: {
      workspace: String(connection.workspace ?? connection.storeName ?? connection.store_name ?? connection.name ?? "Connected workspace"),
      domain: String(connection.domain ?? connection.siteHost ?? connection.site_url ?? ""),
      clientId: connection.clientId != null ? String(connection.clientId) : connection.client_id != null ? String(connection.client_id) : undefined,
      status: String(connection.status ?? "Unknown"),
    },
    orders: uniqueOrders as LiveSnapshot["orders"],
    checkouts: checkoutRows,
    events: eventRows,
    logs: logRows,
    dashboard: {
      eventsUsed: profileEventsUsed,
      eventsLimit: profileEventsLimit,
      ordersThisMonth: uniqueOrders.length,
      destinationsHealthy: connection.status === "Active" ? 1 : 0,
      destinationsTotal: 1,
      codPending: uniqueOrders.filter((row) => row.status.toLowerCase().includes("review") || row.status.toLowerCase().includes("pending")).length,
      failedEvents: logRows.filter((row) => row.code >= 400).length,
      trend: trendRows,
      platformDelivery,
    },
  };
}
