import React, { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border border-[var(--bk-console-blue)] bg-[var(--bk-console-blue)] text-white shadow-sm hover:border-[var(--bk-console-blue-hover)] hover:bg-[var(--bk-console-blue-hover)]',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
  danger: 'border border-red-600 bg-red-600 text-white shadow-sm hover:border-red-700 hover:bg-red-700',
  icon: 'bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-700',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3 py-1.5 text-xs',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-11 px-5 py-2.5 text-sm',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-10 w-10 p-0',
  md: 'h-10 w-10 p-0',
  lg: 'h-11 w-11 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled,
    className = '',
    type = 'button',
    children,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${variant === 'icon' ? iconSizeClasses[size] : sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
