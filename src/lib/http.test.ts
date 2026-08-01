import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiTimeoutError, apiFetch } from './http';

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
