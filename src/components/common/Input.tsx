import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldShellProps {
  id: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}

const controlClasses = (hasError: boolean) =>
  `w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--bk-console-text)] transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
    hasError
      ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
      : 'border-[var(--bk-console-border-strong)] focus:border-[var(--bk-console-blue)] focus:ring-[var(--bk-console-blue-soft)]'
  }`;

function FieldShell({ id, label, hint, error, className = '', children }: FieldShellProps) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-[var(--bk-console-text)]">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[11px] font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[11px] leading-relaxed text-[var(--bk-console-text-muted)]">
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
