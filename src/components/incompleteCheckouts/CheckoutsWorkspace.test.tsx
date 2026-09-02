import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { IncompleteCheckoutItem } from '../../types';
import CheckoutsWorkspace from './CheckoutsWorkspace';

const checkout: IncompleteCheckoutItem = {
  id: 1,
  phone: '+8801711112222',
  customerName: 'Rafi Ahmed',
  email: '',
  address: 'Mirpur, Dhaka',
  products: [{ name: 'Premium Hoodie', quantity: 2, price: 1395 }],
  amount: 2790,
  currency: 'BDT',
  pageUrl: '/checkout',
  campaignData: { utm_source: 'facebook' },
  status: 'incomplete',
  lastActivityAt: '2026-09-01T04:45:00Z',
};

const renderWorkspace = () => renderToStaticMarkup(
  <CheckoutsWorkspace
    items={[checkout]}
    counts={{ incomplete: 1, contacted: 0, recovered: 0, active: 1 }}
    updatingId={null}
    onUpdateStatus={async () => true}
    onOpenCreateOrder={() => {}}
    onRefresh={() => {}}
    showToast={() => {}}
  />,
);

test('mobile recovery chrome keeps refresh secondary and removes the disclosure toolbar', () => {
  const html = renderWorkspace();

  assert.ok(html.includes('aria-label="Refresh checkouts"'));
  assert.equal((html.match(/Refresh list/g) || []).length, 1, 'desktop keeps one labelled refresh action');
  assert.ok(!html.includes('About this page'));
  assert.ok(html.includes('To call'));
  assert.ok(html.includes('Value at stake'));
});

test('mobile checkout views stay on one line with compact merchant labels', () => {
  const html = renderWorkspace();

  assert.ok(html.includes('overflow-x-auto'));
  assert.ok(html.includes('To call'));
  assert.ok(html.includes('Called'));
  assert.ok(html.includes('Saved'));
  assert.ok(html.includes('max-sm:[&amp;&gt;button]:!flex-1'));
});

test('active checkout notice is compact on phones and cards cover narrow desktop widths', () => {
  const html = renderWorkspace();

  assert.ok(html.includes('1 active checkout · queues in ~5 min'));
  assert.ok(html.includes('min-[1360px]:block'));
  assert.ok(html.includes('min-[1360px]:hidden'));
});
