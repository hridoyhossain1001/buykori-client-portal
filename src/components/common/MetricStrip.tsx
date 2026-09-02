import { useState, type ReactNode } from 'react';
import { useIsWide } from '../../lib/useIsWide';

export interface MetricStripItem {
  label: string;
  value: ReactNode;
  /** Small line under the value, e.g. a delta or "vs last 7 days". */
  hint?: ReactNode;
  /** Optional leading glyph for the hint. */
  icon?: ReactNode;
  /**
   * Shorter label for `phoneLayout="row"`, where a cell is a quarter of a phone
   * screen. "Open order value" wraps to three lines in 88px; "Value" does not.
   * Ignored below md and everywhere else.
   */
  shortLabel?: string;
}

/**
 * A connected row of headline numbers, bordered top and bottom with dividers
 * between cells — the prototype's .metric-strip. Distinct from StatCard, which
 * is a single free-standing tile: use this for the strip of totals at the top
 * of a page, and StatCard where a metric stands on its own.
 *
 * Renders whatever number of items it is given (the prototype's was fixed at
 * four).
 *
 * On a phone the default (`phoneLayout="row"`) tiles every cell on **one line**,
 * ~88px each on a 402px screen and ~80px on a 320px one. Paying for that line
 * means the labels come from `shortLabel` and the hints leave the cell: below lg
 * a cell is a button that reveals its hint in a single caption line under the
 * strip, so the explanation is one tap away instead of permanently occupying
 * four lines of the screen. From lg up the row is the same four-column strip
 * with visible hints it always was.
 *
 * The boundary is **lg (1024px), not md (768px)**, because the sidebar is still
 * 248px wide at 768: the strip got ~492px there, and the desktop treatment's own
 * `px-6` then ate 48px of each 124px cell, leaving 74.5px of text room. That is
 * what clipped a money total to `৳11,63…` on the orders page and cut
 * "Open order value" to "Open order ". The tight treatment is the one designed
 * for tight cells, so it now holds until the cells are genuinely wide.
 *
 * `phoneLayout="scroll"` is the older behaviour, kept for a strip with more
 * cells than a phone line can hold: one horizontal scroller, which is what
 * portal.css does (`.metric-strip{display:flex;overflow-x:auto}` with each cell
 * at `min-width:156px;min-height:82px`), with `scroll-hint-x` painting the
 * prototype's 22px edge shadow so the swipe is discoverable and
 * `scrollbar-hidden` keeping that shadow from competing with a scrollbar. It
 * stopped being the default because the cells that fell off the right edge were
 * simply unread — the last one showed as "Read… 0 Nothi…" — and the swipe was
 * discovered by nobody it was not pointed out to.
 */
export function MetricStrip({
  items,
  className = '',
  phoneLayout = 'row',
}: {
  items: MetricStripItem[];
  className?: string;
  phoneLayout?: 'scroll' | 'row';
}) {
  const row = phoneLayout === 'row';
  const isWide = useIsWide(1024);
  const [openHint, setOpenHint] = useState<string | null>(null);
  const compact = row && !isWide;
  const active = compact ? items.find(item => item.label === openHint) : undefined;

  const cellClass = `flex flex-col justify-center gap-0.5 border-[var(--bk-console-border)] lg:min-h-[104px] lg:min-w-0 lg:gap-1 lg:px-6 lg:py-5 lg:[&:not(:last-child)]:border-r ${
    row
      ? 'min-h-[62px] px-2 py-2 text-left [&:not(:last-child)]:border-r'
      : 'min-h-[82px] min-w-[156px] shrink-0 px-4 py-3.5 [&:not(:last-child)]:border-r'
  }`;

  /**
   * Below lg the row is as many columns as there are cells; from lg up it is the
   * prototype's four, whatever it holds. Spelled as literal classes rather than
   * an inline `gridTemplateColumns`, because an inline style would also override
   * `lg:grid-cols-4` and re-space every desktop strip that does not have exactly
   * four cells.
   */
  const phoneColumns = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'][
    Math.min(Math.max(items.length, 1), 5) - 1
  ];

  return (
    <section className={`border-y border-[var(--bk-console-border)] lg:mb-6 ${row ? 'mb-4' : 'mb-6'} ${className}`}>
      <div
        className={`lg:grid lg:grid-cols-4 lg:overflow-x-visible lg:bg-none ${
          row ? `grid ${phoneColumns}` : 'flex overflow-x-auto scrollbar-hidden scroll-hint-x'
        }`}
      >
        {items.map(item => {
          // `truncate` clips, so anything clipped owes a readable full value.
          // A ReactNode value cannot become a tooltip, so only a plain string or
          // number gets one — which is every money total and every count.
          const valueTitle =
            typeof item.value === 'string' || typeof item.value === 'number' ? String(item.value) : undefined;
          const body = (
            <>
              <span
                title={item.label}
                className="truncate text-label font-semibold text-[var(--bk-console-text-muted)] lg:text-xs"
              >
                {compact ? (item.shortLabel ?? item.label) : item.label}
              </span>
              {/* 18px on a phone, 24px from lg — the prototype's own two values.
                  A four-across row cannot hold 18px, so it drops to the body
                  step (14px) below lg and picks the 24px back up at lg. */}
              <strong
                title={valueTitle}
                className={`font-bold tracking-tight text-[var(--bk-console-text)] lg:text-2xl ${
                  row ? 'truncate text-body' : 'text-[18px]'
                }`}
              >
                {item.value}
              </strong>
              {(item.hint || item.icon) && (
                <small
                  className={`items-center gap-1 text-[11px] leading-[1.35] text-[var(--bk-console-text-subtle)] lg:flex ${
                    row ? 'hidden' : 'flex'
                  }`}
                >
                  {item.icon}
                  {item.hint}
                </small>
              )}
            </>
          );

          // Below lg in row mode the cell is the hint's disclosure button; at
          // every other size the hint is already on screen, so it is a plain div.
          return compact && item.hint ? (
            <button
              key={item.label}
              type="button"
              aria-expanded={openHint === item.label}
              onClick={() => setOpenHint(current => (current === item.label ? null : item.label))}
              className={`${cellClass} cursor-pointer`}
            >
              {body}
            </button>
          ) : (
            <div key={item.label} className={cellClass}>
              {body}
            </div>
          );
        })}
      </div>
      {active?.hint && (
        <p className="flex items-center gap-1.5 border-t border-[var(--bk-console-border)] bg-slate-50 px-3 py-2 text-caption leading-snug text-[var(--bk-console-text-muted)] lg:hidden">
          {active.icon}
          <span className="font-semibold text-[var(--bk-console-text)]">{active.label}:</span>
          {active.hint}
        </p>
      )}
    </section>
  );
}

export default MetricStrip;
