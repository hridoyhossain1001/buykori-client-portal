import type { ComponentType, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  /** Lucide icon component. Defaults to a warning triangle. */
  icon?: ComponentType<{ className?: string }>;
  title?: ReactNode;
  /** One actionable sentence — pass `describeFetchError(error)`. */
  description: ReactNode;
  /** Omit to render an explanation with no retry affordance. */
  onRetry?: () => void;
  retrying?: boolean;
  retryLabel?: string;
  className?: string;
  compact?: boolean;
}

/**
 * UX-02: consistent "this failed, here is how to recover" placeholder.
 *
 * Mirrors `EmptyState` deliberately — a merchant should be able to tell a
 * failure from an empty account at a glance, and panels that previously
 * swallowed errors rendered the empty state for both.
 *
 * `role="alert"` announces the failure to assistive tech, since these states
 * appear after an interaction rather than on first paint.
 */
export function ErrorState({
  icon: Icon = AlertTriangle,
  title = "Couldn't load this",
  description,
  onRetry,
  retrying = false,
  retryLabel = 'Try again',
  className = '',
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center ${compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14'} ${className}`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-rose-50 ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}
      >
        <Icon className={`text-rose-500 ${compact ? 'h-5 w-5' : 'h-6 w-6'}`} />
      </span>
      <h4 className="text-sm font-bold text-[var(--bk-console-text)]">{title}</h4>
      <p className="max-w-sm text-xs leading-relaxed text-[var(--bk-console-text-muted)]">{description}</p>
      {onRetry && (
        <div className="mt-2">
          <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying} disabled={retrying}>
            <RotateCw className="h-3.5 w-3.5" />
            {retrying ? 'Retrying…' : retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export default ErrorState;
