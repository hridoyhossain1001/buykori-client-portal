/**
 * Setup health — the prototype's `Health()` screen, rebuilt on the live
 * `/api/suggestions` payload. Presentation only: every request stays in
 * `App.tsx`, so this file imports no API helper and fires no fetch.
 *
 * Two prototype ideas survive intact, because the live backend can honour them:
 *
 *  - **A check closes when the check stops firing, not when someone says so.**
 *    `GET /suggestions` re-derives the list from the client's current settings
 *    on every read, so a row that is present is a check that currently fails.
 *  - **The score has to be traceable.** The strip states what raises it.
 *
 * One prototype idea is deliberately reversed. There the resolved badge reads
 * "Verified fixed"; here a row can carry `resolved: true` while the check is
 * still firing, because `resolved` is the merchant's own flag
 * (`POST /suggestions/toggle-resolve`) and nothing verifies it. Calling that
 * "verified" would be the exact dishonesty the prototype's own audit note warns
 * about, so it reads "Marked fixed" and the row says the check still finds it.
 *
 * Prototype fields with no live source are omitted rather than invented:
 * `firstSeen`, per-issue `evidence`, per-row re-scan verdicts (there is no
 * per-check endpoint — `POST /suggestions/ai-review` re-runs all of them), and
 * the "Resolved this month" tile (no resolution timestamps exist).
 */
import React from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, RefreshCw, RotateCcw, X, Zap } from 'lucide-react';
import { Suggestion } from '../../types';
import { Badge, Button, Card, MetricStrip, PageHeader, SectionTitle } from '../common';
import type { BadgeTone } from '../common';

export interface SetupHealthWorkspaceProps {
  /** Already de-duplicated by the container. */
  checks: Suggestion[];
  optScore: number;
  aiReviewing: boolean;
  handleAiReview: () => Promise<void>;
  toggleResolveSuggestion: (id: string, isNowResolved: boolean) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  /** Check ids with a resolve/hide request in flight. */
  suggestionBusyIds: string[];
  /** Local clock time of the last completed re-check; null until one runs here. */
  lastCheckedAt: string | null;
}

const SEVERITY_RANK: Record<Suggestion['severity'], number> = { Critical: 0, Warning: 1, Tip: 2 };
const SEVERITY_LABEL: Record<Suggestion['severity'], string> = { Critical: 'Critical', Warning: 'Warning', Tip: 'Suggestion' };
const SEVERITY_TONE: Record<Suggestion['severity'], BadgeTone> = { Critical: 'danger', Warning: 'warning', Tip: 'info' };
/** The prototype's toned `.health-icon` square, on the ramps Phase 1 re-pointed. */
const SEVERITY_TINT: Record<Suggestion['severity'], string> = {
  Critical: 'bg-rose-50 text-rose-700',
  Warning: 'bg-amber-50 text-amber-700',
  Tip: 'bg-blue-50 text-blue-700',
};

/** Icon | Issue and why it matters | Actions — the prototype's row rhythm, three columns
 *  instead of four because the live payload has one prose field for "why", not two. */
const ROW_GRID = 'md:grid md:grid-cols-[38px_minmax(0,1fr)_196px] md:items-start md:gap-3.5';

export function SetupHealthWorkspace({
  checks,
  optScore,
  aiReviewing,
  handleAiReview,
  toggleResolveSuggestion,
  dismissSuggestion,
  suggestionBusyIds,
  lastCheckedAt,
}: SetupHealthWorkspaceProps) {
  const [openFixId, setOpenFixId] = React.useState<string | null>(null);

  // Critical first, and anything the merchant marked fixed drops to the bottom:
  // it is still failing, but it is not what they should read first.
  const ordered = React.useMemo(
    () =>
      [...checks].sort((a, b) => {
        if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
        return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      }),
    [checks],
  );

  const open = ordered.filter(check => !check.resolved);
  const markedFixed = ordered.length - open.length;
  const criticalCount = open.filter(check => check.severity === 'Critical').length;
  const warningCount = open.filter(check => check.severity === 'Warning').length;

  const rescanButton = (
    <Button variant="primary" onClick={() => { void handleAiReview(); }} disabled={aiReviewing}>
      <RefreshCw className={`h-3.5 w-3.5 ${aiReviewing ? 'animate-spin' : ''}`} />
      {aiReviewing ? 'Checking…' : 'Check my setup'}
    </Button>
  );

  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Setup health"
        description="Every check below reads your current settings. Fix the setting, then run the check again."
        action={rescanButton}
      />

      <MetricStrip
        items={[
          {
            label: 'Tracking score',
            shortLabel: 'Score',
            value: `${optScore}%`,
            hint: open.length === 0 ? 'Nothing is holding the score down' : `${open.length} open ${open.length === 1 ? 'check lowers' : 'checks lower'} this score`,
            icon: <Zap className="h-3.5 w-3.5" />,
          },
          { label: 'Critical', value: String(criticalCount), hint: criticalCount === 0 ? 'None found' : 'Fix these first', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
          { label: 'Warnings', shortLabel: 'Warn', value: String(warningCount), hint: warningCount === 0 ? 'None found' : 'Improve when ready', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
          {
            label: 'Marked fixed',
            shortLabel: 'Fixed',
            value: String(markedFixed),
            hint: markedFixed === 0 ? 'Nothing marked fixed yet' : 'Still failing the check',
            icon: <Check className="h-3.5 w-3.5" />,
          },
        ]}
      />
      {ordered.length === 0 ? (
        <Card padding="lg">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--bk-radius-control)] bg-emerald-50 text-emerald-700">
              <Check className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-subtitle font-semibold text-[var(--bk-console-text)]">Every check passed</h2>
              <p className="mt-1.5 text-caption leading-relaxed text-[var(--bk-console-text-muted)]">
                Nothing in your tracking settings needs attention right now. Run the check again after you
                change a destination, a credential or the COD setting.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card flush padding="none">
          <div className="px-4 pt-5 pb-3.5">
            <SectionTitle
              title="Recommended fixes"
              detail={`A check closes only when it stops finding the problem · ${lastCheckedAt ? `last checked ${lastCheckedAt}` : 'checks ran when this page opened'}`}
              action={
                <Button variant="ghost" onClick={() => { void handleAiReview(); }} disabled={aiReviewing}>
                  <RefreshCw className={`h-3.5 w-3.5 ${aiReviewing ? 'animate-spin' : ''}`} />
                  {aiReviewing ? 'Checking…' : 'Check all again'}
                </Button>
              }
            />
          </div>

          <div className="flex min-h-12 flex-wrap items-baseline gap-x-6 gap-y-1.5 border-y border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)] px-4 py-2.5 text-label leading-snug text-[var(--bk-console-text-muted)]">
            <span className="flex items-baseline gap-1.5">
              <strong className="text-caption text-[var(--bk-console-text)]">{open.length}</strong> need attention
            </span>
            {markedFixed > 0 && (
              <span className="flex items-baseline gap-1.5">
                <strong className="text-caption text-[var(--bk-console-text)]">{markedFixed}</strong> marked fixed but still failing
              </span>
            )}
            <small className="w-full text-label text-[var(--bk-console-text-subtle)] md:ml-auto md:w-auto">
              Work from critical down to suggestion
            </small>
          </div>

          <div className={`${ROW_GRID} hidden border-b border-[var(--bk-console-border)] px-4 py-2.5 text-label font-bold uppercase leading-snug text-[var(--bk-console-text-muted)]`}>
            <span />
            <span>Issue and why it matters</span>
            <span>Actions</span>
          </div>

          <div>
            {ordered.map(check => {
              const busy = suggestionBusyIds.includes(check.id);
              const fixOpen = openFixId === check.id;
              const fixPanelId = `setup-health-fix-${check.id}`;
              return (
                <article
                  key={check.id}
                  className={`border-b border-[var(--bk-console-border)] last:border-b-0 ${check.resolved ? 'bg-[var(--bk-console-surface-muted)]' : ''}`}
                >
                  <div className={`${ROW_GRID} px-4 py-3.5`}>
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[var(--bk-radius-control)] ${check.resolved ? 'bg-emerald-50 text-emerald-700' : SEVERITY_TINT[check.severity]}`}
                      aria-hidden="true"
                    >
                      {check.resolved ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </span>

                    <div className="mt-2.5 min-w-0 md:mt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={check.resolved ? 'success' : SEVERITY_TONE[check.severity]}>
                          {check.resolved ? 'Marked fixed' : SEVERITY_LABEL[check.severity]}
                        </Badge>
                        {check.platform && (
                          <span className="text-label leading-snug text-[var(--bk-console-text-muted)]">{check.platform}</span>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-caption font-semibold leading-normal text-[var(--bk-console-text)]">
                        {check.title}
                      </h3>
                      <p className="mt-1 text-label leading-relaxed text-[var(--bk-console-text-muted)]">{check.explanation}</p>
                      {/* `resolved` is the merchant's own flag, and the row is only here because the
                          check fired again on this read. Saying so is the whole point of the page. */}
                      {check.resolved && (
                        <p className="mt-2 flex items-start gap-1.5 rounded-[var(--bk-radius-control)] border border-amber-200 bg-amber-50 px-2.5 py-2 text-label leading-relaxed text-amber-700">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>You marked this fixed, but the check still finds it. Change the setting, then run the check again.</span>
                        </p>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 md:mt-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-expanded={fixOpen}
                        aria-controls={fixPanelId}
                        aria-label={`How to fix: ${check.title}`}
                        className="whitespace-nowrap"
                        onClick={() => setOpenFixId(fixOpen ? null : check.id)}
                      >
                        {fixOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        How to fix
                      </Button>
                      <Button
                        variant={check.resolved ? 'secondary' : 'primary'}
                        size="sm"
                        disabled={busy}
                        className="whitespace-nowrap"
                        aria-label={`${check.resolved ? 'Reopen' : 'Mark fixed'}: ${check.title}`}
                        onClick={() => { void toggleResolveSuggestion(check.id, !check.resolved); }}
                      >
                        {busy ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : check.resolved ? (
                          <RotateCcw className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {check.resolved ? 'Reopen' : 'Mark fixed'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        className="col-span-2 whitespace-nowrap"
                        aria-label={`Hide this check: ${check.title}`}
                        onClick={() => { void dismissSuggestion(check.id); }}
                      >
                        <X className="h-3 w-3" />
                        Hide this check
                      </Button>
                    </div>
                  </div>

                  {fixOpen && (
                    <div
                      id={fixPanelId}
                      className="border-t border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)] px-4 py-3.5 md:pl-[54px]"
                    >
                      <p className="text-label font-bold uppercase leading-snug text-[var(--bk-console-text-muted)]">How to fix</p>
                      <p className="mt-1.5 whitespace-pre-line text-label leading-relaxed text-[var(--bk-console-text-body)]">
                        {check.fixAction}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

export default SetupHealthWorkspace;
