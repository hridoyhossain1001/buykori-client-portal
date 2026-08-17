import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UserProfile } from '../../types';
import { PlanBillingSection } from './PlanBillingSection';

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

function renderPlan(
  profile: UserProfile,
  state: { isFree?: boolean; isStarter?: boolean; isGrowth?: boolean; isPro?: boolean; isAgency?: boolean },
): string {
  return renderToStaticMarkup(
    <PlanBillingSection
      profile={profile}
      usagePercent={(profile.eventsUsed / profile.eventsQuota) * 100}
      isFree={Boolean(state.isFree)}
      isStarter={Boolean(state.isStarter)}
      isGrowth={Boolean(state.isGrowth)}
      isPro={Boolean(state.isPro)}
      isAgency={Boolean(state.isAgency)}
      openPayment={() => {}}
    />,
  );
}

function planCard(html: string, label: string): string {
  const match = html.match(new RegExp(`<section(?:(?!<section)[\\s\\S])*?<h3[^>]*>${label}</h3>(?:(?!<section)[\\s\\S])*?</section>`));
  assert.ok(match, `${label} plan card should render`);
  return match[0];
}

test('shows the 14-day trial only on the active Starter plan', () => {
  const html = renderPlan(
    { ...baseProfile, plan: 'Starter Trial', isTrial: true, trialDaysRemaining: 14 },
    { isStarter: true },
  );

  assert.match(planCard(html, 'Starter'), /14-day trial · 14 days left/);
  assert.doesNotMatch(planCard(html, 'Growth'), /trial/i);
  assert.match(planCard(html, 'Growth'), /Upgrade your plan/);
});

test('prevents a Growth user from opening a Starter downgrade payment', () => {
  const html = renderPlan(
    { ...baseProfile, plan: 'Growth Plan', planTier: 'growth', eventsQuota: 500_000 },
    { isGrowth: true },
  );

  assert.match(planCard(html, 'Starter'), /Included in current plan/);
  assert.doesNotMatch(planCard(html, 'Starter'), /Choose Starter/);
  assert.match(planCard(html, 'Growth'), /Your current plan/);
});
