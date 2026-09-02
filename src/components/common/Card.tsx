import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Optional heading rendered above the card body. */
  title?: ReactNode;
  /** Secondary line rendered under the title. */
  description?: ReactNode;
  /** Right-aligned slot in the header row (filters, buttons, badges). */
  actions?: ReactNode;
  padding?: CardPadding;
  /**
   * Clips the body to the rounded corners, for a card whose content reaches the
   * edge — a table, a tab strip, a pagination footer. Off by default because
   * `overflow: hidden` also clips anything meant to escape the card: Tooltip
   * (common/Tooltip.tsx) positions itself `absolute bottom-full`, above its
   * trigger and outside the parent's box, and is used inside panels on
   * Campaign tools, Incomplete checkouts and Settings. The prototype's .p-panel
   * clips unconditionally because it has no such tooltip.
   */
  flush?: boolean;
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * The standard console surface, and the prototype's `.p-panel`: white, a 1px
 * border in the panel tint, an 8px radius and the faint lift below.
 *
 * The border is --bk-panel-border, a shade darker than the --bk-console-border
 * used for rules *inside* a panel. The prototype draws that distinction
 * deliberately: the panel edge should read as slightly firmer than the lines
 * dividing its own contents.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { title, description, actions, padding = 'md', flush = false, className = '', children, ...props },
  ref,
) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <div
      ref={ref}
      className={`rounded-[var(--bk-radius-panel)] border border-[var(--bk-panel-border)] bg-[var(--bk-console-surface)] shadow-[var(--bk-panel-shadow)] ${
        flush ? 'overflow-hidden' : ''
      } ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              // The body face, not Archivo. The prototype reserves the display
              // face for exactly three things — the page <h1>, its eyebrow, and
              // table headers — so a panel heading in Archivo would read as a
              // second page title. .section-title h2 is 16px at weight 600.
              <h3 className="text-subtitle font-semibold text-[var(--bk-console-text)]">{title}</h3>
            )}
            {description && (
              <p className="mt-1.5 text-caption leading-relaxed text-[var(--bk-console-text-muted)]">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
});

export default Card;
