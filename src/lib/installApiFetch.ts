const CSRF_COOKIE = 'buykori_client_csrf';
const CSRF_HEADER = 'X-Client-CSRF-Token';

const readCookie = (name: string) => {
  const prefix = `${name}=`;
  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || '';
};

const isMutation = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

export const installApiFetch = () => {
  const current = window.fetch;
  if ((current as typeof current & { __buykoriWrapped?: boolean }).__buykoriWrapped) {
    return;
  }

  const wrappedFetch: typeof window.fetch = (input, init = {}) => {
    const request = input instanceof Request ? input : null;
    const method = String(init.method || request?.method || 'GET');
    const headers = new Headers(request?.headers || undefined);
    new Headers(init.headers || undefined).forEach((value, key) => headers.set(key, value));

    if (isMutation(method)) {
      const csrf = readCookie(CSRF_COOKIE);
      if (csrf && !headers.has(CSRF_HEADER)) {
        headers.set(CSRF_HEADER, csrf);
      }
    }

    return current(input, {
      ...init,
      credentials: init.credentials || request?.credentials || 'include',
      headers,
    });
  };
  (wrappedFetch as typeof wrappedFetch & { __buykoriWrapped?: boolean }).__buykoriWrapped = true;
  window.fetch = wrappedFetch;
};
