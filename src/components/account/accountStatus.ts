import type { UserProfile } from '../../types';
import { formatQuotaLimit, quotaPercent } from '../dashboard/dashboardUtils';
import { PLAN_CATALOG, resolvePlanKey, type PaymentHistoryItem, type PlanKey } from './accountTypes';

export const paymentCategory = (status: string): 'paid' | 'cancelled' | 'expired' | 'other' => {
  if (['approved', 'matched', 'approved_overpaid'].includes(status)) return 'paid';
  if (['cancelled', 'rejected', 'failed'].includes(status)) return 'cancelled';
  if (status === 'expired') return 'expired';
  return 'other';
};

export const statusClasses = (paymentStatus: string) => {
  if (['approved', 'matched', 'approved_overpaid'].includes(paymentStatus)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['needs_review', 'ambiguous'].includes(paymentStatus)) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (paymentStatus === 'pending') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (['rejected', 'failed', 'underpaid'].includes(paymentStatus)) return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

export const statusLabel = (paymentStatus: string) => {
  if (['approved', 'matched'].includes(paymentStatus)) return 'Paid';
  if (paymentStatus === 'approved_overpaid') return 'Paid - refund available';
  if (['needs_review', 'ambiguous'].includes(paymentStatus)) return 'Under review';
  if (paymentStatus === 'underpaid') return 'Paid less than required';
  if (paymentStatus === 'overpaid') return 'Paid more than required';
  return paymentStatus.replaceAll('_', ' ');
};

export const downloadTextFile = (filename: string, content: string, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

/**
 * Plan & billing display state.
 *
 * The section used to render three claims that could contradict each other on
 * one screen: a renewal date that had already passed presented as upcoming, an
 * allowance the plan catalogue and /api/profile disagreed about, and an "Active"
 * plan header above a payment history with no successful payment in it. Each
 * claim is resolved here against the same inputs, so a claim the data cannot
 * support degrades to an explicit state instead of rendering a confident wrong
 * number, and no two sections can word the same fact differently.
 */
export type ClaimTone = 'ok' | 'attention' | 'unavailable';

export type PlanBillingContradiction = 'renewal_in_past' | 'entitlement_mismatch' | 'no_successful_payment';

export interface RenewalClaim {
  tone: ClaimTone;
  /** The date exactly as the profile stated it, never relabelled as upcoming. */
  date: string | null;
  /** Short value for a renewal field: the date, or why there is no date to show. */
  shortLabel: string;
  /** Whole days since the date passed; null unless the tone is 'attention'. */
  daysOverdue: number | null;
  note: string | null;
}

/** How the monthly allowance was resolved, so callers can pick honest copy. */
export type EntitlementReason = 'stated' | 'unlimited' | 'missing' | 'mismatch';

export interface EntitlementClaim {
  tone: 'ok' | 'unavailable';
  reason: EntitlementReason;
  /** The enforced ceiling, or null when no ceiling can be stated. */
  eventsQuota: number | null;
  /** The catalogue ceiling that applies to this account, when one is published. */
  publishedQuota: number | null;
  /** Meter denominator: "200K", "Unlimited" or "Unavailable". */
  limitLabel: string;
  /** Events consumed this period, already formatted. */
  usedLabel: string;
  /** 0-100 for the meter bar; null when no share of the allowance is known. */
  usagePercent: number | null;
  note: string | null;
}

export interface PlanStatusClaim {
  tone: 'ok' | 'attention';
  label: string;
  note: string | null;
}

export interface PlanBillingDisplay {
  planKey: PlanKey | null;
  /** Current-plan price line, taken from the catalogue. */
  monthlyPrice: string;
  /** Recurring charge shown beside the renewal date. */
  renewalPrice: string;
  renewal: RenewalClaim;
  entitlement: EntitlementClaim;
  status: PlanStatusClaim;
  contradictions: PlanBillingContradiction[];
}

export interface PlanBillingInput {
  profile: UserProfile;
  paymentHistory: readonly PaymentHistoryItem[];
  /**
   * True only once a payment history response has been read successfully. A
   * history that is still loading, or that failed to load, is not evidence that
   * an account never paid.
   */
  paymentHistoryReady: boolean;
  now: Date;
}

const DAY_MS = 86_400_000;
const HAS_TIME = /\d:\d/;
const MANAGED_BILLING_COPY = 'Custom billing';

/**
 * The instant a renewal date stops being upcoming.
 *
 * A day without a time of day ("2026-09-01", or the "September 01, 2026" the
 * profile API actually sends) parses as midnight, so comparing it directly
 * against now would report the renewal day itself as overdue from 00:00 onwards.
 * The whole calendar day is still upcoming, so the deadline is the end of it.
 * A value that does carry a time is an instant and is compared as given.
 */
export function renewalDeadlineMs(renewalDate: string | null | undefined): number | null {
  const raw = (renewalDate || '').trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return HAS_TIME.test(raw) ? parsed : parsed + DAY_MS;
}

/** True when the plan carries a recurring charge the merchant has to pay. */
function isBilledPlan(planKey: PlanKey | null): boolean {
  if (planKey === null) return false;
  const amount = PLAN_CATALOG[planKey].amount;
  return amount !== null && Number(amount) > 0;
}

export function resolveRenewalClaim(
  renewalDate: string | null | undefined,
  planKey: PlanKey | null,
  now: Date,
): RenewalClaim {
  const raw = (renewalDate || '').trim();
  if (!raw) {
    return { tone: 'ok', date: null, shortLabel: 'Not scheduled', daysOverdue: null, note: null };
  }
  const deadline = renewalDeadlineMs(raw);
  const nowMs = now.getTime();
  if (deadline === null || !Number.isFinite(nowMs)) {
    return {
      tone: 'unavailable',
      date: raw,
      shortLabel: 'Unavailable',
      daysOverdue: null,
      note: 'The renewal date could not be read, so the next charge cannot be confirmed. Contact support if billing looks wrong.',
    };
  }
  if (deadline > nowMs) {
    return { tone: 'ok', date: raw, shortLabel: raw, daysOverdue: null, note: null };
  }
  return {
    tone: 'attention',
    date: raw,
    shortLabel: 'Needs attention',
    daysOverdue: Math.floor((nowMs - deadline) / DAY_MS),
    note: isBilledPlan(planKey)
      ? `The renewal date ${raw} has already passed, so this is not an upcoming charge. A payment may be overdue or billing has not synced yet.`
      : `The reset date ${raw} has already passed, so the schedule shown has not been refreshed yet.`,
  };
}

export function resolveEntitlementClaim(profile: UserProfile, planKey: PlanKey | null): EntitlementClaim {
  const plan = planKey === null ? null : PLAN_CATALOG[planKey];
  // A trial deliberately runs on a smaller allowance than the plan it previews,
  // so the plan's published ceiling is not a second statement of this account's
  // allowance and must not be reconciled against it.
  const publishedQuota = profile.isTrial ? null : plan?.eventsQuota ?? null;
  const quota = Number(profile.eventsQuota);
  const used = Number(profile.eventsUsed);
  const usedLabel = Number.isFinite(used) ? Math.max(0, used).toLocaleString() : 'Unavailable';
  const base = { publishedQuota, usedLabel };

  if (!Number.isFinite(quota)) {
    return {
      ...base,
      tone: 'unavailable',
      reason: 'missing',
      eventsQuota: null,
      limitLabel: 'Unavailable',
      usagePercent: null,
      note: 'Your monthly allowance did not load, so usage cannot be measured against it. Refresh, or contact support if it stays empty.',
    };
  }
  if (quota <= 0) {
    // 0 is the backend's documented "no ceiling" sentinel for custom plans.
    // There is no competing number to reconcile, so nothing is degraded.
    return {
      ...base,
      tone: 'ok',
      reason: 'unlimited',
      eventsQuota: quota,
      limitLabel: formatQuotaLimit(quota),
      usagePercent: null,
      note: null,
    };
  }
  if (plan !== null && publishedQuota !== null && publishedQuota !== quota) {
    // Two sources state the same allowance and disagree. Neither can be shown as
    // the entitlement, so the meter loses its denominator instead of picking one.
    return {
      ...base,
      tone: 'unavailable',
      reason: 'mismatch',
      eventsQuota: null,
      limitLabel: 'Unavailable',
      usagePercent: null,
      note: `Your account is provisioned for ${formatQuotaLimit(quota)} monthly events while the ${plan.planName} publishes ${formatQuotaLimit(publishedQuota)}. Support has to confirm which allowance applies before it is shown here.`,
    };
  }
  return {
    ...base,
    tone: 'ok',
    reason: 'stated',
    eventsQuota: quota,
    limitLabel: formatQuotaLimit(quota),
    usagePercent: quotaPercent(used, quota),
    note: null,
  };
}

export function resolvePlanStatusClaim(
  profile: UserProfile,
  paymentHistory: readonly PaymentHistoryItem[],
  paymentHistoryReady: boolean,
  planKey: PlanKey | null,
): PlanStatusClaim {
  if (profile.isTrial) {
    return { tone: 'ok', label: `14-day trial · ${Math.max(0, profile.trialDaysRemaining || 0)} days left`, note: null };
  }
  // A free plan needs no payment, and an unrecognised label may be a negotiated
  // plan settled off-portal, so neither can be accused of being unpaid.
  if (!isBilledPlan(planKey) || !paymentHistoryReady) {
    return { tone: 'ok', label: 'Active', note: null };
  }
  const paidCount = paymentHistory.filter(payment => paymentCategory(payment.status) === 'paid').length;
  if (paidCount > 0) {
    return { tone: 'ok', label: 'Active', note: null };
  }
  return {
    tone: 'attention',
    label: 'Activation unverified',
    note: 'This plan is billed monthly but no successful payment is on record, so it cannot be confirmed as active. Check your payment history below.',
  };
}

export function resolvePlanBillingDisplay({
  profile,
  paymentHistory,
  paymentHistoryReady,
  now,
}: PlanBillingInput): PlanBillingDisplay {
  const planKey = resolvePlanKey(profile.plan);
  const plan = planKey === null ? null : PLAN_CATALOG[planKey];
  const renewal = resolveRenewalClaim(profile.renewalDate, planKey, now);
  const entitlement = resolveEntitlementClaim(profile, planKey);
  const status = resolvePlanStatusClaim(profile, paymentHistory, paymentHistoryReady, planKey);
  const contradictions: PlanBillingContradiction[] = [];
  if (renewal.tone === 'attention') contradictions.push('renewal_in_past');
  if (entitlement.reason === 'mismatch') contradictions.push('entitlement_mismatch');
  if (status.tone === 'attention') contradictions.push('no_successful_payment');

  return {
    planKey,
    monthlyPrice: plan?.monthlyPrice ?? MANAGED_BILLING_COPY,
    renewalPrice: plan?.renewalPrice ?? MANAGED_BILLING_COPY,
    renewal,
    entitlement,
    status,
    contradictions,
  };
}

/** Every degraded claim's explanation, in the order the section renders them. */
export function planBillingNotes(display: PlanBillingDisplay): string[] {
  return [display.status.note, display.entitlement.note, display.renewal.note]
    .filter((note): note is string => Boolean(note));
}
