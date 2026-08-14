import React, { lazy } from 'react';

/**
 * Wraps React.lazy so that a stale-chunk failure (common right after a deploy)
 * triggers exactly one hard reload instead of leaving the user on a dead page.
 */
export const lazyWithReload = <Props extends object>(
  loader: () => Promise<{ default: React.ComponentType<Props> }>
) => lazy(() => loader().catch((error) => {
  const chunkFailed = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(String(error?.message || error));
  if (chunkFailed && sessionStorage.getItem('buykori_chunk_reload') !== '1') {
    sessionStorage.setItem('buykori_chunk_reload', '1');
    window.location.reload();
  }
  throw error;
}));

// Lazy-loaded modular views (code-splitting for a smaller initial bundle)
export const DashboardView = lazyWithReload(() => import('../components/DashboardView').then(m => ({ default: m.DashboardView })));
export const WeeklyReportCard = lazyWithReload(() => import('../components/WeeklyReportCard').then(m => ({ default: m.WeeklyReportCard })));
export const AnalyticsView = lazyWithReload(() => import('../components/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
export const CodProtectionView = lazyWithReload(() => import('../components/CodProtectionView').then(m => ({ default: m.CodProtectionView })));
export const EventLogsView = lazyWithReload(() => import('../components/EventLogsView').then(m => ({ default: m.EventLogsView })));
export const ApiLogsView = lazyWithReload(() => import('../components/ApiLogsView').then(m => ({ default: m.ApiLogsView })));
export const SettingsView = lazyWithReload(() => import('../components/SettingsView').then(m => ({ default: m.SettingsView })));
export const SetupGuideView = lazyWithReload(() => import('../components/SetupGuideView').then(m => ({ default: m.SetupGuideView })));
export const SuggestionsView = lazyWithReload(() => import('../components/SuggestionsView').then(m => ({ default: m.SuggestionsView })));
export const CampaignBuilderView = lazyWithReload(() => import('../components/CampaignBuilderView').then(m => ({ default: m.CampaignBuilderView })));
export const AccountView = lazyWithReload(() => import('../components/AccountView').then(m => ({ default: m.AccountView })));
export const OrderSuccessView = lazyWithReload(() => import('../components/OrderSuccessView').then(m => ({ default: m.OrderSuccessView })));
export const OrdersView = lazyWithReload(() => import('../components/OrdersView').then(m => ({ default: m.OrdersView })));
export const IncompleteCheckoutsView = lazyWithReload(() => import('../components/IncompleteCheckoutsView').then(m => ({ default: m.IncompleteCheckoutsView })));

// Page id -> header title map used by the console shell.
export const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  analytics: 'Insights',
  'pending-purchases': 'Purchase Event Hold',
  orders: 'Orders & Shipping',
  'incomplete-checkouts': 'Incomplete Orders',
  'campaign-builder': 'Campaign Tools',
  suggestions: 'Setup Health',
  'event-logs': 'Event Logs',
  'api-logs': 'API Logs',
  settings: 'Settings',
  'setup-guide': 'Setup Guide',
  account: 'Account',
};

export const pageTitleFor = (pageId: string) =>
  pageTitles[pageId]
  || pageId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
