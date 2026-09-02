import type { Platform } from '../../types';

export interface CampaignCustomParam {
  k: string;
  v: string;
}

export interface CampaignPayloadInput {
  builderEventName: string;
  builderValue: string;
  builderCurrency: string;
  builderEmail: string;
  builderPhone: string;
  builderIp: string;
  builderUa: string;
  customParams: CampaignCustomParam[];
}

export interface CampaignDispatchInput extends CampaignPayloadInput {
  builderPlatform: Platform;
}

/** POST body for the event tester. Blank fields are absent, never `""`. */
export interface CampaignTestRequestBody {
  platform: Platform;
  eventName: string;
  value?: string;
  currency?: string;
  email?: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
  customParams: Record<string, string>;
}

export type CampaignDispatchMode = 'sandbox' | 'live';

export interface CampaignDispatchBoundary {
  mode: CampaignDispatchMode;
  /** True only when the dispatch is forwarded to an ad platform's production API. */
  reachesAdPlatform: boolean;
  /** True when the dispatch leaves a row in the client's own event log. */
  recordedInEventLog: boolean;
  headline: string;
  detail: string;
}

/** A store row narrowed to the two fields the campaign tools read. */
export interface CampaignStoreRef {
  domain: string;
  is_current: boolean;
}

/**
 * The one endpoint the Campaign Event Tester posts to.
 *
 * The fetch in App.tsx and resolveCampaignDispatchBoundary() both read this so
 * the banner cannot claim "sandbox" while the request goes somewhere else. If
 * the tester is ever repointed, change it here and the banner follows.
 */
export const CAMPAIGN_TEST_ENDPOINT = '/api/campaign-test';

const HTTPS_PREFIX = 'https://';

interface NormalisedCampaignFields {
  eventName: string;
  value: string;
  currency: string;
  email: string;
  phone: string;
  ip: string;
  userAgent: string;
  customParams: Record<string, string>;
}

/**
 * Flattens the key/value rows into an object, dropping any row that is missing
 * either half. A row the user added but never filled in must not turn into an
 * empty field in the dispatch.
 */
export function flattenCampaignCustomParams(customParams: CampaignCustomParam[]): Record<string, string> {
  const flattened: Record<string, string> = {};
  (customParams || []).forEach(param => {
    const key = (param?.k || '').trim();
    const value = (param?.v || '').trim();
    if (key && value) flattened[key] = value;
  });
  return flattened;
}

function normaliseCampaignFields(input: CampaignPayloadInput): NormalisedCampaignFields {
  return {
    eventName: (input.builderEventName || '').trim(),
    value: (input.builderValue || '').trim(),
    currency: (input.builderCurrency || '').trim(),
    email: (input.builderEmail || '').trim(),
    phone: (input.builderPhone || '').trim(),
    ip: (input.builderIp || '').trim(),
    userAgent: (input.builderUa || '').trim(),
    customParams: flattenCampaignCustomParams(input.customParams),
  };
}

function buildCustomData(fields: NormalisedCampaignFields): Record<string, string> {
  const customData: Record<string, string> = {};
  if (fields.value) customData.value = fields.value;
  if (fields.currency) customData.currency = fields.currency;
  return Object.assign(customData, fields.customParams);
}

/**
 * Builds the JSON shown in the Event Data Preview panel.
 *
 * Empty identity fields are omitted rather than emitted as `""`, so the preview
 * of an untouched form carries no identity at all. The form used to arrive
 * prefilled with demo PII that read as captured customer data; the preview is
 * now the honest picture of what buildCampaignTestRequestBody() will send.
 *
 * Note that event_time is read at call time, so the preview and a copy taken
 * later can differ by a second - that was true before this split too.
 */
export function buildCampaignPayloadJson(input: CampaignPayloadInput): string {
  const fields = normaliseCampaignFields(input);

  return JSON.stringify({
    event_source: "server",
    event_name: fields.eventName,
    event_time: Math.floor(Date.now() / 1000),
    user_data: {
      em: fields.email ? [fields.email] : undefined,
      ph: fields.phone ? [fields.phone] : undefined,
      client_ip_address: fields.ip || undefined,
      client_user_agent: fields.userAgent || undefined
    },
    custom_data: buildCustomData(fields)
  }, null, 2);
}

/**
 * Builds the request body for the sandbox dispatch.
 *
 * Blank fields are left out entirely instead of sent as empty strings: the
 * server substitutes its own defaults for a missing ip/userAgent, and sending
 * `""` would have it record a value the user never supplied.
 */
export function buildCampaignTestRequestBody(input: CampaignDispatchInput): CampaignTestRequestBody {
  const fields = normaliseCampaignFields(input);

  const body: CampaignTestRequestBody = {
    platform: input.builderPlatform,
    eventName: fields.eventName,
    customParams: fields.customParams,
  };
  if (fields.value) body.value = fields.value;
  if (fields.currency) body.currency = fields.currency;
  if (fields.email) body.email = fields.email;
  if (fields.phone) body.phone = fields.phone;
  if (fields.ip) body.ip = fields.ip;
  if (fields.userAgent) body.userAgent = fields.userAgent;
  return body;
}

/**
 * Resolves what pressing send in the event tester actually does.
 *
 * /api/campaign-test never forwards to Meta, TikTok or GA4: the handler only
 * writes one EventLog row tagged utm_source="sandbox" / event_id "test_..." and
 * returns a canned receipt, and the report aggregates filter that tag back out.
 * The row is still stored against the real account and still shows in Event
 * Logs, which is why the copy names both halves.
 *
 * Any other endpoint resolves to 'live' so a future repoint fails loud instead
 * of inheriting the reassuring sandbox wording.
 */
export function resolveCampaignDispatchBoundary(endpoint: string = CAMPAIGN_TEST_ENDPOINT): CampaignDispatchBoundary {
  if (endpoint === CAMPAIGN_TEST_ENDPOINT) {
    return {
      mode: 'sandbox',
      reachesAdPlatform: false,
      recordedInEventLog: true,
      headline: 'Sandbox only. Nothing is sent to Meta, TikTok or GA4.',
      detail: 'Sending saves one test row in your Event Logs, tagged sandbox and left out of your reports. Everything you type here still reaches Buykori, so use made-up details instead of a real customer’s.',
    };
  }
  return {
    mode: 'live',
    reachesAdPlatform: true,
    recordedInEventLog: true,
    headline: 'Live dispatch. This reaches your real tracking.',
    detail: `This form posts to ${endpoint}, which is not the sandbox endpoint. Anything you send counts as a real tracked event, so never put a real customer’s details here.`,
  };
}

/**
 * Bare domain of the connected store, or '' when none is connected.
 *
 * The saved domain is meant to be bare ("example.com"), but the settings field
 * accepts free text, so a pasted scheme or trailing slash is stripped here
 * rather than concatenated into "https://https://example.com/".
 */
export function resolveCampaignStoreDomain(stores: readonly CampaignStoreRef[] | null | undefined): string {
  const withDomain = (stores || []).filter(store => (store?.domain || '').trim());
  const store = withDomain.find(candidate => candidate.is_current) || withDomain[0];
  if (!store) return '';
  return store.domain.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');
}

/**
 * Base URL the campaign URL builder starts from.
 *
 * Returns '' when no store is connected. The field used to be seeded with a
 * domain guessed from the account name, which produced links to a site the
 * client does not own.
 */
export function resolveCampaignBaseUrl(stores: readonly CampaignStoreRef[] | null | undefined): string {
  const domain = resolveCampaignStoreDomain(stores);
  return domain ? HTTPS_PREFIX + domain : '';
}
