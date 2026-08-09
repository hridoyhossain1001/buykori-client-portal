/**
 * Shared fetch helper for the client portal API layer.
 *
 * Audit items addressed:
 * - API-06: no request ever had a timeout, so a hung upstream froze a UI section forever.
 * - UI-02: callers had no way to abort in-flight requests on unmount / dependency change,
 *   which allowed a stale response to overwrite fresher state.
 *
 * This intentionally calls the global `fetch` so the CSRF/auth wrapper installed by
 * `installApiFetch()` still applies.
 */

export const DEFAULT_API_TIMEOUT_MS = 15_000;

export class ApiTimeoutError extends Error {
  constructor(message = 'The request timed out. Please check your connection and try again.') {
    super(message);
    this.name = 'ApiTimeoutError';
  }
}

export const isAbortError = (error: unknown) =>
  Boolean(error) && (error as { name?: string }).name === 'AbortError';

/**
 * UX-02: turn a thrown fetch error into one sentence a merchant can act on.
 *
 * Panels used to swallow failures (`.catch(() => {})`), so a dead network read
 * as "no data" — indistinguishable from a genuinely empty account. Every panel
 * now routes its error through here so the wording stays consistent, and so no
 * raw `TypeError: Failed to fetch` reaches a merchant.
 *
 * Caller-initiated aborts are not failures; check `isAbortError` first and skip
 * rendering an error at all.
 */
export function describeFetchError(error: unknown): string {
  if (error instanceof ApiTimeoutError) return error.message;

  const name = (error as { name?: string } | null)?.name;
  // installApiFetch aborts with a DOMException named TimeoutError.
  if (name === 'TimeoutError') {
    return 'The request timed out. Please check your connection and try again.';
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Reconnect and try again.';
  }
  // fetch() rejects with a TypeError for DNS, CORS and connection failures.
  if (error instanceof TypeError) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return 'Something went wrong loading this. Please try again.';
}

/**
 * The same idea for a response that arrived but was not ok. Status text is not
 * shown verbatim because it is inconsistent across proxies and never localised.
 */
export function describeResponseError(response: { status: number }): string {
  const { status } = response;
  if (status === 401) return 'Your session expired. Sign in again to continue.';
  if (status === 403) return 'You do not have access to this. Contact support if that looks wrong.';
  if (status === 404) return 'We could not find this data. It may have been removed.';
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status >= 500) return 'The server had a problem. Please try again in a moment.';
  return 'Something went wrong loading this. Please try again.';
}

const createTimeoutSignal = (timeoutMs: number): AbortSignal | undefined => {
  if (!(timeoutMs > 0)) return undefined;
  if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') return undefined;
  return AbortSignal.timeout(timeoutMs);
};

const combineSignals = (signals: Array<AbortSignal | null | undefined>): AbortSignal | undefined => {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];

  const anySignal = (AbortSignal as unknown as { any?: (list: AbortSignal[]) => AbortSignal }).any;
  if (typeof anySignal === 'function') return anySignal(active);

  const controller = new AbortController();
  for (const signal of active) {
    if (signal.aborted) {
      controller.abort((signal as AbortSignal & { reason?: unknown }).reason);
      break;
    }
    signal.addEventListener(
      'abort',
      () => controller.abort((signal as AbortSignal & { reason?: unknown }).reason),
      { once: true }
    );
  }
  return controller.signal;
};

export interface ApiFetchOptions extends RequestInit {
  /** Defaults to DEFAULT_API_TIMEOUT_MS. Pass 0 to disable the timeout. */
  timeoutMs?: number;
}

export async function apiFetch(
  input: RequestInfo | URL,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_API_TIMEOUT_MS, signal, ...init } = options;
  const timeoutSignal = createTimeoutSignal(timeoutMs);
  const combined = combineSignals([signal, timeoutSignal]);

  try {
    return await fetch(input, combined ? { ...init, signal: combined } : init);
  } catch (error) {
    // Only translate the error when *our* timeout fired, never when the caller aborted.
    if (timeoutSignal?.aborted && !signal?.aborted) {
      throw new ApiTimeoutError();
    }
    throw error;
  }
}
