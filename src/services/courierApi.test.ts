import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCourierOrdersPayload, normalizePathaoStoresPayload } from './courierApi';

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

test('supports raw and wrapped Pathao store responses', () => {
  assert.deepEqual(normalizePathaoStoresPayload({
    stores: [{ store_id: 'demo-store', store_name: 'Demo Pickup' }],
  }), [{ store_id: 'demo-store', store_name: 'Demo Pickup' }]);

  assert.deepEqual(normalizePathaoStoresPayload([
    { store_id: 12, store_name: 'Dhaka Store' },
  ]), [{ store_id: 12, store_name: 'Dhaka Store' }]);
});
