import assert from 'node:assert/strict';
import test from 'node:test';

import { aiAdsUiEnabled, clientPageAllowed } from './aiAdsFeatureGate';

test('AI Ads UI is fail-closed for missing or false profile capability', () => {
  assert.equal(aiAdsUiEnabled(null), false);
  assert.equal(aiAdsUiEnabled({}), false);
  assert.equal(aiAdsUiEnabled({ aiAdsEnabled: false }), false);
  assert.equal(clientPageAllowed('ai-ads', {}), false);
});

test('allowlisted profile can open AI Ads without affecting other pages', () => {
  assert.equal(clientPageAllowed('ai-ads', { aiAdsEnabled: true }), true);
  assert.equal(clientPageAllowed('dashboard', {}), true);
});
