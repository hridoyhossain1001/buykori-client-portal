import React from 'react';
import { Download, AlertTriangle, Activity, CheckCircle2, Clock3 } from 'lucide-react';
import { APILog } from '../types';
import { PlatformBadge, PlatformLogo } from './common/PlatformLogo';

interface ApiLogsViewProps {
  filteredApiLogsForTable: APILog[];
  expandedApiLogId: string | null;
  setExpandedApiLogId: (id: string | null) => void;
  handleExportData: (format: 'csv' | 'json', type: 'events' | 'apilogs') => void;
}

type PlatformHealth = {
  platform: string;
  configured: boolean;
  successful: number;
  failed: number;
  queued: number;
  dead: number;
  successRate: number | null;
  state: 'healthy' | 'retrying' | 'action_required' | 'no_data';
};

export function ApiLogsView({
  filteredApiLogsForTable,
  expandedApiLogId,
  setExpandedApiLogId,
  handleExportData
}: ApiLogsViewProps) {
  const [platformHealth, setPlatformHealth] = React.useState<PlatformHealth[]>([]);

  React.useEffect(() => {
    let active = true;
    fetch('/api/delivery/health')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active && data?.platforms) setPlatformHealth(data.platforms);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <div className="space-y-6">

      {platformHealth.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Platform delivery health">
          {platformHealth.map((item) => {
            const needsAction = item.state === 'action_required';
            const retrying = item.state === 'retrying';
            const noData = item.state === 'no_data';
            const noDataLabel = item.configured ? 'Waiting for first delivery' : 'Not enabled';
            return (
              <div key={item.platform} className={`rounded-xl border p-4 shadow-sm ${needsAction ? 'border-rose-200 bg-rose-50' : retrying ? 'border-amber-200 bg-amber-50' : noData && item.configured ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <PlatformBadge platform={item.platform} label={item.platform} />
                    <p className="mt-1 text-xs text-slate-500">{item.configured ? 'Configured' : 'Not configured'}</p>
                  </div>
                  {needsAction ? <AlertTriangle className="h-4 w-4 text-rose-600" /> : retrying ? <Clock3 className="h-4 w-4 text-amber-600" /> : noData ? <Activity className="h-4 w-4 text-slate-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </div>
                <p className={`mt-4 font-bold text-slate-900 ${noData ? 'text-base' : 'text-2xl'}`}>{noData ? noDataLabel : `${item.successRate}%`}</p>
                <p className="mt-1 text-xs text-slate-500">{noData ? 'No delivery attempts in the last 7 days' : `${item.successful} successful · ${item.failed} failed`}</p>
                {(item.queued > 0 || item.dead > 0) && (
                  <p className={`mt-2 text-xs font-bold ${item.dead ? 'text-rose-700' : 'text-amber-700'}`}>{item.queued} retrying · {item.dead} needs manual retry</p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Sub controls & export bar */}
      <div className="flex justify-between items-center">
        <h2 id="api-logs-title" className="font-bold text-slate-800 text-xs uppercase tracking-widest text-slate-500 ">Platform delivery history</h2>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExportData('json', 'apilogs')}
            className="flex min-h-10 items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Export Logs
          </button>
        </div>
      </div>

      {/* Outbound logs table */}
      <section aria-labelledby="api-logs-title" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto  ">
        <div className="space-y-3 p-4 md:hidden">
          {filteredApiLogsForTable.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center  ">
              <Activity className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-xs font-bold text-slate-600 ">No API logs yet</p>
            </div>
          ) : filteredApiLogsForTable.slice(0, 40).map(l => {
            const isExpanded = expandedApiLogId === l.id;
            const hasErr = l.statusCode >= 400;
            const endpointHost = (() => {
              try { return new URL(l.endpoint).hostname; } catch { return l.endpoint; }
            })();
            return (
              <div key={l.id} className={`rounded-xl border bg-white p-4 shadow-sm  ${hasErr ? 'border-rose-200' : 'border-slate-200 '}`}>
                <button type="button" onClick={() => setExpandedApiLogId(isExpanded ? null : l.id)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><PlatformLogo platform={l.platform} className="h-4 w-4" />{l.platform}</span>
                      <p className="mt-1 font-mono text-xs text-slate-500">{endpointHost}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-bold ${hasErr ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {hasErr ? <AlertTriangle className="h-3 w-3" /> : null}
                      {l.statusCode}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                    <span className="font-mono">{new Date(l.timestamp).toLocaleTimeString()}</span>
                    <span className="text-center font-mono">{l.method}</span>
                    <span className="text-right font-mono">{l.retryCount > 0 ? `${l.retryCount} retries` : 'No retry'}</span>
                  </div>
                  {l.retryCount > 0 && <p className="mt-2 text-xs font-bold text-amber-600">{l.retryCount} retried</p>}
                </button>
                {isExpanded && (
                  <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3 ">
                    <div className="rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-200">
                      <p className="mb-2 font-bold uppercase tracking-wider text-indigo-400">Data Sent</p>
                      <pre tabIndex={0} aria-label={`Request body for API log ${l.id}`} className="max-h-52 overflow-auto whitespace-pre-wrap break-all outline-none focus:ring-2 focus:ring-indigo-400">{l.requestBody}</pre>
                    </div>
                    <div className="rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-200">
                      <p className="mb-2 font-bold uppercase tracking-wider text-emerald-400">Reply From Platform</p>
                      <pre tabIndex={0} aria-label={`Response body for API log ${l.id}`} className="max-h-52 overflow-auto whitespace-pre-wrap break-all outline-none focus:ring-2 focus:ring-indigo-400">{l.responseBody}</pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div tabIndex={0} aria-label="Scrollable API logs table" className="hidden overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px] outline-none focus:ring-2 focus:ring-indigo-400 md:block">
          <table className="w-full text-left text-xs divide-y divide-slate-100  min-w-[850px]">
            <thead className="bg-slate-50  text-xs font-bold uppercase tracking-wider text-slate-500  sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Platform</th>
                <th className="px-6 py-3">Sent to</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Status code</th>
                <th className="px-6 py-3 text-right">Retries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {filteredApiLogsForTable.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 font-medium">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <Activity className="h-7 w-7 text-slate-300" />
                      <p className="font-bold text-slate-600 ">No API logs yet</p>
                      <p className="text-xs font-normal text-slate-400">Logs will appear after tracking events are sent to Meta, TikTok, or GA4.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredApiLogsForTable.slice(0, 40).map(l => {
                  const isExpanded = expandedApiLogId === l.id;
                  const hasErr = l.statusCode >= 400;
                  const hasRetry = l.retryCount > 0;

                  return (
                    <React.Fragment key={l.id}>
                      <tr 
                        onClick={() => setExpandedApiLogId(isExpanded ? null : l.id)}
                        className="hover:bg-slate-50/50  cursor-pointer transition-colors"
                      >
                        <td className={`px-6 py-3.5 font-mono text-slate-400  ${
                          hasErr ? 'border-l-4 border-l-rose-500 pl-5' : 
                          hasRetry ? 'border-l-4 border-l-amber-500 pl-5' : ''
                        }`}>
                          {new Date(l.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-3.5 font-medium text-slate-800 ">
                          <span className="flex items-center gap-1.5"><PlatformLogo platform={l.platform} className="h-4 w-4" />{l.platform}</span>
                        </td>
                        <td className="px-6 py-3.5 font-mono text-xs max-w-xs truncate text-slate-500 " title={l.endpoint}>
                          {l.endpoint}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-mono font-semibold  ">
                            {l.method}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1 font-mono font-bold ${
                            hasErr ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {hasErr ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : null}
                            {l.statusCode}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono font-medium">
                          {l.retryCount > 0 ? (
                            <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 whitespace-nowrap   ">
                              {l.retryCount} retried
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50  border-t border-slate-100  px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div tabIndex={0} aria-label={`Expanded request body for API log ${l.id}`} className="bg-slate-900 text-slate-200 text-xs font-mono p-4 rounded-lg overflow-auto max-h-60 outline-none focus:ring-2 focus:ring-indigo-400">
                                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Data Sent</p>
                                <pre className="whitespace-pre-wrap break-all">{l.requestBody}</pre>
                              </div>

                              <div tabIndex={0} aria-label={`Expanded response body for API log ${l.id}`} className="bg-slate-900 text-slate-300 text-xs font-mono p-4 rounded-lg overflow-auto max-h-60 outline-none focus:ring-2 focus:ring-indigo-400">
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Reply from platform</p>
                                <pre className="whitespace-pre-wrap break-all">{l.responseBody}</pre>
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
      </section>

    </div>
  );
}
