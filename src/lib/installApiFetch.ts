const CSRF_COOKIE = 'buykori_client_csrf';
const CSRF_HEADER = 'X-Client-CSRF-Token';
const API_TIMEOUT_MS = 15_000;

const readCookie = (name: string) => {
  const prefix = `${name}=`;
  const value = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const isMutation = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

const combineSignals = (signals: AbortSignal[]): AbortSignal => {
  if (signals.length === 1) return signals[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
};

const isSameOriginApiRequest = (input: RequestInfo | URL) => {
  try {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
};

const apiPath = (input: RequestInfo | URL) => {
  try {
    const rawUrl = input instanceof Request ? input.url : String(input);
    return new URL(rawUrl, window.location.origin).pathname;
  } catch {
    return '';
  }
};

const isCsrfRejectedResponse = async (response: Response) => {
  const text = await response.clone().text().catch(() => '');
  try {
    const payload = JSON.parse(text);
    const detail = payload?.detail;
    if (detail?.code === 'client_csrf_invalid') {
      return true;
    }
    if (payload?.code === 'client_csrf_invalid') {
      return true;
    }
  } catch {
    // Fall through to legacy string matching for older servers.
  }
  return text.toLowerCase().includes('csrf');
};

export const installApiFetch = () => {
  const current = window.fetch;
  if ((current as typeof current & { __buykoriWrapped?: boolean }).__buykoriWrapped) {
    return;
  }

  let csrfRefreshPromise: Promise<void> | null = null;
  let sessionProbePromise: Promise<'active' | 'inactive' | 'unavailable'> | null = null;
  const refreshCsrfCookie = async () => {
    if (csrfRefreshPromise) {
      return csrfRefreshPromise;
    }
    csrfRefreshPromise = current('/api/v1/auth/client/me', {
      method: 'GET',
      credentials: 'include',
    })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        csrfRefreshPromise = null;
      });
    return csrfRefreshPromise;
  };

  const probeSession = async () => {
    if (sessionProbePromise) {
      return sessionProbePromise;
    }
    sessionProbePromise = current('/api/v1/auth/client/me', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    })
      .then((response) => {
        if (response.ok) return 'active' as const;
        if (response.status === 401 || response.status === 403) return 'inactive' as const;
        return 'unavailable' as const;
      })
      .catch(() => 'unavailable' as const)
      .finally(() => {
        sessionProbePromise = null;
      });
    return sessionProbePromise;
  };

  const wrappedFetch: typeof window.fetch = async (input, init = {}) => {
    if (!isSameOriginApiRequest(input)) {
      return current(input, init);
    }

    const request = input instanceof Request ? input : null;
    const method = String(init.method || request?.method || 'GET');
    const mutation = isMutation(method);

    const withClientDefaults = async (forceRefreshCsrf = false): Promise<RequestInit> => {
      const headers = new Headers(request?.headers || undefined);
      new Headers(init.headers || undefined).forEach((value, key) => headers.set(key, value));

      if (mutation) {
        if (forceRefreshCsrf || !readCookie(CSRF_COOKIE)) {
          await refreshCsrfCookie();
        }
        const csrf = readCookie(CSRF_COOKIE);
        if (csrf) {
          headers.set(CSRF_HEADER, csrf);
        }
      }

      return {
        ...init,
        credentials: init.credentials || request?.credentials || 'include',
        headers,
      };
    };

    // API-06: every same-origin API request gets a deadline, including legacy
    // call sites that still call fetch() directly. A caller-provided signal is
    // preserved and combined with the timeout so effect cleanup can cancel too.
    const send = async (forceRefreshCsrf = false) => {
      const requestInit = await withClientDefaults(forceRefreshCsrf);
      const timeoutController = new AbortController();
      const timeoutId = window.setTimeout(
        () => timeoutController.abort(new DOMException('API request timed out.', 'TimeoutError')),
        API_TIMEOUT_MS
      );
      const callerSignal = requestInit.signal || request?.signal;
      const signal = callerSignal
        ? combineSignals([callerSignal, timeoutController.signal])
        : timeoutController.signal;
      try {
        return await current(input, { ...requestInit, signal });
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const response = await send();
    if (response.status === 401 && window.location.pathname !== '/client') {
      const path = apiPath(input);
      const sessionStatus = path === '/api/v1/auth/client/me'
        ? 'inactive'
        : await probeSession();
      if (sessionStatus === 'active' && !mutation && (!request || !request.bodyUsed)) {
        return send();
      }
      if (sessionStatus === 'inactive') {
        window.location.assign('/client');
      }
      return response;
    }
    if (mutation && response.status === 403) {
      let csrf = readCookie(CSRF_COOKIE);
      const csrfRejected = await isCsrfRejectedResponse(response);
      if (csrfRejected && (!request || !request.bodyUsed)) {
        await refreshCsrfCookie();
        const refreshedCsrf = readCookie(CSRF_COOKIE);
        if (refreshedCsrf && refreshedCsrf !== csrf) {
          csrf = refreshedCsrf;
          return send(true);
        }
      }
    }

    return response;
  };
  (wrappedFetch as typeof wrappedFetch & { __buykoriWrapped?: boolean }).__buykoriWrapped = true;
  window.fetch = wrappedFetch;
};
