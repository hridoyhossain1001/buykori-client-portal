import React from 'react';
import { 
  Search, 
  Download, 
  RotateCcw, 
  ListChecks, 
  Check, 
  Copy,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { CAPIEvent, OutboxItem } from '../types';
import { JsonViewer } from './common/JsonViewer';

// Helper function to safely escape regular expressions
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to highlight matched keywords in search results
function highlightText(text: string | number | undefined | null, search: string): React.ReactNode {
  if (text === undefined || text === null) return '';
  const textStr = String(text);
  if (!search || !search.trim()) return textStr;

  try {
    const escapedSearch = escapeRegExp(search.trim());
    const regex = new RegExp(`(${escapedSearch})`, 'gi');
    const parts = textStr.split(regex);
    
    return (
      <>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark key={index} className="bg-amber-100  text-amber-900  p-0.5 rounded">{part}</mark>
          ) : (
            part
          )
        )}
      </>
    );
  } catch (error) {
    return textStr;
  }
}

interface EventLogsViewProps {
  filteredEventsForTable: CAPIEvent[];
  searchFilter: string;
  setSearchFilter: (v: string) => void;
  liveMode: boolean;
  setLiveMode: (v: boolean) => void;
  platformFilters: string[];
  setPlatformFilters: React.Dispatch<React.SetStateAction<string[]>>;
  statusFilters: string[];
  setStatusFilters: React.Dispatch<React.SetStateAction<string[]>>;
  setSearchVal: (v: string) => void;
  expandedEventId: string | null;
  setExpandedEventId: (id: string | null) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  handleExportData: (format: 'csv' | 'json', type: 'events' | 'apilogs') => void;
  outboxItems: OutboxItem[];
  retryingOutboxIds: number[];
  handleRetryOutbox: (id: number) => void;
}

export function EventLogsView({
  filteredEventsForTable,
  searchFilter,
  setSearchFilter,
  liveMode,
  setLiveMode,
  platformFilters,
  setPlatformFilters,
  statusFilters,
  setStatusFilters,
  setSearchVal,
  expandedEventId,
  setExpandedEventId,
  copiedStates,
  handleCopy,
  handleExportData,
  outboxItems,
  retryingOutboxIds,
  handleRetryOutbox
}: EventLogsViewProps) {
  const failedOutboxItems = outboxItems.filter(item => item.status === 'dead');

  return (
    <div className="space-y-6">
      {failedOutboxItems.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 shadow-sm overflow-hidden  ">
          <div className="px-4 sm:px-5 py-3 border-b border-amber-200/70  flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600  shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-widest text-amber-900 ">Events That Need Help</h3>
                <p className="text-[11px] text-amber-800/70  truncate">{failedOutboxItems.length} event{failedOutboxItems.length === 1 ? '' : 's'} could not be sent</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[820px]">
              <thead className="text-[10px] font-bold uppercase tracking-wider text-amber-900/70 ">
                <tr>
                  <th className="px-5 py-2.5">Job</th>
                  <th className="px-5 py-2.5">Events</th>
                  <th className="px-5 py-2.5">Status</th>
                  <th className="px-5 py-2.5">Attempts</th>
                  <th className="px-5 py-2.5">Last Error</th>
                  <th className="px-5 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-200/70  bg-white/60 ">
                {failedOutboxItems.map(item => {
                  const retrying = retryingOutboxIds.includes(item.id);
                  const canRetry = item.status === 'dead';
                  return (
                    <tr key={item.id}>
                      <td className="px-5 py-3 font-mono text-amber-950 ">
                        #{item.id}<br />
                        <span className="text-[9px] text-amber-800/60 ">{new Date(item.createdAt).toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-3 text-amber-950 ">
                        <span className="font-semibold">{item.eventNames.join(', ')}</span><br />
                        <span className="text-[10px] text-amber-800/60 ">{item.eventCount} event{item.eventCount === 1 ? '' : 's'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          item.status === 'dead' ? 'bg-rose-50 text-rose-700 border-rose-200   ' :
                          item.status === 'processing' ? 'bg-indigo-50 text-indigo-700 border-indigo-200   ' :
                          'bg-amber-100 text-amber-800 border-amber-200   '
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-amber-950 ">{item.attempts}/{item.maxAttempts}</td>
                      <td className="px-5 py-3 text-amber-950  max-w-xs">
                        <span className="block max-h-9 overflow-hidden">{item.lastError || (item.nextAttemptAt ? `Next attempt ${new Date(item.nextAttemptAt).toLocaleString()}` : 'Waiting in queue')}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleRetryOutbox(item.id)}
                          disabled={!canRetry || retrying}
                          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                            canRetry && !retrying
                              ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                              : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed  '
                          }`}
                        >
                          {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Retry Now
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Search & filters controls panel */}
      <section aria-label="Event log filters" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4  ">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="relative w-full lg:max-w-md">
            <input 
              type="text" 
              aria-label="Filter event logs by keyword, event name, or details"
              placeholder="Filter by keyword, event name, or details..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full py-2 pl-9 pr-4 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 font-mono   "
            />
            <Search className="absolute w-4 h-4 text-slate-400 left-3 top-2.5" />
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 justify-start lg:justify-end flex-wrap">
            
            {/* Live Mode Toggle control */}
            <button 
              onClick={() => setLiveMode(!liveMode)}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                liveMode 
                  ? 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-1 focus:ring-rose-500/20   ' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50    '
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${liveMode ? 'bg-rose-600 pulse-dot' : 'bg-slate-400'}`} />
              <span className="whitespace-nowrap">{liveMode ? 'Live Mode Active' : 'Enable Live Mode'}</span>
            </button>

            {/* Export triggers */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0  ">
              <button 
                onClick={() => handleExportData('json', 'events')} 
                className="px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 border-r border-slate-200  flex items-center gap-1.5 font-medium cursor-pointer  "
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                JSON
              </button>
              <button 
                onClick={() => handleExportData('csv', 'events')} 
                className="px-3 py-1.5 text-[11px] text-slate-600 hover:bg-slate-50 flex items-center gap-1.5 font-medium cursor-pointer  "
              >
                CSV
              </button>
            </div>
          </div>
        </div>

        {/* Multi-select filter pills */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100  items-center">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mr-2 shrink-0">Filters:</span>
          
          {/* Platforms lists */}
          {['Meta CAPI', 'TikTok Events API', 'TikTok Browser Pixel', 'GA4'].map(p => {
            const active = platformFilters.includes(p);
            return (
              <button
                key={p}
                onClick={() => {
                  setPlatformFilters(prev => active ? prev.filter(x => x !== p) : [...prev, p]);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                  active 
                    ? 'bg-indigo-600 border-indigo-600 text-white  ' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50    '
                }`}
              >
                {p}
              </button>
            );
          })}

          <span className="h-4 w-px bg-slate-200  mx-2 self-center" />

          {/* Status lists */}
          {['Success', 'Fired', 'Failed', 'Retry'].map(s => {
            const active = statusFilters.includes(s);
            return (
              <button
                key={s}
                onClick={() => {
                  setStatusFilters(prev => active ? prev.filter(x => x !== s) : [...prev, s]);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors ${
                  active 
                    ? 'bg-indigo-600 border-indigo-600 text-white  ' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50    '
                }`}
              >
                {s}
              </button>
            );
          })}

          {/* Reset conditions */}
          {(platformFilters.length > 0 || statusFilters.length > 0 || searchFilter) && (
            <button 
              onClick={() => {
                setPlatformFilters([]);
                setStatusFilters([]);
                setSearchFilter('');
                setSearchVal('');
              }}
              className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold flex items-center gap-1 ml-auto shrink-0 self-center  "
            >
              <RotateCcw className="w-3 h-3" />
              Clear Filter
            </button>
          )}
        </div>
      </section>

      {/* Big full-width searchable logs list */}
      <section aria-labelledby="event-log-results-title" className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col  ">
        <div className="p-4 bg-slate-50/50 border-b border-slate-100   flex justify-between items-center gap-3 text-xs">
          <span className="font-semibold text-slate-500 ">{filteredEventsForTable.length} events matching your search</span>
          <span id="event-log-results-title" className="text-[10px] text-slate-500 ">Showing latest 100 events</span>
        </div>

        {filteredEventsForTable.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-50  border border-slate-200  flex items-center justify-center mx-auto text-slate-400">
              <ListChecks className="w-6 h-6 text-slate-300" />
            </div>
            <div>
              <h4 className="font-bold text-slate-700 ">No events found</h4>
              <p className="text-xs text-slate-400  max-w-sm mx-auto mt-1">No events match your filters. Try changing your search.</p>
            </div>
          </div>
        ) : (
          <>
          <div className="space-y-3 p-4 md:hidden">
            {filteredEventsForTable.map(e => {
              const isExpanded = expandedEventId === e.id;
              return (
                <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm  ">
                  <button
                    type="button"
                    onClick={() => setExpandedEventId(isExpanded ? null : e.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-bold text-indigo-600 ">{highlightText(e.id, searchFilter)}</p>
                        <p className="mt-1 text-sm font-bold text-slate-900 ">{highlightText(e.name, searchFilter)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                        e.status === 'Success' ? 'border-slate-200 bg-green-50 text-green-700' :
                        e.status === 'Fired' ? 'border-violet-200 bg-violet-50 text-violet-700' :
                        e.status === 'Filtered' ? 'border-sky-200 bg-sky-50 text-sky-700' :
                        e.status === 'Retry' ? 'border-slate-200 bg-amber-50 text-amber-700' :
                        'border-slate-200 bg-rose-50 text-rose-700'
                      }`}>
                        {e.status}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          e.platform === 'Meta CAPI' ? 'bg-indigo-500' :
                          e.platform === 'TikTok Events API' ? 'bg-cyan-500' :
                          e.platform === 'TikTok Browser Pixel' ? 'bg-violet-500' : 'bg-orange-500'
                        }`} />
                        {highlightText(e.platform, searchFilter)}
                      </span>
                      <span className="text-right font-mono">Code {e.status === 'Filtered' ? '—' : e.httpCode}</span>
                      <span className="font-mono">{new Date(e.timestamp).toLocaleTimeString()}</span>
                      <span className="text-right font-mono">{new Date(e.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 truncate font-mono text-[10px] text-slate-400">{highlightText(e.deduplicationKey, searchFilter)}</p>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 ">
                      <div className="rounded-lg bg-slate-900 p-3 font-mono text-[10px] text-slate-200">
                        <p className="mb-2 font-bold uppercase tracking-wider text-indigo-400">Event Details</p>
                        <JsonViewer value={e.payload} search={searchFilter} className="max-h-56" />
                      </div>
                      <div className="rounded-lg bg-slate-900 p-3 font-mono text-[10px] text-slate-200">
                        <p className="mb-2 font-bold uppercase tracking-wider text-emerald-400">Reply From Platform</p>
                        <JsonViewer value={e.responseBody} search={searchFilter} className="max-h-40" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div tabIndex={0} aria-label="Scrollable event log table" className="hidden max-w-full overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[400px] outline-none focus:ring-2 focus:ring-indigo-400 md:block">
            <table className="w-full text-left text-xs text-slate-660 divide-y divide-slate-100   min-w-[900px]">
              <thead className="bg-slate-50  text-[10px] font-bold uppercase tracking-wider text-slate-500  sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-3">Timestamp / Age</th>
                  <th className="px-6 py-3">Event ID</th>
                  <th className="px-6 py-3">Event Name</th>
                  <th className="px-6 py-3">Platform</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Code</th>
                  <th className="px-6 py-3 text-right">Unique Event ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 ">
                {filteredEventsForTable.map(e => {
                  const isExpanded = expandedEventId === e.id;
                  return (
                    <React.Fragment key={e.id}>
                      <tr 
                        onClick={() => setExpandedEventId(isExpanded ? null : e.id)}
                        className="hover:bg-indigo-50/20  cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-slate-500 ">
                          {new Date(e.timestamp).toLocaleTimeString()}<br/>
                          <span className="text-[9px] text-slate-400 ">
                            {new Date(e.timestamp).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-indigo-600 ">
                          {highlightText(e.id, searchFilter)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800 ">
                          {highlightText(e.name, searchFilter)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 font-medium text-slate-700 ">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              e.platform === 'Meta CAPI' ? 'bg-indigo-500' : 
                              e.platform === 'TikTok Events API' ? 'bg-cyan-500' :
                              e.platform === 'TikTok Browser Pixel' ? 'bg-violet-500' : 'bg-orange-500'
                            }`} />
                            {highlightText(e.platform, searchFilter)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            e.status === 'Success' ? 'bg-green-50 text-green-700 border border-slate-200   ' :
                            e.status === 'Fired' ? 'bg-violet-50 text-violet-700 border border-violet-200   ' :
                            e.status === 'Filtered' ? 'bg-sky-50 text-sky-700 border border-sky-200   ' :
                            e.status === 'Retry' ? 'bg-amber-50 text-amber-700 border border-slate-200   ' : 
                            'bg-rose-50 text-rose-700 border border-slate-200   '
                          }`}>
                            {highlightText(e.status, searchFilter)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-500 ">
                          {e.status === 'Filtered' ? '—' : highlightText(String(e.httpCode), searchFilter)}
                        </td>
                        <td className="px-6 py-4 font-mono text-right text-slate-400 ">
                          {highlightText(e.deduplicationKey, searchFilter)}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50  border-t border-slate-100  px-6 py-4">
                            {/* Expanded Panel Structure */}
                            <div className="space-y-4">
                              <div className="flex justify-between items-center">
                                <h5 className="font-bold text-xs text-slate-700  uppercase tracking-widest">Event Details</h5>
                                <span className="text-[10px] text-slate-400  font-mono">Unique Event ID: {highlightText(e.deduplicationKey, searchFilter)}</span>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                
                                {/* Req details */}
                                <div className="bg-slate-900 leading-relaxed text-slate-200 text-[11px] font-mono p-4 rounded-lg overflow-auto max-h-80 relative group lg:col-span-2">
                                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={(el) => { el.stopPropagation(); handleCopy(JSON.stringify(e.payload, null, 2), `evt_payload_${e.id}`) }}
                                      className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                                    >
                                      {copiedStates[`evt_payload_${e.id}`] ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  </div>
                                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Event Details</p>
                                  <JsonViewer value={e.payload} search={searchFilter} className="max-h-80" />
                                </div>

                                {/* Headers / Response */}
                                <div className="space-y-4">
                                  <div className="bg-slate-900 leading-relaxed text-slate-300 text-[11px] font-mono p-4 rounded-lg overflow-auto max-h-40 relative group">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Request Headers</p>
                                    <JsonViewer value={e.headers} search={searchFilter} className="max-h-64" />
                                  </div>

                                  <div className="bg-slate-900 leading-relaxed text-slate-300 text-[11px] font-mono p-4 rounded-lg overflow-auto max-h-40 relative group">
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">Reply From Platform</p>
                                    <JsonViewer value={e.responseBody} search={searchFilter} className="max-h-64" />
                                  </div>
                                </div>

                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
