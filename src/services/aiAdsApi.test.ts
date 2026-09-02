import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchAiAdsLiveAnalytics, parseSseFrames } from './aiAdsApi';

const frame = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;

test('parses complete SSE events and keeps the trailing partial as rest', () => {
  const { frames, rest } = parseSseFrames(
    `${frame({ type: 'delta', text: 'Hel' })}${frame({ type: 'delta', text: 'lo' })}data: {"type":"del`,
  );
  assert.deepEqual(frames, [
    { type: 'delta', text: 'Hel' },
    { type: 'delta', text: 'lo' },
  ]);
  assert.equal(rest, 'data: {"type":"del');
});

// A frame split across two network reads must not be lost or double-counted: the caller feeds
// `rest` back in with the next chunk, which is the whole reason this returns a remainder.
test('a frame split across two reads is emitted once the remainder arrives', () => {
  const first = parseSseFrames('data: {"type":"delta","te');
  assert.deepEqual(first.frames, []);
  const second = parseSseFrames(`${first.rest}xt":"ok"}\n\n`);
  assert.deepEqual(second.frames, [{ type: 'delta', text: 'ok' }]);
  assert.equal(second.rest, '');
});

test('keepalive comments, blank events and malformed payloads never break the stream', () => {
  const { frames } = parseSseFrames(
    `: ping\n\n\n\ndata: not json\n\n${frame({ type: 'delta', text: 'still here' })}${frame({ type: 'mystery' })}`,
  );
  assert.deepEqual(frames, [{ type: 'delta', text: 'still here' }]);
});

// The activity trail is the client's only evidence that the assistant actually ran checks, so a
// step frame has to survive the parser — including a refused check, which must keep its status
// rather than being reported as a success.
test('step frames are parsed with their status, including refusals', () => {
  const { frames } = parseSseFrames(
    `${frame({ type: 'step', label: 'Reading your campaigns', status: 'completed' })}${frame({ type: 'step', label: 'That part of your account is not available to this login', status: 'denied' })}${frame({ type: 'step' })}`,
  );
  assert.deepEqual(frames, [
    { type: 'step', label: 'Reading your campaigns', status: 'completed' },
    { type: 'step', label: 'That part of your account is not available to this login', status: 'denied' },
  ]);
});

test('the done frame carries the authoritative message, structured payload and conversation', () => {
  const { frames } = parseSseFrames(frame({
    type: 'done',
    conversation_id: 42,
    message: 'Final sanitized answer.',
    structured: { proposal: { id: 7 } },
    usage: { input_tokens: 10, output_tokens: 3 },
  }));
  assert.equal(frames.length, 1);
  const done = frames[0];
  assert.equal(done.type, 'done');
  if (done.type !== 'done') return;
  assert.equal(done.conversation_id, 42);
  assert.equal(done.message, 'Final sanitized answer.');
  assert.deepEqual(done.structured, { proposal: { id: 7 } });
  assert.deepEqual(done.usage, { input_tokens: 10, output_tokens: 3 });
});

test('a done frame without structured content normalizes to null, not undefined', () => {
  const { frames } = parseSseFrames(frame({ type: 'done', conversation_id: 1, message: 'ok' }));
  const done = frames[0];
  if (done.type !== 'done') throw new Error('expected a done frame');
  assert.equal(done.structured, null);
});

test('an error frame keeps its detail and falls back to a safe message when absent', () => {
  const { frames } = parseSseFrames(`${frame({ type: 'error', detail: 'AI Ads is read-only.' })}${frame({ type: 'error' })}`);
  assert.deepEqual(frames, [
    { type: 'error', detail: 'AI Ads is read-only.' },
    { type: 'error', detail: 'The assistant could not respond.' },
  ]);
});

test('CRLF line endings and multi-line data payloads are handled', () => {
  const { frames } = parseSseFrames('data: {"type":"delta",\r\ndata: "text":"joined"}\r\n\r\n');
  assert.deepEqual(frames, [{ type: 'delta', text: 'joined' }]);
});

/**
 * The live Analytics read is the one request whose query string decides *whose* money is reported.
 * Omitting `account_id` is a deliberate state — the backend then ranks the client's own accounts —
 * so the two shapes are asserted separately: a missing account must not become `account_id=null`
 * or `account_id=undefined`, both of which the backend would reject as a bad int rather than treat
 * as "you choose".
 */
const captureUrl = async (call: () => Promise<unknown>): Promise<string> => {
  const original = globalThis.fetch;
  let seen = '';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    seen = String(input);
    return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
  }) as typeof fetch;
  try {
    await call();
  } finally {
    globalThis.fetch = original;
  }
  return seen;
};

test('the live analytics read asks for one ad account when the merchant has chosen one', async () => {
  assert.equal(
    await captureUrl(() => fetchAiAdsLiveAnalytics(14, 13)),
    '/api/ai-ads/performance/live?days=14&account_id=13',
  );
});

test('no chosen account sends no account_id at all, leaving the server to pick', async () => {
  assert.equal(await captureUrl(() => fetchAiAdsLiveAnalytics(7)), '/api/ai-ads/performance/live?days=7');
  assert.equal(await captureUrl(() => fetchAiAdsLiveAnalytics(7, null)), '/api/ai-ads/performance/live?days=7');
  assert.equal(await captureUrl(() => fetchAiAdsLiveAnalytics(7, Number.NaN)), '/api/ai-ads/performance/live?days=7');
});

/**
 * The per-ad ranking is the slow half of this call — two extra Graph round trips, 6–7 s against
 * 1.31 s without them, measured in production — so every tab that does not render it asks for the
 * account half alone. The opt-out has to be spelled `include_ads=false`: the backend reads it as a
 * plain bool query param, and anything it cannot parse as false leaves the expensive default in
 * place, which would make the whole speed fix silently do nothing.
 *
 * Asking for the ranking sends no parameter at all, because `true` is already the server's default
 * and an existing caller's URL must not change.
 */
test('the ad ranking is opted out of explicitly, and opted in to by saying nothing', async () => {
  assert.equal(await captureUrl(() => fetchAiAdsLiveAnalytics(7, null, false)), '/api/ai-ads/performance/live?days=7&include_ads=false');
  assert.equal(
    await captureUrl(() => fetchAiAdsLiveAnalytics(30, 13, false)),
    '/api/ai-ads/performance/live?days=30&account_id=13&include_ads=false',
  );
  assert.equal(await captureUrl(() => fetchAiAdsLiveAnalytics(7, null, true)), '/api/ai-ads/performance/live?days=7');
});
