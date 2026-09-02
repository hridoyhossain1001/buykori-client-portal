import assert from 'node:assert/strict';
import test from 'node:test';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  fetchWhatsAppConfirmations,
  fetchWhatsAppStatus,
  sendWhatsAppConfirmation,
  setWhatsAppAutoSend,
} from './whatsappApi';

const withFetch = async (
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test('reads the connected session and normalises missing fields', async () => {
  await withFetch(
    async () => Response.json({
      available: true,
      hasPlanAccess: true,
      connected: true,
      session: {
        status: 'connected',
        phoneNumber: '8801712345678',
        deviceLabel: null,
        dailySentCount: 7,
        dailyLimit: 100,
      },
      qr: null,
    }),
    async () => {
      const status = await fetchWhatsAppStatus();
      assert.equal(status.available, true);
      assert.equal(status.connected, true);
      assert.equal(status.session.status, 'connected');
      assert.equal(status.session.phoneNumber, '8801712345678');
      assert.equal(status.session.dailySentCount, 7);
      assert.equal(status.session.dailyLimit, 100);
      // Absent keys must become null, never undefined, so the UI can branch once.
      assert.equal(status.session.connectedAt, null);
      assert.equal(status.session.lastError, null);
      assert.equal(status.qr, null);
      // An older server that knows nothing about automatic sending must read as
      // "off", with the documented night window, not as undefined.
      assert.equal(status.autoSend, false);
      assert.deepEqual(status.autoSendQuietHours, { start: 22, end: 9 });
    },
  );
});

test('the automatic-sending switch and its quiet hours are read from the server', async () => {
  await withFetch(
    async () => Response.json({
      available: true,
      hasPlanAccess: true,
      connected: true,
      session: { status: 'connected' },
      autoSend: true,
      autoSendQuietHours: { start: 23, end: 7 },
      qr: null,
    }),
    async () => {
      const status = await fetchWhatsAppStatus();
      assert.equal(status.autoSend, true);
      assert.deepEqual(status.autoSendQuietHours, { start: 23, end: 7 });
    },
  );
});

test('a nonsense quiet-hour window falls back to the documented default', async () => {
  await withFetch(
    async () => Response.json({
      available: true,
      session: {},
      autoSendQuietHours: { start: 99, end: 'nine' },
    }),
    async () => {
      const status = await fetchWhatsAppStatus();
      assert.deepEqual(status.autoSendQuietHours, { start: 22, end: 9 });
    },
  );
});

test('turning automatic sending on posts the switch and returns the saved value', async () => {
  let seen: { url: string; method: string; body: unknown } | null = null;
  await withFetch(
    async (input, init) => {
      seen = {
        url: String(input),
        method: String(init?.method || 'GET').toUpperCase(),
        body: JSON.parse(String(init?.body || '{}')),
      };
      return Response.json({ success: true, autoSend: true });
    },
    async () => {
      const saved = await setWhatsAppAutoSend(true);
      assert.equal(saved, true);
      assert.ok(seen);
      assert.equal(seen!.method, 'POST');
      assert.ok(seen!.url.endsWith('/api/client/whatsapp/settings'));
      assert.deepEqual(seen!.body, { autoSend: true });
    },
  );
});

test('a refused switch surfaces the server detail so the plan gate is visible', async () => {
  await withFetch(
    async () => Response.json(
      { detail: 'Automatic WhatsApp order confirmations require the Growth plan.' },
      { status: 402 },
    ),
    async () => {
      await assert.rejects(setWhatsAppAutoSend(true), /Growth plan/);
    },
  );
});

test('a server without the feature reads as unavailable rather than failing', async () => {
  await withFetch(
    async () => Response.json({ available: false, hasPlanAccess: false, connected: false, session: {}, qr: null }),
    async () => {
      const status = await fetchWhatsAppStatus();
      assert.equal(status.available, false);
      assert.equal(status.session.status, 'disconnected');
      assert.equal(status.session.dailyLimit, 0);
    },
  );
});

test('connect returns the pairing QR and disconnect reports the gateway error', async () => {
  await withFetch(
    async (input, init) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (url.endsWith('/api/client/whatsapp/connect') && method === 'POST') {
        return Response.json({ success: true, status: 'qr_pending', qr: 'data:image/png;base64,AAA', phoneNumber: null });
      }
      if (url.endsWith('/api/client/whatsapp') && method === 'DELETE') {
        return Response.json({ success: true, disconnected: false, gatewayError: 'gateway unreachable' });
      }
      throw new Error(`unexpected request: ${method} ${url}`);
    },
    async () => {
      const connected = await connectWhatsApp();
      assert.equal(connected.status, 'qr_pending');
      assert.equal(connected.qr, 'data:image/png;base64,AAA');
      assert.equal(connected.phoneNumber, null);

      const stopped = await disconnectWhatsApp();
      assert.equal(stopped.disconnected, false);
      assert.equal(stopped.gatewayError, 'gateway unreachable');
    },
  );
});

test('a refused send surfaces the server detail verbatim', async () => {
  await withFetch(
    async () => Response.json(
      { detail: 'WhatsApp is not connected. Connect your number in Settings first.' },
      { status: 409 },
    ),
    async () => {
      await assert.rejects(sendWhatsAppConfirmation('WC-42'), /not connected/);
    },
  );
});

test('confirmations are keyed by order id and the request is capped', async () => {
  let requestedUrl = '';
  await withFetch(
    async (input) => {
      requestedUrl = String(input);
      return Response.json({
        available: true,
        confirmations: {
          'WC-42': { id: 9, orderId: 'WC-42', status: 'sent', phone: '8801712345678', expiresAt: '2026-08-29T10:00:00Z', customerNote: 'address ta change hobe' },
          'WC-43': { id: 10, status: 'confirmed' },
        },
      });
    },
    async () => {
      const result = await fetchWhatsAppConfirmations(
        Array.from({ length: 130 }, (_, index) => `WC-${index}`),
      );
      const ids = decodeURIComponent(requestedUrl.split('orderIds=')[1] || '').split(',');
      assert.equal(ids.length, 100, 'must never ask for more than the server accepts');
      assert.equal(result.available, true);
      assert.equal(result.confirmations['WC-42'].status, 'sent');
      assert.equal(result.confirmations['WC-42'].expiresAt, '2026-08-29T10:00:00Z');
      // What the customer wrote beside the 1/2 drives a visible pill, so it must
      // survive parsing; a row that carries none reads as null, not "".
      assert.equal(result.confirmations['WC-42'].customerNote, 'address ta change hobe');
      // A row without an orderId cannot be matched to a table row, so it is dropped.
      assert.equal(result.confirmations['WC-43'], undefined);
    },
  );
});

test('an empty order list never reaches the network', async () => {
  await withFetch(
    async () => { throw new Error('should not fetch'); },
    async () => {
      const result = await fetchWhatsAppConfirmations([]);
      assert.deepEqual(result, { available: false, confirmations: {} });
    },
  );
});
