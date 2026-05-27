var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/lib/mock-data.ts
var initialProfile = {
  name: "Malcolm Abbott",
  email: "malcolmabbotte@gmail.com",
  notificationEmail: "malcolmabbotte@gmail.com",
  plan: "Growth Plan",
  eventsUsed: 12450,
  eventsQuota: 5e4,
  renewalDate: "2026-06-24"
};
var initialConnection = {
  token: "",
  wpVersion: "6.4.3",
  lastHeartbeat: "2026-05-24T13:10:12Z",
  status: "Active"
};
var initialRules = [
  { eventName: "PageView", metaEnabled: true, tiktokEnabled: true, ga4Enabled: true },
  { eventName: "AddToCart", metaEnabled: true, tiktokEnabled: true, ga4Enabled: true },
  { eventName: "InitiateCheckout", metaEnabled: true, tiktokEnabled: true, ga4Enabled: true },
  { eventName: "Purchase", metaEnabled: true, tiktokEnabled: true, ga4Enabled: true },
  { eventName: "Lead", metaEnabled: true, tiktokEnabled: false, ga4Enabled: true },
  { eventName: "Contact", metaEnabled: false, tiktokEnabled: false, ga4Enabled: true }
];
var initialSuggestions = [
  {
    id: "s_01",
    title: "Missing 'value' and 'currency' parameters on Purchase",
    severity: "Critical",
    explanation: "Your Purchase event is missing core transaction variables (`value`, `currency`). Meta Conversions API relies on value data for catalog pairings, value-based lookalike audiences, and ROAS calculations. This reduces your match quality and optimizer leverage by ~40%.",
    fixAction: "Navigate to WordPress > CAPI Plugin Settings > Event Parameters and check the box to 'Inherit WooCommerce Price & Currency Schema' automatically.",
    resolved: false,
    platform: "Meta CAPI"
  },
  {
    id: "s_02",
    title: "GA4 Events experiencing elevated failure rate (12%)",
    severity: "Warning",
    explanation: "Events sent to the Google Analytics 4 Measurement Protocol have been rejected with a 4xx response code during the last 7 days. This typically happens when the Measurement ID is mismatched or the 'API Secret Key' created in your GA4 admin workspace is expired or invalid.",
    fixAction: "Go to Admin > Data Streams > Web Stream > Measurement Protocol API Secrets in your GA4 account, generate a new secret token, and copy it into the Setup panel.",
    resolved: false,
    platform: "GA4"
  },
  {
    id: "s_03",
    title: "Duplicate AddToCart events transmitted without Deduplication keys",
    severity: "Critical",
    explanation: "We detected AddToCart payloads matching browser signals that are missing the mandatory deduplication `event_id`. This causes Meta Ads Manager to record double action triggers, skewing attribution numbers and inflating reported cart conversions artificially.",
    fixAction: "In your WooCommerce pixel setup tool, verify that 'Deduplication Sync Header' is toggled ON to match both pixel keys and track hashes.",
    resolved: false,
    platform: "Meta CAPI"
  },
  {
    id: "s_04",
    title: "TikTok tracking connection needs Optimization Review",
    severity: "Tip",
    explanation: "TikTok Events API is actively recording events, but is not receiving user agents or IP addresses. It is recommended to pass hashed identifiers (`em`, `ph`) or client headers to improve Match Quality on mobile-first campaigns.",
    fixAction: "Toggle on 'Advanced Customer Header Matching' in your WordPress settings panel.",
    resolved: false,
    platform: "TikTok Events API"
  }
];
function generateEventData() {
  const events = [];
  const names = ["PageView", "AddToCart", "InitiateCheckout", "Purchase", "Lead", "Contact"];
  const platforms = ["Meta CAPI", "TikTok Events API", "GA4"];
  const now = /* @__PURE__ */ new Date();
  for (let i = 0; i < 150; i++) {
    const ageInHours = i * 4.8;
    const date = new Date(now.getTime() - ageInHours * 60 * 60 * 1e3);
    const platform = platforms[i % platforms.length];
    const name = names[Math.floor(i * 1.7 % names.length)];
    const id = `evt_${1e5 + i}`;
    const dedupeKey = `did_${8e5 + i}`;
    let status = "Success";
    let httpCode = 200;
    if (i % 23 === 0) {
      status = "Failed";
      httpCode = 400;
    } else if (i % 37 === 0) {
      status = "Retry";
      httpCode = 503;
    }
    const value = (120 - i % 12 * 8).toFixed(2);
    const currency = "USD";
    const emailHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const payload = {
      event_name: name,
      event_time: Math.floor(date.getTime() / 1e3),
      event_id: dedupeKey,
      user_data: {
        client_ip_address: `192.168.1.${10 + i % 50}`,
        client_user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        em: name === "Purchase" || name === "Lead" ? [emailHash] : void 0
      },
      custom_data: name === "Purchase" ? {
        value,
        currency,
        content_type: "product",
        contents: [
          { id: `prod_${i % 10}`, quantity: 1, item_price: parseFloat(value) }
        ]
      } : void 0
    };
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${platform === "Meta CAPI" ? "fb_cap_key_***" : platform === "TikTok Events API" ? "tt_evt_key_***" : "ga_mp_sec_***"}`,
      "X-Client-IP": `192.168.1.${10 + i % 50}`,
      "User-Agent": "WordPress/6.4.3; WooCommerce/8.5.2"
    };
    const responseBody = status === "Success" ? { events_received: 1, status: "accepted", fb_trace_id: `FBT_${Math.random().toString(36).substring(7).toUpperCase()}` } : status === "Retry" ? { error: { message: "Server overloaded", code: 503 } } : { error: { message: "Invalid conversion details: value missing on purchase event", code: 400, type: "OAuthException" } };
    events.push({
      id,
      timestamp: date.toISOString(),
      name,
      platform,
      status,
      httpCode,
      deduplicationKey: dedupeKey,
      payload,
      headers,
      responseBody,
      latencyMs: 75 + i % 200
    });
  }
  return events;
}
function generateAPILogs(events) {
  return events.map((evt) => {
    const urls = {
      "Meta CAPI": "https://graph.facebook.com/v18.0/pixel_id/events",
      "TikTok Events API": "https://open-api.tiktok.com/v1.3/pixel/track",
      "GA4": "https://www.google-analytics.com/mp/collect?api_secret=sec_key&measurement_id=id"
    };
    return {
      id: `api_${evt.id.split("_")[1]}`,
      timestamp: evt.timestamp,
      platform: evt.platform,
      endpoint: urls[evt.platform],
      method: "POST",
      statusCode: evt.httpCode,
      latencyMs: evt.latencyMs,
      retryCount: evt.status === "Retry" ? 1 : evt.status === "Failed" ? 2 : 0,
      requestBody: JSON.stringify(evt.payload, null, 2),
      responseBody: JSON.stringify(evt.responseBody, null, 2)
    };
  });
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  app.use(import_express.default.json());
  const PORT = 3e3;
  let profile = { ...initialProfile };
  let connection = { ...initialConnection };
  let rules = [...initialRules];
  let suggestions = [...initialSuggestions];
  let deferredEnabled = false;
  let autoConfirmDays = 3;
  let autoConfirmStatus = "completed";
  let pendingOrders = [
    {
      orderId: "WC-9283",
      amount: 2490,
      customer: "+8801712345678",
      fraudScore: 12,
      fraudDetails: {},
      ageHours: 5.2,
      timestamp: new Date(Date.now() - 5.2 * 36e5).toISOString()
    },
    {
      orderId: "WC-9284",
      amount: 4500,
      customer: "customer@domain.com",
      fraudScore: 78,
      fraudDetails: { ip_mismatch: true, gibberish_name: true },
      ageHours: 12.8,
      timestamp: new Date(Date.now() - 12.8 * 36e5).toISOString()
    }
  ];
  let confirmedTotal = 12;
  let cancelledTotal = 2;
  let confirmedToday = 2;
  let credentials = {
    "Meta CAPI": { enabled: true, pixelIdOrMeasurementId: "982049182390231", accessToken: "EAADf9a88cdba8382d...", status: "Valid" },
    "TikTok Events API": { enabled: true, pixelIdOrMeasurementId: "C12903JS902KA", accessToken: "tt_ac_tkn_81a7b...", status: "Valid" },
    "GA4": { enabled: true, pixelIdOrMeasurementId: "G-9K38A2JS09", accessToken: "secret_mp_token_...", status: "Valid" }
  };
  let events = generateEventData();
  let apiLogs = generateAPILogs(events);
  let outboxItems = [
    {
      id: 901,
      status: "dead",
      attempts: 8,
      maxAttempts: 8,
      nextAttemptAt: null,
      lastError: "Meta CAPI rejected the request: invalid or expired access token.",
      createdAt: new Date(Date.now() - 3 * 36e5).toISOString(),
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
      nextAttemptAt: new Date(Date.now() + 12 * 6e4).toISOString(),
      lastError: "TikTok Events API timed out on the previous attempt.",
      createdAt: new Date(Date.now() - 42 * 6e4).toISOString(),
      sentAt: null,
      locked: false,
      eventNames: ["AddToCart", "InitiateCheckout"],
      eventCount: 2,
      eventIds: ["demo_cart_retry_902"]
    }
  ];
  function addTrackingEvent(name, platform, status, httpCode, payload, customRes) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const id = `evt_${2e5 + events.length}`;
    const dedupeKey = `did_${9e5 + events.length}`;
    const newEvent = {
      id,
      timestamp,
      name,
      platform,
      status,
      httpCode,
      deduplicationKey: dedupeKey,
      payload,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer credentials_mask_***`,
        "X-Client-IP": payload?.user_data?.client_ip_address || "127.0.0.1",
        "User-Agent": payload?.user_data?.client_user_agent || "WordPress/6.4.3"
      },
      responseBody: customRes || (status === "Success" ? { events_received: 1, status: "accepted", fb_trace_id: `FBT_${Math.random().toString(36).substring(7).toUpperCase()}` } : { error: { message: "Invalid payload params", code: httpCode } }),
      latencyMs: Math.floor(Math.random() * 150) + 50
    };
    events.unshift(newEvent);
    const apiLog = {
      id: `api_${id.split("_")[1]}`,
      timestamp,
      platform,
      endpoint: platform === "Meta CAPI" ? "https://graph.facebook.com/v18.0/pixel_id/events" : platform === "TikTok Events API" ? "https://open-api.tiktok.com/v1.3/pixel/track" : "https://www.google-analytics.com/mp/collect",
      method: "POST",
      statusCode: httpCode,
      latencyMs: newEvent.latencyMs,
      retryCount: status === "Retry" ? 1 : status === "Failed" ? 2 : 0,
      requestBody: JSON.stringify(payload, null, 2),
      responseBody: JSON.stringify(newEvent.responseBody, null, 2)
    };
    apiLogs.unshift(apiLog);
    profile.eventsUsed += 1;
    if (profile.eventsUsed > profile.eventsQuota) {
      profile.eventsUsed = profile.eventsQuota;
    }
  }
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/profile", (req, res) => {
    res.json(profile);
  });
  app.post("/api/profile", (req, res) => {
    const { name, email, notificationEmail } = req.body;
    if (name) profile.name = name;
    if (email) profile.email = email;
    if (notificationEmail) profile.notificationEmail = notificationEmail;
    res.json({ success: true, profile });
  });
  app.post("/api/profile/reset-demo", (req, res) => {
    profile.eventsUsed = 12450;
    events = generateEventData();
    apiLogs = generateAPILogs(events);
    suggestions = [...initialSuggestions];
    res.json({ success: true, profile, eventsCount: events.length });
  });
  app.get("/api/connection", (req, res) => {
    res.json(connection);
  });
  app.post("/api/connection/test", (req, res) => {
    connection.lastHeartbeat = (/* @__PURE__ */ new Date()).toISOString();
    connection.status = "Active";
    addTrackingEvent("PageView", "Meta CAPI", "Success", 200, {
      event_name: "PageView",
      event_time: Math.floor(Date.now() / 1e3),
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
  app.post("/api/connection/revoke", (req, res) => {
    connection.status = "Disconnected";
    connection.token = "capi_tkn_REVOKED_pw_" + Math.random().toString(36).substring(5);
    res.json({ success: true, connection });
  });
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
  app.get("/api/credentials", (req, res) => {
    res.json(credentials);
  });
  app.post("/api/credentials", (req, res) => {
    const { platform, enabled, pixelIdOrMeasurementId, accessToken } = req.body;
    if (credentials[platform]) {
      const p = credentials[platform];
      if (typeof enabled === "boolean") p.enabled = enabled;
      if (pixelIdOrMeasurementId !== void 0) p.pixelIdOrMeasurementId = pixelIdOrMeasurementId;
      if (accessToken !== void 0) p.accessToken = accessToken;
      if (!p.pixelIdOrMeasurementId || !p.accessToken) {
        p.status = "Untested";
      } else if (p.pixelIdOrMeasurementId.length < 5 || p.accessToken.length < 8) {
        p.status = "Invalid";
      } else {
        p.status = "Valid";
      }
    }
    res.json({ success: true, credentials });
  });
  app.get("/api/events", (req, res) => {
    const { search, status, platform, eventName, limit = "20", offset = "0" } = req.query;
    let filtered = [...events];
    if (status) {
      const statusList = status.split(",");
      filtered = filtered.filter((e) => statusList.includes(e.status));
    }
    if (platform) {
      const platformList = platform.split(",");
      filtered = filtered.filter((e) => platformList.includes(e.platform));
    }
    if (eventName) {
      const eventList = eventName.split(",");
      filtered = filtered.filter((e) => eventList.includes(e.name));
    }
    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (e) => e.name.toLowerCase().includes(term) || e.id.toLowerCase().includes(term) || e.deduplicationKey.toLowerCase().includes(term) || JSON.stringify(e.payload).toLowerCase().includes(term)
      );
    }
    const totalCount = filtered.length;
    const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json({
      events: paginated,
      totalCount
    });
  });
  app.get("/api/api-logs", (req, res) => {
    const { platform, search, limit = "20", offset = "0" } = req.query;
    let filtered = [...apiLogs];
    if (platform) {
      filtered = filtered.filter((l) => l.platform === platform);
    }
    if (search) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (l) => l.endpoint.toLowerCase().includes(term) || l.statusCode.toString().includes(term) || l.requestBody.toLowerCase().includes(term) || l.responseBody.toLowerCase().includes(term)
      );
    }
    const totalCount = filtered.length;
    const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    res.json({
      logs: paginated,
      totalCount
    });
  });
  app.get("/api/outbox", (req, res) => {
    const { limit = "25" } = req.query;
    res.json({
      items: outboxItems.slice(0, parseInt(limit)),
      totalCount: outboxItems.length
    });
  });
  app.post("/api/outbox/:id/retry", (req, res) => {
    const id = Number(req.params.id);
    const item = outboxItems.find((row) => row.id === id);
    if (!item) {
      return res.status(404).json({ detail: "Outbox row not found." });
    }
    if (item.status === "processing") {
      return res.status(409).json({ detail: "This event is already being processed." });
    }
    item.status = "queued";
    item.nextAttemptAt = (/* @__PURE__ */ new Date()).toISOString();
    item.lastError = "";
    if (item.attempts >= item.maxAttempts) {
      item.maxAttempts = item.attempts + 1;
    }
    res.json({ success: true, item });
  });
  app.get("/api/events/live-stream", (req, res) => {
    const names = ["PageView", "AddToCart", "InitiateCheckout", "Purchase", "Lead"];
    const platforms = ["Meta CAPI", "TikTok Events API", "GA4"];
    const activePlatforms = platforms.filter((p) => credentials[p]?.enabled);
    if (activePlatforms.length === 0) {
      return res.json({ event: null });
    }
    const platform = activePlatforms[Math.floor(Math.random() * activePlatforms.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    const isError = Math.random() < 0.08;
    const status = isError ? "Failed" : "Success";
    const httpCode = isError ? 400 : 200;
    const value = (50 + Math.random() * 250).toFixed(2);
    const payload = {
      event_name: name,
      event_time: Math.floor(Date.now() / 1e3),
      user_data: {
        client_ip_address: `158.110.42.${Math.floor(Math.random() * 200) + 1}`,
        client_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      custom_data: name === "Purchase" ? { value, currency: "USD" } : void 0
    };
    addTrackingEvent(name, platform, status, httpCode, payload);
    res.json({ event: events[0] });
  });
  app.post("/api/campaign-test", (req, res) => {
    const { platform, eventName, value, currency, email, phone, ip, userAgent, customParams } = req.body;
    if (!platform || !eventName) {
      return res.status(400).json({ error: "Platform and Event Name are required fields." });
    }
    const timestamp = Math.floor(Date.now() / 1e3);
    const ipAddr = ip || "192.168.1.134";
    const ua = userAgent || "CAPI Campaign Sandbox Agent v1.0";
    const payload = {
      event_name: eventName,
      event_time: timestamp,
      user_data: {
        client_ip_address: ipAddr,
        client_user_agent: ua,
        em: email ? [email] : void 0,
        ph: phone ? [phone] : void 0
      },
      custom_data: value || currency ? {
        value,
        currency: currency || "USD",
        ...customParams
      } : customParams
    };
    const targetConfig = credentials[platform];
    const isPluginActive = connection.status === "Active";
    let code = 200;
    let status = "Success";
    let responseBody = {};
    if (!isPluginActive) {
      code = 503;
      status = "Failed";
      responseBody = { error: "WordPress Plugin disconnected. Tracking server rejected payload relay request." };
    } else if (!targetConfig.enabled) {
      code = 403;
      status = "Failed";
      responseBody = { error: `Relay failed: Routing pipeline for '${platform}' is disabled in settings.` };
    } else if (targetConfig.status === "Invalid" || !targetConfig.accessToken) {
      code = 401;
      status = "Failed";
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
          queue_at: (/* @__PURE__ */ new Date()).toISOString()
        }
      };
    }
    addTrackingEvent(eventName, platform, status, code, payload, responseBody);
    res.json({
      success: status === "Success",
      statusCode: code,
      response: responseBody,
      dispatchedEvent: events[0]
    });
  });
  app.get("/api/suggestions", (req, res) => {
    res.json(suggestions);
  });
  app.post("/api/suggestions/toggle-resolve", (req, res) => {
    const { id } = req.body;
    suggestions = suggestions.map((s) => {
      if (s.id === id) {
        return { ...s, resolved: !s.resolved };
      }
      return s;
    });
    res.json({ success: true, suggestions });
  });
  app.post("/api/suggestions/dismiss", (req, res) => {
    const { id } = req.body;
    suggestions = suggestions.filter((s) => s.id !== id);
    res.json({ success: true, suggestions });
  });
  app.post("/api/suggestions/ai-review", (req, res) => {
    const emulatedAI = [
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
    suggestions = [...emulatedAI, ...suggestions];
    res.json({
      success: true,
      message: "Diagnostics scan completed successfully.",
      suggestions
    });
  });
  app.get("/api/deferred", (req, res) => {
    const pendingValue = pendingOrders.reduce((acc, o) => acc + o.amount, 0);
    const oldestPending = pendingOrders.length > 0 ? `${Math.max(...pendingOrders.map((o) => o.ageHours))}h` : "\u2014";
    res.json({
      deferredEnabled,
      autoConfirmDays,
      autoConfirmStatus,
      pendingCount: pendingOrders.length,
      pendingValue: `\u09F3${pendingValue.toLocaleString()}`,
      confirmedTotal,
      cancelledTotal,
      expiredTotal: 0,
      confirmedToday,
      oldestPending,
      pendingList: pendingOrders
    });
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
    pendingOrders = pendingOrders.filter((o) => o.orderId !== order_id);
    confirmedTotal++;
    confirmedToday++;
    res.json({ success: true });
  });
  app.post("/api/deferred/cancel", (req, res) => {
    const { order_id } = req.body;
    pendingOrders = pendingOrders.filter((o) => o.orderId !== order_id);
    cancelledTotal++;
    res.json({ success: true });
  });
  app.post("/api/deferred/confirm-bulk", (req, res) => {
    const { order_ids } = req.body;
    pendingOrders = pendingOrders.filter((o) => !order_ids.includes(o.orderId));
    confirmedTotal += order_ids.length;
    confirmedToday += order_ids.length;
    res.json({ success: true });
  });
  app.post("/api/deferred/cancel-bulk", (req, res) => {
    const { order_ids } = req.body;
    pendingOrders = pendingOrders.filter((o) => !order_ids.includes(o.orderId));
    cancelledTotal += order_ids.length;
    res.json({ success: true });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CAPI Full-Stack Portal serving on port ${PORT}`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
