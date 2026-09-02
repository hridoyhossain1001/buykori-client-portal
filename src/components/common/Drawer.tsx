import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Modal } from './Modal';

interface DrawerProps {
  open?: boolean;
  onClose: () => void;
  /** Small kicker above the title, e.g. "Order". */
  eyebrow?: ReactNode;
  title: ReactNode;
  children: ReactNode;
  /** Extra classes for the sliding panel, e.g. a wider max-width. */
  className?: string;
}

/**
 * A panel that slides in from the right for record detail, ported from the
 * prototype's Drawer.
 *
 * The prototype trapped focus itself with a useDialogA11y hook. Here it is built
 * on the live Modal instead, which already does that plus body scroll-locking,
 * Escape handling and returning focus to whatever opened it — so a drawer cannot
 * drift out of step with the portal's other dialogs. On a phone it becomes a
 * full-width sheet, since a 420px side panel on a 360px screen is unusable.
 */
export function Drawer({ open = true, onClose, eyebrow, title, children, className = '' }: DrawerProps) {
  const titleId = useId();

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      closeOnBackdrop
      overlayClassName="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm"
      panelClassName={`flex h-full w-full flex-col overflow-y-auto border-l border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] shadow-xl sm:max-w-[440px] ${className}`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-[var(--bk-console-border)] px-5 py-4">
        <div className="min-w-0">
          {eyebrow && (
            <span className="block text-[11px] font-extrabold text-[var(--bk-console-blue)]">
              {eyebrow}
            </span>
          )}
          <h2 id={titleId} className="mt-0.5 text-base font-semibold text-[var(--bk-console-text)]">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="inline-grid min-h-[44px] min-w-[44px] shrink-0 place-items-center rounded-md text-[var(--bk-console-text-muted)] transition-colors hover:bg-[var(--bk-console-surface-muted)] hover:text-[var(--bk-console-text)]"
        >
          <X className="h-[19px] w-[19px]" aria-hidden="true" />
        </button>
      </header>
      {children}
    </Modal>
  );
}

export default Drawer;
