import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiTimeoutError, apiFetch, describeFetchError, describeResponseError } from './http';

const abortAwareFetch = (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

test('apiFetch preserves caller cancellation', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = abortAwareFetch as typeof fetch;
  const controller = new AbortController();
  try {
    const request = apiFetch('/api/profile', { signal: controller.signal, timeoutMs: 1_000 });
    controller.abort(new DOMException('Route changed', 'AbortError'));
    await assert.rejects(request, (error: unknown) => (error as Error).name === 'AbortError');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('apiFetch reports its own deadline as ApiTimeoutError', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = abortAwareFetch as typeof fetch;
  const keepEventLoopAlive = setTimeout(() => undefined, 100);
  try {
    await assert.rejects(
      apiFetch('/api/profile', { timeoutMs: 10 }),
      (error: unknown) => error instanceof ApiTimeoutError
    );
  } finally {
    clearTimeout(keepEventLoopAlive);
    globalThis.fetch = originalFetch;
  }
});

/**
 * UX-02: no merchant should ever read "TypeError: Failed to fetch". Every branch
 * has to return one actionable sentence.
 */

test('describeFetchError translates a connection failure', () => {
  const message = describeFetchError(new TypeError('Failed to fetch'));
  assert.ok(!message.includes('TypeError'));
  assert.ok(!message.includes('Failed to fetch'));
  assert.match(message, /connection/i);
});

test('describeFetchError reports both timeout shapes the app can throw', () => {
  assert.match(describeFetchError(new ApiTimeoutError()), /timed out/i);
  const domTimeout = Object.assign(new Error('API request timed out.'), { name: 'TimeoutError' });
  assert.match(describeFetchError(domTimeout), /timed out/i);
});

test('describeFetchError prefers the offline hint when the browser is offline', () => {
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: false },
    configurable: true,
  });
  try {
    assert.match(describeFetchError(new TypeError('Failed to fetch')), /offline/i);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
    });
  }
});

test('describeFetchError always falls back to something actionable', () => {
  for (const value of [null, undefined, 'boom', {}, new Error('x')]) {
    const message = describeFetchError(value);
    assert.ok(message.length > 0);
    assert.match(message, /try again/i);
  }
});

test('describeResponseError maps status codes without leaking status text', () => {
  assert.match(describeResponseError({ status: 401 }), /session expired/i);
  assert.match(describeResponseError({ status: 403 }), /access/i);
  assert.match(describeResponseError({ status: 404 }), /could not find/i);
  assert.match(describeResponseError({ status: 429 }), /too many requests/i);
  assert.match(describeResponseError({ status: 500 }), /server had a problem/i);
  assert.match(describeResponseError({ status: 503 }), /server had a problem/i);
  assert.match(describeResponseError({ status: 418 }), /try again/i);
});
