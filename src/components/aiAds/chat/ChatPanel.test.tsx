import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ChatPanel } from './ChatPanel';
import type { ChatPanelProps } from './ChatPanel';
import { CHAT_STARTERS } from './chatPresentation';
import type { AiAdsConversationSummary, ChatMessage } from '../../../services/aiAdsApi';

/**
 * The redesigned Chat Now panel is unreachable in the local demo — the AI Ads page sits behind the
 * `aiAdsEnabled` gate the demo profile never sets — so these render assertions are the only
 * verification the markup gets. `chatPresentation.test.ts` covers the decisions; this covers what is
 * actually drawn from them, and above all the two things a wrong redesign would quietly break: a
 * client's own words being reinterpreted as formatting, and a saved chat becoming unreachable.
 */

const NOW = new Date(2026, 7, 29, 15, 30).getTime(); // 2026-08-29, local wall clock
const at = (day: number, hour = 12, minute = 0) => new Date(2026, 7, day, hour, minute).toISOString();

const conversation = (id: number, overrides: Partial<AiAdsConversationSummary> = {}): AiAdsConversationSummary => ({
  id,
  title: `Question ${id}`,
  status: 'open',
  summary: null,
  updated_at: at(29, 14),
  ...overrides,
});

const render = (overrides: Partial<ChatPanelProps> = {}) => renderToStaticMarkup(
  <ChatPanel
    messages={[]}
    streamingText=""
    steps={[]}
    value=""
    setValue={() => {}}
    busy={false}
    onSend={() => {}}
    onConfirmPlan={() => {}}
    onRejectPlan={() => {}}
    planBusy=""
    conversations={[]}
    historyBusy={false}
    historyError=""
    onSelectConversation={() => {}}
    onNewChat={() => {}}
    onRefreshHistory={() => {}}
    now={NOW}
    {...overrides}
  />,
);

const greeting: ChatMessage = { role: 'assistant', content: 'What would you like to review or plan for your ads?' };

test('a first-time client is met by the starter cards, not by an empty box', () => {
  const html = render({ messages: [greeting] });
  for (const starter of CHAT_STARTERS) {
    assert.ok(html.includes(starter.title), `${starter.title} must be offered`);
    // The card says what the assistant will go and read; that is the whole reason it replaced a pill.
    assert.ok(html.includes(starter.detail), `${starter.detail} must explain the card`);
  }
  assert.equal(html.match(/No past chats yet\./g)?.length, 1);
});

test('the hero gives way to the transcript as soon as there is a real conversation', () => {
  const html = render({ messages: [greeting, { role: 'user', content: 'গত ৭ দিনের পারফরম্যান্স দেখাও' }], conversationId: 4 });
  assert.doesNotMatch(html, new RegExp(CHAT_STARTERS[0].detail));
  assert.ok(html.includes('গত ৭ দিনের পারফরম্যান্স দেখাও'));
});

test('a client message is shown exactly as typed, never re-read as formatting', () => {
  // A merchant writing about a `|` price column, or using asterisks for emphasis, must see their own
  // characters back. Only the assistant's text goes through the markdown renderer.
  const typed = '**not bold** | Sunglass | 1200 |\n| --- | --- |\nsecond line';
  const html = render({ messages: [{ role: 'user', content: typed }], conversationId: 1 });
  assert.doesNotMatch(html, /<table/);
  assert.doesNotMatch(html, /<strong/);
  assert.ok(html.includes('**not bold**'));
  assert.match(html, /whitespace-pre-wrap/);
});

test('an assistant answer keeps the ranked ad table the prompt asks the model for', () => {
  const html = render({
    messages: [{ role: 'assistant', content: '| Ad | Spend |\n| --- | --- |\n| Sunglass A | 1200 |' }],
    conversationId: 1,
  });
  assert.match(html, /<table/);
  assert.ok(html.includes('Sunglass A'));
});

test('every turn says who said it and when, and prints no time when there is none', () => {
  const html = render({
    conversationId: 1,
    messages: [
      { role: 'user', content: 'Why did spend stop?', created_at: at(29, 14, 5) },
      { role: 'assistant', content: 'Two ad sets are off.', created_at: at(29, 14, 6) },
    ],
  });
  assert.equal(html.match(/>You</g)?.length, 1);
  assert.equal(html.match(/>Buykori AI</g)?.length, 2); // the header tile and the one answer
  assert.ok(html.includes('2:05 PM'));
  assert.ok(html.includes('2:06 PM'));
  assert.doesNotMatch(html, /Invalid Date/);

  // A stored turn from an older backend has no timestamp at all; that must print nothing.
  const untimed = render({ conversationId: 1, messages: [{ role: 'user', content: 'Why did spend stop?' }] });
  assert.doesNotMatch(untimed, /Invalid Date|NaN/);
});

test('an answer can be copied out, and an empty one offers nothing to copy', () => {
  const html = render({ conversationId: 1, messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'Spend was 32.43 BDT.' }] });
  // One copy control, on the answer — a merchant forwards these numbers to whoever runs their ads.
  assert.equal(html.match(/aria-label="Copy answer"/g)?.length, 1);

  const blank = render({ conversationId: 1, messages: [{ role: 'assistant', content: '   ' }] });
  assert.equal(blank.match(/aria-label="Copy answer"/g), null);
});

test('saved chats are grouped by day and the open one is marked, with no row dropped', () => {
  const html = render({
    conversationId: 2,
    messages: [greeting],
    conversations: [
      conversation(1, { updated_at: at(29, 14) }),
      conversation(2, { updated_at: at(29, 9), title: 'Sunglass campaign' }),
      conversation(3, { updated_at: at(28, 23) }),
      conversation(4, { updated_at: at(20) }),
    ],
  });
  assert.ok(html.includes('>Today<'));
  assert.ok(html.includes('>Yesterday<'));
  assert.ok(html.includes('>Older<'));
  assert.doesNotMatch(html, />Previous 7 days</);
  for (const id of [1, 2, 3, 4]) {
    assert.ok(html.includes(id === 2 ? 'Sunglass campaign' : `Question ${id}`), `conversation ${id} must stay reachable`);
  }
  // Exactly one row is the open one, and it is announced as such rather than only tinted.
  assert.equal(html.match(/aria-current="true"/g)?.length, 1);
  const openRow = html.slice(html.indexOf('aria-current="true"'));
  assert.ok(openRow.indexOf('Sunglass campaign') < openRow.indexOf('</button>'), 'the marked row must be the open chat');
});

test('a history that is still loading does not claim the client has never used the chat', () => {
  const loading = render({ messages: [greeting], historyBusy: true });
  assert.doesNotMatch(loading, /No past chats yet\./);
  assert.match(loading, /animate-pulse/);

  const failed = render({ messages: [greeting], historyError: 'History could not be loaded.' });
  assert.ok(failed.includes('History could not be loaded.'));
  assert.doesNotMatch(failed, /No past chats yet\./);
});

test('a phone can still reach saved chats, which was previously impossible', () => {
  const html = render({ messages: [greeting] });
  // The rail itself is desktop-only, so the header must carry the way in below `sm`.
  assert.match(html, /class="hidden w-64[^"]*sm:flex"/);
  assert.equal(html.match(/aria-label="Past chats"/g)?.length, 1);
  assert.equal(html.match(/aria-label="New chat"/g)?.length, 1);
});

test('the header names the open conversation, so the client knows which chat they are in', () => {
  const open = render({ conversationId: 7, messages: [greeting], conversations: [conversation(7, { title: 'Why is my ROAS low' })] });
  assert.ok(open.includes('Why is my ROAS low'));
  assert.doesNotMatch(render({ messages: [greeting] }), />Why is my ROAS low</);
  assert.ok(render({ messages: [greeting] }).includes('>New chat<'));
});

test('the waiting states are distinguishable, and only one is ever on screen', () => {
  const thinking = render({ conversationId: 1, messages: [greeting], busy: true });
  assert.ok(thinking.includes('Reviewing account context'));
  assert.match(thinking, /animate-bounce/);

  // Once tokens arrive the dots are replaced by the answer plus a caret.
  const streaming = render({ conversationId: 1, messages: [greeting], busy: true, streamingText: 'Reading your campaigns' });
  assert.doesNotMatch(streaming, /Reviewing account context/);
  assert.match(streaming, /animate-pulse/);
  assert.ok(streaming.includes('Reading your campaigns'));

  // A trail line also counts as visible progress, so the dots must stand down for it too.
  const trailing = render({ conversationId: 1, messages: [greeting], busy: true, steps: [{ label: 'Reading your campaigns', status: 'completed' }] });
  assert.doesNotMatch(trailing, /Reviewing account context/);
});

test('the composer is reachable, labelled, and states the two keys that are otherwise guesswork', () => {
  const empty = render({ messages: [greeting] });
  assert.match(empty, /aria-label="Message the AI Ads assistant"/);
  assert.ok(empty.includes('Enter দিয়ে পাঠান'));
  assert.ok(empty.includes('Shift + Enter'));
  // The reassurance that matters most on this page: nothing is changed without approval.
  assert.ok(empty.includes('আপনার অনুমতি ছাড়া কোনো অ্যাড বদলানো হয় না'));
  // Nothing typed yet, so there is nothing to send. Read the attribute, not the class list — the
  // button's `disabled:` utilities contain the word "disabled" whether or not it is disabled.
  // Match the whole `<button …>` open tag rather than a fixed window of characters before the
  // label: Button renders `disabled=""` before its className, so a window has to be wider than
  // the class list, and it silently stopped reaching far enough the moment that list grew (the
  // disabled-contrast fix added ~190 characters to every Button in the portal).
  const sendDisabled = (html: string) => {
    const tag = [...html.matchAll(/<button(?=[\s/>])[^>]*/g)]
      .find(match => match[0].includes('aria-label="Send message"'));
    assert.ok(tag, 'the composer must render a send button labelled for screen readers');
    return /\sdisabled=""/.test(tag[0]);
  };
  assert.equal(sendDisabled(empty), true);
  assert.equal(sendDisabled(render({ messages: [greeting], value: 'কেন খরচ বাড়ছে' })), false);
  // A send already in flight must not be sendable twice.
  assert.equal(sendDisabled(render({ messages: [greeting], value: 'কেন খরচ বাড়ছে', busy: true })), true);
});

test('a composed plan is still decided by the client, and only while it is decidable', () => {
  const plan = (state: string) => render({
    conversationId: 1,
    messages: [{
      role: 'assistant',
      content: 'Here is a plan for review.',
      structured: { composed_proposal: { proposal_id: 'p-1', version: 2, state, summary: 'Retarget last 30 days.' } },
    }],
  });
  const ready = plan('PROPOSAL_READY');
  assert.ok(ready.includes('Retarget last 30 days.'));
  assert.ok(ready.includes('Confirm plan'));
  assert.ok(ready.includes('No provider action is performed.'));

  // Already decided, or expired: the buttons must be gone rather than re-submittable.
  assert.doesNotMatch(plan('APPROVED'), /Confirm plan/);
});

test('the panel is a bounded box whose transcript scrolls, not a box that grows off the page', () => {
  // The original defect: the panel had no height bound, so `overflow-y-auto` never engaged, the panel
  // got taller with every turn and the newest answer sat below the fold. A bounded shell plus
  // `min-h-0` on the scrolling children is what makes the transcript scroll internally instead.
  const html = render({ conversationId: 1, messages: [{ role: 'assistant', content: 'Spend was 32.43 BDT.' }] });
  const shell = html.slice(0, html.indexOf('>'));
  assert.match(shell, /h-\[70vh\]/);
  assert.match(shell, /min-h-\[560px\]/);
  assert.match(shell, /overflow-hidden/);
  // Both scrolling regions: the transcript and the history rail.
  assert.equal(html.match(/min-h-0 flex-1 [^"]*overflow-y-auto/g)?.length, 2);
});

test('a queued proposal is announced as needing exact review, not as something already done', () => {
  const html = render({ conversationId: 1, messages: [{ role: 'assistant', content: 'Ready.', structured: { proposal: { id: 9 } } }] });
  assert.ok(html.includes('Proposal created for exact review.'));
});
