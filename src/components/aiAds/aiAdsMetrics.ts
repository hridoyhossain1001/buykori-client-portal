import type { PerformanceSnapshot } from '../../services/aiAdsApi';

/**
 * Formatting and shaping helpers for the AI Ads performance panels.
 *
 * These are pure functions so the arithmetic a merchant actually reads — is this account empty?
 * what share of clicks became purchases? — is unit-tested, rather than checked by eye in a
 * browser against live Client 47 data. The panels stay presentational.
 */

/**
 * Money is deliberately printed without a currency symbol. The snapshot carries no currency
 * field: `spend` is summed across every connected ad account (each of which has its own
 * `currency` on the connection) and `revenue` is summed from tracked events. Printing a guessed
 * "৳" or "$" in front of a mixed-currency total would state something we have not verified, so
 * the number stands on its own until the backend exposes a currency for the aggregate.
 */
const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const countFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const roasFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Printed instead of a number when the wire value is missing or not a finite number. A missing
 * metric is not the same fact as a zero one, and `Intl.NumberFormat` would otherwise render
 * `NaN` or `∞` straight onto the dashboard.
 */
export const NO_VALUE = '—';

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** Grouped to 2 decimals, no currency symbol. See the note on `moneyFormat`. */
export function formatMoney(value?: number | null): string {
  const amount = finite(value);
  return amount === null ? NO_VALUE : moneyFormat.format(amount);
}

/**
 * Whole numbers for things that are counted — impressions, clicks, purchases. These used to run
 * through the money formatter, so an integer count could print as "1,240.5"; a fractional
 * impression is not a thing that exists.
 */
export function formatCount(value?: number | null): string {
  const count = finite(value);
  return count === null ? NO_VALUE : countFormat.format(count);
}

/**
 * CTR, conversion rate and attribution quality already arrive from the backend multiplied by
 * 100 (`performance_service.py`), so this only appends the sign — it never scales.
 */
export function formatPercent(value?: number | null): string {
  const rate = finite(value);
  return rate === null ? NO_VALUE : `${percentFormat.format(rate)}%`;
}

/** ROAS reads as a multiple of spend, e.g. "3.40×". */
export function formatRoas(value?: number | null): string {
  const roas = finite(value);
  return roas === null ? NO_VALUE : `${roasFormat.format(roas)}×`;
}

/**
 * The raw signals. Every other field on the snapshot is derived from these — CTR from
 * impressions, ROAS from spend, AOV from conversions — so when all five are zero there is
 * nothing to report even if a derived field somehow is not.
 */
const SIGNAL_KEYS = ['spend', 'impressions', 'clicks', 'conversions', 'revenue'] as const;

/**
 * Whether a snapshot carries no activity at all.
 *
 * The Analytics panel used to render its grid unconditionally, so a window with no data — or a
 * request that returned nothing — printed twelve zeros. Twelve zeros is indistinguishable from a
 * healthy account that genuinely spent nothing, which is the same "false healthy" reading the
 * page-level error guard was added to prevent. Any single non-zero signal counts as activity,
 * including a negative one (revenue reversed by refunds is real data and must not be hidden).
 */
export function isEmptySnapshot(snapshot: PerformanceSnapshot | null | undefined): boolean {
  if (!snapshot) return true;
  return SIGNAL_KEYS.every(key => (finite(snapshot[key]) ?? 0) === 0);
}

export interface FunnelStage {
  stage: string;
  value: number;
  /** Share of the previous stage as a percentage; `null` on the first stage, which has none. */
  rate: number | null;
  /** Name of the stage this rate is measured against; `null` on the first stage. */
  of: string | null;
}

/**
 * The three stages of the ad funnel, with the drop-off rate between each.
 *
 * The rates are the backend's own `ctr` and `conversion_rate` rather than a recomputation:
 * `ctr` is `clicks / impressions * 100` and `conversion_rate` is `conversions / clicks * 100`
 * (`app/services/ai_ads/performance_service.py:103,110`), which are exactly the two step rates
 * of this funnel and are already guarded against division by zero. Recomputing them here would
 * add a second source of truth that could drift from the numbers shown in the KPI grid.
 */
export function buildFunnelData(snapshot: PerformanceSnapshot | null | undefined): FunnelStage[] {
  const at = (key: keyof PerformanceSnapshot): number => finite(snapshot?.[key]) ?? 0;
  return [
    { stage: 'Impressions', value: at('impressions'), rate: null, of: null },
    { stage: 'Clicks', value: at('clicks'), rate: at('ctr'), of: 'impressions' },
    { stage: 'Purchases', value: at('conversions'), rate: at('conversion_rate'), of: 'clicks' },
  ];
}

/**
 * Whether the funnel has anything to draw. A snapshot can be non-empty overall and still have a
 * flat funnel: purchases and revenue come from tracked events while impressions and clicks come
 * from provider ad insights, so a client whose events are flowing but whose insight sync has not
 * landed yet has revenue with no impressions. Drawing an all-zero funnel there would be noise.
 */
export function hasFunnelVolume(stages: FunnelStage[]): boolean {
  return stages.some(stage => stage.value > 0);
}
