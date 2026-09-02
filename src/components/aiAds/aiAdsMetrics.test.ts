import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NO_VALUE,
  buildFunnelData,
  formatCount,
  formatMoney,
  formatPercent,
  formatRoas,
  hasFunnelVolume,
  isEmptySnapshot,
} from './aiAdsMetrics';
import type { PerformanceSnapshot } from '../../services/aiAdsApi';

const snapshot = (overrides: Partial<PerformanceSnapshot> = {}): PerformanceSnapshot => ({
  spend: 0,
  impressions: 0,
  clicks: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0,
  conversions: 0,
  cpa: 0,
  revenue: 0,
  roas: 0,
  conversion_rate: 0,
  aov: 0,
  attribution_quality: 0,
  ...overrides,
});

test('money is grouped to two decimals and carries no currency symbol', () => {
  // No symbol on purpose: the snapshot aggregates accounts that each have their own currency.
  assert.equal(formatMoney(1240), '1,240.00');
  assert.equal(formatMoney(1240.567), '1,240.57');
  assert.equal(formatMoney(0), '0.00');
  assert.equal(formatMoney(-45.5), '-45.50');
});

// The bug this covers: counts were run through the money formatter, so an impression count could
// render with a fractional part.
test('counts are whole numbers', () => {
  assert.equal(formatCount(48210), '48,210');
  assert.equal(formatCount(1240.5), '1,241');
  assert.equal(formatCount(0), '0');
});

test('percentages append the sign without rescaling the backend value', () => {
  // performance_service.py already multiplies by 100, so 1.66 must stay 1.7%, not 166%.
  assert.equal(formatPercent(1.66), '1.7%');
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatPercent(100), '100%');
});

test('ROAS reads as a multiple of spend', () => {
  assert.equal(formatRoas(3.4), '3.40×');
  assert.equal(formatRoas(0), '0.00×');
});

// A missing metric is a different fact from a zero one, and Intl would otherwise print "NaN" or
// "∞" straight onto the dashboard.
test('a missing or non-finite value reads as no value, never as zero', () => {
  for (const format of [formatMoney, formatCount, formatPercent, formatRoas]) {
    assert.equal(format(undefined), NO_VALUE);
    assert.equal(format(null), NO_VALUE);
    assert.equal(format(Number.NaN), NO_VALUE);
    assert.equal(format(Number.POSITIVE_INFINITY), NO_VALUE);
    assert.equal(format('12' as unknown as number), NO_VALUE);
  }
});

// The regression: the panel rendered twelve zeros whenever the window had no data, which reads as
// a healthy account that simply spent nothing.
test('a missing or all-zero snapshot counts as empty', () => {
  assert.equal(isEmptySnapshot(null), true);
  assert.equal(isEmptySnapshot(undefined), true);
  assert.equal(isEmptySnapshot(snapshot()), true);
});

test('a snapshot with only derived metrics set is still empty', () => {
  // Attribution quality, CTR and ROAS are computed from the raw signals; with no spend, no
  // traffic and no revenue behind them there is nothing to report.
  assert.equal(isEmptySnapshot(snapshot({ attribution_quality: 87, ctr: 4.2, roas: 2 })), true);
});

test('any single raw signal makes a snapshot worth rendering', () => {
  assert.equal(isEmptySnapshot(snapshot({ spend: 0.01 })), false);
  assert.equal(isEmptySnapshot(snapshot({ impressions: 1 })), false);
  assert.equal(isEmptySnapshot(snapshot({ clicks: 1 })), false);
  assert.equal(isEmptySnapshot(snapshot({ conversions: 1 })), false);
  assert.equal(isEmptySnapshot(snapshot({ revenue: 1 })), false);
  // Refund-reversed revenue is real data and must not be hidden behind an empty state.
  assert.equal(isEmptySnapshot(snapshot({ revenue: -250 })), false);
});

test('the funnel keeps stage order and reuses the backend step rates', () => {
  const stages = buildFunnelData(snapshot({
    impressions: 48210,
    clicks: 800,
    conversions: 40,
    ctr: 1.66,
    conversion_rate: 5,
  }));
  assert.deepEqual(stages, [
    { stage: 'Impressions', value: 48210, rate: null, of: null },
    { stage: 'Clicks', value: 800, rate: 1.66, of: 'impressions' },
    { stage: 'Purchases', value: 40, rate: 5, of: 'clicks' },
  ]);
});

test('a missing snapshot still yields three zeroed stages rather than crashing the chart', () => {
  const stages = buildFunnelData(null);
  assert.equal(stages.length, 3);
  assert.deepEqual(stages.map(stage => stage.value), [0, 0, 0]);
  assert.equal(hasFunnelVolume(stages), false);
});

// Purchases come from tracked events while impressions and clicks come from provider insights, so
// a client whose events flow before the insight sync lands has revenue with a flat funnel.
test('the funnel reports no volume when only tracked revenue exists', () => {
  assert.equal(hasFunnelVolume(buildFunnelData(snapshot({ revenue: 5000, conversions: 0 }))), false);
  assert.equal(hasFunnelVolume(buildFunnelData(snapshot({ conversions: 3 }))), true);
  assert.equal(hasFunnelVolume(buildFunnelData(snapshot({ impressions: 10 }))), true);
});
