import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { CAPIEvent, OutboxItem } from '../types';
import { EmptyState } from './common';
import { EventLogFilters } from './eventLogs/EventLogFilters';
import { EventLogMobileList } from './eventLogs/EventLogMobileList';
import { EventLogTable } from './eventLogs/EventLogTable';
import { MobileEventDetailSheet } from './eventLogs/MobileEventDetailSheet';
import { groupEvents } from './eventLogs/eventLogUtils';

interface EventLogsViewProps {
  filteredEventsForTable: CAPIEvent[];
  searchFilter: string;
  setSearchFilter: (value: string) => void;
  liveMode: boolean;
  setLiveMode: (value: boolean) => void;
  platformFilters: string[];
  setPlatformFilters: Dispatch<SetStateAction<string[]>>;
  statusFilters: string[];
  setStatusFilters: Dispatch<SetStateAction<string[]>>;
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

  // Screen-reader announcement for live polling.
  //
  // Deliberately restrained: the table itself is not a live region, and this
  // fires only when the newest event actually changes -- not on every poll, and
  // not on the initial load. The message is a count plus the newest event name,
  // so a busy stream cannot read the whole table aloud.
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const newestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const newestKey = groupedEvents[0]?.key ?? null;
    const previousKey = newestKeyRef.current;

    // Keep the marker in step while live mode is off so re-enabling it does not
    // replay everything that arrived in the meantime.
    if (!liveMode) {
      newestKeyRef.current = newestKey;
      return;
    }
    if (newestKey === previousKey) return;

    newestKeyRef.current = newestKey;
    // First populated render establishes the baseline without announcing.
    if (previousKey === null || newestKey === null) return;

    const previousIndex = groupedEvents.findIndex(group => group.key === previousKey);
    const newCount = previousIndex === -1 ? groupedEvents.length : previousIndex;
    if (newCount <= 0) return;

    setLiveAnnouncement(
      `${newCount} new event${newCount === 1 ? '' : 's'}. Latest: ${groupedEvents[0].name}.`,
    );
  }, [groupedEvents, liveMode]);

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

  return (
    <div className="space-y-0 md:space-y-5">
      <p role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </p>
      <EventLogFilters
        groupedEvents={groupedEvents}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        liveMode={liveMode}
        setLiveMode={setLiveMode}
        platformFilters={platformFilters}
        setPlatformFilters={setPlatformFilters}
        statusFilters={statusFilters}
        setStatusFilters={setStatusFilters}
        handleExportData={handleExportData}
        successfulGroups={successfulGroups}
        failedGroups={failedGroups}
        retryingGroups={retryingGroups}
        loading={loading}
        lastFetchedAt={lastFetchedAt}
      />

      <section
        aria-labelledby="event-log-results-title"
        className="-mx-4 h-[calc(100dvh-204px)] min-w-0 overflow-y-auto bg-white md:mx-0 md:h-auto md:overflow-hidden md:rounded-xl md:border md:border-slate-200 md:shadow-sm"
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
          <EmptyState
            icon={Search}
            title="No events found"
            description="Try changing your search or filters."
          />
        ) : (
          <>
            <EventLogMobileList
              groupedEvents={groupedEvents}
              searchFilter={searchFilter}
              setExpandedEventId={setExpandedEventId}
            />

            <EventLogTable
              groupedEvents={groupedEvents}
              searchFilter={searchFilter}
              expandedEventId={expandedEventId}
              setExpandedEventId={setExpandedEventId}
              retryByEventId={retryByEventId}
              retryingOutboxIds={retryingOutboxIds}
              handleRetryOutbox={handleRetryOutbox}
              copiedStates={copiedStates}
              handleCopy={handleCopy}
            />
          </>
        )}
      </section>

      {mobileDetailGroup && (
        <MobileEventDetailSheet
          group={mobileDetailGroup}
          onClose={() => setExpandedEventId(null)}
          retryItem={mobileRetryItem}
          retrying={mobileRetrying}
          handleRetryOutbox={handleRetryOutbox}
          copiedStates={copiedStates}
          handleCopy={handleCopy}
        />
      )}
    </div>
  );
}
