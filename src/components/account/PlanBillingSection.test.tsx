import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UserProfile } from '../../types';
import { PlanBillingSection } from './PlanBillingSection';
import { PaymentHistorySection } from './PaymentHistorySection';
import { PLAN_CATALOG, resolvePlanKey, type PaymentHistoryItem } from './accountTypes';
import {
  planBillingNotes,
  renewalDeadlineMs,
  resolveEntitlementClaim,
  resolvePlanBillingDisplay,
  resolvePlanStatusClaim,
  resolveRenewalClaim,
} from './accountStatus';

/**
 * Regression guard for the Plan & Billing data-integrity finding.
 *
 * The section used to state three incompatible things at once: a renewal date
 * that had already passed shown as upcoming, an allowance of 50K in the usage
 * meter beside a plan card advertising 500K, and an "Active" plan header above a
 * payment history holding no successful payment. Every branch of the resolvers
 * that reconcile those claims is asserted here, plus the markup that must never
 * present a number the data does not support again.
 */

const NOW = new Date('2026-08-21T09:00:00.000Z');

const baseProfile: UserProfile = {
  name: 'Store Owner',
  email: 'owner@example.com',
  notificationEmail: 'owner@example.com',
  plan: 'Starter Plan',
  planTier: 'starter',
  eventsUsed: 10_000,
  eventsQuota: 200_000,
  renewalDate: '2026-09-01',
};

const paidPayment: PaymentHistoryItem = {
  reference: 'BKP-PAID01',
  planTier: 'starter',
  provider: 'bkash',
  baseAmount: '499.00',
  feeAmount: '0.00',
  totalAmount: '499.00',
  currency: 'BDT',
  status: 'approved',
  createdAt: '2026-08-01T06:00:00.000Z',
  receivedAt: '2026-08-01T06:01:00.000Z',
  isTest: false,
};

const cancelledPayment: PaymentHistoryItem = { ...paidPayment, reference: 'BKP-CXL01', status: 'cancelled' };

function billingFor(
  profile: UserProfile,
  options: { paymentHistory?: PaymentHistoryItem[]; paymentHistoryReady?: boolean; now?: Date } = {},
) {
  return resolvePlanBillingDisplay({
    profile,
    paymentHistory: options.paymentHistory ?? [paidPayment],
    paymentHistoryReady: options.paymentHistoryReady ?? true,
    now: options.now ?? NOW,
  });
}

function renderPlan(
  profile: UserProfile,
  options: { paymentHistory?: PaymentHistoryItem[]; paymentHistoryReady?: boolean; now?: Date } = {},
): string {
  const planKey = resolvePlanKey(profile.plan);
  return renderToStaticMarkup(
    <PlanBillingSection
      profile={profile}
      billing={billingFor(profile, options)}
      isFree={planKey === 'free'}
      isStarter={planKey === 'starter'}
      isGrowth={planKey === 'growth'}
      isPro={planKey === 'pro'}
      isAgency={planKey === 'agency'}
      openPayment={() => {}}
    />,
  );
}

function renderHistory(profile: UserProfile, options: { now?: Date } = {}): string {
  const billing = billingFor(profile, options);
  return renderToStaticMarkup(
    <PaymentHistorySection
      profile={profile}
      renewal={billing.renewal}
      renewalPrice={billing.renewalPrice}
      paymentHistory={[]}
      paymentHistoryLoading={false}
      paymentStatusFilter="all"
      setPaymentStatusFilter={() => {}}
      paymentPage={1}
      setPaymentPage={() => {}}
      onRefresh={() => {}}
    />,
  );
}

function planCard(html: string, label: string): string {
  const match = html.match(new RegExp(`<section(?:(?!<section)[\\s\\S])*?<h3[^>]*>${label}</h3>(?:(?!<section)[\\s\\S])*?</section>`));
  assert.ok(match, `${label} plan card should render`);
  return match[0];
}

test('shows the 14-day trial only on the active Starter plan', () => {
  const html = renderPlan({ ...baseProfile, plan: 'Starter Trial', isTrial: true, trialDaysRemaining: 14 });

  assert.match(planCard(html, 'Starter'), /14-day trial · 14 days left/);
  assert.doesNotMatch(planCard(html, 'Growth'), /trial/i);
  assert.match(planCard(html, 'Growth'), /Upgrade your plan/);
});

test('prevents a Growth user from opening a Starter downgrade payment', () => {
  const html = renderPlan({ ...baseProfile, plan: 'Growth Plan', planTier: 'growth', eventsQuota: 500_000 });

  assert.match(planCard(html, 'Starter'), /Included in current plan/);
  assert.doesNotMatch(planCard(html, 'Starter'), /Choose Starter/);
  assert.match(planCard(html, 'Growth'), /Your current plan/);
});

test('the plan cards state each allowance once, straight from the catalogue', () => {
  assert.equal(PLAN_CATALOG.growth.features.filter(feature => feature.includes('tracked events')).length, 1);
  assert.match(PLAN_CATALOG.growth.features[1], /Up to 500,000 tracked events and 2,000 orders each month/);
  assert.match(PLAN_CATALOG.starter.features[1], /Up to 200,000 tracked events and 500 orders each month/);
  assert.equal(PLAN_CATALOG.growth.cardPrice, 'BDT 799');
  assert.equal(PLAN_CATALOG.growth.monthlyPrice, 'BDT 799 / month');
  assert.equal(PLAN_CATALOG.growth.renewalPrice, 'BDT 799');
  assert.equal(PLAN_CATALOG.free.monthlyPrice, 'Free');
  assert.equal(PLAN_CATALOG.pro.cardPrice, 'Contact us');
});

test('a renewal date still ahead of now reads as an upcoming charge', () => {
  const claim = resolveRenewalClaim('2026-09-01', 'growth', NOW);

  assert.equal(claim.tone, 'ok');
  assert.equal(claim.shortLabel, '2026-09-01');
  assert.equal(claim.daysOverdue, null);
  assert.equal(claim.note, null);
});

test('a renewal date already past never reads as upcoming', () => {
  const claim = resolveRenewalClaim('2026-06-24', 'growth', NOW);

  assert.equal(claim.tone, 'attention');
  assert.equal(claim.date, '2026-06-24');
  assert.equal(claim.shortLabel, 'Needs attention');
  assert.equal(claim.daysOverdue, 57);
  assert.match(String(claim.note), /has already passed/);
  assert.match(String(claim.note), /overdue/);
});

test('the renewal day itself is still upcoming in every timezone', () => {
  // A date-only value parses as UTC midnight, so the whole calendar day counts.
  assert.equal(resolveRenewalClaim('2026-08-21', 'growth', NOW).tone, 'ok');
  assert.equal(resolveRenewalClaim('2026-08-20', 'growth', NOW).tone, 'attention');
  assert.equal(renewalDeadlineMs('2026-08-21'), Date.parse('2026-08-22T00:00:00.000Z'));
  assert.equal(renewalDeadlineMs('2026-08-21T10:00:00.000Z'), Date.parse('2026-08-21T10:00:00.000Z'));
  assert.equal(renewalDeadlineMs(''), null);
  assert.equal(renewalDeadlineMs(undefined), null);
});

test('a past reset date on an unbilled plan reads as stale, not as an overdue payment', () => {
  const claim = resolveRenewalClaim('2026-06-24', 'free', NOW);

  assert.equal(claim.tone, 'attention');
  assert.doesNotMatch(String(claim.note), /overdue/);
  assert.match(String(claim.note), /has not been refreshed/);
});

test('missing and unreadable renewal dates are stated as such', () => {
  const missing = resolveRenewalClaim(undefined, 'growth', NOW);
  assert.equal(missing.tone, 'ok');
  assert.equal(missing.date, null);
  assert.equal(missing.shortLabel, 'Not scheduled');

  const broken = resolveRenewalClaim('next month', 'growth', NOW);
  assert.equal(broken.tone, 'unavailable');
  assert.equal(broken.shortLabel, 'Unavailable');
  assert.match(String(broken.note), /could not be read/);
});

test('an allowance both sources agree on drives the meter', () => {
  const claim = resolveEntitlementClaim({ ...baseProfile, plan: 'Growth Plan', eventsUsed: 250_000, eventsQuota: 500_000 }, 'growth');

  assert.equal(claim.tone, 'ok');
  assert.equal(claim.reason, 'stated');
  assert.equal(claim.eventsQuota, 500_000);
  assert.equal(claim.publishedQuota, 500_000);
  assert.equal(claim.limitLabel, '500K');
  assert.equal(claim.usagePercent, 50);
  assert.equal(claim.note, null);
});

test('an allowance the two sources disagree about is not guessed at', () => {
  const claim = resolveEntitlementClaim({ ...baseProfile, plan: 'Growth Plan', eventsUsed: 12_450, eventsQuota: 50_000 }, 'growth');

  assert.equal(claim.tone, 'unavailable');
  assert.equal(claim.reason, 'mismatch');
  assert.equal(claim.eventsQuota, null);
  assert.equal(claim.usagePercent, null);
  assert.equal(claim.limitLabel, 'Unavailable');
  assert.match(String(claim.note), /50K monthly events while the Growth Plan publishes 500K/);
});

test('the unlimited sentinel and a missing quota are told apart', () => {
  const unlimited = resolveEntitlementClaim({ ...baseProfile, plan: 'Agency', eventsQuota: 0 }, 'agency');
  assert.equal(unlimited.reason, 'unlimited');
  assert.equal(unlimited.limitLabel, 'Unlimited');
  assert.equal(unlimited.usagePercent, null);
  assert.equal(unlimited.note, null);

  const missing = resolveEntitlementClaim({ ...baseProfile, eventsQuota: undefined as unknown as number }, 'starter');
  assert.equal(missing.tone, 'unavailable');
  assert.equal(missing.reason, 'missing');
  assert.equal(missing.limitLabel, 'Unavailable');
  assert.match(String(missing.note), /did not load/);
});

test('an unrecognised plan label publishes no allowance to contradict', () => {
  const claim = resolveEntitlementClaim({ ...baseProfile, plan: 'Bespoke bundle', eventsQuota: 50_000 }, null);

  assert.equal(claim.reason, 'stated');
  assert.equal(claim.publishedQuota, null);
  assert.equal(claim.limitLabel, '50K');
  assert.equal(resolveEntitlementClaim({ ...baseProfile, eventsUsed: undefined as unknown as number }, 'starter').usedLabel, 'Unavailable');
});

test('a billed plan with no successful payment cannot claim to be active', () => {
  const claim = resolvePlanStatusClaim(baseProfile, [cancelledPayment], true, 'starter');

  assert.equal(claim.tone, 'attention');
  assert.equal(claim.label, 'Activation unverified');
  assert.match(String(claim.note), /no successful payment is on record/);
});

test('a billed plan with a successful payment is active', () => {
  const claim = resolvePlanStatusClaim(baseProfile, [cancelledPayment, paidPayment], true, 'starter');

  assert.equal(claim.tone, 'ok');
  assert.equal(claim.label, 'Active');
  assert.equal(claim.note, null);
});

test('an empty history is only evidence once it has actually been read', () => {
  assert.equal(resolvePlanStatusClaim(baseProfile, [], false, 'starter').label, 'Active');
  assert.equal(resolvePlanStatusClaim(baseProfile, [], true, 'starter').label, 'Activation unverified');
});

test('free, negotiated and trial plans are never accused of being unpaid', () => {
  assert.equal(resolvePlanStatusClaim({ ...baseProfile, plan: 'Free' }, [], true, 'free').tone, 'ok');
  assert.equal(resolvePlanStatusClaim({ ...baseProfile, plan: 'Pro Plan' }, [], true, 'pro').tone, 'ok');
  assert.equal(resolvePlanStatusClaim({ ...baseProfile, plan: 'Bespoke' }, [], true, null).tone, 'ok');
  assert.equal(
    resolvePlanStatusClaim({ ...baseProfile, isTrial: true, trialDaysRemaining: 9 }, [], true, 'starter').label,
    '14-day trial · 9 days left',
  );
});

test('every contradiction on one account is reported, in render order', () => {
  const display = billingFor(
    { ...baseProfile, plan: 'Growth Plan', eventsUsed: 12_450, eventsQuota: 50_000, renewalDate: '2026-06-24' },
    { paymentHistory: [] },
  );

  assert.deepEqual(display.contradictions, ['renewal_in_past', 'entitlement_mismatch', 'no_successful_payment']);
  assert.equal(planBillingNotes(display).length, 3);
  assert.match(planBillingNotes(display)[0], /no successful payment is on record/);
  assert.match(planBillingNotes(display)[1], /publishes 500K/);
  assert.match(planBillingNotes(display)[2], /has already passed/);
});

test('a consistent account reports no contradictions at all', () => {
  const display = billingFor({ ...baseProfile, plan: 'Growth Plan', eventsQuota: 500_000 });

  assert.deepEqual(display.contradictions, []);
  assert.deepEqual(planBillingNotes(display), []);
  assert.equal(display.monthlyPrice, 'BDT 799 / month');
  assert.equal(display.renewalPrice, 'BDT 799');
});

test('the contradicting account renders no confident number anywhere', () => {
  const profile: UserProfile = {
    ...baseProfile,
    plan: 'Growth Plan',
    planTier: 'growth',
    eventsUsed: 12_450,
    eventsQuota: 50_000,
    renewalDate: '2026-06-24',
  };
  const html = renderPlan(profile, { paymentHistory: [] });

  assert.doesNotMatch(html, /Renews 2026-06-24/);
  assert.doesNotMatch(html, /Resets 2026-06-24/);
  assert.doesNotMatch(html, /\/ 50K events/);
  assert.doesNotMatch(html, /% used/);
  assert.match(html, /Some billing details need attention/);
  assert.match(html, /Activation unverified/);
  assert.match(html, /Allowance unavailable/);
  assert.match(html, new RegExp(`${(12_450).toLocaleString()} events used`));
  assert.match(html, /Renewal: Needs attention/);
  assert.match(html, /Reset date needs attention/);
  // The catalogue keeps advertising what the plan includes; only the account's
  // own claim is withheld.
  assert.match(planCard(html, 'Growth'), /Up to 500,000 tracked events/);
  // Both sections read the same resolved renewal claim.
  assert.match(renderHistory(profile), /Needs attention/);
  assert.doesNotMatch(renderHistory(profile), /2026-06-24/);
});

test('a consistent account still renders the plan, meter and renewal date', () => {
  const profile: UserProfile = { ...baseProfile, plan: 'Growth Plan', planTier: 'growth', eventsUsed: 250_000, eventsQuota: 500_000 };
  const html = renderPlan(profile);

  assert.doesNotMatch(html, /needs attention/i);
  assert.match(html, /Active/);
  assert.match(html, /Renews 2026-09-01/);
  assert.match(html, /Resets 2026-09-01/);
  assert.match(html, new RegExp(`${(250_000).toLocaleString()} / 500K events`));
  assert.match(html, /50.00% used/);
  assert.match(html, /BDT 799 \/ month/);
  assert.match(renderHistory(profile), /2026-09-01/);
});

test('an unlimited allowance renders as unlimited rather than as a mismatch', () => {
  const html = renderPlan({ ...baseProfile, plan: 'Agency Plan', eventsQuota: 0 });

  assert.match(html, /Unlimited events/);
  assert.doesNotMatch(html, /Allowance unavailable/);
  assert.doesNotMatch(html, /needs attention/i);
});
