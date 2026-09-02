import { ChevronDown, ListChecks, Loader2 } from 'lucide-react';
import type { OrderWorkflowStatus } from '../../types';

const statusLabels: Record<OrderWorkflowStatus, string> = {
  pending: 'Pending',
  'on-hold': 'On hold',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusTones: Record<OrderWorkflowStatus, string> = {
  pending: 'border-slate-200 bg-slate-50 text-slate-600',
  'on-hold': 'border-amber-200 bg-amber-50 text-amber-700',
  confirmed: 'border-blue-200 bg-blue-50 text-blue-700',
  processing: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  shipped: 'border-violet-200 bg-violet-50 text-violet-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
};

export const orderWorkflowStatusLabel = (status: OrderWorkflowStatus) => statusLabels[status];

export function OrderWorkflowStatusBadge({ status }: { status: OrderWorkflowStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusTones[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

interface OrderStatusControlProps {
  status: OrderWorkflowStatus;
  options: OrderWorkflowStatus[];
  busy?: boolean;
  labelled?: boolean;
  onChange: (status: OrderWorkflowStatus) => void;
  orderId: string;
}

export function OrderStatusControl({
  status,
  options,
  busy = false,
  labelled = false,
  onChange,
  orderId,
}: OrderStatusControlProps) {
  const choices = options.includes(status) ? options : [status, ...options];
  const disabled = busy || choices.length <= 1;
  return (
    <label
      className={`relative inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border transition-colors ${
        labelled ? 'h-10 min-w-[78px] px-2 text-[10px]' : 'h-8 w-8'
      } ${statusTones[status]} ${busy ? 'cursor-wait opacity-60' : disabled ? 'cursor-default opacity-70' : 'cursor-pointer hover:brightness-95'}`}
      title={disabled && !busy ? `Status: ${statusLabels[status]}` : `Update order status. Current: ${statusLabels[status]}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />}
      {labelled && <span className="font-bold">Status</span>}
      <select
        value={status}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as OrderWorkflowStatus)}
        aria-label={`Update status for order ${orderId}. Current status ${statusLabels[status]}`}
        // `min-h-0` opts out of the base control rule in index.css, which gives every
        // input/select/textarea a 44px minimum height. That minimum is about target
        // size, and here the target is the <label> above: this select is an invisible
        // `inset-0` overlay whose whole job is to cover it exactly. Without the opt-out
        // the overlay is taller than the chip it covers and, being absolutely
        // positioned from `top: 0`, the excess hangs *below* the chip and swallows
        // clicks aimed at whatever sits under it in the row.
        className="absolute inset-0 h-full min-h-0 w-full cursor-pointer opacity-0 disabled:cursor-default"
      >
        {choices.map(value => (
          <option key={value} value={value}>{statusLabels[value]}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * The same control sized for a table cell, showing the status it is on.
 *
 * `OrderStatusControl` is a 32px icon chip: it saves space in a dense action
 * strip, but it never says what the status *is*. In a table the status is the
 * information, so this variant prints the label and keeps the caret to show it
 * can be changed. A row that cannot move (a delivered parcel, a return) has a
 * single choice, so it renders as a plain badge with no caret and no select —
 * a dropdown that opens onto one option reads as broken.
 */
export function OrderStatusPicker({
  status,
  options,
  busy = false,
  onChange,
  orderId,
}: Omit<OrderStatusControlProps, 'labelled'>) {
  const choices = options.includes(status) ? options : [status, ...options];
  const locked = choices.length <= 1;
  const shell = `relative inline-flex h-[26px] w-full max-w-[122px] items-center gap-1 rounded-[var(--bk-radius-pill)] border px-2 text-label font-extrabold leading-none ${statusTones[status]}`;

  if (locked && !busy) {
    return (
      <span className={shell} title={`Status: ${statusLabels[status]}. This order is finished, so it cannot change.`}>
        <span className="truncate">{statusLabels[status]}</span>
      </span>
    );
  }

  return (
    <label
      className={`${shell} transition-colors ${busy ? 'cursor-wait opacity-60' : 'cursor-pointer hover:brightness-95 focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--bk-console-blue)]'}`}
      title={`Change status. Now: ${statusLabels[status]}`}
    >
      {busy && <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />}
      <span className="truncate">{statusLabels[status]}</span>
      {!busy && <ChevronDown className="ml-auto h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />}
      <select
        value={status}
        disabled={busy}
        onChange={(event) => onChange(event.target.value as OrderWorkflowStatus)}
        aria-label={`Change status for order ${orderId}. Current status ${statusLabels[status]}`}
        // The chip is 26px because the row is: a 44px box here would break the
        // table's rhythm, so the *target* grows instead of the box — 12px above and
        // below the label's 24px padding box, giving 48px. (The padding box, not the
        // 26px border box: an absolute child is positioned against the padding box,
        // so the chip's 1px border is outside the sum and `-inset-y-2.5` landed on
        // exactly 44.0 — the floor, with no room for a future border change.) It
        // grows on the select rather than as a `btn-touch-expand` halo on the label
        // because clicking a label only focuses a <select>, it never opens it; what a
        // finger lands on has to be the select itself.
        //
        // Symmetry is the safety property. `min-h-0` opts out of the 44px base
        // control rule in index.css, which keeps `top: 0` and so hangs the whole
        // excess *below* the chip, where it swallows clicks aimed at the row
        // underneath. `-inset-y-3` splits the growth evenly, and 12px stays inside
        // the cell's own 14px `py-3.5`, so it never reaches a neighbouring row.
        className="absolute inset-x-0 -inset-y-3 min-h-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        {choices.map(value => (
          <option key={value} value={value}>{statusLabels[value]}</option>
        ))}
      </select>
    </label>
  );
}
