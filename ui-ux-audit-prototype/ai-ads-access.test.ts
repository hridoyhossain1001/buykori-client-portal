import assert from "node:assert/strict";
import test from "node:test";

import { aiAdsAccessFromProfile } from "./aiAdsAdapter";

test("server capability enables AI Ads", () => {
  assert.deepEqual(aiAdsAccessFromProfile({ aiAdsEnabled: true }), { enabled: true });
});

test("server-owned Client 47 identity enables AI Ads", () => {
  assert.deepEqual(aiAdsAccessFromProfile({ clientId: 47 }), { enabled: true });
  assert.deepEqual(aiAdsAccessFromProfile({ client_id: "47" }), { enabled: true });
  assert.deepEqual(aiAdsAccessFromProfile({ client: { id: 47 } }), { enabled: true });
});

test("other clients remain gated", () => {
  assert.deepEqual(aiAdsAccessFromProfile({ clientId: 48 }), { enabled: false });
  assert.deepEqual(aiAdsAccessFromProfile({ aiAdsEnabled: false, clientId: 48 }), { enabled: false });
});

test("missing profile identity fails closed", () => {
  assert.deepEqual(aiAdsAccessFromProfile(null), { enabled: false });
  assert.deepEqual(aiAdsAccessFromProfile({}), { enabled: false });
});
