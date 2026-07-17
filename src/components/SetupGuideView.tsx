import React, { useState } from 'react';
import { ChevronDown, Copy, Check, CheckCircle2, Circle, Globe, ShoppingBag, Code, Download, RefreshCw, Clock3, KeyRound, PackageCheck, ArrowRight } from 'lucide-react';
import { staticFAQs } from '../lib/mock-data';
import { PluginReleaseInfo } from '../types';

interface SetupGuideViewProps {
  faqExpanded: number | null;
  setFaqExpanded: (idx: number | null) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  setActivePage: (page: string) => void;
  api_key?: string;
  public_key?: string;
  pluginReleaseInfo?: PluginReleaseInfo | null;
}

type TabType = 'wordpress' | 'shopify' | 'custom';
type ReadinessStep = {
  key: string;
  label: string;
  ready: boolean;
  required: boolean;
  actionPage: string;
  actionLabel: string;
  detail?: string;
};
type SetupReadiness = {
  ready: boolean;
  score: number;
  completedRequired: number;
  requiredCount: number;
  steps: ReadinessStep[];
};

export function SetupGuideView({
  faqExpanded,
  setFaqExpanded,
  copiedStates,
  handleCopy,
  setActivePage,
  api_key,
  public_key,
  pluginReleaseInfo
}: SetupGuideViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('wordpress');
  const [readiness, setReadiness] = useState<SetupReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);

  const loadReadiness = React.useCallback(async () => {
    setReadinessLoading(true);
    try {
      const response = await fetch('/api/setup/readiness');
      if (response.ok) {
        setReadiness(await response.json());
      }
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  React.useEffect(() => {
    const handleSectionJump = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId: string; sectionId: string }>).detail;
      if (detail?.pageId !== 'setup-guide') return;
      const targetTab = detail.sectionId === 'setup-shopify' ? 'shopify' : detail.sectionId === 'setup-custom' ? 'custom' : 'wordpress';
      setActiveTab(targetTab);
      window.requestAnimationFrame(() => {
        document.getElementById(detail.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  const openPortalSection = (pageId: string, sectionId?: string) => {
    setActivePage(pageId);
    if (!sectionId) return;
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('buykori:page-section', {
        detail: { pageId, sectionId }
      }));
    }, 50);
  };
  
  const apiToken = api_key?.trim() || '';
  const publicToken = public_key?.trim() || '';
  const hasPublicToken = publicToken.length > 0;

  const resolveApiOrigin = () => {
    const { protocol, hostname, origin } = window.location;
    if (hostname === 'client.buykori.app' || hostname === 'buykori.app' || hostname === 'www.buykori.app') {
      return 'https://api.buykori.app';
    }
    if (hostname.startsWith('client.')) {
      return `${protocol}//${hostname.replace(/^client\./, 'api.')}`;
    }
    return origin;
  };

  const apiDomain = resolveApiOrigin();
  const gatewayUrl = `${apiDomain}/api/v1`;
  const collectUrl = `${apiDomain}/c`;
  const pluginDownloadUrl = `${gatewayUrl}/plugin/download`;
  const packageSizeKb = pluginReleaseInfo?.package_size ? Math.round(pluginReleaseInfo.package_size / 1024) : 0;

  // Shopify Custom Pixel Script Template
  const shopifyPixelCode = `// Buykori AdSync Custom Pixel Tracking Code
// Place this code in Shopify Settings > Customer Events > Custom Pixels

const API_KEY = "${publicToken || 'YOUR_PUBLIC_TRACKER_KEY'}";
const API_URL = "${collectUrl}";

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
          client_user_agent: event.context.navigator.userAgent
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
  const customScriptTag = `<script>
    !function(b,k,o,r,i,s,y){if(b.capi)return;s=b.capi=function(){s.callMethod?
    s.callMethod.apply(s,arguments):s.q.push(arguments)};s.q=[];
    y=k.createElement(o);y.async=!0;y.src=r;
    var t=k.getElementsByTagName(o)[0];t.parentNode.insertBefore(y,t)}
    (window,document,'script','${apiDomain}/t.js?key=${publicToken || 'YOUR_PUBLIC_TRACKER_KEY'}');
  </script>`;

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
});

// Fire only after meaningful checkout intent, not on checkout page load.
const checkoutId = crypto.randomUUID();
capi('track', 'InitiateCheckout', {
  value: 1450,
  currency: 'BDT',
  content_ids: ['prod_99'],
  content_type: 'product'
}, { eventId: \`checkout:\${checkoutId}\` });

// Use the exact same eventId for browser Purchase and server Purchase.
capi('track', 'Purchase', {
  value: 1450,
  currency: 'BDT',
  order_id: 'order_78891'
}, { eventId: 'order_78891' });

// Add ?buykori_debug=1 to the page URL to inspect SDK activity.`;

  const customBackendCode = `// Server-to-Server Conversions API (e.g. Node.js / Laravel / Python)
// POST ${gatewayUrl}/events
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
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Is your store ready?</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {readinessLoading ? 'Checking your store...' : readiness?.ready ? 'Your store is ready' : 'Complete the steps below'}
            </h2>
            {readiness && (
              <p className="mt-1 text-xs text-slate-500">{readiness.completedRequired} of {readiness.requiredCount} important steps done - {readiness.score}%</p>
            )}
          </div>
          <button type="button" onClick={loadReadiness} disabled={readinessLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw className={`h-3.5 w-3.5 ${readinessLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {readiness && (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {readiness.steps.map((step) => (
              <div key={step.key} className={`rounded-lg border p-3 ${step.ready ? 'border-emerald-200 bg-emerald-50' : step.required ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="flex items-start gap-2">
                  {step.ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">{step.label}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{step.detail || (step.ready ? 'Ready' : 'Needs your attention')}</p>
                  </div>
                </div>
                {!step.ready && (
                  <button type="button" onClick={() => setActivePage(step.actionPage)} className="mt-3 text-[10px] font-bold text-indigo-600 hover:underline">
                    {step.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">Before you start</p>
            <h2 className="mt-1 text-base font-bold text-slate-900">Keep these four things ready</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Most stores connect in 5-10 minutes. Meta, TikTok, GA4, or courier approval may take longer.</p>
          </div>
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            {[
              { icon: Globe, text: 'Admin access to your store' },
              { icon: KeyRound, text: 'The ID and access token for one ad platform' },
              { icon: PackageCheck, text: 'One product or test order' },
              { icon: Clock3, text: '5-10 minutes for the connection test' }
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700">
                <Icon className="h-4 w-4 shrink-0 text-indigo-500" /> {text}
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Tab Selector */}
      <div className="flex border-b border-slate-200  bg-white  rounded-xl p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab('wordpress')}
          className={`flex items-center justify-center gap-2 flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            activeTab === 'wordpress'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800   hover:bg-slate-50 '
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
              : 'text-slate-500 hover:text-slate-800   hover:bg-slate-50 '
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
              : 'text-slate-500 hover:text-slate-800   hover:bg-slate-50 '
          }`}
        >
          <Code className="w-4 h-4" />
          <span>Custom Website</span>
        </button>
      </div>

      {/* --- WORDPRESS / WOOCOMMERCE SETUP --- */}
      {activeTab === 'wordpress' && (
        <div id="setup-wordpress" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm   animate-fadeIn">
          <div className="mb-6">
            <h2 className="font-bold text-slate-800 text-base uppercase tracking-wider  flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-500" />
              WooCommerce Tracking Setup
            </h2>
            <p className="text-xs text-slate-400  mt-1">Set up tracking on your WordPress site in under 5 minutes.</p>
          </div>

          <div className="space-y-8 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 ">
            
            {/* Step 1: Install Plugin */}
            <div className="flex gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-indigo-100  border-2 border-white  flex items-center justify-center text-xs font-bold text-indigo-700  shadow-sm shrink-0">
                1
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-slate-800 text-sm ">Install the WordPress plugin</h3>
                <p className="text-xs text-slate-500  max-w-3xl leading-relaxed">
                  Download Buykori AdSync. In WordPress, open <b>Plugins &gt; Add New &gt; Upload Plugin</b>. Upload the ZIP file and activate it. You will manage the settings from this portal.
                </p>
                <a
                  href={pluginDownloadUrl}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                    'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                  }`}
                  aria-disabled={false}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Plugin ZIP
                </a>
                {pluginReleaseInfo && (
                  <p className="text-[11px] text-slate-500 ">
                    Latest release v{pluginReleaseInfo.version} / tested up to WordPress {pluginReleaseInfo.tested} / {packageSizeKb} KB
                  </p>
                )}
              </div>
            </div>

            {/* Step 2: Connect Account */}
            <div className="flex gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-indigo-100  border-2 border-white  flex items-center justify-center text-xs font-bold text-indigo-700  shadow-sm shrink-0">
                2
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-slate-800 text-sm ">Connect Buykori Account</h3>
                <p className="text-xs text-slate-500  max-w-3xl leading-relaxed">
                  Open <b>Buykori AdSync</b> in WordPress and click <b>Connect Buykori Account</b>. Log in and approve the website. The plugin will connect automatically.
                </p>
              </div>
            </div>

            {/* Step 3: Configure a destination */}
            <div className="flex gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-indigo-100  border-2 border-white  flex items-center justify-center text-xs font-bold text-indigo-700  shadow-sm shrink-0">
                3
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-slate-800 text-sm ">Connect One Tracking Destination</h3>
                <p className="text-xs text-slate-500  max-w-3xl leading-relaxed">
                  Open <b>Settings &gt; Conversions API</b>. Add the ID and access token for Meta, TikTok, or GA4. Start with one platform and turn it on after the details are saved.
                </p>
                <button
                  onClick={() => openPortalSection('settings', 'settings-platforms')}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/50 rounded text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Open Conversions API Settings
                </button>
              </div>
            </div>

            {/* Step 4: Choose event routes */}
            <div className="flex gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-indigo-100  border-2 border-white  flex items-center justify-center text-xs font-bold text-indigo-700  shadow-sm shrink-0">
                4
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-slate-800 text-sm ">Choose Which Events to Send</h3>
                <p className="text-xs text-slate-500  max-w-3xl leading-relaxed">
                  Turn on only the events you need. A good starting list is PageView, ViewContent, AddToCart, InitiateCheckout, and Purchase. You can add more events later.
                </p>
              </div>
            </div>

            {/* Step 5: Confirm connection */}
            <div className="flex gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-indigo-100  border-2 border-white  flex items-center justify-center text-xs font-bold text-indigo-700  shadow-sm shrink-0">
                5
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-slate-800 text-sm ">Run the WordPress Connection Test</h3>
                <p className="text-xs text-slate-500  max-w-3xl leading-relaxed">
                  Open Buykori AdSync in WordPress and click <b>Run Health Check</b>. If it passes, your website and Buykori are connected.
                </p>
              </div>
            </div>

            {/* Step 6: Verify test delivery */}
            <div className="flex gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-xs font-bold text-indigo-700 shadow-sm shrink-0">
                6
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-bold text-slate-800 text-sm ">Send and Verify a Test Event</h3>
                <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
                  Open Event Tester and send one test event. Then check it in <b>Event Logs</b>. If it fails, check the platform ID and access token.
                </p>
                <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => openPortalSection('campaign-builder', 'campaign-event-tester')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-700 rounded text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Open Event Tester <ArrowRight className="h-3 w-3" />
                </button>
                <button onClick={() => setActivePage('event-logs')} className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded text-xs font-semibold shrink-0 cursor-pointer">
                  Open Event Logs
                </button>
                </div>
              </div>
            </div>

          </div>
          <div className="mt-8 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <h3 className="text-sm font-bold text-emerald-900">Your store is ready when</h3>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800">The WordPress test passes, one ad platform is connected, your needed events are on, and a test event shows as successful in Event Logs. You can set up courier, COD Protection, Telegram alerts, and custom events later.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SHOPIFY SETUP --- */}
      {activeTab === 'shopify' && (
        <div id="setup-shopify" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm   animate-fadeIn space-y-6">
          
          <div>
            <h2 className="font-bold text-slate-800 text-base uppercase tracking-wider  flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-500" />
              Shopify Tracking Setup
            </h2>
            <p className="text-xs text-slate-400  mt-1">Set up Shopify browser events and order webhooks.</p>
          </div>

          {/* Section 1: Customer Pixel */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100  text-xs font-bold text-indigo-700 ">1</span>
              <h3 className="font-bold text-slate-800 text-sm ">Step 1: Install Custom Pixel</h3>
            </div>
            <p className="text-xs text-slate-500  leading-relaxed max-w-4xl">
              Navigate to <b>Shopify Admin &gt; Settings &gt; Customer Events</b>. Click <b>Add custom pixel</b>, give it a name (e.g., <code>Buykori AdSync</code>), and paste the following tracking script inside the editor block:
            </p>
            
            <div className="relative rounded-lg overflow-hidden border border-slate-200 ">
              <div className="bg-slate-50  px-4 py-2 border-b border-slate-200  flex items-center justify-between text-xs text-slate-500">
                <span>Shopify Custom Pixel JavaScript</span>
                <button
                  onClick={() => handleCopy(shopifyPixelCode, 'shopify_px')}
                  className="flex items-center gap-1 hover:text-indigo-600  cursor-pointer"
                >
                  {copiedStates['shopify_px'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedStates['shopify_px'] ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre tabIndex={0} aria-label="Shopify custom pixel JavaScript" className="p-4 bg-slate-50  text-xs font-mono overflow-x-auto max-h-72 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400">
                <code>{shopifyPixelCode}</code>
              </pre>
            </div>
            {!hasPublicToken && (
              <p className="text-xs text-amber-700  max-w-4xl leading-relaxed">
                Public tracker key has not loaded for this account. Refresh the portal before installing the Shopify pixel.
              </p>
            )}
          </div>

          {/* Section 2: Webhooks */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100  text-xs font-bold text-indigo-700 ">2</span>
              <h3 className="font-bold text-slate-800 text-sm ">Step 2: Set Up Shopify Webhooks</h3>
            </div>
            <p className="text-xs text-slate-500  leading-relaxed max-w-4xl">
              To capture <b>Purchase</b> events reliably, send Shopify order creation alerts to Buykori:
            </p>
            
            <div className="bg-slate-50  rounded-xl p-4 border border-slate-200/60  space-y-3 text-xs">
              <ul className="list-disc pl-5 space-y-2 text-slate-600 ">
                <li>Go to <b>Shopify Admin &gt; Settings &gt; Notifications</b>, scroll down to the <b>Webhooks</b> section.</li>
                <li>Click <b>Create webhook</b>.</li>
                <li>Choose Event: <b>Order creation</b> (or <code>orders/create</code>).</li>
                <li>Format: <b>JSON</b>.</li>
                <li>Paste the URL below inside the webhook destination endpoint:</li>
              </ul>
              
              <div className="flex items-center gap-2 bg-slate-100  p-2 border border-slate-200  rounded font-mono text-xs text-slate-800  max-w-xl">
                <code className="truncate">{`${gatewayUrl}/webhook/shopify?key=${apiToken || 'YOUR_API_KEY'}`}</code>
                <button 
                  onClick={() => handleCopy(`${gatewayUrl}/webhook/shopify?key=${apiToken || 'YOUR_API_KEY'}`, 'sh_wh_url')}
                  className="text-slate-400 hover:text-indigo-600 ml-auto shrink-0 cursor-pointer"
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
        <div id="setup-custom" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm   animate-fadeIn space-y-6">
          
          <div>
            <h2 className="font-bold text-slate-800 text-base uppercase tracking-wider  flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-500" />
              Custom Website Tracking Setup
            </h2>
            <p className="text-xs text-slate-400  mt-1">Add Buykori tracking to React, Next.js, Laravel, or any custom website.</p>
          </div>

          {/* Section 1: Client Script */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100  text-xs font-bold text-indigo-700 ">1</span>
              <h3 className="font-bold text-slate-800 text-sm ">1. Add Browser Tracking</h3>
            </div>
            <p className="text-xs text-slate-500  leading-relaxed max-w-4xl">
              Paste the script below inside your website's main layout or <code>&lt;head&gt;</code> block to start tracking page views:
            </p>
            
            <div className="flex items-center gap-2 bg-slate-50  p-2.5 border border-slate-200  rounded font-mono text-xs text-slate-800 ">
              <code className="truncate">{customScriptTag}</code>
              <button 
                onClick={() => hasPublicToken && handleCopy(customScriptTag, 'c_script')}
                disabled={!hasPublicToken}
                className="text-slate-400 hover:text-indigo-600 ml-auto shrink-0 cursor-pointer"
                title="Copy Script Tag"
              >
                {copiedStates['c_script'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            {!hasPublicToken && (
              <p className="text-xs text-amber-700  max-w-4xl leading-relaxed">
                Public tracker key has not loaded for this account. Refresh the portal before copying the browser script.
              </p>
            )}

            <p className="text-xs text-slate-500  leading-relaxed max-w-4xl pt-1">
              To send custom events or identify customers, call the <code>capi()</code> function:
            </p>

            <div className="relative rounded-lg overflow-hidden border border-slate-200 ">
              <div className="bg-slate-50  px-4 py-2 border-b border-slate-200  flex items-center justify-between text-xs text-slate-500">
                <span>Browser Tracking Example</span>
                <button
                  onClick={() => handleCopy(customCapiCode, 'custom_capi')}
                  className="flex items-center gap-1 hover:text-indigo-600  cursor-pointer"
                >
                  {copiedStates['custom_capi'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <pre tabIndex={0} aria-label="Browser tracking JavaScript example" className="p-4 bg-slate-50  text-xs font-mono overflow-x-auto text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400">
                <code>{customCapiCode}</code>
              </pre>
            </div>
          </div>

          {/* Section 2: Backend API */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100  text-xs font-bold text-indigo-700 ">2</span>
              <h3 className="font-bold text-slate-800 text-sm ">2. Send Events From Your Server</h3>
            </div>
            <p className="text-xs text-slate-500  leading-relaxed max-w-4xl">
              Send checkout completions, subscriptions, or leads directly from your server using your API key:
            </p>
            
            <div className="relative rounded-lg overflow-hidden border border-slate-200 ">
              <div className="bg-slate-50  px-4 py-2 border-b border-slate-200  flex items-center justify-between text-xs text-slate-500">
                <span>Server Event Example</span>
                <button
                  onClick={() => handleCopy(customBackendCode, 'custom_backend')}
                  className="flex items-center gap-1 hover:text-indigo-600  cursor-pointer"
                >
                  {copiedStates['custom_backend'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
              <pre tabIndex={0} aria-label="Server event cURL example" className="p-4 bg-slate-50  text-xs font-mono overflow-x-auto text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400">
                <code>{customBackendCode}</code>
              </pre>
            </div>
          </div>

        </div>
      )}

      {/* FAQ Troubleshooting accordion list */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
        <div>
          <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">FAQ & Troubleshooting</h2>
          <p className="text-xs text-slate-400 ">Common questions and solutions</p>
        </div>

        <div className="space-y-3 pt-2">
          {staticFAQs.map((faq, index) => {
            const expanded = faqExpanded === index;
            return (
              <div key={index} className="rounded-lg border border-slate-200  overflow-hidden bg-slate-50/50 ">
                <button
                  onClick={() => setFaqExpanded(expanded ? null : index)}
                  className="w-full text-left px-4 py-3 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700    flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="p-4 border-t border-slate-200  text-xs leading-relaxed text-slate-500  bg-white  max-w-4xl">
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
