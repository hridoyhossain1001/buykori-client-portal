import { CheckCircle2, XCircle } from 'lucide-react';

export interface GlobalToastState {
  show: boolean;
  msg: string;
  err: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface GlobalToastProps {
  toast: GlobalToastState;
  onDismiss: () => void;
}

/**
 * Fixed notification overlay for the client console. Rendering is controlled by
 * `toast.show` so the caller keeps a single piece of toast state.
 */
export function GlobalToast({ toast, onDismiss }: GlobalToastProps) {
  if (!toast.show) return null;

  return (
    <div
      className={`fixed right-4 top-4 z-[250] flex w-[calc(100vw-2rem)] max-w-sm items-start gap-3 overflow-hidden rounded-xl border bg-white px-4 py-3.5 shadow-[0_20px_50px_rgba(15,23,42,.28)] animate-slide-in-up sm:right-6 sm:top-6 ${toast.err ? 'border-rose-200' : 'border-emerald-200'}`}
      role="status"
      aria-live="polite"
    >
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${toast.err ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
        {toast.err ? (
          <XCircle className="h-4.5 w-4.5" />
        ) : (
          <CheckCircle2 className="h-4.5 w-4.5" />
        )}
      </span>
      <span className="min-w-0 flex-1 pt-1 text-xs font-semibold leading-relaxed text-slate-800">
        {toast.msg}
      </span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            const action = toast.onAction;
            onDismiss();
            action?.();
          }}
          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50"
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}

export default GlobalToast;
