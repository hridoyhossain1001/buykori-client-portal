import type { HTMLAttributes } from 'react';

type SkeletonShape = 'line' | 'block' | 'circle';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shape?: SkeletonShape;
}

const shapeClasses: Record<SkeletonShape, string> = {
  line: 'h-3 rounded',
  // The control radius, so a block standing in for a button, a field or a table
  // row has the same corner as the thing that replaces it.
  block: 'rounded-[var(--bk-radius-control)]',
  circle: 'rounded-full',
};

/** Single shimmer placeholder. Give it width/height via className. */
export function Skeleton({ shape = 'line', className = '', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-slate-200 ${shapeClasses[shape]} ${className}`}
      {...props}
    />
  );
}

interface SkeletonTableProps {
  rows?: number;
  className?: string;
}

/** Placeholder rows for a data table while its payload loads. */
export function SkeletonTable({ rows = 5, className = '' }: SkeletonTableProps) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading data</span>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} shape="block" className="h-10 w-full" />
      ))}
    </div>
  );
}

interface SkeletonCardsProps {
  count?: number;
  className?: string;
}

/**
 * Placeholder grid matching the stat-card row at the top of most pages.
 *
 * The tile deliberately carries StatCard's exact box — panel radius, panel
 * border, panel shadow, 20px padding and the 104px minimum — so the summary row
 * does not resize under the merchant when the numbers land.
 */
export function SkeletonCards({ count = 4, className = '' }: SkeletonCardsProps) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading summary</span>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="min-h-[104px] space-y-3 rounded-[var(--bk-radius-panel)] border border-[var(--bk-panel-border)] bg-[var(--bk-console-surface)] p-5 shadow-[var(--bk-panel-shadow)]"
        >
          <Skeleton className="w-1/2" />
          <Skeleton shape="block" className="h-8 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
