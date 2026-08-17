import { CheckCircle2, Flag } from 'lucide-react';
import type { UserProfile } from '../../types';
import { PlatformLogo } from '../common/PlatformLogo';
import { PLATFORM_HEALTH_PILL, QUOTA_BAR, compactNumber, eventContext, formatQuotaLimit, isUnlimitedQuota, platformHealth, quotaTone, relativeEventTime, shortPlatformName } from './dashboardUtils';
import type { useDashboardMetrics } from './useDashboardMetrics';

const CARD = 'rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.03)]';
const SECTION_TITLE = 'text-[13px] font-bold text-slate-800';
const SECTION_LINK = 'text-[10px] font-bold text-[#2375d8]';
const METER_TRACK = 'mt-1.5 h-[5px] overflow-hidden rounded-full bg-slate-100';

interface MobileDashboardProps {
  profile: UserProfile;
  metrics: ReturnType<typeof useDashboardMetrics>;
  setActivePage: (page: string) => void;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  pendingOrderCount: number;
}

export function MobileDashboard({
  profile,
  metrics,
  setActivePage,
  analyticsDays,
  setAnalyticsDays,
  pendingOrderCount,
}: MobileDashboardProps) {
  const {
    usagePercent,
    ordersUsed,
    orderQuota,
    orderPercent,
    renewalDate,
    renewalIsValid,
    daysUntilRenewal,
    hasDeliveryIssue,
    platformRows,
    mobileRecentEvents,
    chartData,
    deliveryChart,
    deliveryRate,
    firstTrendLabel,
    middleTrendLabel,
    lastTrendLabel,
  } = metrics;
  const quotaExhausted = quotaTone(usagePercent) === 'exhausted'
    || (orderQuota > 0 && quotaTone(orderPercent) === 'exhausted');

  return (
    <div className="space-y-3 md:hidden">
      <section className={CARD}>
        {quotaExhausted && (
          <div className="mb-2.5 rounded-lg border border-rose-200 bg-rose-50 p-2.5" role="alert">
            <strong className="block text-[11px] font-bold text-rose-900">Monthly usage limit reached</strong>
            <p className="mt-0.5 text-[10px] leading-relaxed text-rose-800">Your plan allowance is exhausted. Upgrade your plan to continue now.</p>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-500">Events this month</span>
            <strong className="text-slate-800">{compactNumber(profile.eventsUsed)} <span className="font-medium text-slate-400">/ {formatQuotaLimit(profile.eventsQuota)}</span></strong>
          </div>
          {!isUnlimitedQuota(profile.eventsQuota) && <div className={METER_TRACK}>
            <div className={`h-full rounded-full ${QUOTA_BAR[quotaTone(usagePercent)]}`} style={{ width: `${usagePercent}%` }} />
          </div>}
        </div>
        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-500">Orders this month</span>
            <strong className="text-slate-800">{compactNumber(ordersUsed)} <span className="font-medium text-slate-400">/ {formatQuotaLimit(orderQuota)}</span></strong>
          </div>
          {orderQuota > 0 && <div className={METER_TRACK}>
            <div className={`h-full rounded-full ${QUOTA_BAR[quotaTone(orderPercent)]}`} style={{ width: `${orderPercent}%` }} />
          </div>}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-500">
            {renewalIsValid ? `Resets ${renewalDate!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'Monthly plan'}
            {daysUntilRenewal !== null ? ` · ${daysUntilRenewal}d left` : ''}
          </span>
          <button onClick={() => setActivePage('account')} className="font-bold text-[#2375d8]">Upgrade your plan</button>
        </div>
      </section>

      <div className="grid grid-cols-3 rounded-xl bg-stone-100 p-1 text-center text-[11px] font-bold text-stone-500">
        {[7, 30, 90].map(days => (
          <button
            key={days}
            type="button"
            onClick={() => setAnalyticsDays(days)}
            className={`rounded-lg px-2 py-2 transition ${analyticsDays === days ? 'bg-white text-slate-800 shadow-sm' : ''}`}
          >
            {days} days
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.03)]">
        <button onClick={() => setActivePage('pending-purchases')} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
            <Flag className="h-4 w-4" fill="currentColor" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-[13px] text-slate-800">
              {pendingOrderCount > 0 ? `${pendingOrderCount} COD ${pendingOrderCount === 1 ? 'order needs' : 'orders need'} review` : 'COD review queue is clear'}
            </strong>
            <span className="mt-0.5 block truncate text-[10px] text-slate-500">Confirm or skip pending events</span>
          </span>
          <span className="rounded-lg bg-[#2f80df] px-3 py-2 text-[11px] font-bold text-white">Review</span>
        </button>
        <button onClick={() => setActivePage('settings')} className="flex w-full items-center gap-3 border-t border-slate-100 px-3.5 py-3 text-left">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 text-[12px] font-bold text-slate-800">
            {hasDeliveryIssue ? 'Tracking needs attention' : 'Setup & tracking healthy'}
          </span>
          <span className="text-[10px] font-bold text-[#2375d8]">View</span>
        </button>
      </section>

      <section className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className={SECTION_TITLE}>Tracking health</h2>
          <button onClick={() => setActivePage('settings')} className={SECTION_LINK}>Manage</button>
        </div>
        <div className="mt-1">
          {platformRows.map((row, index) => {
            const health = platformHealth(row.total, row.rate);
            return (
              <button
                key={row.label}
                onClick={() => setActivePage('event-logs')}
                className={`flex w-full items-center gap-2.5 py-2.5 text-left ${index > 0 ? 'border-t border-slate-100' : ''}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                  <PlatformLogo platform={row.platform} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[12px] leading-none text-slate-800">{row.label}</strong>
                  <span className="mt-1 block truncate text-[10px] leading-none text-slate-400">
                    {row.total.toLocaleString()} events · {health.label.toLowerCase()} · synced {row.lastTime || 'waiting'}
                  </span>
                </span>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${PLATFORM_HEALTH_PILL[health.tone]}`}>
                  {health.display}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className={SECTION_TITLE}>Recent activity</h2>
          <button onClick={() => setActivePage('event-logs')} className={SECTION_LINK}>View all</button>
        </div>
        {mobileRecentEvents.length > 0 ? (
          <div className="mt-1">
            {mobileRecentEvents.map((event, index) => (
              <button
                key={event.id}
                onClick={() => setActivePage('event-logs')}
                className={`flex w-full items-center gap-2.5 py-2.5 text-left ${index > 0 ? 'border-t border-slate-100' : ''}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  event.status === 'Success' ? 'bg-emerald-50 text-emerald-500' : event.status === 'Retry' ? 'bg-amber-50 text-amber-500' : 'bg-rose-50 text-rose-500'
                }`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[12px] leading-none text-slate-800">{event.name} · {eventContext(event)}</strong>
                  <span className="mt-1 block text-[10px] leading-none text-slate-400">{relativeEventTime(event.timestamp)}</span>
                </span>
                <span className="rounded-md border border-slate-200 bg-stone-50 px-1.5 py-1 text-[9px] font-semibold text-slate-500">
                  {shortPlatformName(event.platform)}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="py-5 text-center text-[11px] text-slate-400">Recent events will appear here.</p>
        )}
      </section>

      <section className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className={SECTION_TITLE}>Event delivery</h2>
          <span className={SECTION_LINK}>Last {analyticsDays} days</span>
        </div>
        <div className="mt-3 h-[116px]">
          {chartData.length > 0 ? (
            <>
              <svg className="h-[90px] w-full" viewBox="0 0 320 86" preserveAspectRatio="none" role="img" aria-label={deliveryRate === null ? 'Event delivery rate: no attempts yet' : `${deliveryRate}% event delivery rate`}>
                <defs>
                  <linearGradient id="mobileDeliveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2f80df" stopOpacity=".25" />
                    <stop offset="100%" stopColor="#2f80df" stopOpacity=".03" />
                  </linearGradient>
                </defs>
                {[18, 43, 68].map(y => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="#edf1f6" />)}
                <path d={deliveryChart.area} fill="url(#mobileDeliveryGradient)" />
                <path d={deliveryChart.line} fill="none" stroke="#2580e8" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>{firstTrendLabel}</span>
                <span>{middleTrendLabel}</span>
                <span>{lastTrendLabel}</span>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-slate-400">Waiting for delivery data</div>
          )}
        </div>
      </section>
    </div>
  );
}
