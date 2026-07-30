import React, { useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Download,
  Globe2,
  KeyRound,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserRound,
  Zap,
} from 'lucide-react';
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

type SetupInstruction = {
  title: string;
  description: React.ReactNode;
  action?: 'download' | 'settings' | 'health' | 'events';
};

const setupSteps: SetupInstruction[] = [
  {
    title: 'Install the WordPress plugin',
    description: (
      <>
        Download Buykori AdSync, then in WordPress open <b>Plugins → Add New → Upload Plugin</b>. Upload the ZIP and activate it. You can manage the settings from this portal.
      </>
    ),
    action: 'download',
  },
  {
    title: 'Connect your Buykori account',
    description: (
      <>
        Open Buykori AdSync inside WordPress and click <b>Connect Buykori Account</b>. Log in, approve the website, and the plugin links itself automatically.
      </>
    ),
  },
  {
    title: 'Connect one tracking destination',
    description: (
      <>
        In <b>Settings → Conversions API</b>, add the ID and access token for Meta, TikTok or GA4. Start with one platform—you can turn on the rest later.
      </>
    ),
    action: 'settings',
  },
  {
    title: 'Choose Which Events to Send',
    description: (
      <>
        Turn on only the events you need. A good starting list: <b>PageView, ViewContent, AddToCart, InitiateCheckout, Purchase.</b>
      </>
    ),
  },
  {
    title: 'Run the WordPress connection test',
    description: (
      <>
        Open Buykori AdSync in WordPress and click <b>Run Health Check</b>. A pass means your website and Buykori are talking to each other.
      </>
    ),
    action: 'health',
  },
  {
    title: 'Send & verify a test event',
    description: (
      <>
        Send one test event, then confirm it in <b>Event Logs</b>. If it fails, re-check the platform ID and access token from step 3.
      </>
    ),
    action: 'events',
  },
];

export function SetupGuideView({
  faqExpanded,
  setFaqExpanded,
  setActivePage,
  pluginReleaseInfo,
}: SetupGuideViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('wordpress');
  const [readiness, setReadiness] = useState<SetupReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);

  const loadReadiness = React.useCallback(async () => {
    setReadinessLoading(true);
    try {
      const response = await fetch('/api/setup/readiness');
      if (response.ok) setReadiness(await response.json());
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
      setActiveTab(detail.sectionId === 'setup-shopify' ? 'shopify' : detail.sectionId === 'setup-custom' ? 'custom' : 'wordpress');
    };
    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  const openPortalSection = (pageId: string, sectionId?: string) => {
    setActivePage(pageId);
    if (!sectionId) return;
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('buykori:page-section', { detail: { pageId, sectionId } }));
    }, 50);
  };

  const apiOrigin = window.location.hostname === 'client.buykori.app'
    ? 'https://api.buykori.app'
    : window.location.origin;
  const pluginDownloadUrl = `${apiOrigin}/api/v1/plugin/download`;
  const packageSizeKb = pluginReleaseInfo?.package_size ? Math.round(pluginReleaseInfo.package_size / 1024) : 0;
  const completed = readiness?.completedRequired ?? 0;
  const required = readiness?.requiredCount ?? 4;
  const score = readiness?.score ?? 0;
  const allReady = readiness?.ready ?? false;
  const setupCompleted = allReady ? 6 : Math.min(completed, 5);

  const findStep = (...needles: string[]) =>
    readiness?.steps.find((step) => needles.some((needle) => `${step.key} ${step.label}`.toLowerCase().includes(needle)));

  const domainStep = findStep('domain', 'store');
  const heartbeatStep = findStep('heartbeat', 'plugin');
  const destinationsStep = findStep('destination', 'platform');
  const deliveryStep = findStep('deliver', 'event');

  const summaryCards = [
    {
      label: 'Store domain',
      value: domainStep?.ready ? 'Ready' : 'Needs setup',
      detail: domainStep?.detail || 'Your connected store',
      icon: Globe2,
      ready: Boolean(domainStep?.ready),
    },
    {
      label: 'Plugin heartbeat',
      value: heartbeatStep?.ready ? 'Connected' : 'Waiting',
      detail: heartbeatStep?.detail || 'Waiting for WordPress',
      icon: Zap,
      ready: Boolean(heartbeatStep?.ready),
    },
    {
      label: 'Tracking destinations',
      value: destinationsStep?.ready ? 'Connected' : 'Not connected',
      detail: destinationsStep?.detail || 'Meta · TikTok · GA4',
      icon: Send,
      ready: Boolean(destinationsStep?.ready),
    },
    {
      label: 'Test deliveries',
      value: deliveryStep?.ready ? 'Successful' : 'Not verified',
      detail: deliveryStep?.detail || 'Send a test event',
      icon: Check,
      ready: Boolean(deliveryStep?.ready),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Setup Guide</h1>
        <p className="mt-1 text-sm text-slate-500">Connect your store to Buykori in 5–10 minutes — your progress is tracked automatically.</p>
      </header>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${allReady ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
              {allReady ? <Check className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {readinessLoading ? 'Checking your store…' : allReady ? 'Your store is ready' : 'Finish your store setup'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {allReady ? 'All required steps are complete — events are flowing to your ad platforms.' : 'Complete the required steps below to start sending reliable events.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadReadiness}
            disabled={readinessLoading}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${readinessLoading ? 'animate-spin' : ''}`} />
            Refresh status
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
            <span>{completed} of {required} required steps</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
            </div>
            <span className="text-emerald-700">{score}%</span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map(({ label, value, detail, icon: Icon, ready }) => (
              <div key={label} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ready ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-3 text-base font-bold text-slate-900">{value}</p>
                <p className="mt-1 truncate text-xs text-slate-400" title={detail}>{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 sm:flex-row sm:items-center">
            <span className="font-bold">Optional:</span>
            <span>courier credentials are only needed for manual courier booking — tracking works without them.</span>
            <button type="button" onClick={() => openPortalSection('settings', 'settings-courier')} className="font-bold text-indigo-600 hover:underline sm:ml-1">
              Configure courier
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Settings2 className="h-5 w-5" /></span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Before you start</h2>
            <p className="mt-1 text-xs text-slate-500">Keep these four things ready — most stores connect in 5–10 minutes.</p>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: UserRound, text: 'Admin access to your WordPress store' },
            { icon: KeyRound, text: 'ID & access token for one ad platform' },
            { icon: ShoppingCart, text: 'One product or a test order' },
            { icon: Clock3, text: '5–10 minutes for the connection test' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex min-h-14 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3">
              <Icon className="h-4 w-4 shrink-0 text-indigo-500" />
              <span className="text-xs font-medium leading-relaxed text-slate-600">{text}</span>
            </div>
          ))}
        </div>
      </section>

      <div role="tablist" aria-label="Setup platform" className="inline-flex max-w-full gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'wordpress'}
          onClick={() => setActiveTab('wordpress')}
          className={`min-h-10 rounded-lg px-4 text-xs font-bold ${activeTab === 'wordpress' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          WordPress / WooCommerce
        </button>
        {(['shopify', 'custom'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`flex min-h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold ${activeTab === tab ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {tab === 'shopify' ? 'Shopify Store' : 'Custom Website'}
            <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>Coming soon</span>
          </button>
        ))}
      </div>

      {activeTab === 'wordpress' ? (
        <section id="setup-wordpress" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Zap className="h-5 w-5" /></span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">WooCommerce tracking setup</h2>
                <p className="mt-1 text-xs text-slate-500">Six steps — each one is checked off automatically as your store completes it.</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              {setupCompleted} of 6 complete
            </span>
          </div>

          <div className="px-5">
            {setupSteps.map((step, index) => {
              const isDone = allReady || index < completed;
              return (
                <div key={step.title} className="flex gap-3 border-b border-dashed border-slate-200 py-5 last:border-0">
                  <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${isDone ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-400'}`}>
                    {isDone ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-800">{step.title}</h3>
                      {isDone && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Done</span>}
                    </div>
                    <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-500">{step.description}</p>
                    {step.action === 'download' && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <a href={pluginDownloadUrl} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700">
                          <Download className="h-3.5 w-3.5" /> Download plugin ZIP
                        </a>
                        {pluginReleaseInfo && (
                          <span className="text-[11px] text-slate-400">
                            v{pluginReleaseInfo.version} · WordPress {pluginReleaseInfo.tested}+ · {packageSizeKb} KB
                          </span>
                        )}
                      </div>
                    )}
                    {step.action === 'settings' && (
                      <button type="button" onClick={() => openPortalSection('settings', 'settings-platforms')} className="mt-3 min-h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">
                        Open Conversions API Settings
                      </button>
                    )}
                    {step.action === 'health' && (
                      <button type="button" onClick={loadReadiness} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">
                        <RefreshCw className="h-3.5 w-3.5" /> Run health check
                      </button>
                    )}
                    {step.action === 'events' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => openPortalSection('campaign-builder', 'campaign-event-tester')} className="min-h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">
                          Open Event Tester
                        </button>
                        <button type="button" onClick={() => setActivePage('event-logs')} className="min-h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 hover:bg-slate-50">
                          Open Event Logs
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section id={activeTab === 'shopify' ? 'setup-shopify' : 'setup-custom'} className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><Clock3 className="h-5 w-5" /></span>
          <h2 className="mt-4 text-base font-bold text-slate-900">{activeTab === 'shopify' ? 'Shopify setup' : 'Custom website setup'} is coming soon</h2>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-500">We’ll enable this guide after the tracking flow passes production testing.</p>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><ArrowUpRight className="h-5 w-5" /></span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">What’s next</h2>
            <p className="mt-1 text-xs text-slate-500">Setup is done — these optional features help you get more from Buykori.</p>
          </div>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-3">
          {[
            { title: 'Courier logistics', text: 'Add courier keys to book shipments in one click and get delivery updates.', icon: Truck, page: 'orders' },
            { title: 'COD Protection', text: 'Hold the Purchase event until you confirm each cash-on-delivery order.', icon: ShieldCheck, page: 'pending-purchases' },
            { title: 'Telegram alerts', text: 'Get instant order and incomplete-checkout alerts straight to your phone.', icon: Send, page: 'settings' },
          ].map(({ title, text, icon: Icon, page }) => (
            <button key={title} type="button" onClick={() => setActivePage(page)} className="rounded-xl border border-slate-200 p-4 text-left hover:border-indigo-200 hover:bg-indigo-50/30">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Icon className="h-4 w-4 text-indigo-500" /> {title}</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{text}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><BookOpen className="h-5 w-5" /></span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">FAQ & troubleshooting</h2>
            <p className="mt-1 text-xs text-slate-500">Common questions and solutions.</p>
          </div>
        </div>
        <div>
          {staticFAQs.map((faq, index) => {
            const expanded = faqExpanded === index;
            return (
              <div key={faq.q} className="border-b border-slate-200 last:border-0">
                <button
                  type="button"
                  onClick={() => setFaqExpanded(expanded ? null : index)}
                  className="flex min-h-12 w-full items-center justify-between gap-4 px-5 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && <div className="border-t border-slate-100 px-5 py-4 text-xs leading-relaxed text-slate-500">{faq.a}</div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
