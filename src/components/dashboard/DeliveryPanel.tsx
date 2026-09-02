import { CircleGauge } from 'lucide-react';
import { Card, SectionTitle } from '../common';
import { PlatformLogo } from '../common/PlatformLogo';
import { RING_FILL, RING_TRACK } from '../../lib/chartColors';
import type { PlatformRow } from './useDashboardMetrics';

/**
 * Delivery success as one ring, with the per-destination breakdown beside it.
 *
 * The mockup put a three-segment donut here. That needed a third, lighter blue
 * for the smallest segment, and the lightest candidate measured 2.05:1 on white
 * — under the 3.0:1 floor `lib/designTokens.test.ts` enforces for non-text
 * (WCAG 1.4.11). Rather than add a colour that cannot legibly carry meaning,
 * this is a single-value ring on the already-blessed RING_FILL / RING_TRACK
 * pair, and the split is carried by named rows with the real platform logos —
 * which the merchant can read without decoding a legend.
 *
 * `deliveryRate` is `null`, not `0`, when nothing has been attempted yet. Those
 * are different facts and the panel says so: an empty ring with "No attempts
 * yet" instead of a confident 0%.
 */
interface DeliveryPanelProps {
  /** Accepted share of today's destination attempts, or `null` when none. */
  deliveryRate: number | null;
  platformRows: PlatformRow[];
  setActivePage: (page: string) => void;
}

export function DeliveryPanel({ deliveryRate, platformRows, setActivePage }: DeliveryPanelProps) {
  const hasData = deliveryRate !== null;
  // The same denominator `deliveryRate` is computed from in useDashboardMetrics —
  // the destinations' own event counts, not the recovery summary's server
  // attempts, which count a different thing and would not add up to this ring.
  const attempts = platformRows.reduce((total, row) => total + row.total, 0);
  // The dash array is in the same 100-unit space as the circumference of an
  // r=15.9 circle, so the two numbers are read directly as percentages.
  const filled = hasData ? Math.max(0, Math.min(100, deliveryRate)) : 0;

  return (
    <Card className="min-w-0">
      <SectionTitle title="Delivery success" detail="Accepted by the ad platforms" />

      <div className="mt-5 flex items-center gap-5">
        <svg
          className="h-[92px] w-[92px] shrink-0 -rotate-90"
          viewBox="0 0 42 42"
          role="img"
          aria-label={hasData ? `${filled.toFixed(1)}% of server-side events accepted` : 'No delivery attempts yet'}
        >
          <circle cx="21" cy="21" r="15.9" fill="none" stroke={RING_TRACK} strokeWidth="6" />
          {hasData && (
            <circle
              cx="21"
              cy="21"
              r="15.9"
              fill="none"
              stroke={RING_FILL}
              strokeWidth="6"
              strokeDasharray={`${filled} ${100 - filled}`}
            />
          )}
        </svg>

        <div className="min-w-0">
          <p className="text-metric font-bold leading-none tracking-[-0.025em] tabular-nums text-[var(--bk-console-text)]">
            {hasData ? `${filled.toFixed(1)}%` : '—'}
          </p>
          <p className="mt-1.5 text-caption font-semibold text-[var(--bk-console-text-body)]">
            {hasData ? 'Accepted' : 'No attempts yet'}
          </p>
          <p className="mt-0.5 text-caption leading-[1.4] text-[var(--bk-console-text-subtle)]">
            {hasData
              ? `${attempts.toLocaleString()} event${attempts === 1 ? '' : 's'} sent today`
              : 'Send a test event to see delivery here'}
          </p>
        </div>
      </div>

      {platformRows.length > 0 ? (
        <div className="mt-5 border-t border-[var(--bk-console-border)] pt-3">
          {platformRows.map(row => (
            <button
              key={row.label}
              type="button"
              onClick={() => setActivePage('event-logs')}
              className="flex min-h-11 w-full items-center gap-2.5 rounded-[var(--bk-radius-control)] px-1.5 text-left transition-colors hover:bg-row-hover"
            >
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-[var(--bk-console-blue-soft)]">
                <PlatformLogo platform={row.platform} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-caption font-semibold text-[var(--bk-console-text-body)]" title={row.label}>
                {row.label}
              </span>
              <strong className="shrink-0 text-caption tabular-nums text-[var(--bk-console-text)]">
                {row.rate === null ? '—' : `${row.rate.toFixed(0)}%`}
              </strong>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-2 border-t border-[var(--bk-console-border)] pt-4 text-caption text-[var(--bk-console-text-subtle)]">
          <CircleGauge aria-hidden="true" className="h-4 w-4 shrink-0" />
          No destinations connected yet.
        </div>
      )}
    </Card>
  );
}

export default DeliveryPanel;
