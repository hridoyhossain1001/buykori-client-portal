import { AlertTriangle } from 'lucide-react';
import type { UserProfile } from '../../types';
import { QUOTA_BAR, QUOTA_TEXT, compactNumber, formatQuotaLimit, isUnlimitedQuota, panelClass, quotaTone } from './dashboardUtils';

const METER_TRACK = 'mt-3 h-2 overflow-hidden rounded-full bg-slate-100';
const METER_LABEL = 'text-xs font-semibold text-slate-500';
const METER_VALUE = 'mt-1 text-xl font-bold text-slate-950';

interface UsagePanelProps {
  profile: UserProfile;
  usagePercent: number;
  ordersUsed: number;
  orderQuota: number;
  orderPercent: number;
  setActivePage?: (page: string) => void;
}

export function UsagePanel({ profile, usagePercent, ordersUsed, orderQuota, orderPercent, setActivePage }: UsagePanelProps) {
  const eventsTone = quotaTone(usagePercent);
  const ordersTone = orderQuota > 0 ? quotaTone(orderPercent) : 'ok';

  return (
    <section className={`${panelClass} p-5 xl:col-span-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Usage this month</h2>
          <p className="mt-1 text-xs text-slate-500">Current plan allowance</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{profile.plan}</span>
      </div>

      {eventsTone === 'exhausted' && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <strong className="block text-xs font-bold text-rose-900">Monthly event limit reached</strong>
            <p className="mt-0.5 text-[11px] leading-relaxed text-rose-800">
              New events are being rejected until your quota resets{profile.renewalDate ? ` on ${profile.renewalDate}` : ''}. Upgrade your plan to resume tracking now.
            </p>
            {setActivePage && (
              <button type="button" onClick={() => setActivePage('account')} className="mt-2 rounded-lg bg-rose-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-800">
                Upgrade plan
              </button>
            )}
          </div>
        </div>
      )}

      {eventsTone === 'critical' && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            You have used {usagePercent.toFixed(0)}% of this month&apos;s events. Tracking stops once the limit is reached.
          </p>
        </div>
      )}

      <div className="mt-6 space-y-6">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div><span className={METER_LABEL}>Events usage</span><p className={METER_VALUE}>{compactNumber(profile.eventsUsed)} <span className="text-xs font-medium text-slate-400">/ {formatQuotaLimit(profile.eventsQuota)} events</span></p></div>
            {!isUnlimitedQuota(profile.eventsQuota) && <strong className={`text-sm ${QUOTA_TEXT[eventsTone]}`}>{usagePercent.toFixed(1)}%</strong>}
          </div>
          {!isUnlimitedQuota(profile.eventsQuota) && <div className={METER_TRACK}><div className={`h-full rounded-full ${QUOTA_BAR[eventsTone]}`} style={{ width: `${usagePercent}%` }} /></div>}
        </div>
        <div>
          <div className="flex items-end justify-between gap-3">
            <div><span className={METER_LABEL}>Orders usage</span><p className={METER_VALUE}>{ordersUsed.toLocaleString()} <span className="text-xs font-medium text-slate-400">/ {formatQuotaLimit(orderQuota)} orders</span></p></div>
            {orderQuota > 0 && <strong className={`text-sm ${QUOTA_TEXT[ordersTone]}`}>{orderPercent.toFixed(1)}%</strong>}
          </div>
          {orderQuota > 0 && <div className={METER_TRACK}><div className={`h-full rounded-full ${QUOTA_BAR[ordersTone]}`} style={{ width: `${orderPercent}%` }} /></div>}
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="flex items-center gap-2 text-xs font-bold text-blue-700"><span className="text-amber-500">♛</span>{profile.plan}</span>
        {profile.isTrial && <span className="text-xs font-bold text-blue-700">{profile.trialDaysRemaining || 0} days left</span>}
      </div>
    </section>
  );
}
