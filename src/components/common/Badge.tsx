import { forwardRef, type HTMLAttributes } from 'react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';
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
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
  brand: 'border-[var(--bk-brand-border)] bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]',
};

const dotClasses: Record<BadgeTone, string> = {
  neutral: 'bg-slate-400',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
  brand: 'bg-[var(--bk-console-blue)]',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-1 text-xs',
};

/**
 * Status pill used for event status, plan tiers, courier states and similar
 * short labels. Tones map to the semantic colours already used in the console.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', size = 'sm', dot = false, className = '', children, ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${toneClasses[tone]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClasses[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
});

export default Badge;
