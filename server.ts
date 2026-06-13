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

const isProductionRuntime = process.env.NODE_ENV === "production";
const allowProductionMockServer = process.env.BUYKORI_ALLOW_MOCK_SERVER_PRODUCTION === "1";
const HOST = process.env.BUYKORI_MOCK_SERVER_HOST || (isProductionRuntime ? "127.0.0.1" : "0.0.0.0");
const PORT = Number(process.env.PORT || 3000);

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
  orderId: string;
  amount: number;
  customer: string;
  fraudScore: number;
  fraudDetails: Record<string, boolean>;
  ageHours: number;
  timestamp: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  customerName?: string;
  phone?: string;
  address?: string;
  products?: Array<Record<string, unknown>>;
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
          attributes: { Color: "Black", Size: "36" },
        },
      ],
      fraudScore: 12,
      fraudDetails: {},
      ageHours: 5.2,
      timestamp: new Date(Date.now() - 5.2 * 3600000).toISOString()
    },
    {
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
      fraudScore: 78,
      fraudDetails: { ip_mismatch: true, gibberish_name: true },
      ageHours: 12.8,
      timestamp: new Date(Date.now() - 12.8 * 3600000).toISOString()
    }
  ];
  let confirmedTotal = 12;
  let cancelledTotal = 2;
  let confirmedToday = 2;
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
  let courierSettings: Record<string, any> = {
    courier_auto_send: false,
    default_courier: "steadfast",
    pathao_environment: "sandbox",
    pathao_store_id: "",
    pathao_api_key: "",
    pathao_secret_key: "",
    steadfast_api_key: "",
    steadfast_secret_key: "",
    redx_access_token: "",
  };
  let incompleteCheckouts: MockIncompleteCheckout[] = [
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
      status: "open",
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
  ];
  let courierOrders = [
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
    },
  ];
  
  // Platform Credentials state
  let credentials: Record<Platform, PlatformConfig> = {
    'Meta CAPI': { enabled: true, pixelIdOrMeasurementId: "mock-meta-pixel-id", accessToken: "mock_meta_access_token", status: "Valid" },
    'TikTok Events API': { enabled: true, pixelIdOrMeasurementId: "mock-tiktok-pixel-id", accessToken: "mock_tiktok_access_token", status: "Valid" },
    'GA4': { enabled: true, pixelIdOrMeasurementId: "mock-ga4-measurement-id", accessToken: "mock_ga4_api_secret", status: "Valid" }
  };

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
  function addTrackingEvent(name: string, platform: Platform, status: 'Success' | 'Failed' | 'Retry', httpCode: number, payload: any, customRes?: any) {
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
      responseBody: customRes || (status === 'Success' 
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
    addTrackingEvent("PageView", "Meta CAPI", "Success", 200, {
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

  app.get("/api/events/trend", (req, res) => {
    const days = Math.max(1, Math.min(30, Number(req.query.days || 7)));
    const trend = Array.from({ length: days }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - index - 1));
      const dayEvents = events.filter((event, eventIndex) => eventIndex % days === index % days);
      const success = dayEvents.filter(event => event.status === "Success").length;
      const failed = dayEvents.filter(event => event.status === "Failed").length;
      return {
        date: date.toISOString().slice(0, 10),
        total: Math.max(dayEvents.length, 4 + index),
        success: Math.max(success, 3 + index),
        failed,
        value: 1200 + index * 380,
      };
    });
    res.json({ trend });
  });

  app.get("/api/events/recovery-summary", (req, res) => {
    const browserEvents = events.filter(event => event.payload?.action_source === "website").length;
    const serverEvents = events.length;
    const recoveredEvents = Math.max(0, serverEvents - browserEvents);
    res.json({
      browser_events: browserEvents,
      server_events: serverEvents,
      recovered_events: recoveredEvents,
      recovery_rate: serverEvents ? Math.round((recoveredEvents / serverEvents) * 1000) / 10 : 0,
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

    res.json({
      logs: paginated,
      totalCount
    });
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
    const status = isError ? "Failed" : "Success";
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

    // Determine return signals & insert event directly to logging history
    const targetConfig = credentials[platform as Platform];
    const isPluginActive = connection.status === 'Active';

    let code = 200;
    let status: 'Success' | 'Failed' = 'Success';
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
      success: status === 'Success',
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

  // COD Protection (Deferred Purchase Tracking) Mock Endpoints
  app.get("/api/deferred", (req, res) => {
    const pendingValue = pendingOrders.reduce((acc, o) => acc + o.amount, 0);
    const operationsPendingList = pendingOrders.map(order => ({
      ...order,
      operationsOnly: false,
    }));
    const oldestPending = pendingOrders.length > 0 ? `${Math.max(...pendingOrders.map(o => o.ageHours))}h` : "—";
    res.json({
      deferredEnabled,
      autoConfirmDays,
      autoConfirmStatus,
      pendingCount: pendingOrders.length,
      deferredPendingCount: pendingOrders.length,
      operationsPendingCount: operationsPendingList.length,
      pendingValue: `৳${pendingValue.toLocaleString()}`,
      confirmedTotal,
      cancelledTotal,
      expiredTotal: 0,
      confirmedToday,
      oldestPending,
      pendingList: pendingOrders,
      deferredPendingList: pendingOrders,
      operationsPendingList
    });
  });

  app.get("/api/sidebar/status", (req, res) => {
    const orderSeenAt = Date.parse(sidebarSeenState.order_verification_seen_at || '1970-01-01T00:00:00.000Z');
    const orderVerificationNew = pendingOrders.filter(order => Date.parse(order.timestamp) > orderSeenAt).length;

    res.json({
      orderVerificationTotal: pendingOrders.length,
      orderVerificationNew,
      ordersDeliveryTotal: pendingOrders.length,
      ordersDeliveryNew: orderVerificationNew,
      seenState: {
        orderVerificationSeenAt: sidebarSeenState.order_verification_seen_at,
        ordersDeliverySeenAt: sidebarSeenState.orders_delivery_seen_at,
      },
    });
  });

  app.get("/api/incomplete-checkouts", (req, res) => {
    const counts = incompleteCheckouts.reduce((acc: Record<string, number>, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      acc.total = (acc.total || 0) + 1;
      return acc;
    }, {});
    res.json({
      items: incompleteCheckouts,
      counts,
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
    target.status = String(req.body?.status || target.status);
    target.updated_at = new Date().toISOString();
    res.json({ success: true, item: target });
  });

  app.post("/api/incomplete-checkouts/:id/create-order", (req, res) => {
    const id = Number(req.params.id);
    const target = incompleteCheckouts.find(item => item.id === id);
    if (!target) {
      return res.status(404).json({ detail: "Incomplete checkout not found." });
    }
    if (!["incomplete", "contacted", "open"].includes(String(target.status))) {
      return res.status(400).json({ detail: "Only incomplete or contacted leads can be converted to an order." });
    }
    const body = req.body || {};
    const orderId = `manual-${id}-${Date.now()}`;
    const items = Array.isArray(body.items) ? body.items : [];
    const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const amount = Math.max(0, subtotal + Number(body.delivery_charge || 0) - Number(body.discount || 0));
    pendingOrders.unshift({
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
    const orderId = String(req.body?.order_id || `WC-${Math.floor(Math.random() * 9000) + 1000}`);
    const order = {
      id: Date.now(),
      order_id: orderId,
      courier_provider: String(req.body?.provider || courierSettings.default_courier || "steadfast"),
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
    };
    courierOrders.unshift(order);
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

  app.get("/api/courier/pathao/stores", (req, res) => {
    res.json({ stores: [{ store_id: "demo-pathao-store", store_name: "Buykori Demo Pickup" }] });
  });

  app.get("/api/courier/redx/areas", (req, res) => {
    res.json({ areas: [{ id: "dhaka-mirpur", name: "Mirpur, Dhaka" }, { id: "dhaka-banani", name: "Banani, Dhaka" }] });
  });

  app.post("/api/courier/:provider/webhook-secret", (req, res) => {
    const key = `${String(req.params.provider)}_webhook_secret_configured`;
    courierSettings[key] = true;
    res.json({ success: true, [key]: true });
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
      id: Math.max(...stores.map(item => item.id)) + 1,
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

  app.get("/api/v1/analytics/overview", (req, res) => {
    const total = events.length;
    const success = events.filter(event => event.status === "Success").length;
    const failed = events.filter(event => event.status === "Failed").length;
    res.json({
      total_events: total,
      success_events: success,
      failed_events: failed,
      match_quality: 82,
      revenue: 128450,
      conversion_rate: 4.8,
      event_growth: 12.4,
      revenue_growth: 9.6,
    });
  });

  app.get("/api/v1/analytics/campaigns", (req, res) => {
    res.json({
      campaigns: [
        { name: "Meta Prospecting", source: "facebook", events: 842, revenue: 68400, roas: 3.8 },
        { name: "TikTok Retargeting", source: "tiktok", events: 516, revenue: 42100, roas: 2.9 },
        { name: "Google Shopping", source: "google", events: 394, revenue: 30750, roas: 2.4 },
      ],
    });
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

  app.get("/api/v1/analytics/audience", (req, res) => {
    res.json({
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

  app.get("/api/v1/analytics/signal-doctor", (req, res) => {
    res.json({
      score: 86,
      checks: [
        { label: "Meta CAPI connection", status: "pass", detail: "Active heartbeat found." },
        { label: "Deduplication keys", status: "pass", detail: "Recent events include stable event IDs." },
        { label: "TikTok payload quality", status: "warning", detail: "Add product category when available." },
      ],
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
    deferredEnabled = req.body.deferredEnabled;
    autoConfirmDays = Number(req.body.autoConfirmDays);
    autoConfirmStatus = req.body.autoConfirmStatus;
    res.json({
      success: true,
      deferredEnabled,
      autoConfirmDays,
      autoConfirmStatus
    });
  });

  app.post("/api/deferred/confirm", (req, res) => {
    const { order_id } = req.body;
    pendingOrders = pendingOrders.filter(o => o.orderId !== order_id);
    confirmedTotal++;
    confirmedToday++;
    res.json({ success: true });
  });

  app.post("/api/deferred/cancel", (req, res) => {
    const { order_id } = req.body;
    pendingOrders = pendingOrders.filter(o => o.orderId !== order_id);
    cancelledTotal++;
    res.json({ success: true });
  });

  app.post("/api/deferred/confirm-bulk", (req, res) => {
    const { order_ids } = req.body;
    pendingOrders = pendingOrders.filter(o => !order_ids.includes(o.orderId));
    confirmedTotal += order_ids.length;
    confirmedToday += order_ids.length;
    res.json({ success: true });
  });

  app.post("/api/deferred/cancel-bulk", (req, res) => {
    const { order_ids } = req.body;
    pendingOrders = pendingOrders.filter(o => !order_ids.includes(o.orderId));
    cancelledTotal += order_ids.length;
    res.json({ success: true });
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
