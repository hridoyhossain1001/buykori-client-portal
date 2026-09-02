import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ActivityTrail, ConfirmDisconnectDialog, connectionIsLive, describeDisconnectResult, describeOauthFailure, maskTail, proposalCanBeConfirmed, stepUpCopy, toAccountRows, toCampaignRows } from './AIAdsView';
import type { AiAdsConnection, AiAdsDisconnectResult, AiAdsProposal } from '../services/aiAdsApi';


const proposal: AiAdsProposal = {
  id: 1,
  account_id: 10,
  operation: 'pause_campaign',
  risk: 'MEDIUM',
  requested_state: { status: 'PAUSED' },
  exact_changes: { status: ['ACTIVE', 'PAUSED'] },
  policy_decision: { allowed: true, reasons: [] },
  proposal_hash: 'a'.repeat(64),
  status: 'pending',
  expires_at: '2026-08-20T00:00:00Z',
  created_at: '2026-08-20T00:00:00Z',
};


test('read-only AI Ads mode never exposes proposal confirmation', () => {
  assert.equal(proposalCanBeConfirmed(proposal, false), false);
});

test('proposal confirmation still requires pending and policy-allowed state', () => {
  assert.equal(proposalCanBeConfirmed(proposal, true), true);
  assert.equal(proposalCanBeConfirmed({ ...proposal, status: 'approved' }, true), false);
  assert.equal(
    proposalCanBeConfirmed({ ...proposal, policy_decision: { allowed: false, reasons: ['kill_switch_enabled'] } }, true),
    false,
  );
});


// The regression these cover: /ai-ads/campaigns went to the page error boundary with
// "Cannot read properties of undefined (reading 'slice')". The campaign list is typed as an array of
// rows that always carry an external_campaign_id, and neither half of that type held at runtime.
test('an absent campaign list becomes an empty table instead of a crash', () => {
  assert.deepEqual(toCampaignRows(undefined), []);
  assert.deepEqual(toCampaignRows(null), []);
  assert.deepEqual(toCampaignRows({ detail: 'Not found' }), []);
  assert.deepEqual(toCampaignRows(''), []);
  assert.deepEqual(toCampaignRows([]), []);
});

test('a campaign row missing its external id keeps the rest of the list on screen', () => {
  const rows = toCampaignRows([
    { platform: 'meta', external_campaign_id: '120210987654321', name: 'Eid retargeting', status: 'active', account_name: 'Buykori BD' },
    { platform: 'tiktok', name: 'Never synced' },
    null,
    'not a row',
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].maskedId, '***4321');
  assert.equal(rows[0].accountName, 'Buykori BD');
  assert.equal(rows[1].name, 'Never synced');
  assert.equal(rows[1].maskedId, 'ID unavailable');
  assert.equal(rows[1].status, 'unknown');
  assert.equal(rows[1].accountName, 'Account unavailable');
  assert.notEqual(rows[0].key, rows[1].key);
});

test('an id too short to mask is never half-shown', () => {
  assert.equal(maskTail('120210987654321'), '***4321');
  assert.equal(maskTail('4821'), '***4821');
  assert.equal(maskTail('821'), 'ID unavailable');
  assert.equal(maskTail(''), 'ID unavailable');
  assert.equal(maskTail('   '), 'ID unavailable');
  assert.equal(maskTail(undefined), 'ID unavailable');
  assert.equal(maskTail(null), 'ID unavailable');
  assert.equal(maskTail(120210987654321), '***4321');
});

test('a connection with no account list renders no rows and offers no empty select', () => {
  assert.deepEqual(toAccountRows(undefined), []);
  assert.deepEqual(toAccountRows(null), []);
  const rows = toAccountRows([{ external_account_id: 'act_998877', account_name: 'Main ad account', currency: 'BDT' }, { account_name: 'Pending sync' }]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].externalId, 'act_998877');
  assert.equal(rows[0].maskedId, '***8877');
  assert.equal(rows[1].externalId, '');
  assert.equal(rows[1].currency, 'Currency unavailable');
  assert.notEqual(rows[0].key, rows[1].key);
});

/**
 * The activity trail is what makes a turn look like real work rather than a spinner, and it is
 * unreachable in the local demo (the AI Ads page sits behind the `aiAdsEnabled` gate, which the
 * demo profile never sets), so these render assertions are its only verification.
 */
const trail = (steps: Array<{ label: string; status: string }>, busy: boolean) =>
  renderToStaticMarkup(<ActivityTrail steps={steps} busy={busy} />);

test('a completed check and a refused check are marked differently, not both as success', () => {
  const html = trail([
    { label: 'Reading your campaigns', status: 'completed' },
    { label: 'That part of your account is not available to this login', status: 'denied' },
  ], false);
  assert.match(html, /Reading your campaigns/);
  assert.match(html, /That part of your account is not available to this login/);
  // One success marker and one warning marker — a denied check dressed as a tick would be a lie
  // about what the assistant actually managed to read.
  assert.equal(html.match(/text-emerald-600/g)?.length, 1);
  assert.equal(html.match(/text-amber-600/g)?.length, 1);
  assert.equal(html.match(/<li/g)?.length, 2);
});

test('an unknown status is treated as not-completed rather than as a success', () => {
  const html = trail([{ label: 'Checking spend and results', status: 'failed' }], false);
  assert.equal(html.match(/text-emerald-600/g), null);
  assert.equal(html.match(/text-amber-600/g)?.length, 1);
});

test('the trail shows a working line only while the turn is still in flight', () => {
  const steps = [{ label: 'Looking up your connected ad accounts', status: 'completed' }];
  const busy = trail(steps, true);
  assert.match(busy, /Working out what this means/);
  assert.match(busy, /animate-spin/);
  assert.equal(busy.match(/<li/g)?.length, 2);

  const settled = trail(steps, false);
  assert.doesNotMatch(settled, /Working out what this means/);
  assert.doesNotMatch(settled, /animate-spin/);
  assert.equal(settled.match(/<li/g)?.length, 1);
});

test('labels are rendered verbatim, so nothing the backend did not phrase can leak in', () => {
  const html = trail([{ label: 'Matching orders to ads', status: 'completed' }], false);
  // The component adds no wording of its own to a step; internals like tool names or account
  // ids can only appear here if the backend put them in the label.
  assert.doesNotMatch(html, /list_ad_accounts|get_performance|act_/);
  assert.equal(html.match(/>Matching orders to ads</g)?.length, 1);
});


/**
 * Disconnecting is the one destructive thing this page can do, and it used to happen with no
 * confirmation at all: the first click emailed a one-time code and the connection was gone as soon
 * as the code was accepted. These cover the guard, the wording, and the button that should not be
 * there — none of which is reachable in the local demo, because the AI Ads page sits behind the
 * `aiAdsEnabled` gate the demo profile never sets.
 */
const connection = (overrides: Partial<AiAdsConnection> = {}): AiAdsConnection => ({
  id: 7,
  provider: 'meta',
  status: 'active',
  permission_status: 'granted',
  token_status: 'valid',
  scopes: ['ads_read'],
  accounts: [],
  ...overrides,
});

const disconnectDialog = (item: AiAdsConnection) =>
  renderToStaticMarkup(<ConfirmDisconnectDialog connection={item} onConfirm={() => {}} onCancel={() => {}} />);

/** The id referenced by an ARIA attribute, so the test can prove it resolves. */
const referencedId = (html: string, attribute: string) =>
  html.match(new RegExp(`${attribute}="([^"]+)"`))?.[1] ?? null;

test('the disconnect confirmation names the platform and every consequence before anything is sent', () => {
  const html = disconnectDialog(connection());
  assert.ok(html.includes('role="dialog"'));
  const labelId = referencedId(html, 'aria-labelledby');
  const describeId = referencedId(html, 'aria-describedby');
  assert.ok(labelId && describeId, 'the consequences must be announced, not only shown');
  assert.match(html, new RegExp(`id="${labelId}"[^>]*>Disconnect Meta Ads\\?`));
  assert.ok(html.includes(`id="${describeId}"`));
  // The four things the server actually does, plus the one reassurance that stops a merchant
  // fearing their live ads are about to be touched.
  assert.match(html, /stop syncing/);
  assert.match(html, /action queue is cancelled/);
  assert.match(html, /waiting for your review is voided/);
  assert.match(html, /live ads are not changed/);
  assert.match(html, /one-time code is emailed/);
});

test('the safe choice is the one that opens focused, and the destructive one is marked as such', () => {
  const html = disconnectDialog(connection({ provider: 'tiktok' }));
  assert.match(html, />Disconnect TikTok Ads\?/);
  // Modal focuses the first focusable control, so "Keep connection" must come first in the markup.
  assert.ok(html.indexOf('Keep connection') < html.indexOf('>Disconnect<'), 'least-destructive action must come first');
  // Assert the palette family, not one exact shade. `Button`'s `danger` variant is a solid
  // `bg-rose-600` on the live tree and a soft `bg-rose-50` wash on the design-migration tree; both are
  // deliberate. What has to hold either way is that the destructive action is the only red one.
  const disconnectButton = html.slice(html.lastIndexOf('<button', html.indexOf('>Disconnect<')));
  assert.match(disconnectButton, /bg-rose-\d{2,3}/);
  assert.doesNotMatch(html.slice(0, html.indexOf('Keep connection')), /bg-rose-\d{2,3}/, 'only the destructive action is red');
});

test('an already-disconnected connection is not offered as still disconnectable', () => {
  assert.equal(connectionIsLive({ status: 'active' }), true);
  assert.equal(connectionIsLive({ status: 'disconnected' }), false);
  assert.equal(connectionIsLive({ status: 'DISCONNECTED' }), false);
  assert.equal(connectionIsLive({ status: 'revoked' }), false);
  // An expired or re-auth-needed connection still holds a stored token, so it must stay removable —
  // hiding the button there would leave a merchant with no way to clear it.
  assert.equal(connectionIsLive({ status: 'expired' }), true);
  assert.equal(connectionIsLive({ status: 'reauth_required' }), true);
});

test('the one-time code dialog says what it is gating, not just "verify this connection"', () => {
  assert.notEqual(stepUpCopy('disconnect').title, stepUpCopy('select').title);
  assert.match(stepUpCopy('disconnect').title, /disconnect/i);
  assert.equal(stepUpCopy('disconnect').cta, 'Disconnect');
  assert.match(stepUpCopy('connect').description, /sign-in/);
  assert.match(stepUpCopy('select').description, /read this ad account/);
  assert.match(stepUpCopy('confirm').description, /approve/);
  for (const action of ['connect', 'select', 'disconnect', 'confirm'] as const) {
    const copy = stepUpCopy(action);
    assert.ok(copy.title && copy.description && copy.cta, `${action} must have complete wording`);
  }
});

const result = (overrides: Partial<AiAdsDisconnectResult> = {}): AiAdsDisconnectResult => ({
  status: 'disconnected',
  repeated: false,
  deactivated_accounts: 0,
  invalidated_actions: 0,
  provider_revoke: { supported: true, succeeded: true, result_code: 'ok' },
  ...overrides,
});

test('the disconnect toast reports what the server actually did, not a flat success', () => {
  assert.match(describeDisconnectResult(result({ deactivated_accounts: 2, invalidated_actions: 1 })), /2 ad accounts stopped syncing and 1 queued action cancelled/);
  assert.match(describeDisconnectResult(result({ deactivated_accounts: 1 })), /1 ad account stopped syncing\./);
  assert.equal(describeDisconnectResult(result()), 'Connection disconnected.');
  assert.match(describeDisconnectResult(result({ repeated: true, deactivated_accounts: 5 })), /already disconnected/);
});

test('a revoke the provider never confirmed is not reported as a clean disconnect', () => {
  const html = describeDisconnectResult(result({ provider_revoke: { supported: true, succeeded: false, result_code: 'error' } }));
  assert.match(html, /did not confirm the revoke/);
  assert.match(html, /app settings/);
  // A provider that has no revoke endpoint at all is not something the merchant must act on.
  assert.equal(describeDisconnectResult(result({ provider_revoke: { supported: false, succeeded: false, result_code: null } })), 'Connection disconnected.');
});

test('a failed provider return is explained in the merchant\'s terms and always says what changed', () => {
  assert.match(describeOauthFailure('declined', 'Meta Ads'), /cancelled/);
  assert.match(describeOauthFailure('session_expired', 'Meta Ads'), /session ended/);
  assert.match(describeOauthFailure('not_available', 'Meta Ads'), /not enabled for this workspace/);
  assert.match(describeOauthFailure('invalid_request', 'TikTok Ads'), /took too long/);
  assert.match(describeOauthFailure('configuration', 'TikTok Ads'), /setup problem/);
  // An unrecognised or absent reason must still produce usable wording rather than a raw code.
  for (const reason of ['unexpected', 'something-new', '', null, undefined]) {
    const text = describeOauthFailure(reason, 'The ad platform');
    assert.match(text, /could not be connected/);
    assert.doesNotMatch(text, /something-new/);
  }
  // Every message reassures that nothing was half-saved, which is the actual server behaviour.
  for (const reason of ['declined', 'not_available', 'configuration', 'unexpected']) {
    assert.match(describeOauthFailure(reason, 'Meta Ads'), /Nothing changed|not saved/);
  }
});
