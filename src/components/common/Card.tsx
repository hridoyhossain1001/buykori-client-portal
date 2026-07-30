import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional heading rendered above the card body. */
  title?: ReactNode;
  /** Secondary line rendered under the title. */
  description?: ReactNode;
  /** Right-aligned slot in the header row (filters, buttons, badges). */
  actions?: ReactNode;
  padding?: CardPadding;
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/**
 * The standard console surface: white panel, 1px border, rounded corners.
 * Replaces the ad-hoc `rounded-xl border border-slate-200 bg-white p-5`
 * strings repeated across the views.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { title, description, actions, padding = 'md', className = '', children, ...props },
  ref,
) {
  const hasHeader = Boolean(title || description || actions);

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] ${paddingClasses[padding]} ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-bold text-[var(--bk-console-text)]">{title}</h3>
            )}
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-[var(--bk-console-text-muted)]">{description}</p>
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
