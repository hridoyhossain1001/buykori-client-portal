import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchClientStores, fetchDeferredData, fetchStoreOrderLedger, fetchStoreOrderWatermark } from './operationsApi';

test('preserves authoritative order pagination metadata', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    orders: [{ id: 2, orderId: 'WC-2', source: 'woocommerce', itemCount: 1, dataQuality: 'complete', syncStatus: 'accepted' }],
    total: 201,
    totalCount: 201,
    page: 2,
    limit: 100,
    hasMore: true,
  });

  try {
    const result = await fetchStoreOrderLedger();
    assert.equal(result.items[0].orderId, 'WC-2');
    assert.equal(result.totalCount, 201);
    assert.equal(result.page, 2);
    assert.equal(result.limit, 100);
    assert.equal(result.hasMore, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

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

test('keeps cancelled orders in Orders while removing them from Purchase Event Hold', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/api/v1/orders/workflow-statuses')) {
      return Response.json({
        statuses: { 'WC-10': 'pending', 'WC-11': 'cancelled' },
        cancelledOrders: [{
          id: 11,
          orderId: 'WC-11',
          status: 'cancelled',
          workflowStatus: 'cancelled',
          amount: 1200,
          recipientName: 'Cancelled Customer',
        }],
      });
    }
    if (url.includes('/api/deferred')) {
      const activeOrder = { id: 10, orderId: 'WC-10', status: 'pending', amount: 800 };
      return Response.json({
        pendingList: [activeOrder],
        deferredPendingList: [activeOrder],
        operationsPendingList: [activeOrder],
      });
    }
    return Response.json({}, { status: 404 });
  };

  try {
    const data = await fetchDeferredData();
    assert.deepEqual(data.deferredPendingList?.map(order => order.orderId), ['WC-10']);
    assert.deepEqual(data.operationsPendingList?.map(order => order.orderId), ['WC-10', 'WC-11']);
    assert.equal(data.operationsPendingList?.[1].workflowStatus, 'cancelled');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an order the courier rejected is put back in the Orders list', async () => {
  /**
   * `GET /deferred` builds `operationsPendingList` with
   * `PendingEvent.order_id.not_in(booked_order_ids_subq)`, and that subquery
   * selects every CourierOrder of the client with no status filter — so an order
   * whose booking the courier refused is treated as booked and dropped. Its
   * verification record is still live in `pendingList` in the same response
   * (the worker resets the PendingEvent to `status="pending"` on terminal
   * failure), and that record carries the `pending_event_id` a retry has to post.
   * Without this fold the one order that needs action is the one order the page
   * cannot show.
   */
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/api/v1/orders/workflow-statuses')) {
      return Response.json({ statuses: {}, cancelledOrders: [] });
    }
    if (url.includes('/api/deferred')) {
      const waiting = { id: 20, orderId: 'WC-20', status: 'pending', amount: 800 };
      const rejected = { id: 21, orderId: 'WC-21', status: 'pending', amount: 1850 };
      return Response.json({
        pendingList: [waiting, rejected],
        deferredPendingList: [waiting, rejected],
        operationsPendingList: [waiting],
      });
    }
    return Response.json({}, { status: 404 });
  };

  try {
    const data = await fetchDeferredData();
    assert.deepEqual(data.operationsPendingList?.map(order => order.orderId), ['WC-20', 'WC-21']);
    assert.equal(data.operationsPendingList?.[1].id, 21, 'the retry posts this id, so it must survive the fold');
    // The fold must not duplicate: WC-20 is in both lists already.
    assert.equal(data.operationsPendingList?.filter(order => order.orderId === 'WC-20').length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an old response with no operations list is not folded onto itself', async () => {
  // `operationsPendingList` was added after `pendingList`. When it is absent the
  // pending list *is* the operations list, so folding would list every order twice.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes('/api/v1/orders/workflow-statuses')) {
      return Response.json({ statuses: {}, cancelledOrders: [] });
    }
    if (url.includes('/api/deferred')) {
      const waiting = { id: 30, orderId: 'WC-30', status: 'pending', amount: 800 };
      return Response.json({ pendingList: [waiting], deferredPendingList: [waiting] });
    }
    return Response.json({}, { status: 404 });
  };

  try {
    const data = await fetchDeferredData();
    assert.deepEqual(data.operationsPendingList?.map(order => order.orderId), ['WC-30']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/**
 * The order watermark is a speed-up, not a feature: the Orders workspace polls
 * it every 2.5s so it can skip refetching 100 orders when nothing changed. A
 * backend that predates the route answers 404, and that must read as "no fast
 * path available" — not as a broken order screen. Every other failure still
 * throws, because a 500 or a dropped session is a real problem.
 */
test('a missing watermark route reads as no fast path, not as an error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ detail: 'Not Found' }, { status: 404 });

  try {
    assert.equal(await fetchStoreOrderWatermark(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a served watermark is read, and a server fault still raises', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ count: 412, lastChangedAt: '2026-09-02T04:05:06+00:00' });

  try {
    assert.deepEqual(await fetchStoreOrderWatermark(), {
      count: 412,
      lastChangedAt: '2026-09-02T04:05:06+00:00',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = async () => Response.json({ detail: 'Database is down' }, { status: 500 });
  try {
    await assert.rejects(fetchStoreOrderWatermark(), /Database is down/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
