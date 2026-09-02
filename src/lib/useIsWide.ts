import { useEffect, useState } from 'react';

/**
 * True while the viewport is at least `min` px wide. Read once for the first
 * paint and then listened to, so dragging a window across the breakpoint
 * switches layout without a reload. Defaults to true when there is no `window`
 * (SSR / tests), which keeps the desktop markup as the fallback.
 *
 * Use this only where the *element* has to change, not just its styling — a
 * `md:` class is cheaper and cannot go out of sync with the breakpoint. The two
 * cases in the portal today are a cell that is a button on a phone and a div on
 * a desktop, and a tab strip that is a `<select>` on a phone: in both, rendering
 * the other one and hiding it with CSS would leave a focusable, announced
 * duplicate in the accessibility tree.
 */
export function useIsWide(min: number) {
  const [wide, setWide] = useState(
    () => typeof window === 'undefined' || window.matchMedia(`(min-width: ${min}px)`).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${min}px)`);
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [min]);
  return wide;
}

export default useIsWide;
