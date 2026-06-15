import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { 
  AreaChart, 
  Area, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip as ReChartsTooltip, 
  Legend
} from 'recharts';
import { Tooltip } from './common/Tooltip';
import { 
  TrendingUp, 
  ArrowUpRight, 
  Check, 
  Copy, 
  CheckCircle2, 
  RefreshCw,
  ListChecks,
  BookOpen,
  Send,
  Settings2
} from 'lucide-react';
import { CAPIEvent, UserProfile, Platform } from '../types';

interface DashboardViewProps {
  profile: UserProfile;
  events: CAPIEvent[];
  trendData: any[];
  recoverySummary: {
    browser_events: number;
    server_events: number;
    matched_events: number;
    recovered_events: number;
    recovery_rate: number;
  } | null;
  metaStats: { total: number; rate: number; lastTime: string };
  tiktokStats: { total: number; rate: number; lastTime: string };
  ga4Stats: { total: number; rate: number; lastTime: string };
  optScore: number;
  resolvedCount: number;
  totalSuggCount: number;
  setActivePage: (p: string) => void;
  expandedEventId: string | null;
  setExpandedEventId: (id: string | null) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
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
  expandedEventId,
  setExpandedEventId,
  copiedStates,
  handleCopy,
  analyticsDays,
  setAnalyticsDays
}: DashboardViewProps) {
  const showGettingStarted = events.length === 0 && profile.eventsUsed === 0;
  const [railOpen, setRailOpen] = useState(false);
  const [railVisible, setRailVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 640, height: 256 });
  const quotaPercent = profile.eventsQuota > 0 ? Math.round((profile.eventsUsed / profile.eventsQuota) * 100) : 0;
  const platformCards = [
    {
      label: 'Meta',
      rate: metaStats.rate,
      total: metaStats.total,
      lastTime: metaStats.lastTime,
      dotClass: 'bg-[#f97316]',
      badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    },
    {
      label: 'TikTok',
      rate: tiktokStats.rate,
      total: tiktokStats.total,
      lastTime: tiktokStats.lastTime,
      dotClass: 'bg-[#2563eb]',
      badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    },
    {
      label: 'GA4',
      rate: ga4Stats.rate,
      total: ga4Stats.total,
      lastTime: ga4Stats.lastTime,
      dotClass: 'bg-[#34a853]',
      badgeClass: 'border-green-200 bg-green-50 text-green-700',
    },
  ];
  const browserEventCount = Number(recoverySummary?.browser_events || 0);
  const serverEventCount = Number(recoverySummary?.server_events || 0);
  const matchedEventCount = Number(recoverySummary?.matched_events || 0);
  const recoveredEventCount = Number(recoverySummary?.recovered_events || 0);
  const serverRecoveryRate = Number(recoverySummary?.recovery_rate || 0);
  const hasServerCoverage = serverEventCount > 0;
  const hasBrowserOnlyActivity = browserEventCount > 0 && !hasServerCoverage;
  const coverageLabel = hasServerCoverage
    ? `${serverRecoveryRate}%`
    : hasBrowserOnlyActivity
      ? 'Needs server'
      : 'No data';
  const coverageDescription = hasServerCoverage
    ? 'Server-side events without a matching browser event ID. This helps recover blocked browser tracking, but very high values can also indicate event ID mismatch.'
    : hasBrowserOnlyActivity
      ? 'Browser events are visible, but no successful server event with matching IDs was found in this timeframe.'
      : 'No browser or server tracking events found in this timeframe yet.';

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const scrollingUp = currentY < lastScrollYRef.current;
      const nearTop = currentY < 80;

      setRailVisible(nearTop || scrollingUp);
      if (!nearTop && currentY > lastScrollYRef.current + 8) {
        setRailOpen(false);
      }
      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host) return;

    const updateSize = () => {
      const rect = host.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      setChartSize(prev => (
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      ));
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-4 md:space-y-6">
      <div className={`fixed right-2 top-24 z-30 transition-all duration-200 md:hidden ${railVisible ? 'translate-x-0 opacity-100' : 'translate-x-16 opacity-0 pointer-events-none'}`}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setRailOpen(open => !open)}
            className="flex flex-col items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-2 py-2 shadow-lg shadow-slate-900/10 backdrop-blur"
            aria-expanded={railOpen}
            aria-label="Open platform stats"
          >
            {platformCards.map(card => (
              <span key={card.label} className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50">
                <span className={`h-2 w-2 rounded-full ${card.dotClass}`} />
              </span>
            ))}
          </button>

          {railOpen && (
            <div className="absolute right-10 top-0 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-900/15">
              <div className="border-b border-slate-100 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Platform health</p>
              </div>
              <div className="divide-y divide-slate-100">
                {platformCards.map(card => (
                  <div key={card.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <span className={`h-1.5 w-1.5 rounded-full ${card.dotClass}`} />
                        {card.label}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">
                        {card.total > 0 ? `Last: ${card.lastTime}` : 'No events in this view'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-950">{card.total > 0 ? `${card.rate}%` : 'No data'}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">{card.total} events</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Page Heading & Timeframe Selector */}
      <div className="flex flex-row items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 md:text-xl">Dashboard</h2>
          <p className="text-xs text-slate-400 ">Your store's tracking summary</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs font-semibold text-slate-500 sm:inline">Timeframe:</span>
          <select 
            value={analyticsDays} 
            onChange={(e) => setAnalyticsDays(Number(e.target.value))}
            aria-label="Select dashboard timeframe"
            className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:ring-1 focus:ring-blue-500 sm:px-3"
          >
            <option value="7">Last 7 Days</option>
            <option value="14">Last 14 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>
      </div>

      {showGettingStarted && (
        <section className="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm  ">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 ">Welcome to Buykori</p>
              <h3 className="text-base font-bold text-slate-900 ">Start tracking your first store</h3>
              <p className="max-w-2xl text-xs leading-relaxed text-slate-500 ">
                Complete these steps to start sending purchase and visitor events to your ad platforms.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:min-w-[520px]">
              <button
                type="button"
                onClick={() => setActivePage('setup-guide')}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700      "
              >
                <BookOpen className="h-4 w-4 shrink-0 text-indigo-500" />
                Setup Guide
              </button>
              <button
                type="button"
                onClick={() => setActivePage('settings')}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700      "
              >
                <Settings2 className="h-4 w-4 shrink-0 text-indigo-500" />
                Connect Store
              </button>
              <button
                type="button"
                onClick={() => setActivePage('campaign-builder')}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700      "
              >
                <Send className="h-4 w-4 shrink-0 text-indigo-500" />
                Send Test Event
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 4 KPI Top metrics grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center text-xs font-bold text-slate-700">
              Monthly Usage
              <Tooltip content="Quota-counted events processed this billing month. Recent logs can include browser, debug, or failed attempts that do not increase monthly usage." />
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
              <TrendingUp className="h-3 w-3" />
              {quotaPercent}%
            </span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-bold tracking-tight text-slate-950">{profile.eventsUsed.toLocaleString()}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">of {profile.eventsQuota.toLocaleString()} quota-counted</p>
            </div>
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#1a73e8] transition-all duration-500"
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>
        </div>

        {platformCards.map(card => (
          <div key={card.label} className="hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:block">
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold ${card.badgeClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${card.dotClass}`} />
                {card.label}
              </span>
              <span className="text-[10px] font-bold uppercase text-slate-400">{card.total} events</span>
            </div>
            <p className="mt-4 text-2xl font-bold tracking-tight text-slate-950">{card.total > 0 ? `${card.rate}%` : 'No data'}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-slate-400">
              {card.total > 0 ? `Last: ${card.lastTime}` : 'No events in this view'}
            </p>
          </div>
        ))}
      </div>

      {/* Main visualization split section (Trend chart & Deduplication index) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        
        {/* Event Volume charts */}
        <div className="col-span-2 flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-3 flex items-center justify-between md:mb-5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800 md:text-sm">Event Activity</h2>
              <p className="text-xs text-slate-400 ">Successful server events over time</p>
            </div>
            <div className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-400">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              Live
            </div>
          </div>

          <div ref={chartHostRef} className="mt-auto h-44 min-w-0 md:h-64">
              <AreaChart width={chartSize.width} height={chartSize.height} data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="metaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="tiktokGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="ga4Grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34a853" stopOpacity={0.18}/>
                    <stop offset="95%" stopColor="#34a853" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false} 
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
                    return value;
                  }}
                />
                <ReChartsTooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b', borderRadius: '8px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} 
                />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="Meta CAPI" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#metaGrad)" />
                <Area type="monotone" dataKey="TikTok Events" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#tiktokGrad)" />
                <Area type="monotone" dataKey="GA4" stroke="#34a853" strokeWidth={2} fillOpacity={1} fill="url(#ga4Grad)" />
              </AreaChart>
          </div>
        </div>

        {/* Deduplication & optimization indicator */}
        <div className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-800 md:text-sm">Setup Diagnostics</h2>
            <p className="mt-1 text-xs leading-normal text-slate-400">
              {totalSuggCount === 0 ? 'Tracking setup health' : 'How well your tracking is configured'}
            </p>
          </div>

          <div className="flex items-center gap-4 py-4 lg:flex-col lg:gap-0 lg:py-6">
            <div className="relative h-20 w-20 shrink-0 md:h-28 md:w-28 lg:h-32 lg:w-32">
              {/* Circular progress represent */}
              <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 36 36">
                <circle className="stroke-slate-100 " strokeWidth="4" fill="transparent" r="16" cx="18" cy="18" />
                <circle 
                  className="stroke-indigo-600 transition-all duration-1000" 
                  strokeWidth="4" 
                  strokeDasharray={`${optScore} 100`} 
                  strokeLinecap="round" 
                  fill="transparent" 
                  r="16" 
                  cx="18" 
                  cy="18" 
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xl font-extrabold leading-none text-slate-800 md:text-2xl lg:text-3xl">{optScore}%</span>
                <span className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">Score</span>
              </div>
            </div>
            
            <div className="text-left lg:mt-4 lg:text-center">
              <p className="max-w-xs text-xs leading-normal text-slate-500">
                {totalSuggCount === 0
                  ? 'All core checks are passing across your configured platforms.'
                  : `${resolvedCount} of ${totalSuggCount} suggestions resolved. ${totalSuggCount - resolvedCount} remaining.`}
              </p>
            </div>
          </div>

          <button 
            onClick={() => setActivePage('suggestions')}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {totalSuggCount === 0 ? <RefreshCw className="h-3.5 w-3.5" /> : null}
              {totalSuggCount === 0 ? 'Run Health Check' : 'View Suggestions'}
            </span>
          </button>

          <div className={`mt-3 rounded-lg border p-3 ${hasBrowserOnlyActivity ? 'border-amber-100 bg-amber-50/70' : 'border-emerald-100 bg-emerald-50/60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-[10px] font-black uppercase tracking-wide ${hasBrowserOnlyActivity ? 'text-amber-700' : 'text-emerald-700'}`}>Browser / Server Coverage</p>
                <p className={hasBrowserOnlyActivity ? 'mt-1 text-xs text-amber-900' : 'mt-1 text-xs text-emerald-900'}>{coverageDescription}</p>
              </div>
              <span className={`font-mono text-lg font-black ${hasBrowserOnlyActivity ? 'text-amber-700' : 'text-emerald-700'}`}>{coverageLabel}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-600">
              <div className={`rounded-md bg-white px-2 py-1.5 ring-1 ${hasBrowserOnlyActivity ? 'ring-amber-100' : 'ring-emerald-100'}`}>
                <span className="block text-slate-400">Browser seen</span>
                <span className="font-mono text-slate-800">{browserEventCount.toLocaleString()}</span>
              </div>
              <div className={`rounded-md bg-white px-2 py-1.5 ring-1 ${hasBrowserOnlyActivity ? 'ring-amber-100' : 'ring-emerald-100'}`}>
                <span className="block text-slate-400">Server matched / only</span>
                <span className="font-mono text-slate-800">{matchedEventCount.toLocaleString()} / {recoveredEventCount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Recent Activity table section */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 md:px-6 md:py-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 md:text-sm">Recent Events</h2>
            <p className="text-xs text-slate-400 ">Latest tracking events from your store.</p>
          </div>
          <button 
            onClick={() => setActivePage('event-logs')}
            className="flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            Logs <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2 p-3 md:hidden">
          {events.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-center  ">
              <ListChecks className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-xs font-bold text-slate-600 ">No tracking events yet</p>
              <button
                type="button"
                onClick={() => setActivePage('campaign-builder')}
                className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
              >
                Send Test Event
              </button>
            </div>
          ) : events.slice(0, 3).map(e => (
            <button
              key={e.id}
              type="button"
              onClick={() => setExpandedEventId(expandedEventId === e.id ? null : e.id)}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{e.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      e.platform === 'Meta CAPI' ? 'bg-indigo-500' :
                      e.platform === 'TikTok Events API' ? 'bg-cyan-500' : 'bg-orange-500'
                    }`} />
                    {e.platform}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                  e.status === 'Success' ? 'border-slate-200 bg-green-50 text-green-700' :
                  e.status === 'Retry' ? 'border-slate-200 bg-amber-50 text-amber-700' :
                  'border-slate-200 bg-rose-50 text-rose-700'
                }`}>
                  {e.status}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <span className="font-mono">{new Date(e.timestamp).toLocaleTimeString()}</span>
                <span className="text-right font-mono">Code {e.httpCode}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-xs text-slate-600  divide-y divide-slate-100  min-w-[800px]">
            <thead className="bg-slate-50  text-[10px] font-bold uppercase tracking-wider text-slate-500 ">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Event Name</th>
                <th className="px-6 py-3">Platform</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Code</th>
                <th className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end">
                    Event Key
                    <Tooltip content="ডুপ্লিকেট ইভেন্ট ফিল্টারিং বা Deduplication Key। ব্রাউজার পিক্সেল এবং সার্ভার ইভেন্টকে ম্যাচ করার জন্য এটি ব্যবহৃত হয় যেন একই সেলস দুইবার কাউন্ট না হয়।" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-medium">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                      <ListChecks className="w-8 h-8 text-slate-300" />
                      <div>
                        <p className="font-bold text-slate-600 ">No tracking events yet</p>
                        <p className="mt-1 text-xs font-normal text-slate-400">Install the plugin or send a test event to confirm everything is working.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActivePage('campaign-builder')}
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700"
                      >
                        Send Test Event
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                events.slice(0, 5).map(e => {
                  const isExpanded = expandedEventId === e.id;
                  return (
                    <React.Fragment key={e.id}>
                      <tr 
                        onClick={() => setExpandedEventId(isExpanded ? null : e.id)}
                        className="hover:bg-slate-50/50  cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-3.5 font-mono text-slate-400 ">
                          {new Date(e.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-3.5 font-semibold text-slate-800 ">
                          {e.name}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="flex items-center gap-1.5 font-medium text-slate-700 ">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              e.platform === 'Meta CAPI' ? 'bg-indigo-500' : 
                              e.platform === 'TikTok Events API' ? 'bg-cyan-500' : 'bg-orange-500'
                            }`} />
                            {e.platform}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            e.status === 'Success' ? 'bg-green-50 text-green-700 border border-slate-200   ' :
                            e.status === 'Retry' ? 'bg-amber-50 text-amber-700 border border-slate-200   ' : 
                            'bg-rose-50 text-rose-700 border border-slate-200   '
                          }`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-mono font-medium text-slate-500 ">
                          {e.httpCode}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-right text-slate-400 ">
                          {e.deduplicationKey}
                        </td>
                      </tr>

                      {/* Collapsible raw JSON details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50  border-t border-slate-100  px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-slate-900 text-slate-200 text-[11px] font-mono p-4 rounded-lg overflow-auto max-h-60 relative group">
                                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(el) => { el.stopPropagation(); handleCopy(JSON.stringify(e.payload, null, 2), `c_det_p_${e.id}`) }}
                                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                                    title="Copy data sent"
                                  >
                                    {copiedStates[`c_det_p_${e.id}`] ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest mb-1 select-none">Data Sent</p>
                                <pre>{JSON.stringify(e.payload, null, 2)}</pre>
                              </div>

                              <div className="bg-slate-900 text-slate-200 text-[11px] font-mono p-4 rounded-lg overflow-auto max-h-60 relative group">
                                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(el) => { el.stopPropagation(); handleCopy(JSON.stringify(e.responseBody, null, 2), `c_det_r_${e.id}`) }}
                                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                                    title="Copy Response body"
                                  >
                                    {copiedStates[`c_det_r_${e.id}`] ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-1 select-none">Platform Response</p>
                                <pre>{JSON.stringify(e.responseBody, null, 2)}</pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
