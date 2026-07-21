import React, { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let openModalCount = 0;
let originalBodyOverflow = '';

interface ModalProps {
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  describedBy?: string;
  ariaLabel?: string;
  overlayClassName?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}

export function Modal({
  open = true,
  onClose,
  children,
  labelledBy,
  describedBy,
  ariaLabel,
  overlayClassName = '',
  panelClassName = '',
  panelStyle,
  initialFocusRef,
  returnFocusRef,
  closeOnBackdrop = false,
  closeOnEscape = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    if (openModalCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openModalCount += 1;

    const animationFrame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferredTarget = initialFocusRef?.current ?? panel.querySelector<HTMLElement>('[autofocus]');
      const firstFocusable = panel.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (preferredTarget ?? firstFocusable ?? panel).focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) document.body.style.overflow = originalBodyOverflow;
      const returnTarget = returnFocusRef?.current ?? previouslyFocused;
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [initialFocusRef, open, returnFocusRef]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusable = (Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[])
      .filter((element) => element.getClientRects().length > 0);

    if (focusable.length === 0) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className={overlayClassName}
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={ariaLabel}
        tabIndex={-1}
        className={panelClassName}
        style={panelStyle}
      >
        {children}
      </div>
    </div>
  );
}
