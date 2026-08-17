import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { UserProfile } from '../../types';
import { UsagePanel } from './UsagePanel';

const profile: UserProfile = {
  name: 'Store Owner',
  email: 'owner@example.com',
  notificationEmail: 'owner@example.com',
  plan: 'Starter Plan',
  planTier: 'starter',
  eventsUsed: 50_000,
  eventsQuota: 200_000,
  renewalDate: '2026-09-01',
};

function renderUsage(usagePercent: number, orderPercent: number): string {
  return renderToStaticMarkup(
    <UsagePanel
      profile={profile}
      usagePercent={usagePercent}
      ordersUsed={orderPercent >= 100 ? 500 : 100}
      orderQuota={500}
      orderPercent={orderPercent}
      setActivePage={() => {}}
    />,
  );
}

test('shows the upgrade CTA when the event quota is exhausted', () => {
  const html = renderUsage(100, 20);

  assert.match(html, /Monthly usage limit reached/);
  assert.match(html, /Upgrade your plan/);
});

test('shows the upgrade CTA when the order quota is exhausted', () => {
  const html = renderUsage(25, 100);

  assert.match(html, /Monthly usage limit reached/);
  assert.match(html, /Upgrade your plan/);
});
