import { Check, RotateCcw } from 'lucide-react';
import type { UserProfile } from '../../types';
import { growthPlanFeatures, scalePlanFeatures, type PlanTier } from './accountTypes';

interface PlanBillingSectionProps {
  profile: UserProfile;
  usagePercent: number;
  isGrowth: boolean;
  isScale: boolean;
  isAgency: boolean;
  isDemo: boolean;
  openPayment: (plan: PlanTier) => void;
  handleDemoReset: () => Promise<void>;
}

export function PlanBillingSection({
  profile,
  usagePercent,
  isGrowth,
  isScale,
  isAgency,
  isDemo,
  openPayment,
  handleDemoReset,
}: PlanBillingSectionProps) {
  return (
    <div className="order-1 space-y-5">
      <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current plan</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{profile.plan}</h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><Check className="h-3 w-3" /> Active</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{isScale ? 'BDT 2,499' : 'BDT 899'} / month · Renews {profile.renewalDate || 'not scheduled'} · Tracking protection fully enabled</p>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly usage</p>
            <span className="text-[10px] font-bold text-emerald-700">{usagePercent.toFixed(2)}% used</span>
          </div>
          <p className="mt-1 text-sm font-bold text-slate-900">{profile.eventsUsed.toLocaleString()} / {profile.eventsQuota.toLocaleString()} events</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${usagePercent}%` }} /></div>
          <p className="mt-1.5 text-[11px] text-slate-400">Resets {profile.renewalDate || 'at the end of the billing period'}</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { tier: 'growth' as const, label: 'Growth', subtitle: 'For a single store, up to 500,000 events / month', price: 'BDT 899', features: growthPlanFeatures.slice(0, 5), active: isGrowth, recommended: false },
          { tier: 'scale' as const, label: 'Scale', subtitle: 'For growing brands, up to 3 stores & 1M events / month', price: 'BDT 2,499', features: scalePlanFeatures.slice(0, 5), active: isScale, recommended: !isScale },
        ].map(plan => (
          <section key={plan.tier} className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${plan.recommended ? 'border-indigo-500' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">{plan.label}</h3>
              {plan.active && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Current plan</span>}
              {plan.recommended && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Recommended</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">{plan.subtitle}</p>
            <p className="mt-5 text-2xl font-bold text-slate-900">{plan.price} <span className="text-xs font-normal text-slate-500">/ month</span></p>
            <ul className="mt-5 flex-1 space-y-3">
              {plan.features.map(feature => <li key={feature} className="flex items-start gap-2 text-xs text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{feature}</span></li>)}
            </ul>
            <button type="button" disabled={plan.active || isAgency} onClick={() => openPayment(plan.tier)} className={`mt-6 min-h-10 w-full rounded-lg px-4 text-xs font-bold transition ${plan.active ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:cursor-not-allowed`}>
              {plan.active ? 'Your current plan' : isAgency ? 'Managed by support' : plan.tier === 'scale' ? 'Upgrade to Scale' : 'Choose Growth'}
            </button>
          </section>
        ))}
      </div>

      {/* Reset demo sandbox context values widget */}
      {isDemo && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3  ">
          <div>
            <h4 className="font-bold text-slate-800  text-xs uppercase tracking-wider">Demo Controls</h4>
            <p className="text-xs text-slate-400 ">Restore test values for demos</p>
          </div>

          <button
            onClick={handleDemoReset}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200    text-slate-800  rounded text-xs font-semibold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Demo Data
          </button>
        </div>
      )}
    </div>
  );
}

export default PlanBillingSection;
