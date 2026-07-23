import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  PackageCheck,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { CAPIEvent, RecoverySummary, TrendPoint, UserProfile } from '../types';
import { PlatformLogo } from './common/PlatformLogo';

interface DashboardViewProps {
  profile: UserProfile;
  events: CAPIEvent[];
  trendData: TrendPoint[];
  recoverySummary: RecoverySummary | null;
  metaStats: { total: number; rate: number; lastTime: string };
  tiktokStats: { total: number; rate: number; lastTime: string };
  ga4Stats: { total: number; rate: number; lastTime: string };
  optScore: number;
  resolvedCount: number;
  totalSuggCount: number;
  setActivePage: (page: string) => void;
  expandedEventId: string | null;
  setExpandedEventId: (id: string | null) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  pendingOrderCount?: number;
}

const panelClass = 'rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]';

function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return value.toLocaleString();
}

function eventValue(event: CAPIEvent) {
  const customData = event.payload?.custom_data as Record<string, unknown> | undefined;
  const raw = customData?.value ?? event.payload?.value;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const currency = String(customData?.currency ?? event.payload?.currency ?? 'BDT');
  return `${currency} ${value.toLocaleString()}`;
}

export function DashboardView({
  profile,
  events,
  trendData,
  recoverySummary,
  metaStats,
  tiktokStats,
  ga4Stats,
  optScore,
  resolvedCount,
  totalSuggCount,
  setActivePage,
  analyticsDays,
  setAnalyticsDays,
  pendingOrderCount = 0,
}: DashboardViewProps) {
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 720, height: 280 });

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host) return;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      setChartSize({ width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const chartData = useMemo(
    () => trendData.map(point => ({
      ...point,
      name: point.name || point.date || '',
      events: Number(point.total ?? 0)
        || Number(point['Meta CAPI'] ?? 0)
          + Number(point['TikTok Events'] ?? 0)
          + Number(point.GA4 ?? 0),
      delivered: Number(point.success ?? 0),
    })),
    [trendData],
  );

  const platformRows = [
    { label: 'Meta', platform: 'Meta CAPI', ...metaStats },
    { label: 'TikTok', platform: 'TikTok Events API', ...tiktokStats },
    { label: 'GA4', platform: 'GA4', ...ga4Stats },
  ];
  const openSuggestions = Math.max(0, totalSuggCount - resolvedCount);
  const serverAttempts = Number(recoverySummary?.server_attempt_events ?? recoverySummary?.server_events ?? 0);
  const serverFailures = Number(recoverySummary?.server_failed_events ?? 0);
  const hasDeliveryIssue = serverAttempts > 0 && Number(recoverySummary?.server_events ?? 0) === 0;
  const usagePercent = profile.eventsQuota > 0
    ? Math.min(100, (profile.eventsUsed / profile.eventsQuota) * 100)
    : 0;
  const locallyObservedOrders = new Set(
    events
      .filter(event => event.name.toLowerCase() === 'purchase')
      .map(event => event.orderId || event.deduplicationKey || event.id),
  ).size;
  const ordersUsed = Number(profile.ordersUsed ?? locallyObservedOrders);
  const orderQuota = Number(profile.ordersQuota || 0);
  const orderPercent = orderQuota > 0 ? Math.min(100, (ordersUsed / orderQuota) * 100) : 0;
  const recentEvents = events.slice(0, 5);
  const showGettingStarted = events.length === 0 && profile.eventsUsed === 0;

  return (
    <div className="space-y-5">
      {hasDeliveryIssue && (
        <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-amber-950">Some events need attention</h2>
              <p className="mt-1 text-xs leading-5 text-amber-800">
                Buykori attempted {serverAttempts.toLocaleString()} deliveries and recorded {serverFailures.toLocaleString()} failures.
              </p>
            </div>
          </div>
          <button onClick={() => setActivePage('event-logs')} className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800">
            Review failed events
          </button>
        </section>
      )}

      {showGettingStarted && (
        <section className={`${panelClass} border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5`}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Welcome to Buykori</p>
              <h2 className="mt-1 text-lg font-bold text-slate-950">Connect your store and send the first event</h2>
              <p className="mt-1 text-sm text-slate-500">The dashboard will fill with real performance data as soon as tracking starts.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { label: 'Setup guide', icon: BookOpen, page: 'setup-guide' },
                { label: 'Connect store', icon: Settings2, page: 'settings' },
                { label: 'Send test event', icon: Send, page: 'campaign-builder' },
              ].map(item => (
                <button key={item.label} onClick={() => setActivePage(item.page)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">
                  <item.icon className="h-4 w-4" /> {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className={`${panelClass} min-w-0 p-5 xl:col-span-8`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Event activity</h2>
              <p className="mt-1 text-xs text-slate-500">Tracked and successfully delivered server events</p>
            </div>
            <select
              value={analyticsDays}
              onChange={event => setAnalyticsDays(Number(event.target.value))}
              aria-label="Select dashboard timeframe"
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
          <div className="mt-5 flex items-center gap-5 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#285ac7]" />Events received</span>
            <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#12b886]" />Delivered</span>
          </div>
          <div ref={chartHostRef} className="mt-3 h-[270px] min-w-0">
            {chartData.length > 0 ? (
              <AreaChart width={chartSize.width} height={chartSize.height} data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="eventsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#285ac7" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#285ac7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e8edf5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} stroke="#94a3b8" />
                <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="#94a3b8" />
                <RechartsTooltip contentStyle={{ borderRadius: 12, borderColor: '#dbe3ef', boxShadow: '0 12px 30px rgba(15,23,42,.08)', fontSize: 12 }} />
                <Area type="monotone" dataKey="events" stroke="#285ac7" strokeWidth={2.5} fill="url(#eventsGradient)" />
                <Line type="monotone" dataKey="delivered" stroke="#12b886" strokeWidth={2.25} dot={false} />
              </AreaChart>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
                <div>
                  <CircleGauge className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-2 text-sm font-bold text-slate-700">Waiting for trend data</p>
                  <p className="mt-1 text-xs text-slate-400">Event activity will appear after tracking begins.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={`${panelClass} p-5 xl:col-span-4`}>
          <div>
            <h2 className="text-base font-bold text-slate-950">Action center</h2>
            <p className="mt-1 text-xs text-slate-500">The next useful actions for your team</p>
          </div>
          <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            <button onClick={() => setActivePage('pending-purchases')} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${pendingOrderCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <ShoppingBag className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-slate-900">{pendingOrderCount > 0 ? `${pendingOrderCount} COD orders need review` : 'COD review queue is clear'}</strong>
                <span className="mt-0.5 block text-xs text-slate-500">Confirm or skip pending purchase events</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button onClick={() => setActivePage('suggestions')} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${openSuggestions > 0 ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-600'}`}>
                <PackageCheck className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-slate-900">{openSuggestions > 0 ? `${openSuggestions} setup items need attention` : 'Setup checklist complete'}</strong>
                <span className="mt-0.5 block text-xs text-slate-500">Review tracking recommendations</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <button onClick={() => setActivePage('settings')} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-slate-900">Tracking health {optScore}%</strong>
                <span className="mt-0.5 block text-xs text-slate-500">Check platform connections and delivery</span>
              </span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className={`${panelClass} p-5 xl:col-span-7`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-950">Tracking health</h2>
              <p className="mt-1 text-xs text-slate-500">Platform delivery at a glance</p>
            </div>
            <button onClick={() => setActivePage('settings')} className="text-xs font-bold text-blue-700 hover:text-blue-800">Manage platforms</button>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            {platformRows.map((row, index) => (
              <button key={row.label} onClick={() => setActivePage('event-logs')} className={`grid w-full grid-cols-[minmax(0,1.4fr)_70px_74px_24px] items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1.5fr)_90px_90px_minmax(100px,1fr)_24px] ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50"><PlatformLogo platform={row.platform} className="h-5 w-5" /></span>
                  <strong className="truncate text-sm text-slate-900">{row.label}</strong>
                </span>
                <span><strong className={`block text-sm ${row.total > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{row.total > 0 ? `${row.rate}%` : '—'}</strong><small className="text-[10px] text-slate-400">{row.total > 0 ? 'Healthy' : 'Waiting'}</small></span>
                <span><strong className="block text-sm text-slate-800">{row.total.toLocaleString()}</strong><small className="text-[10px] text-slate-400">Events</small></span>
                <span className="hidden text-xs text-slate-500 sm:block">Last sync<br /><span className="font-mono text-[10px] text-slate-400">{row.lastTime || 'Waiting'}</span></span>
                <CheckCircle2 className={`h-4 w-4 ${row.total > 0 ? 'text-emerald-500' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
        </section>

        <section className={`${panelClass} p-5 xl:col-span-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-950">Usage this month</h2>
              <p className="mt-1 text-xs text-slate-500">Current plan allowance</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{profile.plan}</span>
          </div>
          <div className="mt-6 space-y-6">
            <div>
              <div className="flex items-end justify-between gap-3">
                <div><span className="text-xs font-semibold text-slate-500">Events usage</span><p className="mt-1 text-xl font-bold text-slate-950">{compactNumber(profile.eventsUsed)} <span className="text-xs font-medium text-slate-400">/ {compactNumber(profile.eventsQuota)} events</span></p></div>
                <strong className="text-sm text-emerald-600">{usagePercent.toFixed(1)}%</strong>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#285ac7] to-[#12b886]" style={{ width: `${usagePercent}%` }} /></div>
            </div>
            <div>
              <div className="flex items-end justify-between gap-3">
                <div><span className="text-xs font-semibold text-slate-500">Orders usage</span><p className="mt-1 text-xl font-bold text-slate-950">{ordersUsed.toLocaleString()} <span className="text-xs font-medium text-slate-400">/ {orderQuota ? compactNumber(orderQuota) : 'Unlimited'} orders</span></p></div>
                {orderQuota > 0 && <strong className="text-sm text-emerald-600">{orderPercent.toFixed(1)}%</strong>}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#285ac7] to-[#12b886]" style={{ width: `${orderPercent}%` }} /></div>
            </div>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="flex items-center gap-2 text-xs font-bold text-blue-700"><span className="text-amber-500">♛</span>{profile.plan}</span>
            {profile.isTrial && <span className="text-xs font-bold text-blue-700">{profile.trialDaysRemaining || 0} days left</span>}
          </div>
        </section>
      </div>

      <section className={`${panelClass} overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">Recent activity</h2>
            <p className="mt-1 text-xs text-slate-500">Latest tracking events from your store</p>
          </div>
          <button onClick={() => setActivePage('event-logs')} className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800">View all activity <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
        {recentEvents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                <tr><th className="px-5 py-3">Time</th><th className="px-5 py-3">Event</th><th className="px-5 py-3">Platform</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Value</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentEvents.map(event => (
                  <tr key={event.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => setActivePage('event-logs')}>
                    <td className="px-5 py-3 text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900">{event.name}</td>
                    <td className="px-5 py-3"><span className="flex items-center gap-2 text-xs font-semibold text-slate-700"><PlatformLogo platform={event.platform} className="h-4 w-4" />{event.platform}</span></td>
                    <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${event.status === 'Success' ? 'bg-emerald-50 text-emerald-700' : event.status === 'Retry' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}><CheckCircle2 className="h-3 w-3" />{event.status}</span></td>
                    <td className="px-5 py-3 text-right text-xs font-bold text-slate-800">{eventValue(event)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><PackageCheck className="h-5 w-5" /></span>
              <div className="text-left">
                <p className="text-sm font-bold text-slate-800">No recent event logs</p>
                <p className="mt-1 text-xs text-slate-500">Your aggregate tracking data is available above. Send a test event to create a fresh log entry.</p>
              </div>
            </div>
            <button onClick={() => setActivePage('campaign-builder')} className="shrink-0 rounded-lg bg-[#285ac7] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#214fae]">Send test event</button>
          </div>
        )}
      </section>
    </div>
  );
}
