import { CheckCircle2, Flag, WalletCards } from 'lucide-react';
import type { UserProfile } from '../../types';
import { PlatformLogo } from '../common/PlatformLogo';
import { CHART_GRID, SERIES_BLUE } from '../../lib/chartColors';
import { PLATFORM_HEALTH_PILL, QUOTA_BAR, compactNumber, eventContext, formatQuotaLimit, platformHealth, quotaTone, relativeEventTime, settlementNotice, shortPlatformName } from './dashboardUtils';
import { StatusIcon } from '../eventLogs/eventLogBadges';
import { statusStyles } from '../eventLogs/eventLogUtils';
import type { useDashboardMetrics } from './useDashboardMetrics';

const CARD = 'rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,0.03)]';
const SECTION_TITLE = 'text-[13px] font-bold text-slate-800';
const SECTION_LINK = 'inline-flex min-h-11 items-center px-1 text-[10px] font-bold text-indigo-600';
const METER_TRACK = 'mt-1.5 h-[5px] overflow-hidden rounded-full bg-slate-100';
// The settlement and quota banners stack on the same card, so they share one type
// pairing — naming it is what keeps the second one from drifting off the first.
const BANNER_HEADLINE = 'block text-label font-bold';
const BANNER_DETAIL = 'mt-0.5 text-[10px] leading-relaxed';

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
  const platformHealthRows = platformRows.map(row => ({ row, health: platformHealth(row.total, row.rate) }));
  const healthyPlatformCount = platformHealthRows.filter(item => item.health.tone === 'healthy').length;
  const hasPlatformAttempts = platformRows.some(row => row.total > 0);
  const workspaceStatusTitle = hasDeliveryIssue
    ? 'Tracking needs attention'
    : hasPlatformAttempts
      ? `${healthyPlatformCount} of ${platformRows.length} destinations healthy`
      : 'Tracking is waiting for data';
  const workspaceStatusHelp = hasDeliveryIssue
    ? 'Review delivery errors before running your next campaign.'
    : hasPlatformAttempts
      ? 'Your latest platform delivery status is shown below.'
      : 'Platform activity will appear after the first event arrives.';
  // A merchant on a phone must not be the only one who never hears that their
  // paid period has ended and the settlement window is running.
  const settlement = settlementNotice(profile);

  return (
    <div className="space-y-3 md:hidden">
      <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.03)]">
        <div className="flex items-start gap-3 p-4">
          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${hasDeliveryIssue ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase text-slate-400">Workspace overview</p>
            <h2 className="mt-1 text-sm font-bold text-slate-900">{workspaceStatusTitle}</h2>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">{workspaceStatusHelp}</p>
          </div>
        </div>

        {settlement && (
          <div className="border-t border-amber-300 bg-amber-50 px-4 py-3" role="alert">
            <strong className={`${BANNER_HEADLINE} text-amber-900`}>{settlement.headline}</strong>
            <p className={`${BANNER_DETAIL} text-amber-900`}>{settlement.detail}</p>
          </div>
        )}

        {quotaTone(usagePercent) === 'exhausted' && (
          <div className="border-t border-rose-200 bg-rose-50 px-4 py-3" role="alert">
            <strong className={`${BANNER_HEADLINE} text-rose-900`}>Event limit reached</strong>
            <p className={`${BANNER_DETAIL} text-rose-800`}>New events are being rejected. Upgrade to resume tracking.</p>
          </div>
        )}

        <div className="grid grid-cols-2 border-y border-slate-100">
          <div className="min-w-0 border-r border-slate-100 px-4 py-3.5">
            <span className="block text-[10px] font-semibold text-slate-500">Events this cycle</span>
            <strong className="mt-1 block truncate text-lg font-black text-slate-900">{compactNumber(profile.eventsUsed)}</strong>
            <span className="block truncate text-[10px] text-slate-400">of {formatQuotaLimit(profile.eventsQuota)}</span>
            <div className={METER_TRACK}>
              <div className={`h-full rounded-full ${QUOTA_BAR[quotaTone(usagePercent)]}`} style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
          <div className="min-w-0 px-4 py-3.5">
            <span className="block text-[10px] font-semibold text-slate-500">Orders this cycle</span>
            <strong className="mt-1 block truncate text-lg font-black text-slate-900">{compactNumber(ordersUsed)}</strong>
            <span className="block truncate text-[10px] text-slate-400">of {formatQuotaLimit(orderQuota)}</span>
            <div className={METER_TRACK}>
              <div className={`h-full rounded-full ${orderQuota > 0 ? QUOTA_BAR[quotaTone(orderPercent)] : QUOTA_BAR.ok}`} style={{ width: `${orderPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-slate-100">
          <button onClick={() => setActivePage('pending-purchases')} className="flex min-h-14 min-w-0 items-center gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
              <Flag className="h-4 w-4" fill="currentColor" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-[11px] text-slate-800">COD review</strong>
              <span className="mt-0.5 block truncate text-[10px] text-slate-500">{pendingOrderCount} pending</span>
            </span>
          </button>
          <button onClick={() => setActivePage('account')} className="flex min-h-14 min-w-0 items-center gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <WalletCards className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-[11px] text-slate-800">Plan & billing</strong>
              <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                {renewalIsValid ? `Renews ${renewalDate!.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '30-day plan'}
                {daysUntilRenewal !== null ? ` · ${daysUntilRenewal}d` : ''}
              </span>
            </span>
          </button>
        </div>
      </section>

      <section className={CARD}>
        <div className="flex items-center justify-between">
          <h2 className={SECTION_TITLE}>Tracking health</h2>
          <button onClick={() => setActivePage('settings')} className={SECTION_LINK}>Manage</button>
        </div>
        <div className="mt-1">
          {platformHealthRows.map(({ row, health }, index) => {
            // Clipped at 360px with no way to recover the text (contract §6 D6).
            // The line is built once so the visible text and the hover text
            // cannot drift apart.
            const syncLine = `${row.total.toLocaleString()} events · ${health.label.toLowerCase()} · synced ${row.lastTime || 'waiting'}`;
            return (
              <button
                key={row.label}
                onClick={() => setActivePage('event-logs')}
                className={`flex w-full items-center gap-2.5 py-2.5 text-left ${index > 0 ? 'border-t border-slate-100' : ''}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                  <PlatformLogo platform={row.platform} className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[12px] leading-none text-slate-800">{row.label}</strong>
                  <span className="mt-1 block truncate text-[10px] leading-none text-slate-400" title={syncLine}>
                    {syncLine}
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
                {/* One glyph per state, using the pair the desktop log rows already
                    use (`DeliveryBadge`). This cell drew CheckCircle2 for every
                    status, so a failed event showed a tick in a red ring and colour
                    was the only thing separating "sent" from "lost". The old ternary
                    also had no arm for `Skipped` or `Fired` and painted both rose —
                    `Fired` is the browser pixel reporting for itself, not a failure.
                    `statusStyles` covers all six states; it carries border colours,
                    so the ring is drawn with `border` rather than left dead. The
                    circle is this row's only statement of the state, so the word goes
                    into the button's accessible name instead of nowhere. */}
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${statusStyles(event.status)}`}>
                  <StatusIcon status={event.status} />
                  <span className="sr-only">{event.status}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[12px] leading-none text-slate-800">{event.name} · {eventContext(event)}</strong>
                  <span className="mt-1 block text-[10px] leading-none text-slate-400">{relativeEventTime(event.timestamp)}</span>
                </span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-[9px] font-semibold text-slate-500">
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
          <span className="text-[10px] font-bold text-slate-500">{deliveryRate === null ? 'No attempts' : `${deliveryRate}% delivered`}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 rounded-lg bg-slate-100 p-1 text-center text-[10px] font-bold text-slate-500">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setAnalyticsDays(days)}
              className={`min-h-11 rounded-md px-2 transition ${analyticsDays === days ? 'bg-white text-slate-800 shadow-sm' : ''}`}
            >
              {days} days
            </button>
          ))}
        </div>
        <div className="mt-3 h-[116px]">
          {chartData.length > 0 ? (
            <>
              <svg className="h-[90px] w-full" viewBox="0 0 320 86" preserveAspectRatio="none" role="img" aria-label={deliveryRate === null ? 'Event delivery rate: no attempts yet' : `${deliveryRate}% event delivery rate`}>
                <defs>
                  <linearGradient id="mobileDeliveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SERIES_BLUE} stopOpacity=".25" />
                    <stop offset="100%" stopColor={SERIES_BLUE} stopOpacity=".03" />
                  </linearGradient>
                </defs>
                {[18, 43, 68].map(y => <line key={y} x1="0" x2="320" y1={y} y2={y} stroke={CHART_GRID} />)}
                <path d={deliveryChart.area} fill="url(#mobileDeliveryGradient)" />
                <path d={deliveryChart.line} fill="none" stroke={SERIES_BLUE} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
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
