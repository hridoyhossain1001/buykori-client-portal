import { apiFetch } from '../lib/http';
import type {
  AnalyticsAudience,
  AnalyticsCampaigns,
  AnalyticsOverview,
  RecoverySummary,
  SignalDoctor,
  TrendPoint,
} from '../types';

export interface AnalyticsBundle {
  overview?: AnalyticsOverview;
  campaigns?: AnalyticsCampaigns;
  audience?: AnalyticsAudience;
  signalDoctor?: SignalDoctor;
  failedSections: string[];
}

const readJson = async <T>(response: Response) => await response.json() as T;

/**
 * API-06 / UI-02: every request now carries a timeout, and callers can pass an
 * AbortSignal so a rapid `days` change cannot let a stale bundle overwrite a fresher one.
 */
export async function fetchAnalyticsBundle(days: number, signal?: AbortSignal): Promise<AnalyticsBundle> {
  const [overviewResponse, campaignsResponse, audienceResponse, signalResponse] = await Promise.all([
    apiFetch(`/api/v1/analytics/overview?days=${days}`, { signal }),
    apiFetch(`/api/v1/analytics/campaigns?days=${days}`, { signal }),
    apiFetch(`/api/v1/analytics/audience?days=${days}`, { signal }),
    apiFetch(`/api/v1/analytics/signal-doctor?days=${days}`, { signal }),
  ]);

  const failedSections: string[] = [];
  if (!overviewResponse.ok) failedSections.push('summary');
  if (!campaignsResponse.ok) failedSections.push('sales source');
  if (!audienceResponse.ok) failedSections.push('customers');
  if (!signalResponse.ok) failedSections.push('tracking health');

  const bundle: AnalyticsBundle = { failedSections };
  if (overviewResponse.ok) {
    const data = await readJson<Partial<AnalyticsOverview>>(overviewResponse);
    bundle.overview = { ...data, funnel: Array.isArray(data.funnel) ? data.funnel : [] };
  }
  if (campaignsResponse.ok) {
    const data = await readJson<Partial<AnalyticsCampaigns>>(campaignsResponse);
    bundle.campaigns = { campaigns: Array.isArray(data.campaigns) ? data.campaigns : [] };
  }
  if (audienceResponse.ok) {
    const data = await readJson<Partial<AnalyticsAudience>>(audienceResponse);
    bundle.audience = {
      ...data,
      top_districts: Array.isArray(data.top_districts) ? data.top_districts : [],
      device_mix: Array.isArray(data.device_mix) ? data.device_mix : [],
      browser_mix: Array.isArray(data.browser_mix) ? data.browser_mix : [],
      district_funnel: Array.isArray(data.district_funnel) ? data.district_funnel : [],
      visitor_district_funnel: Array.isArray(data.visitor_district_funnel) ? data.visitor_district_funnel : [],
    };
  }
  if (signalResponse.ok) {
    const data = await readJson<Partial<SignalDoctor>>(signalResponse);
    bundle.signalDoctor = {
      ...data,
      issues: Array.isArray(data.issues) ? data.issues : [],
      signal_rates: data.signal_rates && Object.keys(data.signal_rates).length ? data.signal_rates : null,
    };
  }

  return bundle;
}

export async function fetchDashboardAnalytics(days: number, signal?: AbortSignal) {
  const [trendResponse, recoveryResponse] = await Promise.all([
    apiFetch(`/api/events/trend?days=${days}`, { signal }),
    apiFetch(`/api/events/recovery-summary?days=${days}`, { signal }),
  ]);
  const trendPayload = trendResponse.ok
    ? await readJson<{ trend?: TrendPoint[] }>(trendResponse)
    : null;
  const recoverySummary = recoveryResponse.ok
    ? await readJson<RecoverySummary>(recoveryResponse)
    : null;

  return {
    trend: Array.isArray(trendPayload?.trend) ? trendPayload.trend : null,
    recoverySummary,
  };
}
