import React from 'react';
import { 
  BarChart as ReChartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReChartsTooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Download, AlertTriangle, Activity } from 'lucide-react';
import { APILog } from '../types';

interface ApiLogsViewProps {
  filteredApiLogsForTable: APILog[];
  apiLogs: APILog[];
  expandedApiLogId: string | null;
  setExpandedApiLogId: (id: string | null) => void;
  handleExportData: (format: 'csv' | 'json', type: 'events' | 'apilogs') => void;
}

export function ApiLogsView({
  filteredApiLogsForTable,
  apiLogs,
  expandedApiLogId,
  setExpandedApiLogId,
  handleExportData
}: ApiLogsViewProps) {
  const latencyValues = apiLogs
    .map((log) => Number(log.latencyMs))
    .filter((value) => Number.isFinite(value) && value > 0);
  const averageLatency = latencyValues.length > 0
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : null;
  
  // API Latency Graph distribution
  const getLatencyChartData = () => {
    return apiLogs.slice(0, 15).reverse().map((l, index) => ({
      name: `#${index + 1}`,
      'Latency (ms)': Number.isFinite(Number(l.latencyMs)) ? Number(l.latencyMs) : 0,
      'Status': l.statusCode === 200 ? 'Success' : 'Error'
    }));
  };
  const hasLatencySamples = getLatencyChartData().some((point) => point['Latency (ms)'] > 0);

  return (
    <div className="space-y-6">

      {/* Top analytic graph measuring latency rates over time */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">API Response Times</h3>
            <p className="text-xs text-slate-400 ">Connection response times in milliseconds</p>
          </div>
          <div className="text-xs text-slate-500 font-mono ">
            Avg Latency: <span className="font-bold text-indigo-600 ">{averageLatency !== null ? `${averageLatency}ms` : 'No samples'}</span>
          </div>
        </div>

        <div className="h-32">
          {hasLatencySamples ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <ReChartsBarChart data={getLatencyChartData()} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} unit="ms" />
                <ReChartsTooltip contentStyle={{ fontSize: '10px', borderRadius: '6px', backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#1e293b' }} />
                <Bar dataKey="Latency (ms)" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={12} />
              </ReChartsBarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 text-center  ">
              <div>
                <Activity className="mx-auto h-6 w-6 text-slate-300" />
                <p className="mt-2 text-xs font-bold text-slate-600 ">No latency samples yet</p>
                <p className="mt-1 text-[11px] text-slate-400">Response time bars will appear after API calls include latency values.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub controls & export bar */}
      <div className="flex justify-between items-center">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-widest text-slate-500 ">API Logs</h4>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExportData('json', 'apilogs')}
            className="px-2.5 py-1 text-xs font-semibold rounded bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer    "
          >
            <Download className="w-3.5 h-3.5" /> Export Logs
          </button>
        </div>
      </div>

      {/* Outbound logs table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto  ">
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
                      <p className="text-sm font-bold text-slate-900 ">{l.platform}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">{endpointHost}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${hasErr ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {hasErr ? <AlertTriangle className="h-3 w-3" /> : null}
                      {l.statusCode}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
                    <span className="font-mono">{new Date(l.timestamp).toLocaleTimeString()}</span>
                    <span className="text-center font-mono">{l.method}</span>
                    <span className="text-right font-mono">{Number.isFinite(Number(l.latencyMs)) && Number(l.latencyMs) > 0 ? `${Number(l.latencyMs)}ms` : 'N/A'}</span>
                  </div>
                  {l.retryCount > 0 && <p className="mt-2 text-[11px] font-bold text-amber-600">{l.retryCount} retried</p>}
                </button>
                {isExpanded && (
                  <div className="mt-4 grid gap-3 border-t border-slate-100 pt-3 ">
                    <div className="rounded-lg bg-slate-900 p-3 font-mono text-[10px] text-slate-200">
                      <p className="mb-2 font-bold uppercase tracking-wider text-indigo-400">Data Sent</p>
                      <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all">{l.requestBody}</pre>
                    </div>
                    <div className="rounded-lg bg-slate-900 p-3 font-mono text-[10px] text-slate-200">
                      <p className="mb-2 font-bold uppercase tracking-wider text-emerald-400">Platform Response</p>
                      <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all">{l.responseBody}</pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] min-h-[300px] md:block">
          <table className="w-full text-left text-xs divide-y divide-slate-100  min-w-[850px]">
            <thead className="bg-slate-50  text-[10px] font-bold uppercase tracking-wider text-slate-500  sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Platform</th>
                <th className="px-6 py-3">Endpoint URL</th>
                <th className="px-6 py-3">Method</th>
                <th className="px-6 py-3">Status code</th>
                <th className="px-6 py-3">Latency</th>
                <th className="px-6 py-3 text-right">Retries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 ">
              {filteredApiLogsForTable.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400 font-medium">
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
                          {l.platform}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-xs max-w-xs truncate text-slate-500 " title={l.endpoint}>
                          {l.endpoint}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono font-semibold  ">
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
                        <td className="px-6 py-3.5 font-mono text-slate-500 ">
                          {Number.isFinite(Number(l.latencyMs)) && Number(l.latencyMs) > 0 ? `${Number(l.latencyMs)}ms` : 'N/A'}
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
                          <td colSpan={7} className="bg-slate-50  border-t border-slate-100  px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-slate-900 text-slate-200 text-[11px] font-mono p-4 rounded-lg overflow-auto max-h-60">
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Data Sent</p>
                                <pre className="whitespace-pre-wrap break-all">{l.requestBody}</pre>
                              </div>

                              <div className="bg-slate-900 text-slate-300 text-[11px] font-mono p-4 rounded-lg overflow-auto max-h-60">
                                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Platform Response</p>
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
      </div>

    </div>
  );
}
