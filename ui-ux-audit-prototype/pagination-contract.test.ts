import assert from "node:assert/strict";
import test from "node:test";
import { makePrototypePage } from "./paginationState";

test("marks a bounded row array incomplete when the server supplied no metadata", () => {
  const page = makePrototypePage([1, 2, 3, 4], 1, 3);
  assert.equal(page.totalCount, 4);
  assert.equal(page.hasMore, true);
  assert.equal(page.historyMayBeIncomplete, true);
});

test("preserves an authoritative total instead of replacing it with rendered row count", () => {
  const page = makePrototypePage([1, 2, 3], 1, 3, { totalCount: 27, hasMore: true });
  assert.equal(page.totalCount, 27);
  assert.equal(page.hasMore, true);
  assert.equal(page.historyMayBeIncomplete, false);
});

test("preserves an explicit final-page result", () => {
  const page = makePrototypePage([1, 2], 1, 25, { totalCount: 2, hasMore: false });
  assert.equal(page.hasMore, false);
  assert.equal(page.historyMayBeIncomplete, false);
});

test("normalizes unsafe page inputs without creating an unbounded read", () => {
  const page = makePrototypePage([1, 2, 3], 0, 0);
  assert.equal(page.page, 1);
  assert.equal(page.limit, 1);
  assert.deepEqual(page.items, [1]);
});
