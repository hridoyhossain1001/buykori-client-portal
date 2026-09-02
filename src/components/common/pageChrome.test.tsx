import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { PageHeader } from './PageHeader';
import { SectionTitle } from './SectionTitle';
import { MetricStrip } from './MetricStrip';
import { Status, statusTone } from './Status';
import { PaginationControls, pageWindow } from './PaginationControls';

/**
 * The Phase 2 page-chrome primitives ported from the prototype. The tests worth
 * having here are on the two that carry real logic — statusTone's keyword
 * precedence and PaginationControls' windowing and range arithmetic — plus the
 * structural promises (heading levels, ARIA labels) that a restyle could quietly
 * break. Static markup only, per the house convention (see ErrorState.test.tsx).
 */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

/**
 * The "Showing 11–20 of 42 orders" sentence, pulled out so assertions can name
 * the exact range. Asserting against the whole markup instead is a trap: the
 * class attributes contain every hyphen and the word "disabled" (Tailwind's
 * `disabled:` variants), so loose substring checks pass or fail by accident.
 */
const rangeText = (html: string) => html.match(/Showing[^<]*/)?.[0] ?? '';

/** Whether a button really carries the disabled attribute, not a `disabled:` class. */
const isDisabled = (html: string, ariaLabel: string) =>
  new RegExp(`aria-label="${ariaLabel}" disabled=""`).test(html);

// --- PageHeader ------------------------------------------------------------

test('PageHeader renders the page h1 and its optional parts only when given', () => {
  const full = render(
    <PageHeader eyebrow="Operations" title="Orders" description="Every order." action={<button>New</button>} />,
  );
  assert.ok(full.includes('<h1'));
  assert.ok(full.includes('Orders'));
  assert.ok(full.includes('Operations'));
  assert.ok(full.includes('Every order.'));
  assert.ok(full.includes('<button>New</button>'));

  // A page with only a title must not emit empty eyebrow/description/action
  // wrappers, which would otherwise add stray vertical rhythm.
  const bare = render(<PageHeader title="Orders" />);
  assert.equal((bare.match(/<p/g) || []).length, 0);
  assert.equal((bare.match(/<div/g) || []).length, 2); // outer row + text column
});

test('PageHeader folds the phone head away by default, and only when it has prose to fold', () => {
  // The point of the compact head: the app bar already names the page, so on a
  // phone the eyebrow, the 26px h1 and the paragraph under it were 150-200px of
  // restatement before any of the page's own content.
  const compact = render(<PageHeader eyebrow="Operations" title="Orders" description="Every order." />);
  // The title stays in the document as `sr-only`, so the outline and the
  // screen-reader announcement are unchanged and only its pixels go.
  assert.ok(/<h1[^>]*class="[^"]*sr-only sm:not-sr-only/.test(compact));
  assert.ok(compact.includes('Orders'));
  // The eyebrow and the prose are the parts that go.
  assert.ok(/Operations<\/p>/.test(compact.replace(/<!-- -->/g, '')));
  assert.ok(/class="[^"]*hidden sm:block[^"]*"[^>]*>Every order\./.test(compact));
  assert.ok(compact.includes('aria-label="About this page"'));
  assert.ok(compact.includes('aria-expanded="false"'));

  // On a phone the head is only this row, so it spans the width: the ⓘ on the
  // left edge and the page's controls filling the rest. Right-aligning a small
  // cluster instead left two thirds of the row blank with the dot adrift in it.
  const withAction = render(
    <PageHeader title="Orders" description="Every order." action={<button>Review settings</button>} />,
  );
  assert.ok(/<div class="flex items-center gap-2 w-full sm:w-auto sm:shrink-0">/.test(withAction));
  // `&` and `>` arrive HTML-escaped inside the class attribute.
  assert.ok(/<div class="flex items-center gap-2 flex-1 max-sm:\[&amp;&gt;\*\]:flex-1 sm:flex-none">/.test(withAction));

  // A page that opts out keeps the printed head at every width, and a page with
  // no description has nothing to fold, so it gets no disclosure button.
  const full = render(
    <PageHeader title="Orders" description="Every order." phoneChrome="full" />,
  );
  assert.ok(!full.includes('About this page'));
  assert.ok(/<h1[^>]*text-\[26px\]/.test(full));
  assert.ok(!render(<PageHeader title="Orders" />).includes('About this page'));
});

// --- SectionTitle ----------------------------------------------------------

test('SectionTitle defaults to h2 and can drop to h3 for a subsection', () => {
  // The level matters for the document outline: these sit under PageHeader's h1.
  assert.ok(render(<SectionTitle title="Delivery health" />).includes('<h2'));
  const sub = render(<SectionTitle title="By courier" as="h3" />);
  assert.ok(sub.includes('<h3'));
  assert.ok(!sub.includes('<h2'));
});

test('SectionTitle shows detail and action only when supplied', () => {
  const full = render(<SectionTitle title="T" detail="D" action={<button>A</button>} />);
  assert.ok(full.includes('D'));
  assert.ok(full.includes('<button>A</button>'));
  assert.ok(!render(<SectionTitle title="T" />).includes('<p'));
});

// --- MetricStrip -----------------------------------------------------------

test('MetricStrip renders one cell per item, however many it is given', () => {
  // The prototype's strip was hard-wired to four cells; this one is not.
  const items = [
    { label: 'Events', value: '12,480' },
    { label: 'Orders', value: '318' },
    { label: 'Revenue', value: '৳1.2L' },
  ];
  const html = render(<MetricStrip items={items} />);
  for (const item of items) {
    assert.ok(html.includes(item.label));
    assert.ok(html.includes(item.value));
  }
  assert.equal((html.match(/<strong/g) || []).length, 3);
});

test('MetricStrip omits the hint line when an item has none', () => {
  const html = render(<MetricStrip items={[{ label: 'Events', value: '1' }]} />);
  assert.ok(!html.includes('<small'));
  const withHint = render(<MetricStrip items={[{ label: 'Events', value: '1', hint: 'vs last week' }]} />);
  assert.ok(withHint.includes('vs last week'));
});

// --- Status: tone mapping --------------------------------------------------

test('statusTone maps the four tones from the prototype vocabulary', () => {
  assert.equal(statusTone('High risk'), 'danger');
  assert.equal(statusTone('Pending review'), 'warning');
  assert.equal(statusTone('Delivered'), 'success');
  assert.equal(statusTone('In Transit'), 'info');
  assert.equal(statusTone('Draft'), 'neutral');
});

test('statusTone ignores case and separators, as the live API requires', () => {
  // The live codebase returns 'Delivered' and 'failed' and 'PROPOSAL_READY' and
  // 'action_required'. Matching the prototype's literal capitalisation would
  // render most real statuses grey.
  assert.equal(statusTone('failed'), 'danger');
  assert.equal(statusTone('FAILED'), 'danger');
  assert.equal(statusTone('PROPOSAL_READY'), 'success');
  assert.equal(statusTone('action_required'), 'warning');
  assert.equal(statusTone('in_progress'), 'info');
  assert.equal(statusTone('in-progress'), 'info');
});

test('statusTone resolves substrings by severity order, not by accident', () => {
  // Each of these contains a keyword from a *less* severe group. The group order
  // is what makes them come out right, so these are the cases that break first
  // if TONE_KEYWORDS is ever reordered.
  assert.equal(statusTone('Invalid'), 'danger'); // contains 'valid' (success)
  assert.equal(statusTone('unhealthy'), 'danger'); // contains 'healthy' (success)
  assert.equal(statusTone('cancel_failed_provider_active'), 'danger'); // 'active' (success)
  assert.equal(statusTone('underpaid'), 'warning'); // contains 'paid' (success)
  assert.equal(statusTone('overpaid'), 'warning');
  assert.equal(statusTone('approved_overpaid'), 'warning'); // 'approved' (success)
  assert.equal(statusTone('needs_review'), 'warning');
  // And the plain words still land in their own group.
  assert.equal(statusTone('Valid'), 'success');
  assert.equal(statusTone('healthy'), 'success');
  assert.equal(statusTone('Paid'), 'success');
});

test('Status renders the value in a badge and honours an explicit tone', () => {
  const guessed = render(<Status value="Delivered" />);
  assert.ok(guessed.includes('Delivered'));
  assert.ok(guessed.includes('emerald')); // success tone
  // An explicit tone overrides the keyword guess entirely.
  const forced = render(<Status value="Delivered" tone="danger" />);
  assert.ok(forced.includes('red'));
  assert.ok(!forced.includes('emerald'));
});

// --- PaginationControls: windowing ----------------------------------------

test('pageWindow returns every page while they still fit', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(3, 5), [1, 2, 3, 4, 5]);
});

test('pageWindow keeps the ends, a window around the current page, and gaps between', () => {
  // The reason this exists: the prototype rendered one button per page, so a
  // 2,000-order history at 20 a page produced 100 buttons.
  assert.deepEqual(pageWindow(50, 100), [1, 'gap', 49, 50, 51, 'gap', 100]);
  assert.deepEqual(pageWindow(1, 100), [1, 2, 'gap', 100]);
  assert.deepEqual(pageWindow(100, 100), [1, 'gap', 99, 100]);
  // Never more slots than the window needs, whatever the page count.
  assert.ok(pageWindow(500, 1000).length <= 7);
});

test('pageWindow shows a lone hidden page instead of an ellipsis for it', () => {
  // "1 … 3" is the same width as "1 2 3" and tells the reader less.
  assert.deepEqual(pageWindow(4, 5), [1, 2, 3, 4, 5]);
  assert.ok(!pageWindow(4, 6).includes('gap'));
  assert.deepEqual(pageWindow(4, 6), [1, 2, 3, 4, 5, 6]);
});

// --- PaginationControls: range arithmetic and labels ----------------------

test('states the range it is showing, and labels the nav for its noun', () => {
  const html = render(
    <PaginationControls page={2} pageSize={10} total={42} onPageChange={() => {}} noun="orders" />,
  );
  assert.ok(html.includes('aria-label="orders pagination"'));
  assert.ok(html.includes('<nav'));
  assert.equal(rangeText(html), 'Showing 11–20 of 42 orders');
});

test('marks the current page for assistive tech and disables the dead arrows', () => {
  const first = render(
    <PaginationControls page={1} pageSize={10} total={42} onPageChange={() => {}} noun="orders" />,
  );
  assert.ok(first.includes('aria-current="page"'));
  assert.equal((first.match(/aria-current="page"/g) || []).length, 1);
  // On page 1 the Previous arrow is dead; on the last page, Next is.
  assert.ok(isDisabled(first, 'Previous orders page'));
  assert.ok(!isDisabled(first, 'Next orders page'));

  const last = render(
    <PaginationControls page={5} pageSize={10} total={42} onPageChange={() => {}} noun="orders" />,
  );
  assert.ok(isDisabled(last, 'Next orders page'));
  assert.ok(!isDisabled(last, 'Previous orders page'));
});

test('clamps an out-of-range page instead of showing a negative range', () => {
  // A stale page number survives a filter change that shrinks the result set.
  const tooHigh = render(
    <PaginationControls page={99} pageSize={10} total={42} onPageChange={() => {}} noun="orders" />,
  );
  assert.equal(rangeText(tooHigh), 'Showing 41–42 of 42 orders'); // clamped to page 5

  const tooLow = render(
    <PaginationControls page={0} pageSize={10} total={42} onPageChange={() => {}} noun="orders" />,
  );
  assert.equal(rangeText(tooLow), 'Showing 1–10 of 42 orders'); // clamped to page 1
});

test('an empty list shows a zero range rather than "1-0"', () => {
  const html = render(
    <PaginationControls page={1} pageSize={10} total={0} onPageChange={() => {}} noun="orders" />,
  );
  assert.equal(rangeText(html), 'Showing 0–0 of 0 orders');
});

test('the incomplete-history caveat is off by default and opt-in', () => {
  // The prototype defaulted this on because its fixtures had no real totals; the
  // live services do return totalCount/hasMore, so the caveat would be a lie.
  const normal = render(
    <PaginationControls page={1} pageSize={10} total={42} onPageChange={() => {}} noun="orders" />,
  );
  assert.ok(!normal.includes('at least'));
  assert.ok(!normal.includes('History may be incomplete'));

  const caveated = render(
    <PaginationControls
      page={1}
      pageSize={10}
      total={42}
      historyMayBeIncomplete
      onPageChange={() => {}}
      noun="orders"
    />,
  );
  assert.ok(caveated.includes('at least'));
  assert.ok(caveated.includes('History may be incomplete'));
});

test('the pagination footer keeps a phone to a range and a position', () => {
  // Seven 44px page buttons plus "Showing 11-20 of 42 orders" need more than a
  // 320px screen has, so the footer wrapped to three lines at the bottom of
  // every list. Below sm the numbers and the long sentence are display:none —
  // which also takes them out of the accessibility tree, so nothing is
  // announced twice — and what is left is the range and "Page 2 of 5".
  const html = render(
    <PaginationControls page={2} pageSize={10} total={42} onPageChange={() => {}} noun="orders" />,
  );
  assert.ok(/<span class="flex items-center gap-1 sm:hidden">/.test(html), 'phone range is phone-only');
  assert.ok(/Page <strong[^>]*>2<\/strong> of\s*5/.test(html.replace(/<!-- -->/g, '')));
  assert.ok(/<span class="hidden flex-wrap items-center gap-2 sm:flex">/.test(html), 'the sentence is sm and up');
  assert.ok(/<span class="hidden items-center gap-1.5 sm:flex">/.test(html), 'the numbers are sm and up');
  // The buttons themselves are unchanged: still one per windowed page, still 44px.
  assert.equal((html.match(/aria-label="orders page \d+"/g) || []).length, 5);
});

test('a one-page list keeps the phone footer to a single line', () => {
  // Most lists in the portal fit on one page, and there the two dead arrows plus
  // "Page 1 of 1" were a second row of chrome under a four-row list. The control
  // group is `hidden sm:flex`, so the phone shows the count and nothing else
  // while the desktop footer is unchanged.
  const single = render(
    <PaginationControls page={1} pageSize={20} total={4} onPageChange={() => {}} noun="checkouts" />,
  );
  assert.ok(/<div class="items-center gap-1.5 sm:flex hidden">/.test(single));
  // The arrows stay in the DOM for the desktop footer; only the phone hides them.
  assert.ok(single.includes('aria-label="Previous checkouts page"'));

  // Two pages: the group is back on the phone as well.
  const many = render(
    <PaginationControls page={1} pageSize={20} total={44} onPageChange={() => {}} noun="checkouts" />,
  );
  assert.ok(/<div class="items-center gap-1.5 sm:flex flex">/.test(many));
});
