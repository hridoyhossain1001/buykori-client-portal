import React from 'react';
import { PlatformBadge } from './common/PlatformLogo';
import {
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Download,
  MapPin
} from 'lucide-react';
import type {
  AdPerformanceMeta,
  AdPerformanceRow,
  AnalyticsAudience,
  AnalyticsCampaigns,
  AnalyticsOverview,
  SignalDoctor,
} from '../types';

interface AnalyticsViewProps {
  analyticsOverview: AnalyticsOverview | null;
  analyticsCampaigns: AnalyticsCampaigns | null;
  analyticsAudience: AnalyticsAudience | null;
  signalDoctor: SignalDoctor | null;
  analyticsError?: string | null;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  setActivePage?: (page: string) => void;
}

export function AnalyticsView({
  analyticsOverview,
  analyticsCampaigns,
  analyticsAudience,
  signalDoctor,
  analyticsError,
  analyticsDays,
  setAnalyticsDays,
  setActivePage,
}: AnalyticsViewProps) {
  const insightTabs = [
    { id: 'summary', label: 'Summary', sectionId: 'analytics-overview' },
    { id: 'ads', label: 'Ad Results', sectionId: 'analytics-ad-performance' },
    { id: 'sales', label: 'Sales Source', sectionId: 'analytics-campaigns' },
    { id: 'customers', label: 'Customers', sectionId: 'analytics-audience' },
  ];
  const [activeInsightTab, setActiveInsightTab] = React.useState('summary');
  const [showAllMobileSignals, setShowAllMobileSignals] = React.useState(false);
  const [dismissedMobileFixes, setDismissedMobileFixes] = React.useState<string[]>([]);
  const [showInactiveSalesSources, setShowInactiveSalesSources] = React.useState(false);
  const asArray = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];
  const numberText = (value: unknown) => Number(value || 0).toLocaleString();
  const percentText = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric}%` : '0%';
  };
  const topDistricts = asArray(analyticsAudience?.top_districts);
  const deviceMix = asArray(analyticsAudience?.device_mix);
  const [districtFunnelMode, setDistrictFunnelMode] = React.useState<'events' | 'visitors'>('events');
  const eventDistrictFunnel = asArray(analyticsAudience?.district_funnel);
  const visitorDistrictFunnel = asArray(analyticsAudience?.visitor_district_funnel);
  const districtFunnel = districtFunnelMode === 'visitors' ? visitorDistrictFunnel : eventDistrictFunnel;
  const districtFunnelUnit = districtFunnelMode === 'visitors' ? 'visitors' : 'events';
  const signalRates = signalDoctor?.signal_rates && Object.keys(signalDoctor.signal_rates).length
    ? signalDoctor.signal_rates
    : null;

  const [adPerformance, setAdPerformance] = React.useState<AdPerformanceRow[]>([]);
  const [adPerformanceMeta, setAdPerformanceMeta] = React.useState<AdPerformanceMeta | null>(null);
  const [loadingAdPerformance, setLoadingAdPerformance] = React.useState<boolean>(false);
  const [adPerformanceError, setAdPerformanceError] = React.useState<string | null>(null);
  const [adSearch, setAdSearch] = React.useState('');
  const [adSort, setAdSort] = React.useState('confirmed_revenue');
  const formatMoney = (value: number, currency?: string) => {
    const code = String(currency || '').trim().toUpperCase();
    const amount = Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (code === 'BDT') return `BDT ${amount}`;
    if (code === 'USD') return `$${amount}`;
    return code ? `${code} ${amount}` : amount;
  };

  const fetchAdPerformance = React.useCallback(async () => {
    setLoadingAdPerformance(true);
    setAdPerformanceError(null);
    try {
      const res = await fetch(`/api/v1/analytics/ad-performance?days=${analyticsDays}`);
      if (!res.ok) {
        throw new Error(`Ad results request failed with status ${res.status}`);
      }
      const json = await res.json();
      setAdPerformance(Array.isArray(json.data) ? json.data : []);
      setAdPerformanceMeta({
        sync_enabled: Boolean(json.sync_enabled),
        connected_accounts: Number(json.connected_accounts || 0),
        last_synced_at: json.last_synced_at || null,
        missing_attribution_purchases: Number(json.missing_attribution_purchases || 0),
      });
    } catch (err) {
      console.error("Failed to fetch ad performance analytics", err);
      setAdPerformance([]);
      setAdPerformanceMeta(null);
      setAdPerformanceError("Ad results could not load. Please try again.");
    } finally {
      setLoadingAdPerformance(false);
    }
  }, [analyticsDays]);

  React.useEffect(() => {
    fetchAdPerformance();
  }, [fetchAdPerformance]);

  const adSummary = React.useMemo(() => {
    const rows = Array.isArray(adPerformance) ? adPerformance : [];
    const spend = rows.reduce((sum, row) => sum + Number(row.spend || 0), 0);
    const placedPurchases = rows.reduce((sum, row) => sum + Number(row.placed_purchases || 0), 0);
    const placedRevenue = rows.reduce((sum, row) => sum + Number(row.placed_revenue || 0), 0);
    const confirmedPurchases = rows.reduce((sum, row) => sum + Number(row.confirmed_purchases || 0), 0);
    const confirmedRevenue = rows.reduce((sum, row) => sum + Number(row.confirmed_revenue || 0), 0);
    const spendCurrency = rows.find(row => row.spend_currency)?.spend_currency || '';
    const revenueCurrency = rows.find(row => row.revenue_currency)?.revenue_currency || spendCurrency;
    return {
      spend,
      placedPurchases,
      placedRevenue,
      confirmedPurchases,
      confirmedRevenue,
      spendCurrency,
      revenueCurrency,
      returnRate: spend > 0 ? confirmedRevenue / spend : 0,
      costPerOrder: confirmedPurchases > 0 ? spend / confirmedPurchases : 0,
    };
  }, [adPerformance]);

  const getAdStatus = React.useCallback((row: AdPerformanceRow) => {
    const spend = Number(row.spend || 0);
    const confirmedRevenue = Number(row.confirmed_revenue || 0);
    const confirmedPurchases = Number(row.confirmed_purchases || 0);
    const confirmedRoas = Number(row.confirmed_roas || 0);
    const confirmedCpa = Number(row.confirmed_cpa || 0);
    const placedPurchases = Number(row.placed_purchases || 0);

    if (confirmedRevenue > 0 && confirmedRoas >= 1) {
      return { label: 'Good', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    }
    if (spend > 0 && confirmedPurchases === 0 && placedPurchases === 0) {
      return { label: 'No sales', className: 'border-rose-200 bg-rose-50 text-rose-700' };
    }
    if (confirmedCpa > 0 && confirmedRevenue > 0 && confirmedCpa > confirmedRevenue) {
      return { label: 'High cost', className: 'border-amber-200 bg-amber-50 text-amber-700' };
    }
    return { label: 'Watch', className: 'border-slate-200 bg-slate-50 text-slate-600' };
  }, []);

  const filteredAdPerformance = React.useMemo(() => {
    const query = adSearch.trim().toLowerCase();
    const rows = (Array.isArray(adPerformance) ? adPerformance : []).filter(row => {
      if (!query) return true;
      return [
        row.campaign_name,
        row.campaign_id,
        row.platform,
      ].some(value => String(value || '').toLowerCase().includes(query));
    });

    const valueForSort = (row: AdPerformanceRow) => {
      if (adSort === 'return') return Number(row.confirmed_roas || 0);
      if (adSort === 'cost_per_order') {
        const value = Number(row.confirmed_cpa || 0);
        return value > 0 ? value : Number.MAX_SAFE_INTEGER;
      }
      if (adSort === 'new_orders') return Number(row.placed_purchases || 0);
      if (adSort === 'spend') return Number(row.spend || 0);
      return Number(row.confirmed_revenue || 0);
    };

    return [...rows].sort((a, b) => {
      const aValue = valueForSort(a);
      const bValue = valueForSort(b);
      return adSort === 'cost_per_order' ? aValue - bValue : bValue - aValue;
    });
  }, [adPerformance, adSearch, adSort]);

  const exportAdResults = React.useCallback(() => {
    if (!filteredAdPerformance.length) return;
    const headers = [
      'Platform',
      'Campaign Name',
      'Campaign ID',
      'Status',
      'Ad Cost',
      'Clicks',
      'Views',
      'Click Rate',
      'Cost Per Click',
      'New Orders',
      'New Order Sales',
      'New Order Return',
      'Confirmed Orders',
      'Confirmed Sales',
      'Confirmed Return',
      'Confirmed Cost Per Order',
      'Extra Tracking',
    ];
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filteredAdPerformance.map((row) => {
      const status = getAdStatus(row);
      return [
        row.platform,
        row.campaign_name,
        row.campaign_id,
        status.label,
        row.spend,
        row.clicks,
        row.impressions,
        row.ctr,
        row.cpc,
        row.placed_purchases,
        row.placed_revenue,
        row.placed_roas,
        row.confirmed_purchases,
        row.confirmed_revenue,
        row.confirmed_roas,
        row.confirmed_cpa,
        `${row.tracking_bypass_rate}%`,
      ];
    });
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `buykori-ad-results-${analyticsDays}d.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, [analyticsDays, filteredAdPerformance, getAdStatus]);

  const customerInsights = React.useMemo(() => {
    const topArea = topDistricts[0];
    const topDevice = deviceMix[0];
    const topBrowser = asArray(analyticsAudience?.browser_mix)[0];
    const uniqueVisitors = Math.max(
      topDistricts.reduce((total, row) => total + Number(row.count || 0), 0),
      deviceMix.reduce((total, row) => total + Number(row.count || 0), 0),
      asArray(analyticsAudience?.browser_mix).reduce((total, row) => total + Number(row.count || 0), 0),
    );
    return [
      {
        title: 'Unique visitors',
        value: numberText(uniqueVisitors),
        note: uniqueVisitors ? 'Tracked visitors in this date range' : 'Visitor data will appear after tracking starts.',
      },
      {
        title: 'Top city',
        value: topArea?.label || 'No data yet',
        note: topArea ? `${numberText(topArea.count)} visitors · ${Number(topArea.percentage || 0)}%` : 'Area data will appear after visitors browse your store.',
      },
      {
        title: 'Mobile share',
        value: topDevice?.label?.toLowerCase() === 'mobile' ? `${Number(topDevice.percentage || 0)}%` : (topDevice?.label || 'No data yet'),
        note: topDevice ? 'Keep checkout mobile-first' : 'Device data will appear after tracking starts.',
      },
      {
        title: 'Top browser',
        value: topBrowser?.label || 'No data yet',
        note: topBrowser ? `${numberText(topBrowser.count)} visitors · ${Number(topBrowser.percentage || 0)}%` : 'Browser data will appear after tracking starts.',
      },
    ];
  }, [analyticsAudience?.browser_mix, deviceMix, topDistricts]);

  const stepLabel = (step: string) => ({
    PageView: 'Store visit',
    ViewContent: 'Product seen',
    AddToCart: 'Added to cart',
    InitiateCheckout: 'Checkout started',
    Purchase: 'Order placed',
  }[step] || step);

  const mobileSignalEntries = signalRates ? [
    { name: 'Event ID', rate: Number(signalRates.event_id || 0) },
    { name: 'User match', rate: Number(signalRates.user_match || 0) },
    { name: 'Email / Phone', rate: Number(signalRates.email_or_phone || 0) },
    { name: 'Click IDs', rate: Number(signalRates.click_id || 0) },
    { name: 'Product ID', rate: Number(signalRates.content_ids || 0) },
    { name: 'Order value', rate: Number(signalRates.value || 0) },
    { name: 'UTM source', rate: Number(signalRates.utm || 0) },
  ].sort((a, b) => a.rate - b.rate) : [];
  const healthyMobileSignals = mobileSignalEntries.filter(signal => signal.rate >= 80);
  const attentionMobileSignals = mobileSignalEntries.filter(signal => signal.rate < 80);
  const visibleMobileSignals = showAllMobileSignals
    ? mobileSignalEntries
    : [...attentionMobileSignals, ...healthyMobileSignals].slice(0, 4);
  const mobileFunnel = asArray(analyticsOverview?.funnel);
  const mobileFunnelMax = Math.max(...mobileFunnel.map(step => Number(step.count || 0)), 1);
  const mobileTrackingGaps = mobileFunnel.reduce((count, step, index) => {
    if (index === 0) return count;
    return count + (Number(step.count || 0) > Number(mobileFunnel[index - 1]?.count || 0) ? 1 : 0);
  }, 0);
  const qualityScore = Math.max(0, Math.min(100, Number(signalDoctor?.score || 0)));
  const mobileFixes = [
    ...((Number(signalRates?.click_id || 0) < 80 || Number(signalRates?.utm || 0) < 80) ? [{
      id: 'campaign-attribution',
      title: 'Campaign attribution missing',
      description: `Only ${Math.max(Number(signalRates?.click_id || 0), Number(signalRates?.utm || 0))}% of events carry Click IDs or UTM source, so revenue cannot map back to ads.`,
      action: 'Open URL Builder',
      page: 'campaign-builder',
    }] : []),
    ...(adSummary.spend <= 0 ? [{
      id: 'ad-spend',
      title: 'Ad spend not connected',
      description: 'Return and Cost/order stay empty until spend sync is added.',
      action: 'Connect',
      page: 'settings',
    }] : []),
    ...asArray(signalDoctor?.issues).map((issue, index) => ({
      id: `signal-${index}`,
      title: issue.title || 'Tracking signal needs attention',
      description: issue.fix || issue.recommendation || issue.impact || issue.message || 'Review this signal to improve reporting quality.',
      action: 'Review',
      page: 'settings',
    })),
  ]
    .filter((fix, index, fixes) => fixes.findIndex(candidate => candidate.title === fix.title) === index)
    .filter(fix => !dismissedMobileFixes.includes(fix.id))
    .slice(0, 2);

  const salesSourceRows = asArray(analyticsCampaigns?.campaigns);
  const isUntaggedSource = (row: (typeof salesSourceRows)[number]) => {
    const source = String(row.source || '').trim().toLowerCase();
    const campaign = String(row.campaign || '').trim().toLowerCase();
    return source === 'direct'
      || source === '(direct)'
      || !campaign
      || ['not set', '(not set)', 'none', 'unknown', 'direct', '(direct)'].includes(campaign);
  };
  const sortedSalesSources = [...salesSourceRows].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  const activeSalesSources = sortedSalesSources.filter(row =>
    Number(row.view_content || 0)
    + Number(row.add_to_cart || 0)
    + Number(row.initiate_checkout || 0)
    + Number(row.purchase || 0)
    + Number(row.revenue || 0) > 0
  );
  const inactiveSalesSources = sortedSalesSources.filter(row => !activeSalesSources.includes(row));
  const visibleSalesSources = showInactiveSalesSources ? sortedSalesSources : activeSalesSources;
  const totalSourceSales = salesSourceRows.reduce((total, row) => total + Number(row.revenue || 0), 0);
  const totalSourceOrders = salesSourceRows.reduce((total, row) => total + Number(row.purchase || 0), 0);
  const totalProductsSeen = salesSourceRows.reduce((total, row) => total + Number(row.view_content || 0), 0);
  const totalAddedToCart = salesSourceRows.reduce((total, row) => total + Number(row.add_to_cart || 0), 0);
  const totalCheckouts = salesSourceRows.reduce((total, row) => total + Number(row.initiate_checkout || 0), 0);
  const storeVisitStep = mobileFunnel.find(step => step.step === 'PageView');
  const totalStoreVisits = Number(storeVisitStep?.count || totalProductsSeen || 0);
  const untaggedSourceSales = salesSourceRows
    .filter(isUntaggedSource)
    .reduce((total, row) => total + Number(row.revenue || 0), 0);
  const attributedSourceSales = Math.max(0, totalSourceSales - untaggedSourceSales);
  const untaggedSalesPercent = totalSourceSales > 0 ? Number(((untaggedSourceSales / totalSourceSales) * 100).toFixed(1)) : 0;
  const attributedSalesPercent = totalSourceSales > 0 ? Number(((attributedSourceSales / totalSourceSales) * 100).toFixed(1)) : 0;
  const visitOrderRate = totalStoreVisits > 0 ? Number(((totalSourceOrders / totalStoreVisits) * 100).toFixed(1)) : 0;
  const sourcesWithSales = salesSourceRows.filter(row => Number(row.revenue || 0) > 0 || Number(row.purchase || 0) > 0).length;
  const primarySalesSource = activeSalesSources[0] || sortedSalesSources[0] || null;
  const salesCurrency = primarySalesSource?.currency || salesSourceRows.find(row => row.currency)?.currency || 'BDT';
  const sourceAverageOrder = totalSourceOrders > 0 ? totalSourceSales / totalSourceOrders : 0;
  const sourceHasCartGap = totalAddedToCart < totalCheckouts;
  const taggedCreditMap = salesSourceRows.filter(row => !isUntaggedSource(row)).reduce<Record<string, number>>((credits, row) => {
    const label = String(row.source || 'Other campaigns').trim() || 'Other campaigns';
    credits[label] = Number(credits[label] || 0) + Number(row.revenue || 0);
    return credits;
  }, {});
  const salesCreditRows = [
    { label: 'Direct / untagged', value: untaggedSourceSales },
    ...Object.entries(taggedCreditMap).map(([label, value]) => ({ label, value })),
  ].map(row => ({
    ...row,
    percent: totalSourceSales > 0 ? Number(((row.value / totalSourceSales) * 100).toFixed(1)) : 0,
  }));

  const exportSalesSources = () => {
    if (!salesSourceRows.length) return;
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Ad Place', 'Campaign', 'Product Seen', 'Added to Cart', 'Checkout', 'Orders', 'Sales', 'Currency'],
      ...salesSourceRows.map(row => [
        row.source,
        row.campaign,
        row.view_content,
        row.add_to_cart,
        row.initiate_checkout,
        row.purchase,
        row.revenue,
        row.currency || salesCurrency,
      ]),
    ];
    const blob = new Blob([rows.map(row => row.map(escapeCsv).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `buykori-sales-sources-${analyticsDays}d.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const analyticsRootRef = React.useRef<HTMLDivElement | null>(null);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const scrollAnalyticsTop = () => {
    window.requestAnimationFrame(() => {
      analyticsRootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const focusInsightTab = (tabId: string) => {
    setActiveInsightTab(tabId);
    window.requestAnimationFrame(() => tabRefs.current[tabId]?.focus());
  };

  const selectInsightTab = (tabId: string) => {
    setActiveInsightTab(tabId);
    scrollAnalyticsTop();
  };

  const handleInsightTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tabId: string) => {
    const currentIndex = insightTabs.findIndex(tab => tab.id === tabId);
    if (currentIndex < 0) return;

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusInsightTab(insightTabs[(currentIndex + 1) % insightTabs.length].id);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusInsightTab(insightTabs[(currentIndex - 1 + insightTabs.length) % insightTabs.length].id);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusInsightTab(insightTabs[0].id);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusInsightTab(insightTabs[insightTabs.length - 1].id);
    }
  };

  React.useEffect(() => {
    const handleSectionJump = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId: string; sectionId: string }>).detail;
      if (detail?.pageId !== 'analytics') return;
      const targetTab = insightTabs.find(tab => tab.sectionId === detail.sectionId)
        || (detail.sectionId === 'analytics-funnel' ? insightTabs[0] : undefined);
      if (targetTab) setActiveInsightTab(targetTab.id);
      window.requestAnimationFrame(() => {
        document.getElementById(detail.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  return (
    <div id="analytics-root" ref={analyticsRootRef} className="mx-auto max-w-6xl scroll-mt-20 space-y-4 md:scroll-mt-24 md:space-y-6">
      
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="w-full max-w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm md:w-fit" aria-label="Ad Insights sections">
          <div className="flex w-full gap-1 overflow-x-auto" role="tablist" aria-label="Ad Insights sections">
            {insightTabs.map(tab => (
              <button
                key={tab.id}
                id={`ad-insights-tab-${tab.id}`}
                ref={(element) => { tabRefs.current[tab.id] = element; }}
                type="button"
                role="tab"
                aria-selected={activeInsightTab === tab.id}
                aria-controls={tab.sectionId}
                tabIndex={activeInsightTab === tab.id ? 0 : -1}
                onClick={() => selectInsightTab(tab.id)}
                onKeyDown={(event) => handleInsightTabKeyDown(event, tab.id)}
                className={`min-h-9 min-w-fit flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-colors md:flex-none md:px-4 ${
                  activeInsightTab === tab.id
                    ? 'bg-slate-900 text-white shadow-sm md:bg-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
        <div className={`${activeInsightTab === 'summary' ? 'hidden sm:flex' : activeInsightTab === 'sales' ? 'hidden' : 'flex'} shrink-0 items-center gap-2`}>
          <select 
            value={analyticsDays} 
            onChange={(e) => setAnalyticsDays(Number(e.target.value))}
            aria-label="Select analytics timeframe"
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm outline-none focus:ring-1 focus:ring-blue-500 sm:px-3"
          >
            <option value="7">Last 7 days</option>
            <option value="14">Last 14 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </div>

      {analyticsError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{analyticsError}</span>
        </div>
      )}

      <div
        aria-hidden={activeInsightTab !== 'summary'}
        className={`${activeInsightTab === 'summary' ? 'space-y-3' : 'hidden'} md:hidden`}
      >
        <div className="grid grid-cols-3 rounded-xl bg-stone-100 p-1 text-center text-[11px] font-bold text-stone-500">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setAnalyticsDays(days)}
              className={`rounded-lg px-2 py-2 transition ${analyticsDays === days ? 'bg-white text-slate-800 shadow-sm' : ''}`}
            >
              {days} days
            </button>
          ))}
        </div>

        <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#17314f] via-[#1b416e] to-[#15385f] px-4 py-4 text-white shadow-[0_10px_24px_rgba(15,49,86,.16)]">
          <span className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/[0.06]" />
          <div className="relative flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#7dd3a7 ${qualityScore * 3.6}deg, rgba(255,255,255,.18) 0deg)` }}
            >
              <span className="h-10 w-10 rounded-full bg-[#183b64]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-300">Data quality score</p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                <strong className="text-[25px] font-black leading-none">{qualityScore}<span className="text-xs text-slate-300">/100</span></strong>
                <span className="text-[12px] font-bold text-emerald-200">· {signalDoctor?.grade || 'Waiting'}</span>
              </div>
              <p className="mt-2 text-[10px] text-slate-300">
                {healthyMobileSignals.length} of {mobileSignalEntries.length || 7} signals healthy
                {attentionMobileSignals.length > 0 ? ` · ${attentionMobileSignals.length} need attention` : ''}
              </p>
            </div>
          </div>
        </section>

        {analyticsOverview && (
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                title: 'Total events',
                value: numberText(analyticsOverview.total_events),
                note: `Last ${analyticsDays} days`,
              },
              {
                title: 'Delivery',
                value: percentText(analyticsOverview.success_rate),
                note: `${Math.round(Number(analyticsOverview.total_events || 0) * Number(analyticsOverview.success_rate || 0) / 100).toLocaleString()} of ${numberText(analyticsOverview.total_events)} delivered`,
              },
              {
                title: 'Daily average',
                value: numberText(analyticsOverview.avg_daily_events),
                note: `Across ${analyticsDays} days`,
              },
              {
                title: 'New orders',
                value: numberText(adSummary.placedPurchases),
                note: `${numberText(adSummary.confirmedPurchases)} confirmed`,
              },
            ].map(metric => (
              <section key={metric.title} className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,.03)]">
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">{metric.title}</p>
                <p className="mt-1 text-xl font-black leading-none tracking-tight text-slate-900">{metric.value}</p>
                <p className="mt-2 truncate text-[9px] text-slate-400">{metric.note}</p>
              </section>
            ))}
          </div>
        )}

        {mobileFixes.length > 0 && (
          <section className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-slate-800">Fix first</h3>
                <p className="text-[10px] text-slate-400">Biggest blockers to reliable ROAS</p>
              </div>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">{mobileFixes.length}</span>
            </div>
            <div className="mt-1">
              {mobileFixes.map((fix, index) => (
                <div key={fix.id} className={`flex items-start gap-2.5 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${index === 0 ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[12px] font-bold text-slate-800">{fix.title}</h4>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">{fix.description}</p>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActivePage?.(fix.page)}
                        className="rounded-lg bg-[#2f80df] px-3 py-2 text-[10px] font-bold text-white"
                      >
                        {fix.action}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedMobileFixes(current => [...current, fix.id])}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600"
                      >
                        Later
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-slate-800">Customer journey</h3>
              <p className="text-[10px] text-slate-500">Store visit → order · last {analyticsDays} days</p>
            </div>
            {mobileTrackingGaps > 0 && (
              <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[9px] font-bold text-orange-700">{mobileTrackingGaps} gap{mobileTrackingGaps > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="mt-2">
            {mobileFunnel.length > 0 ? mobileFunnel.map((step, index) => {
              const currentCount = Number(step.count || 0);
              const previousCount = index > 0 ? Number(mobileFunnel[index - 1]?.count || 0) : currentCount;
              const hasGap = index > 0 && currentCount > previousCount;
              const storeVisitCount = Number(mobileFunnel[0]?.count || 0);
              const rate = index === 0
                ? 100
                : hasGap
                  ? (storeVisitCount > 0 ? Number(((currentCount / storeVisitCount) * 100).toFixed(1)) : 0)
                  : previousCount > 0
                    ? Number(((currentCount / previousCount) * 100).toFixed(1))
                    : 0;
              return (
                <div key={step.step} className="py-2">
                  <div className="flex items-center gap-2">
                    <strong className="text-[11px] text-slate-800">{stepLabel(step.step)}</strong>
                    <span className="text-[9px] text-slate-400">{numberText(currentCount)} {index === 0 ? 'sessions' : 'events'}</span>
                    <span className={`ml-auto text-[11px] font-bold ${hasGap || (index > 0 && rate < 25) ? 'text-orange-600' : 'text-slate-800'}`}>
                      {rate}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${hasGap || (index > 0 && rate < 25) ? 'bg-orange-300' : 'bg-[#4b9aeb]'}`}
                      style={{ width: `${Math.max((currentCount / mobileFunnelMax) * 100, currentCount > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                  {hasGap && <p className="mt-1 text-[9px] text-slate-400">Fewer than the next step — see note</p>}
                </div>
              );
            }) : (
              <p className="py-6 text-center text-[10px] text-slate-400">Journey data will appear after tracking starts.</p>
            )}
          </div>
          {mobileTrackingGaps > 0 && (() => {
            const gapIndex = mobileFunnel.findIndex((step, index) => index > 0 && Number(step.count || 0) > Number(mobileFunnel[index - 1]?.count || 0));
            const before = mobileFunnel[gapIndex - 1];
            const after = mobileFunnel[gapIndex];
            return before && after ? (
              <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-[10px] leading-4 text-orange-800">
                <strong>{stepLabel(before.step)} ({numberText(before.count)}) is lower than {stepLabel(after.step)} ({numberText(after.count)}).</strong>
                {' '}The earlier event may be firing late or missing.
              </div>
            ) : null;
          })()}
        </section>

        <section className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-slate-800">Data quality by signal</h3>
              <p className="text-[10px] text-slate-500">Worst first</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-600">{qualityScore} / 100</span>
          </div>
          {visibleMobileSignals.length > 0 ? (
            <div className="mt-2 space-y-2">
              {visibleMobileSignals.map(signal => (
                <div key={signal.name} className="grid grid-cols-[92px_1fr_40px] items-center gap-2">
                  <span className="truncate text-[10px] font-bold text-slate-700">
                    {signal.name}
                    {signal.rate < 80 && <em className="ml-1 rounded bg-rose-50 px-1 py-0.5 not-italic text-[8px] text-rose-500">FIX</em>}
                  </span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${signal.rate < 30 ? 'bg-rose-500' : signal.rate < 80 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                      style={{ width: `${signal.rate}%` }}
                    />
                  </div>
                  <span className={`text-right text-[9px] font-bold ${signal.rate < 80 ? 'text-rose-500' : 'text-slate-800'}`}>{signal.rate}%</span>
                </div>
              ))}
              {mobileSignalEntries.length > 4 && (
                <button type="button" onClick={() => setShowAllMobileSignals(value => !value)} className="pt-2 text-[10px] font-bold text-[#2375d8]">
                  {showAllMobileSignals ? '▴ Show fewer signals' : `▾ Show ${mobileSignalEntries.length - 4} healthy signals`}
                </button>
              )}
            </div>
          ) : (
            <p className="py-6 text-center text-[10px] text-slate-400">Signal data will appear after tracking starts.</p>
          )}
        </section>

        <section className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
          <h3 className="text-[13px] font-bold text-slate-800">Business results</h3>
          <p className="text-[10px] text-slate-500">Available without ad spend</p>
          <div className="mt-3 grid grid-cols-2 divide-x divide-slate-200">
            <div className="pr-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">Confirmed sales</p>
              <p className="mt-1 text-base font-black text-slate-900">{formatMoney(adSummary.confirmedRevenue, adSummary.revenueCurrency)}</p>
              <p className="mt-1 text-[9px] text-slate-400">{numberText(adSummary.confirmedPurchases)} of {numberText(adSummary.placedPurchases)} orders</p>
            </div>
            <div className="pl-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">Return · Cost/order</p>
              <p className="mt-1 text-base font-black text-slate-400">
                {adSummary.spend > 0 ? `${adSummary.returnRate.toFixed(2)}x` : '—'}
              </p>
              <p className="mt-1 text-[9px] text-slate-400">{adSummary.spend > 0 ? formatMoney(adSummary.costPerOrder, adSummary.spendCurrency) : 'Needs ad spend'}</p>
            </div>
          </div>
        </section>
      </div>

      {analyticsOverview && (
        <div id="analytics-overview" role="tabpanel" aria-labelledby="ad-insights-tab-summary" className={`${activeInsightTab === 'summary' ? 'hidden md:grid' : 'hidden'} scroll-mt-24 grid-cols-2 gap-3 lg:grid-cols-4`}>
          {[
            { title: 'Total events', value: numberText(analyticsOverview.total_events), note: 'Tracked in this period' },
            { title: 'Success rate', value: percentText(analyticsOverview.success_rate), note: 'Delivery performance' },
            { title: 'Daily average', value: numberText(analyticsOverview.avg_daily_events), note: 'Events per day' },
            { title: 'Data quality', value: signalDoctor ? `${signalDoctor.score}/100` : '—', note: signalDoctor?.grade || 'Waiting for data' },
          ].map((metric, index) => (
            <section key={metric.title} className="min-h-36 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{metric.title}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{metric.value}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${index === 1 || index === 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{metric.note}</span>
                <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
                  {[7, 11, 9, 15, 13, 18].map((height, barIndex) => <span key={barIndex} className="w-1 rounded-t bg-indigo-500" style={{ height }} />)}
                </span>
              </div>
            </section>
          ))}
        </div>
      )}

      <section aria-hidden={activeInsightTab !== 'summary'} className={`${activeInsightTab === 'summary' ? 'hidden md:block' : 'hidden'} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm`}>
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">↗</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Business results</h3>
            <p className="mt-0.5 text-xs text-slate-500">Ad spend and confirmed sales for the last {analyticsDays} days.</p>
          </div>
          {loadingAdPerformance && <span className="ml-auto text-xs font-semibold text-slate-400">Updating…</span>}
        </header>
        {adPerformanceError && <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-xs text-rose-800">{adPerformanceError}</div>}
        <div className="grid grid-cols-2 divide-slate-200 lg:grid-cols-5 lg:divide-x">
          {[
            { title: 'Ad cost', value: formatMoney(adSummary.spend, adSummary.spendCurrency), note: adSummary.spend ? 'Synced ad spend' : 'No spend synced yet' },
            { title: 'New orders', value: numberText(adSummary.placedPurchases), note: 'COD pending included' },
            { title: 'Confirmed sales', value: formatMoney(adSummary.confirmedRevenue, adSummary.revenueCurrency), note: `${numberText(adSummary.confirmedPurchases)} confirmed` },
            { title: 'Return', value: adSummary.spend ? `${adSummary.returnRate.toFixed(2)}x` : '—', note: 'Needs spend + sales' },
            { title: 'Cost / order', value: adSummary.placedPurchases ? formatMoney(adSummary.costPerOrder, adSummary.spendCurrency) : '—', note: 'Needs spend + orders' },
          ].map(metric => (
            <div key={metric.title} className="border-b border-slate-200 px-5 py-4 last:border-b-0 lg:border-b-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{metric.title}</p>
              <p className="mt-1 text-sm font-black text-slate-900">{metric.value}</p>
              <p className="mt-1 text-[11px] text-slate-500">{metric.note}</p>
            </div>
          ))}
        </div>
        <footer className="border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">No ad spend recorded? Connect your ad account spend sync in Settings to see Return and Cost/order.</footer>
      </section>

      <div
        aria-hidden={activeInsightTab !== 'customers'}
        className={`${activeInsightTab === 'customers' ? 'grid' : 'hidden'} scroll-mt-24 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4`}
      >
        {customerInsights.map((item) => (
          <div key={item.title} className="min-h-36 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.title}</p>
            <p className="mt-3 text-2xl font-black tracking-tight text-slate-900">{item.value}</p>
            <span className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold leading-normal text-slate-500">{item.note}</span>
          </div>
        ))}
      </div>

      {/* Estimated Geo & Device Mix */}
      <div id="analytics-audience" role="tabpanel" aria-labelledby="ad-insights-tab-customers" className={`${activeInsightTab === 'customers' ? 'grid' : 'hidden'} scroll-mt-24 grid-cols-1 xl:grid-cols-3 gap-6`}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Customer areas</h3>
              <p className="mt-0.5 text-xs text-slate-500">By approximate IP location.</p>
            </div>
            <MapPin className="h-4 w-4 text-slate-400" />
          </div>
          <div className="space-y-4 px-5 py-5">
            {topDistricts.length ? topDistricts.map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 ">{row.label}</span>
                  <span className="text-slate-500"><strong className="text-slate-800">{numberText(row.count)}</strong> · {Number(row.percentage || 0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(row.percentage, 3)}%` }} />
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-xs text-slate-400">Location data will appear after visitors start browsing your store.</div>
            )}
          </div>
          <div className="border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs leading-relaxed text-slate-500">
            {analyticsAudience?.notice || 'City and district data is approximate and not 100% accurate.'}
          </div>
        </div>

        <div className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Devices</h3>
              <p className="mt-0.5 text-xs text-slate-500">Unique visitors by device.</p>
            </div>
          </div>
          <div className="space-y-4 px-5 py-5">
            {deviceMix.length ? deviceMix.map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 ">{row.label}</span>
                  <span className="text-slate-500"><strong className="text-slate-800">{numberText(row.count)}</strong> · {Number(row.percentage || 0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(row.percentage, 3)}%` }} />
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-xs text-slate-400">Device data will appear after visitors start browsing your store.</div>
            )}
            {!!deviceMix.length && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs leading-relaxed text-emerald-800"><strong>{Math.round(Number(deviceMix.find(row => row.label.toLowerCase() === 'mobile')?.percentage || 0) / 10)} of 10 visitors are on a phone.</strong> Test every checkout change on mobile before anything else.</div>}
          </div>
        </div>

        <div className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-900">Browsers</h3>
            <p className="mt-0.5 text-xs text-slate-500">By unique visitors.</p>
          </div>
          <div className="space-y-4 px-5 py-5">
            {asArray(analyticsAudience?.browser_mix).length ? asArray(analyticsAudience?.browser_mix).map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">{row.label}</span>
                  <span className="text-slate-500"><strong className="text-slate-800">{numberText(row.count)}</strong> · {Number(row.percentage || 0)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(row.percentage, 1)}%` }} /></div>
              </div>
            )) : (
              <div className="py-10 text-center text-xs text-slate-400">Browser data will appear after visitors start browsing your store.</div>
            )}
          </div>
          {!!asArray(analyticsAudience?.browser_mix).length && <div className="border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs leading-relaxed text-slate-500">Test checkout in {asArray(analyticsAudience?.browser_mix)[0]?.label} first — it covers {Number(asArray(analyticsAudience?.browser_mix)[0]?.percentage || 0)}% of visitors.</div>}
        </div>
      </div>

      {/* District Funnel Table */}
      <div
        aria-hidden={activeInsightTab !== 'customers'}
        className={`${activeInsightTab === 'customers' ? 'flex' : 'hidden'} flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">
              {districtFunnelMode === 'visitors' ? 'Visitors by Area' : 'Actions by Area'}
            </h3>
            <p className="text-xs text-slate-400 ">
              {districtFunnelMode === 'visitors'
                ? 'Visitor count grouped by area.'
                : 'Customer actions from product view to order, grouped by area.'}
            </p>
          </div>
          <div className="inline-flex h-9 w-fit items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold  ">
            <button
              type="button"
              onClick={() => setDistrictFunnelMode('events')}
              className={`h-7 rounded-md px-3 transition-colors ${districtFunnelMode === 'events' ? 'bg-white text-indigo-700 shadow-sm  ' : 'text-slate-500 hover:text-slate-800  '}`}
            >
              Events
            </button>
            <button
              type="button"
              onClick={() => setDistrictFunnelMode('visitors')}
              className={`h-7 rounded-md px-3 transition-colors ${districtFunnelMode === 'visitors' ? 'bg-white text-indigo-700 shadow-sm  ' : 'text-slate-500 hover:text-slate-800  '}`}
            >
              Visitors
            </button>
          </div>
        </div>
        <div className="space-y-2 md:hidden">
          {!districtFunnel.length ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
              Location funnel data will appear after tracking starts.
            </div>
          ) : districtFunnel.slice(0, 6).map((row) => (
            <div key={row.district} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-indigo-700">{row.district}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Seen {numberText(row.page_view)} | Cart {numberText(row.add_to_cart)} | Checkout {numberText(row.initiate_checkout)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{numberText(row.purchase)}</p>
                  <p className="text-xs font-semibold uppercase text-slate-400">Orders</p>
                </div>
              </div>
              <p className="mt-2 text-right text-xs font-bold text-indigo-600">{formatMoney(row.revenue, row.currency)}</p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[680px]  ">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500  ">
              <tr>
                <th className="px-6 py-3">Area</th>
                <th className="px-6 py-3">Product Seen</th>
                <th className="px-6 py-3">Added to Cart</th>
                <th className="px-6 py-3">Checkout</th>
                <th className="px-6 py-3">Orders</th>
                <th className="px-6 py-3 text-right">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {!districtFunnel.length ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-medium ">
                    Location funnel data will appear after tracking starts.
                  </td>
                </tr>
              ) : districtFunnel.map((row) => (
                <tr key={row.district} className="hover:bg-slate-50/50  transition-colors">
                  <td className="px-6 py-3.5 font-bold text-indigo-700 ">{row.district}</td>
                  <td className="px-6 py-3.5 font-semibold">{numberText(row.page_view)}</td>
                  <td className="px-6 py-3.5 font-semibold">{numberText(row.add_to_cart)}</td>
                  <td className="px-6 py-3.5 font-semibold">{numberText(row.initiate_checkout)}</td>
                  <td className="px-6 py-3.5 font-bold text-slate-800 ">{numberText(row.purchase)}</td>
                  <td className="px-6 py-3.5 font-bold text-indigo-600  text-right">BDT {numberText(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-relaxed text-slate-400 ">
          Showing {districtFunnelUnit}. Repeated actions are removed.
        </p>
      </div>

      {/* Conversion Funnel & Signal Doctor Breakdown */}
      <div
        id="analytics-funnel"
        aria-hidden={activeInsightTab !== 'summary'}
        className={`${activeInsightTab === 'summary' ? 'hidden md:grid' : 'hidden'} scroll-mt-24 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6`}
      >
        <div className="space-y-6 lg:contents">
          {/* Conversion Funnel */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-900">Customer journey</h3>
              <p className="mt-0.5 text-xs text-slate-500">How people move from store visit to order · last {analyticsDays} days.</p>
            </div>

            <div className="space-y-0 px-5 py-5">
              {asArray(analyticsOverview?.funnel).length ? (
                (() => {
                  const funnel = asArray(analyticsOverview?.funnel);
                  const maxCount = Math.max(...funnel.map((f) => Number(f.count || 0)), 1);
                  return funnel.map((step, i: number) => {
                    const currentCount = Number(step.count || 0);
                    const previousCount = i > 0 ? Number(funnel[i - 1]?.count || 0) : currentCount;
                    const hasTrackingGap = i > 0 && currentCount > previousCount;
                    const conversionRate = i === 0
                      ? 100
                      : previousCount > 0
                        ? (currentCount / previousCount) * 100
                        : 0;
                    const displayRate = Number(conversionRate.toFixed(1));
                    const pctWidth = Math.max((currentCount / maxCount) * 100, 5);
                    return (
                      <div key={step.step} className="grid grid-cols-[140px_1fr_100px] items-center gap-4 border-b border-dashed border-slate-200 py-4 last:border-0">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{stepLabel(step.step)}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{numberText(step.count)} actions</p>
                        </div>
                        <div className="h-6 overflow-hidden rounded-md bg-slate-100">
                          <div className="h-full rounded-md bg-gradient-to-r from-indigo-600 to-indigo-500" style={{ width: `${pctWidth}%` }} />
                        </div>
                        <div className="text-right">
                          <p className={`text-xs font-bold ${hasTrackingGap || (i > 0 && displayRate < 25) ? 'text-amber-700' : 'text-slate-900'}`}>
                            {hasTrackingGap ? '—' : `${displayRate}%`}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {i === 0 ? 'of visitors' : hasTrackingGap ? 'tracking gap detected' : 'from previous step'}
                          </p>
                        </div>
                      </div>
                    );
                  });
                })()
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">Customer step data will appear after visitors browse, checkout, and order.</div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:order-3 lg:col-span-3">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Data quality</h3>
                <p className="mt-0.5 text-xs text-slate-500">How much useful customer data reaches each platform.</p>
              </div>
              {signalDoctor?.score !== undefined && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{signalDoctor.score} / 100 · {signalDoctor.grade}</span>
              )}
            </div>

            <div className="grid gap-x-10 gap-y-4 px-5 py-6 md:grid-cols-2">
              {signalRates ? (
                [
                  ['Event ID', signalRates.event_id || 0],
                  ['User match', signalRates.user_match || 0],
                  ['Email / Phone', signalRates.email_or_phone || 0],
                  ['Click IDs', signalRates.click_id || 0],
                  ['Product ID', signalRates.content_ids || 0],
                  ['Order value', signalRates.value || 0],
                  ['UTM source', signalRates.utm || 0],
                ].map(([name, rate]) => (
                  <div key={String(name)} className="grid grid-cols-[110px_1fr_42px] items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">{name}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Number(rate)}%` }} /></div>
                    <span className="text-right text-[11px] font-bold text-slate-900">{rate}%</span>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">Not enough data yet. Keep tracking.</div>
              )}
            </div>
            <footer className="border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">Lower-scoring signals can improve by using consistent campaign links and complete checkout details.</footer>
          </div>
        </div>

        <div className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-1">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tracking health</h3>
              <p className="mt-0.5 text-xs text-slate-500">Checks that keep your ad data reliable.</p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{asArray(signalDoctor?.issues).some(issue => issue.severity === 'critical' || issue.severity === 'high') ? 'Needs attention' : 'All good'}</span>
          </div>

          <div className="divide-y divide-dashed divide-slate-200 px-5 py-5">
              {asArray(signalDoctor?.issues).length ? (
              asArray(signalDoctor?.issues).map((issue, idx: number) => (
                <div key={idx} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    {issue.severity === 'critical' || issue.severity === 'high' ? <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" /> :
                     issue.severity === 'medium' ? <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" /> :
                     <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-bold leading-tight text-slate-900">{issue.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{issue.fix || issue.impact}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-8 text-center text-xs font-semibold text-emerald-700">
                Everything looks good.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Ad Platform Campaign Performance & ROAS Attribution Dashboard */}
      <div id="analytics-ad-performance" role="tabpanel" aria-labelledby="ad-insights-tab-ads" className={`${activeInsightTab === 'ads' ? 'flex' : 'hidden'} scroll-mt-24 flex-col space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-7`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Ad Results</h3>
            <p className="text-xs text-slate-500">See ad cost, new orders, confirmed sales, and return in one place.</p>
            {adPerformanceMeta?.last_synced_at && (
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Last synced: {new Date(adPerformanceMeta.last_synced_at).toLocaleString()}
              </p>
            )}
          </div>
          {loadingAdPerformance && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="animate-spin h-3.5 w-3.5 border-2 border-indigo-500 border-t-transparent rounded-full" />
              <span>Updating ad data...</span>
            </div>
          )}
        </div>

        {adPerformanceMeta && (!adPerformanceMeta.sync_enabled || adPerformanceMeta.connected_accounts === 0 || adPerformanceMeta.missing_attribution_purchases > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            {!adPerformanceMeta.sync_enabled ? (
              <p><strong>Ad sync is off.</strong> Enable ENABLE_AD_SYNC on the server to refresh Meta/TikTok spend automatically.</p>
            ) : adPerformanceMeta.connected_accounts === 0 ? (
              <p><strong>No ad account connected.</strong> Connect a Meta ad account in Settings to populate campaign spend.</p>
            ) : (
              <p>
                <strong>{numberText(adPerformanceMeta.missing_attribution_purchases)} sale event(s) could not be matched to an ad campaign.</strong>
                {' '}Use Campaign Tools and choose a synced campaign so new ad links include bk_campaign_id.
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
          <div>
            <label htmlFor="ad-results-search" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Find campaign</label>
            <input
              id="ad-results-search"
              type="search"
              value={adSearch}
              onChange={(event) => setAdSearch(event.target.value)}
              placeholder="Search by campaign name, ID, or platform"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label htmlFor="ad-results-sort" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Sort by</label>
            <select
              id="ad-results-sort"
              value={adSort}
              onChange={(event) => setAdSort(event.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="confirmed_revenue">Confirmed Sales</option>
              <option value="return">Return</option>
              <option value="cost_per_order">Cost/order</option>
              <option value="new_orders">New Orders</option>
              <option value="spend">Ad Cost</option>
            </select>
          </div>
          <button
            type="button"
            onClick={exportAdResults}
            disabled={!filteredAdPerformance.length}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>

        {/* Info Explainer Banner */}
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-xs text-slate-600 md:grid-cols-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-indigo-700">New Orders</p>
              <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold uppercase text-indigo-700">COD pending included</span>
            </div>
            <p className="leading-normal">Results from all orders placed, including pending COD orders.</p>
          </div>
          <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-indigo-700">Confirmed Sales</p>
              <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold uppercase text-emerald-700">confirmed only</span>
            </div>
            <p className="leading-normal">Results from confirmed or delivered orders after cancelled orders are removed.</p>
          </div>
          <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-4">
            <p className="font-bold text-indigo-700">Extra Tracking</p>
            <p className="leading-normal">Sales data found by Buykori that normal browser tracking missed.</p>
          </div>
        </div>

        {/* Mobile View */}
        <div className="space-y-2 md:hidden">
          {adPerformanceError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-center text-xs text-rose-700">
              <p>{adPerformanceError}</p>
              <button
                type="button"
                onClick={fetchAdPerformance}
                className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700"
              >
                Retry
              </button>
            </div>
          ) : !adPerformance || adPerformance.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
              No ad results yet. Connect an ad account in Settings to see results here.
            </div>
          ) : filteredAdPerformance.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
              No campaign matched your search.
            </div>
          ) : filteredAdPerformance.map((row, idx: number) => {
            const status = getAdStatus(row);
            return (
            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap gap-1">
                    <PlatformBadge platform={row.platform} label={row.platform} />
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 text-xs truncate">{row.campaign_name}</p>
                  <p className="font-mono text-xs text-slate-400 truncate">ID: {row.campaign_id}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-slate-900">{formatMoney(row.spend, row.spend_currency)}</p>
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Spend</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded text-xs font-semibold text-slate-600">
                <div>
                  <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">New Orders</span>
                  <span className="text-indigo-600 font-black">{row.placed_roas}x return</span> | {formatMoney(row.placed_cpa, row.spend_currency)} per order
                  <span className="mt-0.5 block text-xs text-slate-400">
                    {numberText(row.pending_purchases)} pending, {numberText(row.cancelled_purchases)} cancelled/expired
                  </span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">Confirmed Sales</span>
                  <span className="text-emerald-600 font-black">{row.confirmed_roas}x return</span> | {formatMoney(row.confirmed_cpa, row.spend_currency)} per order
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>Clicks: {row.clicks} (click rate: {row.ctr}%)</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 font-bold uppercase text-xs">
                  Extra Tracking: +{row.tracking_bypass_rate}%
                </span>
              </div>
            </div>
          )})}
        </div>

        {/* Desktop View */}
        <div className="hidden max-h-[620px] overflow-auto rounded-lg border border-slate-200 md:block">
          <table className="w-full min-w-[1100px] divide-y divide-slate-100 text-left text-sm text-slate-600">
            <thead className="sticky top-0 z-20 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-50 px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Cost & Clicks</th>
                <th className="px-4 py-3">Click Cost</th>
                <th className="px-4 py-3">New Orders</th>
                <th className="px-4 py-3">Confirmed Sales</th>
                <th className="px-4 py-3 text-right">Extra Tracking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adPerformanceError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-rose-600 font-medium">
                    <div className="flex flex-col items-center gap-3">
                      <span>{adPerformanceError}</span>
                      <button
                        type="button"
                        onClick={fetchAdPerformance}
                        className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                      >
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : !adPerformance || adPerformance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-medium">
                    No ad results yet. Ad account data updates every 6 hours.
                  </td>
                </tr>
              ) : filteredAdPerformance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-medium">
                    No campaign matched your search.
                  </td>
                </tr>
              ) : (
                filteredAdPerformance.map((row, idx: number) => {
                  const status = getAdStatus(row);
                  return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="sticky left-0 z-10 max-w-[280px] bg-white px-4 py-3.5 align-middle shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex flex-wrap gap-1">
                          <PlatformBadge platform={row.platform} label={row.platform} />
                          <span className={`w-fit rounded border px-1.5 py-0.5 text-xs font-black uppercase tracking-wider ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <span className="font-bold text-slate-800 truncate" title={row.campaign_name}>
                          {row.campaign_name}
                        </span>
                        <span className="font-mono text-xs text-slate-400 truncate">
                          ID: {row.campaign_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800">{formatMoney(row.spend, row.spend_currency)}</span>
                        <span className="text-slate-500 text-xs">{numberText(row.clicks)} clicks | {numberText(row.impressions)} views</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{row.ctr}% click rate</span>
                        <span className="text-slate-400 text-xs">{formatMoney(row.cpc, row.spend_currency)} per click</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle bg-slate-50/30">
                      <div className="flex flex-col">
                        <span className="font-black text-indigo-600">{row.placed_roas}x return</span>
                        <span className="text-slate-600 text-xs">{row.placed_purchases} Orders ({formatMoney(row.placed_revenue, row.revenue_currency)})</span>
                        <span className="text-slate-400 text-xs">{numberText(row.pending_purchases)} pending, {numberText(row.cancelled_purchases)} cancelled/expired</span>
                        <span className="text-slate-400 text-xs">Cost/order: {formatMoney(row.placed_cpa, row.spend_currency)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle bg-emerald-50/10">
                      <div className="flex flex-col">
                        <span className="font-black text-emerald-600">{row.confirmed_roas}x return</span>
                        <span className="text-slate-600 text-xs">{row.confirmed_purchases} Confirmed ({formatMoney(row.confirmed_revenue, row.revenue_currency)})</span>
                        <span className="text-slate-400 text-xs">Cost/order: {formatMoney(row.confirmed_cpa, row.spend_currency)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-black text-slate-800">+{row.tracking_bypass_rate}%</span>
                        <span className="rounded bg-emerald-50 px-1 py-0.5 text-xs font-bold uppercase text-emerald-700 tracking-wider">
                          data found
                        </span>
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales attribution sources */}
      <div id="analytics-campaigns" role="tabpanel" aria-labelledby="ad-insights-tab-sales" className={`${activeInsightTab === 'sales' ? 'flex' : 'hidden'} scroll-mt-24 flex-col space-y-3 md:space-y-4`}>
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Sales source</h2>
            <p className="mt-1 text-xs text-slate-500">Which ad place and link bring visitors, orders and sales · last {analyticsDays} days</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-[11px] font-bold text-slate-500">
              {[7, 30, 90].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setAnalyticsDays(days)}
                  className={`rounded-lg px-3 py-2 ${analyticsDays === days ? 'bg-white text-[#193b68] shadow-sm' : ''}`}
                >
                  {days} days
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportSalesSources}
              disabled={!salesSourceRows.length}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#285ac7] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#214fae] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 rounded-xl bg-stone-100 p-1 text-center text-[11px] font-bold text-stone-500 md:hidden">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setAnalyticsDays(days)}
              className={`rounded-lg px-2 py-2 ${analyticsDays === days ? 'bg-white text-slate-800 shadow-sm' : ''}`}
            >
              {days} days
            </button>
          ))}
        </div>

        <section className={`rounded-[16px] border px-3.5 py-3 md:flex md:items-center md:gap-4 md:px-4 ${
          untaggedSalesPercent > 0 ? 'border-blue-200 bg-blue-50/80' : 'border-emerald-200 bg-emerald-50'
        }`}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ${untaggedSalesPercent > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {untaggedSalesPercent > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <h3 className={`text-[12px] font-bold md:text-sm ${untaggedSalesPercent > 0 ? 'text-[#173b68]' : 'text-emerald-800'}`}>
                {untaggedSalesPercent > 0
                  ? `${untaggedSalesPercent}% of sales land in “Direct — no campaign”`
                  : 'All tracked sales are attributed to a campaign'}
              </h3>
              <p className={`mt-1 text-[10px] leading-4 md:text-xs ${untaggedSalesPercent > 0 ? 'text-blue-700/80' : 'text-emerald-700'}`}>
                {untaggedSalesPercent > 0
                  ? `Untagged links account for ${formatMoney(untaggedSourceSales, salesCurrency)}, so those sales cannot be credited to Meta, TikTok or a campaign.`
                  : 'Campaign tags are reaching Buykori correctly.'}
              </p>
            </div>
          </div>
          {untaggedSalesPercent > 0 && (
            <div className="mt-3 md:mt-0 md:w-[40%]">
              <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full rounded-full bg-[#285ac7]" style={{ width: `${untaggedSalesPercent}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] font-bold text-[#285382] md:text-[10px]">
                <span>Untagged {untaggedSalesPercent}%</span>
                <span>Tagged {attributedSalesPercent}%</span>
              </div>
              <button onClick={() => setActivePage?.('campaign-builder')} className="mt-2 w-full rounded-lg bg-[#285ac7] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#214fae] md:ml-auto md:block md:w-fit">
                Tag links with URL Builder
              </button>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {[
            { title: 'Total sales', value: formatMoney(totalSourceSales, salesCurrency), note: `${numberText(totalSourceOrders)} orders · avg ${formatMoney(sourceAverageOrder, salesCurrency)}` },
            { title: 'Attributed', value: formatMoney(attributedSourceSales, salesCurrency), note: attributedSourceSales > 0 ? `${attributedSalesPercent}% tagged` : 'Needs tagged links' },
            { title: 'Visit → order', value: `${visitOrderRate}%`, note: `${numberText(totalSourceOrders)} of ${numberText(totalStoreVisits)} visits` },
            { title: 'Sources with sales', value: numberText(sourcesWithSales), note: `${sourcesWithSales} of ${salesSourceRows.length} seen` },
          ].map(metric => (
            <section key={metric.title} className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,.03)] md:px-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-500 md:text-[10px]">{metric.title}</p>
              <p className="mt-1 text-lg font-black leading-none tracking-tight text-slate-900 md:text-2xl">{metric.value}</p>
              <p className="mt-2 truncate text-[9px] text-slate-400 md:text-[10px]">{metric.note}</p>
            </section>
          ))}
        </div>

        {!salesSourceRows.length ? (
          <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-xs text-slate-400">
            No sales source data yet. Build a tagged campaign link to start attribution.
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-12 gap-4 md:grid">
              <section className="col-span-8 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,.03)]">
                <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Sources by sales</h3>
                    <p className="text-[10px] text-slate-500">Sorted by revenue · funnel shows Visit → Seen → Cart → Checkout → Order</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#285ac7]">
                    {salesSourceRows.filter(isUntaggedSource).length} untagged
                  </span>
                </header>
                <div className="grid grid-cols-[1.25fr_.85fr_1.15fr_.55fr_.8fr] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  <span>Ad place</span><span>Campaign</span><span>Funnel</span><span className="text-right">Orders</span><span className="text-right">Sales</span>
                </div>
                {visibleSalesSources.map((row, index) => {
                  const rowSalesShare = totalSourceSales > 0 ? Number(row.revenue || 0) / totalSourceSales * 100 : 0;
                  const rowOrderRate = totalStoreVisits > 0 ? Number(row.purchase || 0) / totalStoreVisits * 100 : 0;
                  const funnelValues = [
                    index === 0 ? totalStoreVisits : Number(row.view_content || 0),
                    Number(row.view_content || 0),
                    Number(row.add_to_cart || 0),
                    Number(row.initiate_checkout || 0),
                    Number(row.purchase || 0),
                  ];
                  const funnelMax = Math.max(...funnelValues, 1);
                  return (
                    <div key={`${row.source}-${row.campaign}-${index}`} className="grid grid-cols-[1.25fr_.85fr_1.15fr_.55fr_.8fr] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-[#285ac7]">{String(row.source || 'D').charAt(0).toUpperCase()}</span>
                        <span className="min-w-0">
                          <strong className="block truncate text-xs text-slate-800">{row.source || 'Direct'}</strong>
                          <small className="block truncate text-[9px] text-slate-400">{isUntaggedSource(row) ? 'No referrer or UTM found' : 'Tracked source'}</small>
                        </span>
                      </div>
                      <span className="truncate text-[10px] text-slate-500">{row.campaign || 'Not set'}</span>
                      <div>
                        <div className="flex h-7 items-end gap-1">
                          {funnelValues.map((value, funnelIndex) => (
                            <span key={funnelIndex} className="w-3 rounded-t bg-[#4b9aeb]" style={{ height: `${Math.max(4, value / funnelMax * 26)}px`, opacity: 1 - funnelIndex * .12 }} />
                          ))}
                        </div>
                        <small className="text-[8px] text-slate-400">{funnelValues.map(numberText).join(' · ')}</small>
                      </div>
                      <div className="text-right">
                        <strong className="block text-xs text-slate-800">{numberText(row.purchase)}</strong>
                        <small className="text-[8px] text-slate-400">{rowOrderRate.toFixed(1)}% visits</small>
                      </div>
                      <div className="text-right">
                        <strong className="block text-xs text-slate-900">{formatMoney(row.revenue, row.currency || salesCurrency)}</strong>
                        <div className="mt-1 ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#285ac7]" style={{ width: `${rowSalesShare}%` }} />
                        </div>
                        <small className="text-[8px] text-slate-400">{rowSalesShare.toFixed(1)}% sales</small>
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[1.25fr_.85fr_1.15fr_.55fr_.8fr] gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-xs font-bold text-slate-800">
                  <span>Total</span><span /><span className="text-[9px] font-medium text-slate-400">{numberText(totalStoreVisits)} · {numberText(totalProductsSeen)} · {numberText(totalAddedToCart)} · {numberText(totalCheckouts)} · {numberText(totalSourceOrders)}</span><span className="text-right">{numberText(totalSourceOrders)}</span><span className="text-right">{formatMoney(totalSourceSales, salesCurrency)}</span>
                </div>
                {inactiveSalesSources.length > 0 && (
                  <button type="button" onClick={() => setShowInactiveSalesSources(value => !value)} className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left text-[10px] font-bold text-slate-500">
                    <span>{inactiveSalesSources.map(row => row.source).join(', ')} · no activity in this period</span>
                    <span className="text-[#285ac7]">{showInactiveSalesSources ? 'Hide' : 'Show anyway'}</span>
                  </button>
                )}
              </section>

              <div className="col-span-4 space-y-4">
                <section className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-[0_4px_18px_rgba(15,23,42,.03)]">
                  <h3 className="text-sm font-bold text-slate-900">Where sales are credited</h3>
                  <p className="text-[10px] text-slate-500">Share of {formatMoney(totalSourceSales, salesCurrency)}</p>
                  <div className="mt-3 flex items-center gap-4">
                    <svg className="h-20 w-20 shrink-0 -rotate-90" viewBox="0 0 42 42" aria-label={`${untaggedSalesPercent}% direct or untagged sales`}>
                      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e9eef5" strokeWidth="6" />
                      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#285ac7" strokeWidth="6" strokeDasharray={`${untaggedSalesPercent} ${100 - untaggedSalesPercent}`} strokeDashoffset="0" />
                    </svg>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {salesCreditRows.slice(0, 4).map((credit, index) => (
                        <div key={credit.label} className="flex items-center gap-2 text-[10px]">
                          <span className={`h-2 w-2 rounded-sm ${index === 0 ? 'bg-[#285ac7]' : 'bg-blue-200'}`} />
                          <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">{credit.label}</span>
                          <strong className="text-slate-800">{credit.percent}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-slate-500">Tagged links separate paid campaigns from direct traffic, so you can see which ads actually generate sales.</p>
                </section>

                <section className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-[0_4px_18px_rgba(15,23,42,.03)]">
                  <h3 className="text-sm font-bold text-slate-900">Fix in 2 steps</h3>
                  <p className="text-[10px] text-slate-500">About 10 minutes · unlocks real ROAS</p>
                  {[
                    { number: 1, title: 'Build tagged ad links', description: 'Generate UTM + Click ID links, then replace destination URLs in live ads.', action: 'Open URL Builder', page: 'campaign-builder' },
                    { number: 2, title: 'Connect ad spend', description: 'Adds Return and Cost per order beside each source.', action: 'Connect', page: 'settings' },
                  ].map((step, index) => (
                    <div key={step.number} className={`flex gap-3 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-bold text-[#285ac7]">{step.number}</span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{step.title}</h4>
                        <p className="mt-1 text-[10px] leading-4 text-slate-500">{step.description}</p>
                        <button onClick={() => setActivePage?.(step.page)} className="mt-2 rounded-lg bg-[#285ac7] px-3 py-2 text-[10px] font-bold text-white">{step.action}</button>
                      </div>
                    </div>
                  ))}
                </section>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              <section className="rounded-[16px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[12px] font-bold text-slate-800">Sources by sales</h3>
                    <p className="text-[9px] text-slate-400">Sorted by revenue</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-[#285ac7]">{salesSourceRows.filter(isUntaggedSource).length} untagged</span>
                </div>
                {visibleSalesSources.slice(0, 4).map((row, index) => {
                  const share = totalSourceSales > 0 ? Number(row.revenue || 0) / totalSourceSales * 100 : 0;
                  return (
                    <div key={`${row.source}-${row.campaign}-${index}`} className={`py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-[#285ac7]">{String(row.source || 'D').charAt(0).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[11px] text-slate-800">{row.source || 'Direct'} {isUntaggedSource(row) && <em className="ml-1 rounded bg-blue-50 px-1 py-0.5 not-italic text-[8px] text-[#285ac7]">UNTAGGED</em>}</strong>
                          <small className="block truncate text-[9px] text-slate-400">{row.campaign || 'Campaign not set'}</small>
                        </span>
                        <span className="text-right">
                          <strong className="block text-xs text-slate-900">{formatMoney(row.revenue, row.currency || salesCurrency)}</strong>
                          <small className="text-[8px] text-slate-400">{share.toFixed(1)}% sales</small>
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#285ac7]" style={{ width: `${share}%` }} /></div>
                    </div>
                  );
                })}
              </section>

              <section className="rounded-[16px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
                <h3 className="text-[12px] font-bold text-slate-800">{primarySalesSource?.source || 'Direct'} · funnel</h3>
                <p className="text-[9px] text-slate-400">Visit → Seen → Cart → Checkout → Order</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {[
                    ['Visits', totalStoreVisits],
                    ['Seen', totalProductsSeen],
                    ['Cart', totalAddedToCart],
                    ['Checkout', totalCheckouts],
                    ['Orders', totalSourceOrders],
                    ['Conv.', `${visitOrderRate}%`],
                  ].map(([label, value], index) => (
                    <div key={String(label)} className={`rounded-lg border px-2 py-2 ${sourceHasCartGap && index === 2 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50/70'}`}>
                      <p className="text-[8px] font-bold uppercase text-slate-400">{label}</p>
                      <p className={`mt-1 text-sm font-black ${sourceHasCartGap && index === 2 ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p>
                    </div>
                  ))}
                </div>
                {sourceHasCartGap && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[9px] leading-4 text-amber-800">
                    <strong>Cart ({numberText(totalAddedToCart)}) is lower than Checkout ({numberText(totalCheckouts)}).</strong> AddToCart may be firing late or missing.
                  </div>
                )}
                {inactiveSalesSources.length > 0 && (
                  <button type="button" onClick={() => setShowInactiveSalesSources(value => !value)} className="mt-3 flex w-full items-center justify-between border-t border-slate-100 pt-3 text-left text-[9px] font-bold text-slate-500">
                    <span>{inactiveSalesSources.map(row => row.source).join(', ')} · no activity</span>
                    <span className="text-[#285ac7]">{showInactiveSalesSources ? 'Hide' : 'Show anyway'}</span>
                  </button>
                )}
              </section>

              <section className="rounded-[16px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
                <h3 className="text-[12px] font-bold text-slate-800">Where sales are credited</h3>
                <p className="text-[9px] text-slate-400">Share of {formatMoney(totalSourceSales, salesCurrency)}</p>
                <div className="mt-3 flex items-center gap-4">
                  <svg className="h-20 w-20 shrink-0 -rotate-90" viewBox="0 0 42 42" aria-label={`${untaggedSalesPercent}% direct or untagged sales`}>
                    <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e9eef5" strokeWidth="6" />
                    <circle cx="21" cy="21" r="15.9" fill="none" stroke="#285ac7" strokeWidth="6" strokeDasharray={`${untaggedSalesPercent} ${100 - untaggedSalesPercent}`} />
                  </svg>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {salesCreditRows.slice(0, 4).map((credit, index) => (
                      <div key={credit.label} className="flex items-center gap-2 text-[9px]">
                        <span className={`h-2 w-2 rounded-sm ${index === 0 ? 'bg-[#285ac7]' : 'bg-blue-200'}`} />
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">{credit.label}</span>
                        <strong className="text-slate-800">{credit.percent}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[16px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
                <h3 className="text-[12px] font-bold text-slate-800">Fix in 2 steps</h3>
                <p className="text-[9px] text-slate-400">About 10 minutes · unlocks real ROAS</p>
                {[
                  { number: 1, title: 'Build tagged ad links', description: 'Generate UTM + Click ID links, then replace destination URLs in live ads.', action: 'Open URL Builder', page: 'campaign-builder' },
                  { number: 2, title: 'Connect ad spend', description: 'Adds Return and Cost per order beside each source.', action: 'Connect', page: 'settings' },
                ].map((step, index) => (
                  <div key={step.number} className={`flex gap-2.5 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[10px] font-bold text-[#285ac7]">{step.number}</span>
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-800">{step.title}</h4>
                      <p className="mt-1 text-[9px] leading-4 text-slate-500">{step.description}</p>
                      <button onClick={() => setActivePage?.(step.page)} className="mt-2 rounded-lg bg-[#285ac7] px-3 py-2 text-[9px] font-bold text-white">{step.action}</button>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
