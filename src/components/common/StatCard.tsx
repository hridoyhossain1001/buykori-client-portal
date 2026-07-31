import type { ComponentType, ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'flat';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Small line under the value, e.g. "vs last 7 days". */
  caption?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  /** Percentage or short delta text shown as a trend chip. */
  delta?: ReactNode;
  trend?: TrendDirection;
  /** When true, a higher value is bad (e.g. failed events) and colours invert. */
  invertTrendColor?: boolean;
  className?: string;
}

const trendClasses: Record<Exclude<TrendDirection, 'flat'>, { good: string; bad: string }> = {
  up: { good: 'text-emerald-600', bad: 'text-red-600' },
  down: { good: 'text-red-600', bad: 'text-emerald-600' },
};

/**
 * The summary tile used at the top of Dashboard, Insights, Orders and
 * COD Protection. Standardises label casing, number weight and trend colours.
 */
export function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  delta,
  trend = 'flat',
  invertTrendColor = false,
  className = '',
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  const deltaColor =
    trend === 'flat'
      ? 'text-[var(--bk-console-text-muted)]'
      : invertTrendColor
        ? trendClasses[trend].bad
        : trendClasses[trend].good;

  return (
    <div
      className={`rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-[var(--bk-console-text-muted)]">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bk-console-blue-soft)]">
            <Icon className="h-4 w-4 text-[var(--bk-console-blue)]" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--bk-console-text)]">{value}</p>
      {(delta || caption) && (
        <div className="mt-2 flex items-center gap-2">
          {delta && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${deltaColor}`}>
              {TrendIcon && <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              {delta}
            </span>
          )}
          {caption && (
            <span className="text-[11px] text-[var(--bk-console-text-subtle)]">{caption}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default StatCard;
