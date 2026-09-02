import { forwardRef, useCallback, useRef, type KeyboardEvent, type ReactNode } from 'react';

/**
 * Tab strip. One definition of the WAI-ARIA tabs pattern, so call sites do not
 * each reimplement it.
 *
 * Six places in the portal roll their own tab strip today, and they disagree on
 * how much of the pattern they implement: five have no arrow-key navigation, and
 * none links a tab to the panel it controls. That means a keyboard user has to
 * Tab through every tab to reach the content, and a screen reader announces the
 * selected tab without saying which region it governs. This primitive implements
 * the whole pattern once:
 *
 *   - roving tabindex: exactly one tab is in the Tab sequence, so Tab moves past
 *     the strip to the panel rather than through every tab
 *   - Arrow keys move between tabs (wrapping), Home/End jump to the ends
 *   - aria-controls / aria-labelledby tie each tab to its panel, via TabPanel
 *
 * Styling follows the prototype's .section-tabs and .view-tabs: an underline
 * strip, not pills. Both variants there are the same design at two heights, so
 * they are a `size` prop rather than two components.
 */

export interface TabItem<Id extends string = string> {
  id: Id;
  label: ReactNode;
  /** Optional count shown in a pill after the label, as .view-tabs button b does. */
  count?: number;
  disabled?: boolean;
  /**
   * Value for a `data-guide` attribute on this tab's button. The product tour
   * finds its highlight targets by that attribute, so a strip that replaces a
   * hand-rolled one has to be able to carry the same hook.
   */
  dataGuide?: string;
}

interface TabsProps<Id extends string = string> {
  tabs: readonly TabItem<Id>[];
  activeId: Id;
  onChange: (id: Id) => void;
  /** Accessible name for the strip. Required: a bare tablist is unlabelled. */
  label: string;
  /**
   * Prefix for the generated tab element ids. Must be unique on the page when
   * more than one strip is rendered, since TabPanel derives its ids from it.
   */
  idPrefix: string;
  /** 'md' is the prototype's .view-tabs (50px); 'sm' is .section-tabs (44px). */
  size?: 'sm' | 'md';
  /**
   * Below sm, `'wrap'` (the default) lets the tabs run onto a second line
   * instead of scrolling. Pass `'scroll'` for a strip that would wrap onto too
   * many lines to be worth it — but then give the reader another way to reach
   * the tabs that sit off the right edge, the way Orders does with its view
   * picker.
   */
  phoneLayout?: 'wrap' | 'scroll';
  className?: string;
}

/**
 * Both strips are 11px bold in the prototype. `sm` is 44px rather than
 * .section-tabs' declared 42px because portal.css then raises every control in
 * the portal to a 44px minimum, at top level rather than behind a media query —
 * so 42px is a number the prototype never actually renders.
 */
const sizeClasses = {
  sm: 'min-h-[44px] px-3.5 text-label',
  md: 'min-h-[50px] px-3 text-label',
} as const;

/** The element ids Tabs and TabPanel must agree on. */
export const tabId = (idPrefix: string, id: string) => `${idPrefix}-tab-${id}`;
export const tabPanelId = (idPrefix: string, id: string) => `${idPrefix}-panel-${id}`;

/** Where a navigation key moves selection. */
export type TabNav = 'next' | 'prev' | 'first' | 'last';

const KEY_TO_NAV: Readonly<Record<string, TabNav>> = {
  ArrowRight: 'next',
  ArrowLeft: 'prev',
  Home: 'first',
  End: 'last',
};

/**
 * The navigation a key should trigger, or null for keys the strip ignores.
 * Exported so the keyboard contract — which keys move focus, and where — is
 * pinned by a test rather than left implicit in the handler.
 */
export const navForKey = (key: string): TabNav | null => KEY_TO_NAV[key] ?? null;

/**
 * The tab id a navigation key should move selection to, skipping disabled tabs
 * and wrapping at the ends. Pure, and exported, so the arrow/Home/End contract
 * is unit-testable on its own: the component only layers focus() + onChange on
 * top of this. Returns null when no tab is eligible (all disabled, or empty).
 */
export function nextEnabledId<Id extends string>(
  tabs: readonly TabItem<Id>[],
  currentId: Id,
  nav: TabNav,
): Id | null {
  const enabled = tabs.filter(tab => !tab.disabled);
  if (enabled.length === 0) return null;
  if (nav === 'first') return enabled[0].id;
  if (nav === 'last') return enabled[enabled.length - 1].id;

  const step = nav === 'next' ? 1 : -1;
  const current = enabled.findIndex(tab => tab.id === currentId);
  // A disabled/absent current id gives findIndex === -1; step from just outside
  // the ends so 'next' lands on the first enabled tab and 'prev' on the last.
  const base = current === -1 ? (step === 1 ? -1 : 0) : current;
  return enabled[(base + step + enabled.length) % enabled.length].id;
}

export function Tabs<Id extends string = string>({
  tabs,
  activeId,
  onChange,
  label,
  idPrefix,
  size = 'md',
  phoneLayout = 'wrap',
  className = '',
}: TabsProps<Id>) {
  const refs = useRef<Partial<Record<Id, HTMLButtonElement | null>>>({});

  // Selection follows focus, which the APG recommends for strips whose panels
  // are cheap to render. The move target comes from nextEnabledId, which skips
  // disabled tabs and wraps; here we only give it a focus and fire onChange.
  const go = useCallback(
    (nav: TabNav) => {
      const target = nextEnabledId(tabs, activeId, nav);
      if (target == null) return;
      refs.current[target]?.focus();
      onChange(target);
    },
    [tabs, activeId, onChange],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nav = navForKey(event.key);
    if (!nav) return;
    event.preventDefault();
    go(nav);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      // scrollbar-hidden (index.css) keeps the strip scrollable on a phone
      // without a bar over the underline on either engine — Tailwind's
      // scrollbar-none only covers Firefox, so WebKit would show the global 6px
      // bar on top of the border-b. Matches .view-tabs::-webkit-scrollbar.
      //
      // scroll-hint-x replaces the signal that hiding the bar removed. The
      // Orders strip is 923px of tabs in a 345px box on a phone: without the
      // shadow at the right edge, five of its eight views look like they do not
      // exist. portal.css puts the same gradient on .view-tabs.
      //
      // Below sm the default is not to scroll at all: the hint was not enough.
      // A merchant on a 320px screen read the strip as ending at whatever tab
      // the edge cut off — the tabs past it were not "hard to reach", they were
      // invisible — so the phone lets the row wrap onto a second line instead,
      // where every tab is on screen and none needs a gesture to find.
      className={`flex items-end gap-0.5 border-b border-slate-200 ${
        phoneLayout === 'wrap'
          ? 'flex-wrap sm:flex-nowrap sm:overflow-x-auto sm:scrollbar-hidden sm:scroll-hint-x'
          : 'overflow-x-auto scrollbar-hidden scroll-hint-x'
      } ${className}`}
    >
      {tabs.map(tab => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={element => { refs.current[tab.id] = element; }}
            id={tabId(idPrefix, tab.id)}
            type="button"
            role="tab"
            data-guide={tab.dataGuide}
            aria-selected={active}
            aria-controls={tabPanelId(idPrefix, tab.id)}
            // The roving tabindex. Without it every tab is a Tab stop, so
            // reaching the panel means pressing Tab once per tab.
            tabIndex={active ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            onKeyDown={onKeyDown}
            // The ring is inset, not offset. The strip is a horizontal scroller,
            // so the global 2px *outside* ring (index.css) gets clipped by the
            // scroll container on the first and last tab — and with a roving
            // tabindex the selected tab is the only Tab stop, so that clipped
            // ring is the only one a keyboard user ever sees. Ported from the
            // prototype's own P1-1 remediation.
            className={`flex shrink-0 items-center gap-1.5 border-b-2 font-bold whitespace-nowrap transition-colors focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              sizeClasses[size]
            } ${
              active
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="inline-grid h-[19px] min-w-[19px] place-items-center rounded-full bg-slate-100 px-1 text-label font-semibold text-slate-500">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface TabPanelProps {
  /** Must match the Tabs idPrefix, or the aria-controls link dangles. */
  idPrefix: string;
  /** This panel's tab id. */
  tabId: string;
  /** The strip's current selection; the panel hides itself when it differs. */
  activeId: string;
  className?: string;
  children: ReactNode;
}

/**
 * The region a tab controls. Rendering it is what makes aria-controls resolve;
 * a tab pointing at an id that is not in the document is worse than no link.
 */
export const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(function TabPanel(
  { idPrefix, tabId: ownTabId, activeId, className = '', children },
  ref,
) {
  const active = ownTabId === activeId;
  return (
    <div
      ref={ref}
      id={tabPanelId(idPrefix, ownTabId)}
      role="tabpanel"
      aria-labelledby={tabId(idPrefix, ownTabId)}
      hidden={!active}
      // tabIndex=0 so a keyboard user can Tab straight from the strip into the
      // panel even when its first child is not focusable.
      tabIndex={active ? 0 : -1}
      className={className}
    >
      {active ? children : null}
    </div>
  );
});

export default Tabs;
