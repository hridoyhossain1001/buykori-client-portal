/**
 * The pure half of the Chat Now redesign: everything the chat needs to decide *before* it draws
 * anything. Kept out of the component so it can be unit-tested directly — the AI Ads page sits
 * behind the `aiAdsEnabled` gate the local demo never sets, so a component is the hardest place in
 * this app to verify and a plain function is the easiest.
 *
 * Nothing here reads the network, the DOM, or module-level time: every function that needs "now"
 * takes it as an argument, so a test never depends on the clock it runs at.
 */

/**
 * One opening suggestion. `prompt` is the text actually sent to the assistant and is deliberately
 * unchanged from the four pills this replaced — the redesign is presentation, not a change to what
 * the assistant is asked. `title` is the short label on the card and `detail` says, in the client's
 * own language, what the assistant will go and read.
 */
export type ChatStarter = { title: string; prompt: string; detail: string };

/**
 * Each starter maps to a capability the assistant actually has: the performance snapshot, the
 * read-only live-ad status check, plan composition, and an explanation of measured results. A
 * starter that promised something the assistant cannot do would be worse than no starter at all.
 */
export const CHAT_STARTERS: ChatStarter[] = [
  {
    title: 'গত ৭ দিনের পারফরম্যান্স',
    prompt: 'গত ৭ দিনের পারফরম্যান্স দেখাও',
    detail: 'খরচ, রেজাল্ট আর ROAS — অ্যাড প্ল্যাটফর্ম থেকে সরাসরি',
  },
  {
    title: 'অ্যাড আসলে চালু আছে কি',
    prompt: 'আমার লাইভ অ্যাড চালু আছে কিনা দেখো',
    detail: 'কোন অ্যাড ডেলিভারি দিচ্ছে আর কোনটা বন্ধ, প্রতিটি আলাদা করে',
  },
  {
    title: 'নতুন ক্যাম্পেইন প্ল্যান',
    prompt: 'আমার সেরা প্রোডাক্টের জন্য একটা ক্যাম্পেইন প্ল্যান করো',
    detail: 'রিভিউ করার জন্য একটা প্ল্যান — আপনার অনুমতি ছাড়া কিছু চালু হবে না',
  },
  {
    title: 'ROAS কম কেন',
    prompt: 'আমার ROAS কম কেন, ব্যাখ্যা করো',
    detail: 'কোন ধাপে টাকা নষ্ট হচ্ছে, সংখ্যা ধরে ধরে',
  },
];

/** What a conversation is called in the history rail when nothing usable was stored. */
export const UNTITLED_CONVERSATION = 'AI Ads conversation';

/** The shape the rail needs from a conversation; anything wider is accepted and passed through. */
export type RailConversation = { id: number; title?: string | null; summary?: string | null; updated_at: string };

/**
 * The label for one history row. The stored title is the client's own first question (derived by
 * the backend's `conversation_title.py`), so it is preferred over the model-written summary.
 */
export function conversationLabel(item: { title?: string | null; summary?: string | null }): string {
  return item.title?.trim() || item.summary?.trim() || UNTITLED_CONVERSATION;
}

export type ConversationGroup<T> = { label: string; items: T[] };

/** Fixed order, so the rail never reshuffles its headings between renders. */
const GROUP_ORDER = ['Today', 'Yesterday', 'Previous 7 days', 'Older'] as const;

const DAY_MS = 86_400_000;

function startOfLocalDay(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Which heading a conversation belongs under, by *calendar* day rather than by elapsed hours —
 * something written at 11pm last night is "Yesterday" this morning, not "20 hrs ago" filed under
 * today. Day boundaries are rounded because a DST day is 23 or 25 hours long.
 *
 * An unparseable timestamp falls to "Older" instead of being dropped: a row the client can still
 * open is better than a row that silently disappears from their history.
 */
function groupLabel(timestamp: string, now: number): string {
  const parsed = new Date(timestamp).getTime();
  if (!Number.isFinite(parsed)) return 'Older';
  const days = Math.round((startOfLocalDay(now) - startOfLocalDay(parsed)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7) return 'Previous 7 days';
  return 'Older';
}

/**
 * Bucket the history rail by date, keeping the server's own ordering inside each bucket.
 *
 * The rail was one flat list of up to fifty rows, so "the chat I had on Tuesday" could only be
 * found by reading every title. Grouping is presentation only: no row is filtered out, and the
 * groups concatenate back to the input order because the input arrives newest-first.
 */
export function groupConversations<T extends { updated_at: string }>(items: T[], now: number): ConversationGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const label = groupLabel(item.updated_at, now);
    const bucket = buckets.get(label);
    if (bucket) bucket.push(item);
    else buckets.set(label, [item]);
  }
  return GROUP_ORDER.filter(label => buckets.has(label)).map(label => ({ label, items: buckets.get(label) as T[] }));
}

/**
 * The clock time shown beside a message, or `''` when there is nothing trustworthy to show.
 *
 * Messages sent in this session are stamped by the browser and stored ones carry the server's
 * `created_at`, so both are real times; a missing or unparseable value prints nothing rather than
 * "Invalid Date" or a fabricated stamp.
 */
export function messageClock(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** How close to the bottom still counts as "reading the newest message", in CSS pixels. */
export const STICK_THRESHOLD_PX = 120;

/**
 * Whether the transcript should follow new content down.
 *
 * The old panel never scrolled at all, so a streamed answer grew below the fold and the client sat
 * looking at a motionless screen. Following unconditionally is the opposite mistake: it yanks the
 * view away from someone who has scrolled up to re-read an earlier answer. So the decision is made
 * from where they already are — near the bottom means follow, anywhere else means leave them alone.
 */
export function shouldStickToBottom(
  viewport: { scrollTop: number; scrollHeight: number; clientHeight: number },
  threshold: number = STICK_THRESHOLD_PX,
): boolean {
  const distance = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
  // A viewport that has not been laid out yet reports zeros; a fresh chat should follow.
  if (!Number.isFinite(distance)) return true;
  return distance <= threshold;
}

/**
 * The height an auto-growing composer should take for its current content, in CSS pixels.
 *
 * A fixed two-row box turned a five-line question into a three-line peephole the client had to
 * scroll inside while typing. Growth stops at `max` so the composer can never push the transcript
 * off the screen; past that the textarea scrolls, which is the lesser problem.
 */
export function composerHeight(scrollHeight: number, min: number = 48, max: number = 168): number {
  if (!Number.isFinite(scrollHeight)) return min;
  return Math.min(max, Math.max(min, Math.ceil(scrollHeight)));
}
