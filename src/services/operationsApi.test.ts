import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchClientStores } from './operationsApi';

test('normalizes backend store id for Sidebar store switching', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    stores: [
      { id: 7, name: 'Main Store', domain: 'shop.test', is_current: true },
      { client_id: 8, name: 'Second Store', domain: '', is_current: false },
      { name: 'Invalid Store' },
    ],
  });

  try {
    assert.deepEqual(await fetchClientStores(), [
      { client_id: 7, name: 'Main Store', domain: 'shop.test', is_current: true },
      { client_id: 8, name: 'Second Store', domain: '', is_current: false },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
