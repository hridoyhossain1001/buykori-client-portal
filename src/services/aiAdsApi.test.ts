import assert from 'node:assert/strict';
import test from 'node:test';

import {
  beginAiAdsOAuth,
  fetchAiAdsConversationMessages,
  fetchAiAdsConversations,
  requestAiAdsEmailStepUp,
  sendAiAdsChat,
  verifyAiAdsEmailStepUp,
} from './aiAdsApi';

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

test('ChatNow can restore the latest persisted conversation after refresh', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    if (String(input) === '/api/ai-ads/conversations') {
      return new Response(JSON.stringify([{ id: 91, title: 'AI Ads conversation', status: 'active', summary: null, updated_at: '2026-08-22T00:00:00Z' }]), { status: 200 });
    }
    return new Response(JSON.stringify([{ id: 1, role: 'user', content: 'How are you?', structured: null, created_at: '2026-08-22T00:00:00Z' }, { id: 2, role: 'assistant', content: 'I am ready to help.', structured: null, created_at: '2026-08-22T00:00:01Z' }]), { status: 200 });
  }) as typeof fetch;

  try {
    const conversations = await fetchAiAdsConversations();
    const messages = await fetchAiAdsConversationMessages(conversations[0].id);
    assert.deepEqual(messages.map(item => item.content), ['How are you?', 'I am ready to help.']);
    assert.deepEqual(requests, ['/api/ai-ads/conversations', '/api/ai-ads/conversations/91/messages']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('email step-up uses server routes and forwards only the short-lived grant to OAuth', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ input: String(input), init });
    if (String(input).endsWith('/start')) {
      return new Response(JSON.stringify({ status: 'sent', expires_in: 600, email_masked: 'a***@example.com' }), { status: 200 });
    }
    if (String(input).endsWith('/verify')) {
      return new Response(JSON.stringify({ step_up_grant: 'short-lived-grant', challenge_id: 41, scope: 'CREDENTIAL_CHANGE', expires_in: 600 }), { status: 200 });
    }
    return new Response(JSON.stringify({ authorization_url: 'https://provider.example/authorize' }), { status: 200 });
  }) as typeof fetch;

  try {
    await requestAiAdsEmailStepUp();
    const verified = await verifyAiAdsEmailStepUp('123456');
    await beginAiAdsOAuth('meta', { grant: verified.step_up_grant, challengeId: verified.challenge_id });

    assert.equal(requests[0].input, '/api/ai-ads/step-up/email/start');
    assert.equal(requests[1].input, '/api/ai-ads/step-up/email/verify');
    assert.deepEqual(JSON.parse(String(requests[1].init?.body)), { code: '123456' });
    assert.equal(new Headers(requests[2].init?.headers).get('X-Client-Step-Up'), 'short-lived-grant');
    assert.equal(new Headers(requests[2].init?.headers).get('X-Client-Step-Up-Id'), '41');
    assert.ok(!JSON.stringify(requests).includes('api_key'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
