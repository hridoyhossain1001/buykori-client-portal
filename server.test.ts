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

    /**
     * The two order lists are not copies of each other, and the local preview is
     * only worth reviewing if it reproduces that. Production's `GET /deferred`
     * excludes any order that has a consignment row from `operationsPendingList`
     * (`PendingEvent.order_id.not_in(booked_order_ids_subq)`, no status filter),
     * while `pendingList` keeps every PendingEvent still at `status="pending"` —
     * which includes an order the courier rejected, because the booking worker
     * resets that one back to pending. Seed data holds one of each.
     */
    const deferredLists = await (await fetch(`${baseUrl}/api/deferred`)).json();
    const inPending = (orderId: string) => deferredLists.pendingList.some((order: { orderId: string }) => order.orderId === orderId);
    const inOperations = (orderId: string) => deferredLists.operationsPendingList.some((order: { orderId: string }) => order.orderId === orderId);

    assert.equal(inPending('WC-9284'), true, 'an unbooked order waits in both lists');
    assert.equal(inOperations('WC-9284'), true);
    assert.equal(inPending('WC-9285'), true, 'a rejected booking keeps its verification record');
    assert.equal(inOperations('WC-9285'), false, 'but the booked-order subquery drops it');
    assert.equal(inPending('WC-9283'), false, 'a booked order leaves both lists');
    assert.equal(inOperations('WC-9283'), false);
    assert.equal(deferredLists.operationsPendingCount, deferredLists.operationsPendingList.length);

    const audience = await (await fetch(`${baseUrl}/api/v1/analytics/audience`)).json();
    assert.deepEqual(
      Object.keys(audience.district_funnel[0]),
      ['district', 'page_view', 'add_to_cart', 'initiate_checkout', 'purchase', 'revenue', 'currency']
    );

    const campaigns = await (await fetch(`${baseUrl}/api/v1/analytics/campaigns`)).json();
    assert.deepEqual(
      Object.keys(campaigns.campaigns[0]),
      ['source', 'campaign', 'view_content', 'add_to_cart', 'initiate_checkout', 'purchase', 'revenue', 'currency']
    );

    const recoverySummary = await (await fetch(`${baseUrl}/api/events/recovery-summary`)).json();
    assert.equal(typeof recoverySummary.matched_events, 'number');
    assert.equal(recoverySummary.matched_events <= recoverySummary.server_events, true);

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

    const capturedOrdersResponse = await fetch(`${baseUrl}/api/v1/orders?limit=20`);
    assert.equal(capturedOrdersResponse.status, 200);
    const capturedOrders = await capturedOrdersResponse.json();
    // Three, not two: the demo dataset gained WC-9285, the order whose courier
    // booking failed, so the preview can reach the retry path. /api/v1/orders
    // mirrors `pendingOrders`, so it counts that row too.
    assert.equal(capturedOrders.orders.length, 3);
    assert.equal(capturedOrders.orders[0].dataQuality, 'complete');

    const intakeHealth = await (await fetch(`${baseUrl}/api/v1/orders/intake-health?hours=24`)).json();
    assert.equal(intakeHealth.status, 'healthy');
    assert.equal(intakeHealth.incomplete, 0);

    const pathaoCities = await (await fetch(`${baseUrl}/api/courier/pathao/cities`)).json();
    assert.equal(pathaoCities[0].city_name, 'Dhaka');
    const pathaoZones = await (await fetch(`${baseUrl}/api/courier/pathao/zones?city_id=1`)).json();
    assert.equal(pathaoZones[0].zone_name, 'Dhaka North');
    const pathaoAreas = await (await fetch(`${baseUrl}/api/courier/pathao/areas?zone_id=11`)).json();
    assert.equal(pathaoAreas[0].area_name, 'Uttara');

    const steadfastWebhookResponse = await fetch(`${baseUrl}/api/courier/steadfast/webhook-secret`, { method: 'POST' });
    assert.equal(steadfastWebhookResponse.status, 200);
    const steadfastWebhook = await steadfastWebhookResponse.json();
    assert.equal(typeof steadfastWebhook.secret, 'string');
    assert.equal(steadfastWebhook.callback_url, 'https://api.buykori.app/api/v1/webhook/steadfast');
    assert.equal(steadfastWebhook.verified_at, null);

    const redxWebhookResponse = await fetch(`${baseUrl}/api/courier/redx/webhook-secret`, { method: 'POST' });
    assert.equal(redxWebhookResponse.status, 200);
    const redxWebhook = await redxWebhookResponse.json();
    assert.equal(typeof redxWebhook.secret, 'string');
    assert.equal(redxWebhook.callback_url.startsWith('https://api.buykori.app/api/v1/webhook/redx?token='), true);
    assert.equal(redxWebhook.verified_at, null);

    const configuredCourierSettings = await (await fetch(`${baseUrl}/api/courier/settings`)).json();
    assert.equal(configuredCourierSettings.steadfast_webhook_token_configured, true);
    assert.equal(configuredCourierSettings.redx_webhook_secret_configured, true);

    const pathaoBooking = await fetch(`${baseUrl}/api/courier/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pending_event_id: 101,
        courier_provider: 'pathao',
        recipient_name: 'Rafi Ahmed',
        recipient_phone: '01711112222',
        recipient_address: 'Mirpur, Dhaka',
        cod_amount: 2490,
      }),
    });
    assert.equal(pathaoBooking.status, 200);
    const pathaoBookingBody = await pathaoBooking.json();
    assert.equal(pathaoBookingBody.order.courier_provider, 'pathao');
    assert.equal(typeof pathaoBookingBody.tracking_id, 'string');
  } catch (error) {
    throw new Error(`${(error as Error).message}\n${childOutput}`);
  } finally {
    child.kill();
  }
});
