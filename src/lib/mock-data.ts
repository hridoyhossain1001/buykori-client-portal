/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CAPIEvent, APILog, Suggestion, UserProfile, ClientConnection, EventRule, Platform } from '../types';

export const initialProfile: UserProfile = {
  name: "Malcolm Abbott",
  email: "malcolmabbotte@gmail.com",
  notificationEmail: "malcolmabbotte@gmail.com",
  plan: "Growth Plan",
  eventsUsed: 12450,
  eventsQuota: 50000,
  growthFeaturesEnabled: true,
  planFeatures: [
    {
      key: "client_alerts",
      label: "Telegram order alerts",
      description: "Purchase and recovery notifications can be sent securely to the store owner by Telegram.",
      included: true,
      minimumPlan: "Growth",
    },
    {
      key: "incomplete_checkout_recovery",
      label: "Incomplete checkout recovery",
      description: "Abandoned checkout leads can be reviewed, contacted, and recovered from the portal.",
      included: true,
      minimumPlan: "Growth",
    },
  ],
  renewalDate: "2026-06-24",
};

export const initialConnection: ClientConnection = {
  token: "",
  wpVersion: "6.4.3",
  lastHeartbeat: "2026-05-24T13:10:12Z",
  status: "Active",
};

export const initialRules: EventRule[] = [
  { eventName: "PageView", metaEnabled: true, tiktokEnabled: true, ga4Enabled: true },
  { eventName: "AddToCart", metaEnabled: true, tiktokEnabled: true, ga4Enabled: true },
  { eventName: "InitiateCheckout", metaEnabled: true, tiktokEnabled: true, ga4Enabled: true },
  { eventName: "Purchase", metaEnabled: true, tiktokEnabled: true, ga4Enabled: true },
  { eventName: "Lead", metaEnabled: true, tiktokEnabled: false, ga4Enabled: true },
  { eventName: "Contact", metaEnabled: false, tiktokEnabled: false, ga4Enabled: true },
];

export const staticFAQs = [
  {
    q: "How does Buykori keep tracking when ad blockers are active?",
    a: "Buykori sends important store events from your WordPress server instead of relying only on browser scripts. This helps Meta, TikTok, and Google receive purchase data even when a visitor uses an ad blocker."
  },
  {
    q: "Why are my events showing as 'Retrying' or 'Failed'?",
    a: "This usually means a platform key, pixel ID, or account setting needs attention. Open the event details, check the platform response, then update the matching settings if needed."
  },
  {
    q: "How does Buykori prevent double-counted events?",
    a: "Buykori sends the same event name and event ID through both browser and server tracking. Ad platforms use that match to count one real customer action instead of two."
  },
  {
    q: "What does match quality mean?",
    a: "Match quality shows how well an ad platform can connect an event to the right customer. Email, phone, browser, and location signals can improve reporting and ad optimization."
  }
];

export const initialSuggestions: Suggestion[] = [
  {
    id: "s_01",
    title: "Purchase value is missing",
    severity: "Critical",
    explanation: "Some purchase events are missing the order value or currency. Without this, Meta cannot measure sales value accurately.",
    fixAction: "Check Event Logs for the affected Purchase events. If value or currency is still missing, verify WooCommerce order totals and contact Buykori support with one failed event key.",
    resolved: false,
    platform: "Meta CAPI"
  },
  {
    id: "s_02",
    title: "GA4 events need attention",
    severity: "Warning",
    explanation: "Some GA4 events are being rejected. This usually happens when the Measurement ID or API Secret is incorrect.",
    fixAction: "Create or copy a fresh GA4 API Secret from Google Analytics and add it in Settings.",
    resolved: false,
    platform: "GA4"
  },
  {
    id: "s_03",
    title: "Add to Cart events may be counted twice",
    severity: "Critical",
    explanation: "Some Add to Cart events do not have a matching event ID. This can make Meta count the same cart action twice.",
    fixAction: "Open Event Logs and compare the browser/server event keys for AddToCart. If duplicate keys are missing, run Test WordPress Connection and keep the plugin updated.",
    resolved: false,
    platform: "Meta CAPI"
  },
  {
    id: "s_04",
    title: "TikTok match quality can improve",
    severity: "Tip",
    explanation: "TikTok is receiving events, but some customer match details are missing. Adding more customer signals can improve reporting.",
    fixAction: "Make sure checkout forms collect phone or email, then check Settings > Conversions API to confirm TikTok credentials and routing are enabled.",
    resolved: false,
    platform: "TikTok Events API"
  }
];

// Seed realistic tracking history (last 30 days) to populate dashboards
export function generateEventData(): CAPIEvent[] {
  const events: CAPIEvent[] = [];
  const names = ['PageView', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Lead', 'Contact'];
  const platforms: Platform[] = ['Meta CAPI', 'TikTok Events API', 'GA4'];
  const now = new Date();

  // Create ~120 realistic events over the past 30 days
  for (let i = 0; i < 150; i++) {
    const ageInHours = i * 4.8; // stagger events
    const date = new Date(now.getTime() - ageInHours * 60 * 60 * 1000);
    const platform = platforms[i % platforms.length];
    const name = names[Math.floor((i * 1.7) % names.length)];
    const id = `evt_${100000 + i}`;
    const dedupeKey = `did_${800000 + i}`;
    
    // Status bias: mostly success, occasional failure or retry
    let status: 'Success' | 'Failed' | 'Retry' = 'Success';
    let httpCode = 200;
    if (i % 23 === 0) {
      status = 'Failed';
      httpCode = 400;
    } else if (i % 37 === 0) {
      status = 'Retry';
      httpCode = 503;
    }

    const value = (120 - (i % 12) * 8).toFixed(2);
    const currency = 'USD';
    const emailHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // SHA256 hashed

    const payload = {
      event_name: name,
      event_time: Math.floor(date.getTime() / 1000),
      event_id: dedupeKey,
      user_data: {
        client_ip_address: `192.168.1.${10 + (i % 50)}`,
        client_user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        em: name === 'Purchase' || name === 'Lead' ? [emailHash] : undefined,
      },
      custom_data: name === 'Purchase' ? {
        value: value,
        currency: currency,
        content_type: "product",
        contents: [
          { id: `prod_${i % 10}`, quantity: 1, item_price: parseFloat(value) }
        ]
      } : undefined,
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${platform === 'Meta CAPI' ? 'fb_cap_key_***' : platform === 'TikTok Events API' ? 'tt_evt_key_***' : 'ga_mp_sec_***'}`,
      'X-Client-IP': `192.168.1.${10 + (i % 50)}`,
      'User-Agent': 'WordPress/6.4.3; WooCommerce/8.5.2',
    };

    const responseBody = status === 'Success' 
      ? { events_received: 1, status: "accepted", fb_trace_id: `FBT_${Math.random().toString(36).substring(7).toUpperCase()}` }
      : status === 'Retry'
        ? { error: { message: "Server overloaded", code: 503 } }
        : { error: { message: "Invalid conversion details: value missing on purchase event", code: 400, type: "OAuthException" } };

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
      latencyMs: 75 + (i % 200),
    });
  }

  return events;
}

export function generateAPILogs(events: CAPIEvent[]): APILog[] {
  return events.map(evt => {
    const urls: Record<CAPIEvent['platform'], string> = {
      'Meta CAPI': 'https://graph.facebook.com/v18.0/pixel_id/events',
      'TikTok Events API': 'https://open-api.tiktok.com/v1.3/pixel/track',
      'GA4': 'https://www.google-analytics.com/mp/collect?api_secret=sec_key&measurement_id=id',
      'TikTok Browser Pixel': 'Browser pixel',
      'Gateway Ingest': '/api/events',
    };

    return {
      id: `api_${evt.id.split('_')[1]}`,
      timestamp: evt.timestamp,
      platform: evt.platform,
      endpoint: urls[evt.platform],
      method: 'POST',
      statusCode: evt.httpCode,
      latencyMs: evt.latencyMs,
      retryCount: evt.status === 'Retry' ? 1 : evt.status === 'Failed' ? 2 : 0,
      requestBody: JSON.stringify(evt.payload, null, 2),
      responseBody: JSON.stringify(evt.responseBody, null, 2)
    };
  });
}
