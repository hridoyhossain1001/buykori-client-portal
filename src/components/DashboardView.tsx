import { useState } from 'react';
import { Activity, ClipboardList, Link2, RefreshCw, ShieldCheck } from 'lucide-react';
import { CAPIEvent, RecoverySummary, TrendPoint, UserProfile } from '../types';
import { Button, PageHeader } from './common';
import { ActionStrip } from './dashboard/ActionStrip';
import { DeliveryIssueAlert, GettingStartedPanel } from './dashboard/DashboardAlerts';
import { DeliveryPanel } from './dashboard/DeliveryPanel';
import { EventActivityChart } from './dashboard/EventActivityChart';
import { KpiCards } from './dashboard/KpiCards';
import { MobileDashboard } from './dashboard/MobileDashboard';
import { RecentActivityTable } from './dashboard/RecentActivityTable';
import { TrackingHealthPanel } from './dashboard/TrackingHealthPanel';
import { UsagePanel } from './dashboard/UsagePanel';
import { compactNumber, formatQuotaLimit, isUnlimitedQuota } from './dashboard/dashboardUtils';
import { useDashboardMetrics } from './dashboard/useDashboardMetrics';

interface DashboardViewProps {
  profile: UserProfile;
  events: CAPIEvent[];
  trendData: TrendPoint[];
  recoverySummary: RecoverySummary | null;
  metaStats: { total: number; rate: number | null; lastTime: string };
  tiktokStats: { total: number; rate: number | null; lastTime: string };
  ga4Stats: { total: number; rate: number | null; lastTime: string };
  optScore: number;
  resolvedCount: number;
  totalSuggCount: number;
  setActivePage: (page: string) => void;
  expandedEventId: string | null;
  setExpandedEventId: (id: string | null) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  pendingOrderCount?: number;
  /**
   * Re-reads the workspace. Read-only: the caller re-runs its own GETs, so the
   * button never writes anything. Optional so the view still renders without it.
   */
  onRefresh?: () => void | Promise<void>;
}

/**
 * The dashboard, in the approved Overview layout: a page heading with one
 * primary action, four headline cards, a one-line "needs you today" strip, then
 * a three-column panel grid where a wide panel spans two columns.
 *
 * Everything the live portal knows that the mockup's fixture did not — the
 * plan's usage meters, the recent-event table, the delivery-failure alert and
 * the first-run guide — stays, in the same panel language rather than being
 * dropped to match a mock. The numbers are the live ones throughout; nothing on
 * this page is a placeholder, which is also why the mockup's "Top products"
 * panel is absent: no product data reaches this page (see useDashboardMetrics),
 * and inventing one would be the only fake number here.
 *
 * `MobileDashboard` below md is unchanged and is its own layout.
 */
export function DashboardView({
  profile,
  events,
  trendData,
  recoverySummary,
  metaStats,
  tiktokStats,
  ga4Stats,
  optScore,
  resolvedCount,
  totalSuggCount,
  setActivePage,
  analyticsDays,
  setAnalyticsDays,
  pendingOrderCount = 0,
  onRefresh,
}: DashboardViewProps) {
  const metrics = useDashboardMetrics({
    profile,
    events,
    trendData,
    recoverySummary,
    metaStats,
    tiktokStats,
    ga4Stats,
    resolvedCount,
    totalSuggCount,
  });
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const eventsHint = isUnlimitedQuota(profile.eventsQuota)
    ? 'Unlimited events on this plan'
    : `${metrics.usagePercent.toFixed(1)}% of ${formatQuotaLimit(profile.eventsQuota)} included`;

  const healthHint = metrics.openSuggestions === 0
    ? `All ${totalSuggCount} setup checks pass`
    : `${metrics.openSuggestions} of ${totalSuggCount} setup checks need attention`;

  return (
    <div>
      <MobileDashboard
        profile={profile}
        metrics={metrics}
        setActivePage={setActivePage}
        analyticsDays={analyticsDays}
        setAnalyticsDays={setAnalyticsDays}
        pendingOrderCount={pendingOrderCount}
      />

      <div className="hidden md:block">
        <PageHeader
          eyebrow="WORKSPACE"
          title="Overview"
          description="A focused view of the signals that need your attention today."
          action={onRefresh && (
            <Button variant="primary" onClick={refresh} loading={refreshing}>
              <RefreshCw className={`h-[15px] w-[15px] ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh workspace'}
            </Button>
          )}
        />

        <KpiCards
          items={[
            {
              label: 'Tracking health',
              value: `${optScore}%`,
              hint: healthHint,
              tone: metrics.openSuggestions === 0 ? 'green' : 'amber',
              icon: <ShieldCheck className="h-[23px] w-[23px]" />,
            },
            {
              label: 'Events this cycle',
              value: compactNumber(profile.eventsUsed),
              hint: eventsHint,
              tone: 'blue',
              icon: <Activity className="h-[23px] w-[23px]" />,
            },
            {
              label: 'Orders this cycle',
              value: metrics.ordersUsed.toLocaleString(),
              hint: pendingOrderCount > 0 ? `${pendingOrderCount} awaiting action` : 'Nothing awaiting action',
              tone: pendingOrderCount > 0 ? 'amber' : 'accent',
              icon: <ClipboardList className="h-[23px] w-[23px]" />,
            },
            {
              label: 'Destinations',
              value: `${metrics.destinationsHealthy} / ${metrics.destinationsTotal}`,
              hint: 'Healthy connections',
              tone: 'blue',
              icon: <Link2 className="h-[23px] w-[23px]" />,
            },
          ]}
        />

        <ActionStrip
          pendingOrderCount={pendingOrderCount}
          openSuggestions={metrics.openSuggestions}
          totalChecks={totalSuggCount}
          failedEvents={metrics.serverFailures}
          usagePercent={metrics.usagePercent}
          setActivePage={setActivePage}
        />

        {/* Alerts sit above the grid so a delivery failure or a first-run state
            is read before the panels it explains. */}
        {metrics.hasDeliveryIssue && (
          <div className="mb-[18px]">
            <DeliveryIssueAlert
              serverAttempts={metrics.serverAttempts}
              serverFailures={metrics.serverFailures}
              setActivePage={setActivePage}
            />
          </div>
        )}

        {metrics.showGettingStarted && (
          <div className="mb-[18px]">
            <GettingStartedPanel setActivePage={setActivePage} />
          </div>
        )}

        {/* The mockup's grid: three columns with an 18px gutter, a wide panel
            spanning two of them, and one column below xl — the chart and the
            health table both need real width before they are worth splitting. */}
        <div className="grid grid-cols-1 gap-[18px] xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <EventActivityChart
              chartData={metrics.chartData}
              analyticsDays={analyticsDays}
              setAnalyticsDays={setAnalyticsDays}
              trendTotal={metrics.trendTotal}
              trendPeak={metrics.trendPeak}
              trendPeakLabel={metrics.trendPeakLabel}
            />
          </div>

          <DeliveryPanel
            deliveryRate={metrics.deliveryRate}
            platformRows={metrics.platformRows}
            setActivePage={setActivePage}
          />

          <div className="min-w-0 xl:col-span-2">
            <TrackingHealthPanel platformRows={metrics.platformRows} setActivePage={setActivePage} />
          </div>

          <UsagePanel
            profile={profile}
            usagePercent={metrics.usagePercent}
            ordersUsed={metrics.ordersUsed}
            orderQuota={metrics.orderQuota}
            orderPercent={metrics.orderPercent}
            setActivePage={setActivePage}
          />

          {/* The activity table carries five columns and a 720px minimum, so it
              takes the full grid width rather than scrolling inside a third. */}
          <div className="min-w-0 xl:col-span-3">
            <RecentActivityTable recentEvents={metrics.recentEvents} setActivePage={setActivePage} />
          </div>
        </div>
      </div>
    </div>
  );
}
