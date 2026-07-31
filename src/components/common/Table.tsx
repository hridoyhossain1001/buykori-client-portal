import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Accessible name for the table, rendered visually hidden. */
  caption?: ReactNode;
  /** Wrapper class for the horizontal scroll container. */
  wrapperClassName?: string;
}

/**
 * Scroll-safe data table wrapper with the console's border, spacing and
 * typography defaults. Compose with TableHead / TableBody / TableRow /
 * TableHeaderCell / TableCell.
 */
export function Table({ caption, wrapperClassName = '', className = '', children, ...props }: TableProps) {
  return (
    <div className={`w-full overflow-x-auto ${wrapperClassName}`}>
      <table className={`w-full min-w-[640px] border-collapse text-left text-sm ${className}`} {...props}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={`border-b border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)] ${className}`}
      {...props}
    >
      {children}
    </thead>
  );
}

export function TableBody({ className = '', children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-[var(--bk-console-border)] ${className}`} {...props}>
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
      className={`${interactive ? 'cursor-pointer transition-colors hover:bg-[var(--bk-console-surface-muted)]' : ''} ${
        selected ? 'bg-[var(--bk-console-blue-soft)]' : ''
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

export function TableHeaderCell({ align = 'left', className = '', children, ...props }: TableHeaderCellProps) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[var(--bk-console-text-muted)] ${alignClasses[align]} ${className}`}
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
      className={`px-4 py-3 align-middle text-[var(--bk-console-text)] ${alignClasses[align]} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

export default Table;
