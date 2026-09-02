import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * The shared pagination footer for long lists. Ports the prototype's
 * PaginationControls, with three changes the live data forces:
 *
 *  - `historyMayBeIncomplete` defaults to **false**. The prototype defaulted it
 *    true and always showed "at least N · History may be incomplete", because its
 *    fixtures had no real totals. The live services do return them (courierApi
 *    and operationsApi both read totalCount/hasMore), so the caveat is opt-in for
 *    the endpoints that genuinely cannot count.
 *  - Page numbers are windowed. The prototype rendered one button per page, which
 *    is fine for three fixture pages and unusable for a real order history —
 *    2,000 orders at 20 a page would render 100 buttons.
 *  - `page` is clamped at both ends, so a stale or out-of-range page cannot
 *    produce a negative "Showing -9–0" range.
 */

/** A rendered slot: a page number, or a break standing for hidden pages. */
export type PageToken = number | 'gap';

/**
 * The page numbers to render: always the first and last page, plus `siblings`
 * either side of the current one, with 'gap' where numbers are skipped. A gap
 * that would hide exactly one page shows that page instead, since "1 … 3" costs
 * the same width as "1 2 3" and tells the reader less.
 */
export function pageWindow(page: number, pageCount: number, siblings = 1): PageToken[] {
  if (pageCount <= 1) return [1];

  const shown = new Set<number>([1, pageCount]);
  for (let candidate = page - siblings; candidate <= page + siblings; candidate += 1) {
    if (candidate >= 1 && candidate <= pageCount) shown.add(candidate);
  }

  const sorted = [...shown].sort((a, b) => a - b);
  const tokens: PageToken[] = [];
  sorted.forEach((number, index) => {
    const previous = sorted[index - 1];
    if (previous !== undefined) {
      const missing = number - previous - 1;
      if (missing === 1) tokens.push(previous + 1);
      else if (missing > 1) tokens.push('gap');
    }
    tokens.push(number);
  });
  return tokens;
}

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  /** Adds the "at least N" caveat for endpoints without a trustworthy total. */
  historyMayBeIncomplete?: boolean;
  onPageChange: (page: number) => void;
  /** Plural noun for the labels, e.g. "orders". */
  noun: string;
  className?: string;
}

/**
 * 44×44 at every width. The prototype's `.page-number` is a 36px square that a
 * later accessibility pass raised to a 44px minimum — and that minimum sits at
 * top level in portal.css, not inside a media query, so desktop gets the large
 * target too. An earlier version of this file shrank back to 36px from `sm:` up,
 * which undid exactly the fix the prototype had made.
 */
const numberButton =
  'inline-grid min-h-[44px] min-w-[44px] place-items-center rounded-[var(--bk-radius-control)] border text-label font-extrabold transition-colors';

/**
 * The same flat grey Button uses, for the same reason: `disabled:opacity-40`
 * measured the chevron at 1.77:1 against the footer, which on a phone is an arrow
 * you cannot see at all rather than one you can see is unavailable. It has to
 * neutralise `hover:` as well — `:hover` still matches a disabled button, so the
 * hover pair would otherwise repaint it on the way past.
 */
const disabledArrow = 'disabled:cursor-not-allowed disabled:border-[var(--bk-control-disabled-border)] '
  + 'disabled:bg-[var(--bk-control-disabled-bg)] disabled:text-[var(--bk-control-disabled-text)] '
  + 'disabled:hover:bg-[var(--bk-control-disabled-bg)] disabled:hover:text-[var(--bk-control-disabled-text)]';

export function PaginationControls({
  page,
  pageSize,
  total,
  historyMayBeIncomplete = false,
  onPageChange,
  noun,
  className = '',
}: PaginationControlsProps) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <nav
      aria-label={`${noun} pagination`}
      className={`flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] px-3 py-2 text-[11px] text-[var(--bk-console-text-muted)] sm:min-h-[59px] sm:gap-4 sm:px-4 sm:py-2.5 ${className}`}
    >
      {/* Below sm the sentence is a range: "1–4 of 4", with the noun left to the
          nav's own aria-label. The full one wrapped to two or three lines next to
          seven 44px buttons, which is what made the footer the untidiest part of
          every list on a phone. Only one of the two is in the DOM at a time
          (`hidden` removes the other from the accessibility tree as well as the
          page), so nothing is announced twice. */}
      <span className="flex items-center gap-1 sm:hidden">
        <strong className="font-semibold text-[var(--bk-console-text)]">
          {start}–{end}
        </strong>
        of {historyMayBeIncomplete ? 'at least ' : ''}
        {total}
      </span>
      <span className="hidden flex-wrap items-center gap-2 sm:flex">
        Showing {start}–{end} of {historyMayBeIncomplete ? 'at least ' : ''}
        {total} {noun}
        {historyMayBeIncomplete && (
          // Semantic warning ink from the token layer rather than the
          // prototype's one-off amber literal, so the palette stays in one place.
          <small className="font-semibold text-[var(--bk-warning)]">
            History may be incomplete until the live API returns total/hasMore metadata.
          </small>
        )}
      </span>

      {/* A one-page list has nothing to page through, so on a phone the two dead
          arrows and "Page 1 of 1" are pure noise on a second line — the count
          alone is the whole footer. Desktop keeps the control group (it fits on
          the one line, and the lone "1" button reads as position). */}
      <div className={`items-center gap-1.5 sm:flex ${pageCount > 1 ? 'flex' : 'hidden'}`}>
        <button
          type="button"
          aria-label={`Previous ${noun} page`}
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className={`${numberButton} border-[var(--bk-control-border)] bg-[var(--bk-console-surface)] text-[var(--bk-console-text-muted)] hover:bg-[var(--bk-console-surface-muted)] hover:text-[var(--bk-console-text)] ${disabledArrow}`}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* A phone fits two arrows and a position, not a windowed row of page
            numbers: seven 44px targets need 320px on their own. The numbers
            return at sm, where they have the width they were designed for. */}
        <span className="px-1.5 whitespace-nowrap sm:hidden">
          Page <strong className="font-semibold text-[var(--bk-console-text)]">{safePage}</strong> of{' '}
          {pageCount}
        </span>

        <span className="hidden items-center gap-1.5 sm:flex">
          {pageWindow(safePage, pageCount).map((token, index) =>
            token === 'gap' ? (
              <span
                // Gaps carry no page number, so position is the only stable key.
                key={`gap-${index}`}
                aria-hidden="true"
                className="px-1 text-[var(--bk-console-text-subtle)]"
              >
                …
              </span>
            ) : (
              <button
                type="button"
                key={token}
                aria-label={`${noun} page ${token}`}
                aria-current={token === safePage ? 'page' : undefined}
                onClick={() => onPageChange(token)}
                className={`${numberButton} ${
                  token === safePage
                    ? 'border-[var(--bk-console-blue)] bg-[var(--bk-console-blue)] text-white'
                    : 'border-[var(--bk-control-border)] bg-[var(--bk-console-surface)] text-[var(--bk-console-text-muted)] hover:border-[var(--bk-brand-border)] hover:bg-[var(--bk-console-blue-soft)] hover:text-[var(--bk-console-blue)]'
                }`}
              >
                {token}
              </button>
            ),
          )}
        </span>

        <button
          type="button"
          aria-label={`Next ${noun} page`}
          disabled={safePage >= pageCount}
          onClick={() => onPageChange(safePage + 1)}
          className={`${numberButton} border-[var(--bk-control-border)] bg-[var(--bk-console-surface)] text-[var(--bk-console-text-muted)] hover:bg-[var(--bk-console-surface-muted)] hover:text-[var(--bk-console-text)] ${disabledArrow}`}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export default PaginationControls;
