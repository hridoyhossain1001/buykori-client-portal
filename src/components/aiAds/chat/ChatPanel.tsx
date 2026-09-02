import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Copy, History, Loader2, Plus, RefreshCw, Send, Sparkles, User, X } from 'lucide-react';
import { Button } from '../../common/Button';
import { ChatMarkdown } from '../../common/ChatMarkdown';
import { relativeTime } from '../../eventLogs/eventLogUtils';
import type { AiAdsConversationSummary, ChatMessage } from '../../../services/aiAdsApi';
import {
  CHAT_STARTERS,
  composerHeight,
  conversationLabel,
  groupConversations,
  messageClock,
  shouldStickToBottom,
} from './chatPresentation';

/**
 * Chat Now, rebuilt.
 *
 * The old panel worked but read as a debug console: unattributed bubbles in a hardcoded slate, no
 * times, no way to copy an answer, four tiny pills for a first-time client, a two-row composer that
 * could not grow, a flat fifty-row history list, and — worst of all — no scrolling, so a streamed
 * answer grew below the fold while the client watched a motionless screen. Every one of those is
 * addressed here, and nothing about *what* is sent or *what* the assistant is asked changed: this
 * file is presentation only, over the same props the previous panel took.
 *
 * The panel lives in its own module because it had outgrown being a tail-end helper inside
 * `AIAdsView.tsx`, and because splitting the decisions out into `chatPresentation.ts` is the only
 * way any of this can be tested — the AI Ads page sits behind the `aiAdsEnabled` gate that the
 * local demo profile never sets.
 */

/**
 * One line of the live activity trail. The backend sends these already phrased for the client
 * (no tool name, no account id), and `status` says whether that check actually produced data —
 * so a denied or failed check is shown honestly instead of being hidden behind a spinner.
 */
export type ActivityStep = { label: string; status: string };

export interface ChatPanelProps {
  messages: ChatMessage[];
  streamingText: string;
  steps: ActivityStep[];
  value: string;
  setValue: (value: string) => void;
  busy: boolean;
  onSend: (prompt?: string) => void;
  onConfirmPlan: (id: string) => void;
  onRejectPlan: (id: string) => void;
  planBusy: string;
  conversations: AiAdsConversationSummary[];
  conversationId?: number;
  historyBusy: boolean;
  historyError: string;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
  onRefreshHistory: () => void;
  /** Injectable only so the render test can assert on fixed date headings. */
  now?: number;
}
const ASSISTANT_NAME = 'Buykori AI';

/** Bubble radius: the square corner points at the sender's own avatar. */
const BUBBLE_BASE = 'w-full rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm';
const ASSISTANT_BUBBLE = `${BUBBLE_BASE} rounded-tl-sm border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] text-[var(--bk-console-text)]`;
const USER_BUBBLE = `${BUBBLE_BASE} rounded-tr-sm bg-[var(--bk-console-blue)] text-white`;

/**
 * Who is speaking. The old panel attributed nothing, so a long assistant answer followed by a long
 * question read as one continuous block of text from nobody in particular.
 */
function SenderAvatar({ role }: { role: 'user' | 'assistant' }) {
  const style = role === 'user'
    ? 'border border-[var(--bk-console-border-strong)] bg-[var(--bk-console-surface)] text-[var(--bk-console-text-muted)]'
    : 'bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]';
  return (
    <span aria-hidden="true" className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${style}`}>
      {role === 'user' ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
    </span>
  );
}

/** Name and clock time above a bubble. An absent time prints nothing rather than a placeholder. */
function SenderLine({ name, time, align }: { name: string; time: string; align: 'start' | 'end' }) {
  return (
    <div className={`flex items-center gap-2 px-1 text-[11px] text-[var(--bk-console-text-subtle)] ${align === 'end' ? 'flex-row-reverse' : ''}`}>
      <span className="font-semibold text-[var(--bk-console-text-muted)]">{name}</span>
      {time ? <span>{time}</span> : null}
    </div>
  );
}

/**
 * Copy one answer. A merchant forwards these numbers to whoever runs their ads, and until now the
 * only way to get them out was a manual selection across a bubble that also held a table.
 *
 * A browser that refuses clipboard access (an insecure origin, a denied permission) leaves the chat
 * alone rather than raising an error over an answer that is still perfectly readable on screen.
 */
function CopyAnswerButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* nothing to report: the answer is still on screen and selectable */
    }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? 'Answer copied' : 'Copy answer'}
      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-[var(--bk-console-text-subtle)] transition-opacity hover:text-[var(--bk-console-text)] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}
/** One turn of the transcript, attributed and timed. */
function MessageRow({ message, onConfirmPlan, onRejectPlan, planBusy }: {
  message: ChatMessage;
  onConfirmPlan: (id: string) => void;
  onRejectPlan: (id: string) => void;
  planBusy: string;
}) {
  const isUser = message.role === 'user';
  const structured = message.structured ?? undefined;
  return (
    <div className={`group flex gap-2.5 sm:gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <SenderAvatar role={isUser ? 'user' : 'assistant'} />
      <div className={`flex min-w-0 max-w-[92%] flex-col gap-1 sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <SenderLine name={isUser ? 'You' : ASSISTANT_NAME} time={messageClock(message.created_at)} align={isUser ? 'end' : 'start'} />
        <div className={isUser ? USER_BUBBLE : ASSISTANT_BUBBLE}>
          {/* Only the assistant's text is markdown. A client's own message is shown exactly as they
              typed it, newlines included, so nothing they wrote is reinterpreted as formatting. */}
          {isUser ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : <ChatMarkdown text={message.content} />}
          {structured && 'proposal' in structured ? (
            <div className="mt-3 border-t border-[var(--bk-console-border)] pt-3 text-xs font-medium text-[var(--bk-console-blue)]">
              Proposal created for exact review.
            </div>
          ) : null}
          {structured && 'composed_proposal' in structured ? (
            <div className="mt-3 border-t border-[var(--bk-console-border)] pt-3">
              <ProposalSummaryCard proposal={structured.composed_proposal as Record<string, unknown>} onConfirm={onConfirmPlan} onReject={onRejectPlan} busy={planBusy} />
            </div>
          ) : null}
        </div>
        {!isUser && message.content.trim() ? <CopyAnswerButton text={message.content} /> : null}
      </div>
    </div>
  );
}

/**
 * The visible proof that the assistant did real work: one line per check it ran, in order,
 * while the turn is still in flight. A check that was refused or failed keeps its own marker
 * instead of being dressed up as a success, and the trail disappears once the answer lands.
 *
 * Exported (and re-exported from `AIAdsView.tsx`) for the render test: the AI Ads page is behind the
 * `aiAdsEnabled` gate, which the local demo never sets, so a component test is the only place this
 * markup can be checked.
 */
export function ActivityTrail({ steps, busy }: { steps: ActivityStep[]; busy: boolean }) {
  return (
    <div className="flex gap-2.5 sm:gap-3">
      <SenderAvatar role="assistant" />
      <ul className="mt-1 max-w-[92%] space-y-1.5 rounded-2xl rounded-tl-sm border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] px-4 py-3 shadow-sm sm:max-w-[78%]">
        {steps.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex items-center gap-2 text-xs text-[var(--bk-console-text-muted)]">
            {step.status === 'completed'
              ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              : <X className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />}
            <span>{step.label}</span>
          </li>
        ))}
        {busy ? (
          <li className="flex items-center gap-2 text-xs text-[var(--bk-console-text-muted)]">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
            <span>Working out what this means</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
/** The answer as it arrives. The caret is the only thing that says it is still being written. */
function StreamingRow({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 sm:gap-3">
      <SenderAvatar role="assistant" />
      <div className="flex min-w-0 max-w-[92%] flex-col gap-1 sm:max-w-[78%]">
        <SenderLine name={ASSISTANT_NAME} time="" align="start" />
        <div className={ASSISTANT_BUBBLE}>
          <ChatMarkdown text={text} />
          <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-[var(--bk-console-blue)] align-middle" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/**
 * The gap between pressing send and the first token. It used to be one grey line of text, which is
 * indistinguishable from a page that has stopped working.
 */
function ThinkingRow() {
  return (
    <div className="flex gap-2.5 sm:gap-3">
      <SenderAvatar role="assistant" />
      <div className="flex min-w-0 flex-col gap-1">
        <SenderLine name={ASSISTANT_NAME} time="" align="start" />
        <div className={`${ASSISTANT_BUBBLE} flex items-center gap-2 text-[var(--bk-console-text-muted)]`}>
          <span className="flex items-center gap-1" aria-hidden="true">
            {[0, 160, 320].map(delay => (
              <span
                key={delay}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--bk-console-border-strong)]"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          <span className="text-xs">Reviewing account context</span>
        </div>
      </div>
    </div>
  );
}

/**
 * What a client sees before they have asked anything. Four small pills were easy to miss and said
 * nothing about what each one would do, so a first-time merchant closed the tab without asking
 * anything. These cards name the question and what the assistant will go and read for it.
 */
function ChatHero({ onSend, disabled }: { onSend: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-1 py-8 text-center sm:py-12">
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]">
        <Sparkles className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-[var(--bk-console-text)]">আপনার অ্যাড নিয়ে যা জানতে চান, জিজ্ঞেস করুন</h3>
      {/* Accurate as of the live-read architecture: every answer is read from the ad platform at
          question time, not quoted from a stored sync row. */}
      <p className="mt-1.5 max-w-md text-sm leading-6 text-[var(--bk-console-text-muted)]">
        প্রশ্ন করার সময় সরাসরি অ্যাড প্ল্যাটফর্ম থেকে পড়া হয় — পুরনো জমানো সংখ্যা দেখানো হয় না।
      </p>
      <div className="mt-6 grid w-full gap-3 sm:grid-cols-2">
        {CHAT_STARTERS.map(starter => (
          <button
            key={starter.prompt}
            type="button"
            disabled={disabled}
            onClick={() => onSend(starter.prompt)}
            className="group/card flex h-full items-start gap-3 rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-3.5 text-left shadow-sm transition-colors hover:border-[var(--bk-console-blue)] hover:bg-[var(--bk-console-blue-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--bk-console-text)]">{starter.title}</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--bk-console-text-muted)]">{starter.detail}</span>
            </span>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--bk-console-text-subtle)] group-hover/card:text-[var(--bk-console-blue)]" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}
/**
 * The saved conversations, grouped by day. Shared by the desktop rail and the mobile disclosure so
 * there is one definition of what a history row looks like.
 */
function ConversationList({ conversations, conversationId, historyBusy, historyError, onSelect, now }: {
  conversations: AiAdsConversationSummary[];
  conversationId?: number;
  historyBusy: boolean;
  historyError: string;
  onSelect: (id: number) => void;
  now: number;
}) {
  if (historyError) return <p className="px-2 py-3 text-xs text-rose-600">{historyError}</p>;
  if (!conversations.length) {
    // A first load and a genuinely empty history look identical without this: "No past chats yet."
    // shown while the list is still being fetched is simply wrong.
    return historyBusy
      ? <ul className="space-y-1.5 p-1" aria-hidden="true">{[0, 1, 2].map(index => <li key={index} className="h-9 animate-pulse rounded-md bg-[var(--bk-console-border)]" />)}</ul>
      : <p className="px-2 py-3 text-xs text-[var(--bk-console-text-muted)]">No past chats yet.</p>;
  }
  return (
    <div className="space-y-3">
      {groupConversations(conversations, now).map(group => (
        <div key={group.label}>
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--bk-console-text-subtle)]">{group.label}</p>
          <ul className="space-y-0.5">
            {group.items.map(item => {
              const active = item.id === conversationId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(item.id)}
                    aria-current={active || undefined}
                    className={`w-full rounded-md border-l-2 px-2 py-2 text-left transition-colors ${active
                      ? 'border-[var(--bk-console-blue)] bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]'
                      : 'border-transparent text-[var(--bk-console-text)] hover:border-[var(--bk-console-border-strong)] hover:bg-[var(--bk-console-surface)]'}`}
                  >
                    <span className="block truncate text-sm font-medium">{conversationLabel(item)}</span>
                    <span className="mt-0.5 block text-[11px] text-[var(--bk-console-text-muted)]">{relativeTime(item.updated_at)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * The composer. It grows with the question up to a cap (`composerHeight`), because the fixed
 * two-row box turned a five-line question into a peephole the client had to scroll inside while
 * typing, and it states the two keys that are otherwise guesswork.
 */
function Composer({ value, setValue, busy, onSend }: {
  value: string;
  setValue: (value: string) => void;
  busy: boolean;
  onSend: (prompt?: string) => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = field.current;
    if (!node) return;
    // Measure from scratch: `scrollHeight` only shrinks back once the inline height is released.
    node.style.height = 'auto';
    node.style.height = `${composerHeight(node.scrollHeight)}px`;
  }, [value]);
  const canSend = Boolean(value.trim()) && !busy;
  return (
    <div className="border-t border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-3 sm:px-6 sm:py-4">
      <div className="flex items-end gap-2 rounded-2xl border border-[var(--bk-console-border-strong)] bg-[var(--bk-console-surface)] p-2 shadow-sm transition-colors focus-within:border-[var(--bk-console-blue)] focus-within:ring-2 focus-within:ring-[var(--bk-console-blue)]">
        <textarea
          ref={field}
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void onSend(); } }}
          rows={1}
          aria-label="Message the AI Ads assistant"
          placeholder="আপনার অ্যাড নিয়ে কিছু জিজ্ঞেস করুন"
          className="max-h-[168px] min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-[var(--bk-console-text)] outline-none placeholder:text-[var(--bk-console-text-subtle)]"
        />
        <Button variant="primary" onClick={() => void onSend()} disabled={!canSend} title="Send message" aria-label="Send message" className="h-11 w-11 shrink-0 px-0">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-2 px-1 text-[11px] leading-5 text-[var(--bk-console-text-subtle)]">
        Enter দিয়ে পাঠান · Shift + Enter দিয়ে নতুন লাইন · আপনার অনুমতি ছাড়া কোনো অ্যাড বদলানো হয় না
      </p>
    </div>
  );
}
export function ChatPanel({
  messages, streamingText, steps, value, setValue, busy, onSend, onConfirmPlan, onRejectPlan, planBusy,
  conversations, conversationId, historyBusy, historyError, onSelectConversation, onNewChat, onRefreshHistory,
  now = Date.now(),
}: ChatPanelProps) {
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  /** Whether the client is reading the newest message; see `shouldStickToBottom`. */
  const following = useRef(true);

  // Opening a saved conversation should land on its most recent turn, wherever the client had
  // scrolled to in the previous one.
  useEffect(() => { following.current = true; }, [conversationId]);

  useEffect(() => {
    const node = transcript.current;
    if (!node || !following.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, streamingText, steps.length, busy, conversationId]);

  const showHero = !conversationId && messages.length <= 1 && !streamingText && !busy && !steps.length;
  const active = conversations.find(item => item.id === conversationId);

  const openConversation = (id: number) => {
    setMobileHistoryOpen(false);
    onSelectConversation(id);
  };
  const startNewChat = () => {
    setMobileHistoryOpen(false);
    onNewChat();
  };

  return (
    // The panel is a fixed-height box, not a box that grows with the conversation. Without a bound
    // here the transcript's `overflow-y-auto` never engages: the panel gets taller with every turn,
    // the answer ends up below the fold, and the whole *page* has to be scrolled to read it — which
    // is the original defect. `min-h` keeps it usable on a short laptop, `max-h` stops a very tall
    // monitor from stretching one answer across the screen.
    <div className="flex h-[70vh] max-h-[840px] min-h-[560px] overflow-hidden rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] shadow-sm">
      {/* The rail sits inside the AI Ads panel region, so it never collides with the app's own
          global left sidebar. It is hidden below `sm`, where the header's History button opens the
          same list inline instead — before that, a phone had no way to reach saved chats at all. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)] sm:flex" aria-label="Chat history">
        <div className="flex items-center gap-2 border-b border-[var(--bk-console-border)] p-3">
          <button type="button" onClick={startNewChat} className="flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--bk-console-border-strong)] bg-[var(--bk-console-surface)] px-2 text-sm font-semibold text-[var(--bk-console-text)] shadow-sm transition-colors hover:border-[var(--bk-console-blue)] hover:text-[var(--bk-console-blue)]">
            <Plus className="h-4 w-4" />New chat
          </button>
          <button type="button" onClick={onRefreshHistory} title="Refresh history" aria-label="Refresh history" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--bk-console-border-strong)] bg-[var(--bk-console-surface)] text-[var(--bk-console-text-muted)] shadow-sm transition-colors hover:text-[var(--bk-console-text)]">
            <RefreshCw className={`h-4 w-4 ${historyBusy ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {/* `min-h-0`: a column flex child defaults to `min-height:auto`, which would size the list to
            its content and defeat the scroll. */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <ConversationList conversations={conversations} conversationId={conversationId} historyBusy={historyBusy} historyError={historyError} onSelect={openConversation} now={now} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--bk-console-bg)]">
        <header className="flex items-center gap-3 border-b border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] px-4 py-3 sm:px-6">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--bk-console-text)]">{ASSISTANT_NAME}</p>
            <p className="truncate text-xs text-[var(--bk-console-text-muted)]">{active ? conversationLabel(active) : 'New chat'}</p>
          </div>
          <div className="flex items-center gap-1.5 sm:hidden">
            <button type="button" onClick={() => setMobileHistoryOpen(open => !open)} aria-expanded={mobileHistoryOpen} aria-label="Past chats" className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--bk-console-border-strong)] bg-[var(--bk-console-surface)] text-[var(--bk-console-text-muted)]">
              <History className="h-4 w-4" />
            </button>
            <button type="button" onClick={startNewChat} aria-label="New chat" className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--bk-console-border-strong)] bg-[var(--bk-console-surface)] text-[var(--bk-console-text-muted)]">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Sits *outside* the transcript on purpose: inside it, the list opened at the very top of a
            scrolled-to-the-bottom conversation, so tapping History appeared to do nothing at all. Here
            it drops in directly under the button that opened it. */}
        {mobileHistoryOpen ? (
          <div className="max-h-64 overflow-y-auto border-b border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-2 sm:hidden">
            <ConversationList conversations={conversations} conversationId={conversationId} historyBusy={historyBusy} historyError={historyError} onSelect={openConversation} now={now} />
          </div>
        ) : null}

        <div ref={transcript} onScroll={() => { const node = transcript.current; if (node) following.current = shouldStickToBottom(node); }} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          {showHero
            ? <ChatHero onSend={onSend} disabled={busy} />
            : messages.map((message, index) => (
              <MessageRow key={message.id ?? `${message.role}-${index}`} message={message} onConfirmPlan={onConfirmPlan} onRejectPlan={onRejectPlan} planBusy={planBusy} />
            ))}
          {steps.length ? <ActivityTrail steps={steps} busy={busy} /> : null}
          {streamingText ? <StreamingRow text={streamingText} /> : null}
          {busy && !streamingText && !steps.length ? <ThinkingRow /> : null}
        </div>

        <Composer value={value} setValue={setValue} busy={busy} onSend={onSend} />
      </div>
    </div>
  );
}
/**
 * The composed plan inside an assistant answer, with the human-in-the-loop decision attached.
 * Moved here unchanged with the panel: confirming records the client's review and performs no
 * provider action, and the buttons only appear while the plan is still decidable.
 */
function ProposalSummaryCard({ proposal, onConfirm, onReject, busy }: { proposal: Record<string, unknown>; onConfirm: (id: string) => void; onReject: (id: string) => void; busy: string }) {
  const audience = proposal.audience as Record<string, any> | undefined;
  const geography = audience?.geography as Record<string, unknown> | undefined;
  const budget = proposal.budget as Record<string, any> | undefined;
  const daily = budget?.recommended_daily as Record<string, unknown> | undefined;
  const alternatives = Array.isArray(proposal.alternatives) ? proposal.alternatives as Array<Record<string, unknown>> : [];
  const id = String(proposal.proposal_id ?? '');
  const confirmBusy = busy === `plan-${id}`;
  const rejectBusy = busy === `reject-plan-${id}`;
  const anyBusy = confirmBusy || rejectBusy;
  const decidable = proposal.state === 'PROPOSAL_READY' && Boolean(id);
  return <div className="space-y-2 text-xs text-[var(--bk-console-text)]"><p className="font-semibold text-[var(--bk-console-text)]">Plan {String(proposal.version ?? '')} · {String(proposal.state ?? 'REVIEW')}</p><p>{String(proposal.summary ?? 'Review the recommended plan below.')}</p><p><span className="font-medium">Audience:</span> {String(geography?.value ?? 'Needs review')}</p><p><span className="font-medium">Budget:</span> {String(daily?.value ?? 'Needs review')}</p><p><span className="font-medium">Creative:</span> {String((proposal.creative as Record<string, unknown> | undefined)?.source ?? 'NONE')}</p>{alternatives.map(plan => <p key={String(plan.name)}><span className="font-medium">{String(plan.name)}:</span> {String(plan.style)} · {String(plan.risk)}</p>)}<p className="text-[var(--bk-console-text-muted)]">Confirming this plan records your review only. No provider action is performed.</p>{decidable ? <div className="flex flex-wrap gap-2 pt-1"><Button variant="primary" size="sm" onClick={() => onConfirm(id)} loading={confirmBusy} disabled={anyBusy}><Check className="h-4 w-4" />Confirm plan</Button><Button variant="danger" size="sm" onClick={() => onReject(id)} loading={rejectBusy} disabled={anyBusy}><X className="h-4 w-4" />Reject</Button></div> : null}</div>;
}
