import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { EmailStepUpDialog, proposalCanBeConfirmed, providerConnection } from './AIAdsView';
import type { AiAdsConnection, AiAdsProposal } from '../services/aiAdsApi';

const metaConnection: AiAdsConnection = {
  id: 7,
  provider: 'meta',
  status: 'Active',
  permission_status: 'granted',
  token_status: 'valid',
  accounts: [],
  scopes: [],
};


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

test('provider card detects an active connection for its disconnect state', () => {
  assert.equal(providerConnection([metaConnection], 'meta')?.id, 7);
  assert.equal(providerConnection([{ ...metaConnection, provider: 'meta'.toUpperCase() as 'meta' }], 'meta')?.id, 7);
  assert.equal(providerConnection([metaConnection], 'tiktok'), undefined);
  assert.equal(providerConnection([{ ...metaConnection, status: 'revoked' }], 'meta'), undefined);
});

test('email step-up dialog is accessible and requires a complete six-digit code', () => {
  const html = renderToStaticMarkup(
    <EmailStepUpDialog
      notice="A verification code was sent to a***@example.com."
      code="12345"
      setCode={() => {}}
      busy={false}
      onVerify={() => {}}
      onResend={() => {}}
      onCancel={() => {}}
    />,
  );

  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-modal="true"'));
  assert.ok(html.includes('6-digit code'));
  assert.ok(html.includes('Send new code'));
  assert.match(html, /<button[^>]*disabled=""[^>]*>Continue<\/button>/);
});
