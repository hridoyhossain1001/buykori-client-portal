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
}

export function AnalyticsView({
  analyticsOverview,
  analyticsCampaigns,
  analyticsAudience,
  signalDoctor,
  analyticsError,
  analyticsDays,
  setAnalyticsDays
}: AnalyticsViewProps) {
  const insightTabs = [
    { id: 'summary', label: 'Summary', sectionId: 'analytics-overview' },
    { id: 'ads', label: 'Ad Results', sectionId: 'analytics-ad-performance' },
    { id: 'sales', label: 'Sales Source', sectionId: 'analytics-campaigns' },
    { id: 'customers', label: 'Customers', sectionId: 'analytics-audience' },
  ];
  const [activeInsightTab, setActiveInsightTab] = React.useState('summary');
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
        <nav className="w-fit max-w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Ad Insights sections">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Ad Insights sections">
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
                className={`min-h-9 min-w-fit rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                  activeInsightTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
        <div className="flex shrink-0 items-center gap-2">
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

      {analyticsOverview && (
        <div id="analytics-overview" role="tabpanel" aria-labelledby="ad-insights-tab-summary" className={`${activeInsightTab === 'summary' ? 'grid' : 'hidden'} scroll-mt-24 grid-cols-2 gap-3 lg:grid-cols-4`}>
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

      <section aria-hidden={activeInsightTab !== 'summary'} className={`${activeInsightTab === 'summary' ? 'block' : 'hidden'} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm`}>
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
        className={`${activeInsightTab === 'summary' ? 'grid' : 'hidden'} scroll-mt-24 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6`}
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
                    const pctWidth = Math.max((Number(step.count || 0) / maxCount) * 100, 5);
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
                          <p className={`text-xs font-bold ${i > 0 && step.drop_off > 75 ? 'text-amber-700' : 'text-slate-900'}`}>{i === 0 ? '100%' : `${Math.max(0, 100 - Number(step.drop_off || 0))}%`}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{i === 0 ? 'of visitors' : 'from previous step'}</p>
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

      {/* Campaign UTM Performance Table */}
      <div id="analytics-campaigns" role="tabpanel" aria-labelledby="ad-insights-tab-sales" className={`${activeInsightTab === 'sales' ? 'flex' : 'hidden'} scroll-mt-24 flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6`}>
        <div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Sales Source</h3>
          <p className="text-xs text-slate-400">See which ad place and link bring visitors, orders, and sales.</p>
        </div>

        <div className="space-y-2 md:hidden">
          {!analyticsCampaigns?.campaigns || analyticsCampaigns.campaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
              No sales source data yet. Create a sales link below to start tracking.
            </div>
          ) : analyticsCampaigns.campaigns.slice(0, 6).map((row, idx: number) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-indigo-700">{row.source}</p>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">{row.campaign}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{numberText(row.purchase)}</p>
                  <p className="text-xs font-semibold uppercase text-slate-400">Purchases</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Seen {numberText(row.view_content)} | Cart {numberText(row.add_to_cart)} | Checkout {numberText(row.initiate_checkout)}
              </p>
              <p className="mt-2 text-right text-xs font-bold text-indigo-600">BDT {numberText(row.revenue)}</p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[700px]  ">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500  ">
              <tr>
                <th className="px-6 py-3">Ad Place</th>
                <th className="px-6 py-3">Campaign Name</th>
                <th className="px-6 py-3">Product Seen</th>
                <th className="px-6 py-3">Added to Cart</th>
                <th className="px-6 py-3">Checkouts</th>
                <th className="px-6 py-3">Orders</th>
                <th className="px-6 py-3 text-right">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {!analyticsCampaigns?.campaigns || analyticsCampaigns.campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium ">
                    No sales source data yet. Create a sales link below to start tracking.
                  </td>
                </tr>
              ) : (
                analyticsCampaigns.campaigns.map((row, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50  transition-colors">
                    <td className="px-6 py-3.5 font-bold text-indigo-700 ">{row.source}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-800 ">{row.campaign}</td>
                    <td className="px-6 py-3.5 font-semibold">{numberText(row.view_content)}</td>
                    <td className="px-6 py-3.5 font-semibold">{numberText(row.add_to_cart)}</td>
                    <td className="px-6 py-3.5 font-semibold">{numberText(row.initiate_checkout)}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800 ">{numberText(row.purchase)}</td>
                    <td className="px-6 py-3.5 font-bold text-indigo-600 text-right">{formatMoney(row.revenue, row.currency)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
