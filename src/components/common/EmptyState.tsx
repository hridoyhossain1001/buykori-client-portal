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
      className={`flex flex-col items-center justify-center text-center ${compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14'} ${className}`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-[var(--bk-console-surface-muted)] ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}
      >
        <Icon className={`text-slate-400 ${compact ? 'h-5 w-5' : 'h-6 w-6'}`} />
      </span>
      <h4 className="text-sm font-bold text-[var(--bk-console-text)]">{title}</h4>
      {description && (
        <p className="max-w-sm text-xs leading-relaxed text-[var(--bk-console-text-muted)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
