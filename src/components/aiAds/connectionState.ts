import type { AiAdsAdAccount, AiAdsConnection } from '../../services/aiAdsApi';
import type { BadgeTone } from './liveAnalytics';

/**
 * What state a provider connection and each of its ad accounts is actually in.
 *
 * The Accounts tab used to render two fixed blue "Connect" buttons and a "Select" button on every
 * ad account row, whatever the server had already recorded. A merchant whose Meta account was
 * connected and linked therefore saw the same screen as one who had never connected anything: the
 * only invitation was to connect again, and after selecting an account nothing on the page changed.
 * Both readings were wrong in the direction that costs money — a merchant re-runs OAuth on a live
 * connection, or links a second account believing the first one never took.
 *
 * The derivations live here, pure and unit-tested, because the wording is what a merchant acts on:
 * "Connected" must never appear over a token the platform will refuse, and "Selected" must never
 * appear over an account we are not reading.
 */

/**
 * Whether a connection still has anything left to disconnect.
 *
 * A disconnect does not delete the row — the server sets `status="disconnected"` and
 * `permission_status="revoked"` (`app/services/ads/credential_lifecycle.py:320`) and the card stays
 * on screen. With an unconditional button a second click emailed another one-time code for work the
 * server then reports as `repeated`. Only `status` is consulted: a connection whose token has
 * `expired` or needs `reauth_required` is still live enough to be worth disconnecting, and hiding
 * the button there would strand the merchant with a connection they cannot remove.
 */
export const connectionIsLive = (connection: Pick<AiAdsConnection, 'status'>): boolean => {
  const status = String(connection.status ?? '').trim().toLowerCase();
  return status !== 'disconnected' && status !== 'revoked';
};

export interface ConnectionHealth {
  /** True only when the platform will still answer for this connection. */
  readable: boolean;
  label: string;
  tone: BadgeTone;
  detail: string;
}

/**
 * How healthy a live connection is, in the merchant's words.
 *
 * The server writes `status` as one of `active` / `expiring` / `expired` / `refreshing` /
 * `reauth_required` (`app/services/ads/credential_lifecycle.py`) and `permission_status` as
 * `granted` / `degraded` / `revoked` / `unknown`. Only some of those can still read, and the ones
 * that cannot are exactly the ones where a merchant needs to be sent back through OAuth rather
 * than reassured with a green "Connected".
 */
export function connectionHealth(connection: Pick<AiAdsConnection, 'status' | 'permission_status' | 'token_status'>): ConnectionHealth {
  const status = String(connection.status ?? '').trim().toLowerCase();
  const permission = String(connection.permission_status ?? '').trim().toLowerCase();
  const token = String(connection.token_status ?? '').trim().toLowerCase();
  if (permission === 'revoked') {
    return {
      readable: false, label: 'Permission removed', tone: 'danger',
      detail: 'The permission was removed at the ad platform, so nothing can be read until you connect again.',
    };
  }
  if (status === 'reauth_required') {
    return {
      readable: false, label: 'Sign in again', tone: 'danger',
      detail: 'The ad platform wants a fresh sign-in before it will answer for this account.',
    };
  }
  if (status === 'expired' || token === 'expired') {
    return {
      readable: false, label: 'Permission expired', tone: 'danger',
      detail: 'The saved permission has expired, so spend and results cannot be read until you connect again.',
    };
  }
  if (status === 'expiring') {
    return {
      readable: true, label: 'Expiring soon', tone: 'warning',
      detail: 'This still works, but the saved permission is close to expiring. Connecting again renews it.',
    };
  }
  if (permission === 'degraded') {
    return {
      readable: true, label: 'Connected, limited', tone: 'warning',
      detail: 'Some of the permissions we asked for were not granted, so parts of the account cannot be read.',
    };
  }
  if (status === 'refreshing') {
    return {
      readable: true, label: 'Renewing', tone: 'info',
      detail: 'The saved permission is being renewed. Nothing needs doing.',
    };
  }
  return {
    readable: true, label: 'Connected', tone: 'success',
    detail: 'Permissions granted. The assistant can read this account.',
  };
}

export interface ProviderCardState {
  /** The live connection this card is about, or null when the provider is not connected. */
  connection: AiAdsConnection | null;
  connected: boolean;
  /** Only set for a live connection: nothing is claimed about a provider we have never connected. */
  badge: { label: string; tone: BadgeTone } | null;
  detail: string;
  /** The one thing this card offers. A healthy connection is offered a disconnect, not a connect. */
  action: { kind: 'connect' | 'reconnect' | 'disconnect'; label: string; variant: 'primary' | 'secondary' };
}

/**
 * The provider card at the top of the Accounts tab: Meta, then TikTok.
 *
 * This is the owner-reported defect — the Meta card showed a primary "Connect" while Meta was
 * connected and spending. The card now offers exactly one action, and which one is decided by
 * whether the platform will still answer: a connection that cannot read is offered "Reconnect",
 * and a healthy one is offered "Disconnect". Disconnected rows are ignored here; the connection
 * card below keeps its own history and says "Already disconnected".
 *
 * `GET /ai-ads/connections` orders newest first (`ad_oauth.py:126`), so when a merchant has
 * reconnected and the old row is still live, the newest is the one whose state is shown.
 */
export function providerCardState(connections: AiAdsConnection[] | null | undefined, provider: string): ProviderCardState {
  const connection = (connections ?? []).find(item => item.provider === provider && connectionIsLive(item)) ?? null;
  if (!connection) {
    return {
      connection: null,
      connected: false,
      badge: null,
      detail: 'Official OAuth connection. Nothing is read until you connect.',
      action: { kind: 'connect', label: 'Connect', variant: 'primary' },
    };
  }
  const health = connectionHealth(connection);
  return {
    connection,
    connected: true,
    badge: { label: health.label, tone: health.tone },
    detail: health.detail,
    action: health.readable
      ? { kind: 'disconnect', label: 'Disconnect', variant: 'secondary' }
      : { kind: 'reconnect', label: 'Reconnect', variant: 'primary' },
  };
}

export interface AccountLinkState {
  /** Our own ad-account row exists and is active: this account is linked to AI Ads. */
  selected: boolean;
  /** The row exists but is switched off — what a disconnect leaves behind. */
  deactivated: boolean;
  /** The account the Analytics tab reported reading, so a merchant can see which one is in use. */
  readsAnalytics: boolean;
  badge: { label: string; tone: BadgeTone } | null;
  /** Null for an already-selected account: there is nothing left to press. */
  action: { label: string; variant: 'primary' | 'secondary' } | null;
  /**
   * The linked row's `last_synced_at`: a timestamp when it has synced, `null` when it is linked and
   * has never synced, and `undefined` when we do not know — an unlinked account, or a list we could
   * not read.
   */
  lastSyncedAt?: string | null;
}

/**
 * Whether one ad account offered by the OAuth connection is linked to AI Ads, and what to say.
 *
 * `POST /ai-ads/connections/select-account` upserts an `AdAccount` row and sets `is_active=True`
 * (`app/services/ads/oauth_service.py:257`); it does not deactivate the others, so several accounts
 * can be linked at once and "which one am I looking at" is a real question. That is why the account
 * the Analytics read actually used is marked from the payload's own `account.ad_account_id` rather
 * than re-derived here: the backend picks the most recently synced active account
 * (`app/routers/ai_ads.py:316`) and a second copy of that rule in the browser would drift.
 *
 * `accounts` is `null` when `GET /ad-accounts` could not be read. Nothing is then claimed about
 * this row: it keeps its Select button and gets no badge, because "not selected" and "we could not
 * check" are different facts and only one of them is true.
 */
export function accountLinkState(
  accounts: AiAdsAdAccount[] | null | undefined,
  provider: string,
  externalId: string,
  analyticsAccountId?: number | null,
): AccountLinkState {
  const unknown: AccountLinkState = {
    selected: false, deactivated: false, readsAnalytics: false, badge: null,
    action: { label: 'Select', variant: 'secondary' },
  };
  if (!Array.isArray(accounts) || !externalId) return unknown;
  const linked = accounts.find(item =>
    String(item.external_account_id ?? '') === externalId
    && String(item.platform ?? '').toLowerCase() === String(provider ?? '').toLowerCase());
  if (!linked) return unknown;
  if (linked.is_active === false) {
    return {
      selected: false,
      deactivated: true,
      readsAnalytics: false,
      badge: { label: 'Stopped syncing', tone: 'neutral' },
      action: { label: 'Select again', variant: 'secondary' },
      lastSyncedAt: linked.last_synced_at ?? null,
    };
  }
  return {
    selected: true,
    deactivated: false,
    readsAnalytics: typeof analyticsAccountId === 'number' && linked.id === analyticsAccountId,
    badge: { label: 'Selected', tone: 'success' },
    action: null,
    lastSyncedAt: linked.last_synced_at ?? null,
  };
}

export interface AnalyticsAccountChoice {
  /** Our own `AdAccount.id` — what `/ai-ads/performance/live?account_id=` expects. */
  id: number;
  platform: string;
  /** The platform's name for the account, or '' when it never sent one. */
  name: string;
  externalId: string;
}

/**
 * The linked ad accounts the Analytics tab may be pointed at.
 *
 * Selecting an account links it without unlinking the others, so a merchant can hold several at
 * once while Analytics reads exactly one — and until the portal sent an `account_id` the one it read
 * was whichever the backend ranked first. These are the accounts it is safe to offer: only an
 * *active* row, because `require_account` builds its allow-list from the client's active
 * `AdAccount` ids and an inactive one is a 404, and only a real numeric id, because a malformed row
 * would otherwise become an option that always fails.
 *
 * Order is the caller's list order, which is the same order the Accounts tab shows. Duplicate ids
 * are dropped rather than rendered twice: two `<option>`s with one value cannot be told apart.
 * `null` (the list could not be read) yields no choices, so the picker disappears and the backend
 * default stays in charge instead of the merchant being offered a guess.
 */
export function analyticsAccountChoices(accounts: AiAdsAdAccount[] | null | undefined): AnalyticsAccountChoice[] {
  if (!Array.isArray(accounts)) return [];
  const seen = new Set<number>();
  const choices: AnalyticsAccountChoice[] = [];
  for (const account of accounts) {
    const id = account?.id;
    if (typeof id !== 'number' || !Number.isFinite(id) || account.is_active === false || seen.has(id)) continue;
    seen.add(id);
    choices.push({
      id,
      platform: String(account.platform ?? ''),
      name: String(account.account_name ?? '').trim(),
      externalId: String(account.external_account_id ?? ''),
    });
  }
  return choices;
}

/**
 * Whether to offer the Analytics account picker at all, and what it should show as selected.
 *
 * Two rules, both about not misleading the merchant:
 * - One linked account is no choice and none is no question, so the control only exists from two
 *   accounts up. Below that the backend's own pick is the only possible answer anyway.
 * - A native `<select>` whose value matches no option displays its *first* option, which would name
 *   an account the figures on screen did not come from. So when the selection is unknown — the live
 *   read failed, or the merchant's account has just been unlinked — the caller is told to render a
 *   placeholder instead of letting the browser invent a selection.
 */
export function analyticsPickerState(
  choices: AnalyticsAccountChoice[],
  selectedId: number | null | undefined,
): { visible: boolean; value: string; placeholder: boolean } {
  const matched = typeof selectedId === 'number' && choices.some(choice => choice.id === selectedId);
  return {
    visible: choices.length > 1,
    value: matched ? String(selectedId) : '',
    placeholder: !matched,
  };
}
