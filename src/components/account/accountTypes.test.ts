import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractPaymentIntent,
  paymentIntentSecondsRemaining,
  starterPriceForOffer,
  type PaymentIntent,
} from './accountTypes';

const payment: PaymentIntent = {
  reference: 'BKP-ABC123',
  paymentReference: '17',
  planTier: 'starter',
  baseAmount: '499.00',
  feeRatePercent: '0.00',
  feeAmount: '0.00',
  totalAmount: '499.00',
  provider: 'bkash',
  senderPhone: '01700000000',
  receivingPhone: '01974601745',
  status: 'pending',
  expiresAt: '2026-08-09T09:10:00.000Z',
};

test('extracts the payment object returned by the backend', () => {
  assert.deepEqual(extractPaymentIntent({ success: true, payment }), payment);
});

test('continues to accept legacy intent and data wrappers', () => {
  assert.deepEqual(extractPaymentIntent({ intent: payment }), payment);
  assert.deepEqual(extractPaymentIntent({ data: payment }), payment);
});

test('rejects an incomplete payment before the verification screen opens', () => {
  assert.equal(extractPaymentIntent({ success: true, payment: { reference: 'BKP-ABC123' } }), null);
  assert.equal(extractPaymentIntent({ success: true }), null);
});

test('derives the countdown from the backend expiry timestamp', () => {
  const now = Date.parse('2026-08-09T09:05:08.500Z');
  assert.equal(paymentIntentSecondsRemaining(payment, now), 292);
  assert.equal(paymentIntentSecondsRemaining({ ...payment, expiresAt: 'invalid' }, now), 0);
  assert.equal(paymentIntentSecondsRemaining({ ...payment, expiresAt: '2026-08-09T09:00:00.000Z' }, now), 0);
});

test('shows the server-authoritative founding Starter price only while active', () => {
  assert.equal(starterPriceForOffer(), 'BDT 499');
  assert.equal(starterPriceForOffer({ active: false, starterPrice: '299.00' }), 'BDT 499');
  assert.equal(starterPriceForOffer({ active: true, starterPrice: '299.00' }), 'BDT 299');
});
