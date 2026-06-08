import React from 'react';
import { 
  AreaChart, 
  Area, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  Tooltip as ReChartsTooltip, 
  Legend, 
  ResponsiveContainer 
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

  return (
    <>
      {/* Page Heading & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900 ">Dashboard</h2>
          <p className="text-xs text-slate-400 ">Your store's tracking summary</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 ">Timeframe:</span>
          <select 
            value={analyticsDays} 
            onChange={(e) => setAnalyticsDays(Number(e.target.value))}
            className="text-xs font-bold text-slate-700 bg-white border border-slate-200    rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Event quota metrics card */}
        <div className="rounded-3xl border border-white/60  bg-gradient-to-br from-emerald-200/50 to-emerald-50/20   backdrop-blur-2xl p-6 shadow-xl shadow-emerald-900/5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-800  border border-emerald-300/30 bg-emerald-100/50  px-2 py-1 rounded-md flex items-center">
              Monthly Quota
              <Tooltip content="à¦†à¦ªà¦¨à¦¾à¦° à¦•à¦¾à¦°à§‡à¦¨à§à¦Ÿ à¦¸à¦¾à¦¬à¦¸à§à¦•à§à¦°à¦¿à¦ªà¦¶à¦¨ à¦ªà§à¦²à§à¦¯à¦¾à¦¨à§‡à¦° à¦†à¦“à¦¤à¦¾à§Ÿ à¦ à¦®à¦¾à¦¸à§‡ à¦®à§‹à¦Ÿ à¦•à¦¤à¦—à§à¦²à§‹ à¦Ÿà§à¦°à§à¦¯à¦¾à¦•à¦¿à¦‚ à¦‡à¦­à§‡à¦¨à§à¦Ÿ à¦ªà§à¦°à¦¸à§‡à¦¸ à¦•à¦°à¦¾ à¦¹à§Ÿà§‡à¦›à§‡ à¦¤à¦¾à¦° à¦¹à¦¿à¦¸à¦¾à¦¬à¥¤ à¦¬à¦¿à¦²à¦¿à¦‚ à¦¡à§‡à¦Ÿà§‡ à¦à¦Ÿà¦¿ à¦†à¦¬à¦¾à¦° à§¦ à¦¥à§‡à¦•à§‡ à¦¶à§à¦°à§ à¦¹à§Ÿà¥¤" />
            </p>
            <span className="text-xs font-semibold text-emerald-700  flex items-center gap-0.5 font-mono bg-white/40  px-2 py-0.5 rounded-full backdrop-blur-md">
              <TrendingUp className="w-3.5 h-3.5" />
              {profile.eventsQuota > 0 ? Math.round((profile.eventsUsed / profile.eventsQuota) * 100) : 0}%
            </span>
          </div>
          <div className="mt-8 flex items-baseline gap-2">
            <p className="text-3xl font-extrabold text-slate-900  tracking-tight">
              {profile.eventsUsed.toLocaleString()}
            </p>
            <span className="text-xs font-semibold text-emerald-700/70 ">/ {profile.eventsQuota.toLocaleString()}</span>
          </div>

          <div className="mt-4 opacity-70 mix-blend-multiply ">
            <div className="h-1.5 w-full rounded-full bg-emerald-100/50 overflow-hidden backdrop-blur-lg">
              <div 
                className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                style={{ width: `${profile.eventsQuota > 0 ? (profile.eventsUsed / profile.eventsQuota) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Meta Stat mini platform card */}
        <div className="rounded-3xl border border-white/60  bg-gradient-to-br from-orange-100/70 to-orange-50/10   backdrop-blur-2xl p-6 shadow-xl shadow-orange-900/5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 border border-orange-300/30 bg-orange-100/50  px-2.5 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)] pulse-dot" />
              <p className="text-[11px] font-bold text-orange-800 ">Meta</p>
            </div>
          </div>
          <div className="mt-8 flex items-baseline justify-between">
            <p className="text-3xl font-extrabold text-slate-900  tracking-tight">{metaStats.rate}%</p>
            <span className="text-[10px] text-orange-800  bg-white/40  backdrop-blur px-2.5 py-1 rounded-full font-mono font-bold tracking-widest">{metaStats.total} CALLS</span>
          </div>
          <p className="mt-4 text-[10px] text-orange-700/70  font-mono">Last event: {metaStats.lastTime}</p>
        </div>

        {/* TikTok Stat mini platform card */}
        <div className="rounded-3xl border border-white/60  bg-gradient-to-br from-indigo-100/70 to-indigo-50/20   backdrop-blur-2xl p-6 shadow-xl shadow-indigo-900/5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 border border-indigo-300/30 bg-indigo-100/50  px-2.5 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] pulse-dot" />
              <p className="text-[11px] font-bold text-indigo-800 ">TikTok</p>
            </div>
          </div>
          <div className="mt-8 flex items-baseline justify-between">
            <p className="text-3xl font-extrabold text-slate-900  tracking-tight">{tiktokStats.rate}%</p>
            <span className="text-[10px] text-indigo-800  bg-white/40  backdrop-blur px-2.5 py-1 rounded-full font-mono font-bold tracking-widest">{tiktokStats.total} CALLS</span>
          </div>
          <p className="mt-4 text-[10px] text-indigo-700/70  font-mono">Last event: {tiktokStats.lastTime}</p>
        </div>

        {/* Google Analytics 4 mini platform card */}
        <div className="rounded-3xl border border-white/60  bg-gradient-to-br from-purple-100/70 to-purple-50/20   backdrop-blur-2xl p-6 shadow-xl shadow-purple-900/5 transition-transform hover:scale-[1.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 border border-purple-300/30 bg-purple-100/50  px-2.5 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] pulse-dot" />
              <p className="text-[11px] font-bold text-purple-800 ">Google Analytics</p>
            </div>
          </div>
          <div className="mt-8 flex items-baseline justify-between">
            <p className="text-3xl font-extrabold text-slate-900  tracking-tight">{ga4Stats.rate}%</p>
            <span className="text-[10px] text-purple-800  bg-white/40  backdrop-blur px-2.5 py-1 rounded-full font-mono font-bold tracking-widest">{ga4Stats.total} CALLS</span>
          </div>
          <p className="mt-4 text-[10px] text-purple-700/70  font-mono">Last event: {ga4Stats.lastTime}</p>
        </div>
      </div>

      {/* Main visualization split section (Trend chart & Deduplication index) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Event Volume charts */}
        <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col  ">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Event Activity</h2>
              <p className="text-xs text-slate-400 ">Events sent to ad platforms over time</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-50  px-2.5 py-1 rounded border border-slate-200 ">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              Live
            </div>
          </div>

          <div className="h-64 mt-auto">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="metaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="tiktokGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Deduplication & optimization indicator */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between  ">
          <div>
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Smart Tips</h2>
            <p className="text-xs text-slate-400  leading-normal mt-1">
              {totalSuggCount === 0 ? 'Tracking setup health' : 'How well your tracking is configured'}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative h-32 w-32">
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
                <span className="text-3xl font-extrabold text-slate-800  font-mono leading-none">{optScore}%</span>
                <span className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">Score</span>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-xs text-slate-500  max-w-xs leading-normal">
                {totalSuggCount === 0
                  ? 'All core checks are passing across your configured platforms.'
                  : `${resolvedCount} of ${totalSuggCount} suggestions resolved. ${totalSuggCount - resolvedCount} remaining.`}
              </p>
            </div>
          </div>

          <button 
            onClick={() => setActivePage('suggestions')}
            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors border border-indigo-100    "
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {totalSuggCount === 0 ? <RefreshCw className="h-3.5 w-3.5" /> : null}
              {totalSuggCount === 0 ? 'Run Health Check' : 'View Suggestions'}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Recent Activity table section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden  ">
        <div className="flex items-center justify-between border-b border-slate-100  px-6 py-4">
          <div>
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider ">Recent Events</h2>
            <p className="text-xs text-slate-400 ">Latest tracking events from your store. Click to see details.</p>
          </div>
          <button 
            onClick={() => setActivePage('event-logs')}
            className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 "
          >
            View complete logs <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3 p-4 md:hidden">
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
          ) : events.slice(0, 5).map(e => (
            <button
              key={e.id}
              type="button"
              onClick={() => setExpandedEventId(expandedEventId === e.id ? null : e.id)}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm  "
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900 ">{e.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 ">
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
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                <span className="font-mono">{new Date(e.timestamp).toLocaleTimeString()}</span>
                <span className="text-right font-mono">Code {e.httpCode}</span>
              </div>
              <p className="mt-2 truncate font-mono text-[10px] text-slate-400">{e.deduplicationKey}</p>
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
                    <Tooltip content="à¦¡à§à¦ªà§à¦²à¦¿à¦•à§‡à¦Ÿ à¦‡à¦­à§‡à¦¨à§à¦Ÿ à¦«à¦¿à¦²à§à¦Ÿà¦¾à¦°à¦¿à¦‚ à¦¬à¦¾ Deduplication Keyà¥¤ à¦¬à§à¦°à¦¾à¦‰à¦œà¦¾à¦° à¦ªà¦¿à¦•à§à¦¸à§‡à¦² à¦à¦¬à¦‚ à¦¸à¦¾à¦°à§à¦­à¦¾à¦° à¦‡à¦­à§‡à¦¨à§à¦Ÿà¦•à§‡ à¦®à§à¦¯à¦¾à¦š à¦•à¦°à¦¾à¦° à¦œà¦¨à§à¦¯ à¦à¦Ÿà¦¿ à¦¬à§à¦¯à¦¬à¦¹à§ƒà¦¤ à¦¹à§Ÿ à¦¯à§‡à¦¨ à¦à¦•à¦‡ à¦¸à§‡à¦²à¦¸ à¦¦à§à¦‡à¦¬à¦¾à¦° à¦•à¦¾à¦‰à¦¨à§à¦Ÿ à¦¨à¦¾ à¦¹à§Ÿà¥¤" />
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
    </>
  );
}
