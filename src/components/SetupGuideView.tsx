import React, { useState } from 'react';
import { ChevronDown, Copy, Check, Globe, ShoppingBag, Code, Terminal, Layers } from 'lucide-react';
import { staticFAQs } from '../lib/mock-data';

interface SetupGuideViewProps {
  faqExpanded: number | null;
  setFaqExpanded: (idx: number | null) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  setActivePage: (page: string) => void;
  api_key?: string;
}

type TabType = 'wordpress' | 'shopify' | 'custom';

export function SetupGuideView({
  faqExpanded,
  setFaqExpanded,
  copiedStates,
  handleCopy,
  setActivePage,
  api_key
}: SetupGuideViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('wordpress');
  
  const apiToken = api_key?.trim() || '';
  const hasApiToken = apiToken.length > 0;
  const apiDomain = window.location.origin;

  // Shopify Custom Pixel Script Template
  const shopifyPixelCode = `// Buykori AdSync Custom Pixel Tracking Code
// Place this code in Shopify Settings > Customer Events > Custom Pixels

const API_KEY = "${apiToken || 'YOUR_API_KEY'}";
const API_URL = "${apiDomain}/api/v1/c";

// Helper to generate a unique event ID for deduplication
function generateEventId() {
  return 'sh_' + Date.now() + '_' + Math.floor(Math.random() * 1000000);
}

// Subscribe to PageView
analytics.subscribe("page_viewed", (event) => {
  const eventId = generateEventId();
  fetch(API_URL + "?key=" + API_KEY, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [{
        event_name: "PageView",
        event_time: Math.floor(event.timestamp / 1000),
        event_id: eventId,
        event_source_url: event.context.document.location.href,
        action_source: "website",
        user_data: {
          client_user_agent: event.context.navigator.userAgent,
          client_ip_address: "8.8.8.8" // Server will enrich with real client IP
        }
      }]
    })
  }).catch(() => {});
});

// Subscribe to AddToCart
analytics.subscribe("product_added_to_cart", (event) => {
  const eventId = generateEventId();
  const cartLine = event.data?.cartLine;
  const merchandise = cartLine?.merchandise;
  
  fetch(API_URL + "?key=" + API_KEY, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [{
        event_name: "AddToCart",
        event_time: Math.floor(event.timestamp / 1000),
        event_id: eventId,
        event_source_url: event.context.document.location.href,
        action_source: "website",
        custom_data: {
          value: cartLine?.cost?.totalAmount?.amount ? Number(cartLine.cost.totalAmount.amount) : 0,
          currency: cartLine?.cost?.totalAmount?.currencyCode || "BDT",
          content_ids: merchandise?.id ? [String(merchandise.id)] : [],
          content_type: "product",
          num_items: cartLine?.quantity || 1
        },
        user_data: {
          client_user_agent: event.context.navigator.userAgent
        }
      }]
    })
  }).catch(() => {});
});

// Subscribe to Checkout Started
analytics.subscribe("checkout_started", (event) => {
  const eventId = generateEventId();
  const checkout = event.data?.checkout;
  
  fetch(API_URL + "?key=" + API_KEY, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [{
        event_name: "InitiateCheckout",
        event_time: Math.floor(event.timestamp / 1000),
        event_id: eventId,
        event_source_url: event.context.document.location.href,
        action_source: "website",
        custom_data: {
          value: checkout?.totalPrice?.amount ? Number(checkout.totalPrice.amount) : 0,
          currency: checkout?.totalPrice?.currencyCode || "BDT",
          content_ids: checkout?.lineItems?.map(item => String(item.variant?.id || '')) || [],
          content_type: "product"
        },
        user_data: {
          client_user_agent: event.context.navigator.userAgent,
          em: checkout?.email ? [checkout.email] : undefined,
          ph: checkout?.phone ? [checkout.phone] : undefined
        }
      }]
    })
  }).catch(() => {});
});`;

  // Custom Coded Website JS SDK
  const customScriptTag = `<script src="${apiDomain}/api/v1/t.js?key=${apiToken || 'YOUR_PUBLIC_KEY'}" defer></script>`;

  const customCapiCode = `// 1. Identify User (before firing events, e.g. on checkout, login, or registration)
capi('setUser', {
  email: 'customer@domain.com', // Will be hashed automatically using SHA-256 inside browser
  phone: '8801700000000',
  first_name: 'Hridoy',
  last_name: 'Hossain'
});

// 2. Track Standard Event
capi('track', 'AddToCart', {
  value: 1450,
  currency: 'BDT',
  content_ids: ['prod_99'],
  content_type: 'product'
});`;

  const customBackendCode = `// Server-to-Server Conversions API (e.g. Node.js / Laravel / Python)
// POST ${apiDomain}/api/v1/events
// Header: X-API-Key: ${apiToken || 'YOUR_API_KEY'}
// Header: Content-Type: application/json

{
  "data": [
    {
      "event_name": "Purchase",
      "event_time": 1716912000,
      "event_id": "order_78891", // Used for deduplication
      "event_source_url": "https://yoursite.com/checkout/thank-you",
      "action_source": "website",
      "user_data": {
        "client_ip_address": "103.112.56.2",
        "client_user_agent": "Mozilla/5.0...",
        "em": ["f660ab912e..."], // SHA-256 Hashed Email
        "ph": ["88017000..."]    // SHA-256 Hashed Phone
      },
      "custom_data": {
        "value": 1500.0,
        "currency": "BDT",
        "order_id": "78891",
        "content_type": "product",
        "contents": [
          { "id": "prod_99", "quantity": 1, "item_price": 1500.0 }
        ]
      }
    }
  ]
}`;

  return (
    <div className="space-y-6">
      
      {/* Tab Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab('wordpress')}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'wordpress'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>WordPress / WooCommerce</span>
        </button>
        <button
          onClick={() => setActiveTab('shopify')}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'shopify'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Shopify Store</span>
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'custom'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-850'
          }`}
        >
          <Code className="w-4 h-4" />
          <span>Custom Website</span>
        </button>
      </div>

      {/* --- WORDPRESS / WOOCOMMERCE SETUP --- */}
      {activeTab === 'wordpress' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 animate-fadeIn">
          <div className="mb-6">
            <h2 className="font-bold text-slate-800 text-base uppercase tracking-wider dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" />
              WooCommerce Conversions API Integration Setup
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Deploy Conversions tracking client nodes inside your self-hosted WordPress panel in under 5 minutes.</p>
          </div>

          <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
            
            {/* Step 1: Install Plugin */}
            <div className="flex gap-4 relative">
              <div className="w-8.5 h-8.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 shadow-sm shrink-0">
                1
              </div>
              <div className="space-y-2 flex-1">
                <h4 className="font-bold text-slate-800 text-sm dark:text-white">Download and Install WordPress Helper Plugin</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
                  Navigate to your WordPress dashboard. Click <b>Plugins &gt; Add New</b>, and search for the <b>"Buykori AdSync"</b> plugin. Upload and activate it.
                </p>
              </div>
            </div>

            {/* Step 2: Paste Access Token */}
            <div className="flex gap-4 relative">
              <div className="w-8.5 h-8.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 shadow-sm shrink-0">
                2
              </div>
              <div className="space-y-2 flex-1">
                <h4 className="font-bold text-slate-800 text-sm dark:text-white">Synchronize API Access Token</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
                  Copy your unique API Key below and paste it in the <b>Buykori AdSync</b> settings page inside your WordPress panel.
                </p>
                <div className="flex items-center gap-2 bg-slate-55/50 dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800 rounded font-mono text-xs text-slate-800 dark:text-slate-300 max-w-md">
                  <code className="truncate">{hasApiToken ? apiToken : 'Setup token unavailable'}</code>
                  <button 
                    onClick={() => hasApiToken && handleCopy(apiToken, 'c_g_tkn')}
                    disabled={!hasApiToken}
                    className="text-slate-400 hover:text-indigo-600 ml-auto shrink-0 cursor-pointer disabled:opacity-40"
                    title="Copy API Key"
                  >
                    {copiedStates['c_g_tkn'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3: Configure Gateway URL */}
            <div className="flex gap-4 relative">
              <div className="w-8.5 h-8.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 shadow-sm shrink-0">
                3
              </div>
              <div className="space-y-2 flex-1">
                <h4 className="font-bold text-slate-800 text-sm dark:text-white">Set AdSync Gateway URL</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
                  Provide the API Gateway URL in your WordPress plugin settings to establish a pipeline connection:
                </p>
                <div className="flex items-center gap-2 bg-slate-55/50 dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800 rounded font-mono text-xs text-slate-800 dark:text-slate-300 max-w-md">
                  <code className="truncate">{apiDomain + "/api/v1"}</code>
                  <button 
                    onClick={() => handleCopy(apiDomain + "/api/v1", 'c_g_url')}
                    className="text-slate-400 hover:text-indigo-600 ml-auto shrink-0 cursor-pointer"
                    title="Copy Gateway URL"
                  >
                    {copiedStates['c_g_url'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 4: Verify test trigger */}
            <div className="flex gap-4 relative">
              <div className="w-8.5 h-8.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 border-2 border-white dark:border-slate-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-400 shadow-sm shrink-0">
                4
              </div>
              <div className="space-y-2 flex-1">
                <h4 className="font-bold text-slate-800 text-sm dark:text-white">Verify sandbox test telemetry trace</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-3xl leading-relaxed">
                  Use our campaign test console to fire test telemetry packets and check the event logs.
                </p>
                <button 
                  onClick={() => setActivePage('campaign-builder')}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/50 rounded text-xs font-semibold shrink-0 cursor-pointer dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/60 dark:hover:bg-indigo-900/30"
                >
                  Go to Campaign Sandbox
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- SHOPIFY SETUP --- */}
      {activeTab === 'shopify' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 animate-fadeIn space-y-6">
          
          <div>
            <h2 className="font-bold text-slate-800 text-base uppercase tracking-wider dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-500" />
              Shopify Server-Side Tracking Configuration
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Implement hybrid tracking for Shopify using Customer Events Pixels and Server Webhooks.</p>
          </div>

          {/* Section 1: Customer Pixel */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-400">1</span>
              <h3 className="font-bold text-slate-800 text-sm dark:text-white">Step 1: Install Custom Pixel (Client-Side Events)</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-4xl">
              Navigate to <b>Shopify Admin &gt; Settings &gt; Customer Events</b>. Click <b>Add custom pixel</b>, give it a name (e.g., <code>Buykori AdSync</code>), and paste the following tracking script inside the editor block:
            </p>
            
            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="bg-slate-55 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Shopify Custom Pixel JavaScript</span>
                <button
                  onClick={() => handleCopy(shopifyPixelCode, 'shopify_px')}
                  className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                >
                  {copiedStates['shopify_px'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedStates['shopify_px'] ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-50 dark:bg-slate-950/40 text-xs font-mono overflow-x-auto max-h-72 text-slate-700 dark:text-slate-350">
                <code>{shopifyPixelCode}</code>
              </pre>
            </div>
          </div>

          {/* Section 2: Webhooks */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-400">2</span>
              <h3 className="font-bold text-slate-800 text-sm dark:text-white">Step 2: Setup Shopify Webhooks (Server-Side Purchases)</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-4xl">
              To reliably capture <b>Purchase</b> events bypass-ready even when ad-blockers are active, route Shopify order creation alerts straight to our server webhooks:
            </p>
            
            <div className="bg-slate-50 dark:bg-slate-950/20 rounded-xl p-4 border border-slate-200/60 dark:border-slate-800 space-y-3 text-xs">
              <ul className="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-400">
                <li>Go to <b>Shopify Admin &gt; Settings &gt; Notifications</b>, scroll down to the <b>Webhooks</b> section.</li>
                <li>Click <b>Create webhook</b>.</li>
                <li>Choose Event: <b>Order creation</b> (or <code>orders/create</code>).</li>
                <li>Format: <b>JSON</b>.</li>
                <li>Paste the URL below inside the webhook destination endpoint:</li>
              </ul>
              
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-950 p-2 border border-slate-250 dark:border-slate-800 rounded font-mono text-xs text-slate-800 dark:text-slate-300 max-w-xl">
                <code className="truncate">{apiDomain + "/api/v1/webhook/shopify"}</code>
                <button 
                  onClick={() => handleCopy(apiDomain + "/api/v1/webhook/shopify", 'sh_wh_url')}
                  className="text-slate-455 hover:text-indigo-600 ml-auto shrink-0 cursor-pointer"
                  title="Copy Shopify Webhook URL"
                >
                  {copiedStates['sh_wh_url'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* --- CUSTOM CODE SETUP --- */}
      {activeTab === 'custom' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800 animate-fadeIn space-y-6">
          
          <div>
            <h2 className="font-bold text-slate-800 text-base uppercase tracking-wider dark:text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-500" />
              Custom Website Tracking Integration Guide
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Integrate our server-side tracking stack directly into your React, Next.js, Laravel, or custom-coded application.</p>
          </div>

          {/* Section 1: Client Script */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-400">1</span>
              <h3 className="font-bold text-slate-800 text-sm dark:text-white">1. Add Client-Side Tracker (Browser Pixel)</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-4xl">
              Paste the script tag below inside your website's main layout or template <code>&lt;head&gt;</code> block to automatically record PageViews and initialize tracking features:
            </p>
            
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 border border-slate-200 dark:border-slate-800 rounded font-mono text-xs text-slate-800 dark:text-slate-300">
              <code className="truncate">{customScriptTag}</code>
              <button 
                onClick={() => handleCopy(customScriptTag, 'c_script')}
                className="text-slate-400 hover:text-indigo-600 ml-auto shrink-0 cursor-pointer"
                title="Copy Script Tag"
              >
                {copiedStates['c_script'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-4xl pt-1">
              To trigger custom events or identify users (which automatically hashes PII using secure browser crypto APIs before sending), call the <code>capi()</code> function:
            </p>

            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="bg-slate-55 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Frontend JavaScript API Usage</span>
                <button
                  onClick={() => handleCopy(customCapiCode, 'custom_capi')}
                  className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                >
                  {copiedStates['custom_capi'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-50 dark:bg-slate-950/40 text-xs font-mono overflow-x-auto text-slate-700 dark:text-slate-350">
                <code>{customCapiCode}</code>
              </pre>
            </div>
          </div>

          {/* Section 2: Backend API */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-xs font-bold text-indigo-700 dark:text-indigo-400">2</span>
              <h3 className="font-bold text-slate-800 text-sm dark:text-white">2. Send Server-to-Server Events (Backend CAPI)</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-4xl">
              Route checkout completions, subscriptions, or leads directly from your server. Make a secure POST request to the events endpoint using your server API key:
            </p>
            
            <div className="relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="bg-slate-55 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>REST API Event Payload (JSON)</span>
                <button
                  onClick={() => handleCopy(customBackendCode, 'custom_backend')}
                  className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                >
                  {copiedStates['custom_backend'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <pre className="p-4 bg-slate-50 dark:bg-slate-950/40 text-xs font-mono overflow-x-auto text-slate-700 dark:text-slate-350">
                <code>{customBackendCode}</code>
              </pre>
            </div>
          </div>

        </div>
      )}

      {/* FAQ Troubleshooting accordion list */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Deployment FAQ & Troubleshooting</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">Technical answers for server tracking mechanics and deduplication pipelines</p>
        </div>

        <div className="space-y-3 pt-2">
          {staticFAQs.map((faq, index) => {
            const expanded = faqExpanded === index;
            return (
              <div key={index} className="rounded-lg border border-slate-150 dark:border-slate-800 overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
                <button
                  onClick={() => setFaqExpanded(expanded ? null : index)}
                  className="w-full text-left px-4 py-3 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 dark:text-slate-300 dark:bg-slate-900 dark:hover:bg-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="p-4 border-t border-slate-150 dark:border-slate-800 text-xs leading-relaxed text-slate-550 dark:text-slate-400 bg-white dark:bg-slate-900 max-w-4xl">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
