/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Platform = 'Meta CAPI' | 'TikTok Events API' | 'GA4';

export type EventStatus = 'Success' | 'Failed' | 'Filtered' | 'Retry' | 'Fired';

export interface CAPIEvent {
  id: string;
  timestamp: string;
  name: string;
  platform: Platform | 'TikTok Browser Pixel' | 'Gateway Ingest';
  status: EventStatus;
  httpCode: number;
  deduplicationKey: string;
  contextLabel?: string;
  pageTitle?: string | null;
  pageUrl?: string | null;
  contentName?: string | null;
  orderId?: string | null;
  itemCount?: number | null;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
  responseBody: unknown;
  latencyMs: number | null;
}

export interface APILog {
  id: string;
  timestamp: string;
  platform: CAPIEvent['platform'];
  endpoint: string;
  method: 'POST' | 'GET' | 'PUT';
  statusCode: number;
  latencyMs: number | null;
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

export type CustomEventTrigger = 'timer' | 'click' | 'url' | 'form' | 'scroll' | 'visible';

export interface CustomEventAutomation {
  id: string;
  name: string;
  trigger: CustomEventTrigger;
  selector: string;
  url_pattern: string;
  seconds?: number | null;
  scroll_depth?: number | null;
  value: number;
  currency: string;
  custom_param: string;
  customData?: Record<string, string>;
  enabled: boolean;
}

export interface ClientConnection {
  token: string;
  wpVersion: string;
  pluginVersion?: string;
  lastHeartbeat: string;
  status: 'Active' | 'Degraded' | 'Disconnected';
  api_key?: string;
  bindingVerified?: boolean;
  reconnectRequired?: boolean;
  siteHost?: string;
  connectionIssue?: string;
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
  planTier?: string;
  isTrial?: boolean;
  trialEndsAt?: string | null;
  trialDaysRemaining?: number;
  eventsUsed: number;
  eventsQuota: number;
  ordersUsed?: number;
  ordersQuota?: number;
  renewalDate: string;
  growthFeaturesEnabled?: boolean;
  planFeatures?: Array<{
    key: string;
    label: string;
    description: string;
    included: boolean;
    minimumPlan: string;
  }>;
  ownerNotifyWhatsapp?: boolean;
  ownerWhatsappNumber?: string;
  guideDismissed?: boolean;
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
  customParams?: Record<string, unknown>;
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

export interface AdAccount {
  id: number;
  platform: 'meta' | 'tiktok';
  external_account_id: string;
  account_name: string;
  account_currency?: string;
  account_timezone?: string;
  last_synced_at?: string | null;
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
  products?: DeferredOrderProduct[];
}

export interface FulfillmentOrder {
  id?: number;
  orderId?: string;
  order_id?: string;
  customer?: string;
  recipientName?: string;
  recipient_name?: string;
  recipientPhone?: string;
  recipient_phone?: string;
  recipientAddress?: string;
  recipient_address?: string;
  amount?: number;
  cod_amount?: number;
  delivery_charge?: number;
  created_at?: string;
  timestamp?: string;
  products?: DeferredOrderProduct[];
  courier_provider?: string;
  courier_order_id?: string;
  courier_tracking_id?: string;
}

export interface CourierBookingPayload {
  pending_event_id: number;
  courier_provider: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  item_weight: number;
  item_quantity: number;
  store_id?: number;
  recipient_city?: number;
  recipient_zone?: number;
  recipient_area?: number;
  delivery_area_id?: number;
  delivery_area_name?: string;
  pickup_store_id?: number;
}

export interface StoreInfo {
  client_id: number;
  name: string;
  domain: string;
  is_current: boolean;
}

export interface SidebarStatus {
  orderVerificationNew: number;
  ordersDeliveryNew: number;
}

export interface DeferredOrderProduct {
  id?: string;
  content_id?: string;
  name?: string;
  content_name?: string;
  category?: string;
  content_category?: string;
  attributes?: Record<string, unknown>;
  quantity?: number;
  price?: number;
}

export interface DeferredOrder {
  orderId: string;
  amount: number;
  productSubtotal?: number;
  deliveryCharge?: number;
  otherAdjustment?: number;
  discount?: number;
  orderTotal?: number;
  customer?: string;
  fraudScore?: number;
  fraudDetails?: Record<string, boolean>;
  ageHours?: number | string;
  timestamp?: string;
  operationsOnly?: boolean;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_address?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  name?: string;
  phone?: string;
  address?: string;
  products?: DeferredOrderProduct[];
}

export interface DeferredData {
  deferredEnabled?: boolean;
  autoConfirmDays?: number;
  autoConfirmStatus?: string;
  pendingCount?: number;
  deferredPendingCount?: number;
  operationsPendingCount?: number;
  pendingValue?: number | string;
  deferredPendingValue?: number | string;
  confirmedTotal?: number;
  cancelledTotal?: number;
  expiredTotal?: number;
  confirmedToday?: number;
  oldestPending?: number | string;
  deferredOldestPending?: number | string;
  pendingList?: DeferredOrder[];
  deferredPendingList?: DeferredOrder[];
  operationsPendingList?: DeferredOrder[];
}

export interface IncompleteCheckoutProduct {
  id?: string;
  content_id?: string;
  name?: string;
  content_name?: string;
  category?: string;
  content_category?: string;
  attributes?: Record<string, string>;
  quantity?: number;
  price?: number;
  item_price?: number;
}

export interface IncompleteCheckoutItem {
  id: number;
  phone: string;
  customerName: string;
  email: string;
  address: string;
  products: IncompleteCheckoutProduct[];
  amount: number;
  currency: string;
  pageUrl: string;
  campaignData: Record<string, string>;
  status: string;
  orderId?: string | null;
  lastActivityAt: string;
}

export interface IncompleteCheckoutData {
  items: IncompleteCheckoutItem[];
  counts: Record<string, number>;
  restricted?: boolean;
}

export interface RecoveryOrderItem {
  name: string;
  content_id: string;
  quantity: number;
  price: number;
  attributes: Record<string, string>;
  category: string;
}

export interface RecoveryOrderPayload {
  customer_name: string;
  phone: string;
  address: string;
  items: RecoveryOrderItem[];
  delivery_charge: number;
  discount: number;
  note: string;
}

export interface AnalyticsFunnelStep {
  step: string;
  count: number;
  conversion_rate?: number;
  drop_off?: number;
}

export interface AnalyticsOverview {
  total_events?: number;
  success_rate?: number;
  avg_daily_events?: number;
  funnel: AnalyticsFunnelStep[];
}

export interface CampaignAttributionRow {
  source: string;
  campaign: string;
  view_content: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchase: number;
  revenue: number;
  currency?: string;
}

export interface AnalyticsCampaigns {
  campaigns: CampaignAttributionRow[];
}

export interface AudienceBreakdownRow {
  label: string;
  count: number;
  percentage: number;
}

export interface DistrictFunnelRow {
  district: string;
  page_view: number;
  add_to_cart: number;
  initiate_checkout: number;
  purchase: number;
  revenue: number;
  currency?: string;
}

export interface AnalyticsAudience {
  top_districts: AudienceBreakdownRow[];
  device_mix: AudienceBreakdownRow[];
  browser_mix: AudienceBreakdownRow[];
  district_funnel: DistrictFunnelRow[];
  visitor_district_funnel: DistrictFunnelRow[];
  notice?: string;
}

export interface SignalRates {
  event_id?: number;
  user_match?: number;
  email_or_phone?: number;
  click_id?: number;
  content_ids?: number;
  value?: number;
  utm?: number;
}

export interface SignalIssue {
  severity?: string;
  title?: string;
  message?: string;
  recommendation?: string;
  impact?: string;
  fix?: string;
  metric?: string;
}

export interface SignalDoctor {
  score?: number;
  grade?: string;
  issues: SignalIssue[];
  signal_rates: SignalRates | null;
}

export interface TrendPoint {
  name?: string;
  date?: string;
  total?: number;
  success?: number;
  failed?: number;
  value?: number;
  'Meta CAPI'?: number;
  'TikTok Events'?: number;
  GA4?: number;
}

export interface RecoverySummary {
  browser_events: number;
  server_events: number;
  server_attempt_events?: number;
  server_failed_events?: number;
  server_filtered_events?: number;
  server_processed_events?: number;
  platform_stats?: Record<string, {
    attempts: number;
    successful: number;
    failed: number;
    filtered: number;
    last_event_at: string | null;
  }>;
  server_missing_event_id_events?: number;
  diagnostic_reasons?: Array<{
    status: string;
    reason: string;
    count: number;
  }>;
  matched_events: number;
  recovered_events: number;
  recovery_rate: number;
}

export interface CampaignDispatchResponse {
  statusCode: number;
  body: {
    success?: boolean;
    [key: string]: unknown;
  };
}

export interface SyncedAdCampaign {
  id?: string;
  external_campaign_id?: string;
  name: string;
  platform: 'meta' | 'tiktok';
  status?: string;
}

export interface AdPerformanceRow {
  platform?: string;
  campaign_name?: string;
  campaign_id?: string;
  spend?: number;
  spend_currency?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  cpc?: number;
  placed_purchases?: number;
  placed_revenue?: number;
  placed_roas?: number;
  confirmed_purchases?: number;
  confirmed_revenue?: number;
  confirmed_roas?: number;
  confirmed_cpa?: number;
  revenue_currency?: string;
  tracking_bypass_rate?: number;
}

export interface AdPerformanceMeta {
  sync_enabled: boolean;
  connected_accounts: number;
  last_synced_at: string | null;
  missing_attribution_purchases: number;
}
