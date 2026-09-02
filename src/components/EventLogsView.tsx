import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { CAPIEvent, OutboxItem } from '../types';
import { EventActivityWorkspace } from './eventLogs/EventActivityWorkspace';
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

  const mobileDetailGroup = groupedEvents.find(group => group.key === expandedEventId) || null;
  const mobileRetryItem = mobileDetailGroup
    ? retryByEventId.get(mobileDetailGroup.eventId)
    : undefined;
  const mobileRetrying = mobileRetryItem
    ? retryingOutboxIds.includes(mobileRetryItem.id)
    : false;

  return (
    <div>
      <p role="status" aria-live="polite" className="sr-only">
        {liveAnnouncement}
      </p>

      <EventActivityWorkspace
        groupedEvents={groupedEvents}
        searchFilter={searchFilter}
        setSearchFilter={setSearchFilter}
        liveMode={liveMode}
        setLiveMode={setLiveMode}
        platformFilters={platformFilters}
        setPlatformFilters={setPlatformFilters}
        statusFilters={statusFilters}
        setStatusFilters={setStatusFilters}
        expandedEventId={expandedEventId}
        setExpandedEventId={setExpandedEventId}
        copiedStates={copiedStates}
        handleCopy={handleCopy}
        handleExportData={handleExportData}
        retryByEventId={retryByEventId}
        retryingOutboxIds={retryingOutboxIds}
        handleRetryOutbox={handleRetryOutbox}
        loading={loading}
        loadError={loadError}
        lastFetchedAt={lastFetchedAt}
        onRetry={onRetry}
      />

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
