import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';

/**
 * Elements that can receive keyboard focus inside a dialog surface.
 * Kept in sync with the equivalent list in `Modal.tsx`.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface DialogBehaviorOptions {
  open: boolean;
  onClose: () => void;
  /** The element carrying `role="dialog"`. Focus is moved into and trapped inside it. */
  containerRef: RefObject<HTMLElement | null>;
  /** Focus this instead of the first focusable child when opening. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnEscape?: boolean;
}

/**
 * Dialog keyboard/focus behaviour for surfaces that cannot use the shared
 * `Modal` component.
 *
 * `Modal` owns both behaviour *and* layout (a flex-centred overlay plus a
 * body-scroll lock). Two surfaces need the behaviour but not the layout:
 *
 *   - `ProductGuide` positions its card next to the element being explained and
 *     calls `scrollIntoView()` on each step. `Modal`'s `overflow:hidden` scroll
 *     lock would stop the page from scrolling, breaking the tour outright.
 *   - `MobileEventDetailSheet` is a bottom sheet with its own slide-up panel.
 *
 * So the focus/escape/return-focus contract lives here and the two components
 * keep their own positioning. Escape is handled on `document` rather than on the
 * container so it still fires if focus has drifted outside the dialog.
 */
export function useDialogBehavior({
  open,
  onClose,
  containerRef,
  initialFocusRef,
  closeOnEscape = true,
}: DialogBehaviorOptions) {
  // Held in a ref so the Escape listener never needs re-binding when the
  // caller passes a new inline `onClose`.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Move focus in on open, and put it back where it came from on close.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const animationFrame = window.requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      const preferred = initialFocusRef?.current
        ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (preferred ?? container).focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      // Only restore focus if it is still inside the dialog; otherwise the user
      // has deliberately moved on and we would be yanking focus back.
      const container = containerRef.current;
      const focusMovedAway = container && document.activeElement instanceof Node
        && !container.contains(document.activeElement);
      if (!focusMovedAway && previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [open, containerRef, initialFocusRef]);

  useEffect(() => {
    if (!open || !closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
    };

    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [open, closeOnEscape]);

  /** Attach to the dialog container to keep Tab cycling inside it. */
  const handleTabKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const container = containerRef.current;
    if (!container) return;

    const focusable = (Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[])
      .filter((element) => element.getClientRects().length > 0);

    if (focusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === container)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }, [containerRef]);

  return { handleTabKeyDown };
}

export default useDialogBehavior;
