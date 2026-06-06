/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Platform = 'Meta CAPI' | 'TikTok Events API' | 'GA4';

export type EventStatus = 'Success' | 'Failed' | 'Retry' | 'Fired';

export interface CAPIEvent {
  id: string;
  timestamp: string;
  name: string;
  platform: Platform | 'TikTok Browser Pixel' | 'Gateway Ingest';
  status: EventStatus;
  httpCode: number;
  deduplicationKey: string;
  payload: any;
  headers: Record<string, string>;
  responseBody: any;
  latencyMs: number;
}

export interface APILog {
  id: string;
  timestamp: string;
  platform: CAPIEvent['platform'];
  endpoint: string;
  method: 'POST' | 'GET' | 'PUT';
  statusCode: number;
  latencyMs: number;
  retryCount: number;
  requestBody: string;
  responseBody: string;
}

export interface OutboxItem {
  id: number;
  status: 'queued' | 'processing' | 'dead' | 'sent';
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastError: string;
  createdAt: string;
  sentAt: string | null;
  locked: boolean;
  eventNames: string[];
  eventCount: number;
  eventIds: string[];
}

export interface PlatformConfig {
  enabled: boolean;
  pixelIdOrMeasurementId: string;
  accessToken: string;
  testEventCode?: string;
  status: 'Valid' | 'Invalid' | 'Untested';
}

export interface EventRule {
  eventName: string;
  metaEnabled: boolean;
  tiktokEnabled: boolean;
  ga4Enabled: boolean;
}

export interface ClientConnection {
  token: string;
  wpVersion: string;
  lastHeartbeat: string;
  status: 'Active' | 'Degraded' | 'Disconnected';
  api_key?: string;
}

export interface PluginReleaseInfo {
  version: string;
  download_url: string;
  package_sha256: string;
  package_size: number;
  package_available: boolean;
  requires: string;
  tested: string;
  requires_php: string;
  last_updated: string;
}

export interface UserProfile {
  name: string;
  email: string;
  notificationEmail: string;
  plan: string;
  eventsUsed: number;
  eventsQuota: number;
  renewalDate: string;
  growthFeaturesEnabled?: boolean;
}

export interface Suggestion {
  id: string;
  title: string;
  severity: 'Critical' | 'Warning' | 'Tip';
  explanation: string;
  fixAction: string;
  resolved: boolean;
  platform?: Platform;
}

export interface CampaignPayload {
  platform: Platform;
  eventName: string;
  value?: string;
  currency?: string;
  email?: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
  customParams?: Record<string, any>;
}

export interface CourierSettings {
  pathao_api_key?: string;
  pathao_secret_key?: string;
  pathao_client_id?: string;
  pathao_email?: string;
  pathao_client_secret?: string;
  pathao_password?: string;
  pathao_store_id?: string;
  pathao_environment?: 'live' | 'sandbox';
  pathao_webhook_secret?: string;
  pathao_webhook_secret_configured?: boolean;
  pathao_webhook_verified_at?: string;
  steadfast_api_key?: string;
  steadfast_secret_key?: string;
  steadfast_webhook_token_configured?: boolean;
  redx_access_token?: string;
  redx_pickup_store_id?: string;
  redx_delivery_area_id?: string;
  redx_delivery_area_name?: string;
  redx_webhook_secret_configured?: boolean;
  courier_auto_send: boolean;
  default_courier?: string;
}

export interface CourierOrder {
  id: number;
  order_id: string;
  courier_provider: string;
  courier_order_id?: string;
  courier_tracking_id?: string;
  courier_status: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  cod_amount: number;
  delivery_charge: number;
  created_at: string;
  purchase_event_sent: boolean;
}
