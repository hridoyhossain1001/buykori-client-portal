import type { ReactNode } from 'react';

interface SectionTitleProps {
  title: ReactNode;
  /** Secondary line under the title (the prototype's .section-title p). */
  detail?: ReactNode;
  /** Right-aligned slot (a filter select, a "view all" link, a small button). */
  action?: ReactNode;
  /**
   * Heading level, so the section sits correctly under the page's h1 in the
   * document outline. Defaults to h2; use h3 for a subsection.
   */
  as?: 'h2' | 'h3';
  className?: string;
}

/**
 * A heading for a section within a page — title, optional detail line, optional
 * action. Ports the prototype's .section-title, minus its 20px panel padding:
 * there that element doubled as a Panel's header, but the live Card provides its
 * own header, so here spacing is the container's job and this stays a clean
 * heading row usable anywhere.
 */
export function SectionTitle({ title, detail, action, as: Heading = 'h2', className = '' }: SectionTitleProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <Heading className="text-base font-semibold text-[var(--bk-console-text)]">{title}</Heading>
        {detail && (
          <p className="mt-1 text-xs leading-normal text-[var(--bk-console-text-muted)]">{detail}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}

export default SectionTitle;
