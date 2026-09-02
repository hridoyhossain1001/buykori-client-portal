/**
 * The prototype's "Event activity" screen, rebuilt on the live data pipeline
 * instead of the prototype's fixtures.
 *
 * Three departures from `portal.tsx` are deliberate, and each exists because the
 * live data is richer than the fixture it was drawn from:
 *
 *  - **The Delivery column is three fixed signals: Meta, TikTok, GA4.** Those are
 *    the destinations a merchant chose and pays for, and a fixed set of three in
 *    a fixed order lets the column be read straight down. Nothing is dropped
 *    from the data -- the gateway receipt, store webhooks, the TikTok browser
 *    pixel and every single attempt still appear under `View`, in the mobile
 *    detail sheet, in the export and in the destination filter chips, which stay
 *    data-derived. What the summary column no longer does is print
 *    "Gateway Accepted" next to "Meta Delivered", where our own ingest receipt
 *    read as a fourth ad platform that had answered oddly.
 *  - **The live switch really polls.** The prototype's "Snapshot view" toggle is
 *    inert by design. Here the same control drives the 5-second refresh that
 *    already exists in `App.tsx`, so it also has to say when it last checked.
 *  - **One row per event, every destination inside it.** `groupEvents` collapses
 *    the several `event_logs` rows one tracked event writes. Paging therefore
 *    runs over the grouped list, never the raw rows -- otherwise a single
 *    event's Meta and GA4 deliveries could land on different pages.
 *
 * This is a presentation layer only: no fetch, no mutation, no API import.
 * Every number, list and handler arrives as a prop.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AlertCircle, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react';
import type { OutboxItem } from '../../types';
import {
  Button,
  Card,
  MetricStrip,
  PageHeader,
  PaginationControls,
  TableHeaderCell,
} from '../common';
import type { MetricStripItem } from '../common';
import { PlatformLogo } from '../common/PlatformLogo';
import { useIsWide } from '../../lib/useIsWide';
import { DeliverySignals } from './eventLogBadges';
import { EventDetailsPanel } from './EventDetailsPanel';
import { EventLogMobileList } from './EventLogMobileList';
import {
  GroupedEvent,
  eventValueLabel,
  highlightText,
  platformOrder,
  platformShortName,
  relativeTime,
} from './eventLogUtils';

/** 15 grouped events fills the viewport without a second scroll container. */
const PAGE_SIZE = 15;

interface EventActivityWorkspaceProps {
  groupedEvents: GroupedEvent[];
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
  retryByEventId: Map<string, OutboxItem>;
  retryingOutboxIds: number[];
  handleRetryOutbox: (id: number) => void;
  loading: boolean;
  loadError: string | null;
  lastFetchedAt: string | null;
  onRetry: () => Promise<void>;
}

/**
 * The prototype's `.chip`: one pill that carries a label and the number of rows
 * behind it, so a merchant can see a filter is empty before spending a click on
 * it. `aria-pressed` rather than a checkbox, because these narrow one table.
 */
function FilterChip({
  label,
  count,
  active,
  icon,
  phoneIconOnly = false,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  icon?: React.ReactNode;
  /**
   * Below sm, show the icon alone. The label goes `sr-only` rather than away, so
   * it is still the button's accessible name and still visible from sm up — the
   * chip becomes a 44px square with the same brand mark the Delivery column of
   * every row already uses. Only for chips whose icon names them on its own.
   */
  phoneIconOnly?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      /* 44px on a phone, the prototype's 36px pill from md up — the same
         boundary `.bk-touch-44` uses in index.css, which is the prototype's own
         `max-width:760px` block. Seven chips at 44 take a third row on a 320px
         screen where 36 took two; a chip the thumb misses costs more than the
         row does. `max-sm:w-11` is the square icon-only case: growing only the
         height would have left it 36 wide and 44 tall. */
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border text-label font-extrabold transition-colors md:min-h-9 ${
        phoneIconOnly ? 'max-sm:w-11 max-sm:justify-center max-sm:px-0 px-3' : 'px-3'
      } ${
        active
          ? 'border-[var(--bk-console-blue)] bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]'
          : 'border-[var(--bk-control-border)] bg-white text-[var(--bk-console-text-muted)] hover:border-[var(--bk-console-blue)] hover:text-[var(--bk-console-text)]'
      }`}
    >
      {icon}
      <span className={`whitespace-nowrap ${phoneIconOnly ? 'sr-only sm:not-sr-only' : ''}`}>
        {label}
      </span>
      {count !== undefined && (
        <span className="tabular-nums font-bold opacity-70">{count}</span>
      )}
    </button>
  );
}

/** Reading order for the state chips: confirmed, in flight, then broken. */
const statusOrder: GroupedEvent['events'][number]['status'][] = [
  'Delivered',
  'Accepted',
  'Retry',
  'Failed',
  'Skipped',
  'Fired',
];


export function EventActivityWorkspace({
  groupedEvents,
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
  retryByEventId,
  retryingOutboxIds,
  handleRetryOutbox,
  loading,
  loadError,
  lastFetchedAt,
  onRetry,
}: EventActivityWorkspaceProps) {
  const [page, setPage] = useState(1);
  /* 640px is Tailwind's `sm`, so the two strings this decides match the
     breakpoint every class in this toolbar uses. */
  const isWide = useIsWide(640);

  /* Chips are built from the destinations and states actually present, plus
     whatever is currently selected -- a chip that filtered the table down to
     nothing must stay on screen, or there is no way to switch it back off.

     `Gateway Ingest` is the one exclusion. It is our own "we received it"
     receipt, not a destination the merchant chose, it is attached to virtually
     every event so filtering on it narrows nothing, and now that the Delivery
     column names only real destinations a Gateway chip would filter by something
     the table no longer shows. The rows themselves are untouched: they are still
     in `View`, in the mobile detail sheet and in the export. */
  const chipPlatforms = useMemo(() => {
    const present = new Set<string>();
    groupedEvents.forEach(group =>
      group.events.forEach(event => present.add(event.platform)),
    );
    return platformOrder.filter(
      platform =>
        (platform !== 'Gateway Ingest' && present.has(platform)) ||
        platformFilters.includes(platform),
    );
  }, [groupedEvents, platformFilters]);

  const statusCounts = useMemo(() => {
    const tally: Record<string, number> = {};
    groupedEvents.forEach(group => {
      statusOrder.forEach(status => {
        /* Failed and Retry count every attempt row, not just the latest reply
           per destination, so a retry that has since succeeded still shows up. */
        const present =
          status === 'Failed'
            ? group.failedCount > 0
            : status === 'Retry'
              ? group.retryingCount > 0
              : group.deliveries.some(event => event.status === status);
        if (present) tally[status] = (tally[status] ?? 0) + 1;
      });
    });
    return tally;
  }, [groupedEvents]);

  const metricItems: MetricStripItem[] = [
    {
      label: 'Events',
      value: groupedEvents.length.toLocaleString(),
      hint: 'One row per event, every destination inside it',
    },
    {
      label: 'Delivered',
      value: (statusCounts.Delivered ?? 0).toLocaleString(),
      hint: 'A destination confirmed it received the event',
    },
    {
      label: 'Failed',
      value: (statusCounts.Failed ?? 0).toLocaleString(),
      hint:
        (statusCounts.Failed ?? 0) > 0
          ? 'A destination rejected the event'
          : 'Nothing was rejected',
    },
    {
      label: 'Retrying',
      shortLabel: 'Retry',
      value: (statusCounts.Retry ?? 0).toLocaleString(),
      hint: 'Queued for another attempt',
    },
  ];

  const filtersActive =
    platformFilters.length > 0 || statusFilters.length > 0 || searchFilter.trim() !== '';

  /* A new filter or search rewrites the list under the reader's feet, so paging
     restarts. Clamping as well keeps page 4 of 4 from going blank when the
     filtered list shrinks. */
  useEffect(() => {
    setPage(1);
  }, [searchFilter, platformFilters, statusFilters]);

  const pageCount = Math.max(1, Math.ceil(groupedEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleGroups = useMemo(
    () => groupedEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [groupedEvents, currentPage],
  );

  const togglePlatform = (platform: string) => {
    setPlatformFilters(current =>
      current.includes(platform)
        ? current.filter(value => value !== platform)
        : [...current, platform],
    );
  };

  const toggleStatus = (status: string) => {
    setStatusFilters(current =>
      current.includes(status)
        ? current.filter(value => value !== status)
        : [...current, status],
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Tracking"
        title="Event activity"
        description="Every event your store sent, and the reply from each destination it was sent to."
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void onRetry();
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      <MetricStrip items={metricItems} />

      <Card flush padding="none">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bk-console-border)] px-3.5 py-3">
          {/* 44px on a phone, the prototype's 38px field from md up — the same
              boundary `.bk-touch-44` uses. A `<label>` wrapping the input
              forwards the tap, so the whole box is the target and the 34px input
              can stay centred inside it rather than stretching. */}
          <label className="flex h-11 w-full min-w-0 items-center gap-2 rounded-md border border-[var(--bk-control-border)] bg-white px-2.5 focus-within:border-[var(--bk-console-blue)] focus-within:ring-2 focus-within:ring-[var(--bk-console-blue)] md:h-[38px] sm:w-[min(420px,42%)]">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              value={searchFilter}
              onChange={event => setSearchFilter(event.target.value)}
              /* The full prompt is 42 characters: at 320px the box shows
                 "Search event name, page, order o" and the reader is told to
                 search by something the sentence never finishes naming. The
                 phone gets the short form; the field searches all four either
                 way. A placeholder is content, not styling, so this is one of
                 the cases useIsWide exists for. */
              placeholder={
                isWide ? 'Search event name, page, order or event ID' : 'Search events'
              }
              aria-label="Search events"
              className="h-[34px] w-full min-w-0 border-0 bg-transparent text-caption font-semibold text-[var(--bk-console-text)] placeholder:font-medium placeholder:text-[var(--bk-console-text-subtle)] focus:outline-none"
            />
          </label>

          {/* Each control takes the whole row on a phone: the toolbar wraps to
              three rows there whatever we do, and a half-width card with a
              right-aligned pair of buttons beside it left two ragged gaps. */}
          <div className="flex h-[38px] w-full items-center justify-between gap-2.5 rounded-md border border-[var(--bk-control-border)] bg-white px-2.5 sm:w-auto sm:justify-start">
            <span className="flex flex-col leading-tight">
              <span
                id="live-updates-label"
                className="text-label font-extrabold text-[var(--bk-console-text)]"
              >
                Live updates
              </span>
              <span
                id="live-updates-description"
                className="text-[10px] font-semibold text-[var(--bk-console-text-subtle)]"
              >
                {liveMode ? 'Checking every 5 seconds' : 'Updates paused'}
              </span>
            </span>
            {/* 36×20 of ink, 44×44 of target. The insets are deliberately
                uneven: `btn-touch-expand`'s flat -10px would have left this
                56 wide and only 40 tall — the axis nobody checks, because a
                switch already looks wide enough. This card renders at every
                width, so unlike the /event-logs switch it is a real thumb
                target, not a mouse-only one. */}
            <button
              type="button"
              role="switch"
              aria-checked={liveMode}
              aria-labelledby="live-updates-label"
              aria-describedby="live-updates-description"
              onClick={() => setLiveMode(!liveMode)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] ${
                liveMode ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                  liveMode ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex w-full items-center gap-2 max-sm:[&>*]:flex-1 sm:ml-auto sm:w-auto">
            <Button variant="secondary" size="sm" onClick={() => handleExportData('csv', 'events')}>
              Export CSV
            </Button>
            {/* Ghost already reserves a transparent 1px border, so colouring it
                below sm costs no layout: stretched to half the row without one,
                "JSON" read as a word floating in empty space next to a button
                rather than as the second half of a pair. */}
            <Button
              variant="ghost"
              size="sm"
              className="max-sm:border-[var(--bk-control-border)]"
              onClick={() => handleExportData('json', 'events')}
            >
              JSON
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--bk-console-border)] px-3.5 py-3">
          {/* Seven chips at their full width take three rows and 149px on a 320px
              screen — more of the screen than the first two events in the list
              below them. So on a phone the destination chips are their brand mark
              alone (the same one the Delivery column uses) and this one drops the
              noun, which brings the strip to two rows without hiding a chip or
              putting one behind a gesture. From sm up every label is back. */}
          <FilterChip
            label={isWide ? 'All events' : 'All'}
            count={groupedEvents.length}
            active={platformFilters.length === 0 && statusFilters.length === 0}
            onClick={() => {
              setPlatformFilters([]);
              setStatusFilters([]);
            }}
          />
          {chipPlatforms.map(platform => (
            <FilterChip
              key={platform}
              label={platformShortName[platform]}
              active={platformFilters.includes(platform)}
              icon={<PlatformLogo platform={platform} className="h-3.5 w-3.5" />}
              phoneIconOnly
              onClick={() => togglePlatform(platform)}
            />
          ))}

          <span className="hidden h-5 w-px bg-[var(--bk-console-border)] md:block" />

          {statusOrder
            .filter(status => (statusCounts[status] ?? 0) > 0 || statusFilters.includes(status))
            .map(status => (
              <FilterChip
                key={status}
                label={status}
                count={statusCounts[status] ?? 0}
                active={statusFilters.includes(status)}
                onClick={() => toggleStatus(status)}
              />
            ))}

          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setPlatformFilters([]);
                setStatusFilters([]);
                setSearchFilter('');
              }}
              className="inline-flex min-h-9 items-center gap-1.5 px-2 text-label font-extrabold text-[var(--bk-console-text-muted)] underline hover:text-[var(--bk-console-text)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {liveMode && (
          <p className="flex flex-wrap items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-3.5 py-2 text-label font-bold text-emerald-800">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Watching for new events
            <span className="font-semibold text-emerald-700">
              {loading && groupedEvents.length > 0
                ? '· Checking now'
                : lastFetchedAt
                  ? `· Last checked ${new Date(lastFetchedAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                      second: '2-digit',
                    })}`
                  : '· Starting'}
            </span>
          </p>
        )}

        {loadError && groupedEvents.length > 0 && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-3.5 py-2.5 text-caption font-semibold text-amber-800"
          >
            <span>Refresh failed. This is the last event history that loaded.</span>
            <button
              type="button"
              onClick={() => {
                void onRetry();
              }}
              className="shrink-0 font-bold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading && groupedEvents.length === 0 ? (
          <div className="grid min-h-[220px] place-items-center px-6 py-12 text-center" role="status">
            <div>
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--bk-console-blue)]" />
              <p className="mt-3 text-caption font-bold text-[var(--bk-console-text)]">
                Loading event history
              </p>
            </div>
          </div>
        ) : loadError && groupedEvents.length === 0 ? (
          <div className="grid min-h-[220px] place-items-center px-6 py-12 text-center" role="alert">
            <div>
              <AlertCircle className="mx-auto h-7 w-7 text-amber-500" />
              <p className="mt-3 text-caption font-bold text-[var(--bk-console-text)]">
                Event history could not load
              </p>
              <p className="mx-auto mt-1 max-w-sm text-caption text-[var(--bk-console-text-muted)]">
                {loadError}
              </p>
              <Button
                variant="primary"
                className="mt-4"
                onClick={() => {
                  void onRetry();
                }}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : groupedEvents.length === 0 ? (
          <div className="grid min-h-[220px] place-items-center px-6 py-12 text-center">
            <div>
              <p className="text-caption font-bold text-[var(--bk-console-text)]">
                {filtersActive ? 'No events match these filters' : 'No events yet'}
              </p>
              <p className="mt-1 text-caption text-[var(--bk-console-text-muted)]">
                {filtersActive
                  ? 'Clear a chip or change the search to see more.'
                  : 'Events appear here within seconds of a visitor acting on your store.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <EventLogMobileList
              groupedEvents={visibleGroups}
              searchFilter={searchFilter}
              setExpandedEventId={setExpandedEventId}
            />

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] table-fixed border-collapse text-left">
                <colgroup>
                  <col className="w-[132px]" />
                  <col className="w-[224px]" />
                  <col />
                  <col className="w-[292px]" />
                  <col className="w-[108px]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--bk-console-border)] bg-[var(--color-table-head)]">
                    <TableHeaderCell className="text-caption">Time</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Event</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Page or product</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Delivery</TableHeaderCell>
                    <TableHeaderCell className="text-caption text-right">Details</TableHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map(group => {
                    const expanded = expandedEventId === group.key;
                    const retryItem = retryByEventId.get(group.eventId);
                    const retrying = retryItem
                      ? retryingOutboxIds.includes(retryItem.id)
                      : false;
                    const valueLabel = eventValueLabel(group);
                    return (
                      <React.Fragment key={group.key}>
                        <tr
                          onClick={() => setExpandedEventId(expanded ? null : group.key)}
                          className={`cursor-pointer border-b border-[var(--bk-console-border)] align-top transition-colors ${
                            expanded
                              ? 'bg-[var(--bk-console-surface-muted)]'
                              : 'hover:bg-[var(--color-row-hover)]'
                          }`}
                        >
                          <td className="px-3 py-2.5">
                            <span className="block text-caption font-bold text-[var(--bk-console-text)]">
                              {relativeTime(group.timestamp)}
                            </span>
                            <span className="mt-0.5 block text-label font-semibold text-[var(--bk-console-text-subtle)]">
                              {new Date(group.timestamp).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="block truncate text-caption font-bold text-[var(--bk-console-text)]">
                              {highlightText(group.name, searchFilter)}
                            </span>
                            <span className="mt-0.5 block truncate text-label font-semibold text-[var(--bk-console-text-subtle)]">
                              {valueLabel !== '—'
                                ? valueLabel
                                : `Key ${group.eventId.slice(0, 12)}`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="block truncate text-caption font-semibold text-[var(--bk-console-text-body)]">
                              {highlightText(group.contextLabel, searchFilter)}
                            </span>
                            {group.pageUrl && (
                              <span className="mt-0.5 block truncate text-label font-medium text-[var(--bk-console-text-subtle)]">
                                {group.pageUrl}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <DeliverySignals group={group} />
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {retryItem ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={retrying}
                                onClick={event => {
                                  event.stopPropagation();
                                  handleRetryOutbox(retryItem.id);
                                }}
                              >
                                {retrying ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3 w-3" />
                                )}
                                Retry
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-expanded={expanded}
                                onClick={event => {
                                  event.stopPropagation();
                                  setExpandedEventId(expanded ? null : group.key);
                                }}
                              >
                                {expanded ? 'Hide' : 'View'}
                              </Button>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)]">
                            <td colSpan={5} className="px-4 py-5">
                              <EventDetailsPanel
                                group={group}
                                searchFilter={searchFilter}
                                copiedStates={copiedStates}
                                handleCopy={handleCopy}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <PaginationControls
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={groupedEvents.length}
              onPageChange={setPage}
              noun="events"
            />
          </>
        )}
      </Card>
    </div>
  );
}

