import React, { useMemo } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Loader2,
  Radio,
  RotateCcw,
  Search,
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
    <div className="space-y-5">
      <section
        aria-label="Event log filters"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search event logs"
              placeholder="Search by event name, ID, product or URL..."
              value={searchFilter}
              onChange={event => setSearchFilter(event.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setLiveMode(!liveMode)}
              aria-pressed={liveMode}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors ${
                liveMode
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${liveMode ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              Live
              <span
                aria-hidden="true"
                className={`relative h-5 w-9 rounded-full transition-colors ${
                  liveMode ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    liveMode ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
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

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setPlatformFilters([]);
              setStatusFilters([]);
            }}
            className={`min-h-8 rounded-full border px-3 text-[11px] font-bold ${
              platformFilters.length === 0 && statusFilters.length === 0
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            All events <span className="italic">{groupedEvents.length}</span>
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
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold ${
                  active
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <PlatformLogo platform={platform} className="h-3.5 w-3.5" />
                {platformShortName[platform]} <span className="italic">{count}</span>
              </button>
            );
          })}

          <span className="hidden h-5 w-px bg-slate-200 sm:block" />

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
      </section>

      <section
        aria-labelledby="event-log-results-title"
        className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
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
            <div className="space-y-3 p-3 md:hidden">
              {groupedEvents.map(group => {
                const expanded = expandedEventId === group.key;
                const retryItem = retryByEventId.get(group.eventId);
                const retrying = retryItem ? retryingOutboxIds.includes(retryItem.id) : false;
                return (
                  <article key={group.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setExpandedEventId(expanded ? null : group.key)}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">
                            {highlightText(group.name, searchFilter)}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                            {highlightText(group.eventId, searchFilter)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-bold text-slate-700">
                          {relativeTime(group.timestamp)}
                        </span>
                      </div>
                      <p className="mt-3 truncate text-xs font-semibold text-slate-700">
                        {highlightText(group.contextLabel, searchFilter)}
                      </p>
                      {group.pageUrl && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">{group.pageUrl}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {group.deliveries.map(event => (
                          <React.Fragment key={event.id}>
                            <DeliveryBadge event={event} />
                          </React.Fragment>
                        ))}
                      </div>
                    </button>
                    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
                      <span className="text-[11px] text-slate-400">
                        {new Date(group.timestamp).toLocaleString()}
                      </span>
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
                          className="min-h-8 px-2 text-[11px] font-bold text-indigo-600"
                        >
                          {expanded ? 'Hide' : 'View'}
                        </button>
                      )}
                    </div>
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50 p-4">
                        {renderExpandedDetails(group)}
                      </div>
                    )}
                  </article>
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

            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
              <span>
                Showing {groupedEvents.length} unique event{groupedEvents.length === 1 ? '' : 's'}
              </span>
              <span>One row per event · all platforms together</span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
