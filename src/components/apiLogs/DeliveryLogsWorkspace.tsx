/**
 * The prototype's "Delivery logs" screen, rebuilt on the live endpoints.
 *
 * Four decisions here come straight from what the backend can actually answer,
 * and each replaces something the prototype drew from a fixture:
 *
 *  - **No "average latency" tile.** `GET /api-logs` and `GET /events` both send
 *    `latencyMs: null` for every row, so the prototype's 428ms is a number this
 *    system cannot produce. The fourth tile counts what an operator can act on
 *    instead: requests waiting for a manual retry.
 *  - **The window is named.** `GET /delivery/health` aggregates a fixed seven
 *    days. The tiles say so rather than implying "today".
 *  - **Retry is a real control.** `/api-logs` already returns `outboxId` and a
 *    verified `retryable` flag per row, and `POST /outbox/{id}/retry` already
 *    exists, so a failed delivery can be requeued from the row it failed on.
 *    Rows the backend has not cleared as retryable show no button -- the 409 is
 *    a classification, not a UI state to guess at.
 *  - **Every row is paged, none is silently dropped.** The old table cut itself
 *    off at 40 rows while the export stayed uncapped. Paging shows all of what
 *    loaded, so there is nothing to disclose.
 *
 * Presentation only: no fetch, no mutation, no API import. `rows` arrive already
 * redacted -- `endpoint` carries a GA4 `api_secret` in its query string, so
 * `ApiLogsView` runs `redactApiLogs` before anything reaches this file.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import type { APILog } from '../../types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  MetricStrip,
  PageHeader,
  PaginationControls,
  SkeletonCards,
  SkeletonTable,
  TableHeaderCell,
} from '../common';
import type { MetricStripItem } from '../common';
import { PlatformLogo } from '../common/PlatformLogo';

/** 12 requests fills the panel without a second scroll container inside it. */
const PAGE_SIZE = 12;

/**
 * One row of `GET /delivery/health` → `platforms[]`. Shaped by the backend, so
 * `ApiLogsView` imports this rather than declaring its own copy.
 */
export type PlatformHealth = {
  platform: string;
  configured: boolean;
  successful: number;
  failed: number;
  queued: number;
  dead: number;
  successRate: number | null;
  state: 'healthy' | 'retrying' | 'action_required' | 'no_data';
};

/** Health and history are two separate requests, so each carries its own state. */
export type PanelState = 'loading' | 'error' | 'empty' | 'ready';

interface DeliveryLogsWorkspaceProps {
  /** Already through `redactApiLogs` — see the file header. */
  rows: APILog[];
  /** Row count before this workspace's own provider / failed-only filters. */
  totalRowCount: number;
  historyState: PanelState;
  logsLoading: boolean;
  logsError: string | null;
  onRetryLogs: () => void;
  health: PlatformHealth[];
  healthState: PanelState;
  healthLoading: boolean;
  healthError: string | null;
  onRetryHealth: () => void;
  /** Refetches both panels; drives the header's Refresh button. */
  onRefreshAll: () => void;
  /** Stated when health and history are not describing the same requests. */
  partialNote: string;
  expandedApiLogId: string | null;
  setExpandedApiLogId: (id: string | null) => void;
  handleExportData: (format: 'csv' | 'json', type: 'events' | 'apilogs') => void;
  retryingOutboxIds: number[];
  handleRetryOutbox: (id: number) => void;
}

/**
 * A full endpoint reads as one unbroken string in a table cell, and the part an
 * operator recognises is the host — which door the request went through.
 */
function splitEndpoint(endpoint: string): { host: string; path: string } {
  try {
    const url = new URL(endpoint);
    return { host: url.hostname, path: url.pathname };
  } catch {
    return { host: endpoint, path: '' };
  }
}

const timeOf = (value: string) =>
  new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const dayOf = (value: string) =>
  new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });

/** One provider's seven-day verdict. Read-only: it aggregates a different set of
 *  requests than the table below, so it deliberately does not filter it. */
function HealthCard({ item }: { item: PlatformHealth }) {
  const needsAction = item.state === 'action_required';
  const retrying = item.state === 'retrying';
  const noData = item.state === 'no_data';
  const tone = needsAction
    ? 'border-rose-200 bg-rose-50'
    : retrying
      ? 'border-amber-200 bg-amber-50'
      : noData
        ? 'border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)]'
        : 'border-[var(--bk-panel-border)] bg-[var(--bk-console-surface)]';

  return (
    <div className={`rounded-[var(--bk-radius-control)] border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-label font-extrabold text-[var(--bk-console-text)]">
          <PlatformLogo platform={item.platform} className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.platform}</span>
        </span>
        {needsAction ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
        ) : retrying ? (
          <Clock3 className="h-4 w-4 shrink-0 text-amber-600" />
        ) : noData ? (
          <Activity className="h-4 w-4 shrink-0 text-[var(--bk-console-text-subtle)]" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        )}
      </div>
      <p
        className={`mt-3 font-bold tracking-tight text-[var(--bk-console-text)] ${noData ? 'text-body' : 'text-2xl'}`}
      >
        {noData ? (item.configured ? 'No requests yet' : 'Not enabled') : `${item.successRate}%`}
      </p>
      <p className="mt-1 text-caption text-[var(--bk-console-text-subtle)]">
        {noData
          ? item.configured
            ? 'Nothing sent in the last 7 days'
            : 'Turn this destination on in Settings'
          : `${item.successful} delivered · ${item.failed} failed`}
      </p>
      {(item.queued > 0 || item.dead > 0) && (
        <p className={`mt-2 text-caption font-bold ${item.dead ? 'text-rose-700' : 'text-amber-700'}`}>
          {item.queued} retrying · {item.dead} waiting on you
        </p>
      )}
    </div>
  );
}

/** A real <select> in the prototype's control shape, so the native keyboard and
 *  the phone picker both keep working. */
function CompactSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={event => onChange(event.target.value)}
      className="h-11 min-w-[168px] rounded-[var(--bk-radius-control)] border border-[var(--bk-control-border)] bg-white px-3 text-caption font-semibold text-[var(--bk-console-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--bk-console-blue)] lg:h-[38px]"
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ResultBadge({ statusCode }: { statusCode: number }) {
  const failed = statusCode >= 400;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-caption font-bold ${
        failed ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
      }`}
    >
      {failed ? <AlertTriangle className="h-3 w-3 shrink-0" /> : <CheckCircle2 className="h-3 w-3 shrink-0" />}
      {statusCode}
    </span>
  );
}

/** The two raw bodies, shared by the table's expansion row and the phone card so
 *  the same request cannot read differently on the two layouts. */
function BodyPanels({ log }: { log: APILog }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-[var(--bk-radius-control)] bg-slate-900 p-4">
        <p className="mb-2 text-label font-extrabold tracking-[0.085em] text-blue-300">What we sent</p>
        <pre
          tabIndex={0}
          aria-label={`Request body for request ${log.id}`}
          className="max-h-60 overflow-auto whitespace-pre-wrap break-all font-mono text-caption text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {log.requestBody}
        </pre>
      </div>
      <div className="rounded-[var(--bk-radius-control)] bg-slate-900 p-4">
        <p className="mb-2 text-label font-extrabold tracking-[0.085em] text-emerald-300">What came back</p>
        <pre
          tabIndex={0}
          aria-label={`Response body for request ${log.id}`}
          className="max-h-60 overflow-auto whitespace-pre-wrap break-all font-mono text-caption text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {log.responseBody}
        </pre>
      </div>
    </div>
  );
}

export function DeliveryLogsWorkspace({
  rows,
  totalRowCount,
  historyState,
  logsLoading,
  logsError,
  onRetryLogs,
  health,
  healthState,
  healthLoading,
  healthError,
  onRetryHealth,
  onRefreshAll,
  partialNote,
  expandedApiLogId,
  setExpandedApiLogId,
  handleExportData,
  retryingOutboxIds,
  handleRetryOutbox,
}: DeliveryLogsWorkspaceProps) {
  const [provider, setProvider] = useState('all');
  const [failedOnly, setFailedOnly] = useState(false);
  const [page, setPage] = useState(1);

  // The seven-day totals behind the strip. They come from `/delivery/health`,
  // never from the rows below: the table holds the most recent requests only, so
  // counting it would put a number on the strip that shrinks as older requests
  // age out of the fetch.
  const totals = useMemo(
    () =>
      health.reduce(
        (acc, item) => ({
          successful: acc.successful + item.successful,
          failed: acc.failed + item.failed,
          dead: acc.dead + item.dead,
        }),
        { successful: 0, failed: 0, dead: 0 },
      ),
    [health],
  );
  const attempts = totals.successful + totals.failed;
  const deliveryRate = attempts > 0 ? Math.round((totals.successful / attempts) * 1000) / 10 : null;
  const healthReady = healthState === 'ready';
  const healthPendingHint =
    healthState === 'error' ? 'Delivery health could not be loaded' : 'Loading delivery health';

  const metricItems: MetricStripItem[] = [
    {
      label: 'Delivery rate',
      shortLabel: 'Rate',
      value: healthReady && deliveryRate !== null ? `${deliveryRate}%` : '—',
      hint: !healthReady
        ? healthPendingHint
        : deliveryRate === null
          ? 'Nothing sent in the last 7 days'
          : 'Last 7 days, every destination',
    },
    {
      label: 'Requests sent',
      shortLabel: 'Sent',
      value: healthReady ? attempts.toLocaleString() : '—',
      hint: healthReady ? 'Last 7 days' : healthPendingHint,
    },
    {
      label: 'Failed',
      value: healthReady ? totals.failed.toLocaleString() : '—',
      hint: !healthReady
        ? healthPendingHint
        : totals.failed > 0
          ? 'Turned down by the destination'
          : 'Nothing was turned down',
    },
    {
      label: 'Waiting on you',
      shortLabel: 'Manual',
      value: healthReady ? totals.dead.toLocaleString() : '—',
      hint: !healthReady
        ? healthPendingHint
        : totals.dead > 0
          ? 'Retry these from the table below'
          : 'Nothing needs a manual retry',
    },
  ];

  // The selected destination stays in the list even when the current rows no
  // longer contain it, otherwise a refresh that drops the last Meta request
  // leaves the control blank while still filtering the table to nothing.
  const providerOptions = useMemo(() => {
    const present = new Set<string>(rows.map(row => row.platform));
    if (provider !== 'all') present.add(provider);
    return [
      { value: 'all', label: 'All destinations' },
      ...Array.from(present).map(name => ({ value: name, label: name })),
    ];
  }, [rows, provider]);

  const visibleRows = useMemo(
    () =>
      rows.filter(
        row =>
          (provider === 'all' || row.platform === provider) && (!failedOnly || row.statusCode >= 400),
      ),
    [rows, provider, failedOnly],
  );

  const filtersActive = provider !== 'all' || failedOnly;
  useEffect(() => {
    setPage(1);
  }, [provider, failedOnly]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(
    () => visibleRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [visibleRows, currentPage],
  );

  const busy = logsLoading || healthLoading;

  return (
    <div>
      <PageHeader
        eyebrow="Tracking"
        title="Delivery logs"
        description="Every request your store sent to a tracking destination, and the exact reply that came back."
        action={
          <Button variant="secondary" size="sm" onClick={onRefreshAll} disabled={busy}>
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        }
      />

      <MetricStrip items={metricItems} />

      <section aria-label="Destination health over the last 7 days" className="mb-6">
        <h2 className="mb-3 text-label font-extrabold uppercase tracking-[0.085em] text-[var(--bk-console-text-muted)]">
          Destination health · last 7 days
        </h2>
        {healthState === 'loading' ? (
          <SkeletonCards count={4} />
        ) : healthState === 'error' ? (
          <Card padding="none">
            <ErrorState
              compact
              title="Couldn't load delivery health"
              description={healthError ?? 'Delivery health could not be loaded.'}
              onRetry={onRetryHealth}
              retrying={healthLoading}
            />
          </Card>
        ) : healthState === 'empty' ? (
          <Card padding="none">
            <EmptyState
              icon={Activity}
              title="No destination health yet"
              description="Once tracking sends its first request, each destination gets a seven-day score here."
              compact
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {health.map(item => (
              <HealthCard key={item.platform} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* A failed *refresh* with earlier cards still on screen used to show
          nothing at all: the numbers went stale while continuing to look
          current. Same for the rows one panel down. */}
      {healthError && health.length > 0 && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-[var(--bk-radius-control)] border border-amber-200 bg-amber-50 px-3 py-2 text-caption font-semibold text-amber-800"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>These scores are from an earlier load — the last refresh failed: {healthError}</span>
        </p>
      )}

      {partialNote && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 rounded-[var(--bk-radius-control)] border border-[var(--bk-console-border)] bg-[var(--bk-console-blue-soft)] px-3 py-2 text-caption font-semibold text-[var(--bk-console-text-body)]"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--bk-console-blue)]" />
          <span>{partialNote}</span>
        </p>
      )}

      {logsError && rows.length > 0 && (
        <p
          role="status"
          className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--bk-radius-control)] border border-amber-200 bg-amber-50 px-3 py-2 text-caption font-semibold text-amber-800"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>These requests are from an earlier load — the last refresh failed: {logsError}</span>
          <button
            type="button"
            onClick={onRetryLogs}
            disabled={logsLoading}
            className="min-h-8 rounded-[var(--bk-radius-control)] border border-amber-300 bg-white px-2 py-0.5 font-semibold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {logsLoading ? 'Retrying…' : 'Retry'}
          </button>
        </p>
      )}

      <Card flush padding="none">
        <div className="flex flex-col gap-3 border-b border-[var(--bk-console-border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <CompactSelect
              label="Filter by destination"
              value={provider}
              onChange={setProvider}
              options={providerOptions}
            />
            {/* The 14px box is not the target — the whole label is, because a
                label wrapping a checkbox forwards the click, so the reachable
                area is the pill including "Failed only". It was 36px tall, and
                it sits beside a select that was 38px; both now stand at 44 until
                lg, where the filter row goes horizontal and takes back the
                prototype's compact heights. */}
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--bk-control-border)] bg-white px-3 text-label font-extrabold text-[var(--bk-console-text-muted)] lg:min-h-9">
              <input
                type="checkbox"
                checked={failedOnly}
                onChange={event => setFailedOnly(event.target.checked)}
                className="h-3.5 w-3.5 accent-[var(--bk-console-blue)]"
              />
              Failed only
            </label>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setProvider('all');
                  setFailedOnly(false);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExportData('csv', 'apilogs')}
              disabled={totalRowCount === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleExportData('json', 'apilogs')}
              disabled={totalRowCount === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </Button>
          </div>
        </div>

        {historyState === 'loading' ? (
          <div className="p-4">
            <SkeletonTable rows={6} />
          </div>
        ) : historyState === 'error' ? (
          <ErrorState
            compact
            title="Couldn't load the delivery history"
            description={logsError ?? 'The request history could not be loaded.'}
            onRetry={onRetryLogs}
            retrying={logsLoading}
          />
        ) : historyState === 'empty' ? (
          <EmptyState
            icon={Activity}
            title="No requests yet"
            description="Every request to Meta, TikTok and GA4 lands here as soon as tracking starts sending."
            compact
          />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No requests match these filters"
            description="Nothing in the most recent requests matches. Clear the filters to see all of them."
            compact
          />
        ) : (
          <>
            <div className="space-y-3 p-4 md:hidden">
              {pagedRows.map(log => {
                const expanded = expandedApiLogId === log.id;
                const failed = log.statusCode >= 400;
                const { host } = splitEndpoint(log.endpoint);
                const canRetry = Boolean(log.retryable && log.outboxId);
                const retrying = log.outboxId ? retryingOutboxIds.includes(log.outboxId) : false;

                return (
                  <div
                    key={log.id}
                    className={`rounded-[var(--bk-radius-control)] border bg-[var(--bk-console-surface)] p-4 ${
                      failed ? 'border-rose-200' : 'border-[var(--bk-console-border)]'
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedApiLogId(expanded ? null : log.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-1.5 text-body font-bold text-[var(--bk-console-text)]">
                          <PlatformLogo platform={log.platform} className="h-4 w-4 shrink-0" />
                          <span className="truncate">{log.platform}</span>
                        </span>
                        <ResultBadge statusCode={log.statusCode} />
                      </div>
                      <p className="mt-1 truncate font-mono text-caption text-[var(--bk-console-text-subtle)]">
                        {host}
                      </p>
                      {/* Not three equal columns: a third of a 320px card is
                          78px and "12:48:04 AM" needs 79, so the one value an
                          operator matches a report against broke over two
                          lines. Each item takes the width it needs instead, and
                          the row still reads left-to-right as time, method,
                          retries. */}
                      <div className="mt-3 flex items-center justify-between gap-2 font-mono text-caption whitespace-nowrap text-[var(--bk-console-text-subtle)]">
                        <span>{timeOf(log.timestamp)}</span>
                        <span>{log.method}</span>
                        <span>
                          {log.retryCount > 0 ? `${log.retryCount} retries` : 'No retry'}
                        </span>
                      </div>
                    </button>
                    {canRetry && (
                      <div className="mt-3">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={retrying}
                          onClick={() => handleRetryOutbox(log.outboxId as number)}
                        >
                          {retrying ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Send again
                        </Button>
                      </div>
                    )}
                    {expanded && (
                      <div className="mt-4 border-t border-[var(--bk-console-border)] pt-3">
                        <BodyPanels log={log} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div
              tabIndex={0}
              aria-label="Scrollable delivery log table"
              className="hidden overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-[var(--bk-console-blue)] md:block"
            >
              <table className="w-full min-w-[1000px] table-fixed border-collapse text-left">
                <colgroup>
                  <col style={{ width: 112 }} />
                  <col style={{ width: 176 }} />
                  <col />
                  <col style={{ width: 84 }} />
                  <col style={{ width: 104 }} />
                  <col style={{ width: 92 }} />
                  {/* Wide enough that "Send again" and "View" sit on one line side by side. */}
                  <col style={{ width: 208 }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--bk-console-border)] bg-[var(--color-table-head)]">
                    <TableHeaderCell className="text-caption">Time</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Destination</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Sent to</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Method</TableHeaderCell>
                    <TableHeaderCell className="text-caption">Result</TableHeaderCell>
                    <TableHeaderCell className="text-caption text-right">Retries</TableHeaderCell>
                    <TableHeaderCell className="text-caption text-right">Details</TableHeaderCell>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map(log => {
                    const expanded = expandedApiLogId === log.id;
                    const { host, path } = splitEndpoint(log.endpoint);
                    const canRetry = Boolean(log.retryable && log.outboxId);
                    const retrying = log.outboxId ? retryingOutboxIds.includes(log.outboxId) : false;

                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandedApiLogId(expanded ? null : log.id)}
                          className={`cursor-pointer border-b border-[var(--bk-console-border)] transition-colors hover:bg-[var(--color-row-hover)] ${
                            expanded ? 'bg-[var(--bk-console-surface-muted)]' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5 align-top">
                            <span className="block font-mono text-caption font-semibold text-[var(--bk-console-text)]">
                              {timeOf(log.timestamp)}
                            </span>
                            <span className="mt-0.5 block text-caption text-[var(--bk-console-text-subtle)]">
                              {dayOf(log.timestamp)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <span className="flex min-w-0 items-center gap-1.5 text-caption font-bold text-[var(--bk-console-text)]">
                              <PlatformLogo platform={log.platform} className="h-4 w-4 shrink-0" />
                              <span className="truncate">{log.platform}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-top" title={log.endpoint}>
                            <span className="block truncate font-mono text-caption text-[var(--bk-console-text-body)]">
                              {host}
                            </span>
                            {path && path !== '/' && (
                              <span className="mt-0.5 block truncate font-mono text-caption text-[var(--bk-console-text-subtle)]">
                                {path}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <span className="rounded-[var(--bk-radius-control)] bg-[var(--bk-console-surface-muted)] px-1.5 py-0.5 font-mono text-caption font-semibold text-[var(--bk-console-text-body)]">
                              {log.method}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <ResultBadge statusCode={log.statusCode} />
                          </td>
                          <td className="px-4 py-3.5 text-right align-top">
                            {log.retryCount > 0 ? (
                              <span className="whitespace-nowrap rounded-[var(--bk-radius-control)] border border-amber-100 bg-amber-50 px-1.5 py-0.5 font-mono text-caption font-bold text-amber-700">
                                {log.retryCount}×
                              </span>
                            ) : (
                              <span className="font-mono text-caption text-[var(--bk-console-text-subtle)]">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right align-top">
                            <div className="flex items-center justify-end gap-1.5">
                              {canRetry && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={retrying}
                                  className="whitespace-nowrap"
                                  onClick={event => {
                                    event.stopPropagation();
                                    handleRetryOutbox(log.outboxId as number);
                                  }}
                                >
                                  {retrying ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                  Send again
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-expanded={expanded}
                                onClick={event => {
                                  event.stopPropagation();
                                  setExpandedApiLogId(expanded ? null : log.id);
                                }}
                              >
                                {expanded ? 'Hide' : 'View'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)]">
                            <td colSpan={7} className="px-4 py-5">
                              <BodyPanels log={log} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {historyState === 'ready' && visibleRows.length > 0 && (
          <PaginationControls
            page={currentPage}
            pageSize={PAGE_SIZE}
            total={visibleRows.length}
            onPageChange={setPage}
            noun="requests"
          />
        )}
      </Card>
    </div>
  );
}
