import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Input, Textarea } from './Input';
import { PageHeader } from './PageHeader';
import { Select } from './Select';
import { SkeletonCards } from './Skeleton';
import { StatCard } from './StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from './Table';
import { Tabs } from './Tabs';

/**
 * Phase 3 of the prototype design migration restyled the shared primitives.
 * Colour is already guarded by lib/designTokens.test.ts; what is unguarded is
 * everything that is *not* a colour — the box a panel wears, the 44px target
 * size, which face a heading uses — and those are exactly the values a later
 * "tidy up the classes" edit reverts without anybody noticing.
 *
 * Three kinds of test live here, and the second two are the ones worth having:
 *
 *   1. Values the prototype states outright (44px controls, a 42px `th`).
 *   2. Agreements *between* files, which nothing else can catch: a Tailwind class
 *      in a component and the CSS rule in index.css that only applies because of
 *      it. Those drift silently in both directions.
 *   3. A Tailwind v4 trap that fails silently rather than loudly — a var() that
 *      names a token nobody declares still emits a declaration, which then
 *      resolves to nothing and inherits.
 *
 * Static markup only, per the house convention (see ErrorState.test.tsx).
 */

const render = (element: React.ReactElement) => renderToStaticMarkup(element);

const repoUrl = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const INDEX_CSS = readFileSync(repoUrl('../../index.css'), 'utf8');
const SRC_DIR = repoUrl('../..');
const COMMON_DIR = repoUrl('.');

/** Class list of the nth `<tag` in the markup, so an assertion can name its element. */
function classesOf(html: string, tag: string, nth = 0): string {
  const opens = [...html.matchAll(new RegExp(`<${tag}(?=[\\s/>])[^>]*`, 'g'))];
  assert.ok(opens[nth], `expected at least ${nth + 1} <${tag}> in the rendered markup`);
  return /class="([^"]*)"/.exec(opens[nth][0])?.[1] ?? '';
}

function assertCarries(classes: string, expected: readonly string[], what: string) {
  const present = new Set(classes.split(/\s+/));
  for (const cls of expected) {
    assert.ok(present.has(cls), `${what} must carry \`${cls}\`\n    got: ${classes}`);
  }
}

// --- 1. the panel box ------------------------------------------------------

/** The prototype's `.p-panel`: one radius, one border tint, one faint lift. */
const PANEL_BOX = [
  'rounded-[var(--bk-radius-panel)]',
  'border-[var(--bk-panel-border)]',
  'shadow-[var(--bk-panel-shadow)]',
] as const;

test('every panel-shaped surface wears the same box', () => {
  // Card is the panel; StatCard is a panel with metric typography in it; the
  // skeleton tile stands in for a StatCard while the numbers load, and if its box
  // differs the summary row visibly resizes under the merchant when they arrive.
  assertCarries(classesOf(render(<Card>body</Card>), 'div'), PANEL_BOX, 'Card');
  assertCarries(classesOf(render(<StatCard label="Events" value="12,480" />), 'div'), PANEL_BOX, 'StatCard');
  assertCarries(classesOf(render(<SkeletonCards count={1} />), 'div', 1), PANEL_BOX, "SkeletonCards' tile");

  // And the same minimum height, for the same reason.
  for (const [html, what] of [
    [render(<StatCard label="Events" value="1" />), 'StatCard'],
    [render(<SkeletonCards count={1} />), "SkeletonCards' tile"],
  ] as const) {
    const classes = what === 'StatCard' ? classesOf(html, 'div') : classesOf(html, 'div', 1);
    assert.ok(classes.includes('min-h-[104px]'), `${what} must keep the strip's 104px cell height`);
  }
});

test('Card clips to its corners only when asked', () => {
  // `overflow: hidden` is what a table or a tab strip inside a panel needs, and
  // is also what clips Tooltip, which positions itself above its trigger and
  // outside the panel's box. The prototype's .p-panel can clip unconditionally
  // because it has no tooltip; this one cannot.
  assert.ok(!classesOf(render(<Card>body</Card>), 'div').includes('overflow-hidden'));
  assert.ok(classesOf(render(<Card flush>body</Card>), 'div').includes('overflow-hidden'));
});

// --- 2. the display face is rationed --------------------------------------

/**
 * portal.css names the display face in exactly three selectors: `.page-heading
 * h1`, `.eyebrow` and `th`. Everything else, panel headings included, is the
 * body face — which is what keeps the page title the only title on the page.
 */
const DISPLAY_FACE_FILES = ['components/common/PageHeader.tsx', 'components/common/Table.tsx'];

test('the display face is reserved for the page title, its eyebrow and table headers', () => {
  const header = render(<PageHeader eyebrow="Operations" title="Orders" description="Every order." />);
  assert.ok(classesOf(header, 'h1').includes('font-display'), 'the page h1 is the display face');
  assert.ok(classesOf(header, 'p').includes('font-display'), 'the eyebrow is the display face');
  // The description is not.
  assert.ok(!classesOf(header, 'p', 1).includes('font-display'));

  const table = render(
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Order</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow>
          <TableCell>#1001</TableCell>
        </TableRow>
      </TableBody>
    </Table>,
  );
  assert.ok(classesOf(table, 'th').includes('font-display'), 'a table header is the display face');
  assert.ok(!classesOf(table, 'td').includes('font-display'), 'a table cell is not');

  // A panel heading is a heading, not a second page title.
  assert.ok(!classesOf(render(<Card title="Delivery health">b</Card>), 'h3').includes('font-display'));
});

test('no other file reaches for the display face', () => {
  // The rationing only holds if it holds everywhere. A new use is not forbidden,
  // but it is a design decision and belongs in DISPLAY_FACE_FILES with a reason,
  // not in a class list nobody reviewed.
  const users = sourceFiles()
    .filter(({ code }) => /\bfont-display\b/.test(code))
    .map(({ rel }) => rel);
  assert.deepEqual(
    users.sort(),
    [...DISPLAY_FACE_FILES].sort(),
    'the prototype uses Archivo in three places only (page h1, eyebrow, th)',
  );
});

// --- 3. the 44px target size ----------------------------------------------

test('every button size clears the 44px target, at every viewport', () => {
  // The prototype raised every control to 44px at top level rather than behind a
  // mobile media query (WCAG 2.5.5), so `sm` differs from `md` in padding and
  // type, not in height. An earlier version of PaginationControls shrank back to
  // 36px from `sm:` up, which undid exactly that fix — hence the second half.
  for (const size of ['sm', 'md', 'lg'] as const) {
    const classes = classesOf(render(<Button size={size}>Save</Button>), 'button');
    assert.ok(classes.includes('min-h-11'), `Button size=${size} must be at least 44px tall`);
    const icon = classesOf(render(<Button variant="icon" size={size}>x</Button>), 'button');
    assert.ok(/\bh-11\b/.test(icon) && /\bw-11\b/.test(icon), `icon Button size=${size} must be 44x44`);
  }
  const controls = readFileSync(join(COMMON_DIR, 'PaginationControls.tsx'), 'utf8');
  assert.ok(!/sm:(?:min-)?[hw]-(?:9|\[3\dpx\])/.test(controls), 'page numbers must not shrink below 44px at any width');
});

test('the destructive button is a soft wash, not a solid fill', () => {
  // .p-button.danger is dark red text on a pale wash. The pale treatment is what
  // pairs with ConfirmDialog: this button opens a confirmation, it does not
  // itself destroy anything, so it should not look like the point of no return.
  const danger = classesOf(render(<Button variant="danger">Delete</Button>), 'button');
  assert.ok(danger.includes('bg-rose-50'));
  assert.ok(danger.includes('text-rose-700'));
  assert.ok(!/\bbg-rose-(?:5|6|7)00\b/.test(danger), 'a solid red fill overstates what this button does');
});

test('a disabled button is opaque grey, never a faded copy of its variant', () => {
  // `disabled:opacity-50` thins the label and its background together, which
  // measured 2.26:1 on the primary button — under the 3:1 floor that applies even
  // to large text, so on a phone in daylight the merchant cannot read *which*
  // action is unavailable. The prototype settles it with one global
  // `button:disabled` rule (ui-ux-audit-prototype/portal.css), and #5f6c74 on
  // #f7f8f9 measures 5.04:1. One treatment for all five variants is the point:
  // five tuned pairs would each have to be re-measured.
  for (const variant of ['primary', 'secondary', 'ghost', 'danger', 'icon'] as const) {
    const classes = classesOf(render(<Button variant={variant} disabled>Save</Button>), 'button');
    assert.ok(!/\bdisabled:opacity-/.test(classes), `${variant} must not fade its label to reach disabled`);
    assertCarries(classes, [
      'disabled:bg-[var(--bk-control-disabled-bg)]',
      'disabled:text-[var(--bk-control-disabled-text)]',
      'disabled:border-[var(--bk-control-disabled-border)]',
    ], `a disabled ${variant} Button`);
  }

  // And the tokens behind those three classes have to exist, or Tailwind v4 emits
  // a declaration that resolves to nothing and the button keeps its variant fill.
  // (`every --bk-* variable the primitives name is declared` covers this too; it
  // is repeated here so a failure points at the contrast fix by name.)
  for (const token of ['--bk-control-disabled-bg', '--bk-control-disabled-text', '--bk-control-disabled-border']) {
    assert.match(INDEX_CSS, new RegExp(`${token}\\s*:`), `${token} must be declared in index.css`);
  }
});

test('the disabled label survives the unlayered slate overrides', () => {
  // `disabled:text-…` is a utility, and index.css re-declares `.text-slate-400`
  // … `-950` *outside* every layer for contrast — so on `secondary`
  // (`text-slate-700`), `ghost` (`-600`) and `icon` (`-400`) the unlayered rule
  // wins and the label keeps full-strength ink on the grey fill. Nothing above
  // catches that: the class really is on the element, the token really is
  // declared, and only a rendered page shows the colour. `bk-button` plus the
  // rule keyed on it is what wins the fight back, so the two are a pair —
  // exactly like `bk-table-scroll` and its inset focus ring.
  const classes = classesOf(render(<Button>Save</Button>), 'button');
  assert.ok(classes.split(/\s+/).includes('bk-button'), 'Button must carry the bk-button marker class');
  assert.match(
    INDEX_CSS,
    /\.bk-button:disabled\s*\{[^}]*color:\s*var\(--bk-control-disabled-text\)/,
    'index.css must keep the .bk-button:disabled colour rule the marker class exists for',
  );

  // And it has to stay in the unlayered tail: inside @layer it would lose to the
  // slate overrides again, and the fix would silently stop working.
  const tail = INDEX_CSS.slice(INDEX_CSS.indexOf('.text-slate-800'));
  assert.ok(
    tail.includes('.bk-button:disabled'),
    'the rule must sit after the unlayered .text-slate-* overrides it exists to beat',
  );
});

// --- 4. Badge -------------------------------------------------------------

test('Badge reads as a chip, and is only as wide as its label', () => {
  const classes = classesOf(render(<Badge tone="success">Delivered</Badge>), 'span');
  assertCarries(classes, ['font-extrabold', 'w-max', 'min-h-[23px]', 'rounded-[var(--bk-radius-pill)]'], 'Badge');
  // `w-max` matters because a badge is often the only child of a grid or flex
  // column, where the default stretch pulls the pill the full column width and
  // leaves the label floating in a long capsule.
});

// --- 5. the table -------------------------------------------------------

test('a table header is the prototype’s opened-up label', () => {
  const html = render(
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Order</TableHeaderCell>
        </TableRow>
      </TableHead>
    </Table>,
  );
  assertCarries(classesOf(html, 'th'), ['h-[42px]', 'font-semibold', 'uppercase', 'tracking-[0.075em]'], 'a `th`');
  // Weight 600 with the letters opened up is a label; the same string in bold is
  // a heading, and a column of headings competes with the data under it.
  assert.ok(!classesOf(html, 'th').includes('font-bold'));
});

test('rows are not height-locked', () => {
  // The prototype's `td { height: 72px }` reads as a signature until you notice
  // its own later passes moved to `height: auto`, and that this primitive is
  // shared: a proposal diff of Field / Before / After would be absurd at 72px a
  // row. Density comes from cell padding, and two-line cells reach 72px anyway.
  // TableRow is also used for header rows, so a height here would set every
  // table header 72px tall.
  const row = classesOf(render(<TableRow><TableCell>x</TableCell></TableRow>), 'tr');
  assert.ok(!/\bh-\[/.test(row), `TableRow must not fix a height\n    got: ${row}`);
});

test('the table scroller keeps the marker class its inset focus ring is keyed on', () => {
  // A ring drawn 2px *outside* its control is clipped by overflow-x: auto, and a
  // table's row actions sit in the last column — flush against the right edge of
  // exactly such a scroller. index.css fixes that with a descendant rule, so the
  // class and the rule only work as a pair: renaming either silently restores
  // the clipped ring, with no build error and nothing visibly wrong until a
  // keyboard user tabs into the last column.
  assert.ok(classesOf(render(<Table>{null}</Table>), 'div').includes('bk-table-scroll'));
  assert.match(INDEX_CSS, /\.bk-table-scroll\s+:where\([^)]*\):focus-visible\s*\{[^}]*outline-offset:\s*-2px/);
});

// --- 6. fields agree with the base rule ---------------------------------

test('the field components agree with the base control rule in index.css', () => {
  // index.css styles bare `input, select, textarea` too, because plenty of forms
  // in the portal predate these components. Before Phase 3 the components
  // overrode the base rule's radius and border with `rounded-lg` and a darker
  // tint, so an <Input> and a bare <input> on the same form did not match. This
  // pins the reconciliation rather than the individual values.
  const base = /input:not\([^{]*\{([^}]*)\}/.exec(INDEX_CSS);
  assert.ok(base, 'the base input/select/textarea rule must exist in index.css');
  assert.match(base[1], /border-radius:\s*var\(--bk-radius-control\)/);
  assert.match(base[1], /border:\s*1px solid var\(--bk-control-border\)/);

  const fields = [
    ['Input', classesOf(render(<Input label="Store" />), 'input')],
    ['Textarea', classesOf(render(<Textarea label="Notes" />), 'textarea')],
    ['Select', classesOf(render(<Select label="Courier" options={[{ value: 'a', label: 'A' }]} />), 'select')],
  ] as const;
  for (const [what, classes] of fields) {
    assertCarries(classes, ['rounded-[var(--bk-radius-control)]', 'border-[var(--bk-control-border)]'], what);
    assert.ok(!/\brounded-(?:lg|xl|md)\b/.test(classes), `${what} must not override the base radius`);
  }
});

// --- 7. the two placeholder states hold the same space -------------------

test('an empty panel and a failed panel hold the same space', () => {
  // A panel that swaps between them must not resize, and neither may collapse to
  // a two-line strip — which is the jarring part of a filter that matches
  // nothing. 160px is the prototype's .empty-state minimum, 120px its compact
  // variant inside a search panel.
  for (const [expected, compact] of [['min-h-[160px]', false], ['min-h-[120px]', true]] as const) {
    const empty = classesOf(render(<EmptyState title="No orders yet" compact={compact} />), 'div');
    const failed = classesOf(render(<ErrorState description="We couldn't reach the server." compact={compact} />), 'div');
    assert.ok(empty.includes(expected), `EmptyState compact=${compact} must reserve ${expected}`);
    assert.ok(failed.includes(expected), `ErrorState compact=${compact} must reserve ${expected}`);
  }
});

// --- 8. the traps that fail silently ------------------------------------

/** Every non-test source file under src/, as { rel, code } with comments stripped. */
function sourceFiles(): { rel: string; code: string }[] {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  };
  return walk(SRC_DIR)
    .map(full => ({ rel: relative(SRC_DIR, full).split(sep).join('/'), full }))
    .filter(({ rel }) => !/\.test\.tsx?$/.test(rel))
    .map(({ rel, full }) => ({
      rel,
      // Comments are stripped so that a note *about* a bad class — the reason it
      // is banned — does not read as a use of it. `//` is only treated as a
      // comment when it does not follow a colon, sparing `https://` in a string.
      code: readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1'),
    }));
}

test('the tab strip draws its focus ring inward', () => {
  // Same clipping problem as the table, in a different container: a tab strip is
  // a horizontal scroller, so the global 2px *outside* ring is cut off on the
  // first and last tab — and with a roving tabindex the selected tab is the only
  // Tab stop, so that clipped ring is the only one a keyboard user ever sees.
  // Ported from the prototype's P1-1 remediation, and easy to lose in a restyle
  // because nothing looks wrong until someone navigates by keyboard.
  const html = render(
    <Tabs
      tabs={[{ id: 'a', label: 'A' }]}
      activeId="a"
      onChange={() => {}}
      label="Sections"
      idPrefix="t"
    />,
  );
  assert.ok(classesOf(html, 'button').includes('focus-visible:-outline-offset-2'));
});

test('every --bk-* variable the primitives name is declared', () => {
  // `text-[var(--bk-console-text-body)]` against an undeclared variable is the
  // same silent failure in another guise: the declaration is emitted, resolves to
  // nothing, and the element inherits its ancestor's colour. designTokens.test.ts
  // catches the `text-slate-850` shape of this; it cannot see var() names.
  const declared = new Set([...INDEX_CSS.matchAll(/(--bk-[a-z0-9-]+)\s*:/g)].map(m => m[1]));
  assert.ok(declared.size > 40, `expected the --bk-* layer, parsed ${declared.size}`);

  const missing: string[] = [];
  for (const { rel, code } of sourceFiles()) {
    if (!rel.startsWith('components/common/')) continue;
    code.split('\n').forEach((line, index) => {
      for (const [, name] of line.matchAll(/var\((--bk-[a-z0-9-]+)\)/g)) {
        if (!declared.has(name)) missing.push(`${rel}:${index + 1}  ${name}`);
      }
    });
  }
  assert.deepEqual(missing, [], `these var() names are declared nowhere in index.css:\n  ${missing.join('\n  ')}`);
});
