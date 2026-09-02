import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAMPAIGN_TEST_ENDPOINT,
  buildCampaignPayloadJson,
  buildCampaignTestRequestBody,
  flattenCampaignCustomParams,
  resolveCampaignBaseUrl,
  resolveCampaignDispatchBoundary,
  resolveCampaignStoreDomain,
} from './campaignPayload';

const emptyForm = {
  builderPlatform: 'Meta CAPI' as const,
  builderEventName: 'Purchase',
  builderValue: '',
  builderCurrency: '',
  builderEmail: '',
  builderPhone: '',
  builderIp: '',
  builderUa: '',
  customParams: [],
};

test('preview payload from an untouched form carries no identity at all', () => {
  const payload = JSON.parse(buildCampaignPayloadJson(emptyForm));
  assert.deepEqual(payload.user_data, {});
  assert.deepEqual(payload.custom_data, {});
  assert.equal(payload.event_name, 'Purchase');
});

test('request body from an untouched form omits every identity field', () => {
  const body = buildCampaignTestRequestBody(emptyForm) as unknown as Record<string, unknown>;
  ['email', 'phone', 'ip', 'userAgent', 'value', 'currency'].forEach(field => {
    assert.equal(field in body, false, `${field} must not be sent when the input is empty`);
  });
  assert.deepEqual(body, { platform: 'Meta CAPI', eventName: 'Purchase', customParams: {} });
});

test('no invented PII appears anywhere in a payload built from empty fields', () => {
  const serialised = buildCampaignPayloadJson(emptyForm) + JSON.stringify(buildCampaignTestRequestBody(emptyForm));
  ['@', 'Mozilla', '129.99', 'customer', 'Designer'].forEach(fragment => {
    assert.equal(serialised.includes(fragment), false, `${fragment} looks like invented sample data`);
  });
  assert.equal(/\d+\.\d+\.\d+\.\d+/.test(serialised), false, 'an IP address must never be invented');
});

test('supplied values are trimmed and passed through in both shapes', () => {
  const filled = {
    ...emptyForm,
    builderValue: ' 250 ',
    builderCurrency: ' BDT ',
    builderEmail: ' shop@example.test ',
    builderPhone: ' 018000 ',
    builderIp: ' 203.0.113.9 ',
    builderUa: ' TestAgent/1.0 ',
    customParams: [{ k: ' content_name ', v: ' Kurta ' }],
  };

  const body = buildCampaignTestRequestBody(filled);
  assert.equal(body.email, 'shop@example.test');
  assert.equal(body.phone, '018000');
  assert.equal(body.ip, '203.0.113.9');
  assert.equal(body.userAgent, 'TestAgent/1.0');
  assert.deepEqual(body.customParams, { content_name: 'Kurta' });

  const payload = JSON.parse(buildCampaignPayloadJson(filled));
  assert.deepEqual(payload.user_data.em, ['shop@example.test']);
  assert.deepEqual(payload.user_data.ph, ['018000']);
  assert.equal(payload.user_data.client_ip_address, '203.0.113.9');
  assert.deepEqual(payload.custom_data, { value: '250', currency: 'BDT', content_name: 'Kurta' });
});

test('half-filled custom rows never become fields in the dispatch', () => {
  assert.deepEqual(flattenCampaignCustomParams([
    { k: 'content_name', v: '' },
    { k: '', v: 'orphaned value' },
    { k: '  ', v: '  ' },
    { k: 'content_category', v: 'Apparel' },
  ]), { content_category: 'Apparel' });
});

test('the tester endpoint resolves to a sandbox boundary that never reaches an ad platform', () => {
  const boundary = resolveCampaignDispatchBoundary(CAMPAIGN_TEST_ENDPOINT);
  assert.equal(boundary.mode, 'sandbox');
  assert.equal(boundary.reachesAdPlatform, false);
  assert.equal(boundary.recordedInEventLog, true);
  assert.match(boundary.headline, /Sandbox/);
  assert.match(boundary.detail, /Event Logs/);
});

test('the default boundary matches the endpoint the tester posts to', () => {
  assert.deepEqual(resolveCampaignDispatchBoundary(), resolveCampaignDispatchBoundary(CAMPAIGN_TEST_ENDPOINT));
});

test('any other endpoint resolves to a live warning instead of inheriting sandbox wording', () => {
  const boundary = resolveCampaignDispatchBoundary('/api/v1/events');
  assert.equal(boundary.mode, 'live');
  assert.equal(boundary.reachesAdPlatform, true);
  assert.match(boundary.headline, /Live/);
  assert.match(boundary.detail, /\/api\/v1\/events/);
});

test('base URL comes from the current store connection', () => {
  const stores = [
    { domain: 'old-shop.test', is_current: false },
    { domain: 'my-shop.test', is_current: true },
  ];
  assert.equal(resolveCampaignStoreDomain(stores), 'my-shop.test');
  assert.equal(resolveCampaignBaseUrl(stores), 'https://my-shop.test');
});

test('a pasted scheme or trailing slash is not concatenated into the base URL', () => {
  assert.equal(resolveCampaignBaseUrl([{ domain: ' https://My-Shop.test/ ', is_current: true }]), 'https://My-Shop.test');
  assert.equal(resolveCampaignBaseUrl([{ domain: 'http://my-shop.test//', is_current: true }]), 'https://my-shop.test');
});

test('base URL falls back to empty when no store domain is connected', () => {
  assert.equal(resolveCampaignBaseUrl([]), '');
  assert.equal(resolveCampaignBaseUrl(null), '');
  assert.equal(resolveCampaignBaseUrl([{ domain: '   ', is_current: true }]), '');
  assert.equal(resolveCampaignStoreDomain(undefined), '');
});

test('a store with a domain is used even when none is flagged current', () => {
  assert.equal(resolveCampaignBaseUrl([
    { domain: '', is_current: true },
    { domain: 'fallback.test', is_current: false },
  ]), 'https://fallback.test');
});
