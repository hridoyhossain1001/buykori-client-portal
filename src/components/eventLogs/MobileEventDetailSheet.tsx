import { Check, Copy, Loader2 } from 'lucide-react';
import { OutboxItem } from '../../types';
import { MobileEventIcon } from './eventLogBadges';
import {
  GroupedEvent,
  deliverySummary,
  eventValueLabel,
  relativeTime,
} from './eventLogUtils';

interface MobileEventDetailSheetProps {
  group: GroupedEvent;
  onClose: () => void;
  retryItem: OutboxItem | undefined;
  retrying: boolean;
  handleRetryOutbox: (id: number) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
}

export function MobileEventDetailSheet({
  group,
  onClose,
  retryItem,
  retrying,
  handleRetryOutbox,
  copiedStates,
  handleCopy,
}: MobileEventDetailSheetProps) {
  return (
    <div className="fixed inset-0 z-[70] md:hidden">
      <button
        type="button"
        aria-label="Close event details"
        onClick={onClose}
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
          onClick={onClose}
          className="mx-auto mb-3 block h-1 w-10 rounded-full bg-slate-200"
        />

        <div className="flex items-start gap-3">
          <MobileEventIcon name={group.name} />
          <div className="min-w-0 flex-1">
            <h2 id="mobile-event-detail-title" className="truncate text-lg font-bold text-slate-900">
              {group.name}
            </h2>
            <p className="text-xs text-slate-500">
              {new Date(group.timestamp).toLocaleDateString([], {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
              {' · '}
              {new Date(group.timestamp).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
              {' · '}
              {relativeTime(group.timestamp)}
            </p>
          </div>
        </div>

        <dl className="mt-4 overflow-hidden rounded-xl border border-slate-200 text-sm">
          {[
            ['Event ID', group.eventId],
            ['Product', group.contextLabel],
            ['Value', eventValueLabel(group)],
            ['Source URL', group.pageUrl || '—'],
          ].map(([label, value]) => (
            <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0">
              <dt className="text-slate-500">{label}</dt>
              <dd className="truncate text-right font-medium text-slate-800" title={value}>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 space-y-2">
          {group.deliveries
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
            disabled={!retryItem || retrying}
            onClick={() => retryItem && handleRetryOutbox(retryItem.id)}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {retrying && <Loader2 className="h-4 w-4 animate-spin" />}
            Resend event
          </button>
          <button
            type="button"
            onClick={() => handleCopy(
              JSON.stringify(group.events, null, 2),
              `event_json_${group.key}`,
            )}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-800"
          >
            {copiedStates[`event_json_${group.key}`]
              ? <Check className="h-4 w-4 text-emerald-600" />
              : <Copy className="h-4 w-4" />}
            {copiedStates[`event_json_${group.key}`] ? 'Copied' : 'Copy JSON'}
          </button>
        </div>
      </section>
    </div>
  );
}
