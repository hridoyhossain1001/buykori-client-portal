import React from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { OutboxItem } from '../../types';
import { DeliveryBadge } from './eventLogBadges';
import { EventDetailsPanel } from './EventDetailsPanel';
import { GroupedEvent, highlightText, relativeTime } from './eventLogUtils';

interface EventLogTableProps {
  groupedEvents: GroupedEvent[];
  searchFilter: string;
  expandedEventId: string | null;
  setExpandedEventId: (id: string | null) => void;
  retryByEventId: Map<string, OutboxItem>;
  retryingOutboxIds: number[];
  handleRetryOutbox: (id: number) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
}

export function EventLogTable({
  groupedEvents,
  searchFilter,
  expandedEventId,
  setExpandedEventId,
  retryByEventId,
  retryingOutboxIds,
  handleRetryOutbox,
  copiedStates,
  handleCopy,
}: EventLogTableProps) {
  return (
    <>
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

      <div className="hidden items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400 md:flex">
        <span>
          Showing {groupedEvents.length} unique event{groupedEvents.length === 1 ? '' : 's'}
        </span>
        <span>One row per event · all platforms together</span>
      </div>
    </>
  );
}
