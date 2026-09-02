import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adTableRows,
  campaignDeliveryNote,
  campaignTableRows,
  deliveryState,
  describeAccount,
  describePeriod,
  describeSource,
  formatLiveMoney,
  hasLiveAdBreakdown,
  isEmptyLive,
  liveFunnelSnapshot,
  platformKpis,
  threeViewRows,
  wastedSpendNote,
} from './liveAnalytics';
import { NO_VALUE } from './aiAdsMetrics';
import type { AiAdsLiveAnalytics, LiveAdRow, LiveCampaignRow } from '../../services/aiAdsApi';

/**
 * The account these are shaped after is the real one the owner reported: Meta billed 32.43 BDT
 * and reported 6 purchases for the week, while our own tracking has never seen a single event
 * from that store. One ad sold everything; two others spent 18.72 for nothing.
 */
const adRow = (index: number, overrides: Partial<LiveAdRow> = {}): LiveAdRow => ({
  index,
  ad_id: `120245862985880${index}`,
  ad_name: 'Sunglass contant',
  campaign_name: 'Snh BD 30$ Per Day',
  adset_name: 'Sns BD 30',
  status: 'ACTIVE',
  effective_status: 'CAMPAIGN_PAUSED',
  delivering: false,
  has_results: true,
  spend: 13.71,
  impressions: 9000,
  clicks: 400,
  link_clicks: 351,
  ctr_percent: 4.4,
  cpc: 0.03,
  purchases: 6,
  revenue: 21.01,
  cpa: 2.29,
  roas: 1.53,
  ...overrides,
});

const payload = (overrides: Partial<AiAdsLiveAnalytics> = {}): AiAdsLiveAnalytics => ({
  account: {
    ad_account_id: 14, platform: 'meta', account_name: 'MM.com',
    masked_account_id: '***4702', currency: 'BDT', timezone: 'Asia/Dhaka',
  },
  period: { days: 7, since: '2026-08-23', until: '2026-08-29' },
  fetched_at: '2026-08-29T05:00:00+00:00',
  source: 'PROVIDER_LIVE',
  data_notice: null,
  platform: {
    source: 'provider_live', currency: 'BDT', spend: 32.43, impressions: 51646, clicks: 4039,
    purchases: 6, revenue: 21.01, ctr_percent: 7.82, cpc: 0.008, cpm: 0.63, cpa: 5.41, roas: 0.65,
  },
  our_tracking: { source: 'buykori_server_side_tracking', purchases: 0, distinct_orders: 0, revenue: 0, currency: 'BDT', aov: 0 },
  store_orders: {
    source: 'store_orders', attributed_orders: 0, completed: 0, still_open: 0,
    cancelled_or_refunded: 0, other: 0, completed_revenue: 0, currency: 'BDT',
  },
  reconciliation: {
    platform_purchases: 6, our_purchases: 0, purchase_delta: -6, agreement: 'PLATFORM_COUNT_HIGHER',
    platform_cpa: 5.41, our_cpa: 0, confirmed_cpa: 0, platform_roas: 0.65, our_roas: 0,
    confirmed_roas: 0, confirmed_orders: 0, confirmed_revenue: 0,
  },
  campaigns: [],
  ads: {
    source: 'PROVIDER_LIVE',
    rows: [
      adRow(1),
      adRow(2, { ad_id: '1202458629858802', spend: 9.4, purchases: 0, revenue: 0, cpa: null, roas: null, link_clicks: 120 }),
      adRow(3, { ad_id: '1202458629858803', ad_name: 'New Engagement ad', spend: 9.32, purchases: 0, revenue: 0, cpa: null, roas: null }),
    ],
    totals: {
      entity_count: 3, delivering_count: 0, spend: 32.43, purchases: 6,
      spend_without_purchase: 18.72, spending_without_purchase_count: 2,
    },
    duplicate_names: ['Sunglass contant'],
    data_notice: null,
  },
  ...overrides,
});

test('money states the account currency, because the account has exactly one', () => {
  // "32.43" beside a dollar-billed account instead of a taka one is a 120x misreading.
  assert.equal(formatLiveMoney(32.43, 'BDT'), '32.43 BDT');
  assert.equal(formatLiveMoney(1240.5, 'usd'), '1,240.50 USD');
  assert.equal(formatLiveMoney(0, 'BDT'), '0.00 BDT');
  assert.equal(formatLiveMoney(12, null), '12.00');
  assert.equal(formatLiveMoney(null, 'BDT'), NO_VALUE);
  assert.equal(formatLiveMoney(undefined, 'BDT'), NO_VALUE);
});

// The whole point of the fix: these two numbers used to come from our own event log, which is
// empty for this client, so a spending account rendered as "purchases 0, revenue 0".
test("the platform's purchases and revenue survive an empty tracking view", () => {
  const tiles = platformKpis(payload());
  const value = (key: string) => tiles.find(tile => tile.key === key)?.value;

  assert.equal(value('purchases'), '6');
  assert.equal(value('revenue'), '21.01 BDT');
  assert.equal(value('roas'), '0.65×');
  assert.equal(value('spend'), '32.43 BDT');
  assert.equal(value('cpa'), '5.41 BDT');
});

test('the three views stay three labelled rows and are never averaged', () => {
  const rows = threeViewRows(payload());

  assert.deepEqual(rows.map(row => row.key), ['platform', 'our_tracking', 'store_orders']);
  assert.equal(rows[0].purchases, '6');
  assert.equal(rows[1].purchases, '0');
  assert.equal(rows[2].purchases, '0');
  assert.equal(rows[0].revenue, '21.01 BDT');
  assert.equal(rows[1].revenue, '0.00 BDT');
  assert.ok(rows.every(row => row.note.length > 0));
});

// The backend sends cpa 0 / roas 0 for a view that counted nothing. Printed as "0.00 BDT" beside
// "0 purchases" that reads as free sales instead of as a ratio with no denominator.
test('a view that counted no purchase shows no cost per purchase and no ROAS', () => {
  const rows = threeViewRows(payload());

  assert.equal(rows[0].cpa, '5.41 BDT');
  assert.equal(rows[0].roas, '0.65×');
  assert.equal(rows[1].cpa, NO_VALUE);
  assert.equal(rows[1].roas, NO_VALUE);
  assert.equal(rows[2].cpa, NO_VALUE);
  assert.equal(rows[2].roas, NO_VALUE);
});

test('every ad keeps its own row, its rank and its place in the account', () => {
  const rows = adTableRows(payload());

  assert.deepEqual(rows.map(row => row.index), [1, 2, 3]);
  assert.deepEqual(rows.map(row => row.spend), ['13.71 BDT', '9.40 BDT', '9.32 BDT']);
  assert.equal(rows[0].place, 'Snh BD 30$ Per Day · Sns BD 30');
  assert.equal(rows[0].purchases, '6');
  assert.equal(rows[0].roas, '1.53×');
});

// Two ads of the same product share a name here, so the row number is the only separator.
test('a repeated ad name is flagged on every row that carries it', () => {
  const rows = adTableRows(payload());

  assert.deepEqual(rows.map(row => row.nameIsDuplicated), [true, true, false]);
});

test('an ad that spent and sold nothing is marked, and shows no invented CPA or ROAS', () => {
  const rows = adTableRows(payload());

  assert.deepEqual(rows.map(row => row.spentWithoutSelling), [false, true, true]);
  assert.equal(rows[1].cpa, NO_VALUE);
  assert.equal(rows[1].roas, NO_VALUE);
  assert.equal(rows[1].linkClicks, '120');
});

test('the wasted-spend line counts from the totals, not from the capped rows', () => {
  assert.equal(
    wastedSpendNote(payload()),
    '2 ads spent 18.72 BDT in this window without a single purchase.',
  );
  const one = payload();
  one.ads.totals = { spend_without_purchase: 9.4, spending_without_purchase_count: 1 };
  assert.equal(wastedSpendNote(one), '1 ad spent 9.40 BDT in this window without a single purchase.');

  const clean = payload();
  clean.ads.totals = { spend_without_purchase: 0, spending_without_purchase_count: 0 };
  assert.equal(wastedSpendNote(clean), null);
});

const campaignRow = (overrides: Partial<LiveCampaignRow> = {}): LiveCampaignRow => ({
  campaign_id: '23861234567890123',
  campaign_name: 'Snh BD 30$ Per Day',
  status: 'ACTIVE',
  effective_status: 'ACTIVE',
  delivering: true,
  objective: 'OUTCOME_SALES',
  spend: 13.71,
  impressions: 9000,
  clicks: 400,
  purchases: 6,
  revenue: 21.01,
  ctr_percent: 4.4,
  cpc: 0.03,
  cpa: 2.29,
  roas: 1.53,
  ...overrides,
});

/**
 * The account's real shape for the owner's issue #4: one campaign genuinely running, one whose
 * switch is on while the platform is not delivering it (Ads Manager prints "Off"), and one the
 * insights edge billed but the status edge never described.
 */
const campaignPayload = () => payload({
  campaigns: [
    campaignRow(),
    campaignRow({
      campaign_id: '23861234567890124', campaign_name: 'Sunglass retarget',
      effective_status: 'PAUSED', delivering: false,
      spend: 9.4, purchases: 0, revenue: 0, cpa: 0, roas: 0,
    }),
    campaignRow({
      campaign_id: '23861234567890125', campaign_name: 'Engagement test',
      status: 'UNKNOWN', effective_status: null, delivering: null,
      objective: null, spend: 9.32, purchases: 0, revenue: 0, cpa: 0, roas: 0,
    }),
  ],
  reconciliation: { ...payload().reconciliation!, campaigns_total: 3, campaigns_delivering: 1 },
});

test('a campaign row reports what the platform is delivering, not the switch someone flipped', () => {
  const rows = campaignTableRows(campaignPayload());

  assert.deepEqual(rows.map(row => row.delivery.label), ['Delivering', 'Paused', 'Not reported']);
  assert.deepEqual(rows.map(row => row.delivery.switchedOnButIdle), [false, true, false]);
  assert.deepEqual(rows.map(row => row.spend), ['13.71 BDT', '9.40 BDT', '9.32 BDT']);
  assert.equal(rows[0].maskedId, '***0123');
  assert.equal(rows[0].objective, 'Outcome sales');
  assert.equal(rows[0].purchases, '6');
  assert.equal(rows[0].revenue, '21.01 BDT');
  assert.equal(rows[0].roas, '1.53×');
  assert.equal(rows[0].cpa, '2.29 BDT');
  assert.deepEqual(rows.map(row => row.spentWithoutSelling), [false, true, true]);
  assert.equal(campaignTableRows(payload()).length, 0);
});

// The backend sends cpa 0 / roas 0 for a campaign that sold nothing; printed as money that reads
// as a free sale rather than as a ratio with no denominator.
test('a campaign that sold nothing shows no cost per purchase and no ROAS', () => {
  const rows = campaignTableRows(campaignPayload());

  assert.equal(rows[1].cpa, NO_VALUE);
  assert.equal(rows[1].roas, NO_VALUE);
  assert.equal(rows[1].purchases, '0');
  assert.equal(rows[1].revenue, '0.00 BDT');
});

test('an unnamed campaign is still a row, and a short id is not masked into nonsense', () => {
  const odd = payload({ campaigns: [campaignRow({ campaign_id: '12', campaign_name: '', objective: null })] });
  const rows = campaignTableRows(odd);

  assert.equal(rows[0].name, 'Unnamed campaign');
  assert.equal(rows[0].maskedId, '');
  assert.equal(rows[0].objective, '');
});

// The owner's complaint stated back to them: two rows read ACTIVE while Ads Manager said "Ad off".
test('the summary counts what is delivering and names the switched-on-but-idle gap', () => {
  const note = campaignDeliveryNote(campaignPayload());

  assert.equal(note?.headline, '3 campaigns · 1 delivering right now.');
  assert.match(String(note?.mismatch), /1 campaign is switched on but not delivering/);
  assert.match(String(note?.mismatch), /Ads Manager/);
  assert.equal(note?.unreadable, null);
  assert.equal(campaignDeliveryNote(payload()), null);
});

test('with nothing idle the summary makes no accusation', () => {
  const clean = payload({
    campaigns: [campaignRow()],
    reconciliation: { ...payload().reconciliation!, campaigns_total: 1, campaigns_delivering: 1 },
  });

  assert.equal(campaignDeliveryNote(clean)?.headline, '1 campaign · 1 delivering right now.');
  assert.equal(campaignDeliveryNote(clean)?.mismatch, null);
});

// When the status edge failed, "0 delivering" would be the same false certainty in bigger type.
test('an unreadable delivery status prints no on/off count at all', () => {
  const blind = campaignPayload();
  blind.reconciliation = {
    ...blind.reconciliation!,
    campaigns_delivering: undefined,
    campaign_status_note: 'Delivery status was not readable for this account.',
  };
  const note = campaignDeliveryNote(blind);

  assert.equal(note?.headline, '3 campaigns in this account.');
  assert.equal(note?.mismatch, null);
  assert.equal(note?.unreadable, 'Delivery status was not readable for this account.');
});

// The owner's issue #4: the tab showed ACTIVE while Ads Manager's Delivery column read "Ad off".
// `status` is the switch someone flipped; `effective_status` is what the platform is doing.
test('a switched-on row that is not delivering says so instead of reading ACTIVE', () => {
  const paused = deliveryState({ status: 'ACTIVE', effective_status: 'CAMPAIGN_PAUSED' });
  assert.equal(paused.label, 'Campaign paused');
  assert.equal(paused.tone, 'warning');
  assert.equal(paused.switchedOnButIdle, true);
  assert.ok(paused.detail);

  const live = deliveryState({ status: 'ACTIVE', effective_status: 'ACTIVE' });
  assert.equal(live.label, 'Delivering');
  assert.equal(live.tone, 'success');
  assert.equal(live.switchedOnButIdle, false);
});

// The real account's only ad under its only live campaign: Meta had rejected it, and the UI
// never said so, which is why the owner saw spend against an ad that could not run.
test('a rejection is named as a rejection', () => {
  const rejected = deliveryState({ status: 'ACTIVE', effective_status: 'DISAPPROVED' });

  assert.equal(rejected.label, 'Rejected by Meta');
  assert.equal(rejected.tone, 'danger');
  assert.equal(rejected.switchedOnButIdle, true);
  assert.match(String(rejected.detail), /review/i);
});

test('an unreadable delivery status reports the switch and admits which one it is', () => {
  const unknown = deliveryState({ status: 'ACTIVE', effective_status: null });

  assert.equal(unknown.label, 'Switch: Active');
  assert.equal(unknown.tone, 'neutral');
  assert.equal(unknown.switchedOnButIdle, false);
  assert.match(String(unknown.detail), /did not report/i);

  // The campaign reader sets `delivering` itself when it has read the status.
  assert.equal(deliveryState({ status: 'ACTIVE', delivering: true }).label, 'Delivering');
  assert.equal(deliveryState({}).label, 'Not reported');
  // A campaign the insights edge billed but the status edge never returned carries the literal
  // "UNKNOWN" switch. That is the absence of an answer, not a state a merchant set.
  assert.equal(deliveryState({ status: 'UNKNOWN', effective_status: null }).label, 'Not reported');
  assert.equal(deliveryState({ status: 'unknown' }).switchedOnButIdle, false);
});

test('a status Meta adds later is printed readably rather than dropped', () => {
  const future = deliveryState({ status: 'ACTIVE', effective_status: 'SOME_NEW_STATE' });

  assert.equal(future.label, 'Some new state');
  assert.equal(future.tone, 'neutral');
  assert.equal(future.switchedOnButIdle, true);
});

// The two halves of the payload fall back differently, so neither may borrow the other's label.
test('each source is described on its own terms', () => {
  assert.equal(describeSource('PROVIDER_LIVE').live, true);
  assert.equal(describeSource('STORED_FALLBACK').live, false);
  assert.equal(describeSource('STORED_FALLBACK').tone, 'warning');
  assert.equal(describeSource('UNAVAILABLE').tone, 'danger');
  assert.equal(describeSource('NOT_REQUESTED').label, 'Not requested');
  assert.equal(describeSource('NO_ACCOUNT').label, 'No account connected');
  assert.equal(describeSource(null).label, 'Source unknown');
});

// `isEmptySnapshot` would have called this account empty: its purchases and revenue come from
// our tracking, which is at zero, so the 32.43 the platform billed would have been hidden.
test('platform spend alone counts as activity', () => {
  assert.equal(isEmptyLive(payload()), false);

  const noAccount = payload({ account: null });
  assert.equal(isEmptyLive(noAccount), true);

  const silent = payload();
  silent.platform = {
    source: 'provider_live', currency: 'BDT', spend: 0, impressions: 0, clicks: 0,
    purchases: 0, revenue: 0, ctr_percent: 0, cpc: 0, cpm: 0, cpa: 0, roas: 0,
  };
  silent.ads = { source: 'PROVIDER_LIVE', rows: [], totals: {}, duplicate_names: [], data_notice: null };
  assert.equal(isEmptyLive(silent), true);

  // An ad that exists and spends nothing is still worth showing.
  silent.ads.rows = [adRow(1, { spend: 0, purchases: 0, revenue: 0, has_results: false })];
  assert.equal(isEmptyLive(silent), false);
  assert.equal(isEmptyLive(null), true);
});

/**
 * `NOT_REQUESTED` is the one source that means nobody asked, and it is not a fallback: the panel's
 * empty ad table says the breakdown "could not be read from the platform just now", which would be
 * untrue. Every other source — including the failures — is an answer, so the tab renders it.
 */
test('only NOT_REQUESTED counts as an unasked ad breakdown', () => {
  assert.equal(hasLiveAdBreakdown(payload()), true);
  assert.equal(hasLiveAdBreakdown(null), false);

  const notRequested = payload();
  notRequested.ads = { source: 'NOT_REQUESTED', rows: [], totals: {}, duplicate_names: [], data_notice: null };
  assert.equal(hasLiveAdBreakdown(notRequested), false);
  // Case and stray whitespace must not turn a refusal into an answer.
  notRequested.ads.source = ' not_requested ';
  assert.equal(hasLiveAdBreakdown(notRequested), false);

  for (const source of ['PROVIDER_LIVE', 'STORED_FALLBACK', 'UNAVAILABLE', 'NO_ACCOUNT']) {
    const answered = payload();
    answered.ads = { source, rows: [], totals: {}, duplicate_names: [], data_notice: null };
    assert.equal(hasLiveAdBreakdown(answered), true, source);
  }

  // A payload with no ads key at all is an old or partial shape, not an opt-out; treating it as
  // unasked would leave the tab waiting for a half that is never coming.
  const noAdsKey = payload();
  delete (noAdsKey as { ads?: unknown }).ads;
  assert.equal(hasLiveAdBreakdown(noAdsKey), true);
});

test('the account and window are described from what the payload actually carries', () => {
  assert.equal(describeAccount(payload()), 'MM.com · ***4702 · BDT · Asia/Dhaka');
  assert.equal(describeAccount(payload({ account: null })), null);
  assert.equal(
    describeAccount(payload({ account: { ad_account_id: 14, platform: 'meta', masked_account_id: '***4702' } })),
    '***4702',
  );

  assert.equal(describePeriod(payload()), 'Last 7 days · 2026-08-23 to 2026-08-29');
  assert.equal(describePeriod(payload({ period: { days: 30, since: null, until: null } })), 'Last 30 days');
  assert.equal(describePeriod(payload({ period: { days: 1, since: null, until: null } })), 'Today');
});

// The funnel used to end on our own event count while the grid above it showed the platform's,
// so the same panel could report 6 purchases and 0 purchases at once.
test('the funnel is fed the platform’s own three stages', () => {
  const funnel = liveFunnelSnapshot(payload());

  assert.equal(funnel?.impressions, 51646);
  assert.equal(funnel?.clicks, 4039);
  assert.equal(funnel?.conversions, 6);
  assert.equal(funnel?.ctr, 7.82);
  // purchases ÷ clicks, as a percentage, which is the funnel's second step rate.
  assert.equal(funnel?.conversion_rate, 0.15);
  assert.equal(funnel?.aov, 3.5);
  assert.equal(funnel?.attribution_quality, 0);

  const noClicks = payload();
  noClicks.platform = { ...noClicks.platform!, clicks: 0, purchases: 0, revenue: 0 };
  assert.equal(liveFunnelSnapshot(noClicks)?.conversion_rate, 0);
  assert.equal(liveFunnelSnapshot(noClicks)?.aov, 0);
  assert.equal(liveFunnelSnapshot(payload({ platform: null })), null);
});
