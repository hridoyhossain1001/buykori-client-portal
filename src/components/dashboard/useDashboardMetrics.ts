import { useMemo } from 'react';
import type { CAPIEvent, RecoverySummary, TrendPoint, UserProfile } from '../../types';
import { chartGeometry } from './dashboardUtils';

export interface PlatformStats {
  total: number;
  rate: number;
  lastTime: string;
}

export interface PlatformRow extends PlatformStats {
  label: string;
  platform: string;
}

export interface DashboardChartPoint {
  name: string;
  events: number;
  delivered: number;
}

interface UseDashboardMetricsArgs {
  profile: UserProfile;
  events: CAPIEvent[];
  trendData: TrendPoint[];
  recoverySummary: RecoverySummary | null;
  metaStats: PlatformStats;
  tiktokStats: PlatformStats;
  ga4Stats: PlatformStats;
  resolvedCount: number;
  totalSuggCount: number;
}

export function useDashboardMetrics({
  profile,
  events,
  trendData,
  recoverySummary,
  metaStats,
  tiktokStats,
  ga4Stats,
  resolvedCount,
  totalSuggCount,
}: UseDashboardMetricsArgs) {
  const chartData = useMemo(
    () => trendData.map(point => ({
      ...point,
      name: point.name || point.date || '',
      events: Number(point.received ?? point.total ?? 0)
        || Number(point['Meta CAPI'] ?? 0)
          + Number(point['TikTok Events'] ?? 0)
          + Number(point.GA4 ?? 0),
      delivered: Number(point.delivered ?? point.success ?? point.total ?? 0)
        || Number(point['Meta CAPI'] ?? 0)
          + Number(point['TikTok Events'] ?? 0)
          + Number(point.GA4 ?? 0),
    })),
    [trendData],
  );

  const platformRows: PlatformRow[] = [
    { label: 'Meta', platform: 'Meta CAPI', ...metaStats },
    { label: 'TikTok', platform: 'TikTok Events API', ...tiktokStats },
    { label: 'GA4', platform: 'GA4', ...ga4Stats },
  ];
  const openSuggestions = Math.max(0, totalSuggCount - resolvedCount);
  const serverAttempts = Number(recoverySummary?.server_attempt_events ?? recoverySummary?.server_events ?? 0);
  const serverFailures = Number(recoverySummary?.server_failed_events ?? 0);
  const hasDeliveryIssue = serverAttempts > 0 && Number(recoverySummary?.server_events ?? 0) === 0;
  const usagePercent = profile.eventsQuota > 0
    ? Math.min(100, (profile.eventsUsed / profile.eventsQuota) * 100)
    : 0;
  const locallyObservedOrders = new Set(
    events
      .filter(event => event.name.toLowerCase() === 'purchase')
      .map(event => event.orderId || event.deduplicationKey || event.id),
  ).size;
  const ordersUsed = Number(profile.ordersUsed ?? locallyObservedOrders);
  const orderQuota = Number(profile.ordersQuota || 0);
  const orderPercent = orderQuota > 0 ? Math.min(100, (ordersUsed / orderQuota) * 100) : 0;
  const recentEvents = events.slice(0, 5);
  const mobileRecentEvents = recentEvents.slice(0, 4);
  const showGettingStarted = events.length === 0 && profile.eventsUsed === 0;
  const deliveryAttempts = platformRows.reduce((total, row) => total + row.total, 0);
  const successfulDeliveries = platformRows.reduce((total, row) => total + Math.round(row.total * row.rate / 100), 0);
  const deliveryRate = deliveryAttempts > 0 ? Math.round((successfulDeliveries / deliveryAttempts) * 100) : 0;
  const deliveryChart = useMemo(
    () => chartGeometry(chartData.map(point => point.delivered)),
    [chartData],
  );
  const firstTrendLabel = chartData[0]?.name || '';
  const middleTrendLabel = chartData[Math.floor((chartData.length - 1) / 2)]?.name || '';
  const lastTrendLabel = chartData[chartData.length - 1]?.name || '';
  const renewalDate = profile.renewalDate ? new Date(profile.renewalDate) : null;
  const renewalIsValid = Boolean(renewalDate && !Number.isNaN(renewalDate.getTime()));
  const daysUntilRenewal = renewalIsValid
    ? Math.max(0, Math.ceil((renewalDate!.getTime() - Date.now()) / 86_400_000))
    : null;

  return {
    chartData,
    platformRows,
    openSuggestions,
    serverAttempts,
    serverFailures,
    hasDeliveryIssue,
    usagePercent,
    ordersUsed,
    orderQuota,
    orderPercent,
    recentEvents,
    mobileRecentEvents,
    showGettingStarted,
    deliveryRate,
    deliveryChart,
    firstTrendLabel,
    middleTrendLabel,
    lastTrendLabel,
    renewalDate,
    renewalIsValid,
    daysUntilRenewal,
  };
}
