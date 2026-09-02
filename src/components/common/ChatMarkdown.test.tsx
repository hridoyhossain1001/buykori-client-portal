import assert from 'node:assert/strict';
import test from 'node:test';

import { parseChatMarkdown } from './ChatMarkdown';

test('plain text becomes one paragraph, and blank lines separate paragraphs', () => {
  assert.deepEqual(parseChatMarkdown('Hello there.'), [
    { type: 'paragraph', lines: [[{ type: 'text', value: 'Hello there.' }]] },
  ]);

  const blocks = parseChatMarkdown('First.\n\nSecond.');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[1].type, 'paragraph');
});

test('a single newline is a soft line break inside one paragraph', () => {
  const blocks = parseChatMarkdown('Line one\nLine two');
  assert.equal(blocks.length, 1);
  if (blocks[0].type !== 'paragraph') throw new Error('expected a paragraph');
  assert.equal(blocks[0].lines.length, 2);
});

test('bold and inline code are parsed as their own nodes', () => {
  const blocks = parseChatMarkdown('Spend was **BDT 4,200** on `meta`.');
  if (blocks[0].type !== 'paragraph') throw new Error('expected a paragraph');
  assert.deepEqual(blocks[0].lines[0], [
    { type: 'text', value: 'Spend was ' },
    { type: 'bold', value: 'BDT 4,200' },
    { type: 'text', value: ' on ' },
    { type: 'code', value: 'meta' },
    { type: 'text', value: '.' },
  ]);
});

// The backend's sanitizer emits `•` bullets, so both markers must produce a list.
test('both dash and bullet lists are recognised', () => {
  for (const marker of ['-', '•']) {
    const blocks = parseChatMarkdown(`Plan:\n${marker} Raise budget\n${marker} Pause weak ad`);
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[1], {
      type: 'list',
      ordered: false,
      items: [[{ type: 'text', value: 'Raise budget' }], [{ type: 'text', value: 'Pause weak ad' }]],
    });
  }
});

test('numbered lists are ordered, and switching marker style starts a new list', () => {
  const blocks = parseChatMarkdown('1. First step\n2) Second step\n- Then this');
  assert.equal(blocks.length, 2);
  if (blocks[0].type !== 'list' || blocks[1].type !== 'list') throw new Error('expected two lists');
  assert.equal(blocks[0].ordered, true);
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[1].ordered, false);
  assert.equal(blocks[1].items.length, 1);
});

test('list items keep their own inline formatting', () => {
  const blocks = parseChatMarkdown('- Spend **BDT 900**');
  if (blocks[0].type !== 'list') throw new Error('expected a list');
  assert.deepEqual(blocks[0].items[0], [
    { type: 'text', value: 'Spend ' },
    { type: 'bold', value: 'BDT 900' },
  ]);
});

// An unterminated delimiter must stay literal rather than swallowing the rest of the reply.
test('unbalanced markers are left as plain text', () => {
  const blocks = parseChatMarkdown('This **is not closed and `neither is this');
  if (blocks[0].type !== 'paragraph') throw new Error('expected a paragraph');
  assert.deepEqual(blocks[0].lines[0], [{ type: 'text', value: 'This **is not closed and `neither is this' }]);
});

test('a delimiter inside a code span stays literal', () => {
  const blocks = parseChatMarkdown('Use `**not bold**` here');
  if (blocks[0].type !== 'paragraph') throw new Error('expected a paragraph');
  assert.deepEqual(blocks[0].lines[0], [
    { type: 'text', value: 'Use ' },
    { type: 'code', value: '**not bold**' },
    { type: 'text', value: ' here' },
  ]);
});

// The renderer emits React nodes only — there is no HTML parsing anywhere — so raw markup in a
// reply must survive as literal text and never become an element.
test('HTML in a reply is carried as inert text', () => {
  const blocks = parseChatMarkdown('<img src=x onerror=alert(1)>');
  if (blocks[0].type !== 'paragraph') throw new Error('expected a paragraph');
  assert.deepEqual(blocks[0].lines[0], [{ type: 'text', value: '<img src=x onerror=alert(1)>' }]);
});

test('empty and whitespace-only input produce no blocks', () => {
  assert.deepEqual(parseChatMarkdown(''), []);
  assert.deepEqual(parseChatMarkdown('   \n\n  '), []);
});

// The system prompt asks the model for "a ranked table of the individual ads, one row each", so
// these arrive on every performance answer. Before tables were parsed the merchant saw the literal
// `|---|---|` separator and pipe-soup rows.
test('a pipe table becomes a table block with its header and rows', () => {
  const blocks = parseChatMarkdown('| # | Ad | Spend |\n|---|---|---|\n| 1 | Sunglass | 13.71 |\n| 2 | TELIGRAM | 6.18 |');
  assert.equal(blocks.length, 1);
  if (blocks[0].type !== 'table') throw new Error('expected a table');
  assert.deepEqual(blocks[0].header, [
    [{ type: 'text', value: '#' }],
    [{ type: 'text', value: 'Ad' }],
    [{ type: 'text', value: 'Spend' }],
  ]);
  assert.equal(blocks[0].rows.length, 2);
  assert.deepEqual(blocks[0].rows[1], [
    [{ type: 'text', value: '2' }],
    [{ type: 'text', value: 'TELIGRAM' }],
    [{ type: 'text', value: '6.18' }],
  ]);
});

test('the delimiter row sets per-column alignment and is never rendered as data', () => {
  const blocks = parseChatMarkdown('| Ad | Spend | Note |\n| :--- | ---: | :---: |\n| Sun | 1.26 | none |');
  if (blocks[0].type !== 'table') throw new Error('expected a table');
  assert.deepEqual(blocks[0].align, ['left', 'right', 'center']);
  assert.equal(blocks[0].rows.length, 1);
});

test('a delimiter row with no colons leaves alignment unset', () => {
  const blocks = parseChatMarkdown('| A | B |\n|---|---|\n| 1 | 2 |');
  if (blocks[0].type !== 'table') throw new Error('expected a table');
  assert.deepEqual(blocks[0].align, [null, null]);
});

// This is the guard that matters most: ordinary prose containing a pipe must stay prose.
test('a line with a pipe but no delimiter row underneath stays a paragraph', () => {
  for (const text of ['Spend | purchases are both up.', '| Ad | Spend |\nNot a delimiter row', '| Ad | Spend |\n| --- data |']) {
    const blocks = parseChatMarkdown(text);
    assert.equal(blocks[0].type, 'paragraph', text);
  }
});

test('a delimiter row whose column count disagrees with the header is not a table', () => {
  const blocks = parseChatMarkdown('| A | B | C |\n|---|---|\n| 1 | 2 | 3 |');
  assert.equal(blocks[0].type, 'paragraph');
});

// However the model counts its pipes, the rendered table has to stay rectangular.
test('short rows are padded and long rows are truncated to the header width', () => {
  const blocks = parseChatMarkdown('| A | B | C |\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 |');
  if (blocks[0].type !== 'table') throw new Error('expected a table');
  assert.equal(blocks[0].rows[0].length, 3);
  assert.deepEqual(blocks[0].rows[0][2], []);
  assert.equal(blocks[0].rows[1].length, 3);
  assert.deepEqual(blocks[0].rows[1][2], [{ type: 'text', value: '3' }]);
});

test('outer pipes are optional and an escaped pipe stays inside its cell', () => {
  const blocks = parseChatMarkdown('Ad | Note\n--- | ---\nSun | a \\| b');
  if (blocks[0].type !== 'table') throw new Error('expected a table');
  assert.equal(blocks[0].header.length, 2);
  assert.deepEqual(blocks[0].rows[0][1], [{ type: 'text', value: 'a | b' }]);
});

test('cells keep their own inline formatting', () => {
  const blocks = parseChatMarkdown('| Ad | Spend |\n|---|---|\n| **Sun** | `13.71` |');
  if (blocks[0].type !== 'table') throw new Error('expected a table');
  assert.deepEqual(blocks[0].rows[0], [[{ type: 'bold', value: 'Sun' }], [{ type: 'code', value: '13.71' }]]);
});

// The shape of a real reply: prose, the ranked table, then prose again.
test('a table ends at the first blank or non-row line and the prose around it survives', () => {
  const blocks = parseChatMarkdown(
    'Top spenders:\n| # | Ad |\n|---|---|\n| 1 | Sunglass |\n\nAsk by number, names repeat.',
  );
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[1].type, 'table');
  assert.equal(blocks[2].type, 'paragraph');
  if (blocks[1].type !== 'table') throw new Error('expected a table');
  assert.equal(blocks[1].rows.length, 1);
});

test('a table with a header but no rows is still a table', () => {
  const blocks = parseChatMarkdown('| A | B |\n|---|---|');
  if (blocks[0].type !== 'table') throw new Error('expected a table');
  assert.deepEqual(blocks[0].rows, []);
});
