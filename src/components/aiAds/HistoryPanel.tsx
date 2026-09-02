import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { SkeletonTable } from '../common/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../common/Table';
import { JsonViewer } from '../common/JsonViewer';
import { describeOperation, riskTone, statusTone } from './proposalReview';
import { relativeTime } from '../eventLogs/eventLogUtils';
import { describeFetchError } from '../../lib/http';
import {
  fetchAiAdsActions,
  fetchAiAdsProposals,
  type AiAdsActionRow,
  type AiAdsProposal,
} from '../../services/aiAdsApi';

/**
 * The History tab: every proposal ever generated and every action ever attempted, both already
 * exposed by the backend (`GET /ai-ads/proposals`, `GET /ai-ads/actions`) and never surfaced. Each
 * endpoint returns at most the 100 most recent rows with no paging, so the panel says exactly that
 * rather than implying it is showing everything.
 */
export function HistoryPanel() {
  const [proposals, setProposals] = useState<AiAdsProposal[]>([]);
  const [actions, setActions] = useState<AiAdsActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [proposalRows, actionRows] = await Promise.all([fetchAiAdsProposals(), fetchAiAdsActions()]);
      setProposals(proposalRows);
      setActions(actionRows);
      setError('');
    } catch (err) {
      // A total load failure is shown as a retryable error, never as an empty "no history" —
      // the two read very differently to a merchant checking what the assistant has done.
      setError(describeFetchError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="space-y-4"><SkeletonTable rows={4} /><SkeletonTable rows={4} /></div>;
  }

  if (error) {
    return <ErrorState title="Could not load history" description={error} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[var(--bk-console-text)]">Proposals</h3>
          {proposals.length ? <span className="text-xs text-[var(--bk-console-text-subtle)]">Showing the 100 most recent</span> : null}
        </div>
        {proposals.length ? (
          <Table wrapperClassName="rounded-xl border border-[var(--bk-console-border)]" className="min-w-[560px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Operation</TableHeaderCell>
                <TableHeaderCell>Risk</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {proposals.map(proposal => (
                <TableRow key={proposal.id}>
                  <TableCell className="font-medium">{describeOperation(proposal.operation)}</TableCell>
                  <TableCell><Badge tone={riskTone(proposal.risk)}>{proposal.risk?.trim() || 'unknown'}</Badge></TableCell>
                  <TableCell><Badge tone={statusTone(proposal.status)}>{proposal.status.replaceAll('_', ' ')}</Badge></TableCell>
                  <TableCell className="text-[var(--bk-console-text-muted)]">{relativeTime(proposal.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState icon={History} compact title="No proposals yet" description="Proposals the assistant creates for your review will be listed here." />
        )}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-[var(--bk-console-text)]">Actions</h3>
          {actions.length ? <span className="text-xs text-[var(--bk-console-text-subtle)]">Showing the 100 most recent</span> : null}
        </div>
        {actions.length ? (
          <Table wrapperClassName="rounded-xl border border-[var(--bk-console-border)]" className="min-w-[640px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Operation</TableHeaderCell>
                <TableHeaderCell>Provider</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Reason</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>Details</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {actions.map(action => {
                const open = expanded === action.id;
                return (
                  <Fragment key={action.id}>
                    <TableRow>
                      <TableCell className="font-medium">{describeOperation(action.operation)}</TableCell>
                      <TableCell className="capitalize text-[var(--bk-console-text-muted)]">{action.provider || '—'}</TableCell>
                      <TableCell><Badge tone={statusTone(action.status)}>{action.status.replaceAll('_', ' ')}</Badge></TableCell>
                      <TableCell className="text-[var(--bk-console-text-muted)]">{action.error_code ? action.error_code.replaceAll('_', ' ') : '—'}</TableCell>
                      <TableCell className="text-[var(--bk-console-text-muted)]">{relativeTime(action.created_at)}</TableCell>
                      <TableCell>
                        {action.result ? (
                          <button
                            type="button"
                            onClick={() => setExpanded(open ? null : action.id)}
                            aria-expanded={open}
                            /* 44px on a phone, the table's own compact row from md
                               up. This table is `min-w-[640px]` in a scrolling
                               wrapper, so a thumb does reach this cell — but a
                               pseudo halo would be wrong here: consecutive rows put
                               these buttons ~40px apart, and two 44px halos would
                               overlap into each other's row. */
                            className="flex min-h-11 items-center gap-1 text-xs font-semibold text-[var(--bk-console-text-muted)] hover:text-[var(--bk-console-text)] md:min-h-0"
                          >
                            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            Technical details
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--bk-console-text-subtle)]">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                    {open && action.result ? (
                      <TableRow>
                        <TableCell colSpan={6}>
                          {/* JsonViewer paints its value types in 300-level
                              tones, which only read on a dark panel - on this
                              white row they measured under 2:1. Same shell
                              EventDetailsPanel uses. */}
                          <div className="rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
                            <JsonViewer value={action.result} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState icon={History} compact title="No actions yet" description="Once a proposal is approved and run by an operator, each attempt appears here with its result." />
        )}
      </section>
    </div>
  );
}

export default HistoryPanel;
