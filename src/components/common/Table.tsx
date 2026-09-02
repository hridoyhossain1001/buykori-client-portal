import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Accessible name for the table, rendered visually hidden. */
  caption?: ReactNode;
  /** Wrapper class for the horizontal scroll container. */
  wrapperClassName?: string;
}

/**
 * Scroll-safe data table wrapper carrying the prototype's table typography.
 * Compose with TableHead / TableBody / TableRow / TableHeaderCell / TableCell.
 *
 * The table sets 12px (--text-caption), which is where portal.css landed after
 * its own remediation pass raised `th` and the primary line in a cell from 11px.
 * A cell's *secondary* line stays 11px (text-label), which callers set on the
 * inner element the way the prototype does.
 *
 * Rows are **not** given a fixed height. The prototype's base rule is
 * `td { height: 72px }`, and that reads as a design signature until you look at
 * what it is doing: a 72px row is two lines of 12px/11px text plus padding, and
 * the fixed height only matters for the single-line case. The prototype's own
 * later passes moved away from it (`.delivery-log-table tbody tr` ended at
 * `height: auto`), and this primitive is shared with three-column tables — an AI
 * Ads proposal diff of Field / Before / After would be absurd at 72px a row. So
 * the density comes from padding, and two-line cells reach the prototype's
 * height on their own.
 */
export function Table({ caption, wrapperClassName = '', className = '', children, ...props }: TableProps) {
  return (
    <div className={`bk-table-scroll w-full overflow-x-auto ${wrapperClassName}`}>
      <table className={`w-full min-w-[640px] border-collapse text-left text-caption ${className}`} {...props}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`border-b border-[var(--bk-console-border)] bg-table-head ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-cell-line ${className}`} {...props}>
      {children}
    </tbody>
  );
}

interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Adds hover feedback for rows that expand or navigate. */
  interactive?: boolean;
  selected?: boolean;
}

export function TableRow({ interactive = false, selected = false, className = '', children, ...props }: TableRowProps) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={`${interactive ? 'cursor-pointer transition-colors hover:bg-row-hover' : ''} ${
        selected ? 'bg-surface-selected' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

/**
 * The prototype's `th`: 42px tall, the display face at weight 600 rather than
 * bold, and a wide 0.075em tracking. The combination is what stops an uppercase
 * 12px header from reading as shouting — Archivo at 600 with the letters opened
 * up is a label, the same string in bold sans is a heading.
 */
export function TableHeaderCell({ align = 'left', className = '', children, ...props }: TableHeaderCellProps) {
  return (
    <th
      scope="col"
      className={`h-[42px] px-3 font-display font-semibold uppercase tracking-[0.075em] text-[var(--bk-console-text-muted)] ${alignClasses[align]} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right';
}

export function TableCell({ align = 'left', className = '', children, ...props }: TableCellProps) {
  return (
    <td
      className={`px-3 py-2.5 align-middle text-[var(--bk-console-text-body)] ${alignClasses[align]} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

export default Table;
