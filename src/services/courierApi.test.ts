import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCourierOrdersPage, normalizeCourierOrdersPayload, normalizePathaoStoresPayload } from './courierApi';

test('normalizes wrapped courier orders returned by the API', () => {
  const orders = normalizeCourierOrdersPayload({
    orders: [{
      id: '42',
      order_id: 9283,
      courier_provider: 'steadfast',
      courier_status: 'pending',
      recipient_name: 'Rafi',
      cod_amount: '2490',
      products: [{ name: 'Hoodie', quantity: 1 }],
    }],
  });

  assert.equal(orders.length, 1);
  assert.equal(orders[0].id, 42);
  assert.equal(orders[0].order_id, '9283');
  assert.equal(orders[0].cod_amount, 2490);
  assert.equal(orders[0].products?.[0]?.name, 'Hoodie');
});

test('preserves wrapped courier pagination metadata', () => {
  const page = normalizeCourierOrdersPage({
    orders: [{ id: 42, order_id: 'WC-42', courier_status: 'pending' }],
    totalCount: 101,
    offset: 50,
    limit: 50,
    hasMore: true,
  });

  assert.equal(page.items[0].order_id, 'WC-42');
  assert.equal(page.totalCount, 101);
  assert.equal(page.offset, 50);
  assert.equal(page.limit, 50);
  assert.equal(page.hasMore, true);
});

test('supports raw and wrapped Pathao store responses', () => {
  assert.deepEqual(normalizePathaoStoresPayload({
    stores: [{ store_id: 'demo-store', store_name: 'Demo Pickup' }],
  }), [{ store_id: 'demo-store', store_name: 'Demo Pickup' }]);

  assert.deepEqual(normalizePathaoStoresPayload([
    { store_id: 12, store_name: 'Dhaka Store' },
  ]), [{ store_id: 12, store_name: 'Dhaka Store' }]);
});
