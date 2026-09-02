import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * The prototype's `.form-grid label input`. Three of these values also appear in
 * the base `input, select, textarea` rule in index.css, and the point of naming
 * them here is that they now *agree*: before this, the component's `rounded-lg`
 * and `border-strong` silently overrode the base rule's 6px radius and lighter
 * control border, so a bare `<input>` and an `<Input>` on the same form did not
 * match. The height comes from that base rule (44px) rather than from here.
 *
 * `focus:ring-*` is the whole focus indicator, not a decoration on top of one:
 * Tailwind v4's ring utility outranks the `input:focus` box-shadow in index.css,
 * so the accent is named here rather than `--bk-console-blue-soft`, which was
 * 1.13:1 against white — invisible, and a WCAG 2.4.11 failure.
 */
const controlClasses = (hasError: boolean) =>
  `w-full rounded-[var(--bk-radius-control)] border bg-white px-2.5 py-2 text-label font-medium text-[var(--bk-console-text)] transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
    hasError
      ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500'
      : 'border-[var(--bk-control-border)] focus:border-[var(--bk-console-blue)] focus:ring-[var(--bk-console-blue)]'
  }`;

function FieldShell({ id, label, hint, error, className = '', children }: FieldShellProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        // 11px at weight 800 in muted ink, not 12px semibold in full ink. The
        // prototype makes field labels small and heavy so they read as a
        // caption over the control rather than competing with it.
        <label htmlFor={id} className="block text-label font-extrabold text-[var(--bk-console-text-muted)]">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-label font-medium text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-label leading-relaxed text-[var(--bk-console-text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Class name for the wrapping field, not the input element. */
  wrapperClassName?: string;
}

/** Labelled text input with consistent focus ring, hint and error wiring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, wrapperClassName, className = '', id, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${controlClasses(Boolean(error))} ${className}`}
        {...props}
      />
    </FieldShell>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
}

/** Multi-line counterpart of Input, sharing the same field shell. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, wrapperClassName, className = '', id, rows = 4, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <FieldShell id={fieldId} label={label} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${controlClasses(Boolean(error))} ${className}`}
        {...props}
      />
    </FieldShell>
  );
});

export default Input;
