export interface ClientRouteMatch {
  pageId: string;
  sectionId: string | null;
  canonicalPath: string;
}

const PAGE_PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  analytics: '/ad-insights',
  'pending-purchases': '/cod-protection',
  orders: '/courier-shipping',
  'incomplete-checkouts': '/incomplete-orders',
  'campaign-builder': '/campaign-tools',
  suggestions: '/setup-health',
  'event-logs': '/event-logs',
  'api-logs': '/api-logs',
  settings: '/settings/store-connection',
  'setup-guide': '/setup-guide',
  account: '/account',
  'order-success': '/order-success',
};

const SETTINGS_SECTION_PATHS: Record<string, string> = {
  'settings-domain': '/settings/store-connection',
  'settings-wordpress': '/settings/plugin-connection',
  'settings-platforms': '/settings/conversions-api',
  'settings-cod': '/settings/cod-timing',
  'settings-routing': '/settings/event-routing',
  'settings-custom-automations': '/settings/custom-automations',
  'settings-ad-accounts': '/settings/ad-accounts',
  'settings-courier': '/settings/courier-logistics',
  'settings-whatsapp': '/settings/alerts-notifications',
};

/**
 * Host-level prefixes that all serve the same SPA shell.
 *
 * API-09: `vercel.json` rewrites `/client/dashboard/:path*` to index.html, but this resolver
 * previously only matched the exact `/client/dashboard` path. Deep links such as
 * `/client/dashboard/settings` therefore resolved to `null` and rendered the not-found view
 * even though the host had served the app correctly.
 */
const APP_PREFIXES = ['/app', '/client/dashboard'];

const PAGE_BY_PATH = new Map(Object.entries(PAGE_PATHS).map(([pageId, path]) => [path, pageId]));
const SETTINGS_SECTION_BY_PATH = new Map(
  Object.entries(SETTINGS_SECTION_PATHS).map(([sectionId, path]) => [path, sectionId])
);

const normalizePath = (pathname: string) => {
  const clean = String(pathname || '/').split('?')[0].split('#')[0];
  if (clean === '/') return clean;
  return clean.replace(/\/+$/, '') || '/';
};

const stripAppPrefix = (path: string) => {
  for (const prefix of APP_PREFIXES) {
    if (path === prefix) return '/';
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length) || '/';
  }
  return path;
};

export const clientPathForPage = (pageId: string) => PAGE_PATHS[pageId] || null;

export const clientPathForSection = (pageId: string, sectionId: string) => {
  if (pageId !== 'settings') return clientPathForPage(pageId);
  return SETTINGS_SECTION_PATHS[sectionId] || PAGE_PATHS.settings;
};

export const resolveClientRoute = (pathname: string): ClientRouteMatch | null => {
  const path = normalizePath(pathname);

  if (path === '/' || path === '/index.html') {
    return { pageId: 'dashboard', sectionId: null, canonicalPath: PAGE_PATHS.dashboard };
  }

  const routePath = stripAppPrefix(path);

  if (routePath === '/' || routePath === '/index.html') {
    return { pageId: 'dashboard', sectionId: null, canonicalPath: PAGE_PATHS.dashboard };
  }

  if (/^\/order-success\/[^/]+$/.test(routePath)) {
    return { pageId: 'order-success', sectionId: null, canonicalPath: routePath };
  }

  if (routePath === '/settings') {
    return {
      pageId: 'settings',
      sectionId: 'settings-domain',
      canonicalPath: SETTINGS_SECTION_PATHS['settings-domain'],
    };
  }

  const sectionId = SETTINGS_SECTION_BY_PATH.get(routePath);
  if (sectionId) {
    return { pageId: 'settings', sectionId, canonicalPath: SETTINGS_SECTION_PATHS[sectionId] };
  }

  const pageId = PAGE_BY_PATH.get(routePath);
  if (!pageId) return null;
  return { pageId, sectionId: null, canonicalPath: PAGE_PATHS[pageId] };
};

export const isClientPageId = (pageId: string) => Boolean(PAGE_PATHS[pageId]);
