import { Check } from 'lucide-react';
import type { UserProfile } from '../../types';
import { formatQuotaLimit, isUnlimitedQuota } from '../dashboard/dashboardUtils';
import {
  freePlanFeatures,
  growthPlanFeatures,
  proPlanFeatures,
  starterPlanFeatures,
  type PlanTier,
} from './accountTypes';

interface PlanBillingSectionProps {
  profile: UserProfile;
  usagePercent: number;
  isFree: boolean;
  isStarter: boolean;
  isGrowth: boolean;
  isPro: boolean;
  isAgency: boolean;
  openPayment: (plan: PlanTier) => void;
}

export function PlanBillingSection({
  profile,
  usagePercent,
  isFree,
  isStarter,
  isGrowth,
  isPro,
  isAgency,
  openPayment,
}: PlanBillingSectionProps) {
  const currentPrice = isFree
    ? 'Free'
    : isStarter
      ? 'BDT 499 / month'
      : isGrowth
        ? 'BDT 799 / month'
        : isPro
          ? 'Custom billing'
          : 'Managed billing';

  const plans = [
    {
      tier: null,
      label: 'Free',
      subtitle: 'Try Meta server-side tracking',
      price: 'BDT 0',
      features: freePlanFeatures,
      active: isFree,
      recommended: false,
      contact: false,
    },
    {
      tier: 'starter' as const,
      label: 'Starter',
      subtitle: 'A complete toolkit for one small store',
      price: 'BDT 499',
      features: starterPlanFeatures.slice(0, 5),
      active: isStarter,
      recommended: !isStarter && !isGrowth && !isPro && !isAgency,
      contact: false,
    },
    {
      tier: 'growth' as const,
      label: 'Growth',
      subtitle: 'More capacity for a growing store',
      price: 'BDT 799',
      features: growthPlanFeatures,
      active: isGrowth,
      recommended: false,
      contact: false,
    },
    {
      tier: null,
      label: 'Pro',
      subtitle: 'Up to 3 independent store workspaces',
      price: 'Contact us',
      features: proPlanFeatures,
      active: isPro,
      recommended: false,
      contact: true,
    },
  ];

  return (
    <div className="order-1 space-y-5">
      <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current plan</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{profile.plan}</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><Check className="h-3 w-3" /> Active</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{currentPrice} · Renews {profile.renewalDate || 'not scheduled'}</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly usage</p>
            <span className="text-[10px] font-bold text-emerald-700">{isUnlimitedQuota(profile.eventsQuota) ? 'Unlimited' : `${usagePercent.toFixed(2)}% used`}</span>
          </div>
          <p className="mt-1 text-sm font-bold text-slate-900">{profile.eventsUsed.toLocaleString()} / {formatQuotaLimit(profile.eventsQuota)} events</p>
          {!isUnlimitedQuota(profile.eventsQuota) && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${usagePercent}%` }} /></div>}
          <p className="mt-1.5 text-[11px] text-slate-400">Resets {profile.renewalDate || 'at the end of the billing period'}</p>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {plans.map(plan => (
          <section key={plan.label} className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${plan.recommended ? 'border-indigo-500' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{plan.label}</h3>
              {plan.active && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Current plan</span>}
              {plan.recommended && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Recommended</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">{plan.subtitle}</p>
            <p className="mt-5 text-2xl font-bold text-slate-900">{plan.price}{!plan.contact && <span className="text-xs font-normal text-slate-500"> / month</span>}</p>
            <ul className="mt-5 flex-1 space-y-3">
              {plan.features.map(feature => <li key={feature} className="flex items-start gap-2 text-xs text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{feature}</span></li>)}
            </ul>
            {plan.contact ? (
              <a href="mailto:support@buykori.app?subject=Buykori%20Pro%20Plan" className="mt-6 flex min-h-10 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white transition hover:bg-indigo-700">{plan.active ? 'Your current plan' : 'Contact support'}</a>
            ) : plan.tier ? (
              <button type="button" disabled={plan.active || isAgency} onClick={() => openPayment(plan.tier)} className={`mt-6 min-h-10 w-full rounded-lg px-4 text-xs font-bold transition ${plan.active ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:cursor-not-allowed`}>
                {plan.active ? 'Your current plan' : isAgency ? 'Managed by support' : `Choose ${plan.label}`}
              </button>
            ) : (
              <button type="button" disabled className="mt-6 min-h-10 w-full cursor-not-allowed rounded-lg bg-slate-100 px-4 text-xs font-bold text-slate-400">{plan.active ? 'Your current plan' : 'Included at signup'}</button>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export default PlanBillingSection;
