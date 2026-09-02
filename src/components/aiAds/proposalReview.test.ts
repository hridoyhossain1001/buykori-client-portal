import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildChangeRows,
  describeOperation,
  expiryState,
  formatStateValue,
  proposalCanBeConfirmed,
  riskTone,
  shortHash,
  statusTone,
} from './proposalReview';
import type { AiAdsProposal } from '../../services/aiAdsApi';


test('describeOperation humanises an operation slug', () => {
  assert.equal(describeOperation('pause_campaign'), 'Pause campaign');
  assert.equal(describeOperation('update-daily-budget'), 'Update daily budget');
  assert.equal(describeOperation(''), 'Proposed change');
  assert.equal(describeOperation(undefined), 'Proposed change');
});

test('riskTone escalates green → amber → red and collapses high/critical to danger', () => {
  assert.equal(riskTone('LOW'), 'success');
  assert.equal(riskTone('medium'), 'warning');
  assert.equal(riskTone('HIGH'), 'danger');
  assert.equal(riskTone('CRITICAL'), 'danger');
  assert.equal(riskTone('unknown'), 'neutral');
  assert.equal(riskTone(undefined), 'neutral');
});

test('statusTone preserves the old inline pill mapping', () => {
  assert.equal(statusTone('SUCCESS'), 'success');
  assert.equal(statusTone('connected'), 'success');
  assert.equal(statusTone('low'), 'success');
  assert.equal(statusTone('active'), 'success');
  assert.equal(statusTone('failed'), 'danger');
  assert.equal(statusTone('blocked'), 'danger');
  assert.equal(statusTone('critical'), 'danger');
  assert.equal(statusTone('high'), 'warning');
  assert.equal(statusTone('pending'), 'warning');
  assert.equal(statusTone('queued'), 'warning');
  assert.equal(statusTone('draft'), 'neutral');
  assert.equal(statusTone(''), 'neutral');
});

test('formatStateValue renders values compactly and marks absent values', () => {
  assert.equal(formatStateValue('ACTIVE'), 'ACTIVE');
  assert.equal(formatStateValue(0), '0');
  assert.equal(formatStateValue(false), 'false');
  assert.equal(formatStateValue(null), '—');
  assert.equal(formatStateValue(undefined), '—');
  assert.equal(formatStateValue('   '), '—');
  assert.equal(formatStateValue({ geo: ['BD'] }), '{"geo":["BD"]}');
});

test('buildChangeRows diffs requested_state against before_state, not exact_changes', () => {
  const rows = buildChangeRows(
    { daily_budget: 1000, status: 'ACTIVE' },
    { daily_budget: 1500, status: 'ACTIVE', name: 'Eid push' },
  );
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { field: 'daily_budget', label: 'Daily budget', before: '1000', after: '1500', isNew: false });
  assert.deepEqual(rows[1], { field: 'status', label: 'Status', before: 'ACTIVE', after: 'ACTIVE', isNew: false });
  // A key that does not exist in before_state is a new value, shown with an em dash before.
  assert.deepEqual(rows[2], { field: 'name', label: 'Name', before: '—', after: 'Eid push', isNew: true });
});

test('buildChangeRows treats a missing before_state as every field being new', () => {
  const rows = buildChangeRows(undefined, { status: 'PAUSED' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].before, '—');
  assert.equal(rows[0].after, 'PAUSED');
  assert.equal(rows[0].isNew, true);
});

test('buildChangeRows returns nothing when there is no requested_state', () => {
  assert.deepEqual(buildChangeRows({ a: 1 }, null), []);
  assert.deepEqual(buildChangeRows(null, undefined), []);
});

test('expiryState reports remaining minutes, expiry, and a missing timestamp', () => {
  const now = new Date('2026-08-24T00:00:00Z').getTime();
  assert.deepEqual(expiryState('2026-08-24T00:30:00Z', now), { expired: false, minutesLeft: 30, label: 'Expires in 30 minutes' });
  assert.deepEqual(expiryState('2026-08-24T00:00:45Z', now), { expired: false, minutesLeft: 1, label: 'Expires in 1 minute' });

  const expired = expiryState('2026-08-23T23:30:00Z', now);
  assert.equal(expired.expired, true);
  assert.equal(expired.label, 'Approval window expired');

  const missing = expiryState('not-a-date', now);
  assert.equal(missing.expired, false);
  assert.equal(missing.label, 'No expiry set');
  assert.ok(Number.isNaN(missing.minutesLeft));
});

test('shortHash abbreviates long hashes and leaves short ones intact', () => {
  assert.equal(shortHash('a'.repeat(64)), 'aaaaaaaaaaaa…');
  assert.equal(shortHash('abc123'), 'abc123');
  assert.equal(shortHash(''), '');
  assert.equal(shortHash(undefined), '');
});

const proposal: AiAdsProposal = {
  id: 1,
  account_id: 10,
  operation: 'pause_campaign',
  risk: 'MEDIUM',
  requested_state: { status: 'PAUSED' },
  exact_changes: { operation: 'pause_campaign', arguments: { status: 'PAUSED' } },
  policy_decision: { allowed: true, reasons: [] },
  proposal_hash: 'a'.repeat(64),
  status: 'pending',
  expires_at: '2026-08-24T00:30:00Z',
  created_at: '2026-08-24T00:00:00Z',
};

test('proposalCanBeConfirmed keeps its writes-off / pending / policy-allowed gate', () => {
  assert.equal(proposalCanBeConfirmed(proposal, false), false);
  assert.equal(proposalCanBeConfirmed(proposal, true), true);
  assert.equal(proposalCanBeConfirmed({ ...proposal, status: 'approved' }, true), false);
  assert.equal(proposalCanBeConfirmed({ ...proposal, policy_decision: { allowed: false, reasons: ['kill_switch_enabled'] } }, true), false);
});
