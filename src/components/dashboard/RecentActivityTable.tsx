import { ArrowRight, PackageCheck } from 'lucide-react';
import type { CAPIEvent } from '../../types';
import {
  Button,
  Card,
  SectionTitle,
  Status,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../common';
import { PlatformLogo } from '../common/PlatformLogo';
import { eventContext } from './dashboardUtils';

/**
 * The table runs edge to edge inside a flush panel, so the first and last cells
 * carry the panel's own 20px inset. Without them the first column starts 8px
 * left of the section title above it, which reads as a misprint.
 */
const EDGE_START = 'pl-5';
const EDGE_END = 'pr-5';

interface RecentActivityTableProps {
  recentEvents: CAPIEvent[];
  setActivePage: (page: string) => void;
}

export function RecentActivityTable({ recentEvents, setActivePage }: RecentActivityTableProps) {
  return (
    <Card padding="none" flush className="min-w-0">
      <div className="border-b border-[var(--bk-console-border)] px-5 py-4">
        <SectionTitle
          title="Recent activity"
          detail="Latest tracking events from your store"
          action={(
            <Button variant="ghost" size="sm" onClick={() => setActivePage('event-logs')}>
              View all activity <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        />
      </div>
      {recentEvents.length > 0 ? (
        <Table caption="Recent tracking events">
          <TableHead>
            <TableRow>
              <TableHeaderCell className={EDGE_START}>Time</TableHeaderCell>
              <TableHeaderCell>Event</TableHeaderCell>
              <TableHeaderCell>Product / Page</TableHeaderCell>
              <TableHeaderCell>Platform</TableHeaderCell>
              <TableHeaderCell className={EDGE_END}>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {recentEvents.map(event => (
              <TableRow key={event.id} interactive onClick={() => setActivePage('event-logs')}>
                <TableCell className={`${EDGE_START} text-label text-[var(--bk-console-text-muted)]`}>
                  {new Date(event.timestamp).toLocaleString()}
                </TableCell>
                <TableCell className="font-semibold text-[var(--bk-console-text)]">{event.name}</TableCell>
                <TableCell className="max-w-[260px] text-label font-semibold">
                  <span className="block truncate" title={eventContext(event)}>{eventContext(event)}</span>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2 text-label font-semibold">
                    <PlatformLogo platform={event.platform} className="h-4 w-4" />
                    {event.platform}
                  </span>
                </TableCell>
                {/* Status, not a hand-rolled pill with a check mark on every
                    row: the old cell showed CheckCircle2 even for a failure. */}
                <TableCell className={EDGE_END}><Status value={event.status} dot /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--bk-radius-control)] bg-[var(--bk-console-surface-muted)] text-[var(--bk-console-text-subtle)]">
              <PackageCheck className="h-5 w-5" />
            </span>
            <div className="text-left">
              <p className="text-caption font-semibold text-[var(--bk-console-text)]">No recent event logs</p>
              <p className="mt-1 text-label text-[var(--bk-console-text-muted)]">
                Your aggregate tracking data is available above. Send a test event to create a fresh log entry.
              </p>
            </div>
          </div>
          <Button variant="primary" className="shrink-0" onClick={() => setActivePage('campaign-builder')}>
            Send test event
          </Button>
        </div>
      )}
    </Card>
  );
}
