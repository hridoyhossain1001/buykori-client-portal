import { Check, Copy } from 'lucide-react';
import { JsonViewer } from '../common/JsonViewer';
import { PlatformLogo } from '../common/PlatformLogo';
import { StatusIcon } from './eventLogBadges';
import { GroupedEvent, highlightText, statusStyles } from './eventLogUtils';

interface EventDetailsPanelProps {
  group: GroupedEvent;
  searchFilter: string;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
}

export function EventDetailsPanel({
  group,
  searchFilter,
  copiedStates,
  handleCopy,
}: EventDetailsPanelProps) {
  return (
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
}
