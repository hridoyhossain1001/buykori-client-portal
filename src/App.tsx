/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle,
  Loader2
} from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { CreateStoreModal } from './components/CreateStoreModal';
import { Header } from './components/Header';
import { PluginConnectAuthorizeView } from './components/PluginConnectAuthorizeView';
import { ProductGuide } from './components/ProductGuide';
import { SupportWidget } from './components/SupportWidget';
import { CAPIEvent, APILog, Suggestion, Platform, EventRule, PlatformConfig, UserProfile, ClientConnection, OutboxItem, PluginReleaseInfo, CustomEventAutomation } from './types';
import { clientPathForPage, clientPathForSection, isClientPageId, resolveClientRoute } from './lib/clientRoutes';

const lazyWithReload = <T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>
) => lazy(() => loader().catch((error) => {
  const chunkFailed = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(String(error?.message || error));
  if (chunkFailed && sessionStorage.getItem('buykori_chunk_reload') !== '1') {
    sessionStorage.setItem('buykori_chunk_reload', '1');
    window.location.reload();
  }
  throw error;
}));

// Lazy-loaded modular views (code-splitting for smaller initial bundle)
const DashboardView = lazyWithReload(() => import('./components/DashboardView').then(m => ({ default: m.DashboardView })));
const WeeklyReportCard = lazyWithReload(() => import('./components/WeeklyReportCard').then(m => ({ default: m.WeeklyReportCard })));

const suggestionDedupeKey = (item: Suggestion) => [
  item.platform || 'global',
  item.title,
  item.explanation,
  item.fixAction,
].map(value => String(value || '').trim().toLowerCase()).join('|');

const uniqueSuggestions = (items: Suggestion[] = []) => {
  const byContent = new Map<string, Suggestion>();
  items.forEach((item) => {
    const key = suggestionDedupeKey(item) || item.id;
    const existing = byContent.get(key);
    if (!existing) {
      byContent.set(key, item);
      return;
    }

    byContent.set(key, {
      ...existing,
      ...item,
      id: existing.id,
      resolved: existing.resolved && item.resolved,
    });
  });
  return Array.from(byContent.values());
};

const readCookie = (name: string) => {
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix))
    ?.slice(prefix.length) || '';
};

const jsonHeadersWithClientCsrf = () => {
  const csrf = readCookie('buykori_client_csrf');
  return {
    'Content-Type': 'application/json',
    ...(csrf ? { 'X-Client-CSRF-Token': csrf } : {}),
  };
};

class PageErrorBoundary extends React.Component<
  { pageKey: string; children: React.ReactNode },
  { error: Error | null }
> {
  declare props: Readonly<{ pageKey: string; children: React.ReactNode }>;
  declare setState: React.Component<
    { pageKey: string; children: React.ReactNode },
    { error: Error | null }
  >['setState'];
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`Page render failed: ${this.props.pageKey}`, error);
  }

  componentDidUpdate(previousProps: { pageKey: string }) {
    if (previousProps.pageKey !== this.props.pageKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
          <h2 className="text-sm font-bold">This workspace could not be displayed</h2>
          <p className="mt-1 text-xs">Refresh the page and try again. The error has been logged for diagnosis.</p>
          <p className="mt-2 rounded bg-white/70 px-2 py-1 font-mono text-[10px]">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
const AnalyticsView = lazyWithReload(() => import('./components/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const CodProtectionView = lazyWithReload(() => import('./components/CodProtectionView').then(m => ({ default: m.CodProtectionView })));
const EventLogsView = lazyWithReload(() => import('./components/EventLogsView').then(m => ({ default: m.EventLogsView })));
const ApiLogsView = lazyWithReload(() => import('./components/ApiLogsView').then(m => ({ default: m.ApiLogsView })));
const SettingsView = lazyWithReload(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const SetupGuideView = lazyWithReload(() => import('./components/SetupGuideView').then(m => ({ default: m.SetupGuideView })));
const SuggestionsView = lazyWithReload(() => import('./components/SuggestionsView').then(m => ({ default: m.SuggestionsView })));
const CampaignBuilderView = lazyWithReload(() => import('./components/CampaignBuilderView').then(m => ({ default: m.CampaignBuilderView })));
const AccountView = lazyWithReload(() => import('./components/AccountView').then(m => ({ default: m.AccountView })));
const OrdersView = lazyWithReload(() => import('./components/OrdersView').then(m => ({ default: m.OrdersView })));
const IncompleteCheckoutsView = lazyWithReload(() => import('./components/IncompleteCheckoutsView').then(m => ({ default: m.IncompleteCheckoutsView })));

export default function App() {
  const isPluginConnectRoute = window.location.pathname === '/plugin/connect';
  const initialRoute = resolveClientRoute(window.location.pathname);
  const [activePage, setActivePageState] = useState<string>(initialRoute?.pageId || 'dashboard');
  const [activeRouteSection, setActiveRouteSection] = useState<string | null>(initialRoute?.sectionId || null);
  const [searchVal, setSearchVal] = useState<string>('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Core Entity States
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [connection, setConnection] = useState<ClientConnection | null>(null);
  const [credentials, setCredentials] = useState<Record<Platform, PlatformConfig> | null>(null);
  const [rules, setRules] = useState<EventRule[]>([]);
  const [customEventAutomations, setCustomEventAutomations] = useState<CustomEventAutomation[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [events, setEvents] = useState<CAPIEvent[]>([]);
  const [apiLogs, setApiLogs] = useState<APILog[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [retryingOutboxIds, setRetryingOutboxIds] = useState<number[]>([]);
  const [deferredData, setDeferredData] = useState<any>(null);
  const [courierOrders, setCourierOrders] = useState<any[]>([]);
  const [sidebarStatus, setSidebarStatus] = useState<any>(null);
  const [incompleteCheckoutData, setIncompleteCheckoutData] = useState<any>({ items: [], counts: {} });
  const [pluginReleaseInfo, setPluginReleaseInfo] = useState<PluginReleaseInfo | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [deferredEnabled, setDeferredEnabled] = useState<boolean>(false);
  const [autoConfirmDays, setAutoConfirmDays] = useState<number>(0);
  const [autoConfirmStatus, setAutoConfirmStatus] = useState<string>('completed');
  const [savingDeferredSettings, setSavingDeferredSettings] = useState<boolean>(false);

  // Multiple Store Management
  const [stores, setStores] = useState<any[]>([]);
  const [createStoreModalOpen, setCreateStoreModalOpen] = useState<boolean>(false);

  // Advanced Analytics States
  const [analyticsOverview, setAnalyticsOverview] = useState<any>(null);
  const [analyticsCampaigns, setAnalyticsCampaigns] = useState<any>(null);
  const [analyticsHourly, setAnalyticsHourly] = useState<any>(null);
  const [analyticsAudience, setAnalyticsAudience] = useState<any>(null);
  const [signalDoctor, setSignalDoctor] = useState<any>(null);
  const [analyticsDays, setAnalyticsDays] = useState<number>(7);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [recoverySummary, setRecoverySummary] = useState<any>(null);

  const setActivePage = useCallback((pageId: string) => {
    const nextPage = isClientPageId(pageId) ? pageId : 'dashboard';
    const nextPath = clientPathForPage(nextPage) || '/dashboard';
    setActivePageState(nextPage);
    setActiveRouteSection(null);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ buykoriPage: nextPage }, '', nextPath);
    }
  }, []);

  // Async Lifecycle States
  const [loading, setLoading] = useState<boolean>(true);
  const [aiReviewing, setAiReviewing] = useState<boolean>(false);
  const [errState, setErrState] = useState<string | null>(null);
  const [showDemoResetConfirm, setShowDemoResetConfirm] = useState<boolean>(false);

  // Live Mode Polling State
  const [liveMode, setLiveMode] = useState<boolean>(false);
  const liveIntervalRef = useRef<any | null>(null);

  // Filters State for Logs
  const [platformFilters, setPlatformFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Row selection details for expanded logs preview
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [expandedApiLogId, setExpandedApiLogId] = useState<string | null>(null);

  // FAQ Expanded State
  const [faqExpanded, setFaqExpanded] = useState<number | null>(null);

  // Sandbox Campaign Builder State
  const [builderPlatform, setBuilderPlatform] = useState<Platform>('Meta CAPI');
  const [builderEventName, setBuilderEventName] = useState<string>('Purchase');
  const [builderValue, setBuilderValue] = useState<string>('129.99');
  const [builderCurrency, setBuilderCurrency] = useState<string>('USD');
  const [builderEmail, setBuilderEmail] = useState<string>('customer@domain.com');
  const [builderPhone, setBuilderPhone] = useState<string>('+15125550199');
  const [builderIp, setBuilderIp] = useState<string>('72.229.28.185');
  const [builderUa, setBuilderUa] = useState<string>('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
  const [customParams, setCustomParams] = useState<{ k: string; v: string }[]>([
    { k: 'content_name', v: 'Designer Leather Jacket' },
    { k: 'content_category', v: 'Apparel > Outerwear' }
  ]);
  const [campaignResp, setCampaignResp] = useState<any | null>(null);
  const [dispatchingTest, setDispatchingTest] = useState<boolean>(false);

  // Campaign URL Builder States
  const [urlBuilderBaseUrl, setUrlBuilderBaseUrl] = useState<string>('');
  const [urlBuilderSource, setUrlBuilderSource] = useState<string>('facebook');
  const [urlBuilderMedium, setUrlBuilderMedium] = useState<string>('paid_social');
  const [urlBuilderCampaign, setUrlBuilderCampaign] = useState<string>('');
  const [urlBuilderContent, setUrlBuilderContent] = useState<string>('');
  const [urlBuilderTerm, setUrlBuilderTerm] = useState<string>('');
  const [urlBuilderAdPlatform, setUrlBuilderAdPlatform] = useState<'meta' | 'tiktok'>('meta');
  const [urlBuilderCampaignId, setUrlBuilderCampaignId] = useState<string>('');
  const [syncedAdCampaigns, setSyncedAdCampaigns] = useState<any[]>([]);
  const [loadingSyncedAdCampaigns, setLoadingSyncedAdCampaigns] = useState<boolean>(false);
  const [generatedCampaignUrl, setGeneratedCampaignUrl] = useState<string>('');

  useEffect(() => {
    if (isPluginConnectRoute) return;

    const currentRoute = resolveClientRoute(window.location.pathname);
    if (currentRoute && window.location.pathname !== currentRoute.canonicalPath) {
      window.history.replaceState({ buykoriPage: currentRoute.pageId }, '', currentRoute.canonicalPath);
    }

    const handlePopState = () => {
      const route = resolveClientRoute(window.location.pathname);
      if (!route) return;
      setActivePageState(route.pageId);
      setActiveRouteSection(route.sectionId);
      setMobileSidebarOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isPluginConnectRoute]);

  useEffect(() => {
    const handleSectionNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId?: string; sectionId?: string }>).detail;
      if (detail?.pageId !== 'settings' || !detail.sectionId) return;
      const nextPath = clientPathForSection('settings', detail.sectionId);
      setActiveRouteSection(detail.sectionId);
      if (nextPath && window.location.pathname !== nextPath) {
        window.history.replaceState(
          { buykoriPage: 'settings', buykoriSection: detail.sectionId },
          '',
          nextPath
        );
      }
    };

    window.addEventListener('buykori:page-section', handleSectionNavigation);
    return () => window.removeEventListener('buykori:page-section', handleSectionNavigation);
  }, []);

  useEffect(() => {
    if (profile && !urlBuilderBaseUrl) {
      setUrlBuilderBaseUrl(profile.email ? `https://${profile.name.toLowerCase().replace(/\s+/g, '')}.com` : 'https://your-site.com');
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;
    const fetchSyncedAdCampaigns = async () => {
      setLoadingSyncedAdCampaigns(true);
      try {
        const res = await fetch('/api/v1/ad-campaigns');
        if (res.ok) {
          const data = await res.json();
          setSyncedAdCampaigns(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to load synced ad campaigns', err);
      } finally {
        setLoadingSyncedAdCampaigns(false);
      }
    };
    fetchSyncedAdCampaigns();
  }, [profile]);

  const compileCampaignUrl = () => {
    if (!urlBuilderBaseUrl.trim() || !urlBuilderCampaign.trim()) return '';
    try {
      let base = urlBuilderBaseUrl.trim();
      if (!/^https?:\/\//i.test(base)) {
        base = 'https://' + base;
      }
      const url = new URL(base);
      url.searchParams.set('utm_source', urlBuilderSource.trim());
      url.searchParams.set('utm_medium', urlBuilderMedium.trim());
      url.searchParams.set('utm_campaign', urlBuilderCampaign.trim().toLowerCase().replace(/\s+/g, '_'));
      if (urlBuilderCampaignId.trim()) {
        url.searchParams.set('bk_platform', urlBuilderAdPlatform);
        url.searchParams.set('bk_campaign_id', urlBuilderCampaignId.trim());
      }
      if (urlBuilderContent.trim()) {
        url.searchParams.set('utm_content', urlBuilderContent.trim());
      }
      if (urlBuilderTerm.trim()) {
        url.searchParams.set('utm_term', urlBuilderTerm.trim());
      }
      return url.toString();
    } catch {
      return '';
    }
  };

  useEffect(() => {
    setGeneratedCampaignUrl(compileCampaignUrl());
  }, [urlBuilderBaseUrl, urlBuilderSource, urlBuilderMedium, urlBuilderCampaign, urlBuilderContent, urlBuilderTerm, urlBuilderAdPlatform, urlBuilderCampaignId]);

  const handleGenerateCampaignUrl = () => {
    if (!urlBuilderBaseUrl.trim()) {
      showToast("Please enter a base website URL", true);
      return;
    }
    if (!urlBuilderCampaign.trim()) {
      showToast("Please enter a campaign name", true);
      return;
    }
    const compiled = compileCampaignUrl();
    if (compiled) {
      setGeneratedCampaignUrl(compiled);
      showToast("Campaign URL is ready.", false);
    } else {
      showToast("Invalid base URL format", true);
    }
  };

  // Account / Profiles States
  const [profName, setProfName] = useState<string>('');
  const [profEmail, setProfEmail] = useState<string>('');
  const [profNotifEmail, setProfNotifEmail] = useState<string>('');
  const [profNotifyWhatsapp, setProfNotifyWhatsapp] = useState<boolean>(false);
  const [profWhatsappNumber, setProfWhatsappNumber] = useState<string>('');
  const [profUpdating, setProfUpdating] = useState<boolean>(false);
  const [profEmailCodeRequested, setProfEmailCodeRequested] = useState<boolean>(false);
  const [profEmailCode, setProfEmailCode] = useState<string>('');
  const [profEmailCurrentPassword, setProfEmailCurrentPassword] = useState<string>('');
  const [passCurrent, setPassCurrent] = useState<string>('');
  const [passNew, setPassNew] = useState<string>('');
  const [passConfirm, setPassConfirm] = useState<string>('');
  const [confirmDeleteText, setConfirmDeleteText] = useState<string>('');
  const [confirmRevokeText, setConfirmRevokeText] = useState<string>('');

  // Copied confirmation states mapping
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  // Trigger feedback toasts
  const [globalToast, setGlobalToast] = useState<{ show: boolean; msg: string; err: boolean; actionLabel?: string; onAction?: () => void }>({ show: false, msg: '', err: false });
  const [productGuideOpen, setProductGuideOpen] = useState<boolean>(false);
  const [deferredLoadError, setDeferredLoadError] = useState<string | null>(null);

  useEffect(() => {
    sessionStorage.removeItem('buykori_chunk_reload');
  }, []);

  const getGuideStorageKey = (user?: UserProfile | null) => {
    const owner = user?.email || 'guest';
    return `buykori_client_tour_seen_${owner}`;
  };

  const openProductGuide = () => {
    setProductGuideOpen(true);
  };

  const closeProductGuide = () => {
    if (profile) {
      localStorage.setItem(getGuideStorageKey(profile), '1');
      setProfile(prev => prev ? { ...prev, guideDismissed: true } : prev);
      fetch('/api/guide/dismiss', { method: 'POST' }).catch(err => {
        console.error('Failed to persist guide dismissal', err);
      });
    }
    setProductGuideOpen(false);
    setMobileSidebarOpen(false);
  };

  const showToast = (msg: string, isErr = false, action?: { label: string; onClick: () => void }) => {
    setGlobalToast({ show: true, msg, err: isErr, actionLabel: action?.label, onAction: action?.onClick });
    setTimeout(() => {
      setGlobalToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    if (loading || !profile || isPluginConnectRoute) return;
    if (profile.guideDismissed || localStorage.getItem(getGuideStorageKey(profile)) === '1') return;
    const timer = window.setTimeout(() => setProductGuideOpen(true), 650);
    return () => window.clearTimeout(timer);
  }, [loading, profile, isPluginConnectRoute]);

  const redirectToClientLogin = () => {
    window.location.assign('/client');
  };

  const handleClientLogout = async () => {
    try {
      await fetch('/api/v1/auth/client/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error("Client logout endpoint failed before redirect", err);
    } finally {
      redirectToClientLogin();
    }
  };

  const isAuthFailure = (responses: Response[]) => {
    return responses.some(res => res.status === 401 || res.status === 403);
  };

  // Helper code copy
  const handleCopy = (text: string, labelId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [labelId]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [labelId]: false }));
    }, 2000);
  };

  const fetchDeferred = async () => {
    try {
      const res = await fetch('/api/deferred');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Could not load verification queue (${res.status}).`);
      }
      const data = await res.json();
      setDeferredData(data);
      setDeferredEnabled(data.deferredEnabled);
      setAutoConfirmDays(data.autoConfirmDays);
      setAutoConfirmStatus(data.autoConfirmStatus);
      setDeferredLoadError(null);
    } catch (err) {
      console.error("Failed to fetch COD Protection", err);
      setDeferredData(prev => prev || { pendingList: [], pendingCount: 0, pendingValue: 0 });
      setDeferredLoadError(err instanceof Error ? err.message : 'Could not load the verification queue.');
    }
  };

  const refreshIncompleteCheckoutStates = async () => {
    const res = await fetch('/api/incomplete-checkouts/refresh', { method: 'POST' });
    if (!res.ok && res.status !== 403) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Could not refresh incomplete checkouts (${res.status}).`);
    }
  };

  const fetchIncompleteCheckouts = async (options: { refresh?: boolean } = {}) => {
    try {
      if (options.refresh) {
        await refreshIncompleteCheckoutStates();
      }
      const res = await fetch('/api/incomplete-checkouts');
      if (res.ok) {
        setIncompleteCheckoutData(await res.json());
      } else if (res.status === 403) {
        setIncompleteCheckoutData({ items: [], counts: {}, restricted: true });
      }
    } catch (err) {
      console.error('Failed to fetch incomplete checkouts', err);
    }
  };

  const fetchEvents = async () => {
    const [eventsRes, outboxRes] = await Promise.all([
      fetch('/api/events?limit=100'),
      fetch('/api/outbox?limit=100'),
    ]);
    const eventData = eventsRes.ok ? await eventsRes.json() : { events: [] };
    const outboxData = outboxRes.ok ? await outboxRes.json() : { items: [] };
    const loggedEvents: CAPIEvent[] = eventData.events || [];
    const loggedKeys = new Set(loggedEvents.map(event => event.deduplicationKey));

    const ingestEvents: CAPIEvent[] = (outboxData.items || []).flatMap((item: OutboxItem) =>
      item.eventNames.map((eventName, index) => {
        const eventId = item.eventIds[index] || `outbox-${item.id}-${index}`;
        return {
          id: `outbox_${item.id}_${index}`,
          timestamp: item.createdAt,
          name: eventName,
          platform: 'Gateway Ingest',
          status: item.status === 'dead' ? 'Failed' : item.status === 'processing' ? 'Retry' : 'Fired',
          httpCode: item.status === 'dead' ? 500 : 202,
          deduplicationKey: eventId,
          payload: {
            event_name: eventName,
            event_id: eventId,
            source: 'event_outbox',
            event_count: item.eventCount,
          },
          headers: { 'X-Buykori-Queue': item.status },
          responseBody: {
            status: item.status,
            attempts: item.attempts,
            maxAttempts: item.maxAttempts,
            nextAttemptAt: item.nextAttemptAt,
            error: item.lastError || undefined,
          },
          latencyMs: null,
        } as CAPIEvent;
      })
    ).filter((event: CAPIEvent) => !loggedKeys.has(event.deduplicationKey));

    setEvents(
      [...ingestEvents, ...loggedEvents]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 200)
    );
  };

  const fetchApiLogs = async () => {
    const res = await fetch('/api/api-logs?limit=100');
    if (res.ok) {
      const data = await res.json();
      setApiLogs(data.logs || []);
    }
  };

  const fetchTrendData = async (days = 7) => {
    try {
      const [trendRes, recoveryRes] = await Promise.all([
        fetch(`/api/events/trend?days=${days}`),
        fetch(`/api/events/recovery-summary?days=${days}`)
      ]);
      if (trendRes.ok) {
        const data = await trendRes.json();
        setTrendData(data.trend || []);
      }
      if (recoveryRes.ok) {
        setRecoverySummary(await recoveryRes.json());
      }
    } catch (err) {
      console.error("Failed to fetch trend data", err);
    }
  };

  const fetchOutbox = async () => {
    const res = await fetch('/api/outbox?limit=25');
    if (res.ok) {
      const data = await res.json();
      setOutboxItems(data.items || []);
    }
  };

  const fetchSettingsData = async () => {
    const [resCreds, resRules, resAutomations] = await Promise.all([
      fetch('/api/credentials'),
      fetch('/api/rules'),
      fetch('/api/custom-event-automations'),
    ]);
    if (isAuthFailure([resCreds, resRules, resAutomations])) {
      redirectToClientLogin();
      return;
    }
    if (!resCreds.ok || !resRules.ok || !resAutomations.ok) {
      throw new Error('Failed to load tracking settings.');
    }
    setCredentials(await resCreds.json());
    setRules(await resRules.json());
    const automationData = await resAutomations.json();
    setCustomEventAutomations(automationData.automations || []);
  };

  const loadActivePageData = async (page: string) => {
    if (page === 'pending-purchases' || page === 'orders') {
      await fetchDeferred();
    } else if (page === 'incomplete-checkouts') {
      await fetchIncompleteCheckouts({ refresh: true });
    } else if (page === 'event-logs') {
      await Promise.all([fetchEvents(), fetchOutbox()]);
    } else if (page === 'api-logs') {
      await fetchApiLogs();
    } else if (page === 'settings') {
      await fetchSettingsData();
    }
  };

  const handleIncompleteCheckoutStatus = async (id: number, status: string) => {
    const res = await fetch(`/api/incomplete-checkouts/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.detail || 'Failed to update recovery status.', true);
      return;
    }
    showToast('Recovery status updated.');
    await fetchIncompleteCheckouts();
  };

  const handleCreateRecoveryOrder = async (id: number, payload: any) => {
    const res = await fetch(`/api/incomplete-checkouts/${id}/create-order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showToast(body.detail || 'Failed to create recovery order.', true);
      return false;
    }
    const body = await res.json().catch(() => ({}));
    showToast('Recovery order created.', false, {
      label: 'Open Orders',
      onClick: () => setActivePage('orders'),
    });
    await Promise.all([
      fetchIncompleteCheckouts(),
      fetchDeferred(),
    ]);
    return Boolean(body.success ?? true);
  };


  // --- Fetch API Handlers ---
  const loadSystemData = async (showShimmer = true) => {
    if (showShimmer) setLoading(true);
    try {
      // Route-specific payloads load when their workspace opens.
      const [
        resProf, resConn, resSugg, resLogs, resSidebar, resPlugin, resTrend
      ] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/connection'),
        fetch('/api/suggestions'),
        fetch(`/api/events?limit=100`),
        fetch('/api/sidebar/status'),
        fetch('/api/v1/plugin/info'),
        fetch(`/api/events/trend?days=${analyticsDays}`)
      ]);

      if (isAuthFailure([resProf, resConn])) {
        redirectToClientLogin();
        return;
      }

      if (!resProf.ok || !resConn.ok) {
        throw new Error("Server is not responding. Please try again.");
      }

      const dProf = await resProf.json();
      const dConn = await resConn.json();
      const dSugg = resSugg.ok ? await resSugg.json() : [];
      const dLogs = resLogs.ok ? await resLogs.json() : { events: [] };
      const dSidebar = resSidebar.ok ? await resSidebar.json() : null;
      const dPlugin = resPlugin.ok ? await resPlugin.json() : null;
      const dTrend = resTrend.ok ? await resTrend.json() : { trend: [] };

      setProfile(dProf);
      setConnection(dConn);
      setSuggestions(uniqueSuggestions(dSugg));
      setEvents(dLogs.events);
      setSidebarStatus(dSidebar);
      setPluginReleaseInfo(dPlugin);
      setTrendData(dTrend.trend || []);
      
      // Initialize text fields
      setProfName(dProf.name);
      setProfEmail(dProf.email);
      setProfEmailCodeRequested(false);
      setProfEmailCode('');
      setProfEmailCurrentPassword('');
      setProfNotifEmail(dProf.notificationEmail || dProf.email);
      setProfNotifyWhatsapp(dProf.ownerNotifyWhatsapp || false);
      setProfWhatsappNumber(dProf.ownerWhatsappNumber || '');

      setErrState(null);
      await loadActivePageData(activePage);
    } catch (e: any) {
      console.error(e);
      setErrState(e.message || "Something went wrong. Please refresh or try again.");
    } finally {
      if (showShimmer) setLoading(false);
    }
  };

  const loadAnalyticsData = async (days = 7) => {
    try {
      setAnalyticsError(null);
      const [resAnOver, resAnCamp, resAnHour, resAnAudience, resAnDoc] = await Promise.all([
        fetch(`/api/v1/analytics/overview?days=${days}`),
        fetch(`/api/v1/analytics/campaigns?days=${days}`),
        fetch(`/api/v1/analytics/hourly?days=${days}`),
        fetch(`/api/v1/analytics/audience?days=${days}`),
        fetch(`/api/v1/analytics/signal-doctor?days=${days}`)
      ]);
      const failedSections: string[] = [];
      if (!resAnOver.ok) failedSections.push('summary');
      if (!resAnCamp.ok) failedSections.push('sales source');
      if (!resAnHour.ok) failedSections.push('hourly data');
      if (!resAnAudience.ok) failedSections.push('customers');
      if (!resAnDoc.ok) failedSections.push('tracking health');
      if (resAnOver.ok) {
        const data = await resAnOver.json();
        setAnalyticsOverview({ ...data, funnel: Array.isArray(data.funnel) ? data.funnel : [] });
      }
      if (resAnCamp.ok) {
        const data = await resAnCamp.json();
        setAnalyticsCampaigns({ ...data, campaigns: Array.isArray(data.campaigns) ? data.campaigns : [] });
      }
      if (resAnHour.ok) setAnalyticsHourly(await resAnHour.json());
      if (resAnAudience.ok) {
        const data = await resAnAudience.json();
        setAnalyticsAudience({
          ...data,
          top_districts: Array.isArray(data.top_districts) ? data.top_districts : [],
          device_mix: Array.isArray(data.device_mix) ? data.device_mix : [],
          browser_mix: Array.isArray(data.browser_mix) ? data.browser_mix : [],
          district_funnel: Array.isArray(data.district_funnel) ? data.district_funnel : [],
          visitor_district_funnel: Array.isArray(data.visitor_district_funnel) ? data.visitor_district_funnel : [],
        });
      }
      if (resAnDoc.ok) {
        const data = await resAnDoc.json();
        setSignalDoctor({
          ...data,
          issues: Array.isArray(data.issues) ? data.issues : [],
          signal_rates: data.signal_rates && Object.keys(data.signal_rates).length ? data.signal_rates : null,
        });
      }
      if (failedSections.length) {
        setAnalyticsError(`Some ad insight data could not load: ${failedSections.join(', ')}.`);
      }
    } catch (err) {
      console.error("Failed to load analytics data", err);
      setAnalyticsError("Ad insight data could not load. Please refresh and try again.");
    }
  };

  useEffect(() => {
    if (isPluginConnectRoute) return;
    loadSystemData(true);
    fetchStores();
  }, []);

  useEffect(() => {
    if (isPluginConnectRoute) return;
    if (profile) {
      if (activePage === 'analytics') {
        loadAnalyticsData(analyticsDays);
      } else if (activePage === 'dashboard') {
        fetchTrendData(analyticsDays);
      }
    }
  }, [analyticsDays, profile, activePage]);

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) {
        const data = await res.json();
        setStores(data.stores || []);
      }
    } catch (err) {
      console.error('Failed to fetch stores', err);
    }
  };

  const currentStore = stores.find(store => store.is_current);

  const handleSaveStoreDomain = async (domain: string) => {
    const res = await fetch('/api/store/domain', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domain.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.detail || 'Could not save the store domain.', true);
      return;
    }
    showToast(data.domain ? 'Store domain saved.' : 'Store domain cleared.', false);
    await Promise.all([fetchStores(), fetchSettingsData()]);
  };

  const handleSwitchStore = async (clientId: number) => {
    try {
      const res = await fetch('/api/switch-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_client_id: clientId }),
      });
      if (res.ok) {
        showToast('Switching store...', false);
        setTimeout(() => {
          loadSystemData(true);
          fetchStores();
          setActivePage('dashboard');
        }, 400);
      } else {
        const data = await res.json();
        showToast(data.detail || 'Failed to switch store.', true);
      }
    } catch {
      showToast('Network error while switching store.', true);
    }
  };


  const markSidebarSeen = async (section: 'order_verification' | 'orders_delivery') => {
    const isOrderVerification = section === 'order_verification';

    setSidebarStatus((prev: any) => prev ? {
      ...prev,
      orderVerificationNew: isOrderVerification ? 0 : prev.orderVerificationNew,
      ordersDeliveryNew: isOrderVerification ? prev.ordersDeliveryNew : 0,
    } : prev);

    try {
      const res = await fetch('/api/sidebar/mark-seen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section })
      });

      if (res.ok) {
        const statusRes = await fetch('/api/sidebar/status');
        if (statusRes.ok) {
          setSidebarStatus(await statusRes.json());
        }
      }
    } catch (err) {
      console.error("Failed to update sidebar seen state", err);
    }
  };

  useEffect(() => {
    if (activePage === 'pending-purchases') {
      markSidebarSeen('order_verification');
    } else if (activePage === 'orders') {
      markSidebarSeen('orders_delivery');
    }
    if (activePage !== 'dashboard') {
      loadActivePageData(activePage).catch(err => {
        console.error(`Failed to load ${activePage} workspace`, err);
      });
    }
  }, [activePage]);

  useEffect(() => {
    if (activePage !== 'event-logs') return;
    const refreshEventHistory = () => {
      Promise.all([fetchEvents(), fetchOutbox()]).catch(err => {
        console.error('Failed to refresh Event History', err);
      });
    };
    const intervalId = window.setInterval(refreshEventHistory, 5000);
    return () => window.clearInterval(intervalId);
  }, [activePage]);

  // Periodic polling for Incomplete Checkouts and COD holds
  useEffect(() => {
    if (activePage !== 'incomplete-checkouts' && activePage !== 'pending-purchases' && activePage !== 'orders') {
      return;
    }

    const pollData = () => {
      if (document.hidden) return;

      if (activePage === 'incomplete-checkouts') {
        fetchIncompleteCheckouts({ refresh: true }).catch(err => {
          console.error('Failed to auto-refresh incomplete checkouts', err);
        });
      } else if (activePage === 'pending-purchases' || activePage === 'orders') {
        fetchDeferred().catch(err => {
          console.error('Failed to auto-refresh COD holds/orders', err);
        });
      }
    };

    const intervalId = window.setInterval(pollData, 15000);
    return () => window.clearInterval(intervalId);
  }, [activePage]);

  // Live Tracking Mode Polling Simulator
  useEffect(() => {
    if (liveMode) {
      // Trigger instant pulse on activate
      const streamPulse = async () => {
        try {
          const res = await fetch('/api/events/live-stream');
          const data = await res.json();
          if (data.event) {
            setEvents(prev => [data.event, ...prev]);
          }
        } catch (err) {
          console.error("Live packet error: ", err);
        }
      };

      liveIntervalRef.current = setInterval(streamPulse, 3000);
      showToast("Live mode is on! Events update automatically.", false);
    } else {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
        liveIntervalRef.current = null;
      }
    }

    return () => {
      if (liveIntervalRef.current) {
        clearInterval(liveIntervalRef.current);
      }
    };
  }, [liveMode]);

  // Handle platform credential update
  const handleUpdatePlatform = async (platform: Platform, fields: Partial<PlatformConfig>) => {
    try {
      const res = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, ...fields })
      });
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials);
        showToast(`${platform} tracking settings updated.`, false);
        return;
      }
      const error = await res.json().catch(() => null);
      showToast(error?.detail || `Failed to update ${platform} settings.`, true);
    } catch {
      showToast(`Failed to update ${platform} settings.`, true);
    }
  };

  // Toggle WP Event Rules
  const handleToggleRule = async (index: number, channel: 'metaEnabled' | 'tiktokEnabled' | 'ga4Enabled') => {
    const updated = [...rules];
    updated[index][channel] = !updated[index][channel];
    setRules(updated);

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updated })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRules(data.rules || updated);
    } catch {
      showToast("Could not save tracking rules.", true);
      await loadSystemData(false);
    }
  };

  const handleAddRule = async (eventName: string) => {
    const cleanName = eventName.trim();
    if (!cleanName) {
      showToast("Select or enter an event name first.", true);
      return;
    }
    if (rules.some(rule => rule.eventName.toLowerCase() === cleanName.toLowerCase())) {
      showToast(`${cleanName} is already added.`, true);
      return;
    }

    const updated: EventRule[] = [
      ...rules,
      {
        eventName: cleanName,
        metaEnabled: Boolean(credentials?.['Meta CAPI']?.enabled ?? true),
        tiktokEnabled: Boolean(credentials?.['TikTok Events API']?.enabled ?? true),
        ga4Enabled: Boolean(credentials?.GA4?.enabled ?? true),
      }
    ];
    setRules(updated);

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updated })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRules(data.rules || updated);
      showToast(`${cleanName} event added.`, false);
    } catch {
      showToast("Could not add event. Use letters, numbers, or underscores.", true);
      await loadSystemData(false);
    }
  };

  const handleRemoveRule = async (index: number) => {
    const removed = rules[index];
    const updated = rules.filter((_, i) => i !== index);
    setRules(updated);

    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updated })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRules(data.rules || updated);
      showToast(`${removed?.eventName || 'Event'} removed.`, false);
    } catch {
      showToast("Could not remove event.", true);
      await loadSystemData(false);
    }
  };

  // Core heartbeat trigger from header or settings
  const refreshWPHeartbeat = async () => {
    const res = await fetch('/api/connection/test', {
      method: 'POST',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Connection refresh failed (${res.status}).`);
    }
    const data = await res.json();
    setConnection(data.connection);
    if (data.connection?.status !== 'Active' || data.connection?.bindingVerified === false) {
      throw new Error(data.connection?.connectionIssue || 'WordPress site binding is not active. Reconnect the plugin.');
    }
    await loadSystemData(false);
  };

  const handleSaveCustomEventAutomations = async (automations: CustomEventAutomation[]) => {
    const res = await fetch('/api/custom-event-automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automations })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.detail || 'Could not save custom event automations.', true);
      return false;
    }
    setCustomEventAutomations(data.automations || automations);
    if (Array.isArray(data.rules)) {
      setRules(data.rules);
    }
    showToast('Custom event automations saved.', false);
    return true;
  };

  const handleRetryOutbox = async (id: number) => {
    setRetryingOutboxIds(prev => [...prev, id]);
    try {
      const res = await fetch(`/api/outbox/${id}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Retry request failed.');
      }
      setOutboxItems(prev => prev.map(item => item.id === id ? data.item : item));
      showToast(`Outbox event #${id} queued for retry.`, false);
      await loadSystemData(false);
    } catch (err: any) {
      showToast(err.message || 'Could not queue retry.', true);
      await loadSystemData(false);
    } finally {
      setRetryingOutboxIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/deferred/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Verification action failed.');
      showToast(data.message || "Order verified & queued successfully.", false);
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: any) {
      showToast(err.message || "Verification action failed.", true);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/deferred/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Skip action failed.');
      showToast(data.message || "Event skipped.", false, {
        label: 'Undo',
        onClick: () => handleRestoreSkippedOrder(orderId),
      });
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: any) {
      showToast(err.message || "Skip action failed.", true);
    }
  };

  const handleRestoreSkippedOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/deferred/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not restore skipped event.');
      showToast(data.message || "Event restored to verification queue.", false);
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: any) {
      showToast(err.message || "Could not restore skipped event.", true);
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await fetch('/api/deferred/confirm-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrderIds })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Bulk verification failed.');
      showToast(`${Number(data.confirmed || 0)} orders verified${data.failed ? `, ${data.failed} failed` : ''}.`, Boolean(data.failed));
      setSelectedOrderIds([]);
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: any) {
      showToast(err.message || "Bulk verification failed.", true);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await fetch('/api/deferred/cancel-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: selectedOrderIds })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Bulk skip failed.');
      showToast(`${Number(data.cancelled || 0)} events skipped${data.failed ? `, ${data.failed} failed` : ''}.`, Boolean(data.failed));
      setSelectedOrderIds([]);
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: any) {
      showToast(err.message || "Bulk skip failed.", true);
    }
  };

  const handleSaveDeferredSettings = async () => {
    setSavingDeferredSettings(true);
    try {
      const res = await fetch('/api/deferred/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deferredEnabled, autoConfirmDays, autoConfirmStatus })
      });
      if (res.ok) {
        showToast("COD Protection settings saved successfully.", false);
        loadSystemData(false);
      } else {
        showToast("Failed to save COD Protection settings.", true);
      }
    } catch {
      showToast("Failed to save COD Protection settings.", true);
    } finally {
      setSavingDeferredSettings(false);
    }
  };

  // Trigger System Diagnostics Scan Workflow
  const handleAiReview = async () => {
    setAiReviewing(true);
    try {
      const res = await fetch('/api/suggestions/ai-review', { method: 'POST' });
      if (!res.ok) throw new Error("Setup scan failed.");
      const data = await res.json();
      setSuggestions(uniqueSuggestions(data.suggestions));
      showToast("Scan complete! Suggestions updated.", false);
    } catch (err: any) {
      showToast("Setup scan failed. Please try again.", true);
    } finally {
      setAiReviewing(false);
    }
  };

  // Resolve Suggestion Card
  const toggleResolveSuggestion = async (id: string, isNowResolved: boolean) => {
    try {
      const res = await fetch('/api/suggestions/toggle-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setSuggestions(prev => prev.map(s => s.id === id ? { ...s, resolved: !s.resolved } : s));
        showToast(isNowResolved ? "Suggestion marked as resolved." : "Re-opened suggestion checklist.", false);
      }
    } catch {
      showToast("Could not update suggestion.", true);
    }
  };

  // Dismiss Suggestion Card
  const dismissSuggestion = async (id: string) => {
    try {
      const res = await fetch('/api/suggestions/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        setSuggestions(prev => prev.filter(s => s.id !== id));
        showToast(`Suggestion dismissed successfully.`, false);
      }
    } catch {
      showToast("Failed to dismiss suggestion.", true);
    }
  };

  // Submit profile edit
  const submitProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfUpdating(true);
    try {
      const emailChanged = !!profile && profEmail.trim().toLowerCase() !== profile.email.trim().toLowerCase();
      if (emailChanged && !profEmailCodeRequested) {
        const codeRes = await fetch('/api/profile/email-code', {
          method: 'POST',
          headers: jsonHeadersWithClientCsrf(),
          body: JSON.stringify({ email: profEmail.trim() }),
        });
        const codeData = await codeRes.json().catch(() => ({}));
        if (!codeRes.ok) {
          throw new Error(codeData.detail || 'Could not send email verification code.');
        }
        setProfEmailCodeRequested(true);
        showToast('Verification code sent to your new email.', false);
        return;
      }
      if (emailChanged && (!profEmailCode.trim() || !profEmailCurrentPassword)) {
        throw new Error('Enter the verification code and your current password.');
      }

      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: jsonHeadersWithClientCsrf(),
        body: JSON.stringify({
          name: profName,
          email: profEmail,
          notificationEmail: profNotifEmail,
          ownerNotifyWhatsapp: profNotifyWhatsapp,
          ownerWhatsappNumber: profWhatsappNumber,
          emailCode: emailChanged ? profEmailCode.trim() : null,
          currentPassword: emailChanged ? profEmailCurrentPassword : null,
        })
      });
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setProfName(data.profile.name);
        setProfEmail(data.profile.email);
        setProfNotifEmail(data.profile.notificationEmail || data.profile.email);
        setProfNotifyWhatsapp(data.profile.ownerNotifyWhatsapp || false);
        setProfWhatsappNumber(data.profile.ownerWhatsappNumber || '');
        setProfEmailCodeRequested(false);
        setProfEmailCode('');
        setProfEmailCurrentPassword('');
        showToast("Profile saved!", false);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Profile save failed.');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save profile.", true);
    } finally {
      setProfUpdating(false);
    }
  };

  const handleApplyEventPreset = async (preset: string) => {
    const res = await fetch('/api/event-presets/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.detail || 'Could not apply event preset.', true);
      return false;
    }
    setRules(data.rules || []);
    showToast(`${data.preset?.name || 'Event'} preset applied.`, false);
    return true;
  };

  // Dispatch campaign event builder test
  const handleDispatchSandboxTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchingTest(true);
    setCampaignResp(null);

    // Format customParams array as a flattened object
    const customObj: Record<string, any> = {};
    customParams.forEach(p => {
      if (p.k.trim()) customObj[p.k.trim()] = p.v;
    });

    try {
      const res = await fetch('/api/campaign-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: builderPlatform,
          eventName: builderEventName,
          value: builderValue,
          currency: builderCurrency,
          email: builderEmail,
          phone: builderPhone,
          ip: builderIp,
          userAgent: builderUa,
          customParams: customObj
        })
      });

      const data = await res.json();
      setCampaignResp({
        statusCode: res.status,
        body: data
      });

      if (res.ok && data.success) {
        showToast(`Test event successfully accepted by ${builderPlatform}!`, false);
        // Silently reload logs background
        loadSystemData(false);
      } else {
        showToast(`Test failed. Please try again.`, true);
      }
    } catch (err: any) {
      setCampaignResp({
        statusCode: 500,
        body: { error: "Network error. Please check your connection.", details: err.message }
      });
      showToast("Test event failed to send.", true);
    } finally {
      setDispatchingTest(false);
    }
  };

  const confirmDemoReset = async () => {
    setShowDemoResetConfirm(false);
    try {
      const res = await fetch('/api/profile/reset-demo', { method: 'POST' });
      if (res.ok) {
        showToast("Demo data reset.", false);
        loadSystemData(true);
      }
    } catch {
      showToast("Reset failed. Please try again.", true);
    }
  };

  const handleDemoReset = async () => {
    setShowDemoResetConfirm(true);
  };

  // Danger actions confirmers
  const handleTokenRevoke = async () => {
    if (confirmRevokeText.toUpperCase() !== 'REVOKE') {
      showToast("Verification word mismatch. Enter 'REVOKE' exactly to continue.", true);
      return;
    }
    try {
      const res = await fetch('/api/connection/revoke', {
        method: 'POST',
        headers: jsonHeadersWithClientCsrf(),
      });
      if (res.ok) {
        const data = await res.json();
        setConnection(data.connection);
        setConfirmRevokeText('');
        showToast("API key has been reset.", false);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'API key reset failed.');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Reset failed. Please try again or contact support.", true);
    }
  };

  const handleDeleteAccountRequest = async () => {
    if (confirmDeleteText.toUpperCase() !== 'DELETE') {
      showToast("Verification word mismatch. Enter 'DELETE' exactly.", true);
      return;
    }
    try {
      const res = await fetch('/api/account/delete-request', {
        method: 'POST',
        headers: jsonHeadersWithClientCsrf(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Could not submit deletion request.');
      }
      showToast(data.message || "Deletion request received. Support will review it.", false);
      setConfirmDeleteText('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not submit deletion request.", true);
    }
  };

  const submitPasswordUpdate = async () => {
    if (!passCurrent || !passNew || !passConfirm) {
      showToast("Please enter all fields.", true);
      return;
    }
    if (passNew !== passConfirm) {
      showToast("New passwords do not match.", true);
      return;
    }
    if (passNew.length < 8) {
      showToast("New password must be at least 8 characters.", true);
      return;
    }
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: jsonHeadersWithClientCsrf(),
        body: JSON.stringify({ currentPassword: passCurrent, newPassword: passNew })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Password update failed.');
      }
      setPassCurrent('');
      setPassNew('');
      setPassConfirm('');
      showToast("Password updated successfully.", false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Password update failed.", true);
    }
  };

  const submitPasswordResetEmail = async () => {
    const email = (profEmail || profile?.email || '').trim();
    if (!email) {
      showToast("Profile email is missing. Save your profile email first.", true);
      return;
    }
    try {
      const res = await fetch('/api/v1/auth/client/password/forgot', {
        method: 'POST',
        headers: jsonHeadersWithClientCsrf(),
        body: JSON.stringify({ email })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Could not send reset email.');
      }
      showToast("Password reset link sent to your profile email.", false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send reset email.", true);
    }
  };

  // Export utility for logs
  const handleExportData = (format: 'csv' | 'json', dataToExport: 'events' | 'apilogs') => {
    let payload = "";
    const filename = `${dataToExport}_export_${new Date().toISOString().split('T')[0]}`;

    if (dataToExport === 'events') {
      if (format === 'json') {
        payload = JSON.stringify(events, null, 2);
      } else {
        payload = "Date,EventName,Platform,Status,HttpCode,DeduplicationKey\n" + 
          events.map(e => `"${e.timestamp}","${e.name}","${e.platform}","${e.status}",${e.httpCode},"${e.deduplicationKey}"`).join("\n");
      }
    } else {
      if (format === 'json') {
        payload = JSON.stringify(apiLogs, null, 2);
      } else {
        payload = "Date,Platform,Endpoint,Method,Status,Retries\n" + 
          apiLogs.map(l => `"${l.timestamp}","${l.platform}","${l.endpoint}","${l.method}",${l.statusCode},${l.retryCount}`).join("\n");
      }
    }

    const type = format === 'json' ? 'application/json' : 'text/csv';
    const blob = new Blob([payload], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.${format}`;
    link.click();
    showToast("File downloaded!", false);
  };

  // --- Calculations for metrics ---
  const merchantVisibleEvents = events.filter(e => e.status !== 'Filtered');

  const filteredEventsForTable = merchantVisibleEvents.filter(e => {
    // Search filter
    const matchesSearch = searchVal 
      ? (e.name.toLowerCase().includes(searchVal.toLowerCase()) || 
         e.id.toLowerCase().includes(searchVal.toLowerCase()) ||
         e.platform.toLowerCase().includes(searchVal.toLowerCase()) ||
         e.status.toLowerCase().includes(searchVal.toLowerCase()))
      : (searchFilter 
          ? (e.name.toLowerCase().includes(searchFilter.toLowerCase()) || 
             e.id.toLowerCase().includes(searchFilter.toLowerCase()) ||
             e.deduplicationKey.toLowerCase().includes(searchFilter.toLowerCase()))
          : true);
    
    // Platform select filter
    const matchesPlatform = platformFilters.length > 0 ? platformFilters.includes(e.platform) : true;
    
    // Status select filter
    const matchesStatus = statusFilters.length > 0 ? statusFilters.includes(e.status) : true;

    return matchesSearch && matchesPlatform && matchesStatus;
  });

  const filteredApiLogsForTable = apiLogs.filter(l => {
    const matchesSearch = searchVal 
      ? (l.endpoint.toLowerCase().includes(searchVal.toLowerCase()) || l.statusCode.toString().includes(searchVal))
      : true;
    const matchesPlatform = platformFilters.length > 0 ? platformFilters.includes(l.platform) : true;
    return matchesSearch && matchesPlatform;
  });

  // Calculate platform statistics
  const getPlatformStats = (p: Platform) => {
    const serverStats = recoverySummary?.platform_stats?.[p];
    if (serverStats) {
      const total = Number(serverStats.attempts || 0);
      const successful = Number(serverStats.successful || 0);
      const rate = total > 0 ? Math.round((successful / total) * 100) : 0;
      const lastTime = serverStats.last_event_at
        ? new Date(serverStats.last_event_at).toLocaleTimeString()
        : 'N/A';
      return { total, rate, lastTime };
    }
    const pEvs = events.filter(e => e.platform === p);
    const total = pEvs.length;
    const succs = pEvs.filter(e => e.status === 'Success').length;
    const rate = total > 0 ? Math.round((succs / total) * 100) : 100;
    const lastTime = pEvs[0] ? new Date(pEvs[0].timestamp).toLocaleTimeString() : 'N/A';
    return { total, rate, lastTime };
  };

  const metaStats = getPlatformStats('Meta CAPI');
  const tiktokStats = getPlatformStats('TikTok Events API');
  const ga4Stats = getPlatformStats('GA4');



  // Suggestions optimization score
  const unresolvedSuggestions = suggestions.filter(s => !s.resolved);
  const resolvedCount = suggestions.length - unresolvedSuggestions.length;
  const totalSuggCount = suggestions.length;
  const suggestionsCount = unresolvedSuggestions.length;
  const totalOrderVerificationCount = Number(deferredData?.pendingCount ?? deferredData?.pendingList?.length ?? 0);
  const totalDeliveryBadgeCount = courierOrders.filter(order => {
    const status = String(order?.courier_status || '').toLowerCase();
    return status && !['delivered', 'returned', 'cancelled', 'canceled'].includes(status);
  }).length;
  const orderVerificationCount = Number(sidebarStatus?.orderVerificationNew ?? totalOrderVerificationCount);
  const deliveryBadgeCount = Number(sidebarStatus?.ordersDeliveryNew ?? totalDeliveryBadgeCount);
  const incompleteCheckoutCount = Number(incompleteCheckoutData?.counts?.incomplete ?? 0);
  const severityPenalty = unresolvedSuggestions.reduce((total, suggestion) => {
    if (suggestion.severity === 'Critical') return total + 25;
    if (suggestion.severity === 'Warning') return total + 15;
    return total + 8;
  }, 0);
  const optScore = Math.max(0, Math.min(100, 100 - severityPenalty));
  const pageTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    analytics: 'Insights',
    'pending-purchases': 'COD Protection',
    orders: 'Courier Shipping',
    'incomplete-checkouts': 'Incomplete Orders',
    'campaign-builder': 'Campaign Tools',
    suggestions: 'Setup Health',
    'event-logs': 'Event Logs',
    'api-logs': 'API Logs',
    settings: 'Settings',
    'setup-guide': 'Setup Guide',
    account: 'Account',
  };

  if (isPluginConnectRoute) {
    return <PluginConnectAuthorizeView />;
  }

  return (
    <div className="bk-console-shell flex min-h-screen font-sans transition-colors duration-200">
      {/* Sidebar Navigation */}
      {profile && (
        <Sidebar 
          activePage={activePage} 
          setActivePage={setActivePage} 
          profile={profile} 
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          setMobileOpen={setMobileSidebarOpen}
          onLogout={handleClientLogout}
          orderManagementEnabled={true}
          suggestionsCount={suggestionsCount}
          orderVerificationCount={orderVerificationCount}
          deliveryBadgeCount={deliveryBadgeCount}
          incompleteCheckoutCount={incompleteCheckoutCount}
          stores={stores}
          onSwitchStore={handleSwitchStore}
          onCreateStore={() => setCreateStoreModalOpen(true)}
        />
      )}

      {/* Mobile Drawer Overlay Backdrop */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-[1px] transition-opacity duration-200 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {showDemoResetConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Reset demo data?</h3>
              <p className="text-xs leading-relaxed text-slate-500">This restores demo metrics and tracking history to their default values.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDemoResetConfirm(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDemoReset}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[288px]'}`}>
        {connection && (
          <Header 
            title={pageTitles[activePage] || activePage.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} 
            connection={connection}
            onRefreshConnection={refreshWPHeartbeat}
            searchVal={searchVal}
            setSearchVal={setSearchVal}
            onMenuClick={() => setMobileSidebarOpen(true)}
            suggestions={suggestions}
            setActivePage={setActivePage}
            onOpenGuide={profile?.guideDismissed ? undefined : openProductGuide}
          />
        )}

        <main className="flex-1 min-w-0">
        {/* Global Error Banner */}
        {errState && (
          <div className="m-4 md:m-8 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-bold">Connection Error</h4>
              <p className="text-xs mt-1 text-rose-700">{errState}</p>
              <button 
                onClick={() => loadSystemData()} 
                className="mt-3 px-3 py-1 bg-rose-600 text-white rounded text-xs font-semibold hover:bg-rose-700"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Main Dashboard Skeleton */}
        {loading && !errState ? (
          <div className="bk-console-page flex-1 space-y-6 p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                  <div className="h-4 bg-slate-100 rounded w-1/2" />
                  <div className="h-8 bg-slate-200 rounded w-3/4" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 animate-pulse">
              <div className="lg:col-span-2 h-72 rounded-xl border border-slate-200 bg-white p-6" />
              <div className="lg:col-span-1 h-72 rounded-xl border border-slate-200 bg-white p-6" />
            </div>
            <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
          </div>
        ) : !errState && (
          <div className="bk-console-page flex-1 space-y-4 p-4 sm:p-5 md:space-y-6 md:p-6">

            {/* --- CORE VIEWS DISPATCHER --- */}
            <PageErrorBoundary pageKey={activePage}>
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <span className="text-sm text-slate-400 font-medium">Loading...</span>
                </div>
              </div>
            }>

            {/* PAGE 1: DASHBOARD */}
            {activePage === 'dashboard' && profile && (
              <>
              <WeeklyReportCard />
              <DashboardView 
                profile={profile}
                events={events}
                trendData={trendData}
                recoverySummary={recoverySummary}
                metaStats={metaStats}
                tiktokStats={tiktokStats}
                ga4Stats={ga4Stats}
                optScore={optScore}
                resolvedCount={resolvedCount}
                totalSuggCount={totalSuggCount}
                setActivePage={setActivePage}
                expandedEventId={expandedEventId}
                setExpandedEventId={setExpandedEventId}
                copiedStates={copiedStates}
                handleCopy={handleCopy}
                analyticsDays={analyticsDays}
                setAnalyticsDays={setAnalyticsDays}
              />
              </>
            )}

            {/* PAGE 11: COD verification queue */}
            {activePage === 'pending-purchases' && (
              <CodProtectionView
                deferredData={deferredData ?? { pendingList: [], pendingCount: 0, pendingValue: 'BDT 0', confirmedToday: 0, oldestPending: 'N/A' }}
                selectedOrderIds={selectedOrderIds}
                setSelectedOrderIds={setSelectedOrderIds}
                handleBulkConfirm={handleBulkConfirm}
                handleBulkCancel={handleBulkCancel}
                handleConfirmOrder={handleConfirmOrder}
                handleCancelOrder={handleCancelOrder}
                deferredEnabled={deferredEnabled}
                setDeferredEnabled={setDeferredEnabled}
                autoConfirmDays={autoConfirmDays}
                setAutoConfirmDays={setAutoConfirmDays}
                autoConfirmStatus={autoConfirmStatus}
                setAutoConfirmStatus={setAutoConfirmStatus}
                savingDeferredSettings={savingDeferredSettings}
                handleSaveDeferredSettings={handleSaveDeferredSettings}
                growthFeaturesEnabled={profile?.growthFeaturesEnabled}
              />
            )}

            {activePage === 'orders' && (
              <OrdersView
                deferredData={deferredData || { pendingList: [] }}
                deferredLoadError={deferredLoadError}
                fetchDeferred={fetchDeferred}
                showToast={showToast}
                storeName={profile?.name}
                storeEmail={profile?.email}
              />
            )}

            {activePage === 'incomplete-checkouts' && (
              <IncompleteCheckoutsView
                data={incompleteCheckoutData}
                onStatusChange={handleIncompleteCheckoutStatus}
                onCreateOrder={handleCreateRecoveryOrder}
                onRefresh={() => fetchIncompleteCheckouts({ refresh: true })}
                showToast={showToast}
              />
            )}

            {/* PAGE 3: ANALYTICS */}
            {activePage === 'analytics' && (
              <AnalyticsView 
                analyticsOverview={analyticsOverview}
                analyticsCampaigns={analyticsCampaigns}
                analyticsAudience={analyticsAudience}
                signalDoctor={signalDoctor}
                analyticsError={analyticsError}
                analyticsDays={analyticsDays}
                setAnalyticsDays={setAnalyticsDays}
              />
            )}

            {/* PAGE 4: EVENT LOGS */}
            {activePage === 'event-logs' && (
              <EventLogsView 
                filteredEventsForTable={filteredEventsForTable}
                searchFilter={searchFilter}
                setSearchFilter={setSearchFilter}
                liveMode={liveMode}
                setLiveMode={setLiveMode}
                platformFilters={platformFilters}
                setPlatformFilters={setPlatformFilters}
                statusFilters={statusFilters}
                setStatusFilters={setStatusFilters}
                setSearchVal={setSearchVal}
                expandedEventId={expandedEventId}
                setExpandedEventId={setExpandedEventId}
                copiedStates={copiedStates}
                handleCopy={handleCopy}
                handleExportData={handleExportData}
                outboxItems={outboxItems}
                retryingOutboxIds={retryingOutboxIds}
                handleRetryOutbox={handleRetryOutbox}
              />
            )}

            {/* PAGE 5: API LOGS */}
            {activePage === 'api-logs' && (
              <ApiLogsView 
                filteredApiLogsForTable={filteredApiLogsForTable}
                expandedApiLogId={expandedApiLogId}
                setExpandedApiLogId={setExpandedApiLogId}
                handleExportData={handleExportData}
              />
            )}

            {/* PAGE 6: SETTINGS */}
            {activePage === 'settings' && credentials && connection && (
              <SettingsView 
                initialSectionId={activeRouteSection}
                credentials={credentials}
                connection={connection}
                rules={rules}
                customEventAutomations={customEventAutomations}
                handleUpdatePlatform={handleUpdatePlatform}
                handleToggleRule={handleToggleRule}
                handleAddRule={handleAddRule}
                handleRemoveRule={handleRemoveRule}
                handleApplyEventPreset={handleApplyEventPreset}
                handleSaveCustomEventAutomations={handleSaveCustomEventAutomations}
                refreshWPHeartbeat={refreshWPHeartbeat}
                copiedStates={copiedStates}
                handleCopy={handleCopy}
                showToast={showToast}
                growthFeaturesEnabled={profile?.growthFeaturesEnabled}
                deferredEnabled={deferredEnabled}
                autoConfirmDays={autoConfirmDays}
                autoConfirmStatus={autoConfirmStatus}
                pluginReleaseInfo={pluginReleaseInfo}
                storeDomain={currentStore?.domain || ''}
                onSaveStoreDomain={handleSaveStoreDomain}
                onOpenPage={setActivePage}
                profNotifyWhatsapp={profNotifyWhatsapp}
                setProfNotifyWhatsapp={setProfNotifyWhatsapp}
                profWhatsappNumber={profWhatsappNumber}
                setProfWhatsappNumber={setProfWhatsappNumber}
                profUpdating={profUpdating}
                submitProfileSave={submitProfileSave}
              />
            )}

            {/* PAGE 7: SETUP GUIDE */}
            {activePage === 'setup-guide' && (
              <SetupGuideView 
                faqExpanded={faqExpanded}
                setFaqExpanded={setFaqExpanded}
                copiedStates={copiedStates}
                handleCopy={handleCopy}
                setActivePage={setActivePage}
                api_key={connection?.api_key}
                public_key={connection?.token}
                pluginReleaseInfo={pluginReleaseInfo}
              />
            )}

            {/* PAGE 8: SUGGESTIONS */}
            {activePage === 'suggestions' && (
              <SuggestionsView 
                suggestions={suggestions}
                optScore={optScore}
                aiReviewing={aiReviewing}
                handleAiReview={handleAiReview}
                toggleResolveSuggestion={toggleResolveSuggestion}
                dismissSuggestion={dismissSuggestion}
              />
            )}

            {/* PAGE 9: CAMPAIGN BUILDER */}
            {activePage === 'campaign-builder' && (
              <CampaignBuilderView 
                builderPlatform={builderPlatform}
                setBuilderPlatform={setBuilderPlatform}
                builderEventName={builderEventName}
                setBuilderEventName={setBuilderEventName}
                builderValue={builderValue}
                setBuilderValue={setBuilderValue}
                builderCurrency={builderCurrency}
                setBuilderCurrency={setBuilderCurrency}
                builderEmail={builderEmail}
                setBuilderEmail={setBuilderEmail}
                builderPhone={builderPhone}
                setBuilderPhone={setBuilderPhone}
                builderIp={builderIp}
                setBuilderIp={setBuilderIp}
                builderUa={builderUa}
                setBuilderUa={setBuilderUa}
                customParams={customParams}
                setCustomParams={setCustomParams}
                campaignResp={campaignResp}
                dispatchingTest={dispatchingTest}
                handleDispatchSandboxTest={handleDispatchSandboxTest}
                urlBuilderBaseUrl={urlBuilderBaseUrl}
                setUrlBuilderBaseUrl={setUrlBuilderBaseUrl}
                urlBuilderSource={urlBuilderSource}
                setUrlBuilderSource={setUrlBuilderSource}
                urlBuilderMedium={urlBuilderMedium}
                setUrlBuilderMedium={setUrlBuilderMedium}
                urlBuilderCampaign={urlBuilderCampaign}
                setUrlBuilderCampaign={setUrlBuilderCampaign}
                urlBuilderContent={urlBuilderContent}
                setUrlBuilderContent={setUrlBuilderContent}
                urlBuilderTerm={urlBuilderTerm}
                setUrlBuilderTerm={setUrlBuilderTerm}
                urlBuilderAdPlatform={urlBuilderAdPlatform}
                setUrlBuilderAdPlatform={setUrlBuilderAdPlatform}
                urlBuilderCampaignId={urlBuilderCampaignId}
                setUrlBuilderCampaignId={setUrlBuilderCampaignId}
                syncedAdCampaigns={syncedAdCampaigns}
                loadingSyncedAdCampaigns={loadingSyncedAdCampaigns}
                generatedCampaignUrl={generatedCampaignUrl}
                handleGenerateCampaignUrl={handleGenerateCampaignUrl}
                copiedStates={copiedStates}
                handleCopy={handleCopy}
              />
            )}

            {/* PAGE 10: ACCOUNT */}
            {activePage === 'account' && profile && (
              <AccountView 
                profile={profile}
                profName={profName}
                setProfName={setProfName}
                profEmail={profEmail}
                setProfEmail={(value) => {
                  setProfEmail(value);
                  setProfEmailCodeRequested(false);
                  setProfEmailCode('');
                  setProfEmailCurrentPassword('');
                }}
                profEmailCodeRequested={profEmailCodeRequested}
                profEmailCode={profEmailCode}
                setProfEmailCode={setProfEmailCode}
                profEmailCurrentPassword={profEmailCurrentPassword}
                setProfEmailCurrentPassword={setProfEmailCurrentPassword}
                profNotifEmail={profNotifEmail}
                setProfNotifEmail={setProfNotifEmail}
                profNotifyWhatsapp={profNotifyWhatsapp}
                setProfNotifyWhatsapp={setProfNotifyWhatsapp}
                profWhatsappNumber={profWhatsappNumber}
                setProfWhatsappNumber={setProfWhatsappNumber}
                profUpdating={profUpdating}
                submitProfileSave={submitProfileSave}
                passCurrent={passCurrent}
                setPassCurrent={setPassCurrent}
                passNew={passNew}
                setPassNew={setPassNew}
                passConfirm={passConfirm}
                setPassConfirm={setPassConfirm}
                submitPasswordUpdate={submitPasswordUpdate}
                submitPasswordResetEmail={submitPasswordResetEmail}
                confirmRevokeText={confirmRevokeText}
                setConfirmRevokeText={setConfirmRevokeText}
                confirmDeleteText={confirmDeleteText}
                setConfirmDeleteText={setConfirmDeleteText}
                handleTokenRevoke={handleTokenRevoke}
                handleDeleteAccountRequest={handleDeleteAccountRequest}
                handleDemoReset={handleDemoReset}
                showToast={showToast}
              />
            )}

            </Suspense>
            </PageErrorBoundary>

            {/* --- END DISPATCHER --- */}

          </div>
        )}
        </main>
      </div>

      {/* Persistent notifications overlay alert */}
      {globalToast.show && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border border-slate-200 shadow-xl bg-white animate-slide-in-up">
          {globalToast.err ? (
            <XCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 animate-bounce" />
          )}
          <span className="text-xs text-slate-800 font-medium">
            {globalToast.msg}
          </span>
          {globalToast.actionLabel && globalToast.onAction && (
            <button
              type="button"
              onClick={() => {
                const action = globalToast.onAction;
                setGlobalToast(prev => ({ ...prev, show: false }));
                action?.();
              }}
              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50"
            >
              {globalToast.actionLabel}
            </button>
          )}
        </div>
      )}

      {/* Create Store Modal */}
      <CreateStoreModal
        open={createStoreModalOpen}
        onClose={() => setCreateStoreModalOpen(false)}
        showToast={showToast}
        onCreated={() => {
          fetchStores();
          loadSystemData(true);
          setActivePage('dashboard');
        }}
      />
      <ProductGuide
        open={productGuideOpen}
        onClose={closeProductGuide}
        setActivePage={setActivePage}
        setMobileSidebarOpen={setMobileSidebarOpen}
      />
      <SupportWidget showToast={showToast} />
    </div>
  );
}
