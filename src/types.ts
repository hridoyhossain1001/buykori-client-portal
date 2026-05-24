/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Platform = 'Meta CAPI' | 'TikTok Events API' | 'GA4';

export type EventStatus = 'Success' | 'Failed' | 'Retry';

export interface CAPIEvent {
  id: string;
  timestamp: string;
  name: string;
  platform: Platform;
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
  platform: Platform;
  endpoint: string;
  method: 'POST' | 'GET' | 'PUT';
  statusCode: number;
  latencyMs: number;
  retryCount: number;
  requestBody: string;
  responseBody: string;
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
}

export interface UserProfile {
  name: string;
  email: string;
  notificationEmail: string;
  plan: string;
  eventsUsed: number;
  eventsQuota: number;
  renewalDate: string;
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
