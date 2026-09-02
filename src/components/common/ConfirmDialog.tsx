import { useId, type ReactNode, type RefObject } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  /** What the action will do. Wired to aria-describedby so it is announced. */
  children?: ReactNode;
  /**
   * The buttons. Order them least-destructive first: Modal focuses the first
   * focusable control, and a confirmation that opens with "Delete" focused
   * invites the mistake it exists to prevent. Pass `initialFocusRef` when the
   * markup cannot be ordered that way.
   */
  actions: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Backdrop click cancels by default, which is the safe outcome. */
  closeOnBackdrop?: boolean;
}

/**
 * The "are you sure?" step in front of an irreversible action. Ports the
 * prototype's ConfirmDialog, built on the live Modal so it inherits the focus
 * trap, Escape handling, scroll lock and focus return rather than reimplementing
 * them — and so Escape reliably cancels.
 */
export function ConfirmDialog({
  open = true,
  onClose,
  title,
  children,
  actions,
  initialFocusRef,
  closeOnBackdrop = true,
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={children ? bodyId : undefined}
      initialFocusRef={initialFocusRef}
      closeOnBackdrop={closeOnBackdrop}
      overlayClassName="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      panelClassName="w-full max-w-md rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-5 shadow-xl"
    >
      <h2 id={titleId} className="text-base font-semibold text-[var(--bk-console-text)]">
        {title}
      </h2>
      {children && (
        <div id={bodyId} className="mt-2 text-sm leading-relaxed text-[var(--bk-console-text-muted)]">
          {children}
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </Modal>
  );
}

export default ConfirmDialog;
