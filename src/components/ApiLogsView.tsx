/**
 * Container for the Delivery logs page.
 *
 * Three things stay here rather than moving into the workspace:
 *  - the `/delivery/health` fetch (the page's own request, aborted on unmount),
 *  - the single redaction boundary, and
 *  - the two-state-machine reconciliation, because health and history load from
 *    separate requests and their disagreement has to be stated, not inferred.
 *
 * All presentation lives in `apiLogs/DeliveryLogsWorkspace.tsx`.
 */
import React from 'react';
import { APILog } from '../types';
import { describeFetchError, describeResponseError, isAbortError } from '../lib/http';
import { redactApiLogs } from '../lib/redact';
import { DeliveryLogsWorkspace } from './apiLogs/DeliveryLogsWorkspace';
import type { PlatformHealth } from './apiLogs/DeliveryLogsWorkspace';

interface ApiLogsViewProps {
  filteredApiLogsForTable: APILog[];
  /** Delivery history loads separately from platform health — see `partialNote` below. */
  logsLoading: boolean;
  logsError: string | null;
  onRetryLogs: () => void;
  expandedApiLogId: string | null;
  setExpandedApiLogId: (id: string | null) => void;
  handleExportData: (format: 'csv' | 'json', type: 'events' | 'apilogs') => void;
  /** Retry plumbing: `/api-logs` rows already carry `outboxId` + `retryable`. */
  retryingOutboxIds: number[];
  handleRetryOutbox: (id: number) => void;
}

export function ApiLogsView({
  filteredApiLogsForTable,
  logsLoading,
  logsError,
  onRetryLogs,
  expandedApiLogId,
  setExpandedApiLogId,
  handleExportData,
  retryingOutboxIds,
  handleRetryOutbox,
}: ApiLogsViewProps) {
  const [platformHealth, setPlatformHealth] = React.useState<PlatformHealth[]>([]);
  const [healthError, setHealthError] = React.useState<string | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);

  const loadPlatformHealth = React.useCallback(async (signal?: AbortSignal) => {
    setHealthLoading(true);
    try {
      const response = await fetch('/api/delivery/health', { signal });
      if (!response.ok) {
        setHealthError(describeResponseError(response));
        return;
      }
      const data = await response.json();
      setPlatformHealth(data?.platforms ?? []);
      setHealthError(null);
    } catch (error) {
      if (isAbortError(error)) return;
      setHealthError(describeFetchError(error));
    } finally {
      if (!signal?.aborted) setHealthLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    loadPlatformHealth(controller.signal);
    return () => controller.abort();
  }, [loadPlatformHealth]);

  // Every log is redacted once, here, before anything renders or is exported: `endpoint` carries a GA4
  // `api_secret` in its query string, so the raw record must not reach the table, the row tooltip, or
  // an expanded body panel.
  //
  // The old 40-row slice is gone. It capped the table without saying so while the export stayed
  // uncapped, so the two disagreed in silence; the workspace pages the whole list instead.
  const rows = React.useMemo(() => redactApiLogs(filteredApiLogsForTable), [filteredApiLogsForTable]);

  // Platform health and delivery history are two separate requests, and before this only health had a
  // loading state — so the page could render a rose "action required · 3 failed" card above a table
  // reading "No API logs yet". Nothing said the alert and the empty table were describing different
  // things, and the natural reading is that the failing requests are being hidden. The two states are
  // now tracked apart and their disagreement is stated rather than left to inference.
  const healthState = healthLoading && platformHealth.length === 0 ? 'loading' : healthError && platformHealth.length === 0 ? 'error' : platformHealth.length === 0 ? 'empty' : 'ready';
  const historyState = logsLoading && rows.length === 0 ? 'loading' : logsError && rows.length === 0 ? 'error' : rows.length === 0 ? 'empty' : 'ready';
  const partialNote =
    healthState === 'ready' && historyState === 'loading' ? 'Delivery health above has loaded. The request history below is still loading, so the two are not describing the same requests yet.'
      : healthState === 'ready' && historyState === 'error' ? 'Delivery health above has loaded, but the request history below could not. The percentages are not backed by anything currently on this screen.'
        : healthState === 'error' && historyState === 'ready' ? 'The request history below has loaded. Delivery health could not, so no health verdict is being shown for these requests.'
          : healthState === 'loading' && historyState === 'ready' ? 'The request history below has loaded. Delivery health is still loading.'
            : '';

  const refreshAll = React.useCallback(() => {
    onRetryLogs();
    void loadPlatformHealth();
  }, [onRetryLogs, loadPlatformHealth]);

  return (
    <DeliveryLogsWorkspace
      rows={rows}
      totalRowCount={filteredApiLogsForTable.length}
      historyState={historyState}
      logsLoading={logsLoading}
      logsError={logsError}
      onRetryLogs={onRetryLogs}
      health={platformHealth}
      healthState={healthState}
      healthLoading={healthLoading}
      healthError={healthError}
      onRetryHealth={() => { void loadPlatformHealth(); }}
      onRefreshAll={refreshAll}
      partialNote={partialNote}
      expandedApiLogId={expandedApiLogId}
      setExpandedApiLogId={setExpandedApiLogId}
      handleExportData={handleExportData}
      retryingOutboxIds={retryingOutboxIds}
      handleRetryOutbox={handleRetryOutbox}
    />
  );
}
