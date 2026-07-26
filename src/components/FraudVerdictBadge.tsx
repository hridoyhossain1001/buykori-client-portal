import { CircleAlert, CircleCheck, ShieldCheck, Sparkles, UserRoundPlus } from 'lucide-react';
import type { DeferredOrder } from '../types';

type VerdictKey = 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'RISKY' | 'HIGH_RISK' | 'NEW_CUSTOMER' | 'UNKNOWN';

const VERDICTS: Record<VerdictKey, {
  label: string;
  className: string;
  Icon: typeof ShieldCheck;
}> = {
  EXCELLENT: {
    label: 'Best Customer',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icon: Sparkles,
  },
  GOOD: {
    label: 'Good Customer',
    className: 'border-green-200 bg-green-50 text-green-700',
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
  },
  UNKNOWN: {
    label: 'Check Unavailable',
    className: 'border-slate-200 bg-slate-50 text-slate-600',
    Icon: ShieldCheck,
  },
};

function resolveVerdict(
  details?: DeferredOrder['fraudDetails'],
  scoreValue?: number,
): VerdictKey {
  const raw = String(details?.courier_verdict || '').toUpperCase() as VerdictKey;
  if (raw && raw !== 'UNKNOWN' && raw in VERDICTS) return raw;

  const score = Number(scoreValue) || 0;
  if (score >= 75 || details?.velocity_limit || details?.gibberish_name || details?.disposable_email) {
    return 'HIGH_RISK';
  }
  if (score >= 50) return 'RISKY';
  if (score >= 35) return 'MODERATE';
  if (raw === 'UNKNOWN') return 'UNKNOWN';
  return 'NEW_CUSTOMER';
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
    <span className={`inline-flex whitespace-nowrap items-center rounded-full border font-bold ${compact ? 'gap-1 px-2 py-0.5 text-[9px]' : 'gap-1.5 px-2.5 py-1 text-xs'} ${verdict.className}`}>
      <Icon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      {verdict.label}
    </span>
  );
}
