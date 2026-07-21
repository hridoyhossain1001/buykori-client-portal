import assert from 'node:assert/strict';
import test from 'node:test';
import { requestAccountDeletion, updateClientProfile } from './accountApi';

test('returns the typed profile and preserves API error details', async () => {
  const originalFetch = globalThis.fetch;
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { value: { cookie: '' }, configurable: true });

  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return Response.json({
        profile: {
          name: 'Rafi',
          email: 'rafi@example.com',
          notificationEmail: 'rafi@example.com',
          plan: 'Growth',
          eventsUsed: 10,
          eventsQuota: 100,
          renewalDate: '2026-08-01',
        },
      });
    }
    return Response.json({ detail: 'Deletion is already pending.' }, { status: 409 });
  };

  try {
    const profile = await updateClientProfile({
      name: 'Rafi',
      email: 'rafi@example.com',
      notificationEmail: 'rafi@example.com',
      ownerNotifyWhatsapp: false,
      ownerWhatsappNumber: '',
      emailCode: null,
      currentPassword: null,
    });
    assert.equal(profile.name, 'Rafi');
    await assert.rejects(requestAccountDeletion(), /Deletion is already pending/);
  } finally {
    globalThis.fetch = originalFetch;
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
