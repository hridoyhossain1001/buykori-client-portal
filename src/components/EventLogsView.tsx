import React, { useMemo } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  CircleDot,
  Copy,
  Download,
  BarChart3,
  List,
  Loader2,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Search,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import { CAPIEvent, OutboxItem } from '../types';
import { JsonViewer } from './common/JsonViewer';
import { PlatformLogo } from './common/PlatformLogo';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(
  text: string | number | undefined | null,
  search: string,
): React.ReactNode {
  if (text === undefined || text === null) return '';
  const textValue = String(text);
  if (!search.trim()) return textValue;

  try {
    const regex = new RegExp(`(${escapeRegExp(search.trim())})`, 'gi');
    return (
      <>
        {textValue.split(regex).map((part, index) =>
          part.toLowerCase() === search.trim().toLowerCase() ? (
            <mark key={index} className="rounded bg-amber-100 px-0.5 text-amber-900">
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </>
    );
  } catch {
    return textValue;
  }
}

const platformOrder: CAPIEvent['platform'][] = [
  'Meta CAPI',
  'TikTok Events API',
  'TikTok Browser Pixel',
  'GA4',
  'Gateway Ingest',
];

const platformShortName: Record<CAPIEvent['platform'], string> = {
  'Meta CAPI': 'Meta',
  'TikTok Events API': 'TikTok',
  'TikTok Browser Pixel': 'TikTok Pixel',
  GA4: 'GA4',
  'Gateway Ingest': 'Gateway',
};

interface GroupedEvent {
  key: string;
  eventId: string;
  name: string;
  timestamp: string;
  contextLabel: string;
  pageUrl: string | null;
  events: CAPIEvent[];
  deliveries: CAPIEvent[];
  failedCount: number;
  retryingCount: number;
}

function groupEvents(events: CAPIEvent[]): GroupedEvent[] {
  const groups = new Map<string, CAPIEvent[]>();

  events.forEach(event => {
    const sharedId = event.deduplicationKey || event.id;
    const key = `${sharedId}::${event.name}`;
    const current = groups.get(key) || [];
    current.push(event);
    groups.set(key, current);
  });

  return Array.from(groups.entries())
    .map(([key, entries]) => {
      const sortedEntries = [...entries].sort((a, b) => {
        const platformDifference =
          platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform);
        if (platformDifference !== 0) return platformDifference;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      const newest = [...entries].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0];
      const latestByPlatform = new Map<CAPIEvent['platform'], CAPIEvent>();
      [...entries]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .forEach(event => {
          if (!latestByPlatform.has(event.platform)) latestByPlatform.set(event.platform, event);
        });
      const deliveries = platformOrder
        .map(platform => latestByPlatform.get(platform))
        .filter((event): event is CAPIEvent => Boolean(event));

      return {
        key,
        eventId: newest.deduplicationKey || newest.id,
        name: newest.name,
        timestamp: newest.timestamp,
        contextLabel: newest.contextLabel || newest.pageTitle || 'Website event',
        pageUrl: newest.pageUrl || null,
        events: sortedEntries,
        deliveries,
        failedCount: deliveries.filter(event => event.status === 'Failed').length,
        retryingCount: deliveries.filter(event => event.status === 'Retry').length,
      };
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

function relativeTime(timestamp: string): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000),
  );
  if (elapsedSeconds < 60) return 'Just now';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function statusStyles(status: CAPIEvent['status']): string {
  if (status === 'Success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Failed') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'Retry') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Fired') return 'border-violet-200 bg-violet-50 text-violet-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function StatusIcon({ status }: { status: CAPIEvent['status'] }) {
  if (status === 'Success') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'Failed') return <XCircle className="h-3.5 w-3.5" />;
  if (status === 'Retry') return <Clock3 className="h-3.5 w-3.5" />;
  return <Radio className="h-3.5 w-3.5" />;
}

function DeliveryBadge({ event }: { event: CAPIEvent }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyles(event.status)}`}
      title={`${event.platform}: ${event.status}`}
    >
      <StatusIcon status={event.status} />
      <span>{platformShortName[event.platform]}</span>
    </span>
  );
}

function MobileDeliveryBadge({ event }: { event: CAPIEvent }) {
  const state = event.status === 'Success'
    ? '✓'
    : event.status === 'Failed'
      ? '✕'
      : event.status === 'Retry'
        ? '· retry'
        : '·';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-[9px] font-bold uppercase leading-none ${
      event.status === 'Success'
        ? 'bg-emerald-50 text-emerald-700'
        : event.status === 'Failed'
          ? 'bg-rose-50 text-rose-600'
          : event.status === 'Retry'
            ? 'bg-orange-50 text-orange-700'
            : 'bg-sky-50 text-sky-700'
    }`}>
      {platformShortName[event.platform]} {state}
    </span>
  );
}

function mobileEventDateKey(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-CA');
}

function mobileEventDateLabel(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const prefix = mobileEventDateKey(timestamp) === mobileEventDateKey(today.toISOString())
    ? 'Today'
    : mobileEventDateKey(timestamp) === mobileEventDateKey(yesterday.toISOString())
      ? 'Yesterday'
      : date.toLocaleDateString([], { weekday: 'short' });
  return `${prefix} · ${date.toLocaleDateString([], { day: '2-digit', month: 'short' })}`.toUpperCase();
}

function MobileEventIcon({ name }: { name: string }) {
  const normalized = name.toLowerCase();
  const iconClass = 'h-4 w-4';
  if (normalized.includes('checkout')) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
        <Play className={iconClass} fill="currentColor" />
      </span>
    );
  }
  if (normalized.includes('cart')) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
        <Plus className={iconClass} />
      </span>
    );
  }
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
      normalized.includes('purchase')
        ? 'bg-emerald-50 text-emerald-800'
        : 'bg-slate-100 text-slate-700'
    }`}>
      <CircleDot className={iconClass} />
    </span>
  );
}

function eventCustomData(group: GroupedEvent): Record<string, unknown> {
  const firstPayload = group.events[0]?.payload || {};
  const customData = firstPayload.custom_data;
  return customData && typeof customData === 'object' && !Array.isArray(customData)
    ? customData as Record<string, unknown>
    : firstPayload;
}

function eventValueLabel(group: GroupedEvent): string {
  const customData = eventCustomData(group);
  const value = customData.value;
  if (value === undefined || value === null || value === '') return '—';
  const amount = Number(value);
  const rendered = Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
  return `${String(customData.currency || 'BDT')} ${rendered}`;
}

function deliverySummary(event: CAPIEvent): string {
  if (event.status === 'Success') return `Sent · ${event.httpCode || 200} OK`;
  if (event.status === 'Retry') return 'Queued · retry scheduled';
  if (event.status === 'Failed') {
    const response = event.responseBody;
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const record = response as Record<string, unknown>;
      const reason = record.message || record.error || record.error_message;
      if (reason) return `Rejected · ${String(reason)}`;
    }
    return `Rejected · ${event.httpCode || 'platform error'}`;
  }
  return `${event.status} · ${event.httpCode || 'processing'}`;
}

interface EventLogsViewProps {
  filteredEventsForTable: CAPIEvent[];
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  liveMode: boolean;
  setLiveMode: (value: boolean) => void;
  platformFilters: string[];
  setPlatformFilters: React.Dispatch<React.SetStateAction<string[]>>;
  statusFilters: string[];
  setStatusFilters: React.Dispatch<React.SetStateAction<string[]>>;
  expandedEventId: string | null;
  setExpandedEventId: (id: string | null) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  handleExportData: (format: 'csv' | 'json', type: 'events' | 'apilogs') => void;
  outboxItems: OutboxItem[];
  retryingOutboxIds: number[];
  handleRetryOutbox: (id: number) => void;
  loading: boolean;
  loadError: string | null;
  lastFetchedAt: string | null;
  onRetry: () => Promise<void>;
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
  expandedEventId,
  setExpandedEventId,
  copiedStates,
  handleCopy,
  handleExportData,
  outboxItems,
  retryingOutboxIds,
  handleRetryOutbox,
  loading,
  loadError,
  lastFetchedAt,
  onRetry,
}: EventLogsViewProps) {
  const groupedEvents = useMemo(
    () => groupEvents(filteredEventsForTable),
    [filteredEventsForTable],
  );

  const retryByEventId = useMemo(() => {
    const retryMap = new Map<string, OutboxItem>();
    outboxItems.forEach(item => {
      if (item.status !== 'dead') return;
      item.eventIds.forEach(eventId => retryMap.set(eventId, item));
    });
    return retryMap;
  }, [outboxItems]);

  const successfulGroups = groupedEvents.filter(group =>
    group.deliveries.some(event => event.status === 'Success'),
  ).length;
  const failedGroups = groupedEvents.filter(group => group.failedCount > 0).length;
  const retryingGroups = groupedEvents.filter(group => group.retryingCount > 0).length;
  const mobileDetailGroup = groupedEvents.find(group => group.key === expandedEventId) || null;
  const mobileRetryItem = mobileDetailGroup
    ? retryByEventId.get(mobileDetailGroup.eventId)
    : undefined;
  const mobileRetrying = mobileRetryItem
    ? retryingOutboxIds.includes(mobileRetryItem.id)
    : false;

  const renderExpandedDetails = (group: GroupedEvent) => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-700">
            Event details
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
            Shared event key: {highlightText(group.eventId, searchFilter)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleCopy(group.eventId, `event_key_${group.key}`)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          {copiedStates[`event_key_${group.key}`] ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copiedStates[`event_key_${group.key}`] ? 'Copied' : 'Copy key'}
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {group.events.map(event => (
          <article
            key={event.id}
            className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2 text-xs font-bold text-slate-800">
                <PlatformLogo platform={event.platform} className="h-4 w-4 shrink-0" />
                <span className="truncate">{event.platform}</span>
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusStyles(event.status)}`}
              >
                <StatusIcon status={event.status} />
                {event.status}
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <span className="text-slate-400">HTTP status</span>
                <span className="text-right font-mono font-bold text-slate-700">
                  {event.httpCode || '—'}
                </span>
                <span className="text-slate-400">Event log ID</span>
                <span className="truncate text-right font-mono text-slate-600">
                  {event.id}
                </span>
              </div>
              <div className="rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
                <p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  Payload
                </p>
                <JsonViewer value={event.payload} search={searchFilter} className="max-h-48" />
              </div>
              {(event.status === 'Failed' || event.status === 'Retry') && (
                <div className="rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
                  <p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-wider text-rose-300">
                    Platform reply
                  </p>
                  <JsonViewer
                    value={event.responseBody}
                    search={searchFilter}
                    className="max-h-32"
                  />
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-0 pb-16 md:space-y-5 md:pb-0">
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

      <section
        aria-labelledby="event-log-results-title"
        className="-mx-4 h-[calc(100dvh-268px)] min-w-0 overflow-y-auto bg-white md:mx-0 md:h-auto md:overflow-hidden md:rounded-xl md:border md:border-slate-200 md:shadow-sm"
      >
        {loadError && groupedEvents.length > 0 && (
          <div
            className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800"
            role="alert"
          >
            <span>Refresh failed. Showing the last event history that loaded successfully.</span>
            <button type="button" onClick={() => void onRetry()} className="shrink-0 font-bold underline">
              Try again
            </button>
          </div>
        )}

        {loading && groupedEvents.length === 0 ? (
          <div className="p-16 text-center" role="status">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-indigo-500" />
            <p className="mt-3 text-sm font-bold text-slate-700">Loading event history</p>
          </div>
        ) : loadError && groupedEvents.length === 0 ? (
          <div className="p-16 text-center" role="alert">
            <AlertCircle className="mx-auto h-8 w-8 text-amber-500" />
            <p className="mt-3 text-sm font-bold text-slate-700">Event history could not load</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">{loadError}</p>
            <button
              type="button"
              onClick={() => void onRetry()}
              className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              Try again
            </button>
          </div>
        ) : groupedEvents.length === 0 ? (
          <div className="p-16 text-center">
            <Search className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No events found</p>
            <p className="mt-1 text-xs text-slate-400">Try changing your search or filters.</p>
          </div>
        ) : (
          <>
            <div className="md:hidden">
              {groupedEvents.map((group, index) => {
                const currentDateKey = mobileEventDateKey(group.timestamp);
                const previousDateKey = index > 0
                  ? mobileEventDateKey(groupedEvents[index - 1].timestamp)
                  : null;
                return (
                  <React.Fragment key={group.key}>
                    {currentDateKey !== previousDateKey && (
                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {mobileEventDateLabel(group.timestamp)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedEventId(group.key)}
                      className="flex min-h-[82px] w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors active:bg-slate-50"
                      aria-label={`View details for ${group.name}`}
                    >
                      <MobileEventIcon name={group.name} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="truncate text-sm font-bold leading-tight text-slate-900">
                            {highlightText(group.name, searchFilter)}
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-500">
                            {relativeTime(group.timestamp)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs leading-tight text-slate-600">
                          {highlightText(group.contextLabel, searchFilter)}
                          {group.name.toLowerCase().includes('purchase') && eventValueLabel(group) !== '—'
                            ? ` · ${eventValueLabel(group)}`
                            : ''}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          {group.deliveries
                            .filter(event => event.platform !== 'Gateway Ingest')
                            .map(event => (
                              <React.Fragment key={event.id}>
                                <MobileDeliveryBadge event={event} />
                              </React.Fragment>
                            ))}
                        </span>
                      </span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            <div
              tabIndex={0}
              aria-label="Scrollable grouped event log table"
              className="hidden max-h-[calc(100vh-250px)] min-h-[400px] max-w-full overflow-auto outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-400 md:block"
            >
              <table className="w-full min-w-[900px] table-fixed text-left text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-[132px] px-6 py-3">Time</th>
                    <th className="w-[190px] px-6 py-3">Event</th>
                    <th className="px-6 py-3">Page / Product</th>
                    <th className="w-[310px] px-6 py-3">Delivery</th>
                    <th className="w-[92px] px-6 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupedEvents.map(group => {
                    const expanded = expandedEventId === group.key;
                    const retryItem = retryByEventId.get(group.eventId);
                    const retrying = retryItem ? retryingOutboxIds.includes(retryItem.id) : false;
                    return (
                      <React.Fragment key={group.key}>
                        <tr className="transition-colors hover:bg-indigo-50/20">
                          <td className="px-6 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => setExpandedEventId(expanded ? null : group.key)}
                              className="text-left"
                            >
                              <span className="block font-bold text-slate-800">
                                {relativeTime(group.timestamp)}
                              </span>
                              <span className="mt-1 block text-[11px] text-slate-400">
                                {new Date(group.timestamp).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}{' '}
                                ·{' '}
                                {new Date(group.timestamp).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </span>
                            </button>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => setExpandedEventId(expanded ? null : group.key)}
                              className="max-w-full text-left"
                            >
                              <span className="block truncate font-bold text-slate-900">
                                {highlightText(group.name, searchFilter)}
                              </span>
                              <span className="mt-1 block truncate font-mono text-[11px] text-slate-400">
                                {highlightText(group.eventId, searchFilter)}
                              </span>
                            </button>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => setExpandedEventId(expanded ? null : group.key)}
                              className="block max-w-full text-left"
                            >
                              <span className="block truncate font-semibold text-slate-800" title={group.contextLabel}>
                                {highlightText(group.contextLabel, searchFilter)}
                              </span>
                              {group.pageUrl && (
                                <span className="mt-1 block truncate text-[11px] text-slate-400" title={group.pageUrl}>
                                  {highlightText(group.pageUrl, searchFilter)}
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 align-top">
                            <div className="flex flex-wrap gap-1.5">
                              {group.deliveries.map(event => (
                                <React.Fragment key={event.id}>
                                  <DeliveryBadge event={event} />
                                </React.Fragment>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right align-top">
                            {retryItem ? (
                              <button
                                type="button"
                                disabled={retrying}
                                onClick={() => handleRetryOutbox(retryItem.id)}
                                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                                Retry
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedEventId(expanded ? null : group.key)}
                                className="min-h-8 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                              >
                                {expanded ? 'Hide' : 'View'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={5} className="border-t border-slate-100 bg-slate-50 px-6 py-5">
                              {renderExpandedDetails(group)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="hidden items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400 md:flex">
              <span>
                Showing {groupedEvents.length} unique event{groupedEvents.length === 1 ? '' : 's'}
              </span>
              <span>One row per event · all platforms together</span>
            </div>
          </>
        )}
      </section>

      <nav
        aria-label="Event logs mobile navigation"
        className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-4 border-t border-slate-200 bg-white px-3 pb-1 md:hidden"
      >
        <a href="/event-logs" aria-current="page" className="flex flex-col items-center justify-center gap-1 text-[10px] font-semibold text-sky-600">
          <List className="h-4 w-4" />
          Logs
        </a>
        <a href="/dashboard" className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-500">
          <BarChart3 className="h-4 w-4" />
          Overview
        </a>
        <a href="/settings/conversions-api" className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-500">
          <CircleDot className="h-4 w-4" />
          Pixels
        </a>
        <a href="/settings/store-connection" className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-500">
          <SlidersHorizontal className="h-4 w-4" />
          Settings
        </a>
      </nav>

      {mobileDetailGroup && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button
            type="button"
            aria-label="Close event details"
            onClick={() => setExpandedEventId(null)}
            className="absolute inset-0 bg-slate-950/35"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-event-detail-title"
            className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-3xl bg-white px-4 pb-5 pt-3 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close detail sheet"
              onClick={() => setExpandedEventId(null)}
              className="mx-auto mb-3 block h-1 w-10 rounded-full bg-slate-200"
            />

            <div className="flex items-start gap-3">
              <MobileEventIcon name={mobileDetailGroup.name} />
              <div className="min-w-0 flex-1">
                <h2 id="mobile-event-detail-title" className="truncate text-lg font-bold text-slate-900">
                  {mobileDetailGroup.name}
                </h2>
                <p className="text-xs text-slate-500">
                  {new Date(mobileDetailGroup.timestamp).toLocaleDateString([], {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {' · '}
                  {new Date(mobileDetailGroup.timestamp).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {relativeTime(mobileDetailGroup.timestamp)}
                </p>
              </div>
            </div>

            <dl className="mt-4 overflow-hidden rounded-xl border border-slate-200 text-sm">
              {[
                ['Event ID', mobileDetailGroup.eventId],
                ['Product', mobileDetailGroup.contextLabel],
                ['Value', eventValueLabel(mobileDetailGroup)],
                ['Source URL', mobileDetailGroup.pageUrl || '—'],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="truncate text-right font-medium text-slate-800" title={value}>{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 space-y-2">
              {mobileDetailGroup.deliveries
                .filter(event => event.platform !== 'Gateway Ingest')
                .map(event => (
                  <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">
                        {event.platform === 'Meta CAPI'
                          ? 'Meta Pixel'
                          : event.platform.includes('TikTok')
                            ? 'TikTok Pixel'
                            : event.platform}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">{deliverySummary(event)}</p>
                    </div>
                    <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase ${
                      event.status === 'Success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : event.status === 'Failed'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-orange-50 text-orange-700'
                    }`}>
                      {event.status === 'Success' ? '✓ OK' : event.status === 'Failed' ? '✕ Failed' : event.status}
                    </span>
                  </div>
                ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!mobileRetryItem || mobileRetrying}
                onClick={() => mobileRetryItem && handleRetryOutbox(mobileRetryItem.id)}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {mobileRetrying && <Loader2 className="h-4 w-4 animate-spin" />}
                Resend event
              </button>
              <button
                type="button"
                onClick={() => handleCopy(
                  JSON.stringify(mobileDetailGroup.events, null, 2),
                  `event_json_${mobileDetailGroup.key}`,
                )}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-800"
              >
                {copiedStates[`event_json_${mobileDetailGroup.key}`]
                  ? <Check className="h-4 w-4 text-emerald-600" />
                  : <Copy className="h-4 w-4" />}
                {copiedStates[`event_json_${mobileDetailGroup.key}`] ? 'Copied' : 'Copy JSON'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
