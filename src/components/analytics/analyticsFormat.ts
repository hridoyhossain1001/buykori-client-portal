/**
 * Shared formatting helpers for the Ad Insights (Analytics) screens.
 *
 * These were defined inside the AnalyticsView component body. They are pure
 * functions with no dependency on React state or component scope, so they are
 * extracted here during the FE-01 split and imported by each section
 * component rather than being passed down as props.
 *
 * Bodies below were copied verbatim during that split; the derived-metric
 * helpers further down were added later for the contradictory-metrics fix.
 */

import type { AdPerformanceRow } from '../../types';
import type { AdSummary } from './analyticsTypes';

/** Returns the value when it is already an array, otherwise an empty array. */
export const asArray = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

/** Formats a possibly missing numeric value using the visitor's locale. */
export const numberText = (value: unknown) => Number(value || 0).toLocaleString();

/** Formats a percentage, falling back to 0% for non-finite input. */
export const percentText = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric}%` : '0%';
};

/**
 * Formats a money amount with two decimals.
 * BDT and USD get their familiar prefixes; any other currency code is shown
 * as-is so new markets do not silently render an unlabelled number.
 */
export const formatMoney = (value: number, currency?: string) => {
  const code = String(currency || '').trim().toUpperCase();
  const amount = Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (code === 'BDT') return `BDT ${amount}`;
  if (code === 'USD') return `$${amount}`;
  return code ? `${code} ${amount}` : amount;
};

/** Maps a raw tracking event name to the merchant-facing funnel step label. */
export const stepLabel = (step: string) => ({
  PageView: 'Store visit',
  ViewContent: 'Product seen',
  AddToCart: 'Added to cart',
  InitiateCheckout: 'Checkout started',
  Purchase: 'Order placed',
}[step] || step);

/** True when a location label carries no usable city information. */
export const isUnknownArea = (label: string) => /unknown|not set|n\/a|unavailable/i.test(String(label || ''));

/**
 * Derived metrics — the P1 "contradictory metrics" fix.
 *
 * Analytics used to render "150 events · 93 delivered · 0% success rate · 0
 * daily average" at the same time. Every one of those derived numbers fell
 * through to `0` when its source field was missing from the response, so the
 * page stated a precise wrong number instead of admitting the denominator was
 * unavailable.
 *
 * The rule these helpers enforce: a metric is a number ONLY when both its
 * numerator and its denominator came from the response. Otherwise it is `null`,
 * which every formatter renders as "Not available". A measured `0` (real data,
 * genuinely zero) still renders as `0` — that distinction is the whole point.
 */

/** Rendered wherever a metric's numerator or denominator is unavailable. */
export const NOT_AVAILABLE = 'Not available';

/**
 * Reads a numeric field, or null when the response never carried one.
 * Empty strings count as absent; `0` is kept because it is a real measurement.
 */
export const readNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

/**
 * Reads a value that is about to be divided by.
 * Zero and negatives are rejected: dividing by them yields Infinity/NaN, and a
 * share of nothing is not "0%" — it is unknowable.
 */
export const readDenominator = (value: unknown): number | null => {
  const numeric = readNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
};

/** part ÷ whole, or null when the denominator cannot support a quotient. */
export const quotient = (part: unknown, whole: unknown): number | null => {
  const numerator = readNumber(part);
  const denominator = readDenominator(whole);
  if (numerator === null || denominator === null) return null;
  return numerator / denominator;
};

/** part ÷ whole as a percentage rounded to one decimal, or null. */
export const ratePercent = (part: unknown, whole: unknown): number | null => {
  const value = quotient(part, whole);
  return value === null ? null : Number((value * 100).toFixed(1));
};

/** Formats a count that must not invent a zero when the field is absent. */
export const countText = (value: unknown) => {
  const numeric = readNumber(value);
  return numeric === null ? NOT_AVAILABLE : numeric.toLocaleString();
};

/** Formats an already-derived percentage, or admits it is unavailable. */
export const percentMetricText = (value: number | null | undefined) =>
  value === null || value === undefined ? NOT_AVAILABLE : `${value}%`;

/** Formats an already-derived money amount, or admits it is unavailable. */
export const moneyMetricText = (value: number | null | undefined, currency?: string) =>
  value === null || value === undefined ? NOT_AVAILABLE : formatMoney(value, currency);

/** Formats an already-derived multiple such as return on spend ("2.40x"). */
export const multipleMetricText = (value: number | null | undefined) =>
  value === null || value === undefined ? NOT_AVAILABLE : `${value.toFixed(2)}x`;

/** Formats a 0-100 score, or admits it is unavailable. */
export const scoreText = (value: number | null | undefined, outOf = 100) =>
  value === null || value === undefined ? NOT_AVAILABLE : `${value} / ${outOf}`;

/**
 * Width for a progress bar drawn from a possibly-unavailable share.
 *
 * Interpolating a null straight into a template string yields `width: null%`,
 * which the browser discards — leaving the bar at its auto width, i.e. a full
 * bar for a metric we could not even compute. Unknown must draw nothing.
 */
export const barWidthPercent = (value: number | null | undefined) =>
  `${value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value))}%`;

/**
 * "5 of 7 signals healthy" — counted over signals that were actually scored.
 *
 * Signals the response never scored are excluded from both sides of the ratio;
 * counting them as unhealthy would report a problem that has not been measured.
 */
export const signalHealthText = (signals: { rate: number | null }[] | null | undefined) => {
  const measured = asArray(signals).filter(signal => signal.rate !== null);
  if (!measured.length) return 'Signal data not available yet';
  const healthy = measured.filter(signal => (signal.rate as number) >= 80).length;
  const attention = measured.length - healthy;
  return `${healthy} of ${measured.length} signals healthy${attention > 0 ? ` · ${attention} need attention` : ''}`;
};

/** The overview payload as the API actually sends it. */
export type OverviewSource = {
  total_events?: number;
  success_rate?: number;
  avg_daily_events?: number;
  /** FastAPI `/analytics/overview` spelling. */
  success_count?: number;
  failed_count?: number;
  /** Mock/dev server spelling for the same two counts. */
  success_events?: number;
  failed_events?: number;
  period_days?: number;
} | null | undefined;

/** Delivery attempts recorded in the window — the denominator every event rate shares. */
export const attemptedEvents = (overview: OverviewSource): number | null => {
  const total = readNumber(overview?.total_events);
  if (total !== null) return total;
  const delivered = readNumber(overview?.success_count ?? overview?.success_events);
  const failed = readNumber(overview?.failed_count ?? overview?.failed_events);
  if (delivered === null && failed === null) return null;
  return (delivered ?? 0) + (failed ?? 0);
};

/** Attempts that reached the platform. Numerator of the delivery rate. */
export const deliveredEvents = (overview: OverviewSource): number | null => {
  const delivered = readNumber(overview?.success_count ?? overview?.success_events);
  if (delivered !== null) return delivered;
  const attempted = attemptedEvents(overview);
  const rate = readNumber(overview?.success_rate);
  if (attempted === null || rate === null) return null;
  return Math.round((attempted * rate) / 100);
};

/**
 * Delivery success rate. Denominator = delivery attempts (success + failed).
 *
 * Derived from the two counts whenever they exist, even when the response also
 * carries `success_rate`: the counts are what the page prints beside the rate,
 * so sharing their arithmetic is the only way "93 of 150" and "62%" cannot
 * disagree. No attempts at all means no rate — never 0%.
 */
export const deliverySuccessRate = (overview: OverviewSource): number | null => {
  const attempted = attemptedEvents(overview);
  if (attempted !== null && attempted <= 0) return null;
  const delivered = deliveredEvents(overview);
  if (attempted !== null && delivered !== null) return ratePercent(delivered, attempted);
  return readNumber(overview?.success_rate);
};

/**
 * The exact numerator and denominator behind the delivery rate.
 *
 * Both layouts print this beside the percentage, so it lives here rather than
 * being written twice — a caption that disagrees with the number above it is
 * the same defect as the wrong number itself.
 */
export const deliveryBasisText = (overview: OverviewSource) => {
  const attempted = attemptedEvents(overview);
  const delivered = deliveredEvents(overview);
  if (attempted === null || delivered === null) return 'Delivery counts not available';
  return `${delivered.toLocaleString()} of ${attempted.toLocaleString()} delivered`;
};

/**
 * Events per day. Denominator = the reporting window in days.
 *
 * `period_days` is preferred, falling back to the days the merchant selected;
 * both describe the same window. Kept to one decimal on purpose — rounding
 * 3 events over 30 days down to "0" would recreate the confident wrong zero
 * this whole helper set exists to remove.
 */
export const dailyAverageEvents = (overview: OverviewSource, selectedDays?: unknown): number | null => {
  const days = readDenominator(overview?.period_days) ?? readDenominator(selectedDays);
  const total = attemptedEvents(overview);
  if (days === null || total === null) return readNumber(overview?.avg_daily_events);
  return Number((total / days).toFixed(1));
};

/** Tracking-quality score clamped to its 0-100 range, or null when unscored. */
export const dataQualityScore = (score: unknown): number | null => {
  const numeric = readNumber(score);
  return numeric === null ? null : Math.max(0, Math.min(100, numeric));
};

/** One funnel row, as both the overview payload and the mock server send it. */
export type FunnelCountRow = { step: string; count?: number };

export type FunnelStepRate = {
  /** Share of the previous step, or null when that step cannot be a denominator. */
  percent: number | null;
  /** True when this step counted MORE than the step before it. */
  hasGap: boolean;
};

/**
 * Step-to-step conversion. Denominator = the previous step's count.
 *
 * A step that out-counts the one before it (tracking fired late, or an earlier
 * event is missing) has no valid denominator, so it reports `hasGap` and no
 * percentage rather than borrowing a different step's count and presenting the
 * result under the same "%" heading as its neighbours.
 */
export const funnelStepRate = (steps: FunnelCountRow[] | null | undefined, index: number): FunnelStepRate => {
  const rows = asArray(steps);
  const current = readNumber(rows[index]?.count);
  if (index <= 0) return { percent: current !== null && current > 0 ? 100 : null, hasGap: false };
  const previous = readNumber(rows[index - 1]?.count);
  if (current !== null && previous !== null && current > previous) return { percent: null, hasGap: true };
  return { percent: ratePercent(current, previous), hasGap: false };
};

/** How many steps out-count the step before them. Shared by both layouts. */
export const funnelGapCount = (steps: FunnelCountRow[] | null | undefined) =>
  asArray(steps).reduce((count, _step, index) => count + (funnelStepRate(steps, index).hasGap ? 1 : 0), 0);

/** Deduplicated visitor total across the audience breakdowns, or null when none reported. */
export const uniqueVisitorCount = (...breakdowns: { count?: number }[][]): number | null => {
  const totals = breakdowns
    .filter(rows => asArray(rows).length > 0)
    .map(rows => asArray(rows).reduce((total, row) => total + (readNumber(row.count) ?? 0), 0));
  return totals.length ? Math.max(...totals) : null;
};

/**
 * One breakdown row's share. Denominator = everything counted in that breakdown.
 *
 * Derived from the counts rather than read from each row's own `percentage`, so
 * device, browser and area lists on the same screen are all shares of the same
 * total. An empty breakdown has no denominator at all, which is different from
 * a row that really did record zero visitors.
 */
export const breakdownShare = (
  rows: { count?: number }[] | null | undefined,
  row: { count?: number } | null | undefined,
): number | null => {
  const list = asArray(rows);
  if (!list.length) return null;
  return ratePercent(readNumber(row?.count) ?? 0, list.reduce((total, item) => total + (readNumber(item.count) ?? 0), 0));
};

/** Return on ad spend. Denominator = ad spend. */
export const returnOnSpend = (revenue: unknown, spend: unknown) => quotient(revenue, spend);

/** Cost per order. Denominator = the order count the cost is being spread over. */
export const costPerOrder = (spend: unknown, orders: unknown) => quotient(spend, orders);

/** Click-through rate. Denominator = impressions served. */
export const clickRate = (clicks: unknown, impressions: unknown) => ratePercent(clicks, impressions);

/** Cost per click. Denominator = clicks received. */
export const costPerClick = (spend: unknown, clicks: unknown) => quotient(spend, clicks);

/**
 * Totals across the synced ad campaigns.
 *
 * Return and cost/order are derived here rather than in JSX so the card that
 * prints them cannot gate on a different denominator than the one the division
 * used — the old summary card gated "Cost / order" on placed orders while
 * dividing by confirmed orders, so a campaign with pending-only orders showed a
 * cost per order of 0.00.
 */
export const summarizeAdPerformance = (rows: AdPerformanceRow[] | null | undefined): AdSummary => {
  const campaigns = asArray(rows);
  const sum = (pick: (row: AdPerformanceRow) => unknown) =>
    campaigns.reduce((total, row) => total + (readNumber(pick(row)) ?? 0), 0);
  const spend = sum(row => row.spend);
  const confirmedPurchases = sum(row => row.confirmed_purchases);
  const confirmedRevenue = sum(row => row.confirmed_revenue);
  const spendCurrency = campaigns.find(row => row.spend_currency)?.spend_currency || '';
  return {
    spend,
    placedPurchases: sum(row => row.placed_purchases),
    placedRevenue: sum(row => row.placed_revenue),
    confirmedPurchases,
    confirmedRevenue,
    spendCurrency,
    revenueCurrency: campaigns.find(row => row.revenue_currency)?.revenue_currency || spendCurrency,
    returnRate: returnOnSpend(confirmedRevenue, spend),
    costPerOrder: costPerOrder(spend, confirmedPurchases),
  };
};
