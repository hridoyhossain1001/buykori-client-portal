import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractPaymentIntent,
  paymentIntentMatchesPlan,
  paymentIntentSecondsRemaining,
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

test('accepts only the selected plan and its configured payment amount', () => {
  assert.equal(paymentIntentMatchesPlan(payment, 'starter'), true);
  assert.equal(paymentIntentMatchesPlan({ ...payment, totalAmount: '299.00' }, 'starter'), false);
  assert.equal(paymentIntentMatchesPlan({ ...payment, planTier: 'growth' }, 'starter'), false);
});
