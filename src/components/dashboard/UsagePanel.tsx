import { AlertTriangle } from 'lucide-react';
import type { UserProfile } from '../../types';
import { Badge, Card, SectionTitle } from '../common';
import { QUOTA_BAR, QUOTA_TEXT, compactNumber, cycleResetLabel, formatQuotaLimit, isUnlimitedQuota, quotaTone, settlementNotice } from './dashboardUtils';

const METER_TRACK = 'mt-3 h-2 overflow-hidden rounded-full bg-[var(--bk-console-surface-muted)]';
const METER_LABEL = 'text-[11px] font-semibold text-[var(--bk-console-text-muted)]';
const METER_VALUE = 'mt-1 text-xl font-bold text-[var(--bk-console-text)]';

interface UsagePanelProps {
  profile: UserProfile;
  usagePercent: number;
  ordersUsed: number;
  orderQuota: number;
  orderPercent: number;
  setActivePage?: (page: string) => void;
  /** Lets the dashboard grid place the panel (e.g. spanning both columns). */
  className?: string;
}

export function UsagePanel({ profile, usagePercent, ordersUsed, orderQuota, orderPercent, setActivePage, className = '' }: UsagePanelProps) {
  const eventsTone = quotaTone(usagePercent);
  const ordersTone = orderQuota > 0 ? quotaTone(orderPercent) : 'ok';
  // The allowance runs on this merchant's own 30-day cycle, so the panel names
  // their reset date instead of implying a shared calendar month.
  const resetsOn = cycleResetLabel(profile);
  const settlement = settlementNotice(profile);

  return (
    <Card className={`min-w-0 ${className}`}>
      <SectionTitle
        title="Usage this cycle"
        detail={resetsOn ? `Current plan allowance · resets ${resetsOn}` : 'Current plan allowance'}
        action={<Badge tone="info">{profile.plan}</Badge>}
      />

      {settlement && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <strong className="block text-xs font-bold text-amber-900">{settlement.headline}</strong>
            <p className="mt-0.5 text-label leading-relaxed text-amber-900">{settlement.detail}</p>
            {/* 114×29 of ink, 134×49 of target. A pill this small inside a
                compact alert cannot grow to 44 without dominating the two lines
                above it, so the target grows and the button does not:
                `btn-touch-expand`'s -10px halo is sized for a 24px control and
                this one is 29, so it clears the rule with room to spare. Card
                is not `flush`, so nothing clips the halo. */}
            {setActivePage && (
              <button type="button" onClick={() => setActivePage('account')} className="btn-touch-expand mt-2 rounded-lg bg-amber-700 px-3 py-1.5 text-label font-bold text-white hover:bg-amber-800">
                Renew your plan
              </button>
            )}
          </div>
        </div>
      )}

      {eventsTone === 'exhausted' && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="min-w-0">
            <strong className="block text-xs font-bold text-rose-900">Event limit reached for this cycle</strong>
            <p className="mt-0.5 text-[11px] leading-relaxed text-rose-800">
              New events are being rejected until your quota resets{resetsOn ? ` on ${resetsOn}` : ''}. Upgrade your plan to resume tracking now.
            </p>
            {/* Same halo as the settlement button above, for the same reason —
                and it has to be the same, because both banners can be on screen
                at once and one 44px pill beside one 29px pill would read as a
                mistake. The two alerts are 16px apart with p-3 inside each, so
                the two -10px halos cannot reach each other. */}
            {setActivePage && (
              <button type="button" onClick={() => setActivePage('account')} className="btn-touch-expand mt-2 rounded-lg bg-rose-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-800">
                Upgrade your plan
              </button>
            )}
          </div>
        </div>
      )}

      {eventsTone === 'critical' && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            You have used {usagePercent.toFixed(0)}% of this cycle&apos;s events. Tracking stops once the limit is reached.
          </p>
        </div>
      )}

      {/* One meter above the other. The panel used to span both dashboard columns,
          where a single column left half the card empty; it now sits in the
          narrow column of the Overview's three-column grid, where side-by-side
          meters would squeeze "12.4k / 50k events" onto three wrapped lines. */}
      <div className="mt-6 grid gap-6">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div><span className={METER_LABEL}>Events usage</span><p className={METER_VALUE}>{compactNumber(profile.eventsUsed)} <span className="text-xs font-medium text-[var(--bk-console-text-subtle)]">/ {formatQuotaLimit(profile.eventsQuota)} events</span></p></div>
            {!isUnlimitedQuota(profile.eventsQuota) && <strong className={`text-sm ${QUOTA_TEXT[eventsTone]}`}>{usagePercent.toFixed(1)}%</strong>}
          </div>
          <div className={METER_TRACK}><div className={`h-full rounded-full ${QUOTA_BAR[eventsTone]}`} style={{ width: `${usagePercent}%` }} /></div>
        </div>
        <div>
          <div className="flex items-end justify-between gap-3">
            <div><span className={METER_LABEL}>Orders usage</span><p className={METER_VALUE}>{ordersUsed.toLocaleString()} <span className="text-xs font-medium text-[var(--bk-console-text-subtle)]">/ {formatQuotaLimit(orderQuota)} orders</span></p></div>
            {orderQuota > 0 && <strong className={`text-sm ${QUOTA_TEXT[ordersTone]}`}>{orderPercent.toFixed(1)}%</strong>}
          </div>
          <div className={METER_TRACK}><div className={`h-full rounded-full ${QUOTA_BAR[ordersTone]}`} style={{ width: `${orderPercent}%` }} /></div>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-[var(--bk-console-border)] pt-4">
        {/* The crown is decoration — `{profile.plan}` already names the plan — so
            it is hidden from screen readers rather than read out as "chess queen
            black". Its colour comes from the .text-amber-500 override in
            index.css (4.82:1). */}
        <span className="flex items-center gap-2 text-[11px] font-bold text-[var(--bk-console-blue)]"><span aria-hidden="true" className="text-amber-500">♛</span>{profile.plan}</span>
        {profile.isTrial && <span className="text-[11px] font-bold text-[var(--bk-console-blue)]">{profile.trialDaysRemaining || 0} days left</span>}
      </div>
    </Card>
  );
}
