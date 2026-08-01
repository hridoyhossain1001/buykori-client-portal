import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';

const port = 41_000 + Math.floor(Math.random() * 5_000);
const baseUrl = `http://127.0.0.1:${port}`;

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Mock server did not become ready.');
};

test('mock API honors the audited error and analytics contracts', async () => {
  const child = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BUYKORI_ALLOW_MOCK_SERVER_PRODUCTION: '1',
      BUYKORI_MOCK_SERVER_HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let childOutput = '';
  child.stdout.on('data', chunk => { childOutput += chunk; });
  child.stderr.on('data', chunk => { childOutput += chunk; });

  try {
    await waitForServer();

    const unknownPlatform = await fetch(`${baseUrl}/api/campaign-test`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platform: 'Unknown', eventName: 'Purchase' }),
    });
    assert.equal(unknownPlatform.status, 400);
    assert.match((await unknownPlatform.json()).error, /Unknown platform/);

    const malformedBulk = await fetch(`${baseUrl}/api/deferred/cancel-bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ order_ids: 'WC-9283' }),
    });
    assert.equal(malformedBulk.status, 400);

    const unknownRoute = await fetch(`${baseUrl}/api/not-a-real-route`);
    assert.equal(unknownRoute.status, 404);
    assert.match(unknownRoute.headers.get('content-type') || '', /application\/json/);

    const audience = await (await fetch(`${baseUrl}/api/v1/analytics/audience`)).json();
    assert.deepEqual(
      Object.keys(audience.district_funnel[0]),
      ['district', 'page_view', 'add_to_cart', 'initiate_checkout', 'purchase', 'revenue', 'currency']
    );

    const signalDoctor = await (await fetch(`${baseUrl}/api/v1/analytics/signal-doctor`)).json();
    assert.deepEqual(
      Object.keys(signalDoctor.signal_rates),
      ['event_id', 'user_match', 'email_or_phone', 'click_id', 'content_ids', 'value', 'utm']
    );
    assert.deepEqual(
      Object.keys(signalDoctor.issues[0]),
      ['severity', 'title', 'message', 'recommendation']
    );

    const trend = await (await fetch(`${baseUrl}/api/events/trend?days=7`)).json();
    assert.equal(trend.trend.length, 7);
  } catch (error) {
    throw new Error(`${(error as Error).message}\n${childOutput}`);
  } finally {
    child.kill();
  }
});
