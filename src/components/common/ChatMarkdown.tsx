import React from 'react';

/**
 * A deliberately tiny, safe markdown renderer for AI Ads assistant replies.
 *
 * The assistant used to render as one flat run of raw text — no emphasis, no lists, no line
 * breaks — which is the single biggest reason the chat "did not feel like a real AI product".
 * This renders a small, fixed subset into React elements *only*: there is no
 * `dangerouslySetInnerHTML` anywhere, so no HTML sanitizer is needed and there is no injection
 * surface. Anything outside the subset (including links) falls through as plain text.
 *
 * Supported subset: paragraphs, soft line breaks, `**bold**`, inline `` `code` ``, bullet lists
 * (`-` or `•`, matching what the backend's `sanitize_user_facing_text` already emits), numbered
 * lists (`1.` / `1)`) and pipe tables. Parsing is a pure function so it can be unit-tested directly.
 *
 * Tables are here because the system prompt explicitly asks the model for a "ranked table of the
 * individual ads, one row each" — so replies really do arrive as GFM pipe tables, and without this
 * the merchant saw the raw `|---|---|` separator and pipe-soup rows instead of a table. A seven
 * column comparison of twenty-six ads cannot be flattened into prose, so the renderer had to grow
 * rather than the prompt shrink.
 */

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'code'; value: string };

/** `null` means the delimiter row said nothing, so the cell keeps the table's default alignment. */
export type TableAlign = 'left' | 'center' | 'right' | null;

export type MarkdownBlock =
  | { type: 'paragraph'; lines: InlineNode[][] }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'table'; header: InlineNode[][]; align: TableAlign[]; rows: InlineNode[][][] };

const BULLET = /^\s*[-•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;
/** One cell of a delimiter row: `-`, `---`, `:---`, `---:` or `:---:`. */
const DELIMITER_CELL = /^:?-+:?$/;

/**
 * Split one line of text into inline nodes. A single left-to-right scan recognises the first
 * matching delimiter, so ``**`` inside a code span (or a backtick inside bold) stays literal.
 * An unterminated delimiter is treated as ordinary text rather than swallowing the rest.
 */
function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buffer = '';
  let i = 0;
  const flush = () => {
    if (buffer) {
      nodes.push({ type: 'text', value: buffer });
      buffer = '';
    }
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        nodes.push({ type: 'code', value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (ch === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        nodes.push({ type: 'bold', value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    buffer += ch;
    i += 1;
  }
  flush();
  return nodes;
}

/**
 * Split one table row into its raw cell strings, or return `null` when the line is not a row.
 *
 * The outer pipes are optional, as they are in GFM, and `\|` carries a literal pipe into a cell.
 * The split happens before inline parsing, which is also GFM's order, so a pipe inside a code span
 * would end the cell — harmless here because an unterminated backtick already falls back to text.
 */
function splitTableRow(line: string): string[] | null {
  let body = line.trim();
  if (!body.includes('|')) return null;
  if (body.startsWith('|')) body = body.slice(1);
  if (body.endsWith('|') && !body.endsWith('\\|')) body = body.slice(0, -1);

  const cells: string[] = [];
  let buffer = '';
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '\\' && body[i + 1] === '|') {
      buffer += '|';
      i += 1;
      continue;
    }
    if (body[i] === '|') {
      cells.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += body[i];
  }
  cells.push(buffer.trim());
  return cells;
}

/**
 * Read the alignment row that sits under a header, or return `null` when the line is not one.
 *
 * Requiring the cell count to match the header is what stops an ordinary sentence containing a
 * pipe from being mistaken for a table: a table needs two consecutive, agreeing lines.
 */
function parseTableAlignments(line: string | undefined, columns: number): TableAlign[] | null {
  if (line === undefined) return null;
  const cells = splitTableRow(line);
  if (!cells || cells.length !== columns) return null;

  const align: TableAlign[] = [];
  for (const cell of cells) {
    if (!DELIMITER_CELL.test(cell)) return null;
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    align.push(left && right ? 'center' : right ? 'right' : left ? 'left' : null);
  }
  return align;
}

export function parseChatMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let paragraph: InlineNode[][] | null = null;
  let list: { ordered: boolean; items: InlineNode[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph && paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = null;
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ type: 'list', ordered: list.ordered, items: list.items });
    list = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    // Tables are looked for first because they need the strongest signal — a header line plus an
    // agreeing delimiter line — so nothing else can be swallowed by accident.
    const headerCells = splitTableRow(line);
    if (headerCells && headerCells.some(cell => cell.length > 0)) {
      const align = parseTableAlignments(lines[index + 1], headerCells.length);
      if (align) {
        flushParagraph();
        flushList();
        const header = headerCells.map(parseInline);
        const rows: InlineNode[][][] = [];
        let cursor = index + 2;
        while (cursor < lines.length && lines[cursor].trim()) {
          const rowCells = splitTableRow(lines[cursor]);
          if (!rowCells) break;
          // A short row is padded and a long one is truncated, as GFM does, so that the rendered
          // table stays rectangular however the model counted its pipes.
          rows.push(header.map((_, column) => parseInline(rowCells[column] ?? '')));
          cursor += 1;
        }
        blocks.push({ type: 'table', header, align, rows });
        index = cursor - 1;
        continue;
      }
    }

    const bulletMatch = line.match(BULLET);
    const orderedMatch = bulletMatch ? null : line.match(ORDERED);
    if (bulletMatch || orderedMatch) {
      flushParagraph();
      const isOrdered = Boolean(orderedMatch);
      const content = (bulletMatch ? bulletMatch[1] : orderedMatch ? orderedMatch[1] : '').trim();
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push(parseInline(content));
      continue;
    }
    flushList();
    if (!paragraph) paragraph = [];
    paragraph.push(parseInline(line.trim()));
  }
  flushParagraph();
  flushList();
  return blocks;
}

function renderInline(nodes: InlineNode[]): React.ReactNode {
  return nodes.map((node, index) => {
    if (node.type === 'bold') return <strong key={index} className="font-semibold text-slate-950">{node.value}</strong>;
    if (node.type === 'code') return <code key={index} className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[0.85em]">{node.value}</code>;
    return <React.Fragment key={index}>{node.value}</React.Fragment>;
  });
}

/** `null` keeps the table's own default, which is left. */
function alignClass(align: TableAlign): string {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  return 'text-left';
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = parseChatMarkdown(text);
  if (!blocks.length) return <>{text}</>;
  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        if (block.type === 'table') {
          // The bubble is width-capped, so a seven column ad table has to be allowed to scroll
          // sideways rather than squeeze every column into a few characters.
          return (
            <div key={blockIndex} className="-mx-1 overflow-x-auto">
              <table className="w-full border-collapse text-[0.9em] leading-5">
                <thead>
                  <tr className="border-b border-[var(--bk-console-border)]">
                    {block.header.map((cell, columnIndex) => (
                      <th
                        key={columnIndex}
                        scope="col"
                        className={`px-2 py-1.5 font-semibold ${alignClass(block.align[columnIndex])}`}
                      >
                        {renderInline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-[var(--bk-console-border)] last:border-b-0">
                      {row.map((cell, columnIndex) => (
                        <td
                          key={columnIndex}
                          className={`px-2 py-1.5 align-top ${alignClass(block.align[columnIndex])}`}
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === 'list') {
          const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>);
          return block.ordered
            ? <ol key={blockIndex} className="list-decimal space-y-1 pl-5">{items}</ol>
            : <ul key={blockIndex} className="list-disc space-y-1 pl-5">{items}</ul>;
        }
        return (
          <p key={blockIndex} className="leading-6">
            {block.lines.map((lineNodes, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInline(lineNodes)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
