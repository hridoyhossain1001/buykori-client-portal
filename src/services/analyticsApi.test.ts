import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAnalyticsBundle, fetchDashboardAnalytics } from './analyticsApi';

test('normalizes analytics payloads and preserves partial failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/overview')) return Response.json({ total_events: 12 });
    if (url.includes('/campaigns')) return Response.json({}, { status: 503 });
    if (url.includes('/audience')) return Response.json({ top_districts: [{ label: 'Dhaka', count: 8, percentage: 80 }] });
    if (url.includes('/signal-doctor')) return Response.json({ score: 75, signal_rates: {} });
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const result = await fetchAnalyticsBundle(7);
    assert.deepEqual(result.failedSections, ['sales source']);
    assert.deepEqual(result.overview?.funnel, []);
    assert.equal(result.campaigns, undefined);
    assert.equal(result.audience?.top_districts[0]?.label, 'Dhaka');
    assert.deepEqual(result.audience?.device_mix, []);
    assert.equal(result.signalDoctor?.signal_rates, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps dashboard sections independent when one request fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/trend')) return Response.json({}, { status: 500 });
    if (url.includes('/recovery-summary')) {
      return Response.json({
        browser_events: 4,
        server_events: 6,
        matched_events: 4,
        recovered_events: 2,
        recovery_rate: 33.3,
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  try {
    const result = await fetchDashboardAnalytics(7);
    assert.equal(result.trend, null);
    assert.equal(result.recoverySummary?.server_events, 6);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
