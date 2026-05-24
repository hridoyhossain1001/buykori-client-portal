/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { 
  initialProfile, 
  initialConnection, 
  initialRules, 
  initialSuggestions, 
  generateEventData, 
  generateAPILogs 
} from "./src/lib/mock-data.js";
import { CAPIEvent, APILog, Suggestion, Platform, EventRule, PlatformConfig } from "./src/types.js";

// Lazy-loaded Gemini AI initialization helper
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.trim() === "") {
    console.warn("GEMINI_API_KEY is not defined. AI suggestions will operate in deep emulation fallback mode.");
    return null;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    return aiClient;
  } catch (err) {
    console.error("Failed to initialize Gemini AI client:", err);
    return null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // In-memory backend database state
  let profile = { ...initialProfile };
  let connection = { ...initialConnection };
  let rules = [...initialRules];
  let suggestions = [...initialSuggestions];
  
  // Platform Credentials state
  let credentials: Record<Platform, PlatformConfig> = {
    'Meta CAPI': { enabled: true, pixelIdOrMeasurementId: "982049182390231", accessToken: "EAADf9a88cdba8382d...", status: "Valid" },
    'TikTok Events API': { enabled: true, pixelIdOrMeasurementId: "C12903JS902KA", accessToken: "tt_ac_tkn_81a7b...", status: "Valid" },
    'GA4': { enabled: true, pixelIdOrMeasurementId: "G-9K38A2JS09", accessToken: "secret_mp_token_...", status: "Valid" }
  };

  // Generate initial database of events & raw API logs
  let events = generateEventData();
  let apiLogs = generateAPILogs(events);

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

  // AI-Assisted Recommendation review using the real Gemini model!
  app.post("/api/suggestions/ai-review", async (req, res) => {
    const client = getGeminiClient();
    
    // We make a short snapshot statistics overview to send as context to Gemini:
    const activeEnabled = Object.keys(credentials).filter(k => credentials[k as Platform].enabled);
    const errorCount = events.filter(e => e.status === 'Failed').length;
    const successCount = events.filter(e => e.status === 'Success').length;
    const failRate = events.length > 0 ? ((errorCount / events.length) * 100).toFixed(1) : "0.0";
    
    const recentFailures = events
      .filter(e => e.status === 'Failed')
      .slice(0, 3)
      .map(e => `[${e.platform}] Event '${e.name}' failed with HTTP ${e.httpCode}: ${JSON.stringify(e.responseBody)}`);

    const promptContext = `
      You are an expert marketing conversions engineer auditing server-side tracking configurations.
      Analyze the current configuration profile:
      - active pipelines: ${activeEnabled.join(', ')}
      - Event volumes (last 30 days sample): ${successCount} successful events, ${errorCount} failed events (Failure rate: ${failRate}%)
      - WordPress integration detected version: WooCommerce, WP v${connection.wpVersion} (Status: ${connection.status})
      - Recent failure patterns caught in error arrays:
        ${recentFailures.join('\n') || "No critical failures caught in current batch."}

      Task: Write 2 high-value, specific actionable tracking setup suggestions that an ads operations manager can copy and apply.
      Output format: MUST be valid JSON (excluding wrapping elements or Markdown blocks) containing an array of objects matching this exact TypeScript structure:
      {
        "id": "ai_gen_s_", // must start with this prefix followed by index
        "title": string, // clear name of the issue
        "severity": "Critical" | "Warning" | "Tip",
        "explanation": string, // what is wrong, the visual effect, and why it hurts campaign performance
        "fixAction": string, // numbered exact steps to correct inside WooCommerce or tracking credentials
        "resolved": false,
        "platform": "Meta CAPI" | "TikTok Events API" | "GA4"
      }
      Do NOT write any trailing summaries or commentary. Return ONLY the strict JSON array.
    `;

    if (!client) {
      // Return beautiful, premium emulated AI responses if Gemini key is missing
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

      // Add to suggestions feed randomly
      suggestions = [ ...emulatedAI, ...suggestions ];
      return res.json({ 
        success: true, 
        message: "Expert analytical ruleset generated suggestions successfully.", 
        suggestions 
      });
    }

    try {
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptContext,
        config: {
          responseMimeType: "application/json",
        }
      });

      const responseText = response.text || "[]";
      let parsedAIResult: Suggestion[] = JSON.parse(responseText.trim());
      
      // Sanitizing ID formats to ensure uniqueness
      parsedAIResult = parsedAIResult.map((val, idx) => ({
        ...val,
        id: `ai_gen_${Date.now()}_${idx}`,
        resolved: false
      }));

      suggestions = [ ...parsedAIResult, ...suggestions ];
      res.json({ success: true, message: "AI analytics successfully reviewed state.", suggestions });
    } catch (err) {
      console.error("AI dynamic analysis error:", err);
      res.status(500).json({ error: "Gemini AI pipeline failed to parse state recommendation. Fallen back on static logic." });
    }
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CAPI Full-Stack Portal serving on port ${PORT}`);
  });
}

startServer();
