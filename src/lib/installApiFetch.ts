const CSRF_COOKIE = 'buykori_client_csrf';
const CSRF_HEADER = 'X-Client-CSRF-Token';

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

export const installApiFetch = () => {
  const current = window.fetch;
  if ((current as typeof current & { __buykoriWrapped?: boolean }).__buykoriWrapped) {
    return;
  }

  let csrfRefreshPromise: Promise<void> | null = null;
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

  const wrappedFetch: typeof window.fetch = async (input, init = {}) => {
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

    const response = await current(input, await withClientDefaults());
    if (mutation && response.status === 403) {
      let csrf = readCookie(CSRF_COOKIE);
      const text = await response.clone().text().catch(() => '');
      const csrfRejected = text.toLowerCase().includes('csrf');
      if (csrfRejected && (!request || !request.bodyUsed)) {
        await refreshCsrfCookie();
        const refreshedCsrf = readCookie(CSRF_COOKIE);
        if (refreshedCsrf && refreshedCsrf !== csrf) {
          csrf = refreshedCsrf;
          return current(input, await withClientDefaults(true));
        }
      }
    }

    return response;
  };
  (wrappedFetch as typeof wrappedFetch & { __buykoriWrapped?: boolean }).__buykoriWrapped = true;
  window.fetch = wrappedFetch;
};
