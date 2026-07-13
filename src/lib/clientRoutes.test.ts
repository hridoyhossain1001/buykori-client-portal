import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clientPathForPage,
  clientPathForSection,
  isClientPageId,
  resolveClientRoute,
} from './clientRoutes';

test('resolves canonical page routes', () => {
  assert.deepEqual(resolveClientRoute('/app/event-logs'), {
    pageId: 'event-logs',
    sectionId: null,
    canonicalPath: '/app/event-logs',
  });
  assert.equal(clientPathForPage('orders'), '/app/courier-shipping');
  assert.equal(isClientPageId('orders'), true);
  assert.equal(isClientPageId('unknown'), false);
});

test('keeps legacy dashboard entry points compatible', () => {
  for (const path of ['/', '/app', '/client/dashboard', '/client/dashboard/']) {
    assert.equal(resolveClientRoute(path)?.canonicalPath, '/app/dashboard');
  }
});

test('resolves settings section deep links', () => {
  assert.deepEqual(resolveClientRoute('/app/settings/conversions-api'), {
    pageId: 'settings',
    sectionId: 'settings-platforms',
    canonicalPath: '/app/settings/conversions-api',
  });
  assert.equal(
    clientPathForSection('settings', 'settings-whatsapp'),
    '/app/settings/alerts-notifications'
  );
  assert.equal(resolveClientRoute('/app/settings')?.canonicalPath, '/app/settings/store-connection');
  assert.equal(clientPathForPage('settings'), '/app/settings/store-connection');
});

test('rejects unrelated application paths', () => {
  assert.equal(resolveClientRoute('/plugin/connect'), null);
  assert.equal(resolveClientRoute('/unknown'), null);
});
