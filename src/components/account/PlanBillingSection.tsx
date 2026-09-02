import { AlertTriangle, Check } from 'lucide-react';
import type { UserProfile } from '../../types';
import { PLAN_CATALOG, type PlanTier } from './accountTypes';
import { planBillingNotes, type PlanBillingDisplay } from './accountStatus';

interface PlanBillingSectionProps {
  profile: UserProfile;
  billing: PlanBillingDisplay;
  isFree: boolean;
  isStarter: boolean;
  isGrowth: boolean;
  isPro: boolean;
  isAgency: boolean;
  openPayment: (plan: PlanTier) => void;
}

export function PlanBillingSection({
  profile,
  billing,
  isFree,
  isStarter,
  isGrowth,
  isPro,
  isAgency,
  openPayment,
}: PlanBillingSectionProps) {
  const currentRank = isAgency ? 4 : isPro ? 3 : isGrowth ? 2 : isStarter ? 1 : 0;
  const trialDays = Math.max(0, profile.trialDaysRemaining || 0);
  const { entitlement, renewal, status } = billing;
  const attentionNotes = planBillingNotes(billing);
  // A trial is priced as the trial, not as the plan it will become.
  const currentPrice = profile.isTrial && isStarter ? '14-day Starter trial' : billing.monthlyPrice;

  const plans = [
    { tier: null, plan: PLAN_CATALOG.free, features: PLAN_CATALOG.free.features, active: isFree, recommended: false },
    {
      tier: 'starter' as const,
      plan: PLAN_CATALOG.starter,
      features: PLAN_CATALOG.starter.features.slice(0, 5),
      active: isStarter,
      recommended: !isStarter && !isGrowth && !isPro && !isAgency,
    },
    { tier: 'growth' as const, plan: PLAN_CATALOG.growth, features: PLAN_CATALOG.growth.features, active: isGrowth, recommended: false },
    { tier: null, plan: PLAN_CATALOG.pro, features: PLAN_CATALOG.pro.features, active: isPro, recommended: false },
  ];

  return (
    <div className="order-1 space-y-5">
      {attentionNotes.length > 0 && (
        <section className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm" role="status" aria-labelledby="billing-attention-heading">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <strong id="billing-attention-heading" className="block text-xs font-bold text-amber-900">Some billing details need attention</strong>
            <ul className="mt-1.5 space-y-1.5 text-[11px] leading-relaxed text-amber-800">
              {attentionNotes.map(note => <li key={note}>{note}</li>)}
            </ul>
          </div>
        </section>
      )}

      <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current plan</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{profile.plan}</h2>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{status.tone === 'ok' ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />} {status.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{currentPrice} · {renewal.tone === 'ok' && renewal.date ? `Renews ${renewal.date}` : `Renewal: ${renewal.shortLabel}`}</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly usage</p>
            <span className={`text-[10px] font-bold ${entitlement.tone === 'ok' ? 'text-emerald-700' : 'text-amber-700'}`}>{entitlement.usagePercent === null ? (entitlement.reason === 'unlimited' ? 'Unlimited' : 'Allowance unavailable') : `${entitlement.usagePercent.toFixed(2)}% used`}</span>
          </div>
          <p className="mt-1 text-sm font-bold text-slate-900">{entitlement.usedLabel} {entitlement.eventsQuota === null ? 'events used' : `/ ${entitlement.limitLabel} events`}</p>
          {entitlement.eventsQuota !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${entitlement.usagePercent ?? 0}%` }} /></div>}
          <p className="mt-1.5 text-[11px] text-slate-400">{renewal.tone === 'ok' ? (renewal.date ? `Resets ${renewal.date}` : 'Resets at the end of the billing period') : 'Reset date needs attention'}</p>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map(({ tier, plan, features, active, recommended }) => (
          <section key={plan.key} className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${recommended ? 'border-indigo-500' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{plan.label}</h3>
              {active && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Current plan</span>}
              {active && tier === 'starter' && profile.isTrial && <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">14-day trial · {trialDays} days left</span>}
              {recommended && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Recommended</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">{plan.subtitle}</p>
            <p className="mt-5 text-2xl font-bold text-slate-900">{plan.cardPrice}{plan.amount !== null && <span className="text-xs font-normal text-slate-500"> / month</span>}</p>
            <ul className="mt-5 flex-1 space-y-3">
              {features.map(feature => <li key={feature} className="flex items-start gap-2 text-xs text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{feature}</span></li>)}
            </ul>
            {plan.amount === null ? (
              <a href="mailto:support@buykori.app?subject=Buykori%20Pro%20Plan" className="mt-6 flex min-h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white transition hover:bg-indigo-700">{active ? 'Your current plan' : 'Contact support'}</a>
            ) : tier ? (
              <button
                type="button"
                disabled={active || isAgency || (tier === 'starter' && currentRank > 1)}
                onClick={() => openPayment(tier)}
                className={`mt-6 min-h-11 w-full rounded-lg px-4 text-xs font-bold transition ${active || (tier === 'starter' && currentRank > 1) ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:cursor-not-allowed`}
              >
                {active
                  ? 'Your current plan'
                  : isAgency
                    ? 'Managed by support'
                    : tier === 'starter' && currentRank > 1
                      ? 'Included in current plan'
                      : isStarter && tier === 'growth'
                        ? 'Upgrade your plan'
                        : `Choose ${plan.label}`}
              </button>
            ) : (
              <button type="button" disabled className="mt-6 min-h-11 w-full cursor-not-allowed rounded-lg bg-slate-100 px-4 text-xs font-bold text-slate-400">{active ? 'Your current plan' : 'Included at signup'}</button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export default PlanBillingSection;
