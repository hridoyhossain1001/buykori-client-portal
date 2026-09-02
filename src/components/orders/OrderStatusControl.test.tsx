import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import type { OrderWorkflowStatus } from '../../types';
import { OrderStatusControl, OrderStatusPicker } from './OrderStatusControl';

/**
 * `index.css` gives every input/select/textarea `min-height: 44px` so that a
 * real control is never smaller than a finger. That rule is right for controls
 * a user aims at directly, and wrong for one particular pattern: an invisible
 * `absolute inset-0 opacity-0` control laid over a smaller visual element so
 * the element becomes the target. There the control must be exactly as tall as
 * what it covers, because it is positioned from `top: 0` — any excess height
 * hangs *below* the visible box and silently eats clicks aimed at whatever
 * sits under it.
 *
 * `OrderStatusControl` is that pattern: a 32px status chip with a transparent
 * `<select>` over it, sitting in an orders table row next to other buttons.
 * The fix is one class, `min-h-0`, and it is the kind of class a later tidy-up
 * deletes as noise. Deleting it breaks nothing visibly, breaks no test that
 * checks markup or colour, and reintroduces a click-stealing 13px strip.
 *
 * So: one test pins the class on this component, and one sweeps the codebase
 * for any other overlay control that forgets it.
 *
 * `OrderStatusPicker` — the variant the orders table actually renders — opts out
 * of the same rule and then grows the target back deliberately, symmetrically,
 * with `-inset-y-3`. Both halves have to hold: `min-h-0` alone leaves a 24px
 * target, and the growth alone hangs 24px of click-stealing strip below the
 * chip. So a third test pins the pair.
 */

const overlay = (markup: string) => {
  const match = markup.match(/<select[^>]*class="([^"]*)"/);
  assert.ok(match, 'expected a <select> with a class attribute');
  return match[1];
};

test('the invisible select overlay opts out of the 44px control minimum', () => {
  const markup = renderToStaticMarkup(
    React.createElement(OrderStatusControl, {
      status: 'pending',
      options: ['pending', 'confirmed'] satisfies OrderWorkflowStatus[],
      orderId: 'ORD-1',
      onChange: () => {},
    }),
  );
  const classes = overlay(markup);
  assert.match(classes, /\babsolute\b/, 'the overlay must stay absolutely positioned');
  assert.match(classes, /\bopacity-0\b/, 'the overlay must stay invisible');
  assert.match(
    classes,
    /\bmin-h-0\b/,
    'without min-h-0 the base 44px rule makes this overlay taller than the 32px chip it covers, '
      + 'and the excess hangs below the chip and swallows clicks in the table row',
  );
});

const picker = (props: Partial<Parameters<typeof OrderStatusPicker>[0]> = {}) =>
  renderToStaticMarkup(
    React.createElement(OrderStatusPicker, {
      status: 'pending',
      options: ['pending', 'confirmed', 'cancelled'] satisfies OrderWorkflowStatus[],
      orderId: 'ORD-1',
      onChange: () => {},
      ...props,
    }),
  );

test('the table picker opts out of the 44px minimum and then grows the target back', () => {
  const classes = overlay(picker());
  assert.match(classes, /\bmin-h-0\b/, 'without min-h-0 the base rule hangs the excess below the chip');
  assert.match(
    classes,
    /(^| )-inset-y-3/,
    'the 26px chip is a 24px target without this: the growth is what makes it 48px, and it has to be '
      + 'symmetric so no part of it reaches the row underneath',
  );
  assert.doesNotMatch(
    classes,
    /\b(inset-0|h-full)\b/,
    'either class pins the overlay back to the height of the chip it covers, undoing the growth',
  );
});

test('the table picker grows the target, not the visual chip', () => {
  assert.match(picker(), /h-\[26px\]/, 'the chip stays 26px so the table keeps its row rhythm');
});

test('a locked row renders no overlay at all', () => {
  const markup = picker({ status: 'completed', options: [] });
  assert.doesNotMatch(markup, /<select/, 'one choice is not a choice, so there is nothing to open');
  assert.match(markup, /Completed/, 'the status still has to be readable');
});

// --- the same mistake, anywhere else in the tree ---

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');

const tsxFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry) ? [full] : [];
  });

/** Tailwind v4 reads comments as class candidates, so a comment naming a class
 *  reads as a use of it. Strip them before scanning for real usage. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/**
 * Reads one JSX opening tag. A non-greedy `[\s\S]*?>` would stop at the first
 * `>` it meets, which in practice is the arrow of an `onChange={(e) => …}`
 * handler — that is how an earlier scan of this codebase undercounted. Track
 * brace depth instead and end on the first `>` at depth 0.
 */
const openingTag = (source: string, start: number) => {
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
};

const overlayControls = () => {
  const found: { file: string; tag: string }[] = [];
  for (const file of tsxFiles(SRC)) {
    const source = stripComments(readFileSync(file, 'utf8'));
    const pattern = /<(select|input|textarea)\b/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const tag = openingTag(source, match.index);
      if (/\bopacity-0\b/.test(tag) && /\babsolute\b/.test(tag)) {
        found.push({ file: relative(SRC, file).split(sep).join('/'), tag });
      }
    }
  }
  return found;
};

test('every invisible overlay control in the tree opts out', () => {
  const controls = overlayControls();
  assert.ok(controls.length > 0, 'the scan found no overlay controls at all — it has stopped working');
  const offenders = controls
    .filter(({ tag }) => !/\bmin-h-0\b/.test(tag))
    .map(({ file }) => file);
  assert.deepEqual(
    offenders,
    [],
    `these invisible overlay controls will be forced to 44px by the base rule in index.css and `
      + `will overhang whatever they cover: ${offenders.join(', ')}`,
  );
});
