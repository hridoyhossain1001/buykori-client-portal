import React from 'react';
import { Tooltip } from './common/Tooltip';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Check, 
  Copy,
  Download,
  MapPin,
  Smartphone
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as ReChartsTooltip
} from 'recharts';

interface AnalyticsViewProps {
  analyticsOverview: any;
  analyticsCampaigns: any;
  analyticsAudience: any;
  signalDoctor: any;
  analyticsError?: string | null;
  urlBuilderBaseUrl: string;
  setUrlBuilderBaseUrl: (url: string) => void;
  urlBuilderSource: string;
  setUrlBuilderSource: (source: string) => void;
  urlBuilderMedium: string;
  setUrlBuilderMedium: (medium: string) => void;
  urlBuilderCampaign: string;
  setUrlBuilderCampaign: (campaign: string) => void;
  urlBuilderContent: string;
  setUrlBuilderContent: (content: string) => void;
  urlBuilderTerm: string;
  setUrlBuilderTerm: (term: string) => void;
  generatedCampaignUrl: string;
  handleGenerateCampaignUrl: () => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
}

export function AnalyticsView({
  analyticsOverview,
  analyticsCampaigns,
  analyticsAudience,
  signalDoctor,
  analyticsError,
  urlBuilderBaseUrl,
  setUrlBuilderBaseUrl,
  urlBuilderSource,
  setUrlBuilderSource,
  urlBuilderMedium,
  setUrlBuilderMedium,
  urlBuilderCampaign,
  setUrlBuilderCampaign,
  urlBuilderContent,
  setUrlBuilderContent,
  urlBuilderTerm,
  setUrlBuilderTerm,
  generatedCampaignUrl,
  handleGenerateCampaignUrl,
  copiedStates,
  handleCopy,
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
  const asArray = (value: any) => Array.isArray(value) ? value : [];
  const numberText = (value: any) => Number(value || 0).toLocaleString();
  const percentText = (value: any) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric}%` : '0%';
  };
  const topDistricts = asArray(analyticsAudience?.top_districts);
  const deviceMix = asArray(analyticsAudience?.device_mix);
  const [districtFunnelMode, setDistrictFunnelMode] = React.useState<'events' | 'visitors'>('events');
  const matchChartHostRef = React.useRef<HTMLDivElement | null>(null);
  const [matchChartSize, setMatchChartSize] = React.useState({ width: 640, height: 256 });
  const eventDistrictFunnel = asArray(analyticsAudience?.district_funnel);
  const visitorDistrictFunnel = asArray(analyticsAudience?.visitor_district_funnel);
  const districtFunnel = districtFunnelMode === 'visitors' ? visitorDistrictFunnel : eventDistrictFunnel;
  const districtFunnelUnit = districtFunnelMode === 'visitors' ? 'visitors' : 'events';
  const signalRates = signalDoctor?.signal_rates && Object.keys(signalDoctor.signal_rates).length
    ? signalDoctor.signal_rates
    : null;

  const [adPerformance, setAdPerformance] = React.useState<any[]>([]);
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
    } catch (err) {
      console.error("Failed to fetch ad performance analytics", err);
      setAdPerformance([]);
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

  const getAdStatus = React.useCallback((row: any) => {
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

    const valueForSort = (row: any) => {
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
    const escapeCsv = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = filteredAdPerformance.map((row: any) => {
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
    return [
      {
        title: 'Top area',
        value: topArea?.label || 'No data yet',
        note: topArea ? `${Number(topArea.percentage || 0)}% of tracked visitors` : 'Area data will appear after visitors browse your store.',
      },
      {
        title: 'Top device',
        value: topDevice?.label || 'No data yet',
        note: topDevice ? `${Number(topDevice.percentage || 0)}% use this device. Keep checkout fast here.` : 'Device data will appear after tracking starts.',
      },
      {
        title: 'Top browser',
        value: topBrowser?.label || 'No data yet',
        note: topBrowser ? `${Number(topBrowser.percentage || 0)}% use this browser. Test checkout here first.` : 'Browser data will appear after tracking starts.',
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

  const issueLevel = (severity: string) => {
    if (severity === 'critical' || severity === 'high') return 'Needs fix';
    if (severity === 'medium') return 'Check soon';
    if (severity === 'ok') return 'Good';
    return 'Info';
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
    const host = matchChartHostRef.current;
    if (!host) return;

    const updateSize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      setMatchChartSize(prev => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

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
    <div id="analytics-root" ref={analyticsRootRef} className="scroll-mt-20 space-y-4 md:scroll-mt-24 md:space-y-6">
      
      {/* Page Heading & Timeframe Selector */}
      <div className="flex flex-row items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 md:text-xl">Ad Insights</h2>
          <p className="text-xs text-slate-400">See your ads, sales, customers, and tracking results.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-semibold text-slate-500 sm:inline">Date:</span>
          <select 
            value={analyticsDays} 
            onChange={(e) => setAnalyticsDays(Number(e.target.value))}
            aria-label="Select analytics timeframe"
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm outline-none focus:ring-1 focus:ring-blue-500 sm:px-3"
          >
            <option value="7">Last 7 Days</option>
            <option value="14">Last 14 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>
      </div>

      {analyticsError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{analyticsError}</span>
        </div>
      )}

      <nav className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm" aria-label="Ad Insights sections">
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
              className={`min-w-fit rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
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
      
      {/* 4 Stats Cards */}
      {analyticsOverview && (
        <div id="analytics-overview" role="tabpanel" aria-labelledby="ad-insights-tab-summary" className={`${activeInsightTab === 'summary' ? 'grid' : 'hidden'} scroll-mt-24 grid-cols-2 gap-3 lg:grid-cols-4`}>
          
          {/* Card 1: Total Events */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-800  border border-indigo-300/30 bg-indigo-100/50  px-2 py-1 rounded-md">Total Events</p>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-slate-900 tracking-tight">
                {numberText(analyticsOverview.total_events)}
              </p>
              <span className="text-xs font-semibold text-[#7564e0]">events tracked</span>
            </div>
          </div>

          {/* Card 2: Success Rate */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-800  border border-emerald-300/30 bg-emerald-100/50  px-2 py-1 rounded-md">Success Rate</p>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-slate-900 tracking-tight">
                {percentText(analyticsOverview.success_rate)}
              </p>
              <span className="text-xs font-semibold text-[#008765]">Success</span>
            </div>
          </div>

          {/* Card 3: Avg Daily */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-purple-800  border border-purple-300/30 bg-purple-100/50  px-2 py-1 rounded-md">Daily Average</p>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-slate-900 tracking-tight">
                {numberText(analyticsOverview.avg_daily_events)}
              </p>
              <span className="text-xs font-semibold text-[#a647e5]">Avg daily</span>
            </div>
          </div>

          {/* Card 4: Signal Grade */}
          {signalDoctor && (
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-800  border border-amber-300/30 bg-amber-100/50  px-2 py-1 rounded-md flex items-center">
                  Data Quality
                  <Tooltip content="Data quality shows how complete your tracking data is. More phone, email, event ID, product ID, and order value usually helps ad platforms match sales better." />
                </p>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <p className="text-2xl font-bold text-slate-900 tracking-tight">
                  {signalDoctor.score}/100
                </p>
                <span className="text-xs font-semibold text-[#b26200]">{signalDoctor.grade}</span>
              </div>
            </div>
          )}

        </div>
      )}

      <div
        aria-hidden={activeInsightTab !== 'summary'}
        className={`${activeInsightTab === 'summary' ? 'block' : 'hidden'} scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6`}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Business Results</h3>
            <p className="text-xs text-slate-500">A quick view of ad cost, orders, confirmed sales, and return.</p>
          </div>
          {loadingAdPerformance && (
            <span className="text-xs font-semibold text-slate-400">Updating ad data...</span>
          )}
        </div>
        {adPerformanceError && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 sm:flex-row sm:items-center sm:justify-between">
            <span>{adPerformanceError}</span>
            <button
              type="button"
              onClick={fetchAdPerformance}
              className="w-fit rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ad Cost</p>
            <p className="mt-2 text-lg font-black text-slate-900">{formatMoney(adSummary.spend, adSummary.spendCurrency)}</p>
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700">New Orders</p>
            <p className="mt-2 text-lg font-black text-slate-900">{numberText(adSummary.placedPurchases)}</p>
            <p className="mt-1 text-[10px] font-semibold text-indigo-700">COD pending included</p>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Confirmed Sales</p>
            <p className="mt-2 text-lg font-black text-slate-900">{formatMoney(adSummary.confirmedRevenue, adSummary.revenueCurrency)}</p>
            <p className="mt-1 text-[10px] font-semibold text-emerald-700">{numberText(adSummary.confirmedPurchases)} confirmed</p>
          </div>
          <div className="rounded-lg border border-violet-100 bg-violet-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Return</p>
            <p className="mt-2 text-lg font-black text-slate-900">{adSummary.returnRate.toFixed(2)}x</p>
            <p className="mt-1 text-[10px] font-semibold text-violet-700">confirmed only</p>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Cost/order</p>
            <p className="mt-2 text-lg font-black text-slate-900">{formatMoney(adSummary.costPerOrder, adSummary.spendCurrency)}</p>
            <p className="mt-1 text-[10px] font-semibold text-amber-700">confirmed orders</p>
          </div>
        </div>
      </div>

      <div
        aria-hidden={activeInsightTab !== 'customers'}
        className={`${activeInsightTab === 'customers' ? 'grid' : 'hidden'} scroll-mt-24 grid-cols-1 gap-3 md:grid-cols-3`}
      >
        {customerInsights.map((item) => (
          <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{item.title}</p>
            <p className="mt-2 text-lg font-black text-slate-900">{item.value}</p>
            <p className="mt-1 text-xs leading-normal text-slate-500">{item.note}</p>
          </div>
        ))}
      </div>

      {/* Estimated Geo & Device Mix */}
      <div id="analytics-audience" role="tabpanel" aria-labelledby="ad-insights-tab-customers" className={`${activeInsightTab === 'customers' ? 'grid' : 'hidden'} scroll-mt-24 grid-cols-1 xl:grid-cols-3 gap-6`}>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Customer Areas</h3>
              <p className="text-xs text-slate-400 ">Approximate area from visitor IP and checkout information.</p>
            </div>
            <MapPin className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="space-y-3">
            {topDistricts.length ? topDistricts.map((row: any) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 ">{row.label}</span>
                  <span className="font-mono text-slate-500 ">{numberText(row.count)} - {Number(row.percentage || 0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100  overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(row.percentage, 3)}%` }} />
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-xs text-slate-400">Location data will appear after visitors start browsing your store.</div>
            )}
          </div>
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800   ">
            {analyticsAudience?.notice || 'City and district data is approximate and not 100% accurate.'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Customer Devices</h3>
              <p className="text-xs text-slate-400 ">Mobile, desktop and tablet share from tracked visitors.</p>
            </div>
            <Smartphone className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="space-y-3">
            {deviceMix.length ? deviceMix.map((row: any) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 ">{row.label}</span>
                  <span className="font-mono text-slate-500 ">{numberText(row.count)} - {Number(row.percentage || 0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100  overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(row.percentage, 3)}%` }} />
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-xs text-slate-400">Device data will appear after visitors start browsing your store.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <div className="mb-5">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Customer Browsers</h3>
            <p className="text-xs text-slate-400 ">Browsers your customers use.</p>
          </div>
          <div className="space-y-3">
            {asArray(analyticsAudience?.browser_mix).length ? asArray(analyticsAudience?.browser_mix).map((row: any) => (
              <div key={row.label} className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs last:border-0 ">
                <span className="font-bold text-slate-700 ">{row.label}</span>
                <span className="font-mono text-slate-500 ">{numberText(row.count)} - {Number(row.percentage || 0)}%</span>
              </div>
            )) : (
              <div className="py-10 text-center text-xs text-slate-400">Browser data will appear after visitors start browsing your store.</div>
            )}
          </div>
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
          <div className="inline-flex h-9 w-fit items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] font-bold  ">
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
          ) : districtFunnel.slice(0, 6).map((row: any) => (
            <div key={row.district} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-indigo-700">{row.district}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Seen {numberText(row.page_view)} | Cart {numberText(row.add_to_cart)} | Checkout {numberText(row.initiate_checkout)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{numberText(row.purchase)}</p>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Orders</p>
                </div>
              </div>
              <p className="mt-2 text-right text-xs font-bold text-indigo-600">BDT {numberText(row.revenue)}</p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[680px]  ">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500  ">
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
              ) : districtFunnel.map((row: any) => (
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
        <p className="text-[10px] leading-relaxed text-slate-400 ">
          Showing {districtFunnelUnit}. Repeated actions are removed.
        </p>
      </div>

      {/* Conversion Funnel & Signal Doctor Breakdown */}
      <div
        id="analytics-funnel"
        aria-hidden={activeInsightTab !== 'summary'}
        className={`${activeInsightTab === 'summary' ? 'grid' : 'hidden'} scroll-mt-24 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6`}
      >
        <div className="lg:col-span-3">
          <h3 className="text-base font-bold text-slate-900">Tracking Health</h3>
          <p className="text-xs text-slate-500">Check if visitor actions, customer data, and ad tracking are working properly.</p>
        </div>
        
        <div className="lg:col-span-2 space-y-6">
          {/* Conversion Funnel */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <div className="mb-6">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Customer Steps</h3>
              <p className="text-xs text-slate-400 ">See how people move from store visit to order.</p>
            </div>

            <div className="space-y-4">
              {asArray(analyticsOverview?.funnel).length ? (
                (() => {
                  const funnel = asArray(analyticsOverview?.funnel);
                  const maxCount = Math.max(...funnel.map((f: any) => Number(f.count || 0)), 1);
                  const funnelColors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-emerald-500'];
                  return funnel.map((step: any, i: number) => {
                    const pctWidth = Math.max((Number(step.count || 0) / maxCount) * 100, 5);
                    return (
                      <div key={step.step} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-500 flex items-center gap-1  font-mono">
                            {stepLabel(step.step)}
                            {i > 0 && step.drop_off > 0 && (
                              <span className="text-rose-600 text-[10px] font-bold">
                                Down {step.drop_off}%
                              </span>
                            )}
                          </span>
                          <span className="text-slate-800 font-bold ">{numberText(step.count)} actions</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-100  overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-800 ${funnelColors[i % 5]}`}
                            style={{ width: `${pctWidth}%` }}
                          />
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

          {/* Telemetry Match Quality Index Bar Chart */}
          <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Data Quality</h3>
                <p className="text-xs text-slate-400 ">How much useful customer data is sent to ad platforms.</p>
              </div>
              {signalDoctor?.score !== undefined && (
                <div className="px-3 py-1.5 rounded-xl border border-indigo-100 bg-indigo-50/50   text-right">
                  <span className="block text-[8px] font-bold text-[#5e5bfe] uppercase tracking-widest leading-none">Quality Score</span>
                  <span className="text-lg font-black text-slate-800  font-mono leading-none">{signalDoctor.score}%</span>
                </div>
              )}
            </div>

            <div ref={matchChartHostRef} className="mt-2 h-64 min-w-0">
              {signalRates && matchChartSize.width > 120 ? (
                  <BarChart 
                    width={matchChartSize.width}
                    height={matchChartSize.height}
                    data={[
                      { name: 'Event ID', rate: signalRates.event_id || 0 },
                      { name: 'User Match', rate: signalRates.user_match || 0 },
                      { name: 'Email/Phone', rate: signalRates.email_or_phone || 0 },
                      { name: 'Click IDs', rate: signalRates.click_id || 0 },
                      { name: 'Product ID', rate: signalRates.content_ids || 0 },
                      { name: 'Order Value', rate: signalRates.value || 0 },
                      { name: 'UTM Source', rate: signalRates.utm || 0 }
                    ]} 
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={92} />
                    <ReChartsTooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        borderColor: '#1e293b', 
                        color: '#f1f5f9', 
                        borderRadius: '8px', 
                        fontSize: '11px', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' 
                      }}
                      formatter={(val) => [`${val}%`, 'Data sent']}
                    />
                    <Bar dataKey="rate" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">Not enough data yet. Keep tracking.</div>
              )}
            </div>
          </div>
        </div>

        {/* Signal Doctor Heuristics Checklist */}
        <div className="self-start rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Tracking Checklist</h3>
            <p className="text-xs text-slate-400 ">Simple checks and fixes for better ad tracking.</p>
          </div>

          <div className="mt-4 space-y-3 overflow-y-auto max-h-96 pr-1">
              {asArray(signalDoctor?.issues).length ? (
              asArray(signalDoctor?.issues).map((issue: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border text-xs ${
                  issue.severity === 'critical' || issue.severity === 'high' ? 'bg-rose-50/50 border-rose-200 text-rose-800   ' :
                  issue.severity === 'medium' ? 'bg-amber-50/50 border-amber-200 text-amber-800   ' :
                  issue.severity === 'ok' ? 'bg-green-50/50 border-green-200 text-green-800   ' :
                  'bg-blue-50/50 border-blue-200 text-blue-800   '
                }`}>
                  <div className="flex items-start gap-2.5">
                    {issue.severity === 'critical' || issue.severity === 'high' ? <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" /> :
                     issue.severity === 'medium' ? <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" /> :
                     <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />}
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-[11px] leading-tight">{issue.title}</h4>
                        <span className="rounded bg-white/60 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide">
                          {issueLevel(issue.severity)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-wide opacity-70">Why it matters</p>
                        <p className="text-[10px] leading-normal opacity-90">{issue.impact}</p>
                      </div>
                      <div className="rounded border border-black/5 bg-white/50 p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide opacity-70">Fix</p>
                        <p className="mt-1 text-[10px] leading-normal">{issue.fix}</p>
                      </div>
                      {issue.metric && (
                        <p className="font-mono text-[9px] opacity-60">Check: {issue.metric}</p>
                      )}
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
          </div>
          {loadingAdPerformance && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="animate-spin h-3.5 w-3.5 border-2 border-indigo-500 border-t-transparent rounded-full" />
              <span>Updating ad data...</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
          <div>
            <label htmlFor="ad-results-search" className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Find campaign</label>
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
            <label htmlFor="ad-results-sort" className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Sort by</label>
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
              <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase text-indigo-700">COD pending included</span>
            </div>
            <p className="leading-normal">Results from all orders placed, including pending COD orders.</p>
          </div>
          <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold text-indigo-700">Confirmed Sales</p>
              <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">confirmed only</span>
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
          ) : filteredAdPerformance.map((row: any, idx: number) => {
            const status = getAdStatus(row);
            return (
            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap gap-1">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      row.platform === 'meta' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-900 text-white'
                    }`}>
                      {row.platform}
                    </span>
                    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 text-xs truncate">{row.campaign_name}</p>
                  <p className="font-mono text-[9px] text-slate-400 truncate">ID: {row.campaign_id}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-black text-slate-900">{formatMoney(row.spend, row.spend_currency)}</p>
                  <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Spend</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded text-[11px] font-semibold text-slate-600">
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">New Orders</span>
                  <span className="text-indigo-600 font-black">{row.placed_roas}x return</span> | {formatMoney(row.placed_cpa, row.spend_currency)} per order
                </div>
                <div>
                  <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-bold">Confirmed Sales</span>
                  <span className="text-emerald-600 font-black">{row.confirmed_roas}x return</span> | {formatMoney(row.confirmed_cpa, row.spend_currency)} per order
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>Clicks: {row.clicks} (click rate: {row.ctr}%)</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 font-bold uppercase text-[8px]">
                  Extra Tracking: +{row.tracking_bypass_rate}%
                </span>
              </div>
            </div>
          )})}
        </div>

        {/* Desktop View */}
        <div className="hidden max-h-[620px] overflow-auto rounded-lg border border-slate-200 md:block">
          <table className="w-full min-w-[1100px] divide-y divide-slate-100 text-left text-sm text-slate-600">
            <thead className="sticky top-0 z-20 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
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
                filteredAdPerformance.map((row: any, idx: number) => {
                  const status = getAdStatus(row);
                  return (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="sticky left-0 z-10 max-w-[280px] bg-white px-4 py-3.5 align-middle shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex flex-wrap gap-1">
                          <span className={`w-fit px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            row.platform === 'meta' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-900 text-white'
                          }`}>
                            {row.platform}
                          </span>
                          <span className={`w-fit rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <span className="font-bold text-slate-800 truncate" title={row.campaign_name}>
                          {row.campaign_name}
                        </span>
                        <span className="font-mono text-[9px] text-slate-400 truncate">
                          ID: {row.campaign_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-800">{formatMoney(row.spend, row.spend_currency)}</span>
                        <span className="text-slate-500 text-[10px]">{numberText(row.clicks)} clicks | {numberText(row.impressions)} views</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{row.ctr}% click rate</span>
                        <span className="text-slate-400 text-[10px]">{formatMoney(row.cpc, row.spend_currency)} per click</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle bg-slate-50/30">
                      <div className="flex flex-col">
                        <span className="font-black text-indigo-600">{row.placed_roas}x return</span>
                        <span className="text-slate-600 text-[10px]">{row.placed_purchases} Orders ({formatMoney(row.placed_revenue, row.revenue_currency)})</span>
                        <span className="text-slate-400 text-[9px]">Cost/order: {formatMoney(row.placed_cpa, row.spend_currency)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle bg-emerald-50/10">
                      <div className="flex flex-col">
                        <span className="font-black text-emerald-600">{row.confirmed_roas}x return</span>
                        <span className="text-slate-600 text-[10px]">{row.confirmed_purchases} Confirmed ({formatMoney(row.confirmed_revenue, row.revenue_currency)})</span>
                        <span className="text-slate-400 text-[9px]">Cost/order: {formatMoney(row.confirmed_cpa, row.spend_currency)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-black text-slate-800">+{row.tracking_bypass_rate}%</span>
                        <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-bold uppercase text-emerald-700 tracking-wider">
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
          ) : analyticsCampaigns.campaigns.slice(0, 6).map((row: any, idx: number) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-indigo-700">{row.source}</p>
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{row.campaign}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{numberText(row.purchase)}</p>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Purchases</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Seen {numberText(row.view_content)} | Cart {numberText(row.add_to_cart)} | Checkout {numberText(row.initiate_checkout)}
              </p>
              <p className="mt-2 text-right text-xs font-bold text-indigo-600">BDT {numberText(row.revenue)}</p>
            </div>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[700px]  ">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500  ">
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
                analyticsCampaigns.campaigns.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50  transition-colors">
                    <td className="px-6 py-3.5 font-bold text-indigo-700 ">{row.source}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-800 ">{row.campaign}</td>
                    <td className="px-6 py-3.5 font-semibold">{numberText(row.view_content)}</td>
                    <td className="px-6 py-3.5 font-semibold">{numberText(row.add_to_cart)}</td>
                    <td className="px-6 py-3.5 font-semibold">{numberText(row.initiate_checkout)}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800 ">{numberText(row.purchase)}</td>
                    <td className="px-6 py-3.5 font-bold text-indigo-600  text-right">BDT {numberText(row.revenue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaign URL Builder widget */}
      <div
        id="analytics-url-builder"
        aria-hidden={activeInsightTab !== 'sales'}
        className={`${activeInsightTab === 'sales' ? 'flex' : 'hidden'} scroll-mt-24 flex-col space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6`}
      >
        <div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Sales Link Builder</h3>
          <p className="text-xs text-slate-400">Create a clean ad link so sales source data is easier to read.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          
          {/* Input parameters Form */}
          <div className="space-y-4">
            
            {/* Base Website URL */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Product or page link</label>
              <input 
                type="text" 
                placeholder="https://your-domain.com/shop/item"
                value={urlBuilderBaseUrl}
                onChange={(e) => setUrlBuilderBaseUrl(e.target.value)}
                className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono   "
              />
            </div>

            {/* Source & Medium grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="campaign-source" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ad place</label>
                <select 
                  id="campaign-source"
                  value={urlBuilderSource}
                  onChange={(e) => {
                    setUrlBuilderSource(e.target.value);
                    if (e.target.value === 'facebook') setUrlBuilderMedium('paid_social');
                    else if (e.target.value === 'tiktok') setUrlBuilderMedium('paid_social');
                    else if (e.target.value === 'google') setUrlBuilderMedium('cpc');
                    else if (e.target.value === 'newsletter') setUrlBuilderMedium('email');
                    else setUrlBuilderMedium('referral');
                  }}
                  className="w-full p-2.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500   "
                >
                  <option value="facebook">Facebook Ads</option>
                  <option value="tiktok">TikTok Ads</option>
                  <option value="google">Google CPC</option>
                  <option value="newsletter">Email Newsletter</option>
                  <option value="custom">Custom Partner</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Link type</label>
                <input 
                  type="text" 
                  placeholder="paid_social"
                  value={urlBuilderMedium}
                  onChange={(e) => setUrlBuilderMedium(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500   "
                />
              </div>
            </div>

            {/* Campaign Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Campaign name</label>
              <input 
                type="text" 
                placeholder="eid_sale_promotion"
                value={urlBuilderCampaign}
                onChange={(e) => setUrlBuilderCampaign(e.target.value)}
                className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500   "
              />
            </div>

            {/* Optional parameters Content & Term */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ad name (optional)</label>
                <input 
                  type="text" 
                  placeholder="video_ad_1"
                  value={urlBuilderContent}
                  onChange={(e) => setUrlBuilderContent(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500   "
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Keyword (optional)</label>
                <input 
                  type="text" 
                  placeholder="buy_shoes"
                  value={urlBuilderTerm}
                  onChange={(e) => setUrlBuilderTerm(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500   "
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateCampaignUrl}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer  "
            >
              Create Sales Link
            </button>

          </div>

          {/* Output generator result box */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 flex flex-col justify-between  ">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest ">Your Sales Link</h4>
              <p className="text-[11px] text-slate-400 ">Use this link in your ad so Buykori can show where sales came from.</p>
            </div>

            <div className="my-4 bg-white border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 break-all select-all    relative group min-h-24 flex items-center">
              {generatedCampaignUrl ? (
                <>
                  {generatedCampaignUrl}
                  <button
                    type="button"
                    onClick={() => handleCopy(generatedCampaignUrl, 'generated_campaign_url')}
                    className="absolute top-2 right-2 p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer   "
                    title="Copy URL"
                  >
                    {copiedStates['generated_campaign_url'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </>
              ) : (
                <span className="text-slate-400 italic">Your sales link will appear here...</span>
              )}
            </div>

            <div className="text-[10px] text-slate-400 leading-normal flex items-start gap-1.5 ">
              <Info className="w-3.5 h-3.5 shrink-0 text-slate-350 mt-0.5" />
              <span>Use this link in Facebook, TikTok, Google, or any campaign post.</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
