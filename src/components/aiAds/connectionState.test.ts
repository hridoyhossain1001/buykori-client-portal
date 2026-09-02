import assert from 'node:assert/strict';
import test from 'node:test';

import { accountLinkState, analyticsAccountChoices, analyticsPickerState, connectionHealth, connectionIsLive, providerCardState } from './connectionState';
import type { AiAdsAdAccount, AiAdsConnection } from '../../services/aiAdsApi';

/**
 * Shaped after the owner's real workspace: Meta connected and spending, four ad accounts offered by
 * the OAuth connection, one of them linked and the one Analytics reads, and TikTok never connected.
 */
const connection = (overrides: Partial<AiAdsConnection> = {}): AiAdsConnection => ({
  id: 41,
  provider: 'meta',
  status: 'active',
  permission_status: 'granted',
  token_status: 'valid',
  scopes: ['ads_read', 'ads_management'],
  accounts: [{ external_account_id: 'act_4702', account_name: 'MM.com', currency: 'BDT' }],
  ...overrides,
});

const adAccount = (overrides: Partial<AiAdsAdAccount> = {}): AiAdsAdAccount => ({
  id: 14,
  platform: 'meta',
  external_account_id: 'act_4702',
  account_name: 'MM.com',
  account_currency: 'BDT',
  is_active: true,
  last_synced_at: '2026-08-29T04:00:00Z',
  ...overrides,
});

test('a disconnected connection is not live, an expired one still is', () => {
  assert.equal(connectionIsLive({ status: 'active' }), true);
  assert.equal(connectionIsLive({ status: 'DISCONNECTED' }), false);
  assert.equal(connectionIsLive({ status: 'revoked' }), false);
  assert.equal(connectionIsLive({ status: 'expired' }), true);
  assert.equal(connectionIsLive({ status: 'reauth_required' }), true);
});

// The point of the health read: only some live connections can still be read from, and calling the
// rest "Connected" is what lets a merchant sit in front of a green badge seeing no data.
test('a connection the platform will refuse is never called connected', () => {
  assert.equal(connectionHealth(connection()).label, 'Connected');
  assert.equal(connectionHealth(connection()).readable, true);
  assert.equal(connectionHealth(connection()).tone, 'success');

  const expiredToken = connectionHealth(connection({ token_status: 'expired' }));
  assert.equal(expiredToken.readable, false);
  assert.equal(expiredToken.label, 'Permission expired');
  assert.equal(expiredToken.tone, 'danger');

  assert.equal(connectionHealth(connection({ status: 'expired' })).readable, false);
  assert.equal(connectionHealth(connection({ status: 'reauth_required' })).label, 'Sign in again');
  assert.equal(connectionHealth(connection({ permission_status: 'revoked' })).label, 'Permission removed');
  assert.equal(connectionHealth(connection({ permission_status: 'revoked' })).readable, false);
});

test('a connection that still reads but wants attention says which kind', () => {
  const expiring = connectionHealth(connection({ status: 'expiring' }));
  assert.equal(expiring.readable, true);
  assert.equal(expiring.label, 'Expiring soon');
  assert.equal(expiring.tone, 'warning');

  const degraded = connectionHealth(connection({ permission_status: 'degraded' }));
  assert.equal(degraded.readable, true);
  assert.equal(degraded.label, 'Connected, limited');

  assert.equal(connectionHealth(connection({ status: 'refreshing' })).label, 'Renewing');
  // An unknown permission state on an otherwise healthy connection is not an alarm.
  assert.equal(connectionHealth(connection({ permission_status: 'unknown' })).label, 'Connected');
});

// Issue #2 as the owner reported it: Meta was connected and the card still showed a blue Connect.
test('a connected provider is offered a disconnect, not another connect', () => {
  const card = providerCardState([connection()], 'meta');

  assert.equal(card.connected, true);
  assert.equal(card.connection?.id, 41);
  assert.equal(card.badge?.label, 'Connected');
  assert.equal(card.action.kind, 'disconnect');
  assert.equal(card.action.label, 'Disconnect');
  assert.equal(card.action.variant, 'secondary');
});

test('a provider with nothing connected keeps its Connect button and claims nothing', () => {
  const card = providerCardState([connection()], 'tiktok');

  assert.equal(card.connected, false);
  assert.equal(card.connection, null);
  assert.equal(card.badge, null);
  assert.equal(card.action.kind, 'connect');
  assert.equal(card.action.variant, 'primary');
  assert.equal(providerCardState(null, 'meta').action.kind, 'connect');
  assert.equal(providerCardState([], 'meta').connected, false);
});

// A disconnected row stays in the list, and it must not make the provider look connected.
test('a disconnected row leaves the provider card offering a connect', () => {
  const card = providerCardState([connection({ status: 'disconnected', permission_status: 'revoked' })], 'meta');

  assert.equal(card.connected, false);
  assert.equal(card.action.kind, 'connect');
});

test('a connection that cannot read is offered a reconnect', () => {
  const card = providerCardState([connection({ token_status: 'expired' })], 'meta');

  assert.equal(card.connected, true);
  assert.equal(card.badge?.tone, 'danger');
  assert.equal(card.action.kind, 'reconnect');
  assert.equal(card.action.label, 'Reconnect');
  assert.equal(card.action.variant, 'primary');
});

// Newest first, the order `GET /ai-ads/connections` returns: a fresh reconnect decides the card.
test('the newest live connection decides the card', () => {
  const card = providerCardState([connection({ id: 52 }), connection({ id: 41, token_status: 'expired' })], 'meta');

  assert.equal(card.connection?.id, 52);
  assert.equal(card.action.kind, 'disconnect');
});

// Issue #3: every one of the four rows read "Select", and selecting one changed nothing on screen.
test('a linked ad account reads Selected and offers no button', () => {
  const state = accountLinkState([adAccount()], 'meta', 'act_4702', 14);

  assert.equal(state.selected, true);
  assert.equal(state.deactivated, false);
  assert.equal(state.badge?.label, 'Selected');
  assert.equal(state.badge?.tone, 'success');
  assert.equal(state.action, null);
  assert.equal(state.readsAnalytics, true);
  assert.equal(state.lastSyncedAt, '2026-08-29T04:00:00Z');
});

// Several accounts can be linked at once, so "which one is being read" is a separate fact from
// "which ones are linked", and it comes from the Analytics payload rather than being re-derived.
test('only the account Analytics reported reading is marked as the one in use', () => {
  const accounts = [adAccount(), adAccount({ id: 15, external_account_id: 'act_9911' })];

  assert.equal(accountLinkState(accounts, 'meta', 'act_4702', 15).readsAnalytics, false);
  assert.equal(accountLinkState(accounts, 'meta', 'act_9911', 15).readsAnalytics, true);
  assert.equal(accountLinkState(accounts, 'meta', 'act_9911', 15).selected, true);
  // No live payload yet, or none read: nothing is marked.
  assert.equal(accountLinkState(accounts, 'meta', 'act_4702', null).readsAnalytics, false);
  assert.equal(accountLinkState(accounts, 'meta', 'act_4702').readsAnalytics, false);
});

test('an account never linked keeps its Select button', () => {
  const state = accountLinkState([adAccount()], 'meta', 'act_1234', 14);

  assert.equal(state.selected, false);
  assert.equal(state.deactivated, false);
  assert.equal(state.badge, null);
  assert.equal(state.action?.label, 'Select');
  assert.equal(state.lastSyncedAt, undefined);
});

// A disconnect deactivates the rows instead of deleting them, so "linked" and "syncing" differ.
test('a deactivated row says it stopped syncing and can be selected again', () => {
  const state = accountLinkState([adAccount({ is_active: false, last_synced_at: null })], 'meta', 'act_4702', 14);

  assert.equal(state.selected, false);
  assert.equal(state.deactivated, true);
  assert.equal(state.readsAnalytics, false);
  assert.equal(state.badge?.label, 'Stopped syncing');
  assert.equal(state.action?.label, 'Select again');
  assert.equal(state.lastSyncedAt, null);
});

// The ad-account list is read separately and is allowed to fail. "Not selected" would then be a
// claim we cannot support, so the row falls back to exactly what it showed before.
test('an unreadable ad-account list claims nothing about any row', () => {
  const state = accountLinkState(null, 'meta', 'act_4702', 14);

  assert.equal(state.selected, false);
  assert.equal(state.deactivated, false);
  assert.equal(state.badge, null);
  assert.equal(state.action?.label, 'Select');
  assert.equal(state.lastSyncedAt, undefined);
});

// Two platforms can hand back the same external id, and a TikTok row must not light up because a
// Meta account of that id is linked. A row with no external id cannot be selected at all.
test('the platform is part of the match, and an id-less row stays plain', () => {
  assert.equal(accountLinkState([adAccount()], 'tiktok', 'act_4702', 14).selected, false);
  assert.equal(accountLinkState([adAccount({ platform: 'META' })], 'meta', 'act_4702', 14).selected, true);
  assert.equal(accountLinkState([adAccount()], 'meta', '', 14).badge, null);
});

// The picker may only offer accounts `/ai-ads/performance/live` will accept: the allow-list is built
// from the client's *active* ad accounts, so a deactivated row would be an option that always 404s.
test('only active linked accounts can be offered to the Analytics picker', () => {
  const choices = analyticsAccountChoices([
    adAccount(),
    adAccount({ id: 13, external_account_id: 'act_1301', account_name: 'Second store' }),
    adAccount({ id: 12, is_active: false, external_account_id: 'act_1200' }),
  ]);

  assert.deepEqual(choices.map(choice => choice.id), [14, 13]);
  assert.deepEqual(choices[1], { id: 13, platform: 'meta', name: 'Second store', externalId: 'act_1301' });
});

// An unread list is not an empty one. With no choices the picker disappears and the backend's own
// ranking stays in charge, which is what a merchant saw before there was a picker at all.
test('an unreadable ad-account list offers no choices rather than a guess', () => {
  assert.deepEqual(analyticsAccountChoices(null), []);
  assert.deepEqual(analyticsAccountChoices(undefined), []);
  assert.deepEqual(analyticsAccountChoices([]), []);
});

// A duplicate id would render two options that cannot be told apart, and a row with no usable id
// would render one that can never be sent.
test('duplicate and unusable ids are dropped, and a missing name is left empty for the caller', () => {
  const choices = analyticsAccountChoices([
    adAccount({ account_name: null }),
    adAccount(),
    { ...adAccount(), id: undefined as unknown as number },
  ]);

  assert.equal(choices.length, 1);
  assert.equal(choices[0].id, 14);
  assert.equal(choices[0].name, '');
});

// The merchant who reported this had four accounts offered and one linked: nothing to choose between,
// so the tab stays as it was. The picker is for the merchant who has linked a second one.
test('the picker stays hidden until there are two accounts to choose between', () => {
  const one = analyticsAccountChoices([adAccount()]);
  const two = analyticsAccountChoices([adAccount(), adAccount({ id: 13, external_account_id: 'act_1301' })]);

  assert.equal(analyticsPickerState(one, 14).visible, false);
  assert.equal(analyticsPickerState([], null).visible, false);
  assert.equal(analyticsPickerState(two, 14).visible, true);
});

// A select whose value matches no option shows its first one, which would name an account the
// numbers on screen never came from — the case where the live read failed and nothing reported an
// account, or where the chosen account has just been unlinked.
test('an unknown selection asks for a placeholder instead of naming an account', () => {
  const two = analyticsAccountChoices([adAccount(), adAccount({ id: 13, external_account_id: 'act_1301' })]);

  assert.deepEqual(analyticsPickerState(two, 13), { visible: true, value: '13', placeholder: false });
  assert.deepEqual(analyticsPickerState(two, null), { visible: true, value: '', placeholder: true });
  assert.deepEqual(analyticsPickerState(two, 99), { visible: true, value: '', placeholder: true });
});
