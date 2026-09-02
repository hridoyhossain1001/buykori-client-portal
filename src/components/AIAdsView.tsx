import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  ChevronRight,
  CircleDollarSign,
  History,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageSquare,
  Plug,
  RefreshCw,
  ShieldCheck,
  Target,
  Unplug,
} from 'lucide-react';
import { Button } from './common/Button';
import { Badge } from './common/Badge';
import { ConfirmDialog } from './common/ConfirmDialog';
import { EmptyState } from './common/EmptyState';
import { ErrorState } from './common/ErrorState';
import { Input } from './common/Input';
import { Modal } from './common/Modal';
import { PageHeader } from './common/PageHeader';
import { useIsWide } from '../lib/useIsWide';
import { SkeletonCards, SkeletonTable } from './common/Skeleton';
import { StatCard } from './common/StatCard';
import { Select } from './common/Select';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from './common/Table';
import { PlatformLogo, platformDisplayName } from './common/PlatformLogo';
import { CreativePanel } from './aiAds/CreativePanel';
import { HistoryPanel } from './aiAds/HistoryPanel';
import { ChatPanel } from './aiAds/chat/ChatPanel';
import type { ActivityStep } from './aiAds/chat/ChatPanel';
import { ProposalReviewCard } from './aiAds/ProposalReviewCard';
import { describeOperation, statusTone } from './aiAds/proposalReview';
import { PerformanceFunnelChart } from './aiAds/PerformanceFunnelChart';
import { LiveAnalyticsPanel } from './aiAds/LiveAnalyticsPanel';
import { LiveCampaignsPanel } from './aiAds/LiveCampaignsPanel';
import { formatCount, formatMoney, formatPercent, formatRoas, isEmptySnapshot } from './aiAds/aiAdsMetrics';
import { campaignTableRows, describeSource, hasLiveAdBreakdown, isEmptyLive, liveFunnelSnapshot } from './aiAds/liveAnalytics';
import { accountLinkState, analyticsAccountChoices, analyticsPickerState, connectionIsLive, providerCardState } from './aiAds/connectionState';
import type { AnalyticsAccountChoice } from './aiAds/connectionState';
import { relativeTime } from './eventLogs/eventLogUtils';
import { describeFetchError } from '../lib/http';
import {
  approveAiAdsProposal,
  beginAiAdsOAuth,
  requestAiAdsEmailStepUp,
  verifyAiAdsEmailStepUp,
  disconnectAiAdsConnection,
  fetchAdAccountsForAiAds,
  fetchAiAdsCampaigns,
  fetchAiAdsConnections,
  fetchAiAdsConversationMessages,
  fetchAiAdsConversations,
  fetchAiAdsOverview,
  fetchAiAdsPerformance,
  fetchAiAdsLiveAnalytics,
  parseSseFrames,
  queueAiAdsProposal,
  rejectAiAdsPlan,
  selectAiAdsAccount,
  sendAiAdsChat,
  streamAiAdsChat,
  confirmPersistedAiAdsPlan,
  type AiAdsAdAccount,
  type AiAdsConnection,
  type AiAdsConversationSummary,
  type AiAdsDisconnectResult,
  type AiAdsLiveAnalytics,
  type AiAdsProposal,
  type AiAdsSection,
  type AiAdsStreamFrame,
  type ChatMessage,
  type PerformanceSnapshot,
} from '../services/aiAdsApi';

/**
 * Re-exported from the pure module so the confirm gate has a single definition shared by this view
 * and `ProposalReviewCard`, while `AIAdsView.test.tsx` keeps importing it from here unchanged.
 */
export { proposalCanBeConfirmed } from './aiAds/proposalReview';

/**
 * Chat Now moved into `aiAds/chat/` when it was redesigned; the trail and its type are re-exported
 * here so `AIAdsView.test.tsx` keeps importing them from this module unchanged.
 */
export { ActivityTrail } from './aiAds/chat/ChatPanel';
export type { ActivityStep } from './aiAds/chat/ChatPanel';

/* `shortLabel` is what the phone shows. Seven full labels are 879px of strip in
   a 288px box, and Tabs.tsx already records why that is not a phone layout: a
   merchant reads the strip as ending at whatever tab the edge cuts off. The
   short forms wrap onto two rows with every tab on screen. */
const tabs: Array<{ id: AiAdsSection; label: string; shortLabel: string; icon: typeof Bot }> = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: Activity },
  { id: 'accounts', label: 'Connected Accounts', shortLabel: 'Accounts', icon: Link2 },
  { id: 'campaigns', label: 'Campaigns', shortLabel: 'Campaigns', icon: Target },
  { id: 'analytics', label: 'Analytics', shortLabel: 'Analytics', icon: BarChart3 },
  { id: 'creative', label: 'Creative', shortLabel: 'Creative', icon: ImageIcon },
  { id: 'history', label: 'History', shortLabel: 'History', icon: History },
  { id: 'chat', label: 'Chat Now', shortLabel: 'Chat', icon: MessageSquare },
];

const sectionFromRoute = (value?: string | null): AiAdsSection => {
  const section = value?.replace('ai-ads-', '') as AiAdsSection;
  return tabs.some(tab => tab.id === section) ? section : 'overview';
};

const CHAT_GREETING: ChatMessage = { role: 'assistant', content: 'What would you like to review or plan for your ads?' };

/** Windows offered by the Analytics selector, matching the dashboard's own timeframe control. */
const ANALYTICS_WINDOWS = [7, 14, 30, 90] as const;

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '');
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * An id too short to mask cannot be masked by showing its last four characters — `***` in front of
 * the whole value would print the thing the mask exists to hide — so a short, absent, or non-string
 * id reports itself as unavailable instead of being half-shown.
 */
export function maskTail(value: unknown): string {
  const text = asText(value);
  return text.length >= 4 ? `***${text.slice(-4)}` : 'ID unavailable';
}

export type AiAdsCampaignRow = { key: string; name: string; platform: string; maskedId: string; accountName: string; status: string };

/** The four things the emailed one-time code can be gating. */
export type StepUpAction = 'connect' | 'select' | 'disconnect' | 'confirm';

/**
 * Wording for the one-time-code dialog, chosen by the action it gates.
 *
 * All four actions used to open a dialog headed "Verify this ads connection" with the same body, so
 * a merchant who had clicked Disconnect read wording about connecting and was never told what the
 * code was about to authorise. The code itself is the same mechanism in every case; only what it
 * unlocks differs, and that is exactly what has to be on screen before it is typed.
 */
export function stepUpCopy(action: StepUpAction): { title: string; description: string; cta: string } {
  switch (action) {
    case 'connect':
      return {
        title: 'Verify before connecting',
        description: 'Enter the code sent to your account email to open the ad platform sign-in.',
        cta: 'Continue',
      };
    case 'select':
      return {
        title: 'Verify this ad account',
        description: 'Enter the code sent to your account email to let the assistant read this ad account.',
        cta: 'Continue',
      };
    case 'disconnect':
      return {
        title: 'Confirm disconnect with a code',
        description: 'Enter the code sent to your account email. The connection is removed as soon as the code is accepted.',
        cta: 'Disconnect',
      };
    case 'confirm':
      return {
        title: 'Verify before approving',
        description: 'Enter the code sent to your account email to approve this exact plan for review.',
        cta: 'Approve',
      };
  }
}

/**
 * Re-exported so callers and tests that already import it from this module keep working. The
 * derivation itself moved to `aiAds/connectionState`, which now owns every "what state is this
 * connection in" question — the provider card's wording and each ad account's linked state included.
 */
export { connectionIsLive } from './aiAds/connectionState';

/**
 * Turn the server's disconnect report into one plain sentence.
 *
 * `DELETE /ai-ads/connections/{id}` returns how many ad accounts were deactivated, how many queued
 * actions were cancelled, and whether the provider-side revoke succeeded (`app/routers/ad_oauth.py`).
 * The UI discarded all of it and said only "Connection disconnected.", which understated a change
 * that had also stopped syncing and cancelled queued work. `repeated` means the connection was
 * already disconnected, so nothing further was revoked and claiming otherwise would be false.
 */
export function describeDisconnectResult(result: AiAdsDisconnectResult): string {
  if (result.repeated) return 'That connection was already disconnected. Nothing further was revoked.';
  const accounts = Number(result.deactivated_accounts) || 0;
  const actions = Number(result.invalidated_actions) || 0;
  const parts: string[] = [];
  if (accounts > 0) parts.push(`${accounts} ad account${accounts === 1 ? '' : 's'} stopped syncing`);
  if (actions > 0) parts.push(`${actions} queued action${actions === 1 ? '' : 's'} cancelled`);
  const detail = parts.length ? ` ${parts.join(' and ')}.` : '';
  // A provider that supports revoking but did not confirm it leaves the access alive on its side,
  // so the merchant is told to finish the job there instead of being shown a clean success.
  const revokeIncomplete = result.provider_revoke?.supported === true && result.provider_revoke.succeeded !== true;
  return revokeIncomplete
    ? `Connection removed here.${detail} The ad platform did not confirm the revoke, so also remove Buykori in your ad platform's app settings.`
    : `Connection disconnected.${detail}`;
}

/**
 * Plain wording for a failed return from the provider. `reason` is the short code the callback
 * appends to `?oauth=error` (`app/routers/ad_oauth.py`); anything unrecognised falls back to a
 * truthful generic line rather than printing a machine code at a merchant.
 */
export function describeOauthFailure(reason: string | null | undefined, providerLabel: string): string {
  switch (reason) {
    case 'declined':
      return `${providerLabel} was not connected because the permission request was cancelled. Nothing changed.`;
    case 'session_expired':
      return `Your portal session ended while you were on ${providerLabel}, so the connection was not saved. Sign in and connect again.`;
    case 'not_available':
      return 'AI Ads is not enabled for this workspace, so the connection was not saved.';
    case 'invalid_request':
      return `The ${providerLabel} sign-in took too long to come back, so it was not saved. Please connect again.`;
    case 'configuration':
      return `${providerLabel} could not be connected because of a setup problem on our side. Nothing changed — support has the details.`;
    default:
      return `${providerLabel} could not be connected. Nothing changed — please try again.`;
  }
}

/**
 * `fetchAiAdsCampaigns` declares `external_campaign_id: string`, but the wire disagrees: a campaign
 * row whose provider sync has not completed arrives without one, and `undefined.slice(-4)` threw the
 * whole `/ai-ads/campaigns` route into the page error boundary. One unsynced row destroyed every
 * other row on the screen. Nothing about a list should depend on every field of every entry being
 * present, so the list is normalised once here and the renderer only ever sees strings.
 *
 * The `Array.isArray` guard is not defensive noise either — an error body or a `{ detail: … }`
 * envelope reaching this component is the same crash one level earlier, on `.length`.
 */
export function toCampaignRows(campaigns: unknown): AiAdsCampaignRow[] {
  if (!Array.isArray(campaigns)) return [];
  return campaigns.filter(isRecord).map((row, index) => {
    const platform = asText(row.platform);
    const externalId = asText(row.external_campaign_id);
    return {
      key: externalId ? `${platform || 'campaign'}-${externalId}` : `campaign-row-${index}`,
      name: asText(row.name) || 'Untitled campaign',
      platform: platform || 'Platform unavailable',
      maskedId: maskTail(externalId),
      accountName: asText(row.account_name) || 'Account unavailable',
      status: asText(row.status) || 'unknown',
    };
  });
}

export type AiAdsAccountRow = { key: string; externalId: string; name: string; maskedId: string; currency: string };

/**
 * Same shape of failure one panel over: `connection.accounts` is declared as an array, but a
 * connection whose account list has not synced yet arrives without one. A row with no external id
 * additionally cannot be selected — the select call is keyed by that id — so it reports itself
 * rather than offering a button that would post an empty id to the provider.
 */
export function toAccountRows(accounts: unknown): AiAdsAccountRow[] {
  if (!Array.isArray(accounts)) return [];
  return accounts.filter(isRecord).map((row, index) => {
    const externalId = asText(row.external_account_id);
    return {
      key: externalId || `account-row-${index}`,
      externalId,
      name: asText(row.account_name) || 'Ad account',
      maskedId: maskTail(externalId),
      currency: asText(row.currency) || 'Currency unavailable',
    };
  });
}

export function AIAdsView({ initialSectionId, showToast }: { initialSectionId?: string | null; showToast: (message: string, isError?: boolean) => void }) {
  const [section, setSection] = useState<AiAdsSection>(() => sectionFromRoute(initialSectionId));
  /* 640px is Tailwind's `sm`, the breakpoint the tab strip's classes use. A tab
     label is content, not styling, so it is decided here. */
  const isWide = useIsWide(640);
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchAiAdsOverview>> | null>(null);
  const [connections, setConnections] = useState<AiAdsConnection[]>([]);
  /**
   * Our own ad-account rows (`GET /api/v1/ad-accounts`): which of the accounts an OAuth connection
   * offers are actually linked to AI Ads, and when each last synced.
   *
   * Read here rather than inside the Accounts tab because two places need the same answer — that tab
   * annotates its rows with it, and the Analytics tab offers a picker built from it — and two copies
   * of the list could disagree about what is linked. It is a *separate* request from the page-level
   * `Promise.all` on purpose: a failure here must never blank the connections the page already
   * loaded, so it fails silently and `null` means "not read", not "nothing is linked".
   */
  const [linkedAccounts, setLinkedAccounts] = useState<AiAdsAdAccount[] | null>(null);
  const [campaigns, setCampaigns] = useState<Awaited<ReturnType<typeof fetchAiAdsCampaigns>>>([]);
  const [performance, setPerformance] = useState<PerformanceSnapshot | null>(null);
  /**
   * The platform's own numbers for the selected window, read at request time.
   *
   * Kept beside `performance` rather than replacing it: the stored snapshot still feeds the
   * Overview tiles and remains the fallback for the Analytics tab when a live read fails, so a
   * platform outage degrades to our last sync instead of to an empty page.
   */
  const [liveAnalytics, setLiveAnalytics] = useState<AiAdsLiveAnalytics | null>(null);
  const [analyticsDays, setAnalyticsDays] = useState<number>(7);
  /**
   * The ad account the merchant has pointed Analytics at, or `null` for "let the server decide".
   *
   * Linking an account does not unlink the others, so a merchant can hold several while Analytics
   * reads one. `null` is the honest starting value: nobody has chosen yet, so the request carries no
   * `account_id` and the backend's own ranking answers exactly as it does today. It only becomes a
   * number when the merchant picks one, and from then on every read — window changes and page
   * refreshes included — asks for that account.
   */
  const [analyticsAccountId, setAnalyticsAccountId] = useState<number | null>(null);
  const [performanceBusy, setPerformanceBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [busy, setBusy] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [conversationId, setConversationId] = useState<number>();
  const [messages, setMessages] = useState<ChatMessage[]>([CHAT_GREETING]);
  const [streamingText, setStreamingText] = useState('');
  // The live activity trail for the turn in flight — one entry per check the assistant ran.
  const [steps, setSteps] = useState<ActivityStep[]>([]);
  const [conversations, setConversations] = useState<AiAdsConversationSummary[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [stepUp, setStepUp] = useState<{ action: StepUpAction; provider?: 'meta' | 'tiktok'; connection?: AiAdsConnection; externalId?: string; connectionId?: number; proposal?: AiAdsProposal } | null>(null);
  const [stepUpCode, setStepUpCode] = useState('');
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpNotice, setStepUpNotice] = useState('');
  // The connection a merchant has asked to disconnect but has not yet confirmed. Nothing has been
  // sent to the server while this is set — not even the verification email.
  const [pendingDisconnect, setPendingDisconnect] = useState<AiAdsConnection | null>(null);

  useEffect(() => setSection(sectionFromRoute(initialSectionId)), [initialSectionId]);

  /**
   * Monotonic id for the platform read. Switching 7 → 90 → 14 quickly can land the responses out
   * of order, and without this the panel would show whichever arrived last rather than the window
   * that is actually selected.
   */
  const performanceRequestRef = useRef(0);

  /**
   * Read the platform's own numbers for a window, without ever failing the page.
   *
   * This one call depends on the ad platform answering right now, so it is the only fetch on the
   * tab that can fail for a reason that has nothing to do with our own data. A failure reports
   * itself in a toast and leaves whatever is already on screen — the stored snapshot is still
   * rendered underneath — rather than turning a slow provider into an empty Analytics tab. The
   * `requestId` is checked before the toast so a window the merchant has already changed away from
   * cannot complain about itself.
   */
  const readLiveAnalytics = useCallback(async (days: number, requestId: number, accountId: number | null, includeAds: boolean): Promise<AiAdsLiveAnalytics | null> => {
    try {
      return await fetchAiAdsLiveAnalytics(days, accountId, includeAds);
    } catch (error) {
      if (performanceRequestRef.current === requestId) showToast(describeFetchError(error), true);
      return null;
    }
  }, [showToast]);

  /**
   * Bumped whenever the page is refreshed on purpose, to make the platform read run again.
   *
   * The read is otherwise skipped when the payload already answers the current selection, which is
   * what keeps a tab switch free. But selecting an account, disconnecting one, and the Refresh
   * button all change what the answer *should* be without changing the window or the chosen
   * account, so they say so here rather than relying on a dependency that did not move.
   */
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);

  /**
   * Our own three endpoints. Each answers from our database in hundredths of a second, so they
   * share one `Promise.all` and the page paints as soon as they land.
   *
   * The platform read is deliberately not among them. It waits on Meta or TikTok answering right
   * now — 6–7 s for a real account, measured in production — and `setLoading(false)` in `finally`
   * meant the whole page sat behind a skeleton for that long, including the Overview tab, which
   * renders none of it. It runs on its own below instead.
   *
   * `refreshLive` separates a deliberate refresh from the first load: on mount the platform read is
   * already started by the effect below, so bumping the key here as well would spend a second
   * six-second call on the same answer.
   */
  const load = useCallback(async (refreshLive = false) => {
    setLoading(true);
    try {
      const [overviewData, connectionData, campaignData] = await Promise.all([
        fetchAiAdsOverview(), fetchAiAdsConnections(), fetchAiAdsCampaigns(),
      ]);
      setOverview(overviewData);
      setConnections(connectionData);
      setCampaigns(campaignData);
      setLoadError(null);
      if (refreshLive) setLiveRefreshKey(key => key + 1);
    } catch (error) {
      setLoadError(error);
      showToast(error instanceof Error ? error.message : 'Could not load AI Ads.', true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  // Re-read whenever the connections change. Selecting an account calls `load()`, which replaces the
  // `connections` array, and without this dependency a merchant who had just linked an account was
  // shown the pre-select answer: a Select button on the row they had already selected.
  useEffect(() => {
    let active = true;
    void fetchAdAccountsForAiAds()
      .then(accounts => { if (active) setLinkedAccounts(Array.isArray(accounts) ? accounts : []); })
      .catch(() => { /* soft-fail: the linked state is an enhancement, not required for the page */ });
    return () => { active = false; };
  }, [connections]);

  const accountChoices = useMemo(() => analyticsAccountChoices(linkedAccounts), [linkedAccounts]);

  /**
   * Drop a chosen account that is no longer linked — a disconnect deactivates its row
   * (`credential_lifecycle.py`) and the server then answers 404 for it, so keeping the choice would
   * make Analytics fail on every read with no way back except a reload. Falling back to `null`
   * returns the tab to the backend's own pick. A list we could not read (`null`) changes nothing:
   * "we do not know what is linked" is not evidence that the choice is gone.
   */
  useEffect(() => {
    if (analyticsAccountId === null || linkedAccounts === null) return;
    if (!accountChoices.some(choice => choice.id === analyticsAccountId)) setAnalyticsAccountId(null);
  }, [analyticsAccountId, linkedAccounts, accountChoices]);

  /**
   * Report the outcome of a return from Meta or TikTok. The callback sends the browser to
   * `/ai-ads/accounts?oauth=connected|error…` (`app/routers/ad_oauth.py`) and the portal ignored
   * those params entirely, so a merchant who had just finished granting permissions landed on a page
   * that looked exactly like the one they left — no confirmation on success, and on failure no reason
   * at all. The params are stripped afterwards so a refresh does not repeat the toast.
   *
   * This only runs once the AI Ads page is mounted, which needs a live session and an enabled
   * workspace. A merchant whose session expired on the provider's site therefore sees the portal's
   * own sign-in screen instead of this toast, which is the self-explanatory outcome anyway; the
   * point of the redirect is that they land in the portal rather than on an API error page.
   */
  const oauthOutcomeReadRef = useRef(false);
  useEffect(() => {
    if (oauthOutcomeReadRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('oauth');
    if (!outcome) return;
    oauthOutcomeReadRef.current = true;
    const provider = params.get('provider');
    const providerLabel = provider === 'meta' || provider === 'tiktok' ? `${platformDisplayName(provider)} Ads` : 'The ad platform';
    if (outcome === 'connected') showToast(`${providerLabel} is connected. Choose the ad account you want the assistant to read.`);
    else showToast(describeOauthFailure(params.get('reason'), providerLabel), true);
    for (const key of ['oauth', 'provider', 'connection', 'reason']) params.delete(key);
    const query = params.toString();
    window.history.replaceState({ buykoriPage: 'ai-ads', buykoriSection: 'ai-ads-accounts' }, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
  }, [showToast]);

  /**
   * Set when an ads-bearing read has been tried for the current selection and did not answer.
   *
   * Without it the Analytics tab could not tell "the ranking has not arrived yet" from "the ranking
   * was asked for and refused", and a refused read would leave a skeleton spinning for good.
   */
  const [adRankingUnavailable, setAdRankingUnavailable] = useState(false);

  /**
   * Fetch both Analytics halves for a selection. A failure keeps what is already on screen and
   * reports the reason in a toast, following the same rule as the rest of the page: a *refresh*
   * that fails must not blank data that is still valid, while a load that produced nothing at all
   * is a page-level error.
   *
   * The live read and the stored snapshot are fetched together under one `requestId` so the panel
   * can never show the platform's 7-day figures beside the stored 30-day ones.
   *
   * `accountId` reaches only the live read, because that is the only half that is about one account:
   * `/ai-ads/performance` sums our stored rows across every connected account and takes no account
   * parameter. Refetching it after an account change is therefore redundant — it is kept because the
   * two halves must stay under one `requestId`, and one extra request is cheaper than a panel that
   * can pair one account's live figures with a snapshot fetched for a different selection. It also
   * costs 0.01 s, against the seconds the live half takes.
   *
   * `includeAds` is the expensive half — see `fetchAiAdsLiveAnalytics`.
   */
  const loadPerformance = useCallback(async (days: number, accountId: number | null, includeAds: boolean) => {
    const requestId = ++performanceRequestRef.current;
    setPerformanceBusy(true);
    if (includeAds) setAdRankingUnavailable(false);
    try {
      const [snapshot, live] = await Promise.all([fetchAiAdsPerformance(days), readLiveAnalytics(days, requestId, accountId, includeAds)]);
      if (performanceRequestRef.current === requestId) {
        setPerformance(snapshot);
        if (live) setLiveAnalytics(live);
        if (includeAds && !live) setAdRankingUnavailable(true);
      }
    } catch (error) {
      if (performanceRequestRef.current === requestId) {
        showToast(describeFetchError(error), true);
        if (includeAds) setAdRankingUnavailable(true);
      }
    } finally {
      if (performanceRequestRef.current === requestId) setPerformanceBusy(false);
    }
  }, [showToast, readLiveAnalytics]);

  /**
   * What the platform read on screen (or in flight) was asked for, so the effect below can tell
   * "already answered" from "needs asking". A failed read counts as asked: retrying it on every tab
   * click would hammer a provider that is already refusing us. Refresh, and changing the window,
   * ask again.
   */
  const liveRequestRef = useRef<{ key: number; days: number; accountId: number | null; includeAds: boolean } | null>(null);

  /**
   * The single owner of the platform read: window changes, account changes, opening the Analytics
   * tab and the Refresh button all come through here, so none of them can fire a request of its own
   * and they share one monotonic sequence — a slow answer for the account just deselected cannot
   * overwrite the new one.
   *
   * `include_ads` follows the open tab. The per-ad ranking is what makes this call slow, and only
   * Analytics renders it, so every other tab reads the account half alone: 1.31 s instead of 6–7 s,
   * measured in production. Switching away from Analytics and back re-asks nothing, because the
   * payload already carries what the tab needs.
   */
  useEffect(() => {
    const includeAds = section === 'analytics';
    const asked = liveRequestRef.current;
    const answered = asked !== null
      && asked.key === liveRefreshKey
      && asked.days === analyticsDays
      && asked.accountId === analyticsAccountId
      && (asked.includeAds || !includeAds);
    if (answered) return;
    liveRequestRef.current = { key: liveRefreshKey, days: analyticsDays, accountId: analyticsAccountId, includeAds };
    void loadPerformance(analyticsDays, analyticsAccountId, includeAds);
  }, [liveRefreshKey, section, analyticsDays, analyticsAccountId, loadPerformance]);

  /**
   * Whether the read the open tab needs has not answered yet.
   *
   * Analytics needs its own flag rather than sharing `performanceBusy`, and it is deliberately not
   * derived from it: the effect above starts the ads-bearing read one frame *after* the tab renders,
   * so a `performanceBusy` test would let the tab paint once without the ad half. What makes the tab
   * ready is the payload carrying that half — until it does, and unless the read came back empty
   * handed, the tab is still waiting.
   *
   * Changing the window while already on Analytics is the opposite case: the ranking on screen is
   * still a real one, so it stays put under the header spinner instead of collapsing into a skeleton.
   */
  const liveAccountPending = performanceBusy && liveAnalytics === null;
  const liveAdsPending = !hasLiveAdBreakdown(liveAnalytics) && !adRankingUnavailable;

  /**
   * The conversation rail is secondary to the chat itself, so a failure here must not blank the
   * open conversation — but it must not read as "no past chats" either, which is why the reason
   * is kept and shown in the rail instead of being swallowed.
   */
  const refreshConversations = useCallback(async () => {
    setHistoryBusy(true);
    try {
      setConversations(await fetchAiAdsConversations());
      setHistoryError('');
    } catch (error) {
      setHistoryError(describeFetchError(error));
    } finally {
      setHistoryBusy(false);
    }
  }, []);

  useEffect(() => { if (section === 'chat') void refreshConversations(); }, [section, refreshConversations]);

  const navigate = (next: AiAdsSection) => {
    setSection(next);
    const path = next === 'overview' ? '/ai-ads' : `/ai-ads/${next}`;
    window.history.replaceState({ buykoriPage: 'ai-ads', buykoriSection: `ai-ads-${next}` }, '', path);
  };

  const connect = async (provider: 'meta' | 'tiktok') => {
    setStepUp({ action: 'connect', provider });
    setStepUpCode(''); setStepUpNotice('');
    try { const result = await requestAiAdsEmailStepUp(); setStepUpNotice(`A verification code was sent to ${result.email_masked}.`); }
    catch (error) { setStepUp(null); showToast(error instanceof Error ? error.message : 'Verification email could not be sent.', true); }
  };

  const selectAccount = async (connection: AiAdsConnection, externalId: string) => {
    setStepUp({ action: 'select', connection, externalId }); setStepUpCode(''); setStepUpNotice('');
    try { const result = await requestAiAdsEmailStepUp(); setStepUpNotice(`A verification code was sent to ${result.email_masked}.`); }
    catch (error) { setStepUp(null); showToast(error instanceof Error ? error.message : 'Verification email could not be sent.', true); }
  };

  const selectAccountAfterStepUp = async (connection: AiAdsConnection, externalId: string, grant: { grant: string; challengeId: number }) => {
    setBusy(`select-${connection.id}-${externalId}`);
    try {
      await selectAiAdsAccount(connection.id, externalId, grant);
      showToast('Ad account connected.');
      await load(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Account could not be connected.', true);
    } finally {
      setBusy('');
    }
  };

  /**
   * Ask first. Disconnecting is destructive server-side — the stored token is deleted, ad accounts
   * are deactivated, queued actions are cancelled and proposals awaiting review are voided
   * (`app/services/ads/credential_lifecycle.py:268-321`) — and the old first click already emailed a
   * one-time code, so a misclick started a credential change and the only wording the merchant saw
   * was "Verify this ads connection". Nothing leaves the browser until the confirmation is accepted.
   */
  const disconnect = (connection: AiAdsConnection) => {
    if (!connectionIsLive(connection)) return;
    setPendingDisconnect(connection);
  };

  const startDisconnectStepUp = async (connection: AiAdsConnection) => {
    setPendingDisconnect(null);
    setStepUp({ action: 'disconnect', connectionId: connection.id, provider: connection.provider });
    setStepUpCode(''); setStepUpNotice('');
    try { const result = await requestAiAdsEmailStepUp(); setStepUpNotice(`A verification code was sent to ${result.email_masked}.`); }
    catch (error) { setStepUp(null); showToast(error instanceof Error ? error.message : 'Verification email could not be sent.', true); }
  };

  const disconnectAfterStepUp = async (connectionId: number, grant: { grant: string; challengeId: number }) => {
    setBusy(`disconnect-${connectionId}`);
    try {
      showToast(describeDisconnectResult(await disconnectAiAdsConnection(connectionId, grant)));
      await load(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Connection could not be disconnected.', true);
    } finally {
      setBusy('');
    }
  };

  const verifyStepUpAndContinue = async () => {
    if (!stepUp || stepUpCode.trim().length !== 6 || stepUpBusy) return;
    setStepUpBusy(true);
    try {
      const verified = await verifyAiAdsEmailStepUp(stepUpCode);
      const grant = { grant: verified.step_up_grant, challengeId: verified.challenge_id };
      const action = stepUp; setStepUp(null); setStepUpCode('');
      if (action.action === 'connect' && action.provider) { setBusy(`connect-${action.provider}`); const response = await beginAiAdsOAuth(action.provider, grant); window.location.assign(response.authorization_url); return; }
      if (action.action === 'select' && action.connection && action.externalId) { await selectAccountAfterStepUp(action.connection, action.externalId, grant); return; }
      if (action.action === 'disconnect' && action.connectionId) { await disconnectAfterStepUp(action.connectionId, grant); return; }
      if (action.action === 'confirm' && action.proposal) { await confirmProposalAfterStepUp(action.proposal, grant); }
    } catch (error) { showToast(error instanceof Error ? error.message : 'Verification failed.', true); }
    finally { setStepUpBusy(false); }
  };

  const resendStepUpCode = async () => {
    if (!stepUp || stepUpBusy) return;
    setStepUpBusy(true);
    try { const result = await requestAiAdsEmailStepUp(); setStepUpNotice(`A new verification code was sent to ${result.email_masked}.`); setStepUpCode(''); }
    catch (error) { showToast(error instanceof Error ? error.message : 'Verification email could not be sent.', true); }
    finally { setStepUpBusy(false); }
  };

  /**
   * Confirming an exact proposal needs a step-up grant on the queue call, so it opens the same email
   * verification the connection actions use and finishes in `verifyStepUpAndContinue`. The queue
   * endpoint validates that grant against the PROVIDER_WRITE scope, which the client email step-up
   * (CREDENTIAL_CHANGE) cannot issue — a client can review and approve, but the final execution step
   * stays operator-gated by design. In production this is never reached: the confirm CTA is hidden
   * while `writes_enabled` is false.
   */
  const confirmProposal = async (proposal: AiAdsProposal) => {
    if (overview?.writes_enabled !== true) {
      showToast('AI Ads is currently read-only.', true);
      return;
    }
    setStepUp({ action: 'confirm', proposal });
    setStepUpCode(''); setStepUpNotice('');
    try { const result = await requestAiAdsEmailStepUp(); setStepUpNotice(`A verification code was sent to ${result.email_masked}.`); }
    catch (error) { setStepUp(null); showToast(error instanceof Error ? error.message : 'Verification email could not be sent.', true); }
  };

  const confirmProposalAfterStepUp = async (proposal: AiAdsProposal, grant: { grant: string; challengeId: number }) => {
    setBusy(`proposal-${proposal.id}`);
    try {
      const approval = await approveAiAdsProposal(proposal);
      const action = await queueAiAdsProposal(proposal.id, approval.approval_id, grant.grant);
      showToast(`Action ${action.action_id} queued for worker validation.`);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Proposal could not be approved.', true);
    } finally {
      setBusy('');
    }
  };

  /**
   * Commit a finished turn. The `done` frame (and the blocking response) carry the
   * *authoritative* sanitized text, so whatever was streamed for typing feel is dropped here and
   * replaced by it — the streamed tokens are never what ends up on screen or in the transcript.
   */
  const applyTurn = (conversation: number, text: string, structured?: Record<string, unknown> | null) => {
    setStreamingText('');
    setSteps([]);
    setConversationId(conversation);
    setMessages(current => [...current, { role: 'assistant', content: text, structured: structured ?? null, created_at: new Date().toISOString() }]);
    void refreshConversations();
    if (structured && ('proposal' in structured || 'composed_proposal' in structured)) void load();
  };

  const sendBlockingChat = async (message: string) => {
    const response = await sendAiAdsChat(message, conversationId);
    applyTurn(response.conversation_id, response.message, response.structured ?? null);
  };

  const consumeChatStream = async (response: Response) => {
    let settled = false;
    const handle = (frame: AiAdsStreamFrame) => {
      if (frame.type === 'delta') {
        setStreamingText(current => current + frame.text);
        return;
      }
      // One line per check the assistant actually ran. This is the visible proof that work
      // happened, and it is only ever appended, so the client sees the order things ran in.
      if (frame.type === 'step') {
        setSteps(current => [...current, { label: frame.label, status: frame.status }]);
        return;
      }
      settled = true;
      if (frame.type === 'error') {
        setStreamingText('');
        setSteps([]);
        setMessages(current => [...current, { role: 'assistant', content: frame.detail, created_at: new Date().toISOString() }]);
        return;
      }
      applyTurn(frame.conversation_id, frame.message, frame.structured);
    };

    if (!response.body) {
      // No readable stream in this environment. The turn is already running server-side, so read
      // the response whole rather than re-sending it and charging the tenant for a second run.
      parseSseFrames(await response.text()).frames.forEach(handle);
    } else {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = parseSseFrames(buffer + decoder.decode(value, { stream: true }));
        buffer = parsed.rest;
        parsed.frames.forEach(handle);
      }
      // Flush a final event that arrived without its trailing blank line.
      parseSseFrames(`${buffer}${decoder.decode()}\n\n`).frames.forEach(handle);
    }

    if (!settled) {
      setStreamingText('');
      setSteps([]);
      setMessages(current => [...current, { role: 'assistant', content: 'The assistant stopped before finishing. Please try again.', created_at: new Date().toISOString() }]);
    }
  };

  const sendMessage = async (prompt?: string) => {
    const message = (prompt ?? chatInput).trim();
    if (!message || busy === 'chat') return;
    setChatInput('');
    // Stamped locally: the client sees their own question timed the moment they sent it, rather than
    // untimed until the answer lands. A stored turn carries the server's `created_at` instead.
    setMessages(current => [...current, { role: 'user', content: message, created_at: new Date().toISOString() }]);
    setStreamingText('');
    setSteps([]);
    setBusy('chat');
    try {
      let response: Response | null = null;
      try {
        response = await streamAiAdsChat(message, conversationId);
      } catch {
        // No response headers came back, so the streaming route was never reached (an older
        // backend, or a proxy that blocks SSE). Retrying on the blocking route is safe.
        response = null;
      }
      // A non-OK status is produced by auth, the beta gate, or request validation — all of which
      // run *before* the orchestrator, so no message was persisted and the blocking route can
      // safely retry and surface its proper status mapping. Once a 200 stream is open the turn is
      // already running server-side and must never be re-sent.
      if (!response || !response.ok) {
        await sendBlockingChat(message);
        return;
      }
      await consumeChatStream(response);
    } catch (error) {
      setStreamingText('');
      setSteps([]);
      const text = error instanceof Error ? error.message : 'The assistant could not respond.';
      setMessages(current => [...current, { role: 'assistant', content: text, created_at: new Date().toISOString() }]);
    } finally {
      setBusy('');
    }
  };

  const openConversation = async (id: number) => {
    if (busy === 'chat') return;
    setHistoryBusy(true);
    try {
      const stored = await fetchAiAdsConversationMessages(id);
      setMessages(stored
        .filter(item => item.role === 'user' || item.role === 'assistant')
        .map(item => ({ id: item.id, role: item.role, content: item.content, structured: item.structured, created_at: item.created_at })));
      setConversationId(id);
      setStreamingText('');
      setHistoryError('');
    } catch (error) {
      showToast(describeFetchError(error), true);
    } finally {
      setHistoryBusy(false);
    }
  };

  const startNewChat = () => {
    if (busy === 'chat') return;
    setConversationId(undefined);
    setMessages([CHAT_GREETING]);
    setStreamingText('');
    setChatInput('');
  };

  const confirmPlan = async (proposalId: string) => {
    setBusy(`plan-${proposalId}`);
    try {
      const confirmed = await confirmPersistedAiAdsPlan(proposalId);
      setMessages(current => current.map(message => {
        const composed = message.structured?.composed_proposal as Record<string, unknown> | undefined;
        return composed?.proposal_id === proposalId ? { ...message, structured: { ...message.structured, composed_proposal: confirmed } } : message;
      }));
      showToast('Plan confirmed for review. No provider action was performed.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Plan could not be confirmed.', true);
    } finally {
      setBusy('');
    }
  };

  /**
   * The "no" half of human-in-the-loop. Rejecting a composed plan records the client's decision via
   * `POST /ai-ads/composed-proposals/{id}/reject`; it performs no provider action — it simply marks the
   * plan rejected so the assistant can prepare a fresh one. Uses its own busy key so the Reject and
   * Confirm buttons show independent progress.
   */
  const rejectPlan = async (proposalId: string) => {
    setBusy(`reject-plan-${proposalId}`);
    try {
      const rejected = await rejectAiAdsPlan(proposalId);
      setMessages(current => current.map(message => {
        const composed = message.structured?.composed_proposal as Record<string, unknown> | undefined;
        return composed?.proposal_id === proposalId ? { ...message, structured: { ...message.structured, composed_proposal: rejected } } : message;
      }));
      showToast('Plan rejected. The assistant can prepare a new one.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Plan could not be rejected.', true);
    } finally {
      setBusy('');
    }
  };

  if (loading && !overview) {
    return <div className="space-y-4"><SkeletonCards count={4} /><SkeletonTable rows={4} /></div>;
  }

  // Our three instant requests share one `Promise.all`, so a single failure fails all of them — and
  // before this guard that landed as every panel rendering its own empty state: "No synced campaigns",
  // "No action history yet", spend 0, ROAS 0. That reads as a healthy account with nothing in it. The
  // toast carrying the real reason then disappeared after a few seconds and the false picture stayed
  // on screen. A load that produced no data at all is a page-level failure and now says so, with the
  // retry a toast cannot offer. A *refresh* that fails while earlier data is still on screen stays a
  // toast, because there the panels are not lying about anything.
  //
  // The platform read is deliberately outside this: it can be slow or refused without the page being
  // unusable, so it reports in a toast and each panel that needs it shows its own pending state.
  if (loadError && !overview) {
    return <ErrorState title="Could not load AI Ads" description={describeFetchError(loadError)} onRetry={() => void load()} />;
  }

  return (
    <div className="space-y-4">
      {/* The shared head, so this page folds on a phone the way the rest of the
          console does: the prose moves behind ⓘ and Refresh takes the rest of
          the row. The rule underneath is kept — it is what separates the head
          from the tab strip, which carries a rule of its own. */}
      <PageHeader
        title="AI Ads"
        description="Planning, approvals, account health, and performance."
        className="border-b border-[var(--bk-console-border)] pb-3"
        action={(
          <Button variant="secondary" onClick={() => void load(true)} disabled={loading || performanceBusy}>
            <RefreshCw className={`h-4 w-4 ${loading || performanceBusy ? 'animate-spin' : ''}`} />Refresh
          </Button>
        )}
      />

      <div className="flex flex-wrap gap-1 border-b border-[var(--bk-console-border)] sm:flex-nowrap sm:overflow-x-auto" role="tablist" aria-label="AI Ads views">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" role="tab" aria-selected={section === tab.id} onClick={() => navigate(tab.id)} className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 border-b-2 px-2 text-label font-semibold sm:px-3 sm:text-sm ${section === tab.id ? 'border-[var(--bk-console-blue)] text-[var(--bk-console-blue)]' : 'border-transparent text-[var(--bk-console-text-muted)] hover:text-[var(--bk-console-text)]'}`}>
            {/* The icon is the first thing to go on a phone: it repeats what the
                label already says, and dropping it is what brings seven tabs
                into two rows. */}
            <Icon className="hidden h-4 w-4 sm:block" />{isWide ? tab.label : tab.shortLabel}
          </button>;
        })}
      </div>

      {section === 'overview' && <OverviewPanel overview={overview} onOpen={navigate} onConfirm={confirmProposal} busy={busy} />}
      {section === 'accounts' && <AccountsPanel connections={connections} linkedAccounts={linkedAccounts} analyticsAccountId={liveAnalytics?.account?.ad_account_id ?? null} busy={busy} onConnect={connect} onSelect={selectAccount} onDisconnect={disconnect} />}
      {section === 'campaigns' && <CampaignsPanel campaigns={campaigns} live={liveAnalytics} livePending={liveAccountPending} />}
      {section === 'analytics' && <AnalyticsPanel snapshot={performance} live={liveAnalytics} days={analyticsDays} onChangeDays={setAnalyticsDays} accounts={accountChoices} accountId={analyticsAccountId ?? liveAnalytics?.account?.ad_account_id ?? null} onChangeAccount={setAnalyticsAccountId} busy={performanceBusy} pending={liveAdsPending} />}
      {section === 'creative' && <CreativePanel showToast={showToast} />}
      {section === 'history' && <HistoryPanel />}
      {section === 'chat' && <ChatPanel messages={messages} streamingText={streamingText} steps={steps} value={chatInput} setValue={setChatInput} busy={busy === 'chat'} onSend={sendMessage} onConfirmPlan={confirmPlan} onRejectPlan={rejectPlan} planBusy={busy} conversations={conversations} conversationId={conversationId} historyBusy={historyBusy} historyError={historyError} onSelectConversation={openConversation} onNewChat={startNewChat} onRefreshHistory={() => void refreshConversations()} />}
      {stepUp && <EmailStepUpDialog action={stepUp.action} notice={stepUpNotice} code={stepUpCode} setCode={setStepUpCode} busy={stepUpBusy} onVerify={() => void verifyStepUpAndContinue()} onResend={() => void resendStepUpCode()} onCancel={() => setStepUp(null)} />}
      {pendingDisconnect && <ConfirmDisconnectDialog connection={pendingDisconnect} onConfirm={() => void startDisconnectStepUp(pendingDisconnect)} onCancel={() => setPendingDisconnect(null)} />}
    </div>
  );
}

/**
 * The "are you sure?" step in front of a disconnect, stated in the merchant's terms before anything
 * happens. Every consequence listed here is one the server actually applies
 * (`app/services/ads/credential_lifecycle.py:268-321`), including the reassuring one: disconnecting
 * removes *our* access and cancels *our* queued work, and does not touch the live ads themselves.
 */
export function ConfirmDisconnectDialog({ connection, onConfirm, onCancel }: { connection: AiAdsConnection; onConfirm: () => void; onCancel: () => void }) {
  const platform = `${platformDisplayName(connection.provider)} Ads`;
  return (
    <ConfirmDialog
      onClose={onCancel}
      title={`Disconnect ${platform}?`}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>Keep connection</Button>
          <Button variant="danger" onClick={onConfirm}><Unplug className="h-4 w-4" />Disconnect</Button>
        </>
      }
    >
      <p>This removes Buykori&rsquo;s access to your {platform} connection. Before you continue:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Your connected ad accounts stop syncing, so performance data stops updating.</li>
        <li>Anything still waiting in the action queue is cancelled.</li>
        <li>Any plan waiting for your review is voided and can no longer be approved.</li>
        <li>Your live ads are not changed — they keep running exactly as they are.</li>
      </ul>
      <p className="mt-2">You can reconnect whenever you like, but cancelled actions and voided plans are not restored.</p>
      <p className="mt-2">For your security, a one-time code is emailed to you before the disconnect runs.</p>
    </ConfirmDialog>
  );
}

function EmailStepUpDialog({ action, notice, code, setCode, busy, onVerify, onResend, onCancel }: { action: StepUpAction; notice: string; code: string; setCode: (value: string) => void; busy: boolean; onVerify: () => void; onResend: () => void; onCancel: () => void }) {
  // The action-specific wording is always shown; `notice` (which carries the masked email address)
  // is added *below* it rather than replacing it, so the merchant never loses sight of what the code
  // is for once the email has gone out.
  const copy = stepUpCopy(action);
  return (
    <Modal
      onClose={onCancel}
      labelledBy="ai-ads-stepup-title"
      describedBy="ai-ads-stepup-description"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      panelClassName="w-full max-w-md rounded-xl bg-[var(--bk-console-surface)] p-5 shadow-xl"
    >
      <h2 id="ai-ads-stepup-title" className="text-lg font-bold text-[var(--bk-console-text)]">{copy.title}</h2>
      <p id="ai-ads-stepup-description" className="mt-2 text-sm text-[var(--bk-console-text-muted)]">{copy.description}</p>
      {notice && <p className="mt-1 text-sm text-[var(--bk-console-text-muted)]">{notice}</p>}
      <Input
        aria-label="6-digit verification code"
        inputMode="numeric"
        maxLength={6}
        value={code}
        onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={event => { if (event.key === 'Enter') onVerify(); }}
        placeholder="6-digit code"
        wrapperClassName="mt-4"
        className="text-center text-lg tracking-[0.4em]"
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" onClick={onResend} disabled={busy} className="text-sm font-semibold text-[var(--bk-console-blue)] hover:text-[var(--bk-console-blue-hover)] disabled:opacity-50">Send new code</button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={action === 'disconnect' ? 'danger' : 'primary'} onClick={onVerify} disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : copy.cta}</Button>
        </div>
      </div>
    </Modal>
  );
}

function OverviewPanel({ overview, onOpen, onConfirm, busy }: { overview: Awaited<ReturnType<typeof fetchAiAdsOverview>> | null; onOpen: (section: AiAdsSection) => void; onConfirm: (proposal: AiAdsProposal) => void; busy: string }) {
  // `/ai-ads/overview` builds its snapshot with `days=7` (app/routers/ai_ads.py:125), so these
  // tiles are always a 7-day view and are unaffected by the Analytics window selector.
  const performance = overview?.performance;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Spend" value={formatMoney(performance?.spend)} caption="Last 7 days" icon={CircleDollarSign} />
      <StatCard label="Revenue" value={formatMoney(performance?.revenue)} caption="Last 7 days" icon={BarChart3} />
      <StatCard label="ROAS" value={formatRoas(performance?.roas)} caption="Revenue per unit of spend" icon={Activity} />
      <StatCard label="Attribution" value={formatPercent(performance?.attribution_quality)} caption="Purchases matched to an ad" icon={ShieldCheck} />
    </div>
    <section>
      {/* 20px of ink, 44px of target. The link keeps its place on the card's
          header line, so the height comes from an `::after` halo on the y axis
          rather than from a min-height that would deepen the row by 24px. */}
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-[var(--bk-console-text)]">Pending proposals</h3><button type="button" className="relative text-sm font-semibold text-[var(--bk-console-blue)] after:absolute after:inset-x-0 after:-inset-y-3 after:content-[''] hover:text-[var(--bk-console-blue-hover)]" onClick={() => onOpen('chat')}>Open Chat Now</button></div>
      <ProposalList proposals={overview?.proposals || []} writesEnabled={overview?.writes_enabled === true} busy={busy} onConfirm={onConfirm} />
    </section>
    <section>
      <h3 className="mb-2 text-sm font-bold text-[var(--bk-console-text)]">Recent actions</h3>
      {(overview?.actions || []).length ? (
        <div className="overflow-hidden rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]">
          {overview?.actions.map(action => <div key={action.id} className="flex items-center justify-between border-b border-[var(--bk-console-border)] px-4 py-3 last:border-0"><div><p className="text-sm font-medium text-[var(--bk-console-text)]">{describeOperation(action.operation)}</p><p className="text-xs text-[var(--bk-console-text-muted)]">{action.provider} · Action {action.id}</p></div><Badge tone={statusTone(action.status)}>{action.status.replaceAll('_', ' ')}</Badge></div>)}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]"><EmptyState icon={Activity} compact title="No action history yet" description="Actions run from approved proposals will appear here." /></div>
      )}
    </section>
  </div>;
}

function ProposalList({ proposals, writesEnabled, busy, onConfirm }: { proposals: AiAdsProposal[]; writesEnabled: boolean; busy: string; onConfirm: (proposal: AiAdsProposal) => void }) {
  if (!proposals.length) {
    return <div className="rounded-xl border border-dashed border-[var(--bk-console-border-strong)] bg-[var(--bk-console-surface)]"><EmptyState icon={ShieldCheck} compact title="No proposals awaiting review" description="When the assistant prepares a change for your approval, it appears here to inspect before anything runs." /></div>;
  }
  return <div className="space-y-3">{proposals.map(proposal => <ProposalReviewCard key={proposal.id} proposal={proposal} writesEnabled={writesEnabled} busy={busy} onConfirm={onConfirm} />)}</div>;
}

// `onDisconnect` takes the whole connection, not just its id: the confirmation it opens has to name
// the platform and decide whether the connection is still live, and re-deriving that from an id would
// mean looking the row up again.
//
// `linkedAccounts` is read by the page, not here: the Analytics picker is built from the same list,
// and one shared answer cannot disagree with itself about what is linked. `null` still means "could
// not be read", so the rows fall back to exactly what they showed before.
function AccountsPanel({ connections, linkedAccounts, analyticsAccountId, busy, onConnect, onSelect, onDisconnect }: { connections: AiAdsConnection[]; linkedAccounts: AiAdsAdAccount[] | null; analyticsAccountId: number | null; busy: string; onConnect: (provider: 'meta' | 'tiktok') => void; onSelect: (connection: AiAdsConnection, id: string) => void; onDisconnect: (connection: AiAdsConnection) => void }) {
  return <div className="space-y-5">
    <div className="grid gap-3 md:grid-cols-2">
      {(['meta', 'tiktok'] as const).map(provider => {
        const card = providerCardState(connections, provider);
        const connection = card.connection;
        return (
          <div key={provider} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-4">
            <div className="flex min-w-0 items-start gap-3">
              <PlatformLogo platform={provider} className="mt-0.5 h-8 w-8 shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-[var(--bk-console-text)]">{platformDisplayName(provider)} Ads</p>
                  {card.badge ? <Badge tone={card.badge.tone} dot>{card.badge.label}</Badge> : null}
                </div>
                <p className="mt-0.5 text-sm text-[var(--bk-console-text-muted)]">{card.detail}</p>
              </div>
            </div>
            {/* One action per card. A connected provider offered another blue "Connect" is the
                defect this replaced: it invited a merchant to re-run OAuth on a live connection. */}
            {card.action.kind === 'disconnect' && connection ? (
              <Button variant="secondary" onClick={() => onDisconnect(connection)} disabled={busy === `disconnect-${connection.id}`}><Unplug className="h-4 w-4" />Disconnect</Button>
            ) : (
              <Button variant={card.action.variant} onClick={() => onConnect(provider)} disabled={busy === `connect-${provider}`}><Plug className="h-4 w-4" />{card.action.label}</Button>
            )}
          </div>
        );
      })}
    </div>
    <section>
      <h3 className="mb-2 text-sm font-bold text-[var(--bk-console-text)]">Connections</h3>
      <div className="space-y-3">{connections.length ? connections.map(connection => <ConnectionCard key={connection.id} connection={connection} busy={busy} linkedAccounts={linkedAccounts} analyticsAccountId={analyticsAccountId} onSelect={onSelect} onDisconnect={onDisconnect} />) : <div className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]"><EmptyState icon={Link2} compact title="No OAuth connections yet" description="Connect Meta or TikTok above to let the assistant read your ad performance." /></div>}</div>
    </section>
  </div>;
}

function ConnectionCard({ connection, busy, linkedAccounts, analyticsAccountId, onSelect, onDisconnect }: { connection: AiAdsConnection; busy: string; linkedAccounts: AiAdsAdAccount[] | null; analyticsAccountId: number | null; onSelect: (connection: AiAdsConnection, id: string) => void; onDisconnect: (connection: AiAdsConnection) => void }) {
  const accounts = toAccountRows(connection.accounts);
  // An already-disconnected row keeps no Disconnect button: pressing it again only emailed a second
  // one-time code so the server could report `repeated` and change nothing.
  const live = connectionIsLive(connection);
  return <div className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]">
    <div className="flex flex-col gap-3 border-b border-[var(--bk-console-border)] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><PlatformLogo platform={connection.provider} className="h-7 w-7" /><div><div className="flex items-center gap-2"><p className="font-semibold text-[var(--bk-console-text)]">{platformDisplayName(connection.provider)} Ads</p><Badge tone={statusTone(connection.status)}>{connection.status.replaceAll('_', ' ')}</Badge></div><p className="mt-1 text-xs text-[var(--bk-console-text-muted)]">Permissions {connection.permission_status} · Token {connection.token_status}</p></div></div>{live ? <Button variant="secondary" onClick={() => onDisconnect(connection)} disabled={busy === `disconnect-${connection.id}`}><Unplug className="h-4 w-4" />Disconnect</Button> : <p className="text-xs text-[var(--bk-console-text-muted)]">Already disconnected. Connect again above to resume syncing.</p>}</div>
    {/* A connection with no accounts used to render an empty strip below the header, so a merchant
        who had authorised the provider but not yet had an ad account returned saw a card that simply
        stopped, with nothing to read and nothing to do. */}
    <div className="divide-y divide-[var(--bk-console-border)]">{accounts.length ? accounts.map(row => {
      // Every row used to carry an identical "Select" button, so a merchant with four ad accounts
      // could not tell which one they had linked, nor which one the assistant was reading.
      const link = accountLinkState(linkedAccounts, connection.provider, row.externalId, analyticsAccountId);
      const synced = link.lastSyncedAt;
      const syncedLabel = synced ? ` · Last synced ${relativeTime(synced)}` : synced === null ? ' · Not synced yet' : '';
      return <div key={row.key} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-[var(--bk-console-text)]">{row.name}</p>
            {link.badge ? <Badge tone={link.badge.tone} dot>{link.badge.label}</Badge> : null}
          </div>
          <p className="truncate text-xs text-[var(--bk-console-text-muted)]">{row.maskedId} · {row.currency}{syncedLabel}</p>
          {/* Several accounts can be linked at once, so which one the numbers came from is its own
              fact — taken from what the Analytics read reported, not guessed here. */}
          {link.readsAnalytics ? <p className="mt-0.5 text-[11px] text-[var(--bk-console-text-subtle)]">Analytics and the assistant are reading this account.</p> : null}
        </div>
        {link.action ? (
          <Button variant={link.action.variant} onClick={() => onSelect(connection, row.externalId)} disabled={!row.externalId || busy === `select-${connection.id}-${row.externalId}`}>{link.action.label}<ChevronRight className="h-4 w-4" /></Button>
        ) : null}
      </div>;
    }) : <p className="px-4 py-3 text-xs text-[var(--bk-console-text-muted)]">No ad accounts have been returned for this connection yet.</p>}</div>
  </div>;
}

/**
 * The Campaigns tab. `live` is what the platform is delivering right now; `campaigns` is our stored
 * sync of the same accounts.
 *
 * The live read leads because only it carries `effective_status`. Our synced rows keep `status`, the
 * on/off switch, and printing that as the campaign's state is the reported defect: two campaigns
 * read `ACTIVE` here while Ads Manager's Delivery column read "Off". The stored table is kept — it
 * is the fallback when the platform cannot be reached, and it covers accounts the live read does not
 * (the live read is one account, the sync is all of them) — but it is labelled as the switch only,
 * never as delivery.
 */
function CampaignsPanel({ campaigns, live, livePending }: { campaigns: Awaited<ReturnType<typeof fetchAiAdsCampaigns>>; live: AiAdsLiveAnalytics | null; livePending: boolean }) {
  const rows = toCampaignRows(campaigns);
  const liveReady = live !== null && campaignTableRows(live).length > 0;
  if (!liveReady && !rows.length) {
    // The platform read no longer holds the whole page back, so this tab can be reached while it is
    // still in flight. "No campaigns to show" would then be a guess about an answer that has not
    // arrived — a merchant with campaigns would read it, and it would then vanish a second later.
    if (livePending) return <SkeletonTable rows={4} />;
    return <div className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]"><EmptyState icon={Target} title="No campaigns to show" description="Once an ad account is connected, the campaigns the platform reports for it appear here." /></div>;
  }
  return (
    <div className="space-y-4">
      {liveReady ? <LiveCampaignsPanel live={live} /> : null}
      {rows.length ? (
        <section className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]">
          <div className="p-5 pb-3">
            <h3 className="text-base font-bold text-[var(--bk-console-text)]">Saved from your last sync</h3>
            {/* Not delivery. A switch reading Active proves only that nobody turned the campaign
                off — the platform can still be delivering none of it. */}
            <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">
              Every synced account, with the on/off switch we last stored. This column is the switch, not what is being delivered.
            </p>
          </div>
          <Table caption="Campaigns saved from the last sync, with the on/off switch we stored" wrapperClassName="[&>table]:min-w-[560px]">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Campaign</TableHeaderCell>
                <TableHeaderCell>Account</TableHeaderCell>
                <TableHeaderCell>Switch</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.key}>
                  <TableCell>
                    <p className="font-medium text-[var(--bk-console-text)]">{row.name}</p>
                    <p className="text-xs capitalize text-[var(--bk-console-text-muted)]">{row.platform} · {row.maskedId}</p>
                  </TableCell>
                  <TableCell className="text-[var(--bk-console-text-muted)]">{row.accountName}</TableCell>
                  <TableCell><Badge tone={statusTone(row.status)}>{row.status.replaceAll('_', ' ')}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </div>
  );
}

/**
 * The stages of the live funnel all come from one place, which is the opposite of the stored
 * snapshot's mix — see `DEFAULT_SOURCE_NOTE` in `PerformanceFunnelChart`. The wording follows the
 * payload's own `source`, because a figure read six hours ago must not be presented as "now".
 */
function liveFunnelNote(live: AiAdsLiveAnalytics): string {
  const source = describeSource(live.source);
  return source.live
    ? 'All three stages are the ad platform’s own count for this window, read just now — impressions, '
      + 'clicks and the purchases it attributed inside its own window.'
    : 'All three stages come from the platform, but from our last sync rather than a live read, so they '
      + 'can lag what Ads Manager shows right now.';
}

/**
 * The Analytics tab. `live` is what the platform reports for this window; `snapshot` is our stored
 * sync of it.
 *
 * The live payload leads, because the stored snapshot counts purchases and revenue from our own
 * tracked events: a store that has never sent us an event rendered its real spend beside eleven
 * zeros. The stored grid is kept as the fallback rather than deleted — when the platform cannot be
 * reached the tab degrades to our last sync instead of to an empty page.
 *
 * `pending` is this tab's own wait, separate from `busy`. Every other tab reads the platform without
 * the per-ad ranking, because that ranking is what makes the call slow, so the payload already in
 * hand when this tab opens usually carries no ads at all. Rendering it here would badge the ranking
 * "Not requested" and tell the merchant it could not be read — so a payload without the ad half is
 * treated as no live payload, and the tab waits behind a skeleton for one that has it.
 */
function AnalyticsPanel({ snapshot, live, days, onChangeDays, accounts, accountId, onChangeAccount, busy, pending }: { snapshot: PerformanceSnapshot | null; live: AiAdsLiveAnalytics | null; days: number; onChangeDays: (days: number) => void; accounts: AnalyticsAccountChoice[]; accountId: number | null; onChangeAccount: (accountId: number) => void; busy: boolean; pending: boolean }) {
  const metrics: Array<[string, string]> = [
    ['Spend', formatMoney(snapshot?.spend)], ['Impressions', formatCount(snapshot?.impressions)], ['Clicks', formatCount(snapshot?.clicks)],
    ['CTR', formatPercent(snapshot?.ctr)], ['CPC', formatMoney(snapshot?.cpc)], ['CPM', formatMoney(snapshot?.cpm)],
    ['Purchases', formatCount(snapshot?.conversions)], ['CPA', formatMoney(snapshot?.cpa)], ['Revenue', formatMoney(snapshot?.revenue)],
    ['ROAS', formatRoas(snapshot?.roas)], ['Conversion rate', formatPercent(snapshot?.conversion_rate)], ['AOV', formatMoney(snapshot?.aov)],
  ];
  const liveReady = live !== null && hasLiveAdBreakdown(live) && !isEmptyLive(live);
  const empty = !pending && !liveReady && isEmptySnapshot(snapshot);
  // One linked account is not a choice, and none is not a question — the picker only appears when a
  // merchant actually holds several, which is the case that used to leave them stuck on whichever
  // account the server ranked first.
  const picker = analyticsPickerState(accounts, accountId);
  const accountOptions = [
    ...(picker.placeholder ? [{ value: '', label: 'Choose an ad account', disabled: true }] : []),
    ...accounts.map(account => {
      const platform = platformDisplayName(account.platform);
      const name = account.name || maskTail(account.externalId);
      return { value: String(account.id), label: platform ? `${platform} · ${name}` : name };
    }),
  ];
  return <div className="space-y-4">
    {/* The window selector stays visible even with no data: when the last 7 days are empty, the
        next thing a merchant needs is a wider window, not a dead end. */}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-[var(--bk-console-text)]">Performance</h3>
        <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">Delivery, cost and return across your connected ad accounts.</p>
      </div>
      <div className="flex items-center gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-[var(--bk-console-text-subtle)]" aria-label="Updating performance" /> : null}
        {/* Which account the live figures are actually for is stated by the live panel itself, from
            the payload; this only asks for one. */}
        {picker.visible ? (
          <Select
            aria-label="Select ad account"
            wrapperClassName="w-52"
            value={picker.value}
            onChange={event => onChangeAccount(Number(event.target.value))}
            options={accountOptions}
          />
        ) : null}
        <Select
          aria-label="Select performance timeframe"
          wrapperClassName="w-36"
          value={String(days)}
          onChange={event => onChangeDays(Number(event.target.value))}
          options={ANALYTICS_WINDOWS.map(window => ({ value: String(window), label: `Last ${window} days` }))}
        />
      </div>
    </div>

    {/* Twelve zeros used to render here whenever the window was empty, which reads as a healthy
        account that spent nothing rather than as an absence of data. */}
    {pending ? (
      <><SkeletonCards count={4} /><SkeletonTable rows={4} /></>
    ) : empty ? (
      <div className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]">
        <EmptyState
          icon={BarChart3}
          title="No performance data in this window"
          description={`Nothing was recorded in the last ${days} days. Once an ad account is connected and its daily insights sync, spend, delivery and return appear here.`}
          action={days < 90 ? <Button variant="secondary" onClick={() => onChangeDays(90)}>Try the last 90 days</Button> : undefined}
        />
      </div>
    ) : liveReady ? (
      <>
        <LiveAnalyticsPanel live={live} />
        <PerformanceFunnelChart snapshot={liveFunnelSnapshot(live)} days={days} sourceNote={liveFunnelNote(live)} />
      </>
    ) : (
      /* Only reached when the platform could not be read at all: these tiles count purchases and
         revenue from our own tracked events, so they are the last resort, not the headline. */
      <>
        <PerformanceFunnelChart snapshot={snapshot} days={days} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map(([label, value]) => <StatCard key={label} label={label} value={value} />)}
        </div>
      </>
    )}
  </div>;
}
