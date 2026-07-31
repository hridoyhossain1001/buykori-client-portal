import { CheckCircle2, CircleDot, Clock3, Play, Plus, Radio, XCircle } from 'lucide-react';
import { CAPIEvent } from '../../types';
import { platformShortName, statusStyles } from './eventLogUtils';

export function StatusIcon({ status }: { status: CAPIEvent['status'] }) {
  if (status === 'Success') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'Failed') return <XCircle className="h-3.5 w-3.5" />;
  if (status === 'Retry') return <Clock3 className="h-3.5 w-3.5" />;
  return <Radio className="h-3.5 w-3.5" />;
}

export function DeliveryBadge({ event }: { event: CAPIEvent }) {
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

export function MobileDeliveryBadge({ event }: { event: CAPIEvent }) {
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

export function MobileEventIcon({ name }: { name: string }) {
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
