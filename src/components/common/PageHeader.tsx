import { useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

interface PageHeaderProps {
  /**
   * Small teal kicker above the title (the prototype's .eyebrow). Optional —
   * omit it on pages that do not use one.
   */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned action cluster (buttons, filters, a search box). */
  action?: ReactNode;
  className?: string;
  /**
   * `'compact'` (the default) folds the printed head away below sm — see the
   * note above. Pass `'full'` on a page that is read rather than worked, where
   * the phone genuinely needs the title and the prose on screen.
   */
  phoneChrome?: 'compact' | 'full';
}

/**
 * The uniform head of a page: eyebrow + title + description on the left, an
 * optional action cluster on the right. Ports the prototype's .page-heading.
 *
 * Unlike the prototype's version it takes explicit props rather than looking a
 * page up in a pageMeta[page] registry — the live portal has no such registry,
 * and each page already knows its own copy. Values track the shared design
 * tokens (--bk-console-*), so a palette change in Phase 1's token layer moves
 * this too.
 *
 * **Below sm the head is compact by default**, because on a phone the full one
 * cost 150–200px before any of the page's own content: an eyebrow, a 26px h1
 * that wrapped to two lines at 320px, and a paragraph of prose. So on a phone
 * the eyebrow is dropped, the title shrinks to a single 17px line, and the
 * description moves behind an "About this page" button beside it, opening as a
 * caption block. Same bargain as MetricStrip's hint: one tap away instead of
 * permanently on screen. From sm up nothing changes.
 *
 * The title stays *visible* on the phone rather than going `sr-only`. An earlier
 * version hid it, which left the row with an empty left half, a lone ⓘ floating
 * in it and the action pinned right — the ⓘ had nothing to belong to and the row
 * read as a mistake. Next to a title it reads as "about this page", and the row
 * has a subject on the left and an action on the right like any other toolbar.
 * The cost is that the app bar names the page too; one repeated 17px line is the
 * cheaper of the two problems.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className = '',
  phoneChrome = 'compact',
}: PageHeaderProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  // Only a page that has prose to fold has anything to fold.
  const compact = phoneChrome === 'compact' && Boolean(description);

  /* 26px on a phone, 30px from sm up: the prototype's own two values. They stay
     arbitrary rather than using --text-title, because Phase 1's type scale put
     `title` at 20px — the prototype's --type-title (30px) has no counterpart in
     it, and a heading needs both sizes anyway. In a compact head the phone keeps
     the heading in the document but not on screen (see the note above). */
  const heading = (
    <h1
      className={`font-display text-[26px] leading-[1.1] font-bold tracking-[-0.019em] text-[var(--bk-console-text)] sm:text-[30px] ${
        compact ? 'sr-only sm:not-sr-only' : ''
      }`}
    >
      {title}
    </h1>
  );

  return (
    <>
      <div
        className={`flex justify-between gap-3 sm:mb-6 sm:items-start sm:gap-6 ${
          compact ? `items-center ${aboutOpen ? 'mb-2' : 'mb-3'}` : 'mb-6 items-start'
        } ${className}`}
      >
        <div className="min-w-0">
          {eyebrow && (
            // Archivo, wide-tracked. The eyebrow is one of only three places the
            // prototype uses the display face (with the page <h1> and table
            // headers), which is what keeps 11px of teal from reading as a stray
            // label — .eyebrow is 800 weight at 0.085em.
            <p
              className={`mb-1.5 font-display text-label font-extrabold tracking-[0.085em] text-[var(--bk-console-blue)] ${
                compact ? 'hidden sm:block' : ''
              }`}
            >
              {eyebrow}
            </p>
          )}
          {heading}
          {description && (
            // 13px/1.5 on a phone, the page body size from sm up. portal.css sets
            // `.page-heading p:not(.eyebrow){line-height:1.5;font-size:13px}` inside
            // its phone block: a page description is the one block of prose on the
            // screen a merchant does not need to read twice, so it gives up size
            // before anything else does.
            <p
              className={`mt-2 text-[13px] leading-[1.5] text-[var(--bk-console-text-muted)] sm:text-body sm:leading-normal ${
                compact ? 'hidden sm:block' : ''
              }`}
            >
              {description}
            </p>
          )}
        </div>
        {(action || compact) && (
          // On a phone this row *is* the head — the text column beside it is
          // empty (sr-only title, folded eyebrow and prose), so a right-aligned
          // cluster left two thirds of the row blank with the ⓘ floating in it.
          // Here it spans the full width instead: the ⓘ anchored to the left
          // edge, the page's own controls filling the rest, so the row lines up
          // with the content below it and reads as a toolbar rather than as
          // leftovers. From sm up it is the right-aligned cluster again.
          <div className={`flex items-center gap-2 ${compact ? 'w-full sm:w-auto sm:shrink-0' : 'shrink-0'}`}>
            {compact && (
              <button
                type="button"
                aria-label="About this page"
                aria-expanded={aboutOpen}
                onClick={() => setAboutOpen(open => !open)}
                // 28px of ink, 46px of target: the circle stays small enough to
                // read as a hint next to real buttons, and the `::after` grows
                // the hit area without growing the row.
                //
                // The inset is -10px, not the -8px that 28+8+8=44 suggests. An
                // absolutely positioned pseudo is laid out against its parent's
                // *padding* box, and this button is `border-box` with a 1px
                // border, so -8px measured 42×42 on every page that renders a
                // PageHeader. Any bordered control expanded this way owes itself
                // the border width back on both axes.
                className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[var(--bk-console-text-muted)] after:absolute after:-inset-2.5 after:content-[''] sm:hidden ${
                  aboutOpen
                    ? 'border-[var(--bk-console-blue)] bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]'
                    : 'border-[var(--bk-control-border)] bg-white'
                }`}
              >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            {action && (
              <div
                className={`flex items-center gap-2 ${
                  compact ? 'flex-1 max-sm:[&>*]:flex-1 sm:flex-none' : ''
                }`}
              >
                {action}
              </div>
            )}
          </div>
        )}
      </div>
      {compact && aboutOpen && (
        <p className="mb-4 rounded-[var(--bk-radius-control)] border border-[var(--bk-console-border)] bg-slate-50 px-3 py-2.5 text-caption leading-relaxed text-[var(--bk-console-text-muted)] sm:hidden">
          {description}
        </p>
      )}
    </>
  );
}

export default PageHeader;
