/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  initialProfile, 
  initialConnection, 
  initialRules, 
  initialSuggestions, 
  generateEventData, 
  generateAPILogs 
} from "./src/lib/mock-data.js";
import { CAPIEvent, APILog, Suggestion, Platform, EventRule, PlatformConfig, OutboxItem } from "./src/types.js";
import type { AnalyticsCampaigns, RecoverySummary } from "./src/types.js";

const isProductionRuntime = process.env.NODE_ENV === "production";
const allowProductionMockServer = process.env.BUYKORI_ALLOW_MOCK_SERVER_PRODUCTION === "1";
const HOST = process.env.BUYKORI_MOCK_SERVER_HOST || (isProductionRuntime ? "127.0.0.1" : "0.0.0.0");
const PORT = Number(process.env.PORT || 3000);

/**
 * Stand-in for a WooCommerce product photo in the demo dataset. Real payloads
 * carry an absolute URL from the merchant's own media library, and the portal
 * only renders http(s) URLs, so the mock has to be absolute too — pointing back
 * at this same server keeps the preview working with no network access.
 */
const MOCK_PRODUCT_IMAGE = `http://localhost:${PORT}/logo.png`;

function assertMockServerMayStart() {
  if (isProductionRuntime && !allowProductionMockServer) {
    throw new Error(
      "client-portal/server.ts is a local mock API server and must not run in production. " +
      "Deploy the Vite static app against the authenticated backend/BFF instead. " +
      "For an intentional local smoke test only, set BUYKORI_ALLOW_MOCK_SERVER_PRODUCTION=1."
    );
  }
}

interface MockPendingOrder {
  id: number;
  orderId: string;
  amount: number;
  customer: string;
  fraudScore: number;
  /**
   * Same shape as production: plain boolean signals plus the nested
   * `courier_summary` object the on-demand courier check writes.
   */
  fraudDetails: Record<string, unknown>;
  ageHours: number;
  timestamp: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  products?: Array<Record<string, unknown>>;
  productSubtotal?: number;
  deliveryCharge?: number;
  discount?: number;
  orderTotal?: number;
  note?: string;
  status?: string;
  workflowStatus?: string;
  /**
   * Where the order came from, as production sends it: `order_marketing()` in
   * app/services/attribution.py reads the held Purchase payload's own UTM keys.
   * Absent here on purpose for one order, so the "Direct" fallback is visible
   * locally instead of only in production.
   */
  marketing?: { source?: string; campaign?: string } | null;
}

interface MockCourierOrder {
  id: number;
  order_id: string;
  courier_provider: string;
  courier_order_id: string;
  courier_tracking_id: string;
  courier_status: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  cod_amount: number;
  delivery_charge: number;
  created_at: string;
  purchase_event_sent: boolean;
  refund_event_sent?: boolean;
  pending_event_id?: number;
  /**
   * Production's `GET /courier/orders` reads these back out of the stored
   * WooCommerce payload (`app/routers/courier_api.py`), so a booked order still
   * shows what was in it after its verification record is gone. Without them the
   * local drawer for a booked order looks empty for a reason production has not.
   */
  products?: Array<Record<string, unknown>>;
  marketing?: { source?: string; campaign?: string } | null;
}

interface MockIncompleteCheckout {
  id: number;
  phone: string;
  customerName: string;
  email: string;
  address: string;
  products: Array<Record<string, unknown>>;
  pageUrl: string;
  campaignData: Record<string, string>;
  lastActivityAt: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  amount: number;
  currency: string;
  source: string;
  status: string;
  recovery_url: string;
  created_at: string;
  updated_at: string;
  items: string[];
  orderId?: string;
  /** Stamped when a row settles; the live recovery totals filter on it. */
  convertedAt?: string;
}

/** CP-03: shared validation for the deferred COD endpoints. */
function readOrderId(body: unknown): string | null {
  const value = (body as Record<string, unknown> | null | undefined)?.order_id;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOrderIds(body: unknown): string[] | null {
  const value = (body as Record<string, unknown> | null | undefined)?.order_ids;
  if (!Array.isArray(value)) return null;
  const ids = value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  return ids.length === value.length ? ids : null;
}

async function startServer() {
  assertMockServerMayStart();

  const app = express();
  app.use(express.json());

  // In-memory backend database state
  let profile = { ...initialProfile };
  let connection = { ...initialConnection };
  let rules = [...initialRules];
  let suggestions = [...initialSuggestions];

  // Deferred Purchase / COD Protection settings & mock queue
  let deferredEnabled = false;
  let autoConfirmDays = 3;
  let autoConfirmStatus = "completed";
  let pendingOrders: MockPendingOrder[] = [
    {
      id: 101,
      orderId: "WC-9283",
      amount: 2490,
      customer: "+8801712345678",
      recipientName: "Rafi Ahmed",
      recipientPhone: "+8801711112222",
      recipientAddress: "Mirpur, Dhaka",
      products: [
        {
          id: "hoodie-black-36",
          name: "Premium Hoodie",
          quantity: 1,
          price: 2490,
          image: MOCK_PRODUCT_IMAGE,
          attributes: { Color: "Black", Size: "36" },
        },
      ],
      productSubtotal: 2490,
      deliveryCharge: 0,
      discount: 0,
      orderTotal: 2490,
      fraudScore: 12,
      fraudDetails: {},
      marketing: { source: "facebook", campaign: "winter-hoodie-retarget" },
      ageHours: 5.2,
      timestamp: new Date(Date.now() - 5.2 * 3600000).toISOString()
    },
    {
      id: 102,
      orderId: "WC-9284",
      amount: 4500,
      customer: "customer@domain.com",
      recipientName: "Nusrat Jahan",
      recipientPhone: "+8801812349999",
      recipientAddress: "Dhanmondi, Dhaka",
      products: [
        {
          id: "serum-bundle",
          name: "Serum Bundle",
          quantity: 1,
          price: 4500,
          attributes: { Variant: "Glow, Repair", Note: "COD: Fragile" },
        },
      ],
      productSubtotal: 4500,
      deliveryCharge: 0,
      discount: 0,
      orderTotal: 4500,
      fraudScore: 78,
      fraudDetails: { ip_mismatch: true, gibberish_name: true },
      // No marketing key at all: this is the untagged order, shown as "Direct".
      ageHours: 12.8,
      timestamp: new Date(Date.now() - 12.8 * 3600000).toISOString()
    },
    {
      /**
       * The booking the courier rejected.
       *
       * This order is in `courierOrders` too, with `courier_status:
       * "booking_failed"` — the one state production leaves in both feeds at
       * once. On terminal failure the booking worker sets the consignment to
       * `booking_failed` and resets its PendingEvent back to `status="pending"`
       * (app/services/courier/courier_booking_service.py), so the row keeps its
       * place in `pendingList` while the booked-order subquery drops it from
       * `operationsPendingList`. Without a row like this the local preview can
       * never reach the retry path, which is exactly how it went unnoticed.
       */
      id: 103,
      orderId: "WC-9285",
      amount: 1850,
      customer: "+8801933334444",
      recipientName: "Tanvir Hasan",
      recipientPhone: "+8801933334444",
      recipientAddress: "Chandgaon, Chattogram",
      products: [
        {
          id: "kettle-1-8l",
          name: "Electric Kettle 1.8L",
          quantity: 1,
          price: 1850,
          attributes: { Colour: "Steel" },
        },
      ],
      productSubtotal: 1850,
      deliveryCharge: 0,
      discount: 0,
      orderTotal: 1850,
      fraudScore: 22,
      fraudDetails: {},
      marketing: { source: "facebook", campaign: "kitchen-eid" },
      ageHours: 8.6,
      timestamp: new Date(Date.now() - 8.6 * 3600000).toISOString()
    }
  ];
  /** API-05: archive backing /api/deferred/restore, which the frontend already calls. */
  let archivedOrders: Array<{ action: "confirm" | "cancel"; order: MockPendingOrder }> = [];
  let confirmedTotal = 12;
  let cancelledTotal = 2;
  let confirmedToday = 2;

  /**
   * WhatsApp order confirmations, mocked.
   *
   * Production serves these from app/routers/whatsapp_api.py behind a server flag
   * and a linked number. Both report as on here, otherwise the Orders table hides
   * its WhatsApp column locally and the layout cannot be reviewed at all. Field
   * names match that router's camelCase responses exactly.
   */
  let whatsappAutoSend = false;
  const whatsappQuietHours = { start: 23, end: 7 };
  let whatsappConfirmationSeq = 39;
  /** Keyed by orderId, latest request per order — the shape /confirmations returns. */
  const whatsappConfirmations: Record<string, Record<string, unknown>> = {
    // One order already waiting on a reply, so the badge and the poll have
    // something real to show before anyone presses a button.
    "WC-9284": {
      id: 39,
      orderId: "WC-9284",
      status: "sent",
      phone: "+8801812349999",
      sentAt: new Date(Date.now() - 40 * 60000).toISOString(),
      expiresAt: new Date(Date.now() + 20 * 3600000).toISOString(),
      respondedAt: null,
      responseText: null,
      appliedStatus: null,
      applyError: null,
      errorMessage: null,
    },
  };
  let sidebarSeenState: Record<string, string> = {};
  let currentStoreId = 1;
  let stores = [
    {
      id: 1,
      name: "Buykori Demo Store",
      domain: "buykori-demo.com",
      is_current: true,
      role: "Owner",
    },
    {
      id: 2,
      name: "Growth Lab Store",
      domain: "growth-lab.shop",
      is_current: false,
      role: "Admin",
    },
  ];
  let adAccounts = [
    {
      id: 1,
      platform: "meta",
      external_account_id: "act_mock_1001",
      account_name: "Mock Meta Account",
      account_currency: "BDT",
      account_timezone: "Asia/Dhaka",
      last_synced_at: new Date().toISOString(),
    },
  ];
  let aiAdsConnections = [
    {
      id: 41,
      provider: "meta",
      status: "connected",
      permission_status: "granted",
      token_status: "valid",
      scopes: ["ads_read", "ads_management", "business_management"],
      accounts: [
        {
          external_account_id: "act_mock_1001",
          account_name: "Buykori Main Ads",
          status: 1,
          currency: "BDT",
          timezone: "Asia/Dhaka",
        },
      ],
      created_at: new Date().toISOString(),
    },
  ];
  let aiAdsProposals = [
    {
      id: 501,
      account_id: 1,
      operation: "pause_campaign",
      risk: "MEDIUM",
      before_state: { campaign_id: "mock-meta-prospecting", status: "ACTIVE" },
      requested_state: { campaign_id: "mock-meta-prospecting", status: "PAUSED" },
      exact_changes: { operation: "pause_campaign", arguments: { campaign_id: "mock-meta-prospecting" } },
      policy_decision: { allowed: true, reasons: [] as string[] },
      proposal_hash: "a".repeat(64),
      status: "pending",
      expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
      created_at: new Date().toISOString(),
    },
  ];
  let aiAdsActions: Array<{ id: number; operation: string; provider: string; status: string; created_at: string }> = [];
  let aiConversationId = 700;
  let courierSettings: Record<string, any> = {
    courier_auto_send: false,
    default_courier: "steadfast",
    pathao_environment: "sandbox",
    pathao_store_id: "",
    pathao_api_key: "",
    pathao_secret_key: "",
    steadfast_api_key: "",
    steadfast_secret_key: "",
    steadfast_webhook_token_configured: false,
    steadfast_webhook_verified_at: null,
    redx_access_token: "",
    redx_webhook_secret_configured: false,
    redx_webhook_verified_at: null,
    pathao_webhook_secret_configured: false,
    pathao_webhook_verified_at: null,
  };
  const courierWebhookSecrets: Record<'steadfast' | 'pathao' | 'redx', string> = {
    steadfast: 'sandbox-steadfast-webhook-token',
    pathao: 'sandbox-pathao-webhook-secret',
    redx: 'sandbox-redx-webhook-token',
  };
  let incompleteCheckouts: MockIncompleteCheckout[] = [
    {
      // Still at checkout: the plugin has upserted the cart but the inactivity
      // timer has not fired yet, so production keeps it out of the default list
      // and only reports it through `counts`. Email and address arrive as the
      // literal "N/A" until the customer types them.
      id: 303,
      phone: "+8801933337777",
      customerName: "Tanvir Hasan",
      email: "N/A",
      address: "N/A",
      products: [
        {
          id: "kettle-1l",
          name: "Electric Kettle 1L",
          category: "Home",
          attributes: { Colour: "Steel" },
          quantity: 1,
          price: 1890,
        },
      ],
      pageUrl: "https://buykori-demo.com/checkout",
      campaignData: { utm_source: "google", utm_medium: "cpc" },
      lastActivityAt: new Date(Date.now() - 3 * 60000).toISOString(),
      customer_name: "Tanvir Hasan",
      customer_phone: "+8801933337777",
      customer_email: "N/A",
      amount: 1890,
      currency: "BDT",
      source: "woocommerce",
      status: "active",
      recovery_url: "https://buykori-demo.com/checkout/recover/303",
      created_at: new Date(Date.now() - 5 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 60000).toISOString(),
      items: ["Electric Kettle 1L"],
    },
    {
      id: 301,
      phone: "+8801711112222",
      customerName: "Rafi Ahmed",
      email: "rafi@example.com",
      address: "Mirpur, Dhaka",
      products: [
        {
          id: "hoodie-black-36",
          name: "Premium Hoodie",
          category: "Apparel",
          attributes: { Color: "Black", Size: "36" },
          quantity: 1,
          price: 2490,
          // Only some rows carry a photo on purpose. The API borrows it from the
          // store's completed orders, so a product the store has never sold has
          // none, and the preview should show that fallback too.
          image: MOCK_PRODUCT_IMAGE,
        },
        {
          id: "cod-delivery",
          name: "COD Delivery",
          category: "Shipping",
          attributes: { Zone: "Inside Dhaka" },
          quantity: 1,
          price: 300,
        },
      ],
      pageUrl: "https://buykori-demo.com/cart",
      campaignData: { utm_source: "facebook", utm_campaign: "eid_offer" },
      lastActivityAt: new Date(Date.now() - 1.1 * 3600000).toISOString(),
      customer_name: "Rafi Ahmed",
      customer_phone: "+8801711112222",
      customer_email: "rafi@example.com",
      amount: 2790,
      currency: "BDT",
      source: "woocommerce",
      status: "incomplete",
      recovery_url: "https://buykori-demo.com/checkout/recover/301",
      created_at: new Date(Date.now() - 2.4 * 3600000).toISOString(),
      updated_at: new Date(Date.now() - 1.1 * 3600000).toISOString(),
      items: ["Premium Hoodie", "COD Delivery"],
    },
    {
      id: 302,
      phone: "+8801812349999",
      customerName: "Nusrat Jahan",
      email: "nusrat@example.com",
      address: "Dhanmondi, Dhaka",
      products: [
        {
          id: "serum-bundle",
          name: "Serum Bundle",
          category: "Beauty",
          attributes: { Variant: "Glow, Repair", Offer: "Buy 1, Get 1" },
          quantity: 1,
          price: 4250,
          image: MOCK_PRODUCT_IMAGE,
        },
      ],
      pageUrl: "https://growth-lab.shop/cart",
      campaignData: { utm_source: "tiktok", utm_campaign: "beauty_bundle" },
      lastActivityAt: new Date(Date.now() - 6 * 3600000).toISOString(),
      customer_name: "Nusrat Jahan",
      customer_phone: "+8801812349999",
      customer_email: "nusrat@example.com",
      amount: 4250,
      currency: "BDT",
      source: "shopify",
      status: "contacted",
      recovery_url: "https://growth-lab.shop/checkouts/recover/302",
      created_at: new Date(Date.now() - 22 * 3600000).toISOString(),
      updated_at: new Date(Date.now() - 6 * 3600000).toISOString(),
      items: ["Serum Bundle"],
    },
    {
      // Recovered by the merchant from this page: the order id carries the
      // `manual-` prefix production writes, and the order is waiting in COD
      // review for confirmation.
      id: 304,
      phone: "+8801722224444",
      customerName: "Shahida Akter",
      email: "shahida@example.com",
      address: "Uttara Sector 7, Dhaka",
      products: [
        {
          id: "saree-jamdani",
          name: "Jamdani Saree",
          category: "Apparel",
          attributes: { Colour: "Maroon" },
          quantity: 1,
          price: 3300,
          image: MOCK_PRODUCT_IMAGE,
        },
        {
          id: "cod-delivery",
          name: "COD Delivery",
          category: "Shipping",
          attributes: { Zone: "Inside Dhaka" },
          quantity: 1,
          price: 300,
        },
      ],
      pageUrl: "https://buykori-demo.com/checkout",
      campaignData: { utm_source: "facebook", utm_campaign: "saree_launch" },
      lastActivityAt: new Date(Date.now() - 9 * 3600000).toISOString(),
      customer_name: "Shahida Akter",
      customer_phone: "+8801722224444",
      customer_email: "shahida@example.com",
      amount: 3600,
      currency: "BDT",
      source: "woocommerce",
      status: "recovered",
      orderId: "manual-304-1756000000",
      recovery_url: "https://buykori-demo.com/checkout/recover/304",
      created_at: new Date(Date.now() - 11 * 3600000).toISOString(),
      updated_at: new Date(Date.now() - 8.5 * 3600000).toISOString(),
      items: ["Jamdani Saree", "COD Delivery"],
    },
    {
      // Recovered on its own: the customer came back and placed the order in
      // the store, so the id is a real store order number, not a manual one.
      id: 305,
      phone: "+8801655558888",
      customerName: "Imran Kabir",
      email: "N/A",
      address: "Agrabad, Chattogram",
      products: [
        {
          id: "watch-titan",
          name: "Titan Analog Watch",
          category: "Accessories",
          attributes: { Strap: "Leather" },
          quantity: 1,
          price: 5250,
        },
      ],
      pageUrl: "https://growth-lab.shop/checkout",
      campaignData: {},
      lastActivityAt: new Date(Date.now() - 26 * 3600000).toISOString(),
      customer_name: "Imran Kabir",
      customer_phone: "+8801655558888",
      customer_email: "N/A",
      amount: 5250,
      currency: "BDT",
      source: "shopify",
      status: "recovered",
      orderId: "4471",
      recovery_url: "https://growth-lab.shop/checkouts/recover/305",
      created_at: new Date(Date.now() - 30 * 3600000).toISOString(),
      updated_at: new Date(Date.now() - 25 * 3600000).toISOString(),
      items: ["Titan Analog Watch"],
    },
    {
      // Ignored by the merchant. Production leaves it out of the default list,
      // which is exactly why the workspace's Undo is the only way back.
      id: 306,
      phone: "+8801544449999",
      customerName: "N/A",
      email: "N/A",
      address: "N/A",
      products: [
        {
          id: "phone-case",
          name: "Silicone Phone Case",
          category: "Accessories",
          attributes: {},
          quantity: 1,
          price: 990,
        },
      ],
      pageUrl: "https://buykori-demo.com/cart",
      campaignData: { utm_source: "instagram" },
      lastActivityAt: new Date(Date.now() - 50 * 3600000).toISOString(),
      customer_name: "N/A",
      customer_phone: "+8801544449999",
      customer_email: "N/A",
      amount: 990,
      currency: "BDT",
      source: "woocommerce",
      status: "ignored",
      recovery_url: "https://buykori-demo.com/checkout/recover/306",
      created_at: new Date(Date.now() - 54 * 3600000).toISOString(),
      updated_at: new Date(Date.now() - 49 * 3600000).toISOString(),
      items: ["Silicone Phone Case"],
    },
  ];
  let courierOrders: MockCourierOrder[] = [
    {
      id: 701,
      order_id: "WC-9283",
      courier_provider: "steadfast",
      courier_order_id: "SF-9283",
      courier_tracking_id: "TRK9283BD",
      courier_status: "pending",
      recipient_name: "Rafi Ahmed",
      recipient_phone: "+8801711112222",
      recipient_address: "Mirpur, Dhaka",
      cod_amount: 2490,
      delivery_charge: 80,
      created_at: new Date(Date.now() - 3 * 3600000).toISOString(),
      purchase_event_sent: false,
      products: [
        { name: "Premium Hoodie (Black, 36)", quantity: 1, price: 2490 },
      ],
      marketing: { source: "tiktok", campaign: "hoodie-launch" },
    },
    {
      /**
       * The rejected booking, paired with pending order 103.
       *
       * Production keeps returning this row: `GET /courier/orders` only hides
       * `courier_status == "cancelled"` (app/routers/courier_api.py), and
       * `enqueue_courier_booking` accepts a second attempt for this one state
       * alone, resetting the row and its job instead of answering
       * `already_booked`. No tracking id, because the courier never issued one.
       */
      id: 702,
      order_id: "WC-9285",
      courier_provider: "pathao",
      courier_order_id: "",
      courier_tracking_id: "",
      courier_status: "booking_failed",
      recipient_name: "Tanvir Hasan",
      recipient_phone: "+8801933334444",
      recipient_address: "Chandgaon, Chattogram",
      cod_amount: 1850,
      delivery_charge: 0,
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      purchase_event_sent: false,
      pending_event_id: 103,
      products: [
        { name: "Electric Kettle 1.8L (Steel)", quantity: 1, price: 1850 },
      ],
      marketing: { source: "facebook", campaign: "kitchen-eid" },
    },
  ];
  
  // Platform Credentials state
  let credentials: Record<Platform, PlatformConfig> = {
    'Meta CAPI': { enabled: true, pixelIdOrMeasurementId: "mock-meta-pixel-id", accessToken: "mock_meta_access_token", status: "Valid" },
    'TikTok Events API': { enabled: true, pixelIdOrMeasurementId: "mock-tiktok-pixel-id", accessToken: "mock_tiktok_access_token", status: "Valid" },
    'GA4': { enabled: true, pixelIdOrMeasurementId: "mock-ga4-measurement-id", accessToken: "mock_ga4_api_secret", status: "Valid" }
  };
  let customEventAutomations: Array<Record<string, unknown>> = [];

  // Generate initial database of events & raw API logs
  let events = generateEventData();
  let apiLogs = generateAPILogs(events);
  let outboxItems: OutboxItem[] = [
    {
      id: 901,
      status: "dead",
      attempts: 8,
      maxAttempts: 8,
      nextAttemptAt: null,
      lastError: "Meta CAPI rejected the request: invalid or expired access token.",
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      sentAt: null,
      locked: false,
      eventNames: ["Purchase"],
      eventCount: 1,
      eventIds: ["demo_purchase_retry_901"]
    },
    {
      id: 902,
      status: "queued",
      attempts: 2,
      maxAttempts: 8,
      nextAttemptAt: new Date(Date.now() + 12 * 60000).toISOString(),
      lastError: "TikTok Events API timed out on the previous attempt.",
      createdAt: new Date(Date.now() - 42 * 60000).toISOString(),
      sentAt: null,
      locked: false,
      eventNames: ["AddToCart", "InitiateCheckout"],
      eventCount: 2,
      eventIds: ["demo_cart_retry_902"]
    }
  ];

  // Helper: record a new tracking event
  function addTrackingEvent(name: string, platform: Platform, status: 'Delivered' | 'Failed' | 'Retry', httpCode: number, payload: any, customRes?: any) {
    const timestamp = new Date().toISOString();
    const id = `evt_${200000 + events.length}`;
    const dedupeKey = `did_${900000 + events.length}`;
    
    const newEvent: CAPIEvent = {
      id,
      timestamp,
      name,
      platform,
      status,
      httpCode,
      deduplicationKey: dedupeKey,
      payload,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer credentials_mask_***`,
        'X-Client-IP': payload?.user_data?.client_ip_address || "127.0.0.1",
        'User-Agent': payload?.user_data?.client_user_agent || 'WordPress/6.4.3'
      },
      responseBody: customRes || (status === 'Delivered'
        ? { events_received: 1, status: "accepted", fb_trace_id: `FBT_${Math.random().toString(36).substring(7).toUpperCase()}` }
        : { error: { message: "Invalid payload params", code: httpCode } }),
      latencyMs: Math.floor(Math.random() * 150) + 50
    };

    events.unshift(newEvent); // Add to beginning of local array
    
    // Add raw API call mirroring
    const apiLog: APILog = {
      id: `api_${id.split('_')[1]}`,
      timestamp,
      platform,
      endpoint: platform === 'Meta CAPI' ? 'https://graph.facebook.com/v18.0/pixel_id/events' : 
                platform === 'TikTok Events API' ? 'https://open-api.tiktok.com/v1.3/pixel/track' : 
                'https://www.google-analytics.com/mp/collect',
      method: 'POST',
      statusCode: httpCode,
      latencyMs: newEvent.latencyMs,
      retryCount: status === 'Retry' ? 1 : status === 'Failed' ? 2 : 0,
      requestBody: JSON.stringify(payload, null, 2),
      responseBody: JSON.stringify(newEvent.responseBody, null, 2)
    };
    apiLogs.unshift(apiLog);

    // Update quote indicators
    profile.eventsUsed += 1;
    if (profile.eventsUsed > profile.eventsQuota) {
      profile.eventsUsed = profile.eventsQuota; // lock at cap
    }
  }

  // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // User Profile Endpoints
  app.get("/api/profile", (req, res) => {
    res.json(profile);
  });

  app.post("/api/guide/dismiss", (req, res) => {
    profile.guideDismissed = true;
    res.json({ success: true });
  });

  app.post("/api/v1/auth/client/logout", (req, res) => {
    res.json({ success: true });
  });

  app.post("/api/profile", (req, res) => {
    const { name, email, notificationEmail } = req.body;
    if (name) profile.name = name;
    if (email) profile.email = email;
    if (notificationEmail) profile.notificationEmail = notificationEmail;
    res.json({ success: true, profile });
  });

  // Reset Account Quota Demo API
  app.post("/api/profile/reset-demo", (req, res) => {
    profile.eventsUsed = 12450;
    events = generateEventData();
    apiLogs = generateAPILogs(events);
    suggestions = [...initialSuggestions];
    res.json({ success: true, profile, eventsCount: events.length });
  });

  // Connection Info
  app.get("/api/connection", (req, res) => {
    res.json(connection);
  });

  // Test WP connection heartbeat
  app.post("/api/connection/test", (req, res) => {
    connection.lastHeartbeat = new Date().toISOString();
    connection.status = 'Active';
    // Simulate recording a PageView event
    addTrackingEvent("PageView", "Meta CAPI", "Delivered", 200, {
      event_name: "PageView",
      event_time: Math.floor(Date.now() / 1000),
      user_data: {
        client_ip_address: "124.8.92.12",
        client_user_agent: "WordPress Heartbeat Verification Probe"
      }
    });

    res.json({ 
      success: true, 
      message: "WP Heartbeat registered successfully. Connection parameters are clean.",
      connection 
    });
  });

  // Revoke Client Token
  app.post("/api/connection/revoke", (req, res) => {
    connection.status = 'Disconnected';
    connection.token = 'capi_tkn_REVOKED_pw_' + Math.random().toString(36).substring(5);
    res.json({ success: true, connection });
  });

  // Track Rules
  app.get("/api/rules", (req, res) => {
    res.json(rules);
  });

  app.post("/api/rules", (req, res) => {
    const { rules: newRules } = req.body;
    if (Array.isArray(newRules)) {
      rules = newRules;
    }
    res.json({ success: true, rules });
  });

  // Platform credentials
  app.get("/api/credentials", (req, res) => {
    res.json(credentials);
  });

  app.post("/api/credentials", (req, res) => {
    const { platform, enabled, pixelIdOrMeasurementId, accessToken } = req.body;
    if (credentials[platform as Platform]) {
      const p = credentials[platform as Platform];
      if (typeof enabled === 'boolean') p.enabled = enabled;
      if (pixelIdOrMeasurementId !== undefined) p.pixelIdOrMeasurementId = pixelIdOrMeasurementId;
      if (accessToken !== undefined) p.accessToken = accessToken;
      
      // Simulative credentials validation logic
      if (!p.pixelIdOrMeasurementId || !p.accessToken) {
        p.status = 'Untested';
      } else if (p.pixelIdOrMeasurementId.length < 5 || p.accessToken.length < 8) {
        p.status = 'Invalid';
      } else {
        p.status = 'Valid';
      }
    }
    res.json({ success: true, credentials });
  });

  // Custom event automation settings used by the local sandbox.
  app.get("/api/custom-event-automations", (_req, res) => {
    res.json({ automations: customEventAutomations });
  });

  app.post("/api/custom-event-automations", (req, res) => {
    const nextAutomations = req.body?.automations;
    if (!Array.isArray(nextAutomations)) {
      return res.status(400).json({ detail: "Automations must be an array." });
    }
    customEventAutomations = nextAutomations.filter((item): item is Record<string, unknown> => (
      item !== null && typeof item === 'object' && !Array.isArray(item)
    ));
    res.json({ success: true, automations: customEventAutomations, rules });
  });

  // Fetch Event Logs
  app.get("/api/events", (req, res) => {
    const { search, status, platform, eventName, limit = "20", offset = "0" } = req.query;
    
    let filtered = [...events];

    // Status multi-select filtering
    if (status) {
      const statusList = (status as string).split(',');
      filtered = filtered.filter(e => statusList.includes(e.status));
    }

    // Platform multi-select filtering
    if (platform) {
      const platformList = (platform as string).split(',');
      filtered = filtered.filter(e => platformList.includes(e.platform));
    }

    // Event name filtering
    if (eventName) {
      const eventList = (eventName as string).split(',');
      filtered = filtered.filter(e => eventList.includes(e.name));
    }

    // Keyword search (name, id, dedupe key, response payloads)
    if (search) {
      const term = (search as string).toLowerCase().trim();
      filtered = filtered.filter(e => 
        e.name.toLowerCase().includes(term) ||
        e.id.toLowerCase().includes(term) ||
        e.deduplicationKey.toLowerCase().includes(term) ||
        JSON.stringify(e.payload).toLowerCase().includes(term)
      );
    }

    const totalCount = filtered.length;
    const paginated = filtered.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    res.json({
      events: paginated,
      totalCount
    });
  });

  /**
   * CP-13: this used to fabricate its buckets. Events were assigned to a day with
   * `eventIndex % days === index % days`, which has nothing to do with when the event
   * happened, and the totals were then floored with `Math.max(dayEvents.length, 4 + index)`
   * so the chart always sloped upward regardless of the data.
   *
   * Buckets are now derived from the real `event.timestamp`. Empty days report zero.
   */
  app.get("/api/events/trend", (req, res) => {
    const days = Math.max(1, Math.min(30, Number(req.query.days || 7)));
    const buckets = new Map<string, { total: number; success: number; failed: number; value: number }>();

    const today = new Date();
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - offset);
      buckets.set(day.toISOString().slice(0, 10), { total: 0, success: 0, failed: 0, value: 0 });
    }

    for (const event of events) {
      const bucket = buckets.get(String(event.timestamp || "").slice(0, 10));
      if (!bucket) continue;
      bucket.total += 1;
      if (event.status === "Delivered") bucket.success += 1;
      if (event.status === "Failed") bucket.failed += 1;
      const value = Number((event.payload as any)?.custom_data?.value || 0);
      if (Number.isFinite(value)) bucket.value += value;
    }

    const trend = Array.from(buckets, ([date, bucket]) => ({
      date,
      total: bucket.total,
      success: bucket.success,
      failed: bucket.failed,
      value: Math.round(bucket.value * 100) / 100,
    }));

    res.json({ trend });
  });

  app.get("/api/events/recovery-summary", (req, res) => {
    const browserEvents = events.filter(event => event.payload?.action_source === "website").length;
    const serverEvents = events.length;
    const matchedEvents = Math.min(browserEvents, serverEvents);
    const recoveredEvents = Math.max(0, serverEvents - browserEvents);
    const payload: RecoverySummary = {
      browser_events: browserEvents,
      server_events: serverEvents,
      matched_events: matchedEvents,
      recovered_events: recoveredEvents,
      recovery_rate: serverEvents ? Math.round((recoveredEvents / serverEvents) * 1000) / 10 : 0,
    };
    res.json(payload);
  });

  /**
   * The dashboard's "Your last 7 days" card. Production serves this from
   * `app/routers/client_api.py` (`GET /api/reports/weekly`); the mock had no such
   * route, so every local dashboard load hit the /api 404 fallback below and the
   * card silently deleted itself — which is also how the dashboard's biggest
   * layout jump was discovered.
   *
   * The numbers are derived from the same in-memory `events` and
   * `incompleteCheckouts` the rest of the mock serves, and the field names and
   * types match the production response exactly, so the card is exercised here
   * the way a merchant sees it rather than against invented data.
   */
  app.get("/api/reports/weekly", (_req, res) => {
    const now = Date.now();
    const week = 7 * 24 * 3600 * 1000;

    const periodMetrics = (start: number, end: number) => {
      const inWindow = (iso: string) => {
        const at = Date.parse(iso);
        return Number.isFinite(at) && at >= start && at < end;
      };
      const purchases = events.filter(
        event => event.name === "Purchase" && event.status === "Delivered" && inWindow(String(event.timestamp || "")),
      );
      const revenue = purchases.reduce(
        (total, event) => total + (Number((event.payload as any)?.custom_data?.value) || 0),
        0,
      );
      const attempts = events.filter(
        event => (event.status === "Delivered" || event.status === "Failed") && inWindow(String(event.timestamp || "")),
      );
      const delivered = attempts.filter(event => event.status === "Delivered").length;
      const recovered = incompleteCheckouts.filter(
        item => item.status === "recovered" && inWindow(String(item.convertedAt || item.updated_at || "")),
      ).length;
      // Production reads a real `EventLog.utm_source` column. The mock's provider
      // payloads carry no UTM data at all (`generateEventData` builds
      // `custom_data` with value/currency/contents only), so the production read
      // path is kept first and the mock's own attribution — `marketing.source` on
      // the held orders, which production fills from the same UTM keys — stands in
      // for it. Without this the card's last line was permanently stuck on "No
      // attributed purchases" locally, so a regression in it could never be seen
      // before production.
      const sources = new Map<string, number>();
      for (const event of purchases) {
        const source = String((event.payload as any)?.custom_data?.utm_source || "").trim();
        if (source) sources.set(source, (sources.get(source) || 0) + 1);
      }
      if (sources.size === 0) {
        for (const order of pendingOrders) {
          if (!inWindow(String(order.timestamp || ""))) continue;
          const source = String(order.marketing?.source || "").trim();
          if (source) sources.set(source, (sources.get(source) || 0) + 1);
        }
      }
      const top = [...sources.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        purchases: purchases.length,
        revenue: Math.round(revenue * 100) / 100,
        currency: "BDT",
        recoveredCheckouts: recovered,
        deliveryAttempts: attempts.length,
        deliveredEvents: delivered,
        deliveryRate: attempts.length ? Math.round((delivered / attempts.length) * 1000) / 10 : null,
        topSource: top ? top[0] : null,
        topSourcePurchases: top ? top[1] : 0,
      };
    };

    const current = periodMetrics(now - week, now);
    const previous = periodMetrics(now - 2 * week, now - week);
    const percentChange = (currentValue: number, previousValue: number) => {
      if (!previousValue) return currentValue ? 100 : null;
      return Math.round(((currentValue - previousValue) / previousValue) * 1000) / 10;
    };

    res.json({
      period: {
        start: new Date(now - week).toISOString(),
        end: new Date(now).toISOString(),
        label: "Last 7 days",
      },
      current,
      previous,
      changes: {
        purchases: percentChange(current.purchases, previous.purchases),
        revenue: percentChange(current.revenue, previous.revenue),
        recoveredCheckouts: percentChange(current.recoveredCheckouts, previous.recoveredCheckouts),
        deliveryRate:
          current.deliveryRate !== null && previous.deliveryRate !== null
            ? Math.round((current.deliveryRate - previous.deliveryRate) * 10) / 10
            : null,
      },
    });
  });

  /**
   * Only reached when a mutation comes back complaining about CSRF: the portal's
   * fetch wrapper calls this to have the cookie reissued. The mock issues no CSRF
   * cookie at all, so there is nothing to refresh — but answering 404 made the
   * retry look like a broken session. Shape matches `client_auth.client_me`.
   */
  app.get("/api/v1/auth/client/me", (_req, res) => {
    const store = stores.find(item => item.id === currentStoreId) || stores[0];
    res.json({
      status: "success",
      user: {
        id: 1,
        email: profile.email,
        phone_number: null,
        full_name: profile.name,
        role: "owner",
        email_verified: true,
        client: {
          id: store.id,
          name: store.name,
          domain: store.domain,
          is_active: true,
          plan: { name: profile.plan },
        },
      },
    });
  });

  // Outbound API Logs
  app.get("/api/api-logs", (req, res) => {
    const { platform, search, limit = "20", offset = "0" } = req.query;
    let filtered = [...apiLogs];

    if (platform) {
      filtered = filtered.filter(l => l.platform === platform);
    }

    if (search) {
      const term = (search as string).toLowerCase().trim();
      filtered = filtered.filter(l => 
        l.endpoint.toLowerCase().includes(term) ||
        l.statusCode.toString().includes(term) ||
        l.requestBody.toLowerCase().includes(term) ||
        l.responseBody.toLowerCase().includes(term)
      );
    }

    const totalCount = filtered.length;
    const paginated = filtered.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string));

    // The live endpoint pairs a failed delivery with the outbox row that still owes it, so the portal
    // can offer a manual retry on that row. The demo generator produces no outbox link at all, so the
    // Retry control could never be exercised locally. Pair failed rows with the demo outbox rows.
    const owners = outboxItems.filter(item => item.status === "dead" || item.status === "queued");
    let ownerCursor = 0;
    const linked = owners.length === 0 ? paginated : paginated.map(log => {
      if (log.statusCode < 400) return log;
      const owner = owners[ownerCursor % owners.length];
      ownerCursor += 1;
      return {
        ...log,
        outboxId: owner.id,
        retryable: owner.status !== "processing",
        outboxStatus: owner.status,
        outboxAttempts: owner.attempts,
        nextRetryAt: owner.nextAttemptAt,
      };
    });

    res.json({
      logs: linked,
      totalCount
    });
  });

  // Seven-day delivery health, mirroring GET /delivery/health on the live API:
  // short platform names, a successRate of null before the first attempt, and the
  // same four states the portal's health cards switch on.
  app.get("/api/delivery/health", (_req, res) => {
    const shortNames: Record<string, string> = {
      "Meta CAPI": "Meta",
      "TikTok Events API": "TikTok",
      "TikTok Browser Pixel": "TikTok",
      "GA4": "GA4",
      "Webhook": "Webhook",
    };
    const stats: Record<string, { platform: string; successful: number; failed: number; queued: number; dead: number }> = {
      Meta: { platform: "Meta", successful: 0, failed: 0, queued: 0, dead: 0 },
      TikTok: { platform: "TikTok", successful: 0, failed: 0, queued: 0, dead: 0 },
      GA4: { platform: "GA4", successful: 0, failed: 0, queued: 0, dead: 0 },
      Webhook: { platform: "Webhook", successful: 0, failed: 0, queued: 0, dead: 0 },
    };

    apiLogs.forEach(log => {
      const name = shortNames[log.platform];
      if (!name || !stats[name]) return;
      if (log.statusCode >= 400) stats[name].failed += 1;
      else stats[name].successful += 1;
    });

    outboxItems.forEach(item => {
      const message = item.lastError || "";
      const name = message.includes("TikTok") ? "TikTok" : message.includes("GA4") ? "GA4" : message.includes("Webhook") ? "Webhook" : "Meta";
      if (item.status === "dead") stats[name].dead += 1;
      else if (item.status === "queued" || item.status === "processing") stats[name].queued += 1;
    });

    const configuredFor: Record<string, boolean> = {
      Meta: Boolean(credentials["Meta CAPI"]?.enabled),
      TikTok: Boolean(credentials["TikTok Events API"]?.enabled),
      GA4: Boolean(credentials["GA4"]?.enabled),
      Webhook: false,
    };

    const platforms = Object.values(stats).map(row => {
      const attempts = row.successful + row.failed;
      return {
        ...row,
        configured: configuredFor[row.platform] ?? false,
        successRate: attempts ? Math.round((row.successful / attempts) * 1000) / 10 : null,
        state: row.dead || row.failed ? "action_required" : row.queued ? "retrying" : attempts ? "healthy" : "no_data",
      };
    });

    res.json({ windowDays: 7, platforms });
  });

  app.get("/api/outbox", (req, res) => {
    const { limit = "25" } = req.query;
    res.json({
      items: outboxItems.slice(0, parseInt(limit as string)),
      totalCount: outboxItems.length
    });
  });

  app.post("/api/outbox/:id/retry", (req, res) => {
    const id = Number(req.params.id);
    const item = outboxItems.find(row => row.id === id);
    if (!item) {
      return res.status(404).json({ detail: "Outbox row not found." });
    }
    if (item.status === "processing") {
      return res.status(409).json({ detail: "This event is already being processed." });
    }
    item.status = "queued";
    item.nextAttemptAt = new Date().toISOString();
    item.lastError = "";
    if (item.attempts >= item.maxAttempts) {
      item.maxAttempts = item.attempts + 1;
    }
    res.json({ success: true, item });
  });

  // Simulated live logs feed for toggle polling OR SSE proxy
  app.get("/api/events/live-stream", (req, res) => {
    // Generate a single randomized event and insert it immediately
    const names = ['PageView', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Lead'];
    const platforms: Platform[] = ['Meta CAPI', 'TikTok Events API', 'GA4'];
    const activePlatforms = platforms.filter(p => credentials[p]?.enabled);
    
    if (activePlatforms.length === 0) {
      return res.json({ event: null });
    }

    const platform = activePlatforms[Math.floor(Math.random() * activePlatforms.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const isError = Math.random() < 0.08; // 8% error rate
    const status = isError ? "Failed" : "Delivered";
    const httpCode = isError ? 400 : 200;

    const value = (50 + Math.random() * 250).toFixed(2);
    const payload = {
      event_name: name,
      event_time: Math.floor(Date.now() / 1000),
      user_data: {
        client_ip_address: `158.110.42.${Math.floor(Math.random() * 200) + 1}`,
        client_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      custom_data: name === 'Purchase' ? { value, currency: 'USD' } : undefined
    };

    addTrackingEvent(name, platform, status, httpCode, payload);
    res.json({ event: events[0] });
  });

  // Campaign builder runner (Dispatches test events)
  app.post("/api/campaign-test", (req, res) => {
    const { platform, eventName, value, currency, email, phone, ip, userAgent, customParams } = req.body;

    if (!platform || !eventName) {
      return res.status(400).json({ error: "Platform and Event Name are required fields." });
    }

    // CP-02: an unrecognised platform used to fall through to `targetConfig.enabled`
    // on an undefined value, which threw and surfaced as an opaque 500.
    const targetConfig = credentials[platform as Platform];
    if (!targetConfig) {
      return res.status(400).json({
        error: `Unknown platform '${String(platform)}'.`,
        supportedPlatforms: Object.keys(credentials),
      });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const ipAddr = ip || "192.168.1.134";
    const ua = userAgent || "CAPI Campaign Sandbox Agent v1.0";

    const payload: any = {
      event_name: eventName,
      event_time: timestamp,
      user_data: {
        client_ip_address: ipAddr,
        client_user_agent: ua,
        em: email ? [email] : undefined,
        ph: phone ? [phone] : undefined,
      },
      custom_data: (value || currency) ? {
        value: value,
        currency: currency || "USD",
        ...customParams
      } : customParams
    };

    const isPluginActive = connection.status === 'Active';

    let code = 200;
    let status: 'Delivered' | 'Failed' = 'Delivered';
    let responseBody: any = {};

    if (!isPluginActive) {
      code = 503;
      status = 'Failed';
      responseBody = { error: "WordPress Plugin disconnected. Tracking server rejected payload relay request." };
    } else if (!targetConfig.enabled) {
      code = 403;
      status = 'Failed';
      responseBody = { error: `Relay failed: Routing pipeline for '${platform}' is disabled in settings.` };
    } else if (targetConfig.status === 'Invalid' || !targetConfig.accessToken) {
      code = 401;
      status = 'Failed';
      responseBody = { error: `Authentication Failed: Access Token or pixel credentials verified as invalid for '${platform}' router.` };
    } else {
      responseBody = {
        success: true,
        message: "Payload relay accepted.",
        tracking_gateway: "CAPI Router Node Austin",
        recipient_id: targetConfig.pixelIdOrMeasurementId,
        transmission_mode: "async_queue",
        transmission_details: {
          job_id: `job_${Math.random().toString(36).substring(4)}`,
          queue_at: new Date().toISOString()
        }
      };
    }

    addTrackingEvent(eventName, platform as Platform, status, code, payload, responseBody);

    res.json({
      success: status === 'Delivered',
      statusCode: code,
      response: responseBody,
      dispatchedEvent: events[0]
    });
  });

  // Suggestions API: fetch active optimization cards
  app.get("/api/suggestions", (req, res) => {
    res.json(suggestions);
  });

  app.post("/api/suggestions/toggle-resolve", (req, res) => {
    const { id } = req.body;
    suggestions = suggestions.map(s => {
      if (s.id === id) {
        return { ...s, resolved: !s.resolved };
      }
      return s;
    });
    res.json({ success: true, suggestions });
  });

  app.post("/api/suggestions/dismiss", (req, res) => {
    const { id } = req.body;
    suggestions = suggestions.filter(s => s.id !== id);
    res.json({ success: true, suggestions });
  });

  // System Diagnostics scan endpoint
  app.post("/api/suggestions/ai-review", (req, res) => {
    const emulatedAI: Suggestion[] = [
      {
        id: `ai_gen_${Date.now()}_01`,
        title: "Verify Meta CAPI 'test_event_code' telemetry trace filter",
        severity: "Tip",
        explanation: "You have verified active production endpoints, but Meta sandbox logs show no recent debugging matches. Adding a transient 'test_event_code' to payload headers redirects stream debugging output directly inside the Event Manager Sandbox tab in real-time.",
        fixAction: "Pencil in your FB Events Manager test trace code (e.g., 'TEST82931') into Settings > Platform Credentials panel and trigger a test capture cycle.",
        resolved: false,
        platform: "Meta CAPI"
      },
      {
        id: `ai_gen_${Date.now()}_02`,
        title: "Missing WooCommerce cart basket data matches on TikTok API",
        severity: "Warning",
        explanation: "AddToCart events transiting to TikTok contain content IDs, but lack product categories ('content_category') or product descriptions. TikTok Ads Manager operates core audience matching and dynamic catalog re-targeting by matching catalog indexes directly.",
        fixAction: "1. Open WooCommerce > CAPI Plugin.\n2. Enable the option 'Synchronize Catalog Category taxonomy map with TikTok category hierarchies'.\n3. Save config.",
        resolved: false,
        platform: "TikTok Events API"
      }
    ];

    suggestions = [ ...emulatedAI, ...suggestions ];
    res.json({ 
      success: true, 
      message: "Diagnostics scan completed successfully.", 
      suggestions 
    });
  });

  // Setup readiness — mirrors GET /setup/readiness in app/routers/client_api.py.
  // Every flag is derived from this mock's own state (never hardcoded true) so the
  // Setup guide preview shows the same mixture of ready / not-ready the real one does.
  app.get("/api/setup/readiness", (req, res) => {
    const now = Date.now();
    const currentStore = stores.find(store => store.is_current) || stores[0];
    const domainReady = Boolean(currentStore?.domain);

    const heartbeat = connection.lastHeartbeat ? new Date(connection.lastHeartbeat) : null;
    const heartbeatValid = heartbeat !== null && !Number.isNaN(heartbeat.getTime());
    const pluginReady = heartbeatValid && heartbeat.getTime() >= now - 24 * 3600000;

    const destinationNames = (['Meta CAPI', 'TikTok Events API', 'GA4'] as Platform[])
      .filter(platform => {
        const config = credentials[platform];
        return Boolean(config?.enabled && config.pixelIdOrMeasurementId && config.accessToken);
      })
      .map(platform => (platform === 'Meta CAPI' ? 'Meta' : platform === 'TikTok Events API' ? 'TikTok' : 'GA4'));

    const successfulDeliveries = events.filter(event =>
      event.status === 'Delivered' && new Date(event.timestamp).getTime() >= now - 7 * 24 * 3600000,
    ).length;

    const courierReady = Boolean(
      (courierSettings.steadfast_api_key && courierSettings.steadfast_secret_key)
      || (courierSettings.pathao_api_key && courierSettings.pathao_secret_key && courierSettings.pathao_store_id)
      || (courierSettings.redx_access_token && courierSettings.redx_pickup_store_id),
    );

    const steps = [
      { key: "domain", label: "Store domain", ready: domainReady, required: true, actionPage: "settings", actionLabel: "Add domain", detail: currentStore?.domain || "No domain saved" },
      { key: "plugin", label: "Plugin heartbeat", ready: pluginReady, required: true, actionPage: "setup-guide", actionLabel: "Connect plugin", detail: heartbeatValid ? heartbeat.toISOString() : "No recent heartbeat" },
      { key: "destination", label: "Tracking destination", ready: destinationNames.length > 0, required: true, actionPage: "settings", actionLabel: "Add credentials", detail: destinationNames.join(", ") || "No destination ready" },
      { key: "delivery", label: "Successful test delivery", ready: successfulDeliveries > 0, required: true, actionPage: "campaign-builder", actionLabel: "Send test event", detail: `${successfulDeliveries} successful in 7 days` },
      { key: "courier", label: "Courier credentials", ready: courierReady, required: false, actionPage: "settings", actionLabel: "Configure courier", detail: "Optional until manual courier booking is needed" },
    ];

    const requiredSteps = steps.filter(step => step.required);
    const completedRequired = requiredSteps.filter(step => step.ready).length;
    res.json({
      ready: completedRequired === requiredSteps.length,
      score: Math.round((completedRequired / requiredSteps.length) * 100),
      completedRequired,
      requiredCount: requiredSteps.length,
      steps,
    });
  });

  // COD Protection (Deferred Purchase Tracking) Mock Endpoints
  app.get("/api/deferred", (req, res) => {
    /**
     * The two lists are built from two different rules, and the difference is
     * the whole point.
     *
     * `pendingList` / `deferredPendingList` are PendingEvent rows still at
     * `status="pending"`. Booking moves that status on — `enqueue_courier_booking`
     * sets `courier_booking_queued` and the worker sets `courier_booked` on
     * success (app/services/courier/courier_booking_service.py) — so a booked
     * order leaves these lists. The one exception is a booking the courier
     * rejected: on terminal failure the worker sets the consignment to
     * `booking_failed` and resets its PendingEvent back to `status="pending"`, so
     * that row stays.
     *
     * `operationsPendingList` is narrower still: production builds it with
     * `PendingEvent.order_id.not_in(booked_order_ids_subq)`, and that subquery
     * selects *every* CourierOrder of the client with no status filter
     * (app/routers/client_api.py) — so a rejected booking is dropped from it too.
     *
     * That is the one state where the two feeds disagree, and the only way to
     * reach a retry: src/services/operationsApi.ts folds those rows back in. The
     * mock used to copy the pending list into both, which showed a state
     * production never produces and left the retry path unreachable locally.
     */
    const consignmentByOrderId = new Map(courierOrders.map((order) => [String(order.order_id), order]));
    const stillPending = pendingOrders.filter((order) => {
      const courier = consignmentByOrderId.get(String(order.orderId));
      return !courier || String(courier.courier_status).toLowerCase() === "booking_failed";
    });
    const operationsPendingList = pendingOrders
      .filter((order) => !consignmentByOrderId.has(String(order.orderId)))
      .map(order => ({
        ...order,
        operationsOnly: false,
      }));
    const pendingValue = stillPending.reduce((acc, o) => acc + o.amount, 0);
    const oldestPending = stillPending.length > 0 ? `${Math.max(...stillPending.map(o => o.ageHours))}h` : "—";
    res.json({
      deferredEnabled,
      autoConfirmDays,
      autoConfirmStatus,
      pendingCount: stillPending.length,
      deferredPendingCount: stillPending.length,
      operationsPendingCount: operationsPendingList.length,
      pendingValue: `৳${pendingValue.toLocaleString()}`,
      confirmedTotal,
      cancelledTotal,
      expiredTotal: 0,
      confirmedToday,
      oldestPending,
      pendingList: stillPending,
      deferredPendingList: stillPending,
      operationsPendingList
    });
  });

  app.patch("/api/deferred/orders/:id", (req, res) => {
    const target = pendingOrders.find((order) => order.id === Number(req.params.id));
    if (!target) return res.status(404).json({ detail: "Order not found." });
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!String(body.customer_name || '').trim() || !String(body.phone || '').trim() || !String(body.address || '').trim() || items.length === 0) {
      return res.status(422).json({ detail: "Customer, delivery and product details are required." });
    }
    const deliveryCharge = Math.max(0, Number(body.delivery_charge) || 0);
    const discount = Math.max(0, Number(body.discount) || 0);
    const products = items.map((item: any) => ({
      id: String(item.content_id || item.id || `item-${Date.now()}`),
      name: String(item.name || '').trim(),
      quantity: Math.max(1, Number(item.quantity) || 1),
      price: Math.max(0, Number(item.price) || 0),
      attributes: item.attributes || {},
      category: item.category || '',
    }));
    const productSubtotal = products.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    const codAmount = Math.max(0, Number(body.cod_amount) || 0);
    target.recipientName = String(body.customer_name).trim();
    target.recipientPhone = String(body.phone).trim();
    target.recipientAddress = String(body.address).trim();
    target.customer = target.recipientPhone;
    target.products = products;
    target.productSubtotal = productSubtotal;
    target.deliveryCharge = deliveryCharge;
    target.discount = discount;
    target.orderTotal = codAmount;
    target.amount = codAmount;
    target.note = String(body.note || '').trim();
    res.json({ success: true, message: "Order updated.", order: target });
  });

  /**
   * On-demand courier history check. Mirrors
   * `POST /deferred/orders/{pending_event_id}/courier-check` in
   * app/routers/client_api.py: it writes the verdict onto the held row and
   * returns it, so the answer survives a refetch and shows on both order pages
   * from a single click.
   *
   * The verdict here is derived from the mock order's own starting score — the
   * local dev server has no courier accounts to call.
   */
  app.post("/api/deferred/orders/:id/courier-check", (req, res) => {
    const target = pendingOrders.find((order) => order.id === Number(req.params.id));
    if (!target) return res.status(404).json({ detail: "Order not found." });
    const risky = target.fraudScore >= 50;
    const total = risky ? 9 : 14;
    const cancelled = risky ? 6 : 1;
    const delivered = total - cancelled;
    // The real aggregator sends a 0-100 percentage rounded to one decimal
    // (`round(self.success_ratio, 1)` in app/services/courier/aggregator.py), and
    // the panel prints whatever arrives verbatim. Sending the raw 0-1 ratio here
    // made the local preview read "0.9285714285714286% success" — a mock bug that
    // looks exactly like a portal bug.
    const successRatio = Math.round((delivered / total) * 1000) / 10;
    target.fraudDetails = {
      ...target.fraudDetails,
      courier_verdict: risky ? "HIGH_RISK" : "GOOD",
      courier_confidence: "high",
      courier_summary: {
        verdict: risky ? "HIGH_RISK" : "GOOD",
        trust_score: risky ? 34 : 92,
        fraud_points: risky ? 66 : 8,
        confidence: "high",
        total_orders: total,
        total_delivered: delivered,
        total_cancelled: cancelled,
        success_ratio: successRatio,
        providers: [
          {
            provider: "pathao",
            status: "ok",
            tier: risky ? "high_risk" : "good",
            total,
            delivered,
            cancelled,
            success_ratio: successRatio,
            rating: risky ? "fraud_customer" : "good_customer",
            segment: null,
          },
          {
            provider: "steadfast",
            status: "ok",
            tier: null,
            total: 0,
            delivered: 0,
            cancelled: 0,
            success_ratio: null,
            rating: null,
            segment: null,
          },
        ],
        checked: ["pathao", "steadfast"],
        failed: [],
      },
    };
    target.fraudScore = risky ? Math.max(target.fraudScore, 78) : target.fraudScore;
    res.json({ fraudScore: target.fraudScore, fraudDetails: target.fraudDetails });
  });

  // WhatsApp order confirmations. Mirrors app/routers/whatsapp_api.py.
  app.get("/api/client/whatsapp", (_req, res) => {
    res.json({
      available: true,
      hasPlanAccess: true,
      connected: true,
      session: {
        status: "connected",
        phoneNumber: "+8801700000000",
        deviceLabel: "Demo store phone",
        connectedAt: new Date(Date.now() - 36 * 3600000).toISOString(),
        disconnectedAt: null,
        lastSeenAt: new Date().toISOString(),
        lastError: null,
        consentAcceptedAt: new Date(Date.now() - 36 * 3600000).toISOString(),
        dailySentCount: Object.keys(whatsappConfirmations).length,
        dailyLimit: 200,
      },
      autoSend: whatsappAutoSend,
      autoSendQuietHours: whatsappQuietHours,
      qr: null,
      gatewayError: null,
    });
  });

  app.post("/api/client/whatsapp/settings", (req, res) => {
    whatsappAutoSend = Boolean((req.body || {}).autoSend);
    res.json({ success: true, autoSend: whatsappAutoSend });
  });

  app.post("/api/client/whatsapp/connect", (_req, res) => {
    res.json({ success: true, status: "connected", qr: null, phoneNumber: "+8801700000000" });
  });

  app.delete("/api/client/whatsapp", (_req, res) => {
    res.json({ success: true, disconnected: true, gatewayError: null });
  });

  app.get("/api/client/whatsapp/confirmations", (req, res) => {
    const ids = String(req.query.orderIds || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 100);
    const confirmations: Record<string, unknown> = {};
    ids.forEach((id) => {
      if (whatsappConfirmations[id]) confirmations[id] = whatsappConfirmations[id];
    });
    res.json({ available: true, confirmations });
  });

  app.post("/api/client/whatsapp/confirmations", (req, res) => {
    const orderId = String((req.body || {}).orderId || "").trim();
    if (!orderId) return res.status(422).json({ detail: "An order id is required." });
    // The real router only messages a customer whose order is still held; a
    // booked or closed order has nothing left to confirm.
    const order = pendingOrders.find((row) => row.orderId === orderId);
    if (!order) return res.status(404).json({ detail: "This order is no longer waiting for confirmation." });
    const existing = whatsappConfirmations[orderId];
    if (existing && existing.status === "sent") {
      return res.status(409).json({ detail: "This customer has already been asked and has not replied yet." });
    }
    const phone = order.recipientPhone || order.phone || null;
    whatsappConfirmationSeq += 1;
    whatsappConfirmations[orderId] = {
      id: whatsappConfirmationSeq,
      orderId,
      status: phone ? "sent" : "no_whatsapp",
      phone,
      sentAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
      respondedAt: null,
      responseText: null,
      appliedStatus: null,
      applyError: null,
      errorMessage: phone ? null : "This order has no phone number to message.",
    };
    res.json({ confirmation: whatsappConfirmations[orderId] });
  });

  // Keep the local mock aligned with the universal order-intake API used by
  // the portal. The production backend persists these rows in StoreOrder.
  app.get("/api/v1/orders", (req, res) => {
    const orders = pendingOrders.map((order) => {
      const itemCount = (order.products || []).reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
      const complete = Boolean(order.recipientName && order.recipientPhone && order.recipientAddress && itemCount > 0);
      return {
        id: order.id,
        orderId: order.orderId,
        source: "woocommerce",
        createdVia: "checkout",
        trigger: "order.created",
        status: "pending",
        paymentMethod: "cod",
        currency: "BDT",
        total: Number(order.orderTotal ?? order.amount ?? 0),
        itemCount,
        dataQuality: complete ? "complete" : "missing_customer",
        syncStatus: "accepted",
        orderData: { customerName: order.recipientName || "", phone: order.recipientPhone || "", address: order.recipientAddress || "" },
        rawOrderData: { recipient_name: order.recipientName || "", recipient_phone: order.recipientPhone || "", recipient_address: order.recipientAddress || "" },
        occurredAt: order.timestamp,
        sourceUpdatedAt: order.timestamp,
        firstSeenAt: order.timestamp,
        lastSeenAt: order.timestamp,
        updatedAt: order.timestamp,
      };
    });
    res.json({ orders, total: orders.length, page: 1, limit: Number(req.query.limit) || 20 });
  });

  app.get("/api/v1/orders/intake-health", (_req, res) => {
    const total = pendingOrders.length;
    const complete = pendingOrders.filter((order) => Boolean(order.recipientName && order.recipientPhone && order.recipientAddress && (order.products || []).length > 0)).length;
    res.json({
      status: total === 0 ? "idle" : complete === total ? "healthy" : "warning",
      windowHours: 24,
      total,
      complete,
      incomplete: total - complete,
      byQuality: { complete, missing_customer: total - complete },
      lastOrderAt: pendingOrders[0]?.timestamp || null,
    });
  });

  // Mirrors the backend change-detection probe the Orders workspace polls.
  app.get("/api/v1/orders/watermark", (_req, res) => {
    const lastChangedAt = pendingOrders.reduce<string | null>((latest, order) => {
      if (!order.timestamp) return latest;
      return !latest || order.timestamp > latest ? order.timestamp : latest;
    }, null);
    res.json({
      count: pendingOrders.length,
      lastChangedAt,
      serverTime: new Date().toISOString(),
    });
  });

  app.get("/api/sidebar/status", (req, res) => {
    const orderSeenAt = Date.parse(sidebarSeenState.order_verification_seen_at || '1970-01-01T00:00:00.000Z');
    const deliverySeenAt = Date.parse(sidebarSeenState.orders_delivery_seen_at || '1970-01-01T00:00:00.000Z');
    /**
     * Two different counts, as in `GET /sidebar/status`
     * (app/routers/client_api.py): the verification badge counts PendingEvent
     * rows still at `status="pending"`, the delivery badge counts CourierOrder
     * rows in ACTIVE_COURIER_STATUSES. Counting `pendingOrders` for both left the
     * badge disagreeing with the list it points at as soon as one order was
     * booked.
     */
    const bookedElsewhere = new Set(
      courierOrders
        .filter((order) => String(order.courier_status).toLowerCase() !== "booking_failed")
        .map((order) => String(order.order_id)),
    );
    const verificationOrders = pendingOrders.filter((order) => !bookedElsewhere.has(String(order.orderId)));
    const activeCourierStatuses = new Set([
      "booking_queued", "booking_processing", "pending", "picked",
      "in_transit", "processing", "booked", "shipped",
    ]);
    const activeDeliveries = courierOrders.filter(
      (order) => activeCourierStatuses.has(String(order.courier_status).toLowerCase()),
    );

    res.json({
      orderVerificationTotal: verificationOrders.length,
      orderVerificationNew: verificationOrders.filter(order => Date.parse(order.timestamp) > orderSeenAt).length,
      ordersDeliveryTotal: activeDeliveries.length,
      ordersDeliveryNew: activeDeliveries.filter(order => Date.parse(order.created_at) > deliverySeenAt).length,
      seenState: {
        orderVerificationSeenAt: sidebarSeenState.order_verification_seen_at,
        ordersDeliverySeenAt: sidebarSeenState.orders_delivery_seen_at,
      },
    });
  });

  /**
   * Mirrors `GET /api/client/incomplete-checkouts`: the default list is the
   * three statuses a merchant can act on, `counts` is grouped over every status
   * in the store (so tiles can talk about carts this page never lists), and the
   * page window is reported back as totalCount/offset/limit/hasMore.
   */
  const CHECKOUT_STATUSES = ["active", "incomplete", "contacted", "recovered", "ignored", "expired"];
  const CHECKOUT_DEFAULT_STATUSES = ["incomplete", "contacted", "recovered"];

  app.get("/api/incomplete-checkouts", (req, res) => {
    const requested = typeof req.query.status === "string" ? req.query.status.trim() : "";
    if (requested && !CHECKOUT_STATUSES.includes(requested)) {
      return res.status(400).json({ detail: "Unknown checkout status." });
    }
    const wanted = requested ? [requested] : CHECKOUT_DEFAULT_STATUSES;
    const limit = Math.min(250, Math.max(1, Number(req.query.limit) || 100));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const counts = incompleteCheckouts.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    const matching = incompleteCheckouts.filter(item => wanted.includes(item.status));
    const window = matching.slice(offset, offset + limit);

    res.json({
      items: window,
      counts,
      totalCount: matching.length,
      offset,
      limit,
      hasMore: offset + window.length < matching.length,
      restricted: false,
    });
  });

  app.post("/api/incomplete-checkouts/refresh", (req, res) => {
    res.json({ success: true });
  });

  app.post("/api/incomplete-checkouts/:id/status", (req, res) => {
    const id = Number(req.params.id);
    const target = incompleteCheckouts.find(item => item.id === id);
    if (!target) {
      return res.status(404).json({ detail: "Incomplete checkout not found." });
    }
    // Production accepts exactly these four and 409s a settled row, so the
    // mock has to refuse the same writes — otherwise the portal's status
    // control looks like it works locally and fails live. `recovered` is the
    // merchant saying they closed the sale off-platform; it is terminal, which
    // is why the 409 below then locks the row.
    const next = String(req.body?.status || "");
    if (!["contacted", "ignored", "incomplete", "recovered"].includes(next)) {
      return res.status(400).json({ detail: "Status must be contacted, recovered, ignored or incomplete." });
    }
    if (["recovered", "expired"].includes(String(target.status))) {
      return res.status(409).json({ detail: "This checkout is already settled." });
    }
    target.status = next;
    target.updated_at = new Date().toISOString();
    if (next === "recovered" || next === "ignored") {
      target.convertedAt = new Date().toISOString();
    }
    res.json({ success: true, item: target });
  });

  app.post("/api/incomplete-checkouts/:id/create-order", (req, res) => {
    const id = Number(req.params.id);
    const target = incompleteCheckouts.find(item => item.id === id);
    if (!target) {
      return res.status(404).json({ detail: "Incomplete checkout not found." });
    }
    if (!["incomplete", "contacted"].includes(String(target.status))) {
      return res.status(400).json({ detail: "Only incomplete or contacted leads can be converted to an order." });
    }
    if (target.orderId) {
      return res.status(409).json({ detail: "An order was already created from this checkout." });
    }
    const body = req.body || {};
    const orderId = `manual-${id}-${Date.now()}`;
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const amount = Math.max(0, subtotal + Number(body.delivery_charge || 0) - Number(body.discount || 0));
    pendingOrders.unshift({
      id: Date.now(),
      orderId,
      amount,
      customer: body.phone || target.customer_phone || "",
      recipientName: body.customer_name || target.customer_name || "",
      recipientPhone: body.phone || target.customer_phone || "",
      recipientAddress: body.address || "",
      customerName: body.customer_name || target.customer_name || "",
      phone: body.phone || target.customer_phone || "",
      address: body.address || "",
      products: items.map((item: any) => ({
        name: item.name,
        quantity: item.quantity || 1,
        price: item.price || 0,
        attributes: item.attributes || {},
        category: item.category || "",
      })),
      productSubtotal: subtotal,
      deliveryCharge: Number(body.delivery_charge || 0),
      discount: Number(body.discount || 0),
      orderTotal: amount,
      note: String(body.note || ''),
      fraudScore: 0,
      fraudDetails: {},
      ageHours: 0,
      timestamp: new Date().toISOString(),
    });
    target.status = "recovered";
    target.orderId = orderId;
    target.updated_at = new Date().toISOString();
    res.json({ success: true, orderId, checkoutId: id });
  });

  app.get("/api/courier/settings", (req, res) => {
    res.json(courierSettings);
  });

  app.post("/api/courier/settings", (req, res) => {
    courierSettings = {
      ...courierSettings,
      ...req.body,
    };
    res.json(courierSettings);
  });

  app.get("/api/courier/orders", (req, res) => {
    res.json({ orders: courierOrders, totalCount: courierOrders.length });
  });

  app.post("/api/courier/send", (req, res) => {
    const pendingEventId = Number(req.body?.pending_event_id);
    const pendingTarget = pendingOrders.find((pending) => (
      (Number.isFinite(pendingEventId) && pending.id === pendingEventId) ||
      (req.body?.order_id && pending.orderId === String(req.body.order_id))
    ));
    const orderId = pendingTarget?.orderId || String(req.body?.order_id || `WC-${Math.floor(Math.random() * 9000) + 1000}`);
    const existing = courierOrders.find((item) => item.order_id === orderId);
    const order = {
      id: existing?.id ?? Date.now(),
      order_id: orderId,
      courier_provider: String(req.body?.courier_provider || req.body?.provider || courierSettings.default_courier || "steadfast"),
      courier_order_id: `MOCK-${orderId}`,
      courier_tracking_id: `TRK${Math.floor(Math.random() * 900000)}`,
      courier_status: "pending",
      recipient_name: String(req.body?.recipient_name || "Demo Customer"),
      recipient_phone: String(req.body?.recipient_phone || "+8801700000000"),
      recipient_address: String(req.body?.recipient_address || "Dhaka, Bangladesh"),
      cod_amount: Number(req.body?.cod_amount || 0),
      delivery_charge: 80,
      created_at: new Date().toISOString(),
      purchase_event_sent: false,
      refund_event_sent: false,
      pending_event_id: pendingTarget?.id,
      // Same reason as the seeded rows: production rebuilds this from the stored
      // order payload, so the parcel keeps its contents once the verification
      // record is gone.
      products: pendingTarget?.products ?? existing?.products,
      // Booking must not lose the source: production reads it from the same held
      // Purchase payload for both /deferred and /courier/orders.
      marketing: pendingTarget?.marketing ?? null,
    };
    // Booking is the handoff point: the order leaves the pre-courier queue.
    if (pendingTarget) {
      pendingOrders = pendingOrders.filter((pending) => pending.id !== pendingTarget.id);
    }
    courierOrders = [order, ...courierOrders.filter((item) => item.id !== order.id)];
    res.json({
      success: true,
      order,
      courier_order_id: order.courier_order_id,
      tracking_id: order.courier_tracking_id,
    });
  });

  // Local-only status hook used by sandbox E2E checks. Production delivery
  // updates arrive through the provider webhook routes instead.
  app.post("/api/courier/mock-status/:id", (req, res) => {
    const id = Number(req.params.id);
    const order = courierOrders.find((item) => item.id === id);
    if (!order) return res.status(404).json({ detail: "Courier order not found." });

    const rawStatus = String(req.body?.status || "").trim().toLowerCase().replace(/\s+/g, "_");
    const statusMap: Record<string, string> = {
      completed: "delivered",
      shipped: "in_transit",
      picked_up: "in_transit",
      out_for_delivery: "in_transit",
      returned: "returned",
      canceled: "cancelled",
      cancelled: "cancelled",
      delivered: "delivered",
      in_transit: "in_transit",
      pending: "pending",
    };
    const mappedStatus = statusMap[rawStatus] || rawStatus;
    if (!mappedStatus) return res.status(400).json({ detail: "A courier status is required." });

    order.courier_status = mappedStatus;
    if (mappedStatus === "delivered") order.purchase_event_sent = true;
    if (["returned", "cancelled"].includes(mappedStatus) && order.purchase_event_sent) {
      order.refund_event_sent = true;
    }
    res.json({ success: true, order });
  });

  app.post("/api/courier/cancel/:id", (req, res) => {
    const id = Number(req.params.id);
    const order = courierOrders.find(item => item.id === id);
    if (!order) {
      return res.status(404).json({ detail: "Courier order not found." });
    }
    order.courier_status = "cancelled";
    res.json({ success: true, order });
  });

  app.post("/api/orders/:id/cancel", (req, res) => {
    const pendingEventId = Number(req.params.id);
    const target = pendingOrders.find((order) => order.id === pendingEventId);
    if (!target) return res.status(404).json({ detail: "Pending order not found." });

    pendingOrders = pendingOrders.filter((order) => order.id !== pendingEventId);
    archivedOrders.unshift({ action: "cancel", order: target });
    cancelledTotal++;
    res.json({
      success: true,
      orderId: target.orderId,
      status: "cancelled",
      message: "Order cancelled. It was removed from Purchase Event Hold.",
      wooSync: {
        status: "completed",
        commandId: Date.now(),
        message: "WooCommerce cancellation applied.",
      },
    });
  });

  app.get("/api/v1/orders/workflow-statuses", (_req, res) => {
    const statuses: Record<string, string> = {};
    pendingOrders.forEach((order) => {
      statuses[String(order.orderId)] = String(order.workflowStatus || order.status || "pending");
    });
    courierOrders.forEach((order) => {
      const courierStatus = String(order.courier_status || "pending").toLowerCase();
      statuses[String(order.order_id)] = String((order as any).workflowStatus || (
        ["delivered", "completed"].includes(courierStatus) ? "completed" :
        ["returned", "cancelled"].includes(courierStatus) ? "cancelled" :
        ["picked_up", "in_transit", "shipped"].includes(courierStatus) ? "shipped" :
        "processing"
      ));
    });
    const cancelledOrders = archivedOrders
      .filter((entry) => entry.action === "cancel")
      .map((entry) => ({ ...entry.order, status: "cancelled", workflowStatus: "cancelled" }));
    cancelledOrders.forEach((order) => {
      statuses[String(order.orderId)] = "cancelled";
    });
    res.json({ statuses, cancelledOrders });
  });

  app.patch("/api/v1/orders/:orderId/status", (req, res) => {
    const orderId = String(req.params.orderId || "");
    const status = String(req.body?.status || "").trim().toLowerCase();
    const allowed = ["pending", "on-hold", "confirmed", "processing", "shipped", "completed", "cancelled"];
    if (!allowed.includes(status)) return res.status(400).json({ detail: "Unsupported order status." });

    let pending = pendingOrders.find((order) => String(order.orderId) === orderId);
    const archivedIndex = archivedOrders.findIndex((entry) => String(entry.order.orderId) === orderId);
    const archived = archivedIndex >= 0 ? archivedOrders[archivedIndex] : null;
    if (!pending && archived?.action === "cancel") pending = archived.order;
    const courier = courierOrders.find((order) => String(order.order_id) === orderId);
    if (!pending && !courier) return res.status(404).json({ detail: "Order not found." });
    if (status === "shipped" && !courier) {
      return res.status(409).json({ detail: "Book this order with a courier before marking it shipped." });
    }
    if (status === "completed" && courier && !["delivered", "completed"].includes(String(courier.courier_status).toLowerCase())) {
      return res.status(409).json({ detail: "The courier must report Delivered before this order can be completed." });
    }
    if (status === "cancelled" && courier && !["cancelled", "returned", "booking_failed"].includes(String(courier.courier_status).toLowerCase())) {
      return res.status(409).json({ detail: "Cancel the active courier booking first so the provider and WooCommerce stay aligned." });
    }

    if (pending) {
      pending.workflowStatus = status;
      if (status === "cancelled") {
        if (archivedIndex < 0) {
          pendingOrders = pendingOrders.filter((order) => String(order.orderId) !== orderId);
          archivedOrders.unshift({ action: "cancel", order: pending });
          cancelledTotal++;
        }
      } else if (archived?.action === "cancel" && ["pending", "on-hold"].includes(status)) {
        archivedOrders.splice(archivedIndex, 1);
        pendingOrders.unshift(pending);
        cancelledTotal = Math.max(0, cancelledTotal - 1);
      }
    }
    if (courier) (courier as any).workflowStatus = status;
    res.json({
      success: true,
      orderId,
      status,
      wooSync: {
        status: "completed",
        commandId: Date.now(),
        message: "WooCommerce status updated.",
      },
    });
  });

  app.get("/api/courier/pathao/stores", (req, res) => {
    res.json({ stores: [{ store_id: 101, store_name: "Buykori Demo Pickup" }] });
  });

  app.get("/api/courier/pathao/cities", (_req, res) => {
    res.json([
      { city_id: 1, city_name: "Dhaka" },
      { city_id: 2, city_name: "Chattogram" },
    ]);
  });

  app.get("/api/courier/pathao/zones", (req, res) => {
    const cityId = Number(req.query.city_id);
    res.json(cityId === 2
      ? [{ zone_id: 21, zone_name: "Chattogram Sadar" }]
      : [{ zone_id: 11, zone_name: "Dhaka North" }, { zone_id: 12, zone_name: "Dhaka South" }]);
  });

  app.get("/api/courier/pathao/areas", (req, res) => {
    const zoneId = Number(req.query.zone_id);
    res.json(zoneId === 12
      ? [{ area_id: 121, area_name: "Dhanmondi" }, { area_id: 122, area_name: "Mirpur" }]
      : [{ area_id: 111, area_name: "Uttara" }, { area_id: 112, area_name: "Banani" }]);
  });

  app.get("/api/courier/redx/areas", (req, res) => {
    res.json({ areas: [{ id: "dhaka-mirpur", name: "Mirpur, Dhaka" }, { id: "dhaka-banani", name: "Banani, Dhaka" }] });
  });

  app.post("/api/courier/:provider/webhook-secret", (req, res) => {
    const provider = String(req.params.provider).toLowerCase() as keyof typeof courierWebhookSecrets;
    if (!Object.prototype.hasOwnProperty.call(courierWebhookSecrets, provider)) {
      res.status(400).json({ detail: 'Unsupported courier webhook provider.' });
      return;
    }
    const key = provider === 'steadfast'
      ? 'steadfast_webhook_token_configured'
      : `${provider}_webhook_secret_configured`;
    const secret = courierWebhookSecrets[provider];
    const callbackUrl = `https://api.buykori.app/api/v1/webhook/${provider}`;
    courierSettings[key] = true;
    res.json({
      success: true,
      configured: true,
      secret,
      callback_url: provider === 'redx' ? `${callbackUrl}?token=${encodeURIComponent(secret)}` : callbackUrl,
      verified_at: courierSettings[`${provider}_webhook_verified_at`] || null,
      [key]: true,
    });
  });

  app.get("/api/v1/plugin/info", (req, res) => {
    res.json({
      version: "1.0.0",
      download_url: "https://github.com/hridoyhossain1001/buykori-client-portal/releases/latest",
      package_sha256: "local-dev-mock",
      package_size: 0,
      package_available: true,
      requires: "6.0",
      tested: "6.5",
      requires_php: "8.0",
      last_updated: new Date().toISOString(),
    });
  });

  app.get("/api/stores", (req, res) => {
    res.json({
      stores: stores.map(store => ({
        ...store,
        is_current: store.id === currentStoreId,
      })),
    });
  });

  app.patch("/api/store/domain", (req, res) => {
    const current = stores.find(store => store.id === currentStoreId);
    if (!current) {
      return res.status(404).json({ detail: "Current store not found." });
    }
    current.domain = req.body?.domain || "";
    res.json({ success: true, domain: current.domain, store: current });
  });

  app.post("/api/switch-store", (req, res) => {
    const targetId = Number(req.body?.target_client_id);
    if (!stores.some(store => store.id === targetId)) {
      return res.status(404).json({ detail: "Store not found." });
    }
    currentStoreId = targetId;
    stores = stores.map(store => ({ ...store, is_current: store.id === currentStoreId }));
    res.json({ success: true, current_store_id: currentStoreId });
  });

  app.post("/api/create-store", (req, res) => {
    const name = String(req.body?.name || "New Store").trim();
    const domain = String(req.body?.domain || "").trim();
    const store = {
      id: Math.max(0, ...stores.map(item => item.id)) + 1,
      name,
      domain,
      is_current: false,
      role: "Owner",
    };
    stores.push(store);
    res.json({ success: true, store });
  });

  app.get("/api/v1/ad-campaigns", (req, res) => {
    res.json([
      { id: "mock-meta-prospecting", name: "Meta Prospecting", platform: "meta", status: "active" },
      { id: "mock-tiktok-retargeting", name: "TikTok Retargeting", platform: "tiktok", status: "active" },
    ]);
  });

  app.get("/api/ai-ads/overview", (_req, res) => {
    res.json({
      performance: {
        spend: 18000, impressions: 28400, clicks: 920, ctr: 3.24, cpc: 19.57, cpm: 633.8,
        conversions: 42, cpa: 428.57, revenue: 105000, roas: 5.83, conversion_rate: 4.57,
        aov: 2500, attribution_quality: 88.1,
      },
      proposals: aiAdsProposals,
      actions: aiAdsActions,
      writes_enabled: false,
    });
  });

  app.get("/api/ai-ads/performance", (_req, res) => {
    res.json({
      spend: 18000, impressions: 28400, clicks: 920, ctr: 3.24, cpc: 19.57, cpm: 633.8,
      conversions: 42, cpa: 428.57, revenue: 105000, roas: 5.83, conversion_rate: 4.57,
      aov: 2500, attribution_quality: 88.1,
    });
  });

  app.get("/api/v1/ai-ads/connections", (_req, res) => res.json(aiAdsConnections));

  app.post("/api/v1/ai-ads/oauth/:provider/start", (req, res) => {
    res.json({ authorization_url: `/ai-ads/accounts?oauth=mock&provider=${req.params.provider}` });
  });

  app.post("/api/v1/ai-ads/connections/select-account", (_req, res) => {
    res.json({ id: 1, status: "connected" });
  });

  app.delete("/api/v1/ai-ads/connections/:id", (req, res) => {
    aiAdsConnections = aiAdsConnections.filter(item => item.id !== Number(req.params.id));
    res.json({ status: "disconnected" });
  });

  app.post("/api/ai-ads/chat", (req, res) => {
    const prompt = String(req.body?.message || "");
    aiConversationId += 1;
    res.json({
      conversation_id: aiConversationId,
      message: prompt.toLowerCase().includes("campaign")
        ? "I can prepare a paused campaign proposal. I still need the product, landing page, location, daily budget, duration, and creative assets."
        : "The current seven-day snapshot shows 5.83 ROAS with 88.1% explicit attribution coverage. I recommend reviewing the unattributed purchases before scaling.",
      structured: null,
    });
  });

  /**
   * Streaming twin of the mock chat route, so the demo shows the same shape the real backend
   * sends: an activity `step` per check the agent ran, `delta` text, then one authoritative
   * `done` frame. Without this the demo silently fell back to the blocking route and the
   * activity trail could never be seen locally.
   */
  app.post("/api/ai-ads/chat/stream", async (req, res) => {
    const prompt = String(req.body?.message || "");
    aiConversationId += 1;
    const message = prompt.toLowerCase().includes("campaign")
      ? "I can prepare a paused campaign proposal. I still need the product, landing page, location, daily budget, duration, and creative assets."
      : "The current seven-day snapshot shows 5.83 ROAS with 88.1% explicit attribution coverage. I recommend reviewing the unattributed purchases before scaling.";
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (frame: unknown) => res.write(`data: ${JSON.stringify(frame)}\n\n`);
    const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    for (const step of [
      { label: "Looking up your connected ad accounts", status: "completed" },
      { label: "Checking spend and results", status: "completed" },
      { label: "Matching orders to ads", status: "completed" },
    ]) {
      await pause(450);
      send({ type: "step", ...step });
    }
    for (const piece of message.match(/\S+\s*/g) ?? []) {
      await pause(25);
      send({ type: "delta", text: piece });
    }
    send({ type: "done", conversation_id: aiConversationId, message, structured: null, usage: { input_tokens: 1840, output_tokens: 96 } });
    res.end();
  });

  app.post("/api/ai-ads/proposals/:id/approve", (req, res) => {
    const proposal = aiAdsProposals.find(item => item.id === Number(req.params.id));
    if (!proposal || req.body?.proposal_hash !== proposal.proposal_hash) {
      return res.status(409).json({ detail: "Approval does not match the exact proposal hash." });
    }
    proposal.status = "approved";
    res.json({ approval_id: 801 });
  });

  app.post("/api/ai-ads/proposals/:id/queue", (req, res) => {
    const proposal = aiAdsProposals.find(item => item.id === Number(req.params.id));
    if (!proposal || Number(req.body?.approval_id) !== 801) {
      return res.status(409).json({ detail: "Valid approval is required." });
    }
    proposal.status = "queued";
    const action = {
      id: 901 + aiAdsActions.length,
      operation: proposal.operation,
      provider: "meta",
      status: "queued",
      created_at: new Date().toISOString(),
    };
    aiAdsActions.unshift(action);
    res.json({ action_id: action.id, status: action.status });
  });

  app.get("/api/v1/ad-accounts", (req, res) => {
    res.json(adAccounts);
  });

  app.post("/api/v1/ad-accounts", (req, res) => {
    const account = {
      id: Math.max(0, ...adAccounts.map(item => item.id)) + 1,
      platform: String(req.body?.platform || "meta"),
      external_account_id: String(req.body?.external_account_id || ""),
      account_name: String(req.body?.account_name || "Mock Ad Account"),
      account_currency: String(req.body?.account_currency || "USD"),
      account_timezone: String(req.body?.account_timezone || "Asia/Dhaka"),
      last_synced_at: null,
    };
    adAccounts.push(account);
    res.json(account);
  });

  app.post("/api/v1/ad-accounts/:id/sync", (req, res) => {
    const id = Number(req.params.id);
    const account = adAccounts.find(item => item.id === id);
    if (!account) {
      return res.status(404).json({ detail: "Ad account not found." });
    }
    account.last_synced_at = new Date().toISOString();
    res.json({ status: "success", synced_rows: 2, last_synced_at: account.last_synced_at });
  });

  app.delete("/api/v1/ad-accounts/:id", (req, res) => {
    const id = Number(req.params.id);
    adAccounts = adAccounts.filter(account => account.id !== id);
    res.json({ success: true });
  });

  app.get("/api/v1/analytics/ad-performance", (req, res) => {
    res.json({
      sync_enabled: true,
      connected_accounts: adAccounts.length,
      last_synced_at: adAccounts[0]?.last_synced_at || null,
      missing_attribution_purchases: 2,
      data: [
        {
          platform: "meta",
          campaign_id: "mock-meta-prospecting",
          campaign_name: "Meta Prospecting",
          spend: 18000,
          spend_currency: "BDT",
          clicks: 920,
          impressions: 28400,
          placed_purchases: 42,
          placed_revenue: 105000,
          confirmed_purchases: 35,
          confirmed_revenue: 87500,
          confirmed_roas: 4.86,
          confirmed_cpa: 514.29,
          revenue_currency: "BDT",
        },
      ],
    });
  });

  /**
   * API-05: `analyticsApi.fetchAnalyticsBundle` reads `overview.funnel`, which this
   * endpoint never returned, so the funnel chart rendered empty in local dev.
   */
  app.get("/api/v1/analytics/overview", (req, res) => {
    const total = events.length;
    const success = events.filter(event => event.status === "Delivered").length;
    const failed = events.filter(event => event.status === "Failed").length;
    const countByName = (name: string) => events.filter(event => event.name === name).length;

    res.json({
      total_events: total,
      success_events: success,
      failed_events: failed,
      match_quality: 82,
      revenue: 128450,
      conversion_rate: 4.8,
      event_growth: 12.4,
      revenue_growth: 9.6,
      funnel: [
        { step: "PageView", count: countByName("PageView") },
        { step: "ViewContent", count: countByName("ViewContent") },
        { step: "AddToCart", count: countByName("AddToCart") },
        { step: "InitiateCheckout", count: countByName("InitiateCheckout") },
        { step: "Purchase", count: countByName("Purchase") },
      ],
    });
  });

  app.get("/api/v1/analytics/campaigns", (req, res) => {
    const payload: AnalyticsCampaigns = {
      campaigns: [
        { source: "facebook", campaign: "Meta Prospecting", view_content: 842, add_to_cart: 391, initiate_checkout: 214, purchase: 96, revenue: 68400, currency: "BDT" },
        { source: "tiktok", campaign: "TikTok Retargeting", view_content: 516, add_to_cart: 233, initiate_checkout: 118, purchase: 54, revenue: 42100, currency: "BDT" },
        { source: "google", campaign: "Google Shopping", view_content: 394, add_to_cart: 168, initiate_checkout: 87, purchase: 41, revenue: 30750, currency: "BDT" },
      ],
    };
    res.json(payload);
  });

  app.get("/api/v1/analytics/hourly", (req, res) => {
    res.json({
      hourly: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        events: 12 + ((hour * 7) % 31),
        revenue: 900 + ((hour * 431) % 2400),
      })),
    });
  });

  /**
   * API-05: the frontend reads top_districts / device_mix / browser_mix /
   * district_funnel / visitor_district_funnel. This endpoint only returned
   * `countries` and `devices`, so every audience panel rendered empty.
   * The legacy keys are kept so nothing that still reads them breaks.
   */
  app.get("/api/v1/analytics/audience", (req, res) => {
    const topDistricts = [
      { label: "Dhaka", count: 412, percentage: 58.2 },
      { label: "Chattogram", count: 138, percentage: 19.5 },
      { label: "Sylhet", count: 74, percentage: 10.5 },
      { label: "Khulna", count: 44, percentage: 6.2 },
      { label: "Rajshahi", count: 39, percentage: 5.6 },
    ];

    res.json({
      top_districts: topDistricts,
      device_mix: [
        { label: "Mobile", count: 580, percentage: 82 },
        { label: "Desktop", count: 106, percentage: 15 },
        { label: "Tablet", count: 21, percentage: 3 },
      ],
      browser_mix: [
        { label: "Chrome", count: 494, percentage: 70 },
        { label: "Safari", count: 127, percentage: 18 },
        { label: "Firefox", count: 49, percentage: 7 },
        { label: "Other", count: 37, percentage: 5 },
      ],
      district_funnel: topDistricts.map(district => ({
        district: district.label,
        page_view: district.count * 3,
        add_to_cart: Math.round(district.count * 1.4),
        initiate_checkout: Math.round(district.count * 0.8),
        purchase: Math.round(district.count * 0.35),
        revenue: Math.round(district.count * 0.35) * 2450,
        currency: "BDT",
      })),
      visitor_district_funnel: topDistricts.map(district => ({
        district: district.label,
        page_view: district.count * 4,
        add_to_cart: Math.round(district.count * 1.5),
        initiate_checkout: Math.round(district.count * 0.85),
        purchase: Math.round(district.count * 0.35),
        revenue: Math.round(district.count * 0.35) * 2450,
        currency: "BDT",
      })),
      // Legacy keys retained for backwards compatibility.
      countries: [
        { name: "Bangladesh", value: 78 },
        { name: "United States", value: 12 },
        { name: "United Kingdom", value: 6 },
      ],
      devices: [
        { name: "Mobile", value: 82 },
        { name: "Desktop", value: 15 },
        { name: "Tablet", value: 3 },
      ],
    });
  });

  /** API-05: the frontend reads `issues` and `signal_rates`; only `score`/`checks` existed. */
  app.get("/api/v1/analytics/signal-doctor", (req, res) => {
    const checks = [
      { label: "Meta CAPI connection", status: "pass", detail: "Active heartbeat found." },
      { label: "Deduplication keys", status: "pass", detail: "Recent events include stable event IDs." },
      { label: "TikTok payload quality", status: "warning", detail: "Add product category when available." },
    ];

    res.json({
      score: 86,
      checks,
      issues: checks
        .filter(check => check.status !== "pass")
        .map(check => ({
          severity: check.status === "warning" ? "medium" : "high",
          title: check.label,
          message: check.detail,
          recommendation: "Review the affected integration and send a fresh test event.",
        })),
      signal_rates: {
        event_id: 98.2,
        user_match: 94.6,
        email_or_phone: 91.4,
        click_id: 88.1,
        content_ids: 96.3,
        value: 95.8,
        utm: 84.7,
      },
    });
  });

  app.post("/api/sidebar/mark-seen", (req, res) => {
    const section = String(req.body?.section || '');
    const seenKeys: Record<string, string> = {
      order_verification: 'order_verification_seen_at',
      orders_delivery: 'orders_delivery_seen_at',
    };
    const key = seenKeys[section];

    if (!key) {
      res.status(400).json({ detail: "Invalid sidebar section." });
      return;
    }

    sidebarSeenState[key] = new Date().toISOString();
    res.json({ success: true, seenState: sidebarSeenState });
  });

  app.post("/api/deferred/settings", (req, res) => {
    const body = req.body || {};
    if (typeof body.deferredEnabled !== "boolean") {
      return res.status(400).json({ detail: "`deferredEnabled` must be a boolean." });
    }
    const days = Number(body.autoConfirmDays);
    if (!Number.isFinite(days) || days < 0 || days > 90) {
      return res.status(400).json({ detail: "`autoConfirmDays` must be a number between 0 and 90." });
    }
    if (typeof body.autoConfirmStatus !== "string" || !body.autoConfirmStatus.trim()) {
      return res.status(400).json({ detail: "`autoConfirmStatus` must be a non-empty string." });
    }

    deferredEnabled = body.deferredEnabled;
    autoConfirmDays = days;
    autoConfirmStatus = body.autoConfirmStatus;
    res.json({
      success: true,
      deferredEnabled,
      autoConfirmDays,
      autoConfirmStatus
    });
  });

  // CP-03: `order_id` was read straight off the body and an unknown id silently
  // reported success while incrementing the counters.
  app.post("/api/deferred/confirm", (req, res) => {
    const orderId = readOrderId(req.body);
    if (!orderId) {
      return res.status(400).json({ detail: "`order_id` must be a non-empty string." });
    }
    const target = pendingOrders.find(order => order.orderId === orderId);
    if (!target) {
      return res.status(404).json({ detail: `Order '${orderId}' is not in the pending queue.` });
    }
    pendingOrders = pendingOrders.filter(order => order.orderId !== orderId);
    archivedOrders.unshift({ action: "confirm", order: target });
    confirmedTotal++;
    confirmedToday++;
    res.json({ success: true, confirmed: 1 });
  });

  app.post("/api/deferred/cancel", (req, res) => {
    const orderId = readOrderId(req.body);
    if (!orderId) {
      return res.status(400).json({ detail: "`order_id` must be a non-empty string." });
    }
    const target = pendingOrders.find(order => order.orderId === orderId);
    if (!target) {
      return res.status(404).json({ detail: `Order '${orderId}' is not in the pending queue.` });
    }
    pendingOrders = pendingOrders.filter(order => order.orderId !== orderId);
    archivedOrders.unshift({ action: "cancel", order: target });
    cancelledTotal++;
    res.json({ success: true, cancelled: 1 });
  });

  /**
   * API-05: `operationsApi.runDeferredOrderAction` supports a 'restore' action and
   * posts to /api/deferred/restore, which did not exist and returned the SPA HTML
   * shell (see CP-17) instead of a 404.
   */
  app.post("/api/deferred/restore", (req, res) => {
    const orderId = readOrderId(req.body);
    if (!orderId) {
      return res.status(400).json({ detail: "`order_id` must be a non-empty string." });
    }
    const index = archivedOrders.findIndex(entry => entry.order.orderId === orderId);
    if (index === -1) {
      return res.status(404).json({ detail: `Order '${orderId}' is not in the confirmed/cancelled archive.` });
    }
    const [entry] = archivedOrders.splice(index, 1);
    pendingOrders.unshift(entry.order);
    if (entry.action === "confirm") {
      confirmedTotal = Math.max(0, confirmedTotal - 1);
      confirmedToday = Math.max(0, confirmedToday - 1);
    } else {
      cancelledTotal = Math.max(0, cancelledTotal - 1);
    }
    res.json({ success: true, restored: 1 });
  });

  // CP-03: `order_ids.includes(...)` threw a TypeError and produced a 500 whenever
  // the body was missing, a string, or an object. Totals also counted requested ids
  // rather than rows actually removed.
  app.post("/api/deferred/confirm-bulk", (req, res) => {
    const orderIds = readOrderIds(req.body);
    if (!orderIds) {
      return res.status(400).json({ detail: "`order_ids` must be an array of non-empty order id strings." });
    }
    const matched = pendingOrders.filter(order => orderIds.includes(order.orderId));
    pendingOrders = pendingOrders.filter(order => !orderIds.includes(order.orderId));
    for (const order of matched) archivedOrders.unshift({ action: "confirm", order });
    confirmedTotal += matched.length;
    confirmedToday += matched.length;
    res.json({ success: true, confirmed: matched.length, failed: orderIds.length - matched.length });
  });

  app.post("/api/deferred/cancel-bulk", (req, res) => {
    const orderIds = readOrderIds(req.body);
    if (!orderIds) {
      return res.status(400).json({ detail: "`order_ids` must be an array of non-empty order id strings." });
    }
    const matched = pendingOrders.filter(order => orderIds.includes(order.orderId));
    pendingOrders = pendingOrders.filter(order => !orderIds.includes(order.orderId));
    for (const order of matched) archivedOrders.unshift({ action: "cancel", order });
    cancelledTotal += matched.length;
    res.json({ success: true, cancelled: matched.length, failed: orderIds.length - matched.length });
  });

  /**
   * Production serves this app from Vercel, where `vercel.json` rewrites
   * `/static/:path*` to `https://api.buykori.app/static/:path*`. Nothing here
   * replays that rewrite, so every backend-hosted asset the app asks for used to
   * fall through to the SPA catch-all and come back as `index.html` with status
   * 200 — an <img> pointed at HTML, which the browser renders as a broken glyph.
   * That is what the platform logos (`PlatformLogo`) were doing on localhost
   * while production showed them fine.
   *
   * The files exist in `public/`, one level shallower than the backend mount, so
   * `/static/client-portal/platforms/meta.svg` resolves to `public/platforms/meta.svg`.
   * `brand-logo.png` keeps its own handler: the backend keeps it under `assets/`,
   * which has no counterpart in `public/`.
   */
  const publicPath = path.join(process.cwd(), 'public');
  app.get('/static/client-portal/assets/brand-logo.png', (_req, res) => {
    res.sendFile(path.join(publicPath, 'brand-logo.png'));
  });
  app.use('/static/client-portal', express.static(publicPath));

  /**
   * CP-17: any unmatched /api/* request used to fall through to the Vite middleware
   * (dev) or the `app.get('*')` catch-all (prod) and come back as the SPA HTML shell
   * with status 200. Callers then failed on `response.json()` with a confusing parse
   * error instead of seeing the real problem: the route does not exist.
   *
   * Must stay mounted after every API route and before the SPA handlers.
   */
  app.use("/api", (req, res) => {
    res.status(404).json({
      detail: `Unknown API route: ${req.method} ${req.originalUrl}`,
    });
  });

  // Mount Vite development middleware after API endpoints the template suggests
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`CAPI mock portal serving on http://${HOST}:${PORT}`);
  });
}

startServer();
