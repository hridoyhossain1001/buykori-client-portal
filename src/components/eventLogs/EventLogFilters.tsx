import type { Dispatch, SetStateAction } from 'react';
import { Download, RotateCcw, Search } from 'lucide-react';
import { PlatformLogo } from '../common/PlatformLogo';
import { GroupedEvent, platformShortName } from './eventLogUtils';

interface EventLogFiltersProps {
  groupedEvents: GroupedEvent[];
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  liveMode: boolean;
  setLiveMode: (value: boolean) => void;
  platformFilters: string[];
  setPlatformFilters: Dispatch<SetStateAction<string[]>>;
  statusFilters: string[];
  setStatusFilters: Dispatch<SetStateAction<string[]>>;
  handleExportData: (format: 'csv' | 'json', type: 'events' | 'apilogs') => void;
  successfulGroups: number;
  failedGroups: number;
  retryingGroups: number;
  loading: boolean;
  lastFetchedAt: string | null;
}

export function EventLogFilters({
  groupedEvents,
  searchFilter,
  setSearchFilter,
  liveMode,
  setLiveMode,
  platformFilters,
  setPlatformFilters,
  statusFilters,
  setStatusFilters,
  handleExportData,
  successfulGroups,
  failedGroups,
  retryingGroups,
  loading,
  lastFetchedAt,
}: EventLogFiltersProps) {
  return (
    <section
      aria-label="Event log filters"
      className="sticky top-14 z-20 -mx-4 overflow-hidden border-y border-slate-200 bg-white shadow-sm md:static md:mx-0 md:rounded-xl md:border"
    >
      <div className="flex flex-col gap-2 px-4 pb-2 pt-3 md:gap-3 md:p-4 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Search event logs"
            placeholder="Search by event name, ID, product or URL..."
            value={searchFilter}
            onChange={event => setSearchFilter(event.target.value)}
            className="min-h-11 w-full rounded-xl border-0 bg-slate-100 py-2 pl-9 pr-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-100 md:min-h-10 md:rounded-lg md:border md:border-slate-200 md:bg-white md:text-xs md:focus:border-indigo-500"
          />
        </div>

        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <div
            className={`flex min-h-12 min-w-[190px] items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-colors ${
              liveMode
                ? 'border-emerald-300 bg-emerald-50'
                : 'border-slate-200 bg-slate-50/70'
            }`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    liveMode ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                <span id="live-updates-label" className="whitespace-nowrap text-xs font-bold text-slate-800">
                  Live updates
                </span>
              </div>
              <p
                id="live-updates-description"
                className={`mt-0.5 pl-4 text-[10px] font-semibold ${
                  liveMode ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                {liveMode ? 'Checking every 5 seconds' : 'Updates paused'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={liveMode}
              aria-labelledby="live-updates-label"
              aria-describedby="live-updates-description"
              onClick={() => setLiveMode(!liveMode)}
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                liveMode
                  ? 'border-emerald-600 bg-emerald-600'
                  : 'border-slate-300 bg-slate-300 hover:bg-slate-400'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute left-1 top-1 h-[18px] w-[18px] rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ${
                  liveMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleExportData('json', 'events')}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            {'{ }'} JSON
          </button>
          <button
            type="button"
            onClick={() => handleExportData('csv', 'events')}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {liveMode && (
        <div
          className="hidden flex-wrap items-center gap-x-3 gap-y-1 border-t border-emerald-100 bg-emerald-50/70 px-4 py-2.5 text-[11px] md:flex"
          role="status"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-2 font-bold text-emerald-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Waiting for new events
          </span>
          <span className="text-emerald-700">
            Real event history is checked every 5 seconds. Existing rows stay in place until new data arrives.
          </span>
          <span className="ml-auto text-emerald-700/70">
            {loading && groupedEvents.length > 0
              ? 'Checking now…'
              : lastFetchedAt
                ? `Last checked ${new Date(lastFetchedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                  })}`
                : 'Starting…'}
          </span>
        </div>
      )}

      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto px-4 pb-2 md:flex-wrap md:overflow-visible md:border-t md:border-slate-100 md:py-3">
        <button
          type="button"
          onClick={() => {
            setPlatformFilters([]);
            setStatusFilters([]);
          }}
          aria-pressed={platformFilters.length === 0 && statusFilters.length === 0}
          className={`min-h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold md:min-h-8 md:rounded-full md:text-[11px] md:font-bold ${
            platformFilters.length === 0 && statusFilters.length === 0
              ? 'border-sky-300 bg-sky-50 text-sky-700 md:border-slate-900 md:bg-slate-900 md:text-white'
              : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 md:border-slate-200 md:bg-white md:text-slate-600 md:hover:bg-slate-50'
          }`}
        >
          <span className="md:hidden">All </span><span className="hidden md:inline">All events </span><span className="text-[10px] opacity-70">{groupedEvents.length}</span>
        </button>

        {(['Meta CAPI', 'TikTok Events API', 'GA4'] as const).map(platform => {
          const active = platformFilters.includes(platform);
          const count = groupedEvents.filter(group =>
            group.deliveries.some(event => event.platform === platform),
          ).length;
          return (
            <button
              type="button"
              key={platform}
              onClick={() =>
                setPlatformFilters(previous =>
                  active
                    ? previous.filter(value => value !== platform)
                    : [...previous, platform],
                )
              }
              aria-pressed={active}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold md:min-h-8 md:rounded-full md:text-[11px] md:font-bold ${
                active
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 md:border-slate-200 md:bg-white md:text-slate-600 md:hover:bg-slate-50'
              }`}
            >
              <PlatformLogo platform={platform} className="hidden h-3.5 w-3.5 md:block" />
              {platformShortName[platform]} <span className="text-[10px] opacity-60">{count}</span>
            </button>
          );
        })}

        <span className="hidden h-5 w-px bg-slate-200 md:block" />

        <div className="hidden contents md:contents">
        {[
          ['Success', successfulGroups],
          ['Failed', failedGroups],
          ['Retry', retryingGroups],
        ].map(([status, count]) => {
          const statusName = status as string;
          const active = statusFilters.includes(statusName);
          return (
            <button
              type="button"
              key={statusName}
              onClick={() =>
                setStatusFilters(previous =>
                  active
                    ? previous.filter(value => value !== statusName)
                    : [...previous, statusName],
                )
              }
              aria-pressed={active}
              className={`min-h-8 rounded-full border px-3 text-[11px] font-bold ${
                active
                  ? statusName === 'Failed'
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : statusName === 'Retry'
                      ? 'border-amber-300 bg-amber-50 text-amber-700'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {statusName} <span className="italic">{count}</span>
            </button>
          );
        })}
        </div>

        {(platformFilters.length > 0 || statusFilters.length > 0 || searchFilter) && (
          <button
            type="button"
            onClick={() => {
              setPlatformFilters([]);
              setStatusFilters([]);
              setSearchFilter('');
            }}
            className="ml-auto inline-flex min-h-8 items-center gap-1.5 px-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
          >
            <RotateCcw className="h-3 w-3" />
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-4 pb-2 text-[11px] md:hidden">
        <button
          type="button"
          onClick={() => setLiveMode(!liveMode)}
          className={`inline-flex items-center gap-1.5 font-medium ${liveMode ? 'text-emerald-600' : 'text-slate-500'}`}
          aria-pressed={liveMode}
        >
          <span className={`h-2 w-2 rounded-full ${liveMode ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          Live updates {liveMode ? 'on' : 'off'}
        </button>
        <span className="text-slate-500">Failed {failedGroups} · Retry {retryingGroups}</span>
      </div>
    </section>
  );
}
