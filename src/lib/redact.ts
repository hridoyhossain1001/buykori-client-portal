/**
 * Credential redaction for anything a merchant can read or download.
 *
 * The delivery log printed provider endpoints verbatim, and one of them is a GA4 Measurement Protocol
 * URL: `https://www.google-analytics.com/mp/collect?api_secret=…&measurement_id=…`. `api_secret` is
 * the credential that authorises writes to that property, so a single unredacted row put it in the
 * table, in the row's `title` tooltip, in the CSV export, and in the JSON export at once.
 *
 * Redaction therefore belongs at the boundary where a log becomes output — `redactApiLog` — and not at
 * one render site, because the next feature that reads the same record (a copy button, a support
 * bundle, a new column) would otherwise reintroduce the leak with no warning.
 */

export const REDACTED = '[redacted]';

/**
 * Matching is on the whole normalised key, never a substring. Substring matching looks safer and is
 * worse: `measurement_id` and `pixel_id` both contain `id`, and neither is a secret — a rule that eats
 * them turns the delivery log into a wall of `[redacted]` that cannot be used to diagnose the failed
 * delivery the log exists to explain. Anything genuinely sensitive that is missing belongs on this
 * list; the matching rule stays exact.
 */
const SENSITIVE_KEYS = new Set([
  'apisecret', 'appsecret', 'clientsecret', 'secret', 'secretkey',
  'accesstoken', 'refreshtoken', 'idtoken', 'token', 'bearer',
  'apikey', 'key', 'privatekey', 'publickey',
  'password', 'passwd', 'pass', 'pwd',
  'auth', 'authorization', 'credential', 'credentials',
  'signature', 'sig', 'hash',
  'cookie', 'setcookie', 'sessionid', 'sessiontoken', 'csrftoken',
  'xapikey', 'xauthtoken', 'xaccesstoken', 'xsignature', 'xhubsignature', 'xhubsignature256',
]);

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

export const isSensitiveKey = (key: string): boolean => SENSITIVE_KEYS.has(normalizeKey(key));

/** `Bearer eyJ…`, `Basic dXNlcjpwYXNz`, `token ghp_…` — the scheme survives so the header is still readable. */
const CREDENTIAL_SCHEME = /\b(bearer|basic|token)\s+[A-Za-z0-9._~+/=-]{4,}/gi;

/** Only matches something that starts like a URL or a path *and* carries a query string. */
const EMBEDDED_URL = /(?:https?:\/\/|\/)[^\s"'<>\\]*\?[^\s"'<>\\]*/gi;

/** `https://user:pass@host/…` puts the credential in the authority, where no query parser will find it. */
const USER_INFO = /^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i;

/**
 * Redacts the values of sensitive parameters in an `a=1&b=2` string, keeping every parameter *name*.
 * The names are what make a failed delivery diagnosable — knowing the request carried an `api_secret`
 * at all is the difference between "misconfigured" and "unauthenticated".
 */
export function redactQuery(query: string): string {
  return query
    .split('&')
    .map(pair => {
      const separator = pair.indexOf('=');
      if (separator === -1) return pair; // a valueless flag has nothing to leak
      const name = pair.slice(0, separator);
      return isSensitiveKey(decodeURIComponent(name)) ? `${name}=${REDACTED}` : pair;
    })
    .join('&');
}

/**
 * Redacts credentials from a URL while preserving its shape. Deliberately string-based rather than
 * `new URL()`: the same field also holds relative paths (`/api/events`) and non-URLs (`Browser pixel`),
 * and `new URL()` either throws on those or forces a fake base host into the output.
 */
export function redactUrl(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  if (!text) return '';
  const hashAt = text.indexOf('#');
  const fragment = hashAt === -1 ? '' : text.slice(hashAt);
  const withoutFragment = hashAt === -1 ? text : text.slice(0, hashAt);
  const queryAt = withoutFragment.indexOf('?');
  const path = (queryAt === -1 ? withoutFragment : withoutFragment.slice(0, queryAt)).replace(USER_INFO, `$1${REDACTED}@`);
  if (queryAt === -1) return `${path}${fragment}`;
  return `${path}?${redactQuery(withoutFragment.slice(queryAt + 1))}${fragment}`;
}

/** Free text that may embed a URL or an `Authorization` value: provider error pages, plain-text replies. */
export function redactText(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  if (!text) return '';
  return text
    .replace(CREDENTIAL_SCHEME, (_match, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(EMBEDDED_URL, match => redactUrl(match));
}

/**
 * Walks a parsed payload, replacing sensitive values wherever they sit — including nested objects and
 * arrays, which is where a provider batch hides its per-event tokens. Strings are still passed through
 * `redactText`, because a payload field can itself contain a signed URL.
 */
export function redactDeep(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) {
    if (seen.has(value)) return REDACTED;
    seen.add(value);
    return value.map(item => redactDeep(item, seen));
  }
  if (value && typeof value === 'object') {
    if (seen.has(value)) return REDACTED;
    seen.add(value);
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, isSensitiveKey(key) ? REDACTED : redactDeep(item, seen)]),
    );
  }
  return value;
}

/**
 * Request and response bodies arrive as strings. JSON is parsed so keys can be matched exactly, and
 * re-serialised at the indentation it came in with so an expanded log looks the same as before.
 * Everything else — form-encoded bodies, HTML error pages, a provider's plain-text reply — falls back
 * to the string-level rules rather than being dropped or trusted.
 */
export function redactJsonText(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  if (!text.trim()) return text;
  try {
    return JSON.stringify(redactDeep(JSON.parse(text)), null, text.includes('\n') ? 2 : 0);
  } catch {
    const trimmed = text.trim();
    return /^[^\s{["'<]+=/.test(trimmed) ? redactQuery(trimmed) : redactText(text);
  }
}

export type RedactableApiLog = { endpoint: string; requestBody: string; responseBody: string };

/** The single boundary every API-log render and export path goes through. */
export function redactApiLog<T extends RedactableApiLog>(log: T): T {
  return { ...log, endpoint: redactUrl(log.endpoint), requestBody: redactJsonText(log.requestBody), responseBody: redactJsonText(log.responseBody) };
}

export function redactApiLogs<T extends RedactableApiLog>(logs: readonly T[]): T[] {
  return logs.map(redactApiLog);
}
