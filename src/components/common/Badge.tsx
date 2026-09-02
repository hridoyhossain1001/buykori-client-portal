import { forwardRef, type HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
type BadgeSize = 'sm' | 'md';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Renders a small leading status dot in the same tone. */
  dot?: boolean;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  brand: 'border-[var(--bk-brand-border)] bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]',
};

const dotClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-blue-500',
  brand: 'bg-[var(--bk-console-blue)]',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 text-label',
  md: 'px-2.5 py-1 text-caption',
};

/**
 * Status pill used for event status, plan tiers, courier states and similar
 * short labels, and the prototype's `.p-badge`. Tones map to the semantic
 * colours already used in the console — Phase 1 re-pointed the Tailwind ramps at
 * the prototype's palette, so `emerald-50/200/700` already resolve to the exact
 * hexes portal.css uses for a success badge.
 *
 * Two details carry over from `.p-badge` and are easy to lose:
 *
 *  - **weight 800, not 600.** At 11px a semibold pill reads as body text that
 *    happens to have a border; extrabold is what makes it read as a chip.
 *  - **`width: max-content`.** A badge is often the only child of a grid or
 *    flex column (a table cell, a drawer's definition list), where the default
 *    `stretch` alignment would pull the pill the full width of the column and
 *    leave the label floating in a long capsule.
 *
 * `sm` drops vertical padding because the 23px minimum height plus centring
 * gives the pill its height, exactly as the prototype does it.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', size = 'sm', dot = false, className = '', children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={`inline-flex min-h-[23px] w-max items-center gap-1.5 rounded-[var(--bk-radius-pill)] border font-extrabold whitespace-nowrap ${toneClasses[tone]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClasses[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
});

export default Badge;
