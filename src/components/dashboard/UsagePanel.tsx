import type { UserProfile } from '../../types';
import { compactNumber, panelClass } from './dashboardUtils';

const METER_TRACK = 'mt-3 h-2 overflow-hidden rounded-full bg-slate-100';
const METER_BAR = 'h-full rounded-full bg-gradient-to-r from-[#285ac7] to-[#12b886]';
const METER_LABEL = 'text-xs font-semibold text-slate-500';
const METER_VALUE = 'mt-1 text-xl font-bold text-slate-950';
const METER_PERCENT = 'text-sm text-emerald-600';

interface UsagePanelProps {
  profile: UserProfile;
  usagePercent: number;
  ordersUsed: number;
  orderQuota: number;
  orderPercent: number;
}

export function UsagePanel({ profile, usagePercent, ordersUsed, orderQuota, orderPercent }: UsagePanelProps) {
  return (
    <section className={`${panelClass} p-5 xl:col-span-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Usage this month</h2>
          <p className="mt-1 text-xs text-slate-500">Current plan allowance</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{profile.plan}</span>
      </div>
      <div className="mt-6 space-y-6">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div><span className={METER_LABEL}>Events usage</span><p className={METER_VALUE}>{compactNumber(profile.eventsUsed)} <span className="text-xs font-medium text-slate-400">/ {compactNumber(profile.eventsQuota)} events</span></p></div>
            <strong className={METER_PERCENT}>{usagePercent.toFixed(1)}%</strong>
          </div>
          <div className={METER_TRACK}><div className={METER_BAR} style={{ width: `${usagePercent}%` }} /></div>
        </div>
        <div>
          <div className="flex items-end justify-between gap-3">
            <div><span className={METER_LABEL}>Orders usage</span><p className={METER_VALUE}>{ordersUsed.toLocaleString()} <span className="text-xs font-medium text-slate-400">/ {orderQuota ? compactNumber(orderQuota) : 'Unlimited'} orders</span></p></div>
            {orderQuota > 0 && <strong className={METER_PERCENT}>{orderPercent.toFixed(1)}%</strong>}
          </div>
          <div className={METER_TRACK}><div className={METER_BAR} style={{ width: `${orderPercent}%` }} /></div>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="flex items-center gap-2 text-xs font-bold text-blue-700"><span className="text-amber-500">♛</span>{profile.plan}</span>
        {profile.isTrial && <span className="text-xs font-bold text-blue-700">{profile.trialDaysRemaining || 0} days left</span>}
      </div>
    </section>
  );
}
