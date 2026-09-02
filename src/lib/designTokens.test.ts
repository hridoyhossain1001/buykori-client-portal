import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import * as chartColors from './chartColors';

/**
 * Guards the design token layer's cross-file invariants.
 *
 * Almost every colour in the portal comes from the @theme block in
 * src/index.css, so retinting is a one-file edit. Three places cannot read that
 * block at runtime and therefore hold hand-written copies of its values:
 *
 *   - src/lib/chartColors.ts, because recharts emits colours as SVG
 *     presentation attributes (stroke="...", fill="..."), where var() is not
 *     substituted.
 *   - src/components/invoice/invoicePrintStyles.ts and the print stylesheet
 *     inside src/components/CourierLabelModal.tsx, because a print window is a
 *     fresh document that never loads the app stylesheet.
 *
 * Each copy is a place where a retint can silently half-apply: the screen moves
 * and the chart legend, or the printed page, stays behind. These tests fail when
 * that happens, instead of the drift reaching a client.
 */

const repoUrl = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const read = (path: string) => readFileSync(repoUrl(path), 'utf8');

const INDEX_CSS = read('../index.css');
const SRC_DIR = repoUrl('..');

/** Every --color-* token declared in the @theme block, name -> lowercase hex. */
const tokens: ReadonlyMap<string, string> = new Map(
  [...INDEX_CSS.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)]
    .map(m => [m[1], m[2].toLowerCase()] as const),
);

test('the @theme block actually parsed', () => {
  // A rename or restructure of index.css would otherwise make every test below
  // vacuously pass against an empty map.
  assert.ok(tokens.size > 40, `expected the full token ramp, parsed ${tokens.size}`);
  assert.equal(tokens.get('slate-900'), '#17212b');
});

// --- 1. chart palette -------------------------------------------------------

/** Each exported chart colour and the token it must equal. */
const CHART_TOKEN_OF: Record<string, string> = {
  SERIES_BLUE: 'chart-blue',
  SERIES_BLUE_DEEP: 'chart-blue-deep',
  SERIES_GREEN: 'chart-green',
  SERIES_GREEN_ON_DARK: 'chart-green-on-dark',
  CHART_GRID: 'chart-grid',
  CHART_AXIS: 'chart-axis',
  RING_TRACK: 'ring-track',
  RING_FILL: 'ring-fill',
};

test('every chart colour equals its --color-* token', () => {
  for (const [exportName, tokenName] of Object.entries(CHART_TOKEN_OF)) {
    const value = (chartColors as Record<string, unknown>)[exportName];
    assert.equal(
      String(value).toLowerCase(),
      tokens.get(tokenName),
      `${exportName} must equal --color-${tokenName}`,
    );
  }
});

test('no chart colour is exported without being checked', () => {
  // Without this, adding a ninth series colour would silently escape the table
  // above and drift from the token layer unnoticed.
  for (const [exportName, value] of Object.entries(chartColors)) {
    if (typeof value !== 'string') continue;
    assert.ok(
      exportName in CHART_TOKEN_OF,
      `${exportName} is exported from chartColors but not covered by CHART_TOKEN_OF`,
    );
  }
});

test('the shared tooltip border is a token value', () => {
  assert.equal(chartColors.CHART_TOOLTIP_STYLE.borderColor.toLowerCase(), tokens.get('slate-200'));
});

// --- 1b. the chart palette is legible, not merely self-consistent ----------

// The tests above prove the two copies of the palette agree. They would still
// pass if both copies changed to two colours nobody can tell apart, so these
// measure the palette itself.

const srgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function oklab(hex: string): [number, number, number] {
  const [r, g, b] = srgb(hex).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

/** Perceptual distance. Below ~0.06 two series read as one colour in two shades. */
function perceptualDistance(a: string, b: string): number {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

function contrast(a: string, b: string): number {
  const relLum = (hex: string) => {
    const c = srgb(hex).map(lin);
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [hi, lo] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = '#ffffff';
const SERIES_SEPARATION = 0.06; // OKLab
const NON_TEXT = 3.0; // WCAG 1.4.11 - marks, rules, borders
const TEXT = 4.5; // WCAG 1.4.3 - axis tick labels

test('series drawn in the same chart are perceptually distinct', () => {
  const charts: Record<string, string[]> = {
    'EventActivityChart': [chartColors.SERIES_BLUE, chartColors.SERIES_GREEN],
    'PerformanceFunnelChart': [
      chartColors.SERIES_BLUE_DEEP, chartColors.SERIES_BLUE, chartColors.SERIES_GREEN,
    ],
  };
  for (const [chart, series] of Object.entries(charts)) {
    for (let i = 0; i < series.length; i++) {
      for (let j = i + 1; j < series.length; j++) {
        const d = perceptualDistance(series[i], series[j]);
        assert.ok(
          d >= SERIES_SEPARATION,
          `${chart}: ${series[i]} and ${series[j]} are ${d.toFixed(3)} apart in OKLab, ` +
            `below the ${SERIES_SEPARATION} needed to read as two series`,
        );
      }
    }
  }
});

test('no chart series uses the accent, which is reserved for actions', () => {
  // The accent teal sits ~0.15 from the success green, so an accent-plus-green
  // chart reads as two shades of one colour. A progress ring is the exception:
  // it shows one value, has no second series to be confused with, and so is
  // deliberately drawn in the accent.
  const accent = tokens.get('indigo-600')!;
  for (const name of ['SERIES_BLUE', 'SERIES_BLUE_DEEP', 'SERIES_GREEN', 'SERIES_GREEN_ON_DARK']) {
    assert.notEqual(
      (chartColors as Record<string, unknown>)[name], accent,
      `${name} must not be the accent`,
    );
  }
  assert.equal(chartColors.RING_FILL, accent, 'RING_FILL is the one place the accent belongs');
});

test('chart marks reach non-text contrast on the surfaces they sit on', () => {
  const pagePanel = tokens.get('slate-50')!;
  for (const name of ['SERIES_BLUE', 'SERIES_BLUE_DEEP', 'SERIES_GREEN'] as const) {
    for (const [surface, label] of [[WHITE, 'white panel'], [pagePanel, 'slate-50 page']] as const) {
      const ratio = contrast(chartColors[name], surface);
      assert.ok(ratio >= NON_TEXT, `${name} on ${label}: ${ratio.toFixed(2)} < ${NON_TEXT}`);
    }
  }
  // The dark mobile cards, where the standard green would be too dim to see.
  for (const dark of ['slate-900', 'slate-950'] as const) {
    const ratio = contrast(chartColors.SERIES_GREEN_ON_DARK, tokens.get(dark)!);
    assert.ok(ratio >= NON_TEXT, `SERIES_GREEN_ON_DARK on ${dark}: ${ratio.toFixed(2)} < ${NON_TEXT}`);
  }
  // A ring's fill has to be visible against its own track, or it reads as empty.
  const ring = contrast(chartColors.RING_FILL, chartColors.RING_TRACK);
  assert.ok(ring >= NON_TEXT, `RING_FILL on RING_TRACK: ${ring.toFixed(2)} < ${NON_TEXT}`);
});

test('axis labels are text and meet text contrast', () => {
  for (const [surface, label] of [[WHITE, 'white'], [tokens.get('slate-50')!, 'slate-50']] as const) {
    const ratio = contrast(chartColors.CHART_AXIS, surface);
    assert.ok(ratio >= TEXT, `CHART_AXIS on ${label}: ${ratio.toFixed(2)} < ${TEXT}`);
  }
});

test('data stands out from the gridlines behind it', () => {
  // Gridlines must recede. If a series is not clearly stronger than the grid,
  // the chart reads as a mesh rather than as a line on a background.
  const grid = contrast(chartColors.CHART_GRID, WHITE);
  for (const name of ['SERIES_BLUE', 'SERIES_GREEN'] as const) {
    const series = contrast(chartColors[name], WHITE);
    assert.ok(
      series >= grid * 2,
      `${name} (${series.toFixed(2)}) should be at least twice the gridline contrast (${grid.toFixed(2)})`,
    );
  }
});

// --- 2. invoice print stylesheet -------------------------------------------

test('invoice print rules match the tokens they name', () => {
  const print = read('../components/invoice/invoicePrintStyles.ts');
  // .text-slate-500 { color: #5b6a74 }  /  .bg-slate-50 { background-color: ... }
  const rules = [...print.matchAll(/\.(?:text|bg|border)-([a-z]+-\d+)\s*\{[^}]*?(#[0-9a-fA-F]{6})/g)];
  assert.ok(rules.length >= 10, `expected the utility subset, found ${rules.length} rules`);
  for (const [, tokenName, hex] of rules) {
    assert.equal(hex.toLowerCase(), tokens.get(tokenName), `.${tokenName} in the invoice print sheet`);
  }
});

// --- 3. courier label print window vs its on-screen preview ----------------

const COURIER = read('../components/CourierLabelModal.tsx');
const courierPrintCss = COURIER.slice(COURIER.indexOf('<style>'), COURIER.indexOf('</style>'));
const courierPreview = COURIER.slice(COURIER.indexOf('</style>'));

/** The colour a print rule declares, keyed by CSS property group. */
function printRuleColors(selector: string): Record<string, string> {
  const line = courierPrintCss.split('\n').find(l => l.includes(selector) && l.includes('#'));
  assert.ok(line, `print rule not found: ${selector}`);
  const out: Record<string, string> = {};
  for (const m of line.matchAll(/(color|background|border[a-z-]*)\s*:[^;}]*?(#[0-9a-fA-F]{3,6})\b/g)) {
    const hex = m[2].length === 4 ? `#${[...m[2].slice(1)].map(c => c + c).join('')}` : m[2];
    out[m[1].startsWith('border') ? 'border' : m[1]] = hex.toLowerCase();
  }
  return out;
}

/** The colour the on-screen preview element renders, resolved through @theme. */
function previewColors(className: string): Record<string, string | undefined> {
  const at = courierPreview.indexOf(className);
  assert.notEqual(at, -1, `preview element not found: ${className}`);
  const classList = courierPreview
    .slice(courierPreview.lastIndexOf('"', at) + 1, courierPreview.indexOf('"', at))
    .split(/\s+/);
  const out: Record<string, string | undefined> = {};
  const resolve = (name: string) => (name === 'white' ? '#ffffff' : tokens.get(name));
  for (const cls of classList) {
    const m = /^(text|bg|border)-((?:[a-z]+-\d+)|white)$/.exec(cls);
    if (!m) continue;
    out[{ text: 'color', bg: 'background', border: 'border' }[m[1]] as string] = resolve(m[2]);
  }
  return out;
}

test('the printed courier label matches its on-screen preview', () => {
  for (const [cls, prop] of [
    ['courier-label-header', 'border'],
    ['courier-label-grid', 'border'],
    ['courier-label-cod', 'border'],
    ['courier-label-footer', 'color'],
  ] as const) {
    assert.equal(
      printRuleColors(`.${cls}`)[prop],
      previewColors(cls)[prop],
      `${cls} ${prop}: print window vs on-screen preview`,
    );
  }

  // The sheet's own text and paper colours sit on `body` in the print document.
  const body = printRuleColors('body {');
  const sheet = previewColors('courier-label-sheet');
  assert.equal(body.color, sheet.color, 'label text colour');
  assert.equal(body.background, sheet.background, 'label paper colour');
});

test('the courier label field labels use one colour on screen and in print', () => {
  const labelTokens = [...courierPreview.matchAll(/className="font-black uppercase (text-[a-z]+-\d+)"/g)]
    .map(m => m[1].replace('text-', ''));
  assert.ok(labelTokens.length >= 6, `expected the label spans, found ${labelTokens.length}`);
  const distinct = [...new Set(labelTokens)];
  assert.equal(distinct.length, 1, `label spans disagree on screen: ${distinct.join(', ')}`);
  assert.equal(
    printRuleColors('.courier-label-meta span:nth-child(odd)').color,
    tokens.get(distinct[0]),
    'field label colour: print window vs on-screen preview',
  );
});

// --- 4. no hard-coded colours anywhere else -------------------------------

/**
 * Payment provider brand colours. These are dictated by bKash and Nagad, are not
 * ours to retint, and so are the one legitimate exception to the token layer.
 */
const BRAND_HEXES = new Set([
  '#e2136e', '#fff1f7', '#a90052', '#9d174d', // bKash
  '#d8292f', '#fff4ed', '#f37021', '#9a3412', // Nagad
]);

/** Files that hold a deliberate, tested copy of the token values. */
const MIRRORS = [
  'lib/chartColors.ts',
  'components/invoice/invoicePrintStyles.ts',
  'components/CourierLabelModal.tsx',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test('no component hard-codes a colour outside the token layer', () => {
  const tokenValues = new Set(tokens.values());
  const offenders: string[] = [];

  for (const file of walk(SRC_DIR)) {
    const rel = relative(SRC_DIR, file).replace(/\\/g, '/');
    if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
    const isMirror = MIRRORS.includes(rel);

    for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
      for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
        const hex = m[0].toLowerCase();
        if (hex === '#ffffff' || BRAND_HEXES.has(hex)) continue;
        // A mirror may hold token values - that is its job, and the tests above
        // check it holds the right ones. It may not invent new colours.
        if (isMirror && tokenValues.has(hex)) continue;
        offenders.push(`${rel}:${index + 1}  ${m[0]}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `hard-coded colours found. Use a Tailwind token class, or var(--color-*) in an ` +
      `inline style. If this is a new brand colour, add it to BRAND_HEXES:\n  ${offenders.join('\n  ')}`,
  );
});

// --- 5. no inert colour utilities ------------------------------------------

/**
 * Tailwind v4 resolves `text-slate-500` by looking up `--color-slate-500` in the
 * @theme block. When the token does not exist it emits no rule at all - silently.
 * The class stays in the markup, looks deliberate, and the element inherits some
 * ancestor's colour instead. Three such classes were found in the portal
 * (text-slate-850, text-slate-350, print:border-slate-350), one of which left the
 * invoice signature line printing at 1.12:1 against white.
 */
const COLOUR_UTIL =
  /(?:^|[\s"'`])((?:[a-z-]+:)*)(text|bg|border(?:-[trblxy]|-[se])?|ring|ring-offset|from|to|via|fill|stroke|decoration|outline|shadow|accent|divide|placeholder|caret)-([a-z]+-\d+)\b/g;

test('every colour utility names a token that exists', () => {
  // Only families that appear in @theme are checked, so `gap-2` and `w-32` -
  // which match the shape but are not colours - are left alone.
  const families = new Set([...tokens.keys()].map(t => t.split('-')[0]));
  const dead: string[] = [];

  for (const file of walk(SRC_DIR)) {
    const rel = relative(SRC_DIR, file).replace(/\\/g, '/');
    if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;

    for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
      for (const [, variants, prefix, token] of line.matchAll(COLOUR_UTIL)) {
        if (!families.has(token.split('-')[0])) continue;
        if (tokens.has(token)) continue;
        dead.push(`${rel}:${index + 1}  ${variants}${prefix}-${token}`);
      }
    }
  }

  assert.deepEqual(
    dead,
    [],
    `these classes resolve to no CSS, so the element silently inherits instead. ` +
      `Use a level that exists in the @theme ramp, or add the token:\n  ${dead.join('\n  ')}`,
  );
});

test('the print stylesheet implements the colours the invoice asks for', () => {
  // The print window is built by document.write with one hand-written stylesheet,
  // so a print:* class in this markup only applies if that sheet implements the
  // variant. print:border-slate-350 was in the markup for exactly this reason and
  // did nothing. (The sheet is also allowed to satisfy the request by styling the
  // element directly, as it now does for the signature rule.)
  const invoiceCss = read('../components/invoice/invoicePrintStyles.ts');
  const implemented = new Set(
    [...invoiceCss.matchAll(/\.print\\:([a-z0-9-]+)/g)].map(m => m[1]),
  );
  const families = new Set([...tokens.keys()].map(t => t.split('-')[0]));
  const used = [...read('../components/invoice/InvoiceSheet.tsx')
    .matchAll(/\bprint:(?:text|bg|border(?:-[trblxy]|-[se])?)-([a-z]+-\d+)\b/g)];

  for (const [whole, token] of used) {
    // border-b-0 and friends set a width, not a colour - skip anything whose
    // family is not one of the @theme colour families.
    if (!families.has(token.split('-')[0])) continue;
    const util = whole.replace('print:', '');
    assert.ok(
      tokens.has(token) || implemented.has(util),
      `InvoiceSheet asks for ${whole}, but --color-${token} does not exist and ` +
        `the print stylesheet does not implement .print\\:${util}`,
    );
  }
});

test('the invoice signature line is legible on paper', () => {
  // It is the line a client signs, so it is the one border in the sheet that
  // must not recede. slate-100 (its on-screen colour) prints at 1.12:1.
  const invoiceCss = read('../components/invoice/invoicePrintStyles.ts');
  const rule = /\.invoice-signatures \.border-t\s*\{[^}]*?(#[0-9a-fA-F]{6})/.exec(invoiceCss);
  assert.ok(rule, 'the print stylesheet must darken .invoice-signatures .border-t');
  const ratio = contrast(rule[1].toLowerCase(), WHITE);
  assert.ok(
    ratio >= NON_TEXT,
    `signature rule prints at ${ratio.toFixed(2)} against white, below ${NON_TEXT}`,
  );
});

// --- 6. one name per ramp ---------------------------------------------------

/**
 * Test 5 above catches a class whose *level* has no token (text-slate-850). It
 * cannot catch a class whose whole *family* has none, because it skips any family
 * absent from @theme so that `outline-offset-2` and `divide-x-2` - which match the
 * utility shape without being colours - are left alone. `text-stone-500` fell
 * through that hole in 18 places: Tailwind v4 does not drop an unknown family, it
 * falls back to its own factory palette, so those classes rendered a warm grey no
 * token in this repo controlled, at 4.39:1 where the slate equivalent gives 5.55:1.
 *
 * The two tests below close the hole from both sides: a factory family we never
 * tokenised may not appear at all, and of the families we did tokenise only the
 * canonical name of each ramp may be used in source.
 */

/** Tailwind v4's built-in colour palette. Any of these resolves with or without us. */
const FACTORY_FAMILIES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan',
  'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
  'slate', 'gray', 'zinc', 'neutral', 'stone',
] as const;

/** The one name each distinct ramp is written as in source. */
const CANONICAL_FAMILIES = [
  'slate',   // every neutral: text, borders, panels, the dark mobile cards
  'indigo',  // the accent (the prototype's teal, #1c7e6c at 500)
  'blue',    // informational
  'violet',  // "In transit"
  'emerald', // success, delivered, paid
  'amber',   // warning, on hold, the plan crown
  'orange',  // a deliberately warmer sibling of amber
  'rose',    // destructive, failed, returned
] as const;

/**
 * Kept in @theme on purpose, but not for use. Deleting these ramps would not make
 * a stray `bg-red-500` fail loudly - it would make it render Tailwind's factory
 * red, off our palette. They stay as a safety net and are asserted unused instead.
 */
const ALIAS_FAMILIES = ['sky', 'cyan', 'purple', 'green', 'red'] as const;

/** Every family that appears in a colour utility in source, with its first site. */
function colourFamilyUsage(): Map<string, string> {
  const seen = new Map<string, string>();
  for (const file of walk(SRC_DIR)) {
    const rel = relative(SRC_DIR, file).replace(/\\/g, '/');
    if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue;
    for (const [index, line] of readFileSync(file, 'utf8').split('\n').entries()) {
      for (const [, variants, prefix, token] of line.matchAll(COLOUR_UTIL)) {
        const family = token.split('-')[0];
        if (!seen.has(family)) seen.set(family, `${rel}:${index + 1}  ${variants}${prefix}-${token}`);
      }
    }
  }
  return seen;
}

test('the token families are exactly the canonical ramps plus their aliases', () => {
  // Pins the split, so a fourteenth family cannot be added to @theme without
  // someone deciding whether it is a new ramp or another name for an old one.
  const declared = new Set(
    [...tokens.keys()].filter(t => /-\d+$/.test(t)).map(t => t.split('-')[0]),
  );
  assert.deepEqual(
    [...declared].sort(),
    [...new Set([...CANONICAL_FAMILIES, ...ALIAS_FAMILIES])].sort(),
    'families in the @theme ramp vs the canonical + alias lists in this test',
  );
  for (const alias of ALIAS_FAMILIES) {
    assert.ok(
      !(CANONICAL_FAMILIES as readonly string[]).includes(alias),
      `${alias} cannot be both canonical and an alias`,
    );
  }
});

test('no colour utility names a factory family we never tokenised', () => {
  // The stone case. A comment counts: Tailwind v4 scans comments for class
  // candidates too, so a family named in one is emitted like any other.
  const declared = new Set(
    [...tokens.keys()].filter(t => /-\d+$/.test(t)).map(t => t.split('-')[0]),
  );
  const offenders = [...colourFamilyUsage()]
    .filter(([family]) => (FACTORY_FAMILIES as readonly string[]).includes(family))
    .filter(([family]) => !declared.has(family))
    .map(([family, site]) => `${site}   (${family} is not in @theme)`);

  assert.deepEqual(
    offenders,
    [],
    `these render Tailwind's factory palette, which no token in this repo can ` +
      `retint. Use the nearest canonical ramp (${CANONICAL_FAMILIES.join(', ')}):\n  ` +
      offenders.join('\n  '),
  );
});

test('source names each ramp once, never through an alias', () => {
  const offenders = [...colourFamilyUsage()]
    .filter(([family]) => (ALIAS_FAMILIES as readonly string[]).includes(family))
    .map(([family, site]) => {
      const same = CANONICAL_FAMILIES.find(
        c => tokens.get(`${c}-500`) === tokens.get(`${family}-500`),
      );
      return `${site}   (use ${same ?? 'the canonical ramp'} instead of ${family})`;
    });

  assert.deepEqual(
    offenders,
    [],
    `two names for one ramp means a retint has to be done twice and a reader ` +
      `cannot tell whether a difference was intended:\n  ` + offenders.join('\n  '),
  );
});


