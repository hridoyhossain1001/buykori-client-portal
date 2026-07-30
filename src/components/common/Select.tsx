import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Convenience list; ignored when children are provided. */
  options?: SelectOption[];
  wrapperClassName?: string;
}

/**
 * Native select with the console field styling and a custom chevron.
 * Native is intentional: it stays keyboard and screen-reader friendly and
 * behaves correctly on mobile.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, wrapperClassName = '', className = '', id, children, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;
  const hasError = Boolean(error);

  return (
    <div className={`space-y-1.5 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={fieldId} className="block text-xs font-semibold text-[var(--bk-console-text)]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={fieldId}
          aria-invalid={hasError ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full appearance-none rounded-lg border bg-white py-2 pl-3 pr-9 text-sm text-[var(--bk-console-text)] transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
            hasError
              ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
              : 'border-[var(--bk-console-border-strong)] focus:border-[var(--bk-console-blue)] focus:ring-[var(--bk-console-blue-soft)]'
          } ${className}`}
          {...props}
        >
          {children
            ?? options?.map(option => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
      </div>
      {error ? (
        <p id={`${fieldId}-error`} className="text-[11px] font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-[11px] leading-relaxed text-[var(--bk-console-text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export default Select;
