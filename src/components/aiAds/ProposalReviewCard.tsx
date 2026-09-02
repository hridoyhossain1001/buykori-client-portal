import { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Clock, ShieldAlert } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { JsonViewer } from '../common/JsonViewer';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../common/Table';
import {
  buildChangeRows,
  describeOperation,
  expiryState,
  proposalCanBeConfirmed,
  riskTone,
  shortHash,
  statusTone,
} from './proposalReview';
import type { AiAdsProposal } from '../../services/aiAdsApi';

/**
 * One sentence explaining why a proposal cannot be confirmed right now, instead of a bare status
 * pill. The order is a precedence: a policy block is the strongest reason, then an already-decided
 * proposal, then an expired window, and finally review-only mode — which is the truthful production
 * state, because live writes are disabled there and the confirm gate depends on them.
 */
function notConfirmableReason(proposal: AiAdsProposal, writesEnabled: boolean, expired: boolean): string {
  if (proposal.policy_decision.allowed === false) {
    return 'This change is blocked by policy and cannot be approved. See the reasons above.';
  }
  if (proposal.status !== 'pending') {
    return `This proposal is already ${proposal.status.replaceAll('_', ' ')}, so it is no longer awaiting your review.`;
  }
  if (expired) {
    return 'This approval window has expired. Ask the assistant to prepare a fresh proposal to review.';
  }
  if (!writesEnabled) {
    return 'AI Ads is in review-only mode, so running this change is disabled. You can still review exactly what it would do below.';
  }
  return 'This proposal cannot be confirmed right now.';
}

/**
 * A proposal a merchant can actually read before deciding: what operation, how risky, what each
 * field changes from and to, and how long the approval is still valid. Replaces the old row that
 * showed nothing but a 64-character hash.
 *
 * `now` is injected (defaulting to `Date.now()`) so the expiry line and the confirm gate can be
 * exercised deterministically, keeping this component thin over the tested pure presenters.
 */
export function ProposalReviewCard({
  proposal,
  writesEnabled,
  busy,
  onConfirm,
  now = Date.now(),
}: {
  proposal: AiAdsProposal;
  writesEnabled: boolean;
  busy: string;
  onConfirm: (proposal: AiAdsProposal) => void;
  now?: number;
}) {
  const [showTech, setShowTech] = useState(false);
  const rows = buildChangeRows(proposal.before_state, proposal.requested_state);
  const expiry = expiryState(proposal.expires_at, now);
  const canConfirm = proposalCanBeConfirmed(proposal, writesEnabled) && !expiry.expired;
  const reasons = proposal.policy_decision.reasons ?? [];

  return (
    <div className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-bold text-[var(--bk-console-text)]">{describeOperation(proposal.operation)}</h4>
            <Badge tone={riskTone(proposal.risk)}>{proposal.risk?.trim() ? `${proposal.risk} risk` : 'Risk unknown'}</Badge>
            <Badge tone={statusTone(proposal.status)}>{proposal.status.replaceAll('_', ' ')}</Badge>
          </div>
          <p className={`mt-1 flex items-center gap-1.5 text-xs ${expiry.expired ? 'font-semibold text-rose-600' : 'text-[var(--bk-console-text-muted)]'}`}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {expiry.label}
          </p>
        </div>
        {canConfirm && (
          <Button
            variant="primary"
            onClick={() => onConfirm(proposal)}
            disabled={busy === `proposal-${proposal.id}`}
          >
            <Check className="h-4 w-4" />
            Confirm exact proposal
          </Button>
        )}
      </div>

      {reasons.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{reasons.join(', ')}</span>
        </p>
      )}

      <div className="mt-3">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--bk-console-text-muted)]">
          What changes
        </p>
        {rows.length > 0 ? (
          <Table wrapperClassName="rounded-lg border border-[var(--bk-console-border)]" className="min-w-[420px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Field</TableHeaderCell>
                <TableHeaderCell>Before</TableHeaderCell>
                <TableHeaderCell>After</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.field}>
                  <TableCell>
                    <span className="flex items-center gap-1.5 font-medium">
                      {row.label}
                      {row.isNew && <Badge tone="info" size="sm">New</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--bk-console-text-muted)]">{row.before}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold">{row.after}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-[var(--bk-console-text-muted)]">
            No field-level changes were described for this proposal.
          </p>
        )}
      </div>

      {!canConfirm && (
        <p className="mt-3 text-xs text-[var(--bk-console-text-muted)]">
          {notConfirmableReason(proposal, writesEnabled, expiry.expired)}
        </p>
      )}

      <div className="mt-3 border-t border-[var(--bk-console-border)] pt-3">
        <button
          type="button"
          onClick={() => setShowTech(current => !current)}
          aria-expanded={showTech}
          /* 16px of ink, 44px of target. A disclosure this quiet should not
             deepen the card by 28px, so the height is an `::after` halo on the y
             axis; the row above it is a table or a sentence, never a control. */
          className="relative flex items-center gap-1 text-xs font-semibold text-[var(--bk-console-text-muted)] after:absolute after:inset-x-0 after:-inset-y-3.5 after:content-[''] hover:text-[var(--bk-console-text)]"
        >
          {showTech ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          Technical details
        </button>
        {showTech && (
          <div className="mt-2 space-y-2">
            {/* Dark shell: JsonViewer's value tones are 300-level and are
                unreadable on the card's own light surface. */}
            <div className="rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
              <JsonViewer
                value={{
                  before_state: proposal.before_state ?? null,
                  requested_state: proposal.requested_state,
                  exact_changes: proposal.exact_changes,
                }}
              />
            </div>
            <p className="break-all font-mono text-[11px] text-[var(--bk-console-text-subtle)]">
              Hash {proposal.proposal_hash}
            </p>
          </div>
        )}
        {!showTech && proposal.proposal_hash && (
          <p className="mt-1 font-mono text-[11px] text-[var(--bk-console-text-subtle)]">
            Hash {shortHash(proposal.proposal_hash)}
          </p>
        )}
      </div>
    </div>
  );
}

export default ProposalReviewCard;
