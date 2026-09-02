import { CircleAlert, CircleCheck, ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles, UserRoundPlus } from 'lucide-react';
import type { DeferredOrder } from '../types';

type VerdictKey =
  | 'EXCELLENT'
  | 'GOOD'
  | 'MODERATE'
  | 'RISKY'
  | 'HIGH_RISK'
  | 'NEW_CUSTOMER'
  | 'NOT_CHECKED'
  | 'UNKNOWN';

export type { VerdictKey };

const VERDICTS: Record<VerdictKey, {
  label: string;
  className: string;
  Icon: typeof ShieldCheck;
  /** Hover text, only where the label alone leaves "why" unanswered. */
  hint?: string;
}> = {
  EXCELLENT: {
    label: 'Best Customer',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icon: Sparkles,
  },
  GOOD: {
    label: 'Good Customer',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icon: CircleCheck,
  },
  MODERATE: {
    label: 'Moderate Risk',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    Icon: CircleAlert,
  },
  RISKY: {
    label: 'Risky Customer',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
    Icon: CircleAlert,
  },
  HIGH_RISK: {
    label: 'High Risk',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    Icon: CircleAlert,
  },
  NEW_CUSTOMER: {
    label: 'New Customer',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    Icon: UserRoundPlus,
    hint: 'The couriers answered: this number has no delivery history yet.',
  },
  NOT_CHECKED: {
    label: 'Not checked',
    className: 'border-slate-200 bg-slate-50 text-slate-500',
    Icon: ShieldQuestion,
    hint: 'No courier lookup has run for this order yet.',
  },
  UNKNOWN: {
    // Deliberately NOT a tick icon: a check that could not run must never look
    // like a clean result.
    label: 'Check Unavailable',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
    Icon: ShieldAlert,
    hint: 'A courier did not answer, so this is not a verdict. Open the details and check again.',
  },
};

/** True once a courier lookup has actually run for this order. */
export function hasCourierData(details?: DeferredOrder['fraudDetails']): boolean {
  return details?.courier_summary != null;
}

function hasLocalFraudSignal(details?: DeferredOrder['fraudDetails']): boolean {
  return Boolean(details?.velocity_limit || details?.gibberish_name || details?.disposable_email);
}

function resolveVerdict(
  details?: DeferredOrder['fraudDetails'],
  scoreValue?: number,
): VerdictKey {
  const raw = String(details?.courier_verdict || '').toUpperCase() as VerdictKey;
  // A provider can fail while another provider (for example Pathao) still
  // gives a definitive "new_customer" result. Prefer that result over the
  // generic unavailable state so the badge reflects the provider response.
  if (raw === 'NEW_CUSTOMER') return 'NEW_CUSTOMER';
  if (raw && raw !== 'UNKNOWN' && raw in VERDICTS) return raw;

  const score = Number(scoreValue) || 0;
  if (score >= 75 || hasLocalFraudSignal(details)) {
    return 'HIGH_RISK';
  }
  if (score >= 50) return 'RISKY';
  if (score >= 35) return 'MODERATE';
  // Courier history is fetched on demand, so "no courier data and nothing else
  // flagged" means nobody has checked yet — not that the order came back clean.
  if (!hasCourierData(details)) return 'NOT_CHECKED';
  return 'UNKNOWN';
}

export function getFraudVerdictKey(
  details?: DeferredOrder['fraudDetails'],
  scoreValue?: number,
): VerdictKey {
  return resolveVerdict(details, scoreValue);
}

export function FraudVerdictBadge({
  details,
  score,
  compact = false,
}: {
  details?: DeferredOrder['fraudDetails'];
  score?: number;
  compact?: boolean;
}) {
  const verdict = VERDICTS[resolveVerdict(details, score)];
  const Icon = verdict.Icon;

  return (
    <span
      title={verdict.hint}
      className={`inline-flex whitespace-nowrap items-center rounded-full border font-bold ${compact ? 'gap-1 px-2 py-0.5 text-[9px]' : 'gap-1.5 px-2.5 py-1 text-xs'} ${verdict.className}`}
    >
      <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {verdict.label}
    </span>
  );
}
