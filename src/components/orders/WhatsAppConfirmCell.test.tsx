import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { WhatsAppConfirmCell } from './WhatsAppConfirmCell';
import type { WhatsAppConfirmation } from '../../services/whatsappApi';

/**
 * The expensive mistake this cell exists to prevent: a customer replies
 * "1 confirm, but change my address", the order is confirmed, and the merchant
 * ships to the old address because the sentence was only ever in a hover
 * tooltip — and a phone has no hover. So anything the customer wrote beside the
 * bare 1/2 must be in the rendered markup, not in a `title` alone.
 */

const confirmation = (overrides: Partial<WhatsAppConfirmation> = {}): WhatsAppConfirmation => ({
  id: 1,
  orderId: 'WC-100',
  status: 'confirmed',
  phone: '8801712345678',
  sentAt: '2026-08-29T08:00:00Z',
  expiresAt: '2026-08-30T08:00:00Z',
  respondedAt: '2026-08-29T08:04:00Z',
  responseText: '1',
  customerNote: null,
  appliedStatus: 'confirmed',
  applyError: null,
  errorMessage: null,
  ...overrides,
});

const markupFor = (overrides: Partial<WhatsAppConfirmation> = {}) =>
  renderToStaticMarkup(
    React.createElement(WhatsAppConfirmCell, {
      confirmation: confirmation(overrides),
      available: true,
      connected: true,
      onSend: () => {},
    }),
  );

test('a note from the customer is visible text, not just a tooltip', () => {
  const markup = markupFor({ customerNote: '1 confirm but address change korte hobe' });
  assert.match(markup, /Customer wrote a note/);
  // The words themselves, outside any title attribute.
  const withoutTitles = markup.replace(/title="[^"]*"/g, '');
  assert.ok(
    withoutTitles.includes('address change korte hobe'),
    'the customer\'s own words must be rendered, not hidden in a hover title',
  );
  // The order still moved: the note is an addition, never a replacement.
  assert.match(markup, /Confirmed by customer/);
});

test('a bare answer shows no note pill', () => {
  const markup = markupFor();
  assert.ok(!markup.includes('Customer wrote a note'));
  assert.match(markup, /Confirmed by customer/);
});

test('an unclear reply stops claiming nobody answered', () => {
  const unclear = markupFor({
    status: 'sent',
    respondedAt: null,
    appliedStatus: null,
    responseText: 'kobe pabo?',
    customerNote: 'kobe pabo?',
    errorMessage: 'Reply was not a clear 1 or 2.',
  });
  assert.match(unclear, /Replied — no clear 1 or 2/);
  assert.ok(!unclear.includes('Waiting for reply'));

  // Nothing back from the customer yet: the old wording is still the true one.
  const silent = markupFor({ status: 'sent', respondedAt: null, appliedStatus: null, responseText: null });
  assert.match(silent, /Waiting for reply/);
});

test('the cell renders nothing while the server has the feature off', () => {
  const markup = renderToStaticMarkup(
    React.createElement(WhatsAppConfirmCell, {
      confirmation: confirmation({ customerNote: 'address change' }),
      available: false,
      connected: true,
      onSend: () => {},
    }),
  );
  assert.equal(markup, '');
});
