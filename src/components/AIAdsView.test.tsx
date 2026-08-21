import assert from 'node:assert/strict';
import test from 'node:test';

import { proposalCanBeConfirmed } from './AIAdsView';
import type { AiAdsProposal } from '../services/aiAdsApi';


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
