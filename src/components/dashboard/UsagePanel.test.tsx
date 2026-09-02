import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UserProfile } from '../../types';
import { UsagePanel } from './UsagePanel';

/**
 * The usage panel now describes a rolling 30-day billing cycle anchored to the
 * day each client was put on their plan — not a calendar month.
 *
 * Two things must reach the merchant. First, the reset day is theirs alone, so
 * the panel may never say "this month" or imply a shared reset. Second, when the
 * paid period has ended, tracking deliberately keeps running for a few days
 * (cutting a paying store off the hour its period ends would silently lose its
 * events), and the only thing protecting the merchant is being told that payment
 * is due and by when. Both are asserted against the rendered markup, because a
 * correct helper behind a panel that never renders it helps nobody.
 */

const baseProfile: UserProfile = {
  name: 'Store Owner',
  email: 'owner@example.com',
  notificationEmail: 'owner@example.com',
  plan: 'Growth Plan',
  planTier: 'growth',
  eventsUsed: 103_700,
  eventsQuota: 500_000,
  renewalDate: 'September 16, 2026',
  quotaResetsAt: '2026-09-16T08:42:45+00:00',
  periodStart: '2026-08-17T08:42:45+00:00',
  planExpiresAt: '2026-09-16T08:42:45+00:00',
  quotaCycleDays: 30,
  graceDays: 3,
};

function render(profile: UserProfile, usagePercent = 20.74) {
  return renderToStaticMarkup(
    <UsagePanel
      profile={profile}
      usagePercent={usagePercent}
      ordersUsed={169}
      orderQuota={500_000}
      orderPercent={0.03}
      setActivePage={() => {}}
    />,
  );
}

test('the panel names the client own cycle instead of a calendar month', () => {
  const html = render(baseProfile);
  assert.match(html, /Usage this cycle/);
  assert.match(html, /resets Sep 16/);
  assert.doesNotMatch(html, /this month/i);
});

test('a client with no cycle date still gets a panel, without a guessed date', () => {
  const html = render({ ...baseProfile, quotaResetsAt: null });
  assert.match(html, /Current plan allowance/);
  assert.doesNotMatch(html, /resets/i);
});

test('an exhausted quota points at the cycle reset date, not the calendar', () => {
  const html = render({ ...baseProfile, eventsUsed: 500_000 }, 100);
  assert.match(html, /Event limit reached for this cycle/);
  assert.match(html, /until your quota resets on Sep 16/);
});

test('the settlement window is stated with its deadline and a renew action', () => {
  const html = render({ ...baseProfile, inGracePeriod: true, graceEndsAt: '2026-09-19T08:42:45+00:00' });
  assert.match(html, /Your plan period has ended/);
  assert.match(html, /Sep 19/);
  assert.match(html, /Renew your plan/);
});

test('a healthy plan is never shown a settlement warning', () => {
  const html = render(baseProfile);
  assert.doesNotMatch(html, /Your plan period has ended/);
  assert.doesNotMatch(html, /Renew your plan/);
});

/**
 * Both banners can be on screen at the same time — a plan whose period ended and
 * whose events also ran out — and each carries a pill that is 114×29px of ink.
 * Growing them to 44px of ink would make each alert's button louder than the two
 * lines of text above it, so the *target* is grown instead. The class is asserted
 * rather than the geometry because that is what a static render can see; the
 * measured 134×49 is recorded in the component's own comment.
 */
test('both alert buttons carry the 44px target, not just the newer one', () => {
  const html = render(
    { ...baseProfile, eventsUsed: 500_000, inGracePeriod: true, graceEndsAt: '2026-09-19T08:42:45+00:00' },
    100,
  );
  for (const label of ['Renew your plan', 'Upgrade your plan']) {
    const button = html.match(new RegExp(`<button[^>]*>${label}</button>`));
    assert.ok(button, `${label} should render when both banners are up`);
    assert.match(button[0], /btn-touch-expand/, `${label} is 29px of ink, so it needs the halo`);
  }
});
