import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type {
  AdPerformanceMeta,
  AdPerformanceRow,
  AnalyticsAudience,
  AnalyticsCampaigns,
  AnalyticsOverview,
  SignalDoctor,
} from '../types';
import { asArray, formatMoney, isUnknownArea, numberText, percentText, stepLabel } from './analytics/analyticsFormat';
import { AdResultsSection } from './analytics/AdResultsSection';
import { CustomersSection } from './analytics/CustomersSection';
import { FunnelQualitySection } from './analytics/FunnelQualitySection';
import { MobileSummaryPanel } from './analytics/MobileSummaryPanel';
import { SalesSourceSection } from './analytics/SalesSourceSection';
import { SummaryOverviewCards } from './analytics/SummaryOverviewCards';

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
  const [showAllCustomerAreas, setShowAllCustomerAreas] = React.useState(false);
  const topDistricts = asArray(analyticsAudience?.top_districts);
  const deviceMix = asArray(analyticsAudience?.device_mix);
  const [districtFunnelMode, setDistrictFunnelMode] = React.useState<'events' | 'visitors'>('events');
  const eventDistrictFunnel = asArray(analyticsAudience?.district_funnel);
  const visitorDistrictFunnel = asArray(analyticsAudience?.visitor_district_funnel);
  const districtFunnel = districtFunnelMode === 'visitors' ? visitorDistrictFunnel : eventDistrictFunnel;
  const signalRates = signalDoctor?.signal_rates && Object.keys(signalDoctor.signal_rates).length
    ? signalDoctor.signal_rates
    : null;

  const [adPerformance, setAdPerformance] = React.useState<AdPerformanceRow[]>([]);
  const [adPerformanceMeta, setAdPerformanceMeta] = React.useState<AdPerformanceMeta | null>(null);
  const [loadingAdPerformance, setLoadingAdPerformance] = React.useState<boolean>(false);
  const [adPerformanceError, setAdPerformanceError] = React.useState<string | null>(null);
  const [adSearch, setAdSearch] = React.useState('');
  const [adSort, setAdSort] = React.useState('confirmed_revenue');

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

  const browserMix = asArray(analyticsAudience?.browser_mix);
  const knownDistricts = topDistricts.filter(row => !isUnknownArea(row.label));
  const unknownDistrict = topDistricts.find(row => isUnknownArea(row.label));
  const uniqueCustomerVisitors = Math.max(
    topDistricts.reduce((total, row) => total + Number(row.count || 0), 0),
    deviceMix.reduce((total, row) => total + Number(row.count || 0), 0),
    browserMix.reduce((total, row) => total + Number(row.count || 0), 0),
  );
  const knownLocationVisitors = knownDistricts.reduce((total, row) => total + Number(row.count || 0), 0);
  const unknownLocationVisitors = Math.max(Number(unknownDistrict?.count || 0), uniqueCustomerVisitors - knownLocationVisitors);
  const knownLocationPercent = uniqueCustomerVisitors > 0
    ? Number(((knownLocationVisitors / uniqueCustomerVisitors) * 100).toFixed(1))
    : 0;
  const topRealCity = knownDistricts[0] || null;
  const mobileDevice = deviceMix.find(row => row.label.toLowerCase() === 'mobile');
  const desktopDevice = deviceMix.find(row => row.label.toLowerCase() === 'desktop');
  const mobileShare = Number(mobileDevice?.percentage || 0);
  const desktopShare = Number(desktopDevice?.percentage || 0);
  const totalAudienceOrders = eventDistrictFunnel.reduce((total, row) => total + Number(row.purchase || 0), 0);
  const topOrderArea = [...eventDistrictFunnel].sort((a, b) => Number(b.purchase || 0) - Number(a.purchase || 0))[0];
  const topOrderShare = totalAudienceOrders > 0
    ? Number(((Number(topOrderArea?.purchase || 0) / totalAudienceOrders) * 100).toFixed(1))
    : 0;
  const customerAreas = [
    ...knownDistricts,
    ...(unknownLocationVisitors > 0 ? [{
      label: 'Unknown location',
      count: unknownLocationVisitors,
      percentage: uniqueCustomerVisitors > 0 ? Number(((unknownLocationVisitors / uniqueCustomerVisitors) * 100).toFixed(1)) : 0,
    }] : []),
  ];
  const customerAreaRows = showAllCustomerAreas ? customerAreas : customerAreas.slice(0, 6);
  const primaryAreaFunnel = districtFunnel[0] || null;
  const unknownAreaFunnel = districtFunnel.find(row => isUnknownArea(row.district)) || null;

  const exportCustomerInsights = () => {
    if (!analyticsAudience) return;
    const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows: unknown[][] = [
      ['Customer audience report', `Last ${analyticsDays} days`],
      [],
      ['Area', 'Visitors', 'Share'],
      ...customerAreas.map(row => [row.label, row.count, row.percentage]),
      [],
      ['Device', 'Visitors', 'Share'],
      ...deviceMix.map(row => [row.label, row.count, row.percentage]),
      [],
      ['Browser', 'Visitors', 'Share'],
      ...browserMix.map(row => [row.label, row.count, row.percentage]),
    ];
    const blob = new Blob([rows.map(row => row.map(escapeCsv).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `buykori-customers-${analyticsDays}d.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };


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
        <div className={`${activeInsightTab === 'summary' ? 'hidden sm:flex' : activeInsightTab === 'sales' || activeInsightTab === 'customers' ? 'hidden' : 'flex'} shrink-0 items-center gap-2`}>
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

      <MobileSummaryPanel
        activeInsightTab={activeInsightTab}
        analyticsDays={analyticsDays}
        setAnalyticsDays={setAnalyticsDays}
        analyticsOverview={analyticsOverview}
        signalDoctor={signalDoctor}
        adSummary={adSummary}
        qualityScore={qualityScore}
        mobileSignalEntries={mobileSignalEntries}
        healthyMobileSignals={healthyMobileSignals}
        attentionMobileSignals={attentionMobileSignals}
        visibleMobileSignals={visibleMobileSignals}
        showAllMobileSignals={showAllMobileSignals}
        setShowAllMobileSignals={setShowAllMobileSignals}
        mobileFixes={mobileFixes}
        setDismissedMobileFixes={setDismissedMobileFixes}
        mobileFunnel={mobileFunnel}
        mobileFunnelMax={mobileFunnelMax}
        mobileTrackingGaps={mobileTrackingGaps}
        setActivePage={setActivePage}
      />

      <SummaryOverviewCards
        activeInsightTab={activeInsightTab}
        analyticsDays={analyticsDays}
        analyticsOverview={analyticsOverview}
        signalDoctor={signalDoctor}
        adSummary={adSummary}
        loadingAdPerformance={loadingAdPerformance}
        adPerformanceError={adPerformanceError}
      />

      <CustomersSection
        activeInsightTab={activeInsightTab}
        analyticsDays={analyticsDays}
        setAnalyticsDays={setAnalyticsDays}
        analyticsAudience={analyticsAudience}
        exportCustomerInsights={exportCustomerInsights}
        topDistricts={topDistricts}
        deviceMix={deviceMix}
        browserMix={browserMix}
        customerAreas={customerAreas}
        customerAreaRows={customerAreaRows}
        topRealCity={topRealCity}
        mobileDevice={mobileDevice}
        mobileShare={mobileShare}
        desktopShare={desktopShare}
        uniqueCustomerVisitors={uniqueCustomerVisitors}
        knownLocationVisitors={knownLocationVisitors}
        knownLocationPercent={knownLocationPercent}
        unknownLocationVisitors={unknownLocationVisitors}
        totalAudienceOrders={totalAudienceOrders}
        topOrderArea={topOrderArea}
        topOrderShare={topOrderShare}
        totalSourceSales={totalSourceSales}
        showAllCustomerAreas={showAllCustomerAreas}
        setShowAllCustomerAreas={setShowAllCustomerAreas}
        districtFunnel={districtFunnel}
        eventDistrictFunnel={eventDistrictFunnel}
        primaryAreaFunnel={primaryAreaFunnel}
        unknownAreaFunnel={unknownAreaFunnel}
        districtFunnelMode={districtFunnelMode}
        setDistrictFunnelMode={setDistrictFunnelMode}
        isUnknownArea={isUnknownArea}
      />

      <FunnelQualitySection
        activeInsightTab={activeInsightTab}
        analyticsDays={analyticsDays}
        analyticsOverview={analyticsOverview}
        signalDoctor={signalDoctor}
        signalRates={signalRates}
      />

      <AdResultsSection
        activeInsightTab={activeInsightTab}
        adPerformance={adPerformance}
        filteredAdPerformance={filteredAdPerformance}
        adPerformanceMeta={adPerformanceMeta}
        adPerformanceError={adPerformanceError}
        loadingAdPerformance={loadingAdPerformance}
        adSearch={adSearch}
        setAdSearch={setAdSearch}
        adSort={adSort}
        setAdSort={setAdSort}
        getAdStatus={getAdStatus}
        fetchAdPerformance={fetchAdPerformance}
        exportAdResults={exportAdResults}
      />

      <SalesSourceSection
        activeInsightTab={activeInsightTab}
        analyticsDays={analyticsDays}
        setAnalyticsDays={setAnalyticsDays}
        salesSourceRows={salesSourceRows}
        visibleSalesSources={visibleSalesSources}
        inactiveSalesSources={inactiveSalesSources}
        primarySalesSource={primarySalesSource}
        isUntaggedSource={isUntaggedSource}
        showInactiveSalesSources={showInactiveSalesSources}
        setShowInactiveSalesSources={setShowInactiveSalesSources}
        salesCreditRows={salesCreditRows}
        salesCurrency={salesCurrency}
        totalSourceSales={totalSourceSales}
        totalSourceOrders={totalSourceOrders}
        totalProductsSeen={totalProductsSeen}
        totalAddedToCart={totalAddedToCart}
        totalCheckouts={totalCheckouts}
        totalStoreVisits={totalStoreVisits}
        sourceAverageOrder={sourceAverageOrder}
        sourcesWithSales={sourcesWithSales}
        sourceHasCartGap={sourceHasCartGap}
        untaggedSourceSales={untaggedSourceSales}
        attributedSourceSales={attributedSourceSales}
        untaggedSalesPercent={untaggedSalesPercent}
        attributedSalesPercent={attributedSalesPercent}
        visitOrderRate={visitOrderRate}
        exportSalesSources={exportSalesSources}
        setActivePage={setActivePage}
      />

    </div>
  );
}
