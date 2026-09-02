import type { ReactNode } from 'react';

/**
 * The Overview's four headline numbers, as free-standing cards.
 *
 * Deliberately *not* a change to `common/MetricStrip`. That strip is shared by
 * Orders, COD review, Event activity, Incomplete checkouts, Delivery logs and
 * Setup health; restyling it to get this page's cards would restyle six pages
 * nobody asked about. The cards live here, next to the only page that uses them.
 *
 * Geometry from the approved mockup: a 52px tinted icon tile, the number on the
 * scale's `text-metric` step (29px), then label and hint. The hint wraps rather
 * than truncating — "1 of 12 setup checks needs attention" clipped to "…checks
 * ne…" tells the merchant nothing, and the hint is the only place the number is
 * explained.
 *
 * The number is the body face, not Archivo. The portal rations the display face
 * to the page <h1>, its eyebrow and table headers (see
 * common/primitiveStyles.test.tsx); four 29px numbers in it would read as four
 * more page titles.
 */
export type KpiTone = 'accent' | 'blue' | 'amber' | 'green';

/** The same four tints ActionCenter uses, so a retint of index.css moves both. */
const TONE: Record<KpiTone, string> = {
  accent: 'bg-[var(--bk-accent-soft)] text-[var(--bk-accent)]',
  blue: 'bg-blue-50 text-[var(--bk-info)]',
  amber: 'bg-amber-50 text-[var(--bk-warning)]',
  green: 'bg-[var(--bk-accent-soft)] text-[var(--bk-accent)]',
};

export interface KpiCardItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: KpiTone;
}

export function KpiCards({ items }: { items: KpiCardItem[] }) {
  return (
    // One per row on a phone, two from sm, four from xl. Two 160px columns forced
    // the longest hint into four wrapped lines, which reads as broken rather than
    // compact.
    <div className="mb-[18px] grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-4">
      {items.map(item => (
        <div
          key={item.label}
          className="flex min-h-[104px] items-center gap-4 rounded-[var(--bk-radius-panel)] border border-[var(--bk-panel-border)] bg-[var(--bk-console-surface)] p-5 shadow-[var(--bk-panel-shadow)]"
        >
          <span
            aria-hidden="true"
            className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] ${TONE[item.tone ?? 'accent']}`}
          >
            {item.icon}
          </span>
          <div className="min-w-0">
            <div className="text-metric font-bold leading-none tracking-[-0.025em] tabular-nums text-[var(--bk-console-text)]">
              {item.value}
            </div>
            <div className="mt-1.5 text-caption font-semibold text-[var(--bk-console-text-body)]">{item.label}</div>
            {item.hint && (
              <div className="mt-0.5 text-caption leading-[1.4] text-[var(--bk-console-text-subtle)]">{item.hint}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default KpiCards;
