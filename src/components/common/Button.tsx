import React, { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

/**
 * The prototype's `.p-button`. Four things about it are deliberate and differ
 * from what was here before:
 *
 *  - **44px minimum on every size, at every viewport.** The prototype raised
 *    every control to 44px in a measured accessibility pass and put the rule at
 *    top level, not behind a mobile media query (WCAG 2.5.5). `sm` therefore
 *    differs from `md` in padding and type, not in height — which is how the
 *    prototype works too, since it has one button height for the whole portal.
 *  - **`danger` is soft, not solid.** The prototype's destructive button is dark
 *    red text on a pale red wash with a pale border (`.p-button.danger`), where
 *    this component previously used solid red-on-white. The pale treatment is
 *    what pairs with ConfirmDialog: the button opens a confirmation, it does not
 *    itself destroy anything.
 *  - **10px radius** (--bk-radius-button), not the 6px fields use. A field sits in
 *    a stack where one shared radius keeps the column of edges quiet; a button is
 *    a single object, and 6px on a 44px box reads boxy. Fields keep 6px, so the
 *    two tokens are separate on purpose.
 *  - **11px bold type** (--text-label), the prototype's single button size.
 *
 * `secondary` carries a hairline lift as well as its border. It is the workhorse
 * — Call, Refresh, Copy, every row action — and on a white panel a bordered white
 * box with no shadow reads as a disabled field rather than something to press.
 *
 * Disabled is one flat grey pair for every variant, not a faded copy of the
 * variant. `disabled:opacity-50` thinned label and background together and left
 * the label at 2.26:1 — under the 3:1 floor, so on a phone in daylight the
 * merchant cannot read which action is unavailable. The prototype settles this
 * with a single global `button:disabled` rule, which is why one treatment
 * overrides all five variants here instead of five tuned pairs.
 *
 * Three of those variants name a slate step for their label (`text-slate-700`,
 * `-600`, `-400`), and index.css re-declares those six steps in its **unlayered**
 * tail for contrast — which beats any `@layer utilities` rule, `disabled:text-…`
 * included. So the fill would turn grey while the label kept its full-strength
 * ink. `bk-button` is the marker class that lets index.css win that fight back;
 * the class and its rule only work as a pair.
 */

const disabledClasses = 'disabled:cursor-not-allowed disabled:border-[var(--bk-control-disabled-border)] '
  + 'disabled:bg-[var(--bk-control-disabled-bg)] disabled:text-[var(--bk-control-disabled-text)] disabled:shadow-none';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border border-[var(--bk-console-blue)] bg-[var(--bk-console-blue)] text-white shadow-[0_1px_2px_rgba(25,39,51,.12)] hover:border-[var(--bk-console-blue-hover)] hover:bg-[var(--bk-console-blue-hover)]',
  secondary: 'border border-[var(--bk-control-border)] bg-white text-slate-700 shadow-[0_1px_2px_rgba(25,39,51,.06)] hover:border-[var(--bk-console-border-strong)] hover:bg-slate-50',
  ghost: 'border border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
  danger: 'border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100',
  icon: 'bg-transparent text-slate-400 hover:bg-slate-100 hover:text-slate-700',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-2 py-1.5 text-label',
  md: 'min-h-11 px-3.5 py-2 text-label',
  lg: 'min-h-11 px-5 py-2.5 text-caption',
};

/** Icon-only buttons are square, and square at the 44px target size. */
const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'h-11 w-11 p-0',
  md: 'h-11 w-11 p-0',
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
      className={`bk-button inline-flex items-center justify-center gap-1.5 rounded-[var(--bk-radius-button)] font-bold transition-colors ${disabledClasses} ${variantClasses[variant]} ${variant === 'icon' ? iconSizeClasses[size] : sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
