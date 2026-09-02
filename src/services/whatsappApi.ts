/**
 * Per-store WhatsApp order confirmations.
 *
 * The merchant links their own WhatsApp number by scanning a QR code in Settings,
 * then presses one button per order to ask the customer to reply 1 to confirm or
 * 2 to cancel. Backed by app/routers/whatsapp_api.py.
 *
 * Everything here degrades quietly: the whole feature is behind a server flag
 * (`available`) and a paid-plan check (`hasPlanAccess`), so a portal running
 * against a server without the flag must still render normally.
 */

import { apiFetch } from '../lib/http';

/** Mirrors app/services/whatsapp/session_service.py. */
export type WhatsAppSessionStatus =
  | 'disconnected'
  | 'connecting'
  | 'qr_pending'
  | 'connected'
  | 'conflict'
  | 'logged_out'
  | 'error'
  | string;

/** Mirrors the OrderConfirmation.status values written by confirmation_service.py. */
export type WhatsAppConfirmationStatus =
  | 'pending'
  | 'sent'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  | 'failed'
  | 'no_whatsapp'
  | string;

export interface WhatsAppSession {
  status: WhatsAppSessionStatus;
  phoneNumber: string | null;
  deviceLabel: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastSeenAt: string | null;
  lastError: string | null;
  consentAcceptedAt: string | null;
  dailySentCount: number;
  dailyLimit: number;
}

export interface WhatsAppStatus {
  /** Server flag + gateway configured. False means the feature is dark. */
  available: boolean;
  hasPlanAccess: boolean;
  connected: boolean;
  session: WhatsAppSession;
  /** True when this store asked for confirmations to go out by themselves. */
  autoSend: boolean;
  /** Night-time window (store-local hours) in which the sweep sends nothing. */
  autoSendQuietHours: { start: number; end: number };
  /** Live QR data URL, only present while pairing. Never cached server-side. */
  qr: string | null;
  /** Set when the durable row could be read but the gateway could not. */
  gatewayError?: string | null;
}

export interface WhatsAppConnectResult {
  success: boolean;
  status: WhatsAppSessionStatus;
  qr: string | null;
  phoneNumber: string | null;
}

export interface WhatsAppDisconnectResult {
  success: boolean;
  disconnected: boolean;
  gatewayError: string | null;
}

export interface WhatsAppConfirmation {
  id: number;
  orderId: string;
  status: WhatsAppConfirmationStatus;
  phone: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  responseText: string | null;
  /**
   * What the customer wrote beyond a bare "1"/"2", when they wrote anything.
   * Derived by the server, so it is set on old rows too. A confirmation that
   * also says "change my address" must not look like an ordinary confirmation.
   */
  customerNote: string | null;
  appliedStatus: string | null;
  applyError: string | null;
  errorMessage: string | null;
}

export interface WhatsAppConfirmationMap {
  available: boolean;
  confirmations: Record<string, WhatsAppConfirmation>;
}

/** The server rejects a longer list; see MAX_STATUS_ORDER_IDS. */
export const MAX_CONFIRMATION_ORDER_IDS = 100;

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

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

const toSession = (value: unknown): WhatsAppSession => {
  const row = isRecord(value) ? value : {};
  const dailyLimit = Number(row.dailyLimit);
  const dailySent = Number(row.dailySentCount);
  return {
    status: asString(row.status) || 'disconnected',
    phoneNumber: asString(row.phoneNumber),
    deviceLabel: asString(row.deviceLabel),
    connectedAt: asString(row.connectedAt),
    disconnectedAt: asString(row.disconnectedAt),
    lastSeenAt: asString(row.lastSeenAt),
    lastError: asString(row.lastError),
    consentAcceptedAt: asString(row.consentAcceptedAt),
    dailySentCount: Number.isFinite(dailySent) ? dailySent : 0,
    dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : 0,
  };
};

const toConfirmation = (value: unknown): WhatsAppConfirmation | null => {
  if (!isRecord(value)) return null;
  const orderId = asString(value.orderId);
  if (!orderId) return null;
  const id = Number(value.id);
  return {
    id: Number.isFinite(id) ? id : 0,
    orderId,
    status: asString(value.status) || 'pending',
    phone: asString(value.phone),
    sentAt: asString(value.sentAt),
    expiresAt: asString(value.expiresAt),
    respondedAt: asString(value.respondedAt),
    responseText: asString(value.responseText),
    customerNote: asString(value.customerNote),
    appliedStatus: asString(value.appliedStatus),
    applyError: asString(value.applyError),
    errorMessage: asString(value.errorMessage),
  };
};

const DEFAULT_QUIET_HOURS = { start: 22, end: 9 };

/** An hour of the day, or the documented default when the server said nothing. */
const toHour = (value: unknown, fallback: number): number => {
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : fallback;
};

const toQuietHours = (value: unknown): { start: number; end: number } => {
  const row = isRecord(value) ? value : {};
  return {
    start: toHour(row.start, DEFAULT_QUIET_HOURS.start),
    end: toHour(row.end, DEFAULT_QUIET_HOURS.end),
  };
};

export async function fetchWhatsAppStatus(signal?: AbortSignal): Promise<WhatsAppStatus> {
  const response = await apiFetch('/api/client/whatsapp', { signal });
  if (!response.ok) throw await requestError(response, 'Could not load WhatsApp status.');
  const body = await readObject(response);
  return {
    available: Boolean(body.available),
    hasPlanAccess: Boolean(body.hasPlanAccess),
    connected: Boolean(body.connected),
    session: toSession(body.session),
    autoSend: Boolean(body.autoSend),
    autoSendQuietHours: toQuietHours(body.autoSendQuietHours),
    qr: asString(body.qr),
    gatewayError: asString(body.gatewayError),
  };
}

/**
 * Turn the automatic confirmation sweep on or off for this store.
 *
 * Switching it ON needs the paid plan; switching it OFF is always allowed, so a
 * merchant worried about their number can stop the automation at once.
 */
export async function setWhatsAppAutoSend(autoSend: boolean): Promise<boolean> {
  const response = await apiFetch('/api/client/whatsapp/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ autoSend }),
  });
  if (!response.ok) throw await requestError(response, 'Could not save the automatic sending setting.');
  const body = await readObject(response);
  return Boolean(body.autoSend);
}

/**
 * Starts or resumes this store's session. Returns a QR data URL while pairing;
 * a QR is only good for about twenty seconds, so the caller should keep polling
 * fetchWhatsAppStatus for a fresh one until the status turns "connected".
 */
export async function connectWhatsApp(): Promise<WhatsAppConnectResult> {
  const response = await apiFetch('/api/client/whatsapp/connect', { method: 'POST' });
  if (!response.ok) throw await requestError(response, 'Could not start the WhatsApp connection.');
  const body = await readObject(response);
  return {
    success: Boolean(body.success),
    status: asString(body.status) || 'connecting',
    qr: asString(body.qr),
    phoneNumber: asString(body.phoneNumber),
  };
}

export async function disconnectWhatsApp(): Promise<WhatsAppDisconnectResult> {
  const response = await apiFetch('/api/client/whatsapp', { method: 'DELETE' });
  if (!response.ok) throw await requestError(response, 'Could not disconnect WhatsApp.');
  const body = await readObject(response);
  return {
    success: Boolean(body.success),
    disconnected: Boolean(body.disconnected),
    gatewayError: asString(body.gatewayError),
  };
}

export async function sendWhatsAppConfirmation(orderId: string): Promise<WhatsAppConfirmation> {
  const response = await apiFetch('/api/client/whatsapp/confirmations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId }),
  });
  if (!response.ok) throw await requestError(response, 'Could not send the WhatsApp confirmation.');
  const body = await readObject(response);
  const confirmation = toConfirmation(body.confirmation);
  if (!confirmation) throw new Error('WhatsApp replied without a confirmation record.');
  return confirmation;
}

/**
 * Latest confirmation per order id, for the badges in Order Management.
 * Only the visible page of orders should be asked for; the server caps the list
 * at MAX_CONFIRMATION_ORDER_IDS.
 */
export async function fetchWhatsAppConfirmations(
  orderIds: string[],
  signal?: AbortSignal,
): Promise<WhatsAppConfirmationMap> {
  const ids = Array.from(new Set(orderIds.filter(Boolean))).slice(0, MAX_CONFIRMATION_ORDER_IDS);
  if (ids.length === 0) return { available: false, confirmations: {} };
  const query = encodeURIComponent(ids.join(','));
  const response = await apiFetch(`/api/client/whatsapp/confirmations?orderIds=${query}`, { signal });
  if (!response.ok) throw await requestError(response, 'Could not load WhatsApp confirmation status.');
  const body = await readObject(response);
  const rows = isRecord(body.confirmations) ? body.confirmations : {};
  const confirmations: Record<string, WhatsAppConfirmation> = {};
  for (const [orderId, value] of Object.entries(rows)) {
    const parsed = toConfirmation(value);
    if (parsed) confirmations[orderId] = parsed;
  }
  return { available: Boolean(body.available), confirmations };
}
