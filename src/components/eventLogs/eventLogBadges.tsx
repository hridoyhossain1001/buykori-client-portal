import { CheckCircle2, CircleDot, Clock3, Minus, Play, Plus, Radio, XCircle } from 'lucide-react';
import { CAPIEvent } from '../../types';
import { PlatformLogo } from '../common/PlatformLogo';
import {
  DeliverySignal,
  DeliverySignalState,
  deliverySignalWord,
  deliverySignals,
  GroupedEvent,
  platformShortName,
  statusStyles,
} from './eventLogUtils';

export function StatusIcon({ status }: { status: CAPIEvent['status'] }) {
  if (status === 'Delivered') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === 'Failed') return <XCircle className="h-3.5 w-3.5" />;
  if (status === 'Retry') return <Clock3 className="h-3.5 w-3.5" />;
  return <Radio className="h-3.5 w-3.5" />;
}

/**
 * Colour only where there is news. Delivered and Rejected are the two answers a
 * merchant acts on, Fired is the browser pixel reporting for itself, and the two
 * "nothing happened" states stay grey so a row of three greys reads as quiet
 * rather than as three warnings.
 */
const signalTone: Record<DeliverySignalState, string> = {
  delivered: 'bg-emerald-50 text-emerald-700',
  fired: 'bg-blue-50 text-blue-700',
  failed: 'bg-rose-50 text-rose-700',
  sending: 'bg-slate-100 text-slate-600',
  off: 'bg-white text-slate-400',
  none: 'bg-white text-slate-400',
};

function SignalIcon({ state }: { state: DeliverySignalState }) {
  const size = 'h-3 w-3 shrink-0';
  if (state === 'delivered') return <CheckCircle2 className={size} aria-hidden="true" />;
  if (state === 'fired') return <Radio className={size} aria-hidden="true" />;
  if (state === 'failed') return <XCircle className={size} aria-hidden="true" />;
  if (state === 'sending') return <Clock3 className={size} aria-hidden="true" />;
  return <Minus className={size} aria-hidden="true" />;
}

/**
 * The Delivery column: three fixed signals -- Meta, TikTok, GA4 -- in one
 * segmented pill, in the same order on every row, so the column can be read down
 * as a board instead of parsed chip by chip.
 *
 * A destination with no row at all still gets its slot, greyed. That is the
 * point: "GA4 not sent" is information, and a variable-length chip list could
 * never show it. The gateway receipt and store webhooks are not destinations the
 * merchant chose, so they are not here -- `View` still lists every row.
 */
export function DeliverySignals({ group }: { group: GroupedEvent }) {
  const signals = deliverySignals(group);
  return (
    <span className="inline-flex max-w-full divide-x divide-[var(--bk-control-border)] overflow-hidden rounded-full border border-[var(--bk-control-border)] bg-white">
      {signals.map((signal: DeliverySignal) => (
        <span
          key={signal.key}
          title={signal.detail}
          /* `relative` is load-bearing, not decoration. The `.sr-only` below is
             `position: absolute`, and `overflow: hidden` does **not** establish a
             containing block — so without a positioned ancestor these 30 spans
             resolved against <body>, landed at x=930 from their static position
             inside the 900px table, and grew the *document* to a 931px
             scrollWidth against a 762px viewport. The page, not the table,
             scrolled sideways. Same fix as `OrdersWorkspace`'s sticky header
             cell. */
          className={`relative inline-flex min-h-7 items-center gap-1 whitespace-nowrap px-2 text-[11px] font-bold ${signalTone[signal.state]}`}
        >
          <PlatformLogo
            platform={signal.logo}
            className={`h-3.5 w-3.5 shrink-0 ${
              signal.state === 'off' || signal.state === 'none' ? 'opacity-40' : ''
            }`}
          />
          <span>{signal.label}</span>
          <SignalIcon state={signal.state} />
          <span className="sr-only">{deliverySignalWord(signal.state)}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * The same three signals for the mobile card, logo and mark only. The words are
 * dropped because the card is 44px of vertical space, not because they matter
 * less -- tapping the card opens the detail sheet, which names every
 * destination and its reply in full.
 */
export function MobileDeliverySignals({ group }: { group: GroupedEvent }) {
  const signals = deliverySignals(group);
  return (
    <span className="inline-flex divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
      {signals.map((signal: DeliverySignal) => (
        <span
          key={signal.key}
          /* `relative` for the same containing-block reason as above. */
          className={`relative inline-flex items-center gap-1 px-1.5 py-1 ${signalTone[signal.state]}`}
        >
          <PlatformLogo
            platform={signal.logo}
            className={`h-3 w-3 shrink-0 ${
              signal.state === 'off' || signal.state === 'none' ? 'opacity-40' : ''
            }`}
          />
          <SignalIcon state={signal.state} />
          <span className="sr-only">
            {signal.label} {deliverySignalWord(signal.state)}
          </span>
        </span>
      ))}
    </span>
  );
}

export function DeliveryBadge({ event }: { event: CAPIEvent }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyles(event.status)}`}
      title={`${event.platform}: ${event.status}`}
    >
      <StatusIcon status={event.status} />
      <span>{platformShortName[event.platform]}</span>
      <span>{event.status}</span>
    </span>
  );
}

export function MobileDeliveryBadge({ event }: { event: CAPIEvent }) {
  const state = event.status === 'Delivered'
    ? '✓'
    : event.status === 'Failed'
      ? '✕'
      : event.status === 'Retry'
        ? '· retry'
        : '·';
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-[9px] font-bold uppercase leading-none ${
      event.status === 'Delivered'
        ? 'bg-emerald-50 text-emerald-700'
        : event.status === 'Failed'
          ? 'bg-rose-50 text-rose-600'
          : event.status === 'Retry'
            ? 'bg-orange-50 text-orange-700'
            : event.status === 'Skipped'
              ? 'bg-slate-100 text-slate-700'
              : 'bg-blue-50 text-blue-700'
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
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
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
