import { apiFetch, describeResponseError } from '../lib/http';

export type AiAdsSection = 'overview' | 'accounts' | 'campaigns' | 'analytics' | 'creative' | 'history' | 'chat';

export interface AiAdsConnection {
  id: number;
  provider: 'meta' | 'tiktok';
  status: string;
  permission_status: string;
  token_status: string;
  scopes: string[];
  accounts: Array<{
    external_account_id: string;
    account_name?: string;
    status?: string | number;
    currency?: string;
    timezone?: string;
  }>;
}

export interface AiAdsProposal {
  id: number;
  account_id: number;
  operation: string;
  risk: string;
  /**
   * The current provider-side state, returned by the API (`_proposal_json`, ai_ads.py:110) but
   * previously dropped by the UI. The before→after table diffs this against `requested_state`.
   * `exact_changes` is NOT that diff — it is `{ operation, arguments }` — so `before_state` is
   * the only source for the "before" column.
   */
  before_state?: Record<string, unknown> | null;
  requested_state: Record<string, unknown>;
  exact_changes: Record<string, unknown>;
  policy_decision: { allowed?: boolean; reasons?: string[] };
  proposal_hash: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface PerformanceSnapshot {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  cpa: number;
  revenue: number;
  roas: number;
  conversion_rate: number;
  aov: number;
  attribution_quality: number;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  structured?: Record<string, unknown> | null;
  /**
   * When this turn happened. A stored message carries the server's `created_at`; one sent in this
   * session is stamped by the browser. Absent on the opening greeting, which is not a real message —
   * the chat prints no time rather than inventing one.
   */
  created_at?: string;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = describeResponseError(response);
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return await response.json() as T;
}

export const fetchAiAdsOverview = () => apiFetch('/api/ai-ads/overview').then(response => json<{
  performance: PerformanceSnapshot;
  proposals: AiAdsProposal[];
  actions: Array<{ id: number; operation: string; provider: string; status: string; created_at: string }>;
  writes_enabled: boolean;
}>(response));

export const fetchAiAdsConnections = () => apiFetch('/api/v1/ai-ads/connections').then(response => json<AiAdsConnection[]>(response));

export const requestAiAdsEmailStepUp = () => apiFetch('/api/ai-ads/step-up/email/start', { method: 'POST' }).then(response => json<{ status: string; expires_in: number; email_masked: string }>(response));

export const verifyAiAdsEmailStepUp = (code: string) => apiFetch('/api/ai-ads/step-up/email/verify', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
}).then(response => json<{ step_up_grant: string; challenge_id: number; scope: string; expires_in: number }>(response));

export const beginAiAdsOAuth = (provider: 'meta' | 'tiktok', stepUp?: { grant: string; challengeId: number }) => apiFetch(`/api/v1/ai-ads/oauth/${provider}/start`, {
  method: 'POST', headers: stepUp ? { 'X-Client-Step-Up': stepUp.grant, 'X-Client-Step-Up-Id': String(stepUp.challengeId) } : undefined,
}).then(response => json<{ authorization_url: string }>(response));

export const selectAiAdsAccount = (connectionId: number, externalAccountId: string, stepUp?: { grant: string; challengeId: number }) => apiFetch('/api/v1/ai-ads/connections/select-account', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(stepUp ? { 'X-Client-Step-Up': stepUp.grant, 'X-Client-Step-Up-Id': String(stepUp.challengeId) } : {}) },
  body: JSON.stringify({ connection_id: connectionId, external_account_id: externalAccountId }),
}).then(response => json(response));

/**
 * What the server actually did when a provider connection was disconnected.
 *
 * `ad_oauth.py:112` has always returned this, but the UI discarded it, so a merchant was told
 * only "Connection disconnected." while the server had additionally deactivated their ad
 * accounts, cancelled queued actions and voided pending proposals. Typing it lets the toast
 * report the real consequences instead of implying a single token was removed.
 */
export interface AiAdsDisconnectResult {
  status: string;
  /** True when the connection was already disconnected, so nothing further was revoked. */
  repeated: boolean;
  deactivated_accounts: number;
  invalidated_actions: number;
  provider_revoke: { supported: boolean; succeeded: boolean; result_code: string | null };
}

export const disconnectAiAdsConnection = (connectionId: number, stepUp?: { grant: string; challengeId: number }) => apiFetch(`/api/v1/ai-ads/connections/${connectionId}`, {
  method: 'DELETE', headers: stepUp ? { 'X-Client-Step-Up': stepUp.grant, 'X-Client-Step-Up-Id': String(stepUp.challengeId) } : undefined,
}).then(response => json<AiAdsDisconnectResult>(response));

export const fetchAiAdsCampaigns = () => apiFetch('/api/v1/ad-campaigns').then(response => json<Array<{ id: number; platform: string; external_campaign_id: string; name: string; status?: string; account_name?: string }>>(response));

export const fetchAiAdsPerformance = (days = 7) => apiFetch(`/api/ai-ads/performance?days=${days}`).then(response => json<PerformanceSnapshot>(response));

/**
 * The live analytics payload, read from the ad platform at request time.
 *
 * `PerformanceSnapshot` above takes spend from our synced insight rows but purchases,
 * revenue, ROAS and attribution from our own `event_logs`. A store that sends us no
 * events therefore renders as "spend 32.43 and everything else zero", which reads as a
 * dead ad account rather than as a missing pixel. This payload keeps the platform's own
 * report, our tracking and the confirmed order ledger as three separate blocks — they
 * are never merged into one KPI — and adds one row per ad, because the account average
 * is the one number a merchant cannot act on.
 *
 * The two halves fall back independently: `source` covers the account read
 * (`PROVIDER_LIVE` | `STORED_FALLBACK` | `NO_ACCOUNT`) and `ads.source` covers the per-ad
 * read (`PROVIDER_LIVE` | `UNAVAILABLE` | `NOT_REQUESTED` | `NO_ACCOUNT`), so one may
 * never be shown under the other's label.
 */
export interface LiveTotals {
  source?: string;
  currency?: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  ctr_percent: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  /** `today_so_far` only: the day being reported, and that the platform still restates it. */
  date?: string;
  note?: string;
}

export interface LiveOurTracking {
  source?: string;
  purchases: number;
  distinct_orders: number;
  revenue: number;
  currency?: string | null;
  aov: number;
}

export interface LiveStoreOrders {
  source?: string;
  attributed_orders: number;
  completed: number;
  still_open: number;
  cancelled_or_refunded: number;
  other: number;
  completed_revenue: number;
  currency?: string | null;
  by_status?: Record<string, number>;
  not_found_in_store_ledger?: number;
}

export interface LiveReconciliation {
  platform_purchases: number;
  our_purchases: number;
  purchase_delta: number;
  agreement: string;
  platform_cpa: number;
  our_cpa: number;
  confirmed_cpa: number;
  platform_roas: number;
  our_roas: number;
  confirmed_roas: number;
  confirmed_orders: number;
  confirmed_revenue: number;
  explanation?: string[];
  how_to_present?: string;
  campaigns_total?: number;
  campaigns_delivering?: number;
  /** Present only when the provider would not give us delivery status at all. */
  campaign_status_note?: string;
}

export interface LiveCampaignRow {
  campaign_id: string;
  campaign_name: string;
  status?: string;
  effective_status?: string | null;
  /** Derived by the backend as `effective_status === 'ACTIVE'`; null when unreadable. */
  delivering?: boolean | null;
  objective?: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  ctr_percent: number;
  cpc: number;
  cpa: number;
  roas: number;
  currency?: string | null;
}

export interface LiveAdRow {
  /** 1-based rank by spend. It travels with the row because ad names repeat. */
  index: number;
  ad_id: string;
  ad_name: string;
  campaign_name?: string;
  adset_name?: string;
  status?: string;
  effective_status?: string | null;
  delivering?: boolean;
  has_results?: boolean;
  /** The platform billed this id but would not tell us which ad it is. */
  structure_missing?: boolean;
  spend: number;
  impressions: number;
  clicks: number;
  link_clicks: number;
  ctr_percent: number;
  cpc: number;
  purchases: number;
  revenue: number;
  cpa: number | null;
  roas: number | null;
  creative_media_type?: string | null;
}

export interface LiveAdsBlock {
  source: string;
  rows: LiveAdRow[];
  totals: {
    entity_count?: number;
    delivering_count?: number;
    spending_count?: number;
    converting_count?: number;
    spend?: number;
    impressions?: number;
    clicks?: number;
    link_clicks?: number;
    purchases?: number;
    revenue?: number;
    cpa?: number | null;
    roas?: number | null;
    spend_without_purchase?: number;
    spending_without_purchase_count?: number;
  };
  duplicate_names: string[];
  data_notice: string | null;
}

export interface AiAdsLiveAnalytics {
  account: {
    ad_account_id: number;
    platform: string;
    account_name?: string | null;
    /** Only the masked form is ever sent; the raw external id stays on the server. */
    masked_account_id?: string | null;
    currency?: string | null;
    timezone?: string | null;
  } | null;
  period: { days: number; since: string | null; until: string | null };
  fetched_at?: string;
  source: string;
  data_notice: string | null;
  platform: LiveTotals | null;
  today_so_far?: LiveTotals | null;
  our_tracking: LiveOurTracking | null;
  store_orders: LiveStoreOrders | null;
  reconciliation: LiveReconciliation | null;
  campaigns: LiveCampaignRow[];
  ads: LiveAdsBlock;
}

/**
 * `accountId` is our own `AdAccount.id` — the id the `/api/v1/ad-accounts` list carries and the one
 * the payload reports back as `account.ad_account_id`, not the platform's external id.
 *
 * Omitting it is a real choice, not a missing argument: the backend then picks the account itself
 * (an account with recorded campaigns first, most recently synced as the tie-break,
 * `_default_analytics_account`). That default is what a merchant with one linked account should keep
 * getting, so it stays the behaviour until they pick an account. Sending one is what makes several
 * linked accounts readable at all: without it the merchant could not move Analytics off the
 * account the server ranked first. An account the caller does not hold is a 404, not a silent
 * fallback to somebody else's numbers.
 *
 * `includeAds` is the page's speed control. The per-ad ranking costs the backend two extra Graph
 * round trips — an ad listing and an ad-insights read — and those are the bulk of the wait: measured
 * in production for a real account, the same call is 6.0–7.1 s with them and 1.31 s without. Only the
 * Analytics tab renders that ranking, so every other caller asks for `false` and gets the account
 * half alone. The default stays `true` because the omitted param is what the backend already
 * defaults to, so an existing caller's URL does not change.
 *
 * A payload read with `false` reports `ads.source: "NOT_REQUESTED"` — see `hasLiveAdBreakdown` in
 * `components/aiAds/liveAnalytics.ts`. It must never be rendered as the ad ranking, which would tell
 * the merchant their breakdown "could not be read" when nobody asked for it.
 */
export const fetchAiAdsLiveAnalytics = (days = 7, accountId?: number | null, includeAds = true) => {
  const account = typeof accountId === 'number' && Number.isFinite(accountId) ? `&account_id=${accountId}` : '';
  const ads = includeAds ? '' : '&include_ads=false';
  return apiFetch(`/api/ai-ads/performance/live?days=${days}${account}${ads}`).then(response => json<AiAdsLiveAnalytics>(response));
};

/**
 * Blocking fallback for `streamAiAdsChat`. The timeout matches the backend's own turn budget
 * (`AI_ADS_TURN_DEADLINE_SECONDS`, default 90) instead of the old 60 s: now that a turn can
 * legitimately run several tool rounds, giving up at 60 s threw away answers the server was
 * still about to return. The streaming route remains the primary path, and it shows the
 * activity trail, so a long wait there is at least a visible one.
 */
export const sendAiAdsChat = (message: string, conversationId?: number) => apiFetch('/api/ai-ads/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, conversation_id: conversationId }),
  timeoutMs: 90_000,
}).then(response => json<{ conversation_id: number; message: string; structured?: Record<string, unknown> | null }>(response));

export interface AiAdsConversationSummary {
  id: number;
  title: string | null;
  status: string;
  summary: string | null;
  updated_at: string;
}

export interface AiAdsStoredMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  structured: Record<string, unknown> | null;
  created_at: string;
}

/** The `done` frame mirrors the blocking `/api/ai-ads/chat` response, with a discriminant `type`. */
export type AiAdsStreamFrame =
  | { type: 'delta'; text: string }
  | { type: 'step'; label: string; status: string }
  | { type: 'done'; conversation_id: number; message: string; structured: Record<string, unknown> | null; usage?: Record<string, unknown> }
  | { type: 'error'; detail: string };

const toStreamFrame = (value: unknown): AiAdsStreamFrame | null => {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.type === 'delta' && typeof record.text === 'string') {
    return { type: 'delta', text: record.text };
  }
  // One `step` per tool the agent actually ran. The backend already phrases these for the
  // client, with no tool name or account id in them, so the label is rendered as-is.
  if (record.type === 'step' && typeof record.label === 'string') {
    return { type: 'step', label: record.label, status: typeof record.status === 'string' ? record.status : 'completed' };
  }
  if (record.type === 'done') {
    return {
      type: 'done',
      conversation_id: Number(record.conversation_id),
      message: typeof record.message === 'string' ? record.message : '',
      structured: (record.structured as Record<string, unknown> | null | undefined) ?? null,
      usage: (record.usage as Record<string, unknown> | undefined) ?? undefined,
    };
  }
  if (record.type === 'error') {
    return { type: 'error', detail: typeof record.detail === 'string' ? record.detail : 'The assistant could not respond.' };
  }
  return null;
};

/**
 * Parse a growing buffer of raw SSE text into complete frames plus the not-yet-complete
 * remainder. This is the single fragile piece of the streaming client, so it is a pure,
 * unit-tested function: the network read loop only accumulates bytes and calls this.
 *
 * SSE events are separated by a blank line; each carries one or more `data:` lines (joined
 * with `\n`). Comment lines (`:` — the framework's `: ping` keepalive) and blank lines are
 * ignored. A `data` payload that is not valid JSON, or whose `type` is unknown, is dropped
 * rather than throwing, so a stray keepalive or partial line never breaks the turn. `rest`
 * is the trailing partial event to prepend to the next decoded chunk.
 */
export function parseSseFrames(buffer: string): { frames: AiAdsStreamFrame[]; rest: string } {
  const frames: AiAdsStreamFrame[] = [];
  let rest = buffer.replace(/\r\n/g, '\n');
  let boundary = rest.indexOf('\n\n');
  while (boundary !== -1) {
    const rawEvent = rest.slice(0, boundary);
    rest = rest.slice(boundary + 2);
    const dataLines: string[] = [];
    for (const line of rawEvent.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
    }
    if (dataLines.length) {
      try {
        const frame = toStreamFrame(JSON.parse(dataLines.join('\n')));
        if (frame) frames.push(frame);
      } catch {
        // A malformed data payload is skipped, not fatal to the rest of the stream.
      }
    }
    boundary = rest.indexOf('\n\n');
  }
  return { frames, rest };
}

/**
 * Open the streaming twin of `sendAiAdsChat`. Returns the raw `Response` so the caller can
 * read `response.body.getReader()` and feed the bytes through `parseSseFrames`. `timeoutMs: 0`
 * disables the shared abort timer (a chat stream is deliberately long-lived); the caller's
 * `signal` still aborts it (e.g. on unmount). Auth/CSRF still apply via the global fetch wrapper.
 * The caller falls back to `sendAiAdsChat` when the response has no readable body.
 */
export const streamAiAdsChat = (message: string, conversationId?: number, signal?: AbortSignal) =>
  apiFetch('/api/ai-ads/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversation_id: conversationId }),
    timeoutMs: 0,
    signal,
  });

export const fetchAiAdsConversations = () =>
  apiFetch('/api/ai-ads/conversations').then(response => json<AiAdsConversationSummary[]>(response));

export const fetchAiAdsConversationMessages = (conversationId: number) =>
  apiFetch(`/api/ai-ads/conversations/${conversationId}/messages`).then(response => json<AiAdsStoredMessage[]>(response));

export type CreativeAnalysisStatus = 'ANALYZING' | 'ANALYSIS_READY' | 'NEEDS_REVIEW' | 'ANALYSIS_LIMITED' | 'FAILED';

export const analyzeAiAdsCreative = (assetId: number, context: Record<string, unknown> = {}) => apiFetch(`/api/ai-ads/creatives/assets/${assetId}/analyze-semantic`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ context }),
}).then(response => json<{ id: number; asset_id: number; status: string; analysis: Record<string, unknown>; recommendations: string[] }>(response));

export const generateAiAdsCreativePrompt = (kind: 'image' | 'video', context: Record<string, unknown> = {}) => apiFetch(`/api/ai-ads/creatives/prompt/${kind}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ context }),
}).then(response => json<Record<string, unknown>>(response));

export type ComposedAiAdsProposal = {
  proposal_id: string;
  version: number;
  state: string;
  summary: string;
  business: Record<string, unknown>;
  objective: Record<string, unknown>;
  platform: Record<string, unknown>;
  audience: Record<string, unknown>;
  budget: Record<string, unknown>;
  creative: Record<string, unknown>;
  copy: Record<string, unknown>;
  risks_unknowns: Record<string, unknown>;
  proposal_hash: string;
  read_only: boolean;
  provider_write: boolean;
};

export const composeAiAdsProposal = (conversationId: number, facts: Record<string, unknown> = {}, confirmed: string[] = []) => apiFetch('/api/ai-ads/composed-proposals', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversation_id: conversationId, facts, confirmed }),
}).then(response => json<ComposedAiAdsProposal>(response));

export const confirmAiAdsPlan = (proposal: ComposedAiAdsProposal) => apiFetch('/api/ai-ads/composed-proposals/confirm', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposal }),
}).then(response => json<ComposedAiAdsProposal>(response));

export const confirmPersistedAiAdsPlan = (proposalId: string) => apiFetch(`/api/ai-ads/composed-proposals/${proposalId}/confirm`, {
  method: 'POST',
}).then(response => json<ComposedAiAdsProposal>(response));

export const approveAiAdsProposal = (proposal: AiAdsProposal) => apiFetch(`/api/ai-ads/proposals/${proposal.id}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ proposal_hash: proposal.proposal_hash }),
}).then(response => json<{ approval_id: number }>(response));

/**
 * Queue an approved proposal for the worker. `QueueRequest` requires a `step_up_grant`
 * (min length 20), so the previous single-argument call was a guaranteed 422 if it ever ran.
 *
 * SECURITY BOUNDARY — do not "fix" by loosening scope: the worker path (`enqueue_approved_action`)
 * validates the grant with scope `PROVIDER_WRITE`, while the client email step-up only ever issues
 * `CREDENTIAL_CHANGE`. A client therefore cannot self-authorise execution; this last step is
 * operator-completed by design. This wrapper only forwards whatever grant it is handed so the call
 * matches the contract — it does not, and must not, grant the missing scope.
 */
export const queueAiAdsProposal = (proposalId: number, approvalId: number, stepUpGrant?: string) => apiFetch(`/api/ai-ads/proposals/${proposalId}/queue`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ approval_id: approvalId, step_up_grant: stepUpGrant }),
}).then(response => json<{ action_id: number; status: string }>(response));

/**
 * Reject a composed plan — the "no" half of human-in-the-loop that the chat card was missing.
 * Marks the plan `USER_REJECTED` (ai_ads.py:246); no provider action is performed either way.
 */
export const rejectAiAdsPlan = (proposalId: string) => apiFetch(`/api/ai-ads/composed-proposals/${proposalId}/reject`, {
  method: 'POST',
}).then(response => json<ComposedAiAdsProposal>(response));

export interface AiAdsActionRow {
  id: number;
  proposal_id: number | null;
  account_id: number | null;
  provider: string;
  operation: string;
  status: string;
  result: Record<string, unknown> | null;
  error_code: string | null;
  created_at: string;
}

/** Full proposal history (100 most recent), for the History tab. */
export const fetchAiAdsProposals = () =>
  apiFetch('/api/ai-ads/proposals').then(response => json<AiAdsProposal[]>(response));

/** Full action history (100 most recent), for the History tab. */
export const fetchAiAdsActions = () =>
  apiFetch('/api/ai-ads/actions').then(response => json<AiAdsActionRow[]>(response));

export interface AiAdsAdAccount {
  id: number;
  platform: string;
  external_account_id: string;
  account_name?: string | null;
  account_currency: string;
  is_active: boolean;
  last_synced_at?: string | null;
}

/**
 * The connected ad accounts with their `last_synced_at`, used only to annotate the Accounts tab
 * with "Last synced …". Syncing itself already lives in Settings → Connected accounts and is not
 * rebuilt here.
 */
export const fetchAdAccountsForAiAds = () =>
  apiFetch('/api/v1/ad-accounts').then(response => json<AiAdsAdAccount[]>(response));

export interface CreativeUploadResult {
  id: number;
  media_type: string;
  byte_size: number;
  content_hash: string;
  conversation_id: number | null;
  analysis: Record<string, unknown>;
}

/**
 * Upload a creative for validation + inline metadata analysis.
 *
 * `Content-Type` is intentionally NOT set: the browser must add the `multipart/form-data`
 * boundary itself, and `apiFetch` forwards headers unchanged, so setting it here would corrupt
 * the body. The timeout is raised well above the 15 s default because a 25 MB upload on a slow
 * connection legitimately takes longer than a JSON call.
 */
export const uploadAiAdsCreative = (file: File, conversationId?: number) => {
  const form = new FormData();
  form.append('file', file);
  const headers: Record<string, string> = { 'X-Creative-Source': 'USER_PROVIDED' };
  if (conversationId !== undefined) headers['X-AI-Conversation-Id'] = String(conversationId);
  return apiFetch('/api/ai-ads/creatives', {
    method: 'POST',
    headers,
    body: form,
    timeoutMs: 120_000,
  }).then(response => json<CreativeUploadResult>(response));
};
