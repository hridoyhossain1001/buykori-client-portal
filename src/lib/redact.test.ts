import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REDACTED,
  isSensitiveKey,
  redactApiLog,
  redactDeep,
  redactJsonText,
  redactQuery,
  redactText,
  redactUrl,
} from './redact';

const GA4 = 'https://www.google-analytics.com/mp/collect?api_secret=sec_key&measurement_id=id';


test('the GA4 endpoint no longer carries its api_secret', () => {
  assert.equal(redactUrl(GA4), `https://www.google-analytics.com/mp/collect?api_secret=${REDACTED}&measurement_id=id`);
  assert.ok(!redactUrl(GA4).includes('sec_key'));
});

test('identifiers that merely look secret-adjacent survive, because the log has to stay diagnosable', () => {
  assert.equal(
    redactUrl('https://graph.facebook.com/v18.0/events?pixel_id=8891&measurement_id=G-XYZ&client_id=44&event_id=e_9'),
    'https://graph.facebook.com/v18.0/events?pixel_id=8891&measurement_id=G-XYZ&client_id=44&event_id=e_9',
  );
  assert.equal(isSensitiveKey('measurement_id'), false);
  assert.equal(isSensitiveKey('pixel_id'), false);
  assert.equal(isSensitiveKey('api_secret'), true);
  assert.equal(isSensitiveKey('API-Secret'), true);
  assert.equal(isSensitiveKey('apiSecret'), true);
  assert.equal(isSensitiveKey('X-Api-Key'), true);
});

test('every credential-shaped parameter name is covered, not just the one the audit found', () => {
  const query = redactQuery('access_token=EAAG123&refresh_token=r1&sig=abc&signature=def&password=hunter2&key=AIza9&auth=basic&normal=keep');
  assert.equal(query, `access_token=${REDACTED}&refresh_token=${REDACTED}&sig=${REDACTED}&signature=${REDACTED}&password=${REDACTED}&key=${REDACTED}&auth=${REDACTED}&normal=keep`);
});

test('endpoints that are not URLs are left exactly as they are', () => {
  assert.equal(redactUrl('https://graph.facebook.com/v18.0/pixel_id/events'), 'https://graph.facebook.com/v18.0/pixel_id/events');
  assert.equal(redactUrl('/api/events'), '/api/events');
  assert.equal(redactUrl('Browser pixel'), 'Browser pixel');
  assert.equal(redactUrl('a=1&b=2'), 'a=1&b=2');
  assert.equal(redactUrl(undefined), '');
  assert.equal(redactUrl(null), '');
  assert.equal(redactUrl(42), '');
  assert.equal(redactUrl(''), '');
});

test('a credential hidden outside the query string is still removed', () => {
  assert.equal(redactUrl('https://admin:hunter2@hooks.example.com/deliver'), `https://${REDACTED}@hooks.example.com/deliver`);
  assert.equal(redactUrl('https://example.com/p?api_key=abc#section'), `https://example.com/p?api_key=${REDACTED}#section`);
  assert.equal(redactUrl('https://example.com/p?flag&api_key=abc'), `https://example.com/p?flag&api_key=${REDACTED}`);
});

test('an Authorization value keeps its scheme and loses its token', () => {
  assert.equal(redactText('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc'), `Authorization: Bearer ${REDACTED}`);
  assert.equal(redactText('Basic dXNlcjpwYXNzd29yZA=='), `Basic ${REDACTED}`);
  assert.equal(redactText('Delivered to the pixel with no problems'), 'Delivered to the pixel with no problems');
  assert.equal(redactText(undefined), '');
});

test('nested payloads and batches are walked, not just the top level', () => {
  const redacted = redactDeep({
    pixel_id: '8891',
    access_token: 'EAAG123',
    headers: { Authorization: 'Bearer eyJ.abc', 'Content-Type': 'application/json' },
    data: [{ event_name: 'Purchase', user_data: { em: 'hash', api_secret: 'sec_key' } }],
    callback: 'https://shop.example/return?token=tok_9&order=1188',
    latency_ms: 148,
    ok: true,
    empty: null,
  }) as Record<string, any>;
  assert.equal(redacted.pixel_id, '8891');
  assert.equal(redacted.access_token, REDACTED);
  assert.equal(redacted.headers.Authorization, REDACTED);
  assert.equal(redacted.headers['Content-Type'], 'application/json');
  assert.equal(redacted.data[0].event_name, 'Purchase');
  assert.equal(redacted.data[0].user_data.em, 'hash');
  assert.equal(redacted.data[0].user_data.api_secret, REDACTED);
  assert.equal(redacted.callback, `https://shop.example/return?token=${REDACTED}&order=1188`);
  assert.equal(redacted.latency_ms, 148);
  assert.equal(redacted.ok, true);
  assert.equal(redacted.empty, null);
});

test('a self-referencing payload cannot hang the log view', () => {
  const payload: Record<string, unknown> = { pixel_id: '8891' };
  payload.self = payload;
  const redacted = redactDeep(payload) as Record<string, unknown>;
  assert.equal(redacted.pixel_id, '8891');
  assert.equal(redacted.self, REDACTED);
});

test('a JSON body keeps its formatting and loses its credentials', () => {
  const pretty = JSON.stringify({ access_token: 'EAAG123', pixel_id: '8891' }, null, 2);
  const redacted = redactJsonText(pretty);
  assert.ok(redacted.includes('\n  '), 'a pretty-printed body should stay pretty-printed');
  assert.ok(!redacted.includes('EAAG123'));
  assert.ok(redacted.includes('"pixel_id": "8891"'));
  assert.equal(redactJsonText('{"access_token":"EAAG123"}'), `{"access_token":"${REDACTED}"}`);
});

test('bodies that are not JSON are still scrubbed rather than trusted', () => {
  assert.equal(redactJsonText('client_id=44&api_secret=sec_key'), `client_id=44&api_secret=${REDACTED}`);
  assert.equal(redactJsonText('<html>401 at /mp/collect?api_secret=sec_key</html>'), `<html>401 at /mp/collect?api_secret=${REDACTED}</html>`);
  assert.equal(redactJsonText(''), '');
  assert.equal(redactJsonText(undefined), '');
});

test('one log record passes through a single redaction boundary', () => {
  const redacted = redactApiLog({
    id: 'api_1',
    endpoint: GA4,
    requestBody: JSON.stringify({ api_secret: 'sec_key', events: [{ name: 'purchase' }] }, null, 2),
    responseBody: '{"validationMessages":[]}',
  });
  assert.equal(redacted.id, 'api_1', 'fields that are not credentials must survive untouched');
  assert.ok(!JSON.stringify(redacted).includes('sec_key'), 'no serialisation of the record may contain the secret');
  assert.ok(redacted.endpoint.includes('measurement_id=id'));
  assert.equal(redacted.responseBody, '{"validationMessages":[]}');
});
