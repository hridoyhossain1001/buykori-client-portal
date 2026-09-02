import { Activity, ChevronRight, Gauge, ShieldCheck, Zap } from 'lucide-react';
import { Card, SectionTitle } from '../common';
import { quotaTone } from './dashboardUtils';

/**
 * The prototype's `.action-list`, at its own measurements: 63px rows on a
 * 38px / 1fr / 17px grid, a 34px tinted icon square, and a hairline between
 * rows rather than a boxed list.
 */
const ROW = 'grid w-full min-h-[63px] grid-cols-[38px_minmax(0,1fr)_17px] items-center gap-2.5 px-2 py-[9px] text-left transition-colors hover:bg-row-hover';
const ROW_ICON = 'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[7px]';
const ROW_TITLE = 'block text-caption font-semibold text-[var(--bk-console-text)]';
const ROW_SUBTITLE = 'mt-0.5 block text-[11px] text-[var(--bk-console-text-muted)]';

/**
 * The prototype's three action tints, expressed in the token layer: its amber
 * and blue washes are the 50-step of the retinted amber and blue ramps, and the
 * glyph colours are the semantic --bk-warning / --bk-info / --bk-accent tokens.
 * Nothing here is a literal colour, so a retint of index.css moves it.
 */
const ICON_AMBER = 'bg-amber-50 text-[var(--bk-warning)]';
const ICON_BLUE = 'bg-blue-50 text-[var(--bk-info)]';
const ICON_GREEN = 'bg-[var(--bk-accent-soft)] text-[var(--bk-accent)]';
const ICON_DANGER = 'bg-rose-50 text-[var(--bk-danger)]';

interface ActionCenterProps {
  pendingOrderCount: number;
  openSuggestions: number;
  /** Total number of setup checks, so a clear queue can say how many passed. */
  totalChecks: number;
  /** Server-side deliveries that failed and can still be inspected. */
  failedEvents: number;
  usagePercent: number;
  setActivePage: (page: string) => void;
}

export function ActionCenter({
  pendingOrderCount,
  openSuggestions,
  totalChecks,
  failedEvents,
  usagePercent,
  setActivePage,
}: ActionCenterProps) {
  const tone = quotaTone(usagePercent);

  return (
    <Card padding="none" flush className="min-w-0">
      <div className="p-5">
        <SectionTitle title="Action center" detail="The next useful actions for your team" />
      </div>
      <div className="px-[15px] pb-[15px]">
        {/* Quota pressure outranks everything else: once it is exhausted no other
            action matters, because nothing is being tracked. This row has no
            counterpart in the prototype — it exists because the live plan has a
            real ceiling — so it keeps the same row geometry as the rest. */}
        {tone !== 'ok' && (
          <button onClick={() => setActivePage('account')} className={`${ROW} border-b border-[var(--bk-console-border)]`}>
            <span className={`${ROW_ICON} ${tone === 'warning' ? ICON_AMBER : ICON_DANGER}`}>
              <Gauge className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <strong className={ROW_TITLE}>
                {tone === 'exhausted' ? 'Event limit reached — tracking paused' : `Event usage at ${usagePercent.toFixed(0)}%`}
              </strong>
              <span className={ROW_SUBTITLE}>
                {tone === 'exhausted' ? 'Upgrade your plan to resume tracking' : 'Review your plan before the limit is reached'}
              </span>
            </span>
            <ChevronRight className="h-[17px] w-[17px] text-[var(--bk-console-text-subtle)]" />
          </button>
        )}

        <button onClick={() => setActivePage('pending-purchases')} className={`${ROW} border-b border-[var(--bk-console-border)]`}>
          <span className={`${ROW_ICON} ${pendingOrderCount > 0 ? ICON_AMBER : ICON_GREEN}`}>
            <ShieldCheck className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <strong className={ROW_TITLE}>
              {pendingOrderCount > 0 ? `${pendingOrderCount} COD orders need review` : 'COD review queue is clear'}
            </strong>
            <span className={ROW_SUBTITLE}>Confirm or skip pending purchase events</span>
          </span>
          <ChevronRight className="h-[17px] w-[17px] text-[var(--bk-console-text-subtle)]" />
        </button>

        <button onClick={() => setActivePage('suggestions')} className={`${ROW} border-b border-[var(--bk-console-border)]`}>
          <span className={`${ROW_ICON} ${openSuggestions > 0 ? ICON_BLUE : ICON_GREEN}`}>
            <Zap className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <strong className={ROW_TITLE}>
              {openSuggestions === 0
                ? `All ${totalChecks} setup checks pass`
                : `${openSuggestions} setup item${openSuggestions === 1 ? '' : 's'} need${openSuggestions === 1 ? 's' : ''} attention`}
            </strong>
            <span className={ROW_SUBTITLE}>
              {openSuggestions === 0 ? 'Nothing to fix right now' : 'Resolve issues reducing delivery quality'}
            </span>
          </span>
          <ChevronRight className="h-[17px] w-[17px] text-[var(--bk-console-text-subtle)]" />
        </button>

        <button onClick={() => setActivePage('event-logs')} className={ROW}>
          <span className={`${ROW_ICON} ${failedEvents > 0 ? ICON_DANGER : ICON_GREEN}`}>
            <Activity className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <strong className={ROW_TITLE}>
              {failedEvents === 0
                ? 'No failed events to review'
                : `${failedEvents} failed event${failedEvents === 1 ? '' : 's'} need${failedEvents === 1 ? 's' : ''} review`}
            </strong>
            <span className={ROW_SUBTITLE}>Inspect details and retry safely</span>
          </span>
          <ChevronRight className="h-[17px] w-[17px] text-[var(--bk-console-text-subtle)]" />
        </button>
      </div>
    </Card>
  );
}
