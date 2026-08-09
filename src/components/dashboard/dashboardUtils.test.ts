import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactNumber,
  formatQuotaLimit,
  isUnlimitedQuota,
  quotaPercent,
} from './dashboardUtils';

/**
 * Regression guard for UX-01.
 *
 * The usage meters used to render the backend's "0 = unlimited" sentinel
 * literally ("/ 0 events", "of 0", "∞") and the sidebar formatter turned
 * 1,000,000 into "1000.0k". These helpers are the single source of truth every
 * meter now shares.
 */

test('formatQuotaLimit renders finite ceilings compactly', () => {
  assert.equal(formatQuotaLimit(500), '500');
  assert.equal(formatQuotaLimit(12_500), '12.5K');
  assert.equal(formatQuotaLimit(200_000), '200K');
  assert.equal(formatQuotaLimit(1_000_000), '1M');
  assert.equal(formatQuotaLimit(2_500_000), '2.5M');
});

test('formatQuotaLimit treats the 0 sentinel (and junk) as Unlimited', () => {
  assert.equal(formatQuotaLimit(0), 'Unlimited');
  assert.equal(formatQuotaLimit(-1), 'Unlimited');
  assert.equal(formatQuotaLimit(Number.NaN), 'Unlimited');
  assert.equal(formatQuotaLimit(Number.POSITIVE_INFINITY), 'Unlimited');
});

test('compactNumber never emits the old 1000.0k style', () => {
  assert.equal(compactNumber(1_000_000), '1M');
  assert.equal(compactNumber(1_500), '1.5K');
  assert.equal(compactNumber(999), '999');
  assert.ok(!compactNumber(1_000_000).includes('k'));
});

test('isUnlimitedQuota only flags the sentinel', () => {
  assert.equal(isUnlimitedQuota(0), true);
  assert.equal(isUnlimitedQuota(-5), true);
  assert.equal(isUnlimitedQuota(Number.NaN), true);
  assert.equal(isUnlimitedQuota(1), false);
  assert.equal(isUnlimitedQuota(200_000), false);
});

test('quotaPercent clamps to 0-100 and never divides by an unlimited quota', () => {
  assert.equal(quotaPercent(50, 200), 25);
  assert.equal(quotaPercent(0, 200), 0);
  assert.equal(quotaPercent(500, 200), 100); // clamped, never > 100
  // Unlimited quota => empty bar, not NaN/Infinity.
  assert.equal(quotaPercent(9_999, 0), 0);
  assert.ok(Number.isFinite(quotaPercent(9_999, 0)));
  assert.ok(!Number.isNaN(quotaPercent(0, 0)));
});
