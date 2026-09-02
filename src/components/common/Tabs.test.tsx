import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  Tabs,
  TabPanel,
  tabId,
  tabPanelId,
  navForKey,
  nextEnabledId,
  type TabItem,
} from './Tabs';

/**
 * Tabs is the one WAI-ARIA tab strip the portal shares, replacing six hand-rolled
 * strips that disagreed on the pattern: five had no arrow-key navigation and none
 * linked a tab to the panel it controls. These tests pin the parts of that
 * contract that are easy to lose in a restyle — the roving tabindex, the
 * tab↔panel wiring, and the keyboard navigation — so a future edit that quietly
 * drops one fails here instead of silently regressing accessibility.
 *
 * Structure and ARIA are asserted from static markup (the house convention, see
 * ErrorState.test.tsx). Keyboard navigation is asserted against nextEnabledId /
 * navForKey, the pure helpers the handler is built from, so the contract is
 * checked without the fragility of mounting React into a synthetic DOM.
 */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

const TABS: TabItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders', count: 12 },
  { id: 'settings', label: 'Settings' },
];

const strip = (activeId: string, extra: Partial<React.ComponentProps<typeof Tabs>> = {}) =>
  render(
    <Tabs
      tabs={TABS}
      activeId={activeId}
      onChange={() => {}}
      label="Sections"
      idPrefix="acct"
      {...extra}
    />,
  );

// --- 1. ARIA structure -----------------------------------------------------

test('renders a labelled, horizontal tablist with one tab per item', () => {
  const html = strip('overview');
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes('aria-label="Sections"'));
  assert.ok(html.includes('aria-orientation="horizontal"'));
  assert.equal((html.match(/role="tab"/g) || []).length, TABS.length);
});

test('marks exactly the active tab selected and tabbable (the roving tabindex)', () => {
  const html = strip('orders');
  // Active tab: selected and in the Tab sequence.
  assert.match(html, /id="acct-tab-orders"[^>]*aria-selected="true"/);
  assert.match(html, /id="acct-tab-orders"[^>]*tabindex="0"/);
  // Every inactive tab is removed from the Tab sequence, so Tab reaches the
  // panel rather than walking through every tab.
  assert.match(html, /id="acct-tab-overview"[^>]*aria-selected="false"/);
  assert.match(html, /id="acct-tab-overview"[^>]*tabindex="-1"/);
  assert.match(html, /id="acct-tab-settings"[^>]*tabindex="-1"/);
  assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
});

test('links each tab to its panel and the panel back to the tab', () => {
  // The wiring none of the six replaced strips had. The helpers are the single
  // source of both ids, so a rendered tab's aria-controls must equal the
  // panel id the helper produces, and the panel must point back with the same
  // tab id — otherwise aria-controls / aria-labelledby dangle.
  const tabsHtml = strip('overview');
  assert.match(
    tabsHtml,
    new RegExp(`id="${tabId('acct', 'orders')}"[^>]*aria-controls="${tabPanelId('acct', 'orders')}"`),
  );

  const panelHtml = render(
    <TabPanel idPrefix="acct" tabId="orders" activeId="orders">
      body
    </TabPanel>,
  );
  assert.ok(panelHtml.includes(`id="${tabPanelId('acct', 'orders')}"`));
  assert.ok(panelHtml.includes(`aria-labelledby="${tabId('acct', 'orders')}"`));
});

test('shows a count pill only for tabs given a count', () => {
  const html = strip('overview');
  assert.ok(html.includes('>12<')); // Orders has count: 12
  // Overview/Settings have no count, so there is exactly one pill.
  assert.equal((html.match(/rounded-full/g) || []).length, 1);
});

test('applies the height its size variant asks for', () => {
  // md (default) is the prototype .view-tabs at 50px; sm is .section-tabs, whose
  // declared 42px portal.css then raises to the portal-wide 44px control minimum.
  assert.ok(strip('overview').includes('min-h-[50px]'));
  assert.ok(strip('overview', { size: 'sm' }).includes('min-h-[44px]'));
  assert.ok(!strip('overview', { size: 'sm' }).includes('min-h-[50px]'));
});

test('disables a tab the caller marks disabled', () => {
  const html = render(
    <Tabs
      tabs={[
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', disabled: true },
      ]}
      activeId="a"
      onChange={() => {}}
      label="x"
      idPrefix="d"
    />,
  );
  assert.match(html, /id="d-tab-b"[^>]*disabled/);
});

// --- 2. TabPanel -----------------------------------------------------------

test('TabPanel hides itself and drops its children when inactive', () => {
  const active = render(
    <TabPanel idPrefix="acct" tabId="orders" activeId="orders">
      <p>orders body</p>
    </TabPanel>,
  );
  assert.ok(active.includes('role="tabpanel"'));
  assert.ok(active.includes('orders body'));
  assert.ok(!active.includes('hidden'));
  assert.ok(active.includes('tabindex="0"'));

  const inactive = render(
    <TabPanel idPrefix="acct" tabId="orders" activeId="overview">
      <p>orders body</p>
    </TabPanel>,
  );
  assert.ok(inactive.includes('hidden'));
  assert.ok(!inactive.includes('orders body')); // not just visually hidden — not rendered
  assert.ok(inactive.includes('tabindex="-1"'));
});

// --- 3. Keyboard navigation (pure helpers) ---------------------------------

test('the four navigation keys map to the right move, and nothing else does', () => {
  assert.equal(navForKey('ArrowRight'), 'next');
  assert.equal(navForKey('ArrowLeft'), 'prev');
  assert.equal(navForKey('Home'), 'first');
  assert.equal(navForKey('End'), 'last');
  for (const ignored of ['ArrowUp', 'ArrowDown', 'Enter', ' ', 'Tab', 'a']) {
    assert.equal(navForKey(ignored), null, `${ignored} must not navigate`);
  }
});

test('arrows step to the adjacent tab and wrap at the ends', () => {
  assert.equal(nextEnabledId(TABS, 'overview', 'next'), 'orders');
  assert.equal(nextEnabledId(TABS, 'orders', 'next'), 'settings');
  assert.equal(nextEnabledId(TABS, 'settings', 'next'), 'overview'); // wrap forward
  assert.equal(nextEnabledId(TABS, 'overview', 'prev'), 'settings'); // wrap back
  assert.equal(nextEnabledId(TABS, 'settings', 'prev'), 'orders');
});

test('Home and End jump to the first and last tab', () => {
  assert.equal(nextEnabledId(TABS, 'settings', 'first'), 'overview');
  assert.equal(nextEnabledId(TABS, 'overview', 'last'), 'settings');
});

test('navigation steps over disabled tabs from every direction', () => {
  const withHole: TabItem[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B', disabled: true },
    { id: 'c', label: 'C' },
    { id: 'd', label: 'D', disabled: true },
  ];
  assert.equal(nextEnabledId(withHole, 'a', 'next'), 'c'); // skip disabled b
  assert.equal(nextEnabledId(withHole, 'c', 'next'), 'a'); // skip disabled d, wrap
  assert.equal(nextEnabledId(withHole, 'a', 'prev'), 'c'); // wrap back over d
  assert.equal(nextEnabledId(withHole, 'c', 'prev'), 'a'); // skip b
  assert.equal(nextEnabledId(withHole, 'a', 'last'), 'c'); // last enabled, not d
  assert.equal(nextEnabledId(withHole, 'c', 'first'), 'a');
});

test('navigation from an unknown or disabled current id steps in from the end', () => {
  const withHole: TabItem[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B', disabled: true },
    { id: 'c', label: 'C' },
  ];
  // 'b' is disabled (not among the enabled set), and 'z' is absent entirely.
  assert.equal(nextEnabledId(withHole, 'b', 'next'), 'a');
  assert.equal(nextEnabledId(withHole, 'b', 'prev'), 'c');
  assert.equal(nextEnabledId(TABS, 'z' as string, 'next'), 'overview');
  assert.equal(nextEnabledId(TABS, 'z' as string, 'prev'), 'settings');
});

test('navigation returns null when there is no enabled tab', () => {
  const allOff: TabItem[] = [
    { id: 'a', label: 'A', disabled: true },
    { id: 'b', label: 'B', disabled: true },
  ];
  for (const nav of ['next', 'prev', 'first', 'last'] as const) {
    assert.equal(nextEnabledId(allOff, 'a', nav), null);
    assert.equal(nextEnabledId([], 'a', nav), null);
  }
});

test('the phone strip wraps rather than scrolling, unless a call site opts out', () => {
  // The scroll hint was not enough: on a 320px screen a merchant read the strip
  // as ending at whatever tab the edge cut off, so the tabs past it were not
  // hard to reach — they were invisible. Wrapping puts every tab on screen.
  const wrapped = render(<Tabs tabs={TABS} activeId="overview" onChange={() => {}} label="Views" idPrefix="t" />);
  const strip = wrapped.match(/<div role="tablist"[^>]*class="([^"]*)"/)?.[1] ?? '';
  assert.ok(strip.includes('flex-wrap'), 'the phone strip wraps');
  assert.ok(strip.includes('sm:flex-nowrap'), 'and stops wrapping from sm up');
  assert.ok(strip.includes('sm:overflow-x-auto'), 'where it scrolls again');
  assert.ok(!/(^|\s)overflow-x-auto/.test(strip), 'so a phone never has to scroll it');

  const scrolling = render(
    <Tabs tabs={TABS} activeId="overview" onChange={() => {}} label="Views" idPrefix="t" phoneLayout="scroll" />,
  );
  const optedOut = scrolling.match(/<div role="tablist"[^>]*class="([^"]*)"/)?.[1] ?? '';
  assert.ok(!optedOut.includes('flex-wrap'));
  assert.ok(optedOut.includes('scroll-hint-x'));
});
