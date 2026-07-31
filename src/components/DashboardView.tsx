import { CAPIEvent, RecoverySummary, TrendPoint, UserProfile } from '../types';
import { ActionCenter } from './dashboard/ActionCenter';
import { DeliveryIssueAlert, GettingStartedPanel } from './dashboard/DashboardAlerts';
import { EventActivityChart } from './dashboard/EventActivityChart';
import { MobileDashboard } from './dashboard/MobileDashboard';
import { RecentActivityTable } from './dashboard/RecentActivityTable';
import { TrackingHealthPanel } from './dashboard/TrackingHealthPanel';
import { UsagePanel } from './dashboard/UsagePanel';
import { useDashboardMetrics } from './dashboard/useDashboardMetrics';

interface DashboardViewProps {
  profile: UserProfile;
  events: CAPIEvent[];
  trendData: TrendPoint[];
  recoverySummary: RecoverySummary | null;
  metaStats: { total: number; rate: number; lastTime: string };
  tiktokStats: { total: number; rate: number; lastTime: string };
  ga4Stats: { total: number; rate: number; lastTime: string };
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
}

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

  return (
    <div className="space-y-5">
      <MobileDashboard
        profile={profile}
        metrics={metrics}
        setActivePage={setActivePage}
        analyticsDays={analyticsDays}
        setAnalyticsDays={setAnalyticsDays}
        pendingOrderCount={pendingOrderCount}
      />

      <div className="hidden space-y-5 md:block">
        {metrics.hasDeliveryIssue && (
          <DeliveryIssueAlert
            serverAttempts={metrics.serverAttempts}
            serverFailures={metrics.serverFailures}
            setActivePage={setActivePage}
          />
        )}

        {metrics.showGettingStarted && <GettingStartedPanel setActivePage={setActivePage} />}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <EventActivityChart
            chartData={metrics.chartData}
            analyticsDays={analyticsDays}
            setAnalyticsDays={setAnalyticsDays}
          />
          <ActionCenter
            pendingOrderCount={pendingOrderCount}
            openSuggestions={metrics.openSuggestions}
            optScore={optScore}
            setActivePage={setActivePage}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <TrackingHealthPanel platformRows={metrics.platformRows} setActivePage={setActivePage} />
          <UsagePanel
            profile={profile}
            usagePercent={metrics.usagePercent}
            ordersUsed={metrics.ordersUsed}
            orderQuota={metrics.orderQuota}
            orderPercent={metrics.orderPercent}
          />
        </div>

        <RecentActivityTable recentEvents={metrics.recentEvents} setActivePage={setActivePage} />
      </div>
    </div>
  );
}
