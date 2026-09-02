import type { ComponentType, ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  /** Lucide icon component, e.g. `ShoppingCart`. Defaults to an inbox. */
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description?: ReactNode;
  /** Primary call to action, usually a Button. */
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/**
 * Consistent zero-data placeholder for tables, lists and panels.
 * Replaces the several hand-rolled "no data" blocks across the views.
 *
 * Ports the prototype's `.empty-state`, which is deliberately quiet: 11px type
 * throughout, muted ink, and a **160px minimum height** rather than generous
 * padding. The minimum is what makes an emptied table hold its place instead of
 * collapsing to a two-line strip, which is the jarring part of a filter that
 * matches nothing. `compact` is the prototype's `.search-panel .empty-state`
 * (120px). The icon has no counterpart in the prototype and is kept as-is.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = '',
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-center ${compact ? 'min-h-[120px] p-2' : 'min-h-[160px] px-6 py-8'} ${className}`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-[var(--bk-console-surface-muted)] ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}
      >
        <Icon className={`text-slate-400 ${compact ? 'h-5 w-5' : 'h-6 w-6'}`} />
      </span>
      <h4 className="text-label font-bold text-[var(--bk-console-text-muted)]">{title}</h4>
      {description && (
        <p className="max-w-sm text-label leading-relaxed text-[var(--bk-console-text-muted)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
