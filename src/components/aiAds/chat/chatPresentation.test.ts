import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CHAT_STARTERS,
  STICK_THRESHOLD_PX,
  UNTITLED_CONVERSATION,
  composerHeight,
  conversationLabel,
  groupConversations,
  messageClock,
  shouldStickToBottom,
} from './chatPresentation';

/** Local wall-clock, so every assertion below holds in any timezone the suite runs in. */
const at = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).toISOString();

const NOW = new Date(2026, 7, 29, 15, 30).getTime(); // 2026-08-29, local

const row = (id: number, updated_at: string) => ({ id, updated_at });

test('history rows are grouped by calendar day, not by elapsed hours', () => {
  const groups = groupConversations([
    row(1, at(2026, 8, 29, 14)),
    row(2, at(2026, 8, 29, 1)),
    // 11pm "last night" is yesterday this afternoon, even though it is under 24 hours ago.
    row(3, at(2026, 8, 28, 23)),
    row(4, at(2026, 8, 24)),
    row(5, at(2026, 8, 1)),
  ], NOW);

  assert.deepEqual(groups.map(group => group.label), ['Today', 'Yesterday', 'Previous 7 days', 'Older']);
  assert.deepEqual(groups[0].items.map(item => item.id), [1, 2]);
  assert.deepEqual(groups[1].items.map(item => item.id), [3]);
  assert.deepEqual(groups[2].items.map(item => item.id), [4]);
  assert.deepEqual(groups[3].items.map(item => item.id), [5]);
});

test('an empty group gets no heading, and no rows are lost or reordered', () => {
  const items = [row(1, at(2026, 8, 29, 9)), row(2, at(2026, 8, 29, 8)), row(3, at(2026, 1, 4))];
  const groups = groupConversations(items, NOW);

  assert.deepEqual(groups.map(group => group.label), ['Today', 'Older']);
  // Grouping is presentation only: flattening returns exactly what the server sent, in order.
  assert.deepEqual(groups.flatMap(group => group.items).map(item => item.id), [1, 2, 3]);
  assert.deepEqual(groupConversations([], NOW), []);
});

test('a row with an unusable timestamp still appears instead of vanishing from the rail', () => {
  const groups = groupConversations([row(1, 'not a date'), row(2, '')], NOW);

  assert.deepEqual(groups.map(group => group.label), ['Older']);
  assert.deepEqual(groups[0].items.map(item => item.id), [1, 2]);
});

test('a timestamp slightly ahead of the browser clock reads as today, not as the future', () => {
  // Server and browser clocks disagree by seconds all the time; the newest chat must stay on top.
  const groups = groupConversations([row(1, at(2026, 8, 29, 15, 31))], NOW);
  assert.deepEqual(groups.map(group => group.label), ['Today']);
});

test('the exact edges of the seven day window are stable', () => {
  const label = (day: number) => groupConversations([row(1, at(2026, 8, day))], NOW)[0].label;
  assert.equal(label(28), 'Yesterday');
  assert.equal(label(27), 'Previous 7 days');
  assert.equal(label(22), 'Previous 7 days'); // exactly 7 days back
  assert.equal(label(21), 'Older');
});

test('a history row is titled by the clients own question before the models summary', () => {
  assert.equal(conversationLabel({ title: 'Why did my sunglass campaign stop selling?', summary: 'Spend review' }),
    'Why did my sunglass campaign stop selling?');
  assert.equal(conversationLabel({ title: '   ', summary: 'Spend review' }), 'Spend review');
  assert.equal(conversationLabel({ title: null, summary: null }), UNTITLED_CONVERSATION);
  assert.equal(conversationLabel({}), UNTITLED_CONVERSATION);
});

test('a message time is only shown when there is a real one to show', () => {
  assert.equal(messageClock(at(2026, 8, 29, 14, 5)), '2:05 PM');
  assert.equal(messageClock(at(2026, 8, 29, 9, 0)), '9:00 AM');
  // Nothing trustworthy: print nothing rather than "Invalid Date" or a made-up stamp.
  assert.equal(messageClock(undefined), '');
  assert.equal(messageClock(null), '');
  assert.equal(messageClock(''), '');
  assert.equal(messageClock('yesterday'), '');
});

test('the transcript follows new answers down only when the client is already at the bottom', () => {
  const viewport = (scrollTop: number) => ({ scrollTop, scrollHeight: 2000, clientHeight: 600 });
  assert.equal(shouldStickToBottom(viewport(1400)), true); // pinned to the bottom
  assert.equal(shouldStickToBottom(viewport(1400 - STICK_THRESHOLD_PX)), true); // just inside the window
  assert.equal(shouldStickToBottom(viewport(1400 - STICK_THRESHOLD_PX - 1)), false);
  // Scrolled up to re-read an earlier answer: the view must not be yanked away.
  assert.equal(shouldStickToBottom(viewport(0)), false);
  // A viewport that has not been laid out yet reports zeros, and a fresh chat should follow.
  assert.equal(shouldStickToBottom({ scrollTop: 0, scrollHeight: 0, clientHeight: 0 }), true);
});

test('the composer grows with the question but can never push the transcript off screen', () => {
  assert.equal(composerHeight(20), 48); // one line still gets the full tap target
  assert.equal(composerHeight(96), 96);
  assert.equal(composerHeight(4000), 168); // past the cap the textarea scrolls instead
  assert.equal(composerHeight(Number.NaN), 48);
});

test('every starter card sends a real prompt and describes something the assistant can do', () => {
  assert.equal(CHAT_STARTERS.length, 4);
  const prompts = new Set<string>();
  for (const starter of CHAT_STARTERS) {
    assert.ok(starter.title.trim(), 'a starter needs a label');
    assert.ok(starter.detail.trim(), 'a starter needs to say what it will read');
    assert.ok(starter.prompt.trim().length > 10, 'the prompt must be a real question');
    prompts.add(starter.prompt);
  }
  assert.equal(prompts.size, 4, 'two cards sending the same prompt would be one wasted card');
  // The four prompts are unchanged from the pills this replaced: the redesign is presentation, so
  // the assistant is asked exactly what it was asked before.
  assert.deepEqual(CHAT_STARTERS.map(starter => starter.prompt), [
    'গত ৭ দিনের পারফরম্যান্স দেখাও',
    'আমার লাইভ অ্যাড চালু আছে কিনা দেখো',
    'আমার সেরা প্রোডাক্টের জন্য একটা ক্যাম্পেইন প্ল্যান করো',
    'আমার ROAS কম কেন, ব্যাখ্যা করো',
  ]);
});
