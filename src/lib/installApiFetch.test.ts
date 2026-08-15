import assert from 'node:assert/strict';
import test from 'node:test';

import { installApiFetch } from './installApiFetch';

type MockBrowser = {
  fetch: typeof fetch;
  location: {
    origin: string;
    pathname: string;
    assign: (path: string) => void;
  };
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

const installBrowser = (fetchImpl: typeof fetch) => {
  const assignedPaths: string[] = [];
  const mockBrowser: MockBrowser = {
    fetch: fetchImpl,
    location: {
      origin: 'https://client.buykori.app',
      pathname: '/dashboard',
      assign: (path) => assignedPaths.push(path),
    },
    setTimeout,
    clearTimeout,
  };
  Object.assign(globalThis, {
    window: mockBrowser,
    document: { cookie: '' },
  });
  installApiFetch();
  return { mockBrowser, assignedPaths };
};

test('a transient 401 is retried after the session probe succeeds', async () => {
  let profileCalls = 0;
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const path = new URL(String(input), 'https://client.buykori.app').pathname;
    calls.push(path);
    if (path === '/api/v1/auth/client/me') {
      return new Response('{"status":"success"}', { status: 200 });
    }
    profileCalls += 1;
    return new Response('{}', { status: profileCalls === 1 ? 401 : 200 });
  };
  const { mockBrowser, assignedPaths } = installBrowser(fetchImpl);

  const response = await mockBrowser.fetch('/api/profile');

  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['/api/profile', '/api/v1/auth/client/me', '/api/profile']);
  assert.deepEqual(assignedPaths, []);
});

test('a confirmed inactive session redirects to the login page', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const path = new URL(String(input), 'https://client.buykori.app').pathname;
    return new Response('{}', { status: path === '/api/v1/auth/client/me' ? 401 : 401 });
  };
  const { mockBrowser, assignedPaths } = installBrowser(fetchImpl);

  const response = await mockBrowser.fetch('/api/profile');

  assert.equal(response.status, 401);
  assert.deepEqual(assignedPaths, ['/client']);
});
