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
  up: { good: 'text-emerald-600', bad: 'text-rose-600' },
  down: { good: 'text-rose-600', bad: 'text-emerald-600' },
};

/**
 * The summary tile used at the top of Dashboard, Insights, Orders and
 * COD Protection. Standardises label casing, number weight and trend colours.
 *
 * The prototype has no standalone metric tile — its metrics live in the joined
 * bordered row that Phase 2 ported as MetricStrip. So this takes the strip's
 * typography (11px/800 uppercase label, 24px/700 value, 12px caption) and wears
 * it on a panel, which is the nearest thing the prototype's vocabulary has to a
 * tile. The 104px minimum is the strip's cell height, and it earns its keep
 * here: a row of these stays aligned even when only some have a caption.
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
      className={`min-h-[104px] rounded-[var(--bk-radius-panel)] border border-[var(--bk-panel-border)] bg-[var(--bk-console-surface)] p-5 shadow-[var(--bk-panel-shadow)] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-label font-extrabold uppercase tracking-[0.02em] text-[var(--bk-console-text-muted)]">
          {label}
        </p>
        {Icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--bk-radius-control)] bg-[var(--bk-console-blue-soft)]">
            <Icon className="h-4 w-4 text-[var(--bk-console-blue)]" />
          </span>
        )}
      </div>
      <p className="mt-2 text-display font-bold text-[var(--bk-console-text)]">{value}</p>
      {(delta || caption) && (
        <div className="mt-2 flex items-center gap-1.5">
          {delta && (
            <span className={`inline-flex items-center gap-1 text-caption font-semibold ${deltaColor}`}>
              {TrendIcon && <TrendIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              {delta}
            </span>
          )}
          {caption && <span className="text-caption text-[var(--bk-console-text-subtle)]">{caption}</span>}
        </div>
      )}
    </div>
  );
}

export default StatCard;
