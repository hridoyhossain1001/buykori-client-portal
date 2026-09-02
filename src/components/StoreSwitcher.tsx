import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Store } from 'lucide-react';
import type { StoreInfo } from '../types';

/**
 * The store's own address, in the topbar, with the switcher behind it.
 *
 * This is the "Active store" card that used to sit in the left rail. Two reasons
 * it reads better here. The rail is for navigation, and that card was the one
 * block of it nobody clicked to navigate; and the thing a merchant with more
 * than one store actually recognises is the domain, which the card printed as
 * its third and smallest line. So the domain is the label, and the store's name
 * moves inside the menu where the two are read side by side.
 *
 * Deliberately no coloured status dot. The connection badge sits immediately to
 * the right of this chip and already carries that state in words as well as
 * colour; a green dot here would either duplicate it or, worse, still be green
 * while the badge said "Disconnected".
 */
export function StoreSwitcher({
  stores,
  fallbackName,
  onSwitchStore,
  onCreateStore,
}: {
  stores: StoreInfo[];
  /** Shown when the workspace has no store row yet — the account's own name. */
  fallbackName: string;
  onSwitchStore?: (clientId: number) => Promise<void>;
  onCreateStore?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<number | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (hostRef.current && !hostRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = stores.find(store => store.is_current);
  const label = current?.domain || current?.name || fallbackName;
  // With one store and no way to add another there is nothing to open, so the
  // chip is text rather than a button that does nothing when pressed.
  const interactive = stores.length > 1 || Boolean(onCreateStore);

  const chip = (
    <>
      <Store aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--bk-console-text-subtle)]" />
      <span className="truncate font-semibold text-[var(--bk-console-text-body)]" title={label}>
        {label}
      </span>
      {interactive && (
        <ChevronDown
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 text-[var(--bk-console-text-subtle)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      )}
    </>
  );

  if (!interactive) {
    return (
      <div data-guide="active-store" className="flex min-w-0 items-center gap-2 text-caption">
        {chip}
      </div>
    );
  }

  const switchTo = async (clientId: number) => {
    if (!onSwitchStore) return;
    setSwitching(clientId);
    try {
      await onSwitchStore(clientId);
    } finally {
      setSwitching(null);
      setOpen(false);
    }
  };

  return (
    <div ref={hostRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        data-guide="active-store"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Active store: ${label}. Switch store`}
        className="flex min-w-0 max-w-[240px] items-center gap-2 rounded-[var(--bk-radius-control)] px-2 py-1 text-caption transition-colors hover:bg-[var(--bk-console-surface-muted)]"
      >
        {chip}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1.5 w-[280px] overflow-hidden rounded-[var(--bk-radius-panel)] border border-[var(--bk-panel-border)] bg-[var(--bk-console-surface)] shadow-xl"
        >
          <div className="max-h-64 overflow-y-auto py-1">
            {stores.map(store => (
              <button
                key={store.client_id}
                type="button"
                role="menuitem"
                onClick={() => !store.is_current && switchTo(store.client_id)}
                disabled={store.is_current || switching === store.client_id}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  store.is_current
                    ? 'cursor-default bg-[var(--bk-console-surface-muted)]'
                    : 'cursor-pointer hover:bg-row-hover'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--bk-console-surface-muted)]">
                  <Store className="h-3.5 w-3.5 text-[var(--bk-console-text-muted)]" />
                </span>
                <span className="min-w-0 flex-1">
                  {/* Name over domain here, the reverse of the chip: in a list the
                      name is what tells two of the merchant's stores apart, and
                      the domain is the confirmation underneath. */}
                  <span className="block truncate text-caption font-semibold text-[var(--bk-console-text)]" title={store.name}>
                    {store.name}
                  </span>
                  <span
                    className="block truncate text-label text-[var(--bk-console-text-muted)]"
                    title={store.domain || 'No domain set'}
                  >
                    {store.domain || 'No domain set'}
                  </span>
                </span>
                {store.is_current && <Check className="h-3.5 w-3.5 shrink-0 text-[var(--bk-accent)]" />}
                {switching === store.client_id && (
                  <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--bk-accent)] border-t-transparent" />
                )}
              </button>
            ))}
          </div>
          {onCreateStore && (
            <div className="border-t border-[var(--bk-console-border)]">
              <button
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onCreateStore(); }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-caption font-semibold text-[var(--bk-accent)] transition-colors hover:bg-row-hover"
              >
                <Plus className="h-4 w-4" />
                Add New Store
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StoreSwitcher;
