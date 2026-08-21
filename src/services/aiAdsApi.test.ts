import assert from 'node:assert/strict';
import test from 'node:test';

import { sendAiAdsChat } from './aiAdsApi';

test('ChatNow sends the message and conversation id to the backend only', async () => {
  const originalFetch = globalThis.fetch;
  let captured: { input?: string; init?: RequestInit } = {};
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = { input: String(input), init };
    return new Response(JSON.stringify({ conversation_id: 91, message: 'Connection confirmed.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const response = await sendAiAdsChat('Help me plan an ad.', 90);
    assert.equal(captured.input, '/api/ai-ads/chat');
    assert.equal(captured.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(captured.init?.body)), {
      message: 'Help me plan an ad.',
      conversation_id: 90,
    });
    assert.deepEqual(response, { conversation_id: 91, message: 'Connection confirmed.' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ChatNow renders a safe backend error and never requires a provider secret', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ detail: 'Chat is temporarily unavailable.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;

  try {
    await assert.rejects(() => sendAiAdsChat('Hello'), /Chat is temporarily unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
