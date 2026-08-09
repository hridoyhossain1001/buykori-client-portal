/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { CreateStoreModal } from './components/CreateStoreModal';
import { Header } from './components/Header';
import { PluginConnectAuthorizeView } from './components/PluginConnectAuthorizeView';
import { ProductGuide } from './components/ProductGuide';
import { SupportWidget } from './components/SupportWidget';
import { PluginUpdateModal } from './components/PluginUpdateModal';
import { CAPIEvent, APILog, Suggestion, Platform, EventRule, PlatformConfig, UserProfile, ClientConnection, OutboxItem, PluginReleaseInfo, CustomEventAutomation, CourierOrder, DeferredData, IncompleteCheckoutData, RecoveryOrderPayload, SidebarStatus, StoreInfo, AnalyticsAudience, AnalyticsCampaigns, AnalyticsOverview, CampaignDispatchResponse, RecoverySummary, SignalDoctor, TrendPoint } from './types';
import { clientPathForPage, clientPathForSection, isClientPageId, resolveClientRoute } from './lib/clientRoutes';
import { comparePluginVersions, errorMessage, normalizePluginVersion, uniqueSuggestions } from './lib/clientAppUtils';
import { copyText } from './lib/clipboard';
import { fetchAnalyticsBundle, fetchDashboardAnalytics } from './services/analyticsApi';
import { fetchClientStores, fetchDeferredData, markClientSidebarSeen, runDeferredBulkAction, runDeferredOrderAction, saveClientStoreDomain, saveDeferredSettings, switchClientStore } from './services/operationsApi';
import { requestAccountDeletion, requestProfileEmailCode, revokeClientConnection, sendPasswordResetEmail, updateClientPassword, updateClientProfile } from './services/accountApi';
import {
  AccountView,
  AnalyticsView,
  ApiLogsView,
  CampaignBuilderView,
  CodProtectionView,
  DashboardView,
  EventLogsView,
  IncompleteCheckoutsView,
  OrderSuccessView,
  OrdersView,
  SettingsView,
  SetupGuideView,
  SuggestionsView,
  WeeklyReportCard,
  pageTitleFor,
} from './app/lazyViews';
import { PageErrorBoundary } from './app/PageErrorBoundary';
import { ConnectionErrorBanner, ConsoleSkeleton, PageSuspenseFallback } from './app/AppShellStates';
import { GlobalToast, type GlobalToastState } from './app/GlobalToast';
import { useCampaignUrlBuilder } from './app/useCampaignUrlBuilder';
import { ErrorState } from './components/common';
import { describeFetchError, describeResponseError, isAbortError } from './lib/http';

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
  const [eventsLoading, setEventsLoading] = useState<boolean>(false);
  const [eventsLoadError, setEventsLoadError] = useState<string | null>(null);
  const [eventsLastFetchedAt, setEventsLastFetchedAt] = useState<string | null>(null);
  const eventsRequestIdRef = useRef(0);
  const activePageRef = useRef(activePage);
  const systemDataAbortRef = useRef<AbortController | null>(null);
  const storesAbortRef = useRef<AbortController | null>(null);
  const [apiLogs, setApiLogs] = useState<APILog[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [retryingOutboxIds, setRetryingOutboxIds] = useState<number[]>([]);
  const [deferredData, setDeferredData] = useState<DeferredData | null>(null);
  const [courierOrders] = useState<CourierOrder[]>([]);
  const [sidebarStatus, setSidebarStatus] = useState<SidebarStatus | null>(null);
  const [incompleteCheckoutData, setIncompleteCheckoutData] = useState<IncompleteCheckoutData>({ items: [], counts: {} });
  const [pluginReleaseInfo, setPluginReleaseInfo] = useState<PluginReleaseInfo | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [deferredEnabled, setDeferredEnabled] = useState<boolean>(false);
  const [autoConfirmDays, setAutoConfirmDays] = useState<number>(0);
  const [autoConfirmStatus, setAutoConfirmStatus] = useState<string>('completed');
  const [savingDeferredSettings, setSavingDeferredSettings] = useState<boolean>(false);
  // Guards against duplicate COD mutations: a second click while the first
  // confirm/skip/restore request is still in flight would double-submit.
  const [codBusyOrderIds, setCodBusyOrderIds] = useState<string[]>([]);
  const [codBulkBusy, setCodBulkBusy] = useState<boolean>(false);
  // Same guard for per-suggestion resolve/dismiss.
  const [suggestionBusyIds, setSuggestionBusyIds] = useState<string[]>([]);

  // Multiple Store Management
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [createStoreModalOpen, setCreateStoreModalOpen] = useState<boolean>(false);

  // Advanced Analytics States
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(null);
  const [analyticsCampaigns, setAnalyticsCampaigns] = useState<AnalyticsCampaigns | null>(null);
  const [analyticsAudience, setAnalyticsAudience] = useState<AnalyticsAudience | null>(null);
  const [signalDoctor, setSignalDoctor] = useState<SignalDoctor | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState<number>(7);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [recoverySummary, setRecoverySummary] = useState<RecoverySummary | null>(null);

  // Async Lifecycle States
  const [loading, setLoading] = useState<boolean>(true);
  const [aiReviewing, setAiReviewing] = useState<boolean>(false);
  const [errState, setErrState] = useState<string | null>(null);
  const [workspaceLoadError, setWorkspaceLoadError] = useState<{ page: string; message: string } | null>(null);
  const [workspaceRetrying, setWorkspaceRetrying] = useState<boolean>(false);
  const [pluginUpdateOpen, setPluginUpdateOpen] = useState<boolean>(false);
  const shownPluginUpdateRef = useRef<string>('');

  // Live Mode Polling State
  const [liveMode, setLiveMode] = useState<boolean>(false);

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
  const [campaignResp, setCampaignResp] = useState<CampaignDispatchResponse | null>(null);
  const [dispatchingTest, setDispatchingTest] = useState<boolean>(false);

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
  const [globalToast, setGlobalToast] = useState<GlobalToastState>({ show: false, msg: '', err: false });
  const [productGuideOpen, setProductGuideOpen] = useState<boolean>(false);
  const [deferredLoadError, setDeferredLoadError] = useState<string | null>(null);

  // A single pending auto-dismiss timer. Kept in a ref so a newer toast can
  // cancel the previous timer before it hides the message now on screen.
  const toastTimerRef = useRef<number | null>(null);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearToastTimer();
    setGlobalToast(prev => ({ ...prev, show: false }));
  }, [clearToastTimer]);

  const showToast = useCallback((msg: string, isErr = false, action?: { label: string; onClick: () => void }) => {
    clearToastTimer();
    setGlobalToast({ show: true, msg, err: isErr, actionLabel: action?.label, onAction: action?.onClick });
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setGlobalToast(prev => ({ ...prev, show: false }));
    }, 4000);
  }, [clearToastTimer]);

  useEffect(() => clearToastTimer, [clearToastTimer]);

  const campaignUrlBuilder = useCampaignUrlBuilder(profile, showToast);

  const setActivePage = useCallback((pageId: string) => {
    const nextPage = isClientPageId(pageId) ? pageId : 'dashboard';
    const nextPath = clientPathForPage(nextPage) || '/dashboard';
    activePageRef.current = nextPage;
    setSearchVal('');
    setActivePageState(nextPage);
    setActiveRouteSection(null);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({ buykoriPage: nextPage }, '', nextPath);
    }
  }, []);

  useEffect(() => {
    if (isPluginConnectRoute) return;

    const currentRoute = resolveClientRoute(window.location.pathname);
    if (currentRoute && window.location.pathname !== currentRoute.canonicalPath) {
      window.history.replaceState({ buykoriPage: currentRoute.pageId }, '', currentRoute.canonicalPath);
    }

    const handlePopState = () => {
      const route = resolveClientRoute(window.location.pathname);
      if (!route) return;
      activePageRef.current = route.pageId;
      setActivePageState(route.pageId);
      setActiveRouteSection(route.sectionId);
      setMobileSidebarOpen(false);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isPluginConnectRoute]);

  useEffect(() => {
    activePageRef.current = activePage;
  }, [activePage]);

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

  useEffect(() => {
    if (loading || !profile || isPluginConnectRoute || pluginUpdateOpen) return;
    if (profile.guideDismissed || localStorage.getItem(getGuideStorageKey(profile)) === '1') return;
    const timer = window.setTimeout(() => setProductGuideOpen(true), 650);
    return () => window.clearTimeout(timer);
  }, [loading, profile, isPluginConnectRoute, pluginUpdateOpen]);

  const installedPluginVersion = normalizePluginVersion(connection?.pluginVersion);
  const latestPluginVersion = normalizePluginVersion(pluginReleaseInfo?.version);
  const pluginUpdateAvailable = Boolean(
    connection?.bindingVerified
    && installedPluginVersion
    && latestPluginVersion
    && comparePluginVersions(installedPluginVersion, latestPluginVersion) < 0
  );

  useEffect(() => {
    if (loading || !profile || isPluginConnectRoute || !pluginUpdateAvailable) return;
    const promptKey = `${profile.email}:${connection?.siteHost || ''}:${installedPluginVersion}:${latestPluginVersion}`;
    if (shownPluginUpdateRef.current === promptKey) return;
    shownPluginUpdateRef.current = promptKey;
    setProductGuideOpen(false);
    setPluginUpdateOpen(true);
  }, [
    loading,
    profile,
    connection?.siteHost,
    isPluginConnectRoute,
    pluginUpdateAvailable,
    installedPluginVersion,
    latestPluginVersion,
  ]);

  const openWordPressPluginUpdates = () => {
    const rawHost = String(connection?.siteHost || '').trim();
    if (!rawHost) {
      setPluginUpdateOpen(false);
      setActivePage('settings');
      showToast('Open WordPress > Plugins and update Buykori AdSync.', false);
      return;
    }
    try {
      const siteUrl = new URL(/^https?:\/\//i.test(rawHost) ? rawHost : 'https://' + rawHost);
      window.open(siteUrl.origin + '/wp-admin/plugins.php', '_blank', 'noopener,noreferrer');
      setPluginUpdateOpen(false);
    } catch {
      setPluginUpdateOpen(false);
      setActivePage('settings');
      showToast('Open WordPress > Plugins and update Buykori AdSync.', false);
    }
  };

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

  // Helper code copy. The "Copied" badge is only shown once the clipboard write
  // has actually resolved, so a denied/failed write reports an error instead.
  const handleCopy = async (text: string, labelId: string) => {
    const copied = await copyText(text);
    if (!copied) {
      showToast('Could not copy to clipboard.', true);
      return;
    }
    setCopiedStates(prev => ({ ...prev, [labelId]: true }));
    window.setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [labelId]: false }));
    }, 2000);
  };

  const fetchDeferred = async (signal?: AbortSignal) => {
    try {
      const data = await fetchDeferredData(signal);
      setDeferredData(data);
      setDeferredEnabled(Boolean(data.deferredEnabled));
      setAutoConfirmDays(Number(data.autoConfirmDays || 0));
      setAutoConfirmStatus(data.autoConfirmStatus || 'completed');
      setDeferredLoadError(null);
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("Failed to fetch COD Protection", err);
      setDeferredData(prev => prev || { pendingList: [], pendingCount: 0, pendingValue: 0 });
      setDeferredLoadError(err instanceof Error ? err.message : 'Could not load the verification queue.');
      throw err;
    }
  };

  const refreshIncompleteCheckoutStates = async (signal?: AbortSignal) => {
    const res = await fetch('/api/incomplete-checkouts/refresh', { method: 'POST', signal });
    if (!res.ok && res.status !== 403) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Could not refresh incomplete checkouts (${res.status}).`);
    }
  };

  const fetchIncompleteCheckouts = async (options: { refresh?: boolean; signal?: AbortSignal } = {}) => {
    try {
      if (options.refresh) {
        await refreshIncompleteCheckoutStates(options.signal);
      }
      const res = await fetch('/api/incomplete-checkouts', { signal: options.signal });
      if (res.ok) {
        setIncompleteCheckoutData(await res.json());
      } else if (res.status === 403) {
        setIncompleteCheckoutData({ items: [], counts: {}, restricted: true });
      } else {
        throw new Error(describeResponseError(res));
      }
    } catch (err) {
      if (isAbortError(err)) return;
      console.error('Failed to fetch incomplete checkouts', err);
      throw err;
    }
  };

  const fetchEvents = async (signal?: AbortSignal) => {
    const requestId = ++eventsRequestIdRef.current;
    setEventsLoading(true);
    setEventsLoadError(null);
    try {
      const [eventsRes, outboxRes] = await Promise.all([
        fetch('/api/events?limit=100', { signal }),
        fetch('/api/outbox?limit=100', { signal }),
      ]);
      if (isAuthFailure([eventsRes])) {
        redirectToClientLogin();
        return;
      }
      if (!eventsRes.ok) {
        throw new Error(`Event history could not load (${eventsRes.status}).`);
      }
      const eventData = await eventsRes.json();
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

      if (requestId !== eventsRequestIdRef.current) return;
      setEvents(
        [...ingestEvents, ...loggedEvents]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 200)
      );
      setEventsLastFetchedAt(new Date().toISOString());
    } catch (error) {
      if (isAbortError(error)) return;
      if (requestId === eventsRequestIdRef.current) {
        setEventsLoadError(error instanceof Error ? error.message : 'Event history could not load.');
      }
      throw error;
    } finally {
      if (requestId === eventsRequestIdRef.current) setEventsLoading(false);
    }
  };

  const fetchApiLogs = async (signal?: AbortSignal) => {
    const res = await fetch('/api/api-logs?limit=100', { signal });
    if (!res.ok) throw new Error(describeResponseError(res));
    const data = await res.json();
    setApiLogs(data.logs || []);
  };

  const fetchTrendData = async (days = 7, signal?: AbortSignal) => {
    try {
      const data = await fetchDashboardAnalytics(days, signal);
      if (data.trend) setTrendData(data.trend);
      if (data.recoverySummary) setRecoverySummary(data.recoverySummary);
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("Failed to fetch trend data", err);
      throw err;
    }
  };

  const fetchOutbox = async (signal?: AbortSignal) => {
    const res = await fetch('/api/outbox?limit=25', { signal });
    if (res.ok) {
      const data = await res.json();
      setOutboxItems(data.items || []);
    }
  };

  const fetchSettingsData = async (signal?: AbortSignal) => {
    const [resCreds, resRules, resAutomations] = await Promise.all([
      fetch('/api/credentials', { signal }),
      fetch('/api/rules', { signal }),
      fetch('/api/custom-event-automations', { signal }),
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

  const loadActivePageData = async (page: string, signal?: AbortSignal) => {
    if (page === 'pending-purchases' || page === 'orders') {
      await fetchDeferred(signal);
    } else if (page === 'incomplete-checkouts') {
      await fetchIncompleteCheckouts({ refresh: true, signal });
    } else if (page === 'event-logs') {
      await Promise.all([fetchEvents(signal), fetchOutbox(signal)]);
    } else if (page === 'api-logs') {
      await fetchApiLogs(signal);
    } else if (page === 'settings') {
      await fetchSettingsData(signal);
    }
  };

  const retryActiveWorkspace = async () => {
    const page = activePageRef.current;
    setWorkspaceRetrying(true);
    setWorkspaceLoadError(null);
    try {
      if (page === 'dashboard') {
        await Promise.all([fetchTrendData(analyticsDays), fetchEvents()]);
      } else {
        await loadActivePageData(page);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        setWorkspaceLoadError({ page, message: errorMessage(error, describeFetchError(error)) });
      }
    } finally {
      setWorkspaceRetrying(false);
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

  const handleCreateRecoveryOrder = async (id: number, payload: RecoveryOrderPayload) => {
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
    systemDataAbortRef.current?.abort();
    const controller = new AbortController();
    systemDataAbortRef.current = controller;
    const { signal } = controller;
    if (showShimmer) setLoading(true);
    try {
      // Route-specific payloads load when their workspace opens.
      const [
        resProf, resConn, resSugg, resSidebar, resPlugin, resTrend
      ] = await Promise.all([
        fetch('/api/profile', { signal }),
        fetch('/api/connection', { signal }),
        fetch('/api/suggestions', { signal }),
        fetch('/api/sidebar/status', { signal }),
        fetch('/api/v1/plugin/info', { signal }),
        fetch(`/api/events/trend?days=${analyticsDays}`, { signal })
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
      const dSidebar = resSidebar.ok ? await resSidebar.json() : null;
      const dPlugin = resPlugin.ok ? await resPlugin.json() : null;
      const dTrend = resTrend.ok ? await resTrend.json() : { trend: [] };

      setProfile(dProf);
      setConnection(dConn);
      setSuggestions(uniqueSuggestions(dSugg));
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
      await loadActivePageData(activePageRef.current, signal).catch(error => {
        if (isAbortError(error)) return;
        console.error(`Failed to load ${activePageRef.current} workspace`, error);
        const page = activePageRef.current;
        if (page !== 'orders' && page !== 'event-logs' && page !== 'analytics') {
          setWorkspaceLoadError({ page, message: errorMessage(error, describeFetchError(error)) });
        }
      });
    } catch (e: unknown) {
      if (isAbortError(e)) return;
      console.error(e);
      setErrState(errorMessage(e, "Something went wrong. Please refresh or try again."));
    } finally {
      if (systemDataAbortRef.current === controller) {
        systemDataAbortRef.current = null;
        setLoading(false);
      }
    }
  };

  const loadAnalyticsData = async (days = 7, signal?: AbortSignal) => {
    try {
      setAnalyticsError(null);
      const data = await fetchAnalyticsBundle(days, signal);
      if (data.overview) setAnalyticsOverview(data.overview);
      if (data.campaigns) setAnalyticsCampaigns(data.campaigns);
      if (data.audience) setAnalyticsAudience(data.audience);
      if (data.signalDoctor) setSignalDoctor(data.signalDoctor);
      if (data.failedSections.length) {
        setAnalyticsError(`Some ad insight data could not load: ${data.failedSections.join(', ')}.`);
      }
    } catch (err) {
      if (isAbortError(err)) return;
      console.error("Failed to load analytics data", err);
      setAnalyticsError("Ad insight data could not load. Please refresh and try again.");
    }
  };

  useEffect(() => {
    if (isPluginConnectRoute) return;
    loadSystemData(true);
    fetchStores();
    return () => {
      systemDataAbortRef.current?.abort();
      storesAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isPluginConnectRoute) return;
    const controller = new AbortController();
    if (profile) {
      if (activePage === 'analytics') {
        loadAnalyticsData(analyticsDays, controller.signal);
      } else if (activePage === 'dashboard') {
        setWorkspaceLoadError(current => current?.page === 'dashboard' ? null : current);
        Promise.all([fetchTrendData(analyticsDays, controller.signal), fetchEvents(controller.signal)]).catch(err => {
          if (isAbortError(err)) return;
          console.error('Failed to load dashboard activity', err);
          setWorkspaceLoadError({ page: 'dashboard', message: errorMessage(err, describeFetchError(err)) });
        });
      }
    }
    return () => controller.abort();
  }, [analyticsDays, profile, activePage]);

  const fetchStores = async () => {
    storesAbortRef.current?.abort();
    const controller = new AbortController();
    storesAbortRef.current = controller;
    try {
      setStores(await fetchClientStores(controller.signal));
    } catch (err) {
      if (isAbortError(err)) return;
      console.error('Failed to fetch stores', err);
    } finally {
      if (storesAbortRef.current === controller) storesAbortRef.current = null;
    }
  };

  const currentStore = stores.find(store => store.is_current);

  const handleSaveStoreDomain = async (domain: string) => {
    try {
      const data = await saveClientStoreDomain(domain);
      showToast(data.domain ? 'Store domain saved.' : 'Store domain cleared.', false);
      await Promise.all([fetchStores(), fetchSettingsData()]);
    } catch (error) {
      showToast(errorMessage(error, 'Could not save the store domain.'), true);
    }
  };

  const handleSwitchStore = async (clientId: number) => {
    try {
      await switchClientStore(clientId);
      showToast('Switching store...', false);
      setTimeout(() => {
        loadSystemData(true);
        fetchStores();
        setActivePage('dashboard');
      }, 400);
    } catch (error) {
      showToast(errorMessage(error, 'Network error while switching store.'), true);
    }
  };


  const markSidebarSeen = async (section: 'order_verification' | 'orders_delivery') => {
    const isOrderVerification = section === 'order_verification';

    setSidebarStatus(prev => prev ? {
      ...prev,
      orderVerificationNew: isOrderVerification ? 0 : prev.orderVerificationNew,
      ordersDeliveryNew: isOrderVerification ? prev.ordersDeliveryNew : 0,
    } : prev);

    try {
      const status = await markClientSidebarSeen(section);
      if (status) setSidebarStatus(status);
    } catch (err) {
      console.error("Failed to update sidebar seen state", err);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    if (activePage === 'pending-purchases') {
      markSidebarSeen('order_verification');
    } else if (activePage === 'orders') {
      markSidebarSeen('orders_delivery');
    }
    if (activePage !== 'dashboard') {
      setWorkspaceLoadError(current => current?.page === activePage ? null : current);
      loadActivePageData(activePage, controller.signal).catch(err => {
        if (isAbortError(err)) return;
        console.error(`Failed to load ${activePage} workspace`, err);
        if (activePage !== 'orders' && activePage !== 'event-logs' && activePage !== 'analytics') {
          setWorkspaceLoadError({ page: activePage, message: errorMessage(err, describeFetchError(err)) });
        }
      });
    }
    return () => controller.abort();
  }, [activePage]);

  useEffect(() => {
    if (activePage !== 'event-logs' || !liveMode) return;
    const controller = new AbortController();
    const refreshEventHistory = () => {
      if (document.hidden) return;
      Promise.all([fetchEvents(controller.signal), fetchOutbox(controller.signal)]).catch(err => {
        if (isAbortError(err)) return;
        console.error('Failed to refresh Event History', err);
      });
    };
    refreshEventHistory();
    const intervalId = window.setInterval(refreshEventHistory, 5000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [activePage, liveMode]);

  // Periodic polling for Incomplete Checkouts and COD holds
  useEffect(() => {
    if (activePage !== 'incomplete-checkouts' && activePage !== 'pending-purchases' && activePage !== 'orders') {
      return;
    }
    const controller = new AbortController();

    const pollData = () => {
      if (document.hidden) return;

      if (activePage === 'incomplete-checkouts') {
        fetchIncompleteCheckouts({ refresh: true, signal: controller.signal }).catch(err => {
          if (isAbortError(err)) return;
          console.error('Failed to auto-refresh incomplete checkouts', err);
        });
      } else if (activePage === 'pending-purchases' || activePage === 'orders') {
        fetchDeferred(controller.signal).catch(err => {
          if (isAbortError(err)) return;
          console.error('Failed to auto-refresh COD holds/orders', err);
        });
      }
    };

    const intervalId = window.setInterval(pollData, 15000);
    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [activePage]);

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
    showToast('Custom events saved.', false);
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
    } catch (err: unknown) {
      showToast(errorMessage(err, 'Could not queue retry.'), true);
      await loadSystemData(false);
    } finally {
      setRetryingOutboxIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    if (codBusyOrderIds.includes(orderId)) return;
    setCodBusyOrderIds(prev => [...prev, orderId]);
    try {
      const data = await runDeferredOrderAction('confirm', orderId);
      showToast(data.message || "Order verified & queued successfully.", false);
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: unknown) {
      showToast(errorMessage(err, "Verification action failed."), true);
    } finally {
      setCodBusyOrderIds(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (codBusyOrderIds.includes(orderId)) return;
    setCodBusyOrderIds(prev => [...prev, orderId]);
    try {
      const data = await runDeferredOrderAction('cancel', orderId);
      showToast(data.message || "Event skipped.", false, {
        label: 'Undo',
        onClick: () => handleRestoreSkippedOrder(orderId),
      });
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: unknown) {
      showToast(errorMessage(err, "Skip action failed."), true);
    } finally {
      setCodBusyOrderIds(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleRestoreSkippedOrder = async (orderId: string) => {
    if (codBusyOrderIds.includes(orderId)) return;
    setCodBusyOrderIds(prev => [...prev, orderId]);
    try {
      const data = await runDeferredOrderAction('restore', orderId);
      showToast(data.message || "Event restored to verification queue.", false);
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: unknown) {
      showToast(errorMessage(err, "Could not restore skipped event."), true);
    } finally {
      setCodBusyOrderIds(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedOrderIds.length === 0 || codBulkBusy) return;
    setCodBulkBusy(true);
    try {
      const data = await runDeferredBulkAction('confirm-bulk', selectedOrderIds);
      showToast(`${Number(data.confirmed || 0)} orders verified${data.failed ? `, ${data.failed} failed` : ''}.`, Boolean(data.failed));
      setSelectedOrderIds([]);
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: unknown) {
      showToast(errorMessage(err, "Bulk verification failed."), true);
    } finally {
      setCodBulkBusy(false);
    }
  };

  const handleBulkCancel = async () => {
    if (selectedOrderIds.length === 0 || codBulkBusy) return;
    setCodBulkBusy(true);
    try {
      const data = await runDeferredBulkAction('cancel-bulk', selectedOrderIds);
      showToast(`${Number(data.cancelled || 0)} events skipped${data.failed ? `, ${data.failed} failed` : ''}.`, Boolean(data.failed));
      setSelectedOrderIds([]);
      await Promise.all([fetchDeferred(), loadSystemData(false)]);
    } catch (err: unknown) {
      showToast(errorMessage(err, "Bulk skip failed."), true);
    } finally {
      setCodBulkBusy(false);
    }
  };

  const handleSaveDeferredSettings = async () => {
    setSavingDeferredSettings(true);
    try {
      await saveDeferredSettings({ deferredEnabled, autoConfirmDays, autoConfirmStatus });
      showToast("COD Protection settings saved successfully.", false);
      loadSystemData(false);
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
    } catch {
      showToast("Setup scan failed. Please try again.", true);
    } finally {
      setAiReviewing(false);
    }
  };

  // Resolve Suggestion Card
  const toggleResolveSuggestion = async (id: string, isNowResolved: boolean) => {
    if (suggestionBusyIds.includes(id)) return;
    setSuggestionBusyIds(prev => [...prev, id]);
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
    } finally {
      setSuggestionBusyIds(prev => prev.filter(x => x !== id));
    }
  };

  // Dismiss Suggestion Card
  const dismissSuggestion = async (id: string) => {
    if (suggestionBusyIds.includes(id)) return;
    setSuggestionBusyIds(prev => [...prev, id]);
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
    } finally {
      setSuggestionBusyIds(prev => prev.filter(x => x !== id));
    }
  };

  // Submit profile edit
  const submitProfileSave = async (e: React.FormEvent): Promise<boolean> => {
    e.preventDefault();
    setProfUpdating(true);
    try {
      const emailChanged = !!profile && profEmail.trim().toLowerCase() !== profile.email.trim().toLowerCase();
      if (emailChanged && !profEmailCodeRequested) {
        await requestProfileEmailCode(profEmail.trim());
        setProfEmailCodeRequested(true);
        showToast('Verification code sent to your new email.', false);
        return false;
      }
      if (emailChanged && (!profEmailCode.trim() || !profEmailCurrentPassword)) {
        throw new Error('Enter the verification code and your current password.');
      }

      const updatedProfile = await updateClientProfile({
        name: profName,
        email: profEmail,
        notificationEmail: profNotifEmail,
        ownerNotifyWhatsapp: profNotifyWhatsapp,
        ownerWhatsappNumber: profWhatsappNumber,
        emailCode: emailChanged ? profEmailCode.trim() : null,
        currentPassword: emailChanged ? profEmailCurrentPassword : null,
      });
      setProfile(updatedProfile);
      setProfName(updatedProfile.name);
      setProfEmail(updatedProfile.email);
      setProfNotifEmail(updatedProfile.notificationEmail || updatedProfile.email);
      setProfNotifyWhatsapp(updatedProfile.ownerNotifyWhatsapp || false);
      setProfWhatsappNumber(updatedProfile.ownerWhatsappNumber || '');
      setProfEmailCodeRequested(false);
      setProfEmailCode('');
      setProfEmailCurrentPassword('');
      showToast("Profile saved!", false);
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save profile.", true);
      return false;
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
    const customObj: Record<string, string> = {};
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
    } catch (err: unknown) {
      setCampaignResp({
        statusCode: 500,
        body: { error: "Network error. Please check your connection.", details: errorMessage(err, 'Unknown network error') }
      });
      showToast("Test event failed to send.", true);
    } finally {
      setDispatchingTest(false);
    }
  };

  // Danger actions confirmers
  const handleTokenRevoke = async () => {
    if (confirmRevokeText.toUpperCase() !== 'REVOKE') {
      showToast("Verification word mismatch. Enter 'REVOKE' exactly to continue.", true);
      return;
    }
    try {
      setConnection(await revokeClientConnection());
      setConfirmRevokeText('');
      showToast("API key has been reset.", false);
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
      showToast(await requestAccountDeletion(), false);
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
    if (passNew.length < 8 || passNew.length > 128) {
      showToast("New password must be between 8 and 128 characters.", true);
      return;
    }
    try {
      await updateClientPassword(passCurrent, passNew);
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
      await sendPasswordResetEmail(email);
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
        payload = "Date,EventName,PageOrProduct,PageUrl,Platform,Status,HttpCode,DeduplicationKey\n" +
          events.map(e => `"${e.timestamp}","${e.name}","${e.contextLabel || 'Website event'}","${e.pageUrl || ''}","${e.platform}","${e.status}",${e.httpCode},"${e.deduplicationKey}"`).join("\n");
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

  const matchingEventGroupKeys = new Set(merchantVisibleEvents.filter(e => {
    const normalizedFilter = searchFilter.trim().toLowerCase();
    const matchesSearch = normalizedFilter
      ? (e.name.toLowerCase().includes(normalizedFilter) ||
         e.id.toLowerCase().includes(normalizedFilter) ||
         e.platform.toLowerCase().includes(normalizedFilter) ||
         (e.contextLabel || '').toLowerCase().includes(normalizedFilter) ||
         (e.pageUrl || '').toLowerCase().includes(normalizedFilter) ||
         e.status.toLowerCase().includes(normalizedFilter) ||
         e.deduplicationKey.toLowerCase().includes(normalizedFilter))
      : true;

    // Platform select filter
    const matchesPlatform = platformFilters.length > 0 ? platformFilters.includes(e.platform) : true;

    // Status select filter
    const matchesStatus = statusFilters.length > 0 ? statusFilters.includes(e.status) : true;

    return matchesSearch && matchesPlatform && matchesStatus;
  }).map(e => `${e.deduplicationKey || e.id}::${e.name}`));

  // Filters select complete event groups so every platform delivery remains visible
  // in the same row instead of reintroducing one row per platform.
  const filteredEventsForTable = merchantVisibleEvents.filter(e =>
    matchingEventGroupKeys.has(`${e.deduplicationKey || e.id}::${e.name}`)
  );

  const filteredApiLogsForTable = apiLogs.filter(l => {
    // The header field is page navigation, not a data-table filter.
    const matchesSearch = true;
    const matchesPlatform = platformFilters.length > 0 ? platformFilters.includes(l.platform) : true;
    return matchesSearch && matchesPlatform;
  });

  // Calculate platform statistics
  const getPlatformStats = (p: Platform) => {
    const serverStats = recoverySummary?.platform_stats?.[p];
    if (serverStats) {
      const total = Number(serverStats.attempts || 0);
      const successful = Number(serverStats.successful || 0);
      // null, never 100 — "no attempts" is not a perfect score.
      const rate = total > 0 ? Math.round((successful / total) * 100) : null;
      const lastTime = serverStats.last_event_at
        ? new Date(serverStats.last_event_at).toLocaleTimeString()
        : 'N/A';
      return { total, rate, lastTime };
    }
    const pEvs = events.filter(e => e.platform === p);
    const total = pEvs.length;
    const succs = pEvs.filter(e => e.status === 'Success').length;
    const rate = total > 0 ? Math.round((succs / total) * 100) : null;
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

  if (isPluginConnectRoute) {
    return <PluginConnectAuthorizeView />;
  }

  return (
    <div className="bk-console-shell flex min-h-screen font-sans transition-colors duration-200">
      <a className="bk-skip-link" href="#main-content">
        Skip to main content
      </a>
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

      <PluginUpdateModal
        open={pluginUpdateOpen}
        installedVersion={installedPluginVersion}
        latestVersion={latestPluginVersion}
        siteHost={connection?.siteHost}
        onClose={() => setPluginUpdateOpen(false)}
        onOpenWordPress={openWordPressPluginUpdates}
      />

      {/* Main Container */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${sidebarCollapsed ? 'md:pl-[72px]' : 'md:pl-[288px]'}`}>
        {connection && (
          <Header 
            title={pageTitleFor(activePage)}
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

        <main id="main-content" tabIndex={-1} className="flex-1 min-w-0">
        {/* Global Error Banner */}
        {errState && (
          <ConnectionErrorBanner message={errState} onRetry={() => loadSystemData()} />
        )}

        {/* Main Dashboard Skeleton */}
        {loading && !errState ? (
          <ConsoleSkeleton />
        ) : !errState && (
          <div className="bk-console-page flex-1 space-y-4 p-4 sm:p-5 md:space-y-6 md:p-6">

            {workspaceLoadError?.page === activePage && (
              <section className="rounded-xl border border-rose-200 bg-white shadow-sm">
                <ErrorState
                  compact
                  title={`Couldn't load ${pageTitleFor(activePage)}`}
                  description={workspaceLoadError.message}
                  onRetry={() => { void retryActiveWorkspace(); }}
                  retrying={workspaceRetrying}
                />
              </section>
            )}

            {/* --- CORE VIEWS DISPATCHER --- */}
            <PageErrorBoundary pageKey={activePage}>
            <Suspense fallback={<PageSuspenseFallback />}>

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
                pendingOrderCount={orderVerificationCount}
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
                codBusyOrderIds={codBusyOrderIds}
                codBulkBusy={codBulkBusy}
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
                setActivePage={setActivePage}
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
                expandedEventId={expandedEventId}
                setExpandedEventId={setExpandedEventId}
                copiedStates={copiedStates}
                handleCopy={handleCopy}
                handleExportData={handleExportData}
                outboxItems={outboxItems}
                retryingOutboxIds={retryingOutboxIds}
                handleRetryOutbox={handleRetryOutbox}
                loading={eventsLoading}
                loadError={eventsLoadError}
                lastFetchedAt={eventsLastFetchedAt}
                onRetry={fetchEvents}
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
                suggestionBusyIds={suggestionBusyIds}
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
                urlBuilderBaseUrl={campaignUrlBuilder.urlBuilderBaseUrl}
                setUrlBuilderBaseUrl={campaignUrlBuilder.setUrlBuilderBaseUrl}
                urlBuilderSource={campaignUrlBuilder.urlBuilderSource}
                setUrlBuilderSource={campaignUrlBuilder.setUrlBuilderSource}
                urlBuilderMedium={campaignUrlBuilder.urlBuilderMedium}
                setUrlBuilderMedium={campaignUrlBuilder.setUrlBuilderMedium}
                urlBuilderCampaign={campaignUrlBuilder.urlBuilderCampaign}
                setUrlBuilderCampaign={campaignUrlBuilder.setUrlBuilderCampaign}
                urlBuilderContent={campaignUrlBuilder.urlBuilderContent}
                setUrlBuilderContent={campaignUrlBuilder.setUrlBuilderContent}
                urlBuilderTerm={campaignUrlBuilder.urlBuilderTerm}
                setUrlBuilderTerm={campaignUrlBuilder.setUrlBuilderTerm}
                urlBuilderAdPlatform={campaignUrlBuilder.urlBuilderAdPlatform}
                setUrlBuilderAdPlatform={campaignUrlBuilder.setUrlBuilderAdPlatform}
                urlBuilderCampaignId={campaignUrlBuilder.urlBuilderCampaignId}
                setUrlBuilderCampaignId={campaignUrlBuilder.setUrlBuilderCampaignId}
                syncedAdCampaigns={campaignUrlBuilder.syncedAdCampaigns}
                loadingSyncedAdCampaigns={campaignUrlBuilder.loadingSyncedAdCampaigns}
                generatedCampaignUrl={campaignUrlBuilder.generatedCampaignUrl}
                handleGenerateCampaignUrl={campaignUrlBuilder.handleGenerateCampaignUrl}
                copiedStates={copiedStates}
                handleCopy={handleCopy}
              />
            )}

            {/* PAGE 10: ORDER SUCCESS */}
            {activePage === 'order-success' && (
              <OrderSuccessView />
            )}

            {/* PAGE 11: ACCOUNT */}
            {activePage === 'account' && profile && (
              <AccountView 
                profile={profile}
                connection={connection}
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
      <GlobalToast
        toast={globalToast}
        onDismiss={dismissToast}
      />

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
