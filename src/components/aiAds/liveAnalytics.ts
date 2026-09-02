import type { AiAdsLiveAnalytics, PerformanceSnapshot } from '../../services/aiAdsApi';
import { NO_VALUE, formatCount, formatPercent, formatRoas } from './aiAdsMetrics';

/**
 * Derivations for the live Analytics panel: `/api/ai-ads/performance/live`.
 *
 * The old panel read the stored snapshot, which sources purchases, revenue and ROAS from our
 * own `event_logs`. Client 47 has never sent us one event, so a real account that Meta itself
 * reported as "spend 32.43, 6 purchases, 21.01 revenue" rendered as spend with twelve zeros
 * beside it. These helpers shape the live payload instead, and they keep the platform's report,
 * our tracking and the confirmed order ledger as three labelled rows rather than one blended KPI.
 *
 * Everything here is pure so the arithmetic and the wording a merchant acts on are unit-tested
 * rather than eyeballed in a browser against a live ad account.
 */

const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/**
 * Money with the account's own currency code beside it.
 *
 * `formatMoney` in `aiAdsMetrics` deliberately prints no currency, because the stored snapshot
 * sums several accounts that may each bill in a different one. This payload is a single ad
 * account and carries its `currency`, so the code can be stated — and it has to be: "32.43"
 * next to a Bangladeshi merchant's dollar-billed account is the difference between a rounding
 * error and 120×. The code is printed rather than a symbol, because we are told `BDT`, not `৳`.
 */
export function formatLiveMoney(value?: number | null, currency?: string | null): string {
  const amount = finite(value);
  if (amount === null) return NO_VALUE;
  const printed = moneyFormat.format(amount);
  const code = String(currency || '').trim().toUpperCase();
  return code ? `${printed} ${code}` : printed;
}

/** The `tone` values `Badge` accepts. Declared here so the helpers can name one. */
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

/** The account's own currency, for every number derived from this payload. */
export function payloadCurrency(payload?: AiAdsLiveAnalytics | null): string | null {
  return payload?.account?.currency ?? payload?.platform?.currency ?? null;
}

export interface DeliveryState {
  label: string;
  tone: BadgeTone;
  /**
   * The on/off switch says ACTIVE while the platform is not actually running it. This is the
   * exact case the owner caught: the Campaigns tab showed two ACTIVE rows while Ads Manager's
   * Delivery column read "Ad off", because a campaign switch can be on with every ad under it
   * paused or rejected.
   */
  switchedOnButIdle: boolean;
  /** Why it is not running, when the platform told us. */
  detail: string | null;
}

/**
 * Meta's `effective_status` in the merchant's words. This is the field that decides delivery;
 * `status` is only the switch someone last flipped.
 */
const DELIVERY_STATES: Record<string, { label: string; tone: BadgeTone; detail?: string }> = {
  ACTIVE: { label: 'Delivering', tone: 'success' },
  PAUSED: { label: 'Paused', tone: 'neutral', detail: 'This one is switched off.' },
  ADSET_PAUSED: { label: 'Ad set paused', tone: 'warning', detail: 'This is switched on, but its ad set is paused.' },
  CAMPAIGN_PAUSED: { label: 'Campaign paused', tone: 'warning', detail: 'This is switched on, but its campaign is paused.' },
  DISAPPROVED: {
    label: 'Rejected by Meta', tone: 'danger',
    detail: 'Meta rejected this ad, so it cannot deliver until it is edited and passes review again.',
  },
  WITH_ISSUES: { label: 'Has issues', tone: 'danger', detail: 'Meta flagged a problem that is holding delivery back.' },
  PENDING_REVIEW: { label: 'In review', tone: 'info', detail: 'Meta has not finished reviewing this yet.' },
  IN_PROCESS: { label: 'In review', tone: 'info', detail: 'Meta is still processing this.' },
  PREAPPROVED: { label: 'Pre-approved', tone: 'info', detail: 'Approved ahead of its start time; it is not running yet.' },
  PENDING_BILLING_INFO: {
    label: 'Needs billing', tone: 'danger',
    detail: 'The ad account has no usable payment method, so nothing can run.',
  },
  ARCHIVED: { label: 'Archived', tone: 'neutral' },
  DELETED: { label: 'Deleted', tone: 'neutral' },
};

/** `CAMPAIGN_PAUSED` → `Campaign paused`, for a status Meta adds after this was written. */
function readableStatus(value: string): string {
  const words = value.toLowerCase().replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
}

/**
 * What the platform is really doing with one campaign, ad set or ad.
 *
 * A missing `effective_status` is not "off": it means the provider would not tell us, and saying
 * "Paused" there would be inventing a fact. That case reports the switch instead and says so.
 */
export function deliveryState(row: {
  status?: string | null;
  effective_status?: string | null;
  delivering?: boolean | null;
}): DeliveryState {
  const effective = String(row.effective_status || '').trim().toUpperCase();
  // A campaign the provider's insights edge billed but whose status edge did not return arrives as
  // the literal `"UNKNOWN"` (`live_performance.py:502`). That is the absence of an answer, so it is
  // read as one — "Switch: Unknown" would present a placeholder as a state someone had set.
  const rawSwitch = String(row.status || '').trim().toUpperCase();
  const switchState = rawSwitch === 'UNKNOWN' ? '' : rawSwitch;
  if (!effective) {
    if (row.delivering === true) {
      return { label: 'Delivering', tone: 'success', switchedOnButIdle: false, detail: null };
    }
    return {
      label: switchState ? `Switch: ${readableStatus(switchState)}` : 'Not reported',
      tone: 'neutral',
      switchedOnButIdle: false,
      detail: 'The platform did not report delivery for this row, so only the on/off switch is known.',
    };
  }
  const known = DELIVERY_STATES[effective] ?? { label: readableStatus(effective), tone: 'neutral' as BadgeTone };
  return {
    label: known.label,
    tone: known.tone,
    switchedOnButIdle: switchState === 'ACTIVE' && effective !== 'ACTIVE',
    detail: known.detail ?? null,
  };
}

export interface SourceNote {
  label: string;
  tone: BadgeTone;
  /** True only when these numbers were read from the platform during this request. */
  live: boolean;
}

/**
 * Where a half of the payload came from. The account read and the per-ad read fall back
 * differently, so each carries its own `source` and one may never be shown under the other's
 * label — a stored figure presented as live is how a merchant spends against stale data.
 */
export function describeSource(source?: string | null): SourceNote {
  switch (String(source || '').trim().toUpperCase()) {
    case 'PROVIDER_LIVE': return { label: 'Live from the platform', tone: 'success', live: true };
    case 'STORED_FALLBACK': return { label: 'Our last sync', tone: 'warning', live: false };
    case 'UNAVAILABLE': return { label: 'Could not be read', tone: 'danger', live: false };
    case 'NOT_REQUESTED': return { label: 'Not requested', tone: 'neutral', live: false };
    case 'NO_ACCOUNT': return { label: 'No account connected', tone: 'neutral', live: false };
    default: return { label: 'Source unknown', tone: 'neutral', live: false };
  }
}

export interface KpiTile {
  key: string;
  label: string;
  value: string;
  caption: string;
}

/**
 * The platform's own eight numbers for the window.
 *
 * These are Meta's figures, not ours, and the captions say which arithmetic produced each one.
 * Purchases and revenue here are the ones that used to read zero: they no longer depend on our
 * pixel having fired.
 */
export function platformKpis(payload?: AiAdsLiveAnalytics | null): KpiTile[] {
  const currency = payloadCurrency(payload);
  const totals = payload?.platform;
  const money = (value?: number | null) => formatLiveMoney(value, currency);
  return [
    { key: 'spend', label: 'Spend', value: money(totals?.spend), caption: 'What the platform billed in this window' },
    { key: 'purchases', label: 'Purchases', value: formatCount(totals?.purchases), caption: "The platform's own conversion count" },
    { key: 'revenue', label: 'Revenue', value: money(totals?.revenue), caption: 'Value the platform attributed to these ads' },
    { key: 'roas', label: 'ROAS', value: formatRoas(totals?.roas), caption: 'Attributed revenue ÷ spend' },
    { key: 'cpa', label: 'Cost per purchase', value: money(totals?.cpa), caption: 'Spend ÷ platform purchases' },
    { key: 'clicks', label: 'Clicks', value: formatCount(totals?.clicks), caption: `CTR ${formatPercent(totals?.ctr_percent)}` },
    { key: 'impressions', label: 'Impressions', value: formatCount(totals?.impressions), caption: `CPM ${money(totals?.cpm)}` },
    { key: 'cpc', label: 'Cost per click', value: money(totals?.cpc), caption: 'Spend ÷ clicks' },
  ];
}

export interface ViewRow {
  key: 'platform' | 'our_tracking' | 'store_orders';
  label: string;
  purchases: string;
  revenue: string;
  cpa: string;
  roas: string;
  note: string;
}

/**
 * The same window counted three ways, deliberately never averaged into one.
 *
 * Neither count is wrong: the platform credits a purchase inside its own attribution window,
 * our tracking only sees what the store sent us, and a cash-on-delivery order is not money until
 * it is delivered. Merging them would produce a KPI that is true on none of the three bases.
 *
 * A row that counted no purchase prints no cost per purchase and no ROAS. The backend sends 0 for
 * both there, and "0.00 BDT per purchase" beside "0 purchases" reads as free sales rather than as
 * an undefined ratio — the same rule the per-ad rows follow.
 */
export function threeViewRows(payload?: AiAdsLiveAnalytics | null): ViewRow[] {
  const currency = payloadCurrency(payload);
  const money = (value?: number | null) => formatLiveMoney(value, currency);
  const platform = payload?.platform;
  const ours = payload?.our_tracking;
  const orders = payload?.store_orders;
  const reconciliation = payload?.reconciliation;
  const ratio = (purchases: unknown, value: number | null | undefined, format: (input?: number | null) => string) =>
    (finite(purchases) ?? 0) > 0 ? format(value) : NO_VALUE;
  return [
    {
      key: 'platform',
      label: "The platform's own report",
      purchases: formatCount(platform?.purchases),
      revenue: money(platform?.revenue),
      cpa: ratio(platform?.purchases, platform?.cpa ?? reconciliation?.platform_cpa, money),
      roas: ratio(platform?.purchases, platform?.roas ?? reconciliation?.platform_roas, formatRoas),
      note: 'Counted by the ad platform inside its own attribution window.',
    },
    {
      key: 'our_tracking',
      label: 'Our server-side tracking',
      purchases: formatCount(ours?.purchases),
      revenue: money(ours?.revenue),
      cpa: ratio(ours?.purchases, reconciliation?.our_cpa, money),
      roas: ratio(ours?.purchases, reconciliation?.our_roas, formatRoas),
      note: 'Purchases your store sent us that we could tie back to these campaigns.',
    },
    {
      key: 'store_orders',
      label: 'Confirmed orders',
      purchases: formatCount(orders?.completed),
      revenue: money(orders?.completed_revenue),
      cpa: ratio(orders?.completed, reconciliation?.confirmed_cpa, money),
      roas: ratio(orders?.completed, reconciliation?.confirmed_roas, formatRoas),
      note: 'Only the attributed orders your store has marked complete — cash on delivery included.',
    },
  ];
}

export interface AdTableRow {
  /** 1-based rank by spend, straight from the backend. */
  index: number;
  adId: string;
  name: string;
  /** Campaign · ad set, so a row can be found again in Ads Manager. */
  place: string;
  delivery: DeliveryState;
  spend: string;
  purchases: string;
  revenue: string;
  cpa: string;
  roas: string;
  linkClicks: string;
  ctr: string;
  /** Two ads can carry the same name; then the rank is the only thing that separates them. */
  nameIsDuplicated: boolean;
  /** Took money in this window and returned no purchase. */
  spentWithoutSelling: boolean;
  /** The platform billed this ad id but would not tell us which ad it is. */
  structureMissing: boolean;
}

/**
 * One row per ad, ranked by spend.
 *
 * The account average is the number a merchant cannot act on: on the real test account "CPA 5.41"
 * hid that one ad sold everything while the others spent 18.72 for nothing. Rows that spent
 * nothing are kept — an ad that is on and not spending is also something to look at.
 */
export function adTableRows(payload?: AiAdsLiveAnalytics | null): AdTableRow[] {
  const currency = payloadCurrency(payload);
  const money = (value?: number | null) => formatLiveMoney(value, currency);
  const duplicated = new Set((payload?.ads?.duplicate_names ?? []).map(name => String(name)));
  return (payload?.ads?.rows ?? []).map(row => ({
    index: row.index,
    adId: String(row.ad_id ?? ''),
    name: String(row.ad_name || 'Unnamed ad'),
    place: [row.campaign_name, row.adset_name].filter(Boolean).join(' · '),
    delivery: deliveryState(row),
    spend: money(row.spend),
    purchases: formatCount(row.purchases),
    revenue: money(row.revenue),
    cpa: (finite(row.purchases) ?? 0) > 0 ? money(row.cpa) : NO_VALUE,
    roas: (finite(row.revenue) ?? 0) !== 0 ? formatRoas(row.roas) : NO_VALUE,
    linkClicks: formatCount(row.link_clicks),
    ctr: formatPercent(row.ctr_percent),
    nameIsDuplicated: duplicated.has(String(row.ad_name || '')),
    spentWithoutSelling: (finite(row.spend) ?? 0) > 0 && (finite(row.purchases) ?? 0) === 0,
    structureMissing: row.structure_missing === true,
  }));
}

export interface CampaignTableRow {
  campaignId: string;
  /** Only the last four digits are printed; the full id is not something a merchant needs. */
  maskedId: string;
  name: string;
  objective: string;
  delivery: DeliveryState;
  spend: string;
  purchases: string;
  revenue: string;
  cpa: string;
  roas: string;
  /** Took money in this window and returned no purchase. */
  spentWithoutSelling: boolean;
}

/**
 * One row per campaign as the platform reports it right now.
 *
 * This is the owner-reported defect in the Campaigns tab: it rendered our *synced* rows and printed
 * their `status`, which is only the switch someone last flipped. Two campaigns therefore read
 * `ACTIVE` while Ads Manager's Delivery column read "Ad off" — a campaign switch can be on with
 * every ad under it paused or rejected, and a merchant reading `ACTIVE` concludes the money is
 * working. `effective_status` is the field that decides delivery, and it only exists on the live
 * read, so the tab has to ask the platform rather than quote the sync.
 *
 * The backend already sorts by spend and already includes campaigns that spent nothing in the
 * window (`live_performance.py:_merge_campaigns`), because "27 campaigns, 3 of them on" is what a
 * merchant is comparing against. Neither is re-derived here.
 */
export function campaignTableRows(payload?: AiAdsLiveAnalytics | null): CampaignTableRow[] {
  const currency = payloadCurrency(payload);
  const money = (value?: number | null) => formatLiveMoney(value, currency);
  return (payload?.campaigns ?? []).map(row => {
    const id = String(row.campaign_id ?? '');
    return {
      campaignId: id,
      maskedId: id.length >= 4 ? `***${id.slice(-4)}` : '',
      name: String(row.campaign_name || 'Unnamed campaign'),
      objective: readableStatus(String(row.objective || '')),
      delivery: deliveryState(row),
      spend: money(row.spend),
      purchases: formatCount(row.purchases),
      revenue: money(row.revenue),
      cpa: (finite(row.purchases) ?? 0) > 0 ? money(row.cpa) : NO_VALUE,
      roas: (finite(row.revenue) ?? 0) !== 0 ? formatRoas(row.roas) : NO_VALUE,
      spentWithoutSelling: (finite(row.spend) ?? 0) > 0 && (finite(row.purchases) ?? 0) === 0,
    };
  });
}

export interface CampaignDeliveryNote {
  /** The count line: how many campaigns there are and how many are actually running. */
  headline: string;
  /**
   * The mismatch the owner caught, stated plainly, or null when there is none. Counted from the
   * rows because only `effective_status` beside `status` can show it.
   */
  mismatch: string | null;
  /** Present when the provider refused to give delivery status at all: claim nothing. */
  unreadable: string | null;
}

/**
 * What to say above the campaign table.
 *
 * `campaigns_total` / `campaigns_delivering` come from the backend when it read the status edge, and
 * `campaign_status_note` replaces them when it could not. In that second case no count of "on" or
 * "off" may be printed at all — the rows themselves already refuse to claim a state, and a headline
 * that said "0 delivering" would be the same false certainty in bigger type.
 */
export function campaignDeliveryNote(payload?: AiAdsLiveAnalytics | null): CampaignDeliveryNote | null {
  const rows = payload?.campaigns ?? [];
  if (!rows.length) return null;
  const unreadable = payload?.reconciliation?.campaign_status_note ?? null;
  const total = finite(payload?.reconciliation?.campaigns_total) ?? rows.length;
  if (unreadable) {
    return {
      headline: `${total} ${total === 1 ? 'campaign' : 'campaigns'} in this account.`,
      mismatch: null,
      unreadable,
    };
  }
  const delivering = finite(payload?.reconciliation?.campaigns_delivering)
    ?? rows.filter(row => row.delivering === true).length;
  const idle = rows.filter(row => deliveryState(row).switchedOnButIdle).length;
  return {
    headline: `${total} ${total === 1 ? 'campaign' : 'campaigns'} · ${delivering} delivering right now.`,
    mismatch: idle > 0
      ? `${idle === 1 ? '1 campaign is' : `${idle} campaigns are`} switched on but not delivering, which is what `
        + 'Ads Manager shows as "Off" in its Delivery column.'
      : null,
    unreadable: null,
  };
}

/**
 * The one sentence worth putting above the table, or nothing.
 *
 * The backend already counts this (`spend_without_purchase`), so it is not recomputed from the
 * rows: the totals cover every ad in the window, while the rows can be capped by `ad_limit`.
 */
export function wastedSpendNote(payload?: AiAdsLiveAnalytics | null): string | null {
  const totals = payload?.ads?.totals;
  const count = finite(totals?.spending_without_purchase_count) ?? 0;
  const spend = finite(totals?.spend_without_purchase) ?? 0;
  if (count <= 0 || spend <= 0) return null;
  const subject = count === 1 ? '1 ad spent' : `${count} ads spent`;
  return `${subject} ${formatLiveMoney(spend, payloadCurrency(payload))} in this window without a single purchase.`;
}

/** The signals that decide whether there is anything at all to show. */
const LIVE_SIGNALS = ['spend', 'impressions', 'clicks', 'purchases', 'revenue'] as const;

/**
 * Whether this payload has nothing to report.
 *
 * `isEmptySnapshot` cannot answer this: it reads the stored snapshot, whose purchases and revenue
 * come from our tracking, so it would have called the real client-47 account empty and hidden the
 * 32.43 the platform did bill. Any single non-zero platform signal counts as activity, and so does
 * a single ad row — an ad that is on and spending nothing is still a fact worth showing.
 */
export function isEmptyLive(payload?: AiAdsLiveAnalytics | null): boolean {
  if (!payload || !payload.account) return true;
  if ((payload.ads?.rows?.length ?? 0) > 0) return false;
  const totals = payload.platform;
  if (!totals) return true;
  return LIVE_SIGNALS.every(key => (finite(totals[key]) ?? 0) === 0);
}

/**
 * Whether this payload carries the per-ad half at all.
 *
 * The page fetches that half only for the Analytics tab, because it is what makes the read slow
 * (`fetchAiAdsLiveAnalytics`). A payload fetched without it answers every other tab completely, but
 * it is *not* an answer for the ad ranking: `NOT_REQUESTED` renders as "Not requested" beside an
 * empty table whose wording says the breakdown "could not be read from the platform just now" —
 * which would be untrue. Analytics therefore waits for a payload this returns `true` for.
 *
 * `UNAVAILABLE` and `NO_ACCOUNT` both count as answered: the platform was asked and that was the
 * answer, so asking again changes nothing.
 */
export function hasLiveAdBreakdown(payload?: AiAdsLiveAnalytics | null): boolean {
  if (!payload) return false;
  return String(payload.ads?.source || '').trim().toUpperCase() !== 'NOT_REQUESTED';
}

/**
 * The live platform totals shaped as a `PerformanceSnapshot`, so the existing funnel chart can draw
 * them.
 *
 * The chart's three stages are impressions → clicks → purchases, which the platform reports for
 * itself; pointing it at the stored snapshot instead would draw a funnel whose last stage came from
 * our own event log while the KPI grid above it showed the platform's count. `attribution_quality`
 * has no live counterpart and the funnel does not read it, so it stays at zero rather than being
 * invented. Returns null when there is nothing to draw.
 */
export function liveFunnelSnapshot(payload?: AiAdsLiveAnalytics | null): PerformanceSnapshot | null {
  const totals = payload?.platform;
  if (!totals) return null;
  const value = (key: keyof typeof totals): number => finite(totals[key]) ?? 0;
  const clicks = value('clicks');
  const purchases = value('purchases');
  const revenue = value('revenue');
  return {
    spend: value('spend'),
    impressions: value('impressions'),
    clicks,
    ctr: value('ctr_percent'),
    cpc: value('cpc'),
    cpm: value('cpm'),
    conversions: purchases,
    cpa: value('cpa'),
    revenue,
    roas: value('roas'),
    conversion_rate: clicks > 0 ? Math.round((purchases / clicks) * 10000) / 100 : 0,
    aov: purchases > 0 ? Math.round((revenue / purchases) * 100) / 100 : 0,
    attribution_quality: 0,
  };
}

/** "MM.com · ***4702 · BDT · Asia/Dhaka", from whichever of those the payload actually carries. */
export function describeAccount(payload?: AiAdsLiveAnalytics | null): string | null {
  const account = payload?.account;
  if (!account) return null;
  const parts = [account.account_name, account.masked_account_id, account.currency, account.timezone];
  const described = parts.map(part => String(part || '').trim()).filter(Boolean);
  return described.length ? described.join(' · ') : null;
}

/** "Last 7 days · 2026-08-23 to 2026-08-29", or just the window when the dates are absent. */
export function describePeriod(payload?: AiAdsLiveAnalytics | null): string {
  const days = finite(payload?.period?.days) ?? 0;
  const window = days === 1 ? 'Today' : `Last ${days || 7} days`;
  const since = payload?.period?.since;
  const until = payload?.period?.until;
  return since && until ? `${window} · ${since} to ${until}` : window;
}
