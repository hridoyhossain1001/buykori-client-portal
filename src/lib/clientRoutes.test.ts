import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clientPathForPage,
  clientPathForSection,
  isClientPageId,
  resolveClientRoute,
} from './clientRoutes';

test('resolves canonical page routes', () => {
  assert.deepEqual(resolveClientRoute('/event-logs'), {
    pageId: 'event-logs',
    sectionId: null,
    canonicalPath: '/event-logs',
  });
  assert.equal(clientPathForPage('orders'), '/courier-shipping');
  assert.equal(isClientPageId('orders'), true);
  assert.equal(isClientPageId('unknown'), false);
});

test('keeps legacy dashboard entry points compatible', () => {
  for (const path of ['/', '/app', '/client/dashboard', '/client/dashboard/']) {
    assert.equal(resolveClientRoute(path)?.canonicalPath, '/dashboard');
  }
  assert.equal(resolveClientRoute('/app/incomplete-orders')?.canonicalPath, '/incomplete-orders');
  assert.equal(resolveClientRoute('/app/event-logs')?.canonicalPath, '/event-logs');
});

test('resolves a payment success route with its reference', () => {
  assert.deepEqual(resolveClientRoute('/order-success/BKP-TEST-123'), {
    pageId: 'order-success',
    sectionId: null,
    canonicalPath: '/order-success/BKP-TEST-123',
  });
});

test('resolves settings section deep links', () => {
  assert.deepEqual(resolveClientRoute('/settings/conversions-api'), {
    pageId: 'settings',
    sectionId: 'settings-platforms',
    canonicalPath: '/settings/conversions-api',
  });
  assert.equal(
    clientPathForSection('settings', 'settings-whatsapp'),
    '/settings/alerts-notifications'
  );
  assert.equal(resolveClientRoute('/settings')?.canonicalPath, '/settings/store-connection');
  assert.equal(resolveClientRoute('/app/settings/conversions-api')?.canonicalPath, '/settings/conversions-api');
  assert.equal(clientPathForPage('settings'), '/settings/store-connection');
});

test('rejects unrelated application paths', () => {
  assert.equal(resolveClientRoute('/plugin/connect'), null);
  assert.equal(resolveClientRoute('/unknown'), null);
});
