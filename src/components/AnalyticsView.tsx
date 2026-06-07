import React from 'react';
import { 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Check, 
  Copy,
  MapPin,
  Smartphone
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as ReChartsTooltip, 
  ResponsiveContainer
} from 'recharts';

interface AnalyticsViewProps {
  analyticsOverview: any;
  analyticsCampaigns: any;
  analyticsAudience: any;
  signalDoctor: any;
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
  const topDistricts = analyticsAudience?.top_districts || [];
  const deviceMix = analyticsAudience?.device_mix || [];
  const [districtFunnelMode, setDistrictFunnelMode] = React.useState<'events' | 'visitors'>('events');
  const eventDistrictFunnel = analyticsAudience?.district_funnel || [];
  const visitorDistrictFunnel = analyticsAudience?.visitor_district_funnel || [];
  const districtFunnel = districtFunnelMode === 'visitors' ? visitorDistrictFunnel : eventDistrictFunnel;
  const districtFunnelUnit = districtFunnelMode === 'visitors' ? 'visitors' : 'events';

  return (
    <div className="space-y-6">
      
      {/* Page Heading & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Insights & Analytics</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Your store's ad performance and visitor data</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Timeframe:</span>
          <select 
            value={analyticsDays} 
            onChange={(e) => setAnalyticsDays(Number(e.target.value))}
            className="text-xs font-bold text-slate-700 bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-sm"
          >
            <option value="7">Last 7 Days</option>
            <option value="14">Last 14 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>
      </div>
      
      {/* 4 Stats Cards */}
      {analyticsOverview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1: Total Events */}
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-gradient-to-br from-indigo-100/70 to-indigo-50/20 dark:from-indigo-900/30 dark:to-slate-900/40 backdrop-blur-2xl p-6 shadow-xl shadow-indigo-900/5 transition-transform hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-800 dark:text-indigo-400 border border-indigo-300/30 bg-indigo-100/50 dark:bg-indigo-900/40 px-2 py-1 rounded-md">Total Events</p>
            </div>
            <div className="mt-8 flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {analyticsOverview.total_events?.toLocaleString() || 0}
              </p>
              <span className="text-xs font-semibold text-indigo-700/70 dark:text-indigo-300/70">events tracked</span>
            </div>
          </div>

          {/* Card 2: Success Rate */}
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-gradient-to-br from-emerald-100/70 to-emerald-50/20 dark:from-emerald-900/30 dark:to-slate-900/40 backdrop-blur-2xl p-6 shadow-xl shadow-emerald-900/5 transition-transform hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400 border border-emerald-300/30 bg-emerald-100/50 dark:bg-emerald-900/40 px-2 py-1 rounded-md">Success Rate</p>
            </div>
            <div className="mt-8 flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {analyticsOverview.success_rate}%
              </p>
              <span className="text-xs font-semibold text-emerald-750/70 dark:text-emerald-300/70">Success</span>
            </div>
          </div>

          {/* Card 3: Avg Daily */}
          <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-gradient-to-br from-purple-100/70 to-purple-50/20 dark:from-purple-900/30 dark:to-slate-900/40 backdrop-blur-2xl p-6 shadow-xl shadow-purple-900/5 transition-transform hover:scale-[1.02]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-purple-800 dark:text-purple-400 border border-purple-300/30 bg-purple-100/50 dark:bg-purple-900/40 px-2 py-1 rounded-md">Daily Average</p>
            </div>
            <div className="mt-8 flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {analyticsOverview.avg_daily_events?.toLocaleString() || 0}
              </p>
              <span className="text-xs font-semibold text-purple-750/70 dark:text-purple-300/70">Avg daily</span>
            </div>
          </div>

          {/* Card 4: Signal Grade */}
          {signalDoctor && (
            <div className="rounded-3xl border border-white/60 dark:border-white/10 bg-gradient-to-br from-amber-100/70 to-amber-50/20 dark:from-amber-900/30 dark:to-slate-900/40 backdrop-blur-2xl p-6 shadow-xl shadow-amber-900/5 transition-transform hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-400 border border-amber-300/30 bg-amber-100/50 dark:bg-amber-900/40 px-2 py-1 rounded-md">Data Quality</p>
              </div>
              <div className="mt-8 flex items-baseline gap-2">
                <p className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {signalDoctor.score}/100
                </p>
                <span className="text-xs font-semibold text-amber-750/70 dark:text-amber-300/70">{signalDoctor.grade}</span>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Estimated Geo & Device Mix */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Estimated Districts</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Approximate visitor location based on received IP and checkout information.</p>
            </div>
            <MapPin className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="space-y-3">
            {topDistricts.length ? topDistricts.map((row: any) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{row.label}</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{row.count.toLocaleString()} - {row.percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.max(row.percentage, 3)}%` }} />
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-xs text-slate-400">Location data will appear after visitors start browsing your store.</div>
            )}
          </div>
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            {analyticsAudience?.notice || 'City and district data is approximate and not 100% accurate.'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Device Mix</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Mobile, desktop and tablet share from tracked events.</p>
            </div>
            <Smartphone className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="space-y-3">
            {deviceMix.length ? deviceMix.map((row: any) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-200">{row.label}</span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">{row.count.toLocaleString()} - {row.percentage}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(row.percentage, 3)}%` }} />
                </div>
              </div>
            )) : (
              <div className="py-10 text-center text-xs text-slate-400">Device data will appear after visitors start browsing your store.</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800">
          <div className="mb-5">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Top Browsers</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Browser share from your visitors.</p>
          </div>
          <div className="space-y-3">
            {(analyticsAudience?.browser_mix || []).length ? analyticsAudience.browser_mix.map((row: any) => (
              <div key={row.label} className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs last:border-0 dark:border-slate-800">
                <span className="font-bold text-slate-700 dark:text-slate-200">{row.label}</span>
                <span className="font-mono text-slate-500 dark:text-slate-400">{row.count.toLocaleString()} - {row.percentage}%</span>
              </div>
            )) : (
              <div className="py-10 text-center text-xs text-slate-400">Browser data will appear after visitors start browsing your store.</div>
            )}
          </div>
        </div>
      </div>

      {/* District Funnel Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col space-y-4 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">
              {districtFunnelMode === 'visitors' ? 'Unique Visitor District Funnel' : 'District Event Funnel'}
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {districtFunnelMode === 'visitors'
                ? 'Visitor movement grouped by Bangladesh district.'
                : 'Conversion path from page views to purchases, grouped by location.'}
            </p>
          </div>
          <div className="inline-flex h-9 w-fit items-center rounded-lg border border-slate-200 bg-slate-50 p-1 text-[11px] font-bold dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setDistrictFunnelMode('events')}
              className={`h-7 rounded-md px-3 transition-colors ${districtFunnelMode === 'events' ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}
            >
              Events
            </button>
            <button
              type="button"
              onClick={() => setDistrictFunnelMode('visitors')}
              className={`h-7 rounded-md px-3 transition-colors ${districtFunnelMode === 'visitors' ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}
            >
              Visitors
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[680px] dark:text-slate-300 dark:divide-slate-800">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3">District / City</th>
                <th className="px-6 py-3">PageView</th>
                <th className="px-6 py-3">Add to Cart</th>
                <th className="px-6 py-3">Checkout</th>
                <th className="px-6 py-3">Purchases</th>
                <th className="px-6 py-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!districtFunnel.length ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-medium dark:text-slate-500">
                    Location funnel data will appear after tracking starts.
                  </td>
                </tr>
              ) : districtFunnel.map((row: any) => (
                <tr key={row.district} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-3.5 font-bold text-indigo-700 dark:text-indigo-400">{row.district}</td>
                  <td className="px-6 py-3.5 font-semibold">{row.page_view.toLocaleString()}</td>
                  <td className="px-6 py-3.5 font-semibold">{row.add_to_cart.toLocaleString()}</td>
                  <td className="px-6 py-3.5 font-semibold">{row.initiate_checkout.toLocaleString()}</td>
                  <td className="px-6 py-3.5 font-bold text-slate-800 dark:text-white">{row.purchase.toLocaleString()}</td>
                  <td className="px-6 py-3.5 font-bold text-indigo-600 dark:text-indigo-400 text-right">BDT {row.revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
          Showing {districtFunnelUnit}. Duplicate platform events are filtered out.
        </p>
      </div>

      {/* Conversion Funnel & Signal Doctor Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
          {/* Conversion Funnel */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col dark:bg-slate-900 dark:border-slate-800">
            <div className="mb-6">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Customer Funnel</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">See where visitors move from first visit to checkout.</p>
            </div>

            <div className="space-y-4">
              {analyticsOverview?.funnel ? (
                (() => {
                  const maxCount = Math.max(...analyticsOverview.funnel.map((f: any) => f.count), 1);
                  const funnelColors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500', 'bg-emerald-500'];
                  return analyticsOverview.funnel.map((step: any, i: number) => {
                    const pctWidth = Math.max((step.count / maxCount) * 100, 5);
                    return (
                      <div key={step.step} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-505 flex items-center gap-1 dark:text-slate-400 font-mono">
                            {step.step}
                            {i > 0 && step.drop_off > 0 && (
                              <span className="text-rose-500 text-[10px] font-bold">
                                ↓{step.drop_off}% drop
                              </span>
                            )}
                          </span>
                          <span className="text-slate-800 font-bold dark:text-white">{step.count.toLocaleString()} events</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
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
                <div className="py-12 text-center text-xs text-slate-400">Funnel data will appear after page view, checkout, and purchase events are tracked.</div>
              )}
            </div>
          </div>

          {/* Telemetry Match Quality Index Bar Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col dark:bg-slate-900 dark:border-slate-800">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Match Quality</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">How well your customer data matches with ad platforms.</p>
              </div>
              {signalDoctor?.score !== undefined && (
                <div className="px-3 py-1.5 rounded-xl border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-900/40 text-right">
                  <span className="block text-[8px] font-bold text-indigo-500 uppercase tracking-widest leading-none">Match Score</span>
                  <span className="text-lg font-black text-slate-800 dark:text-white font-mono leading-none">{signalDoctor.score}%</span>
                </div>
              )}
            </div>

            <div className="h-64 mt-2">
              {signalDoctor?.signal_rates ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={[
                      { name: 'Event ID', rate: signalDoctor.signal_rates.event_id || 0 },
                      { name: 'User Match', rate: signalDoctor.signal_rates.user_match || 0 },
                      { name: 'Email/Phone', rate: signalDoctor.signal_rates.email_or_phone || 0 },
                      { name: 'Click IDs', rate: signalDoctor.signal_rates.click_id || 0 },
                      { name: 'Product ID', rate: signalDoctor.signal_rates.content_ids || 0 },
                      { name: 'Order Value', rate: signalDoctor.signal_rates.value || 0 },
                      { name: 'UTM Source', rate: signalDoctor.signal_rates.utm || 0 }
                    ]} 
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                  >
                    <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} width={80} />
                    <ReChartsTooltip 
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        borderColor: '#1e293b', 
                        color: '#f1f5f9', 
                        borderRadius: '8px', 
                        fontSize: '11px', 
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' 
                      }}
                      formatter={(val) => [`${val}%`, 'Match Rate']}
                    />
                    <Bar dataKey="rate" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">Not enough data yet. Keep tracking!</div>
              )}
            </div>
          </div>
        </div>

        {/* Signal Doctor Heuristics Checklist */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Tracking Checklist</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Simple checks that help improve ad tracking quality.</p>
          </div>

          <div className="mt-4 space-y-3 flex-1 overflow-y-auto max-h-96 pr-1">
            {signalDoctor?.issues ? (
              signalDoctor.issues.map((issue: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border text-xs flex gap-2.5 ${
                  issue.severity === 'critical' || issue.severity === 'high' ? 'bg-rose-50/50 border-rose-200 text-rose-800 dark:bg-rose-950/10 dark:border-rose-900/60 dark:text-rose-300' :
                  issue.severity === 'medium' ? 'bg-amber-50/50 border-amber-200 text-amber-800 dark:bg-amber-950/10 dark:border-amber-900/60 dark:text-amber-300' :
                  issue.severity === 'ok' ? 'bg-green-50/50 border-green-200 text-green-800 dark:bg-green-950/10 dark:border-green-900/60 dark:text-green-300' :
                  'bg-blue-50/50 border-blue-200 text-blue-800 dark:bg-blue-950/10 dark:border-blue-900/60 dark:text-blue-300'
                }`}>
                  {issue.severity === 'critical' || issue.severity === 'high' ? <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" /> :
                   issue.severity === 'medium' ? <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" /> :
                   <CheckCircle className="w-4 h-4 shrink-0 text-green-550 mt-0.5" />}
                  <div className="space-y-1">
                    <h4 className="font-bold text-[11px] leading-tight">{issue.title} ({issue.metric})</h4>
                    <p className="text-[10px] leading-normal opacity-90">{issue.impact}</p>
                    <p className="text-[9px] font-mono leading-normal bg-white/40 dark:bg-black/20 p-1.5 rounded border border-black/5 dark:border-white/5">{issue.fix}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">Everything looks good!</div>
            )}
          </div>
        </div>

      </div>

      {/* Campaign UTM Performance Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col space-y-4 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Marketing Campaign Performance (UTM)</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">See which campaigns bring visitors and sales.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[700px] dark:text-slate-300 dark:divide-slate-800">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3">Source</th>
                <th className="px-6 py-3">Campaign</th>
                <th className="px-6 py-3">Content View</th>
                <th className="px-6 py-3">Add to Cart</th>
                <th className="px-6 py-3">Initiated Checkout</th>
                <th className="px-6 py-3">Purchases</th>
                <th className="px-6 py-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!analyticsCampaigns?.campaigns || analyticsCampaigns.campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium dark:text-slate-500">
                    No campaign data yet. Use the Campaign URL Builder below to set up ad tracking.
                  </td>
                </tr>
              ) : (
                analyticsCampaigns.campaigns.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-indigo-700 dark:text-indigo-400">{row.source}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-800 dark:text-slate-100">{row.campaign}</td>
                    <td className="px-6 py-3.5 font-semibold">{row.view_content.toLocaleString()}</td>
                    <td className="px-6 py-3.5 font-semibold">{row.add_to_cart.toLocaleString()}</td>
                    <td className="px-6 py-3.5 font-semibold">{row.initiate_checkout.toLocaleString()}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-800 dark:text-white">{row.purchase.toLocaleString()}</td>
                    <td className="px-6 py-3.5 font-bold text-indigo-600 dark:text-indigo-400 text-right">৳{row.revenue.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaign URL Builder widget */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col space-y-4 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Campaign URL Builder</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">Create campaign links so you can see which ads drive sales.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          
          {/* Input parameters Form */}
          <div className="space-y-4">
            
            {/* Base Website URL */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Base Website URL</label>
              <input 
                type="text" 
                placeholder="https://your-domain.com/shop/item"
                value={urlBuilderBaseUrl}
                onChange={(e) => setUrlBuilderBaseUrl(e.target.value)}
                className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 font-mono dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>

            {/* Source & Medium grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Campaign Source</label>
                <select 
                  value={urlBuilderSource}
                  onChange={(e) => {
                    setUrlBuilderSource(e.target.value);
                    if (e.target.value === 'facebook') setUrlBuilderMedium('paid_social');
                    else if (e.target.value === 'tiktok') setUrlBuilderMedium('paid_social');
                    else if (e.target.value === 'google') setUrlBuilderMedium('cpc');
                    else setUrlBuilderMedium('referral');
                  }}
                  className="w-full p-2.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                >
                  <option value="facebook">Facebook Ads</option>
                  <option value="tiktok">TikTok Ads</option>
                  <option value="google">Google CPC</option>
                  <option value="newsletter">Email Newsletter</option>
                  <option value="custom">Custom Partner</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Campaign Medium</label>
                <input 
                  type="text" 
                  placeholder="paid_social"
                  value={urlBuilderMedium}
                  onChange={(e) => setUrlBuilderMedium(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Campaign Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Campaign Name</label>
              <input 
                type="text" 
                placeholder="eid_sale_promotion"
                value={urlBuilderCampaign}
                onChange={(e) => setUrlBuilderCampaign(e.target.value)}
                className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>

            {/* Optional parameters Content & Term */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Ad Content (Optional)</label>
                <input 
                  type="text" 
                  placeholder="video_ad_1"
                  value={urlBuilderContent}
                  onChange={(e) => setUrlBuilderContent(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Search Term (Optional)</label>
                <input 
                  type="text" 
                  placeholder="buy_shoes"
                  value={urlBuilderTerm}
                  onChange={(e) => setUrlBuilderTerm(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
              </div>
            </div>

            <button 
              onClick={handleGenerateCampaignUrl}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              Generate Campaign URL
            </button>

          </div>

          {/* Output generator result box */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 flex flex-col justify-between dark:bg-slate-950 dark:border-slate-800">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest dark:text-slate-350">Generated URL</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Use this URL in your ads to track which campaign drives sales.</p>
            </div>

            <div className="my-4 bg-white border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 break-all select-all dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 relative group min-h-24 flex items-center">
              {generatedCampaignUrl ? (
                <>
                  {generatedCampaignUrl}
                  <button 
                    onClick={() => handleCopy(generatedCampaignUrl, 'generated_campaign_url')}
                    className="absolute top-2 right-2 p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300"
                    title="Copy URL"
                  >
                    {copiedStates['generated_campaign_url'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </>
              ) : (
                <span className="text-slate-400 italic">Your campaign URL will appear here...</span>
              )}
            </div>

            <div className="text-[10px] text-slate-400 leading-normal flex items-start gap-1.5 dark:text-slate-500">
              <Info className="w-3.5 h-3.5 shrink-0 text-slate-350 mt-0.5" />
              <span>Use this URL in your ads to track which campaign drives sales.</span>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
