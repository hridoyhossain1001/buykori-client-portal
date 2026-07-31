import React from 'react';
import { MobileDeliveryBadge, MobileEventIcon } from './eventLogBadges';
import {
  GroupedEvent,
  eventValueLabel,
  highlightText,
  mobileEventDateKey,
  mobileEventDateLabel,
  relativeTime,
} from './eventLogUtils';

interface EventLogMobileListProps {
  groupedEvents: GroupedEvent[];
  searchFilter: string;
  setExpandedEventId: (id: string | null) => void;
}

export function EventLogMobileList({
  groupedEvents,
  searchFilter,
  setExpandedEventId,
}: EventLogMobileListProps) {
  return (
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
  );
}
