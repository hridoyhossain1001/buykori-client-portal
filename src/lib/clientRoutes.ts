export interface ClientRouteMatch {
  pageId: string;
  sectionId: string | null;
  canonicalPath: string;
}

const PAGE_PATHS: Record<string, string> = {
  dashboard: '/app/dashboard',
  analytics: '/app/ad-insights',
  'pending-purchases': '/app/cod-protection',
  orders: '/app/courier-shipping',
  'incomplete-checkouts': '/app/incomplete-orders',
  'campaign-builder': '/app/campaign-tools',
  suggestions: '/app/setup-health',
  'event-logs': '/app/event-logs',
  'api-logs': '/app/api-logs',
  settings: '/app/settings/store-connection',
  'setup-guide': '/app/setup-guide',
  account: '/app/account',
};

const SETTINGS_SECTION_PATHS: Record<string, string> = {
  'settings-domain': '/app/settings/store-connection',
  'settings-wordpress': '/app/settings/plugin-connection',
  'settings-platforms': '/app/settings/conversions-api',
  'settings-cod': '/app/settings/cod-timing',
  'settings-routing': '/app/settings/event-routing',
  'settings-custom-automations': '/app/settings/custom-automations',
  'settings-ad-accounts': '/app/settings/ad-accounts',
  'settings-courier': '/app/settings/courier-logistics',
  'settings-whatsapp': '/app/settings/alerts-notifications',
};

const PAGE_BY_PATH = new Map(Object.entries(PAGE_PATHS).map(([pageId, path]) => [path, pageId]));
const SETTINGS_SECTION_BY_PATH = new Map(
  Object.entries(SETTINGS_SECTION_PATHS).map(([sectionId, path]) => [path, sectionId])
);

const normalizePath = (pathname: string) => {
  const clean = String(pathname || '/').split('?')[0].split('#')[0];
  if (clean === '/') return clean;
  return clean.replace(/\/+$/, '') || '/';
};

export const clientPathForPage = (pageId: string) => PAGE_PATHS[pageId] || null;

export const clientPathForSection = (pageId: string, sectionId: string) => {
  if (pageId !== 'settings') return clientPathForPage(pageId);
  return SETTINGS_SECTION_PATHS[sectionId] || PAGE_PATHS.settings;
};

export const resolveClientRoute = (pathname: string): ClientRouteMatch | null => {
  const path = normalizePath(pathname);

  if (path === '/' || path === '/index.html' || path === '/app' || path === '/client/dashboard') {
    return { pageId: 'dashboard', sectionId: null, canonicalPath: PAGE_PATHS.dashboard };
  }

  if (path === '/app/settings') {
    return {
      pageId: 'settings',
      sectionId: 'settings-domain',
      canonicalPath: SETTINGS_SECTION_PATHS['settings-domain'],
    };
  }

  const sectionId = SETTINGS_SECTION_BY_PATH.get(path);
  if (sectionId) {
    return { pageId: 'settings', sectionId, canonicalPath: SETTINGS_SECTION_PATHS[sectionId] };
  }

  const pageId = PAGE_BY_PATH.get(path);
  if (!pageId) return null;
  return { pageId, sectionId: null, canonicalPath: PAGE_PATHS[pageId] };
};

export const isClientPageId = (pageId: string) => Boolean(PAGE_PATHS[pageId]);
