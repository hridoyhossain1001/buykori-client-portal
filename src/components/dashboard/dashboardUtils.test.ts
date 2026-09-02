import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactNumber,
  cycleResetLabel,
  formatQuotaLimit,
  isUnlimitedQuota,
  quotaPercent,
  settlementNotice,
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

/**
 * Billing-cycle helpers.
 *
 * The plan runs on a rolling 30-day cycle anchored per client, and service keeps
 * running for a few days after the paid period ends. The merchant cannot see
 * either fact unless these helpers state it, so the null cases matter as much
 * as the happy path: a missing or malformed date must produce silence, never a
 * guessed reset day or a warning with no deadline in it.
 */

test('cycleResetLabel names the client own reset date and stays silent without one', () => {
  assert.equal(cycleResetLabel({ quotaResetsAt: '2026-09-16T08:42:45+00:00' }), 'Sep 16');
  assert.equal(cycleResetLabel({ quotaResetsAt: null }), null);
  assert.equal(cycleResetLabel({ quotaResetsAt: undefined }), null);
  assert.equal(cycleResetLabel({ quotaResetsAt: 'not-a-date' }), null);
});

test('settlementNotice only fires inside the settlement window', () => {
  assert.equal(settlementNotice({ inGracePeriod: false, graceEndsAt: '2026-09-19T00:00:00+00:00' }), null);
  assert.equal(settlementNotice({ inGracePeriod: undefined, graceEndsAt: undefined }), null);
});

test('settlementNotice counts the days left and names the cut-off date', () => {
  const notice = settlementNotice(
    { inGracePeriod: true, graceEndsAt: '2026-09-19T00:00:00+00:00' },
    new Date('2026-09-17T00:00:00+00:00'),
  );
  assert.ok(notice);
  assert.equal(notice!.daysLeft, 2);
  assert.equal(notice!.endsOn, 'Sep 19');
  assert.match(notice!.detail, /Sep 19/);
  assert.match(notice!.detail, /2 days left/);
});

test('settlementNotice singularises the last day and never goes negative', () => {
  const lastDay = settlementNotice(
    { inGracePeriod: true, graceEndsAt: '2026-09-19T00:00:00+00:00' },
    new Date('2026-09-18T00:00:00+00:00'),
  );
  assert.match(lastDay!.detail, /1 day left/);

  // An overdue window must still explain itself instead of showing "-3 days".
  const overdue = settlementNotice(
    { inGracePeriod: true, graceEndsAt: '2026-09-19T00:00:00+00:00' },
    new Date('2026-09-22T00:00:00+00:00'),
  );
  assert.equal(overdue!.daysLeft, 0);
  assert.doesNotMatch(overdue!.detail, /-/);
});

test('settlementNotice still warns when the cut-off date is missing', () => {
  const notice = settlementNotice({ inGracePeriod: true, graceEndsAt: null });
  assert.ok(notice);
  assert.equal(notice!.endsOn, null);
  assert.match(notice!.detail, /settlement window/);
});
