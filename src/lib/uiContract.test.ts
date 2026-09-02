import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

/**
 * The invariants that hold the design system together and that nothing else
 * guards. designTokens.test.ts owns colour; primitiveStyles.test.tsx owns the
 * shape of the shared components. What is left, and what this file owns, are the
 * agreements that live *inside index.css* or *between index.css and the whole of
 * src/* — where a failure produces no error, no warning and nothing visibly
 * wrong until a merchant hits it.
 *
 * Each test below corresponds to a failure that has actually happened here. See
 * .claude/skills/ui-audit/references/03-traps.md for the full account.
 */

const repoUrl = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const INDEX_CSS = readFileSync(repoUrl('../index.css'), 'utf8');
const SRC_DIR = repoUrl('..');
const CSS_LINES = INDEX_CSS.split('\n');

/** Every --bk-* custom property declared in index.css. */
const declared = new Set([...INDEX_CSS.matchAll(/(--bk-[a-z0-9-]+)\s*:/g)].map(m => m[1]));

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
      // Tailwind v4 scans comments as class candidates, so a comment explaining
      // why a class is banned would otherwise read as a use of it. Blank the
      // comment out rather than deleting it: keeping its newlines is what makes
      // every line number reported below match the file on disk.
      code: readFileSync(full, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, comment => comment.replace(/[^\n]/g, ''))
        .replace(/(^|[^:])\/\/.*$/gm, '$1'),
    }));
}

test('index.css actually parsed', () => {
  // Every test here derives its subject from index.css by regex. Rename or
  // restructure that file and the regexes match nothing, every assertion
  // iterates an empty list, and the suite passes having checked nothing.
  assert.ok(declared.size > 40, `expected the --bk-* layer, parsed ${declared.size}`);
  assert.ok(CSS_LINES.length > 500, `expected the full stylesheet, read ${CSS_LINES.length} lines`);
});

// --- 1. every var(--bk-*) in src/ resolves ------------------------------------

test('every --bk-* variable used anywhere in src/ is declared', () => {
  // `text-[var(--bk-console-text-body)]` against an undeclared variable is worse
  // than a dead colour class: the declaration *is* emitted, then resolves to
  // nothing, and the element inherits its ancestor's colour. designTokens.test.ts
  // cannot see inside var() names, and primitiveStyles.test.tsx only checks
  // components/common/ - which leaves the other ~160 files unguarded.
  const missing: string[] = [];
  for (const { rel, code } of sourceFiles()) {
    code.split('\n').forEach((line, index) => {
      for (const [, name] of line.matchAll(/var\((--bk-[a-z0-9-]+)\)/g)) {
        if (!declared.has(name)) missing.push(`${rel}:${index + 1}  ${name}`);
      }
    });
  }
  assert.deepEqual(missing, [], `declared nowhere in index.css:\n  ${missing.join('\n  ')}`);
});

// --- 2. the layer boundary ----------------------------------------------------

/** [first, last] line indices of the block opened on the line matching `head`. */
function blockRange(head: string): [number, number] {
  const start = CSS_LINES.findIndex(line => line.trim().startsWith(head));
  assert.notEqual(start, -1, `index.css must contain a \`${head}\` block`);
  let depth = 0;
  for (let i = start; i < CSS_LINES.length; i++) {
    for (const ch of CSS_LINES[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth === 0 && i > start) return [start, i];
  }
  throw new Error(`unbalanced braces after \`${head}\``);
}

/** Selectors declared in a chunk of CSS, one per rule that opens on its own line. */
const selectorsIn = (css: string) =>
  [...css.matchAll(/^[ \t]*([.#][^{}\n]*?)\s*\{/gm)].map(m => m[1].replace(/\s+/g, ' ').trim());

test('no selector is declared both inside @layer components and outside every layer', () => {
  // An unlayered rule outranks *every* rule in a layer, regardless of
  // specificity. That is how `.sidebar-active-glow` and
  // `.sidebar-active-indicator` came to paint the active nav item pale mint:
  // correct rules in @layer components, silently beaten by duplicates below the
  // last layer. Nothing about that fails a build, and the loser looks right in
  // the source.
  const [, componentsEnd] = blockRange('@layer components');
  const inLayer = new Set(selectorsIn(CSS_LINES.slice(0, componentsEnd).join('\n')));
  const unlayered = selectorsIn(CSS_LINES.slice(componentsEnd + 1).join('\n'));
  assert.ok(inLayer.size > 10, `expected the component layer, parsed ${inLayer.size} selectors`);

  const shadowed = [...new Set(unlayered.filter(s => inLayer.has(s)))];
  assert.deepEqual(
    shadowed,
    [],
    `these selectors exist in a layer and again outside every layer, where they ` +
      `silently win:\n  ${shadowed.join('\n  ')}`,
  );
});

// --- 3. the load-bearing globals ---------------------------------------------

test('the global focus ring keeps its !important', () => {
  // 20+ files carry `outline-none`, and they are only safe because this one rule
  // overrides them. Drop the !important as a tidy-up and every one of those
  // becomes a keyboard user with no visible focus - with nothing failing and
  // nothing looking wrong on screen.
  const rule = /:where\(a, button, summary, \[role="button"\], \[tabindex\]\):focus-visible\s*\{([^}]*)\}/
    .exec(INDEX_CSS);
  assert.ok(rule, 'index.css must keep the global :focus-visible rule');
  assert.match(rule[1], /outline:\s*2px solid var\(--bk-console-blue\)\s*!important/);
});

test('the base control rule keeps the 44px target height', () => {
  // WCAG 2.5.5, applied at every viewport rather than behind a mobile query.
  // Plenty of forms in the portal predate the Input/Select/Textarea components
  // and rely entirely on this bare-element rule for their height.
  const rule = /input:not\([^{]*\{([^}]*)\}/.exec(INDEX_CSS);
  assert.ok(rule, 'the base input/select/textarea rule must exist');
  assert.match(rule[1], /min-height:\s*44px/);
});

test('the skip link exists, is styled, and points at something', () => {
  // The first tab stop on every page. It is invisible until focused, so it is the
  // one control that can rot completely without anyone noticing.
  assert.match(INDEX_CSS, /\.bk-skip-link\s*\{/);
  assert.match(INDEX_CSS, /\.bk-skip-link:focus-visible\s*\{/);

  const app = sourceFiles().find(({ rel }) => rel === 'App.tsx');
  assert.ok(app, 'App.tsx must exist');
  const href = /className="bk-skip-link"\s+href="#([a-z-]+)"/.exec(app.code);
  assert.ok(href, 'App.tsx must render the skip link');
  assert.ok(
    app.code.includes(`id="${href[1]}"`),
    `the skip link targets #${href[1]}, which nothing declares`,
  );
});

test('reduced motion is honoured', () => {
  assert.match(INDEX_CSS, /@media \(prefers-reduced-motion: reduce\)\s*\{/);
});

test('the button radius stays distinct from the control radius', () => {
  // index.css says in a comment not to merge these: a 10px button next to a 6px
  // field is deliberate, and "unify the radii" is the edit that quietly undoes it.
  const value = (name: string) => new RegExp(`--bk-radius-${name}:\\s*([^;]+);`).exec(INDEX_CSS)?.[1].trim();
  const [button, control] = [value('button'), value('control')];
  assert.ok(button && control, 'both radius tokens must be declared');
  assert.notEqual(button, control, 'button and control radii are deliberately different');
});

// --- 4. the scrollbar utility -------------------------------------------------

test('scrollbars are hidden with the project utility, not Tailwind’s', () => {
  // Tailwind's `scrollbar-none` sets scrollbar-width only, which is Firefox.
  // WebKit then falls through to the global `::-webkit-scrollbar { width: 6px }`
  // and paints a bar across the Tabs underline. `@utility scrollbar-hidden`
  // covers both engines.
  assert.match(INDEX_CSS, /@utility scrollbar-hidden\s*\{/);
  const users = sourceFiles()
    .filter(({ code }) => /\bscrollbar-none\b/.test(code))
    .map(({ rel }) => rel);
  assert.deepEqual(users, [], `use scrollbar-hidden instead:\n  ${users.join('\n  ')}`);
});

// --- 5. the arbitrary font-size ratchet ---------------------------------------

/**
 * `text-[13px]` bypasses the --text-* scale. 516 of them predate the scale, so a
 * ban is not available; a ratchet is. This number may fall, never rise. When it
 * falls, lower it here in the same commit - that is what makes the cleanup stick.
 *
 * 516 -> 515: WeeklyReportCard's two 11px runs moved onto `text-label` (the same
 * 11px, now from the scale) and its two identical mobile tile captions became one
 * shared constant, which is also what keeps its skeleton the height of the row it
 * stands in for.
 *
 * 515 -> 514: the sidebar's four 13px runs (active store, nav item, events-usage
 * figure, profile name) moved onto `text-body-sm`, which is that same 13px from
 * the scale. The ratchet is what caught them: they went in during the design port
 * and pushed the count to 518, and the sidebar is the one surface where the same
 * size repeats in four unrelated places, so a step name is worth more there than
 * anywhere else.
 */
const ARBITRARY_TEXT_BASELINE = 514;

test('no new hard-coded font size is introduced', () => {
  const found: string[] = [];
  for (const { rel, code } of sourceFiles()) {
    code.split('\n').forEach((line, index) => {
      for (const m of line.matchAll(/\btext-\[\d+px\]/g)) found.push(`${rel}:${index + 1}  ${m[0]}`);
    });
  }
  assert.ok(
    found.length <= ARBITRARY_TEXT_BASELINE,
    `hard-coded font sizes rose from ${ARBITRARY_TEXT_BASELINE} to ${found.length}. ` +
      `Use a --text-* step (text-label, text-body, text-display, …) instead.\n  ` +
      `${found.slice(-12).join('\n  ')}`,
  );
  assert.ok(
    found.length >= ARBITRARY_TEXT_BASELINE - 40,
    `hard-coded font sizes fell from ${ARBITRARY_TEXT_BASELINE} to ${found.length}. ` +
      `Lower ARBITRARY_TEXT_BASELINE to ${found.length} so the progress is held.`,
  );
});

// --- 6. the hole the 44px rule leaves for checkboxes --------------------------

/**
 * The base control rule above reads
 * `input:not([type="checkbox"]):not([type="radio"])…`, so the one control shaped
 * like a 16px square is the one control with no floor at all. Nothing in the
 * stylesheet, no test above, and no build step notices: a `h-4 w-4` checkbox is
 * a 16px target that looks completely finished.
 *
 * The two order tables are where that matters, because their select-boxes are
 * how a merchant picks the rows to book a courier for or print invoices for, and
 * both tables were measured at 36×36 (a `btn-touch-expand` halo sized for a 24px
 * control) as recently as 1 Sept 2026. Each now grows its own halo instead,
 * measured in Chrome at 45–46px effective with `elementFromPoint`.
 *
 * `ui_runtime_audit.js` cannot defend this: it measures `getBoundingClientRect()`
 * on the element, which returns 16×16 whether the halo is there or not
 * (docs/UI_AUDIT_CONTRACT.md D2). So the guard has to be the source.
 */

/** The tag that opens at `start`, read to its own `>`. */
function openingTag(code: string, start: number): string {
  // Track brace depth: a non-greedy scan stops at the arrow of
  // `onChange={() => …}` instead, which is how an earlier sweep of this
  // codebase undercounted.
  let depth = 0;
  for (let i = start; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return code.slice(start, i + 1);
  }
  return code.slice(start);
}

/** Every `<input type="checkbox">` opening tag in a file, with its line number. */
function checkboxTags(code: string): { line: number; tag: string; at: number }[] {
  const out: { line: number; tag: string; at: number }[] = [];
  const pattern = /<input\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const tag = openingTag(code, match.index);
    if (/type="checkbox"/.test(tag)) {
      out.push({ line: code.slice(0, match.index).split('\n').length, tag, at: match.index });
    }
  }
  return out;
}

/**
 * The opening tag of the `<label>` this checkbox sits inside, or null.
 *
 * A label wrapping content of its own is the other legitimate way to reach 44:
 * the label becomes the target and the box can stay small. The mobile card in
 * `CodProtectionView` does exactly that — measured 121.8×70.4.
 */
function wrappingLabel(code: string, at: number): string | null {
  const open = code.lastIndexOf('<label', at);
  if (open === -1) return null;
  if (code.lastIndexOf('</label>', at) > open) return null;
  return openingTag(code, open);
}

const ORDER_TABLES = [
  'components/CodProtectionView.tsx',
  'components/orders/OrdersWorkspace.tsx',
];

test('every select-checkbox in the two order tables is a 44px target', () => {
  const files = sourceFiles().filter(({ rel }) => ORDER_TABLES.includes(rel));
  assert.equal(files.length, ORDER_TABLES.length, `expected both order tables, found ${files.length}`);

  const naked: string[] = [];
  const mute: string[] = [];
  let checked = 0;
  for (const { rel, code } of files) {
    for (const { line, tag, at } of checkboxTags(code)) {
      checked += 1;
      // `before:-inset-[15px]`, or the `-inset-x-` / `-top-` / `-bottom-` trio
      // the header row uses. `btn-touch-expand` is deliberately *not* accepted:
      // its flat -10px is what left these boxes at 36.
      if (/before:-(inset|top|bottom)-/.test(tag)) continue;
      const label = wrappingLabel(code, at);
      if (!label) { naked.push(`${rel}:${line}`); continue; }
      // A label only delegates if the reader can tell it is clickable. Most of
      // one of these is text, and without this the arrow or I-beam over that
      // text reads as "not a control".
      if (!/cursor-pointer/.test(label)) mute.push(`${rel}:${line}`);
    }
  }
  assert.ok(checked >= 5, `expected the five select-boxes, parsed ${checked}`);
  assert.deepEqual(
    naked,
    [],
    `these checkboxes are 16px of ink with a 16px target: the base rule in `
      + `index.css exempts [type=checkbox], so they need their own `
      + `before:-inset halo, or a <label> around them to delegate to:\n  ${naked.join('\n  ')}`,
  );
  assert.deepEqual(
    mute,
    [],
    `these checkboxes delegate to a <label> that has no cursor-pointer, so the `
      + `target does not look like one:\n  ${mute.join('\n  ')}`,
  );
});

test('the order tables’ halos stay symmetric except where the cell cannot hold one', () => {
  // The header row of the orders table is 42px and its wrapper is
  // `overflow-x-auto`, which clips the y axis too, so 4px of the halo's top is
  // cut off at the table's edge and the height has to be taken from below
  // instead. That asymmetry is a measurement, not a preference, and it is the
  // only one: anywhere else a lopsided halo means the growth was guessed.
  const lopsided = sourceFiles()
    .flatMap(({ rel, code }) => checkboxTags(code).map(({ line, tag }) => ({ rel, line, tag })))
    .filter(({ tag }) => /before:-top-/.test(tag) !== /before:-bottom-/.test(tag))
    .map(({ rel, line }) => `${rel}:${line}`);
  assert.deepEqual(
    lopsided,
    [],
    `a halo grown on one edge only hangs over a neighbour and steals its clicks:\n  ${lopsided.join('\n  ')}`,
  );
});
