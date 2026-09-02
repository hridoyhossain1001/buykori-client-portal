import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../common';
import { quotaTone } from './dashboardUtils';

/**
 * "Needs you today" as one line, replacing the tall Action center on this page.
 *
 * The four rows of `ActionCenter` said the same four things whether or not any
 * of them needed doing, so on a healthy workspace a quarter of the Overview was
 * spent confirming that nothing was wrong. This strip states only what is
 * outstanding, and collapses to a single reassuring line when nothing is.
 *
 * `ActionCenter.tsx` is deliberately left on disk: it is still the fullest view
 * of the same four signals, and nothing else on the page can be pointed at if
 * this compression turns out to hide too much.
 */
interface ActionStripProps {
  pendingOrderCount: number;
  openSuggestions: number;
  totalChecks: number;
  failedEvents: number;
  usagePercent: number;
  setActivePage: (page: string) => void;
}

export function ActionStrip({
  pendingOrderCount,
  openSuggestions,
  totalChecks,
  failedEvents,
  usagePercent,
  setActivePage,
}: ActionStripProps) {
  const tone = quotaTone(usagePercent);

  /** Each outstanding item, with the page that clears it. Ordered by urgency. */
  const items: { text: string; page: string }[] = [];
  if (tone === 'exhausted') {
    items.push({ text: 'Event limit reached — tracking paused', page: 'account' });
  } else if (tone !== 'ok') {
    items.push({ text: `Event usage at ${usagePercent.toFixed(0)}%`, page: 'account' });
  }
  if (pendingOrderCount > 0) {
    items.push({ text: `${pendingOrderCount} COD order${pendingOrderCount === 1 ? '' : 's'} to review`, page: 'pending-purchases' });
  }
  if (openSuggestions > 0) {
    items.push({ text: `${openSuggestions} of ${totalChecks} setup checks need attention`, page: 'suggestions' });
  }
  if (failedEvents > 0) {
    items.push({ text: `${failedEvents} failed event${failedEvents === 1 ? '' : 's'}`, page: 'event-logs' });
  }

  const clear = items.length === 0;
  // Green when there is nothing to do, amber when there is. The left rule is the
  // only colour carrier, and it is never the sole signal — the words say it too.
  const rule = clear ? 'border-l-[var(--bk-accent)]' : 'border-l-[var(--bk-warning)]';

  return (
    <div
      className={`mb-[18px] flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--bk-radius-panel)] border border-[var(--bk-panel-border)] border-l-[3px] ${rule} bg-[var(--bk-console-surface)] px-5 py-3.5 shadow-[var(--bk-panel-shadow)]`}
    >
      <span className="flex shrink-0 items-center gap-2 text-caption font-semibold text-[var(--bk-console-text)]">
        <ShieldCheck aria-hidden="true" className={`h-4 w-4 ${clear ? 'text-[var(--bk-accent)]' : 'text-[var(--bk-warning)]'}`} />
        {clear ? 'Nothing needs you today' : 'Needs you today'}
      </span>

      {clear ? (
        <span className="min-w-0 flex-1 text-caption text-[var(--bk-console-text-subtle)]">
          COD queue clear, all {totalChecks} setup checks pass, no failed events.
        </span>
      ) : (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
          {items.map((item, index) => (
            <span key={item.text} className="flex items-center gap-2.5">
              {index > 0 && (
                <span aria-hidden="true" className="h-3 w-px bg-[var(--bk-console-border)]" />
              )}
              <button
                type="button"
                onClick={() => setActivePage(item.page)}
                className="text-caption font-semibold text-[var(--bk-console-text-body)] underline decoration-[var(--bk-console-border)] decoration-2 underline-offset-4 transition-colors hover:text-[var(--bk-accent)] hover:decoration-[var(--bk-accent)]"
              >
                {item.text}
              </button>
            </span>
          ))}
        </span>
      )}

      {!clear && (
        <Button variant="ghost" size="sm" onClick={() => setActivePage(items[0].page)}>
          Review <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default ActionStrip;
