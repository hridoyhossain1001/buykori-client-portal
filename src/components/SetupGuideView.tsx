/**
 * Container for the Setup guide page.
 *
 * It keeps every request and every piece of routing that already worked, and
 * hands presentation to `setupGuide/SetupGuideWorkspace.tsx`:
 *
 *  - `GET /api/setup/readiness` on mount, and again on "Check again",
 *  - the `buykori:page-section` listener, so a deep link from elsewhere in the
 *    portal can open this page on the right platform tab,
 *  - `openPortalSection`, which switches page and then re-fires that same event
 *    so the target page can scroll to its own section,
 *  - `apiOrigin`, because the plugin ZIP is served by the API host, not by the
 *    portal host, and on `client.buykori.app` those differ.
 *
 * `copiedStates` / `handleCopy` / `api_key` / `public_key` stay in the props for
 * `App.tsx`'s benefit but are unused here: the guide no longer prints keys on the
 * page, since the plugin now pairs itself over OAuth.
 */
import React, { useState } from 'react';
import { staticFAQs } from '../lib/mock-data';
import { PluginReleaseInfo } from '../types';
import { SetupGuideWorkspace } from './setupGuide/SetupGuideWorkspace';
import type { SetupReadiness, SetupTabId } from './setupGuide/SetupGuideWorkspace';

interface SetupGuideViewProps {
  faqExpanded: number | null;
  setFaqExpanded: (idx: number | null) => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  setActivePage: (page: string) => void;
  api_key?: string;
  public_key?: string;
  pluginReleaseInfo?: PluginReleaseInfo | null;
}

export function SetupGuideView({
  faqExpanded,
  setFaqExpanded,
  setActivePage,
  pluginReleaseInfo,
}: SetupGuideViewProps) {
  const [activeTab, setActiveTab] = useState<SetupTabId>('wordpress');
  const [readiness, setReadiness] = useState<SetupReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(true);

  const loadReadiness = React.useCallback(async () => {
    setReadinessLoading(true);
    try {
      const response = await fetch('/api/setup/readiness');
      if (response.ok) setReadiness(await response.json());
    } finally {
      setReadinessLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadReadiness();
  }, [loadReadiness]);

  React.useEffect(() => {
    const handleSectionJump = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId: string; sectionId: string }>).detail;
      if (detail?.pageId !== 'setup-guide') return;
      setActiveTab(detail.sectionId === 'setup-shopify' ? 'shopify' : detail.sectionId === 'setup-custom' ? 'custom' : 'wordpress');
    };
    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  const openPortalSection = (pageId: string, sectionId?: string) => {
    setActivePage(pageId);
    if (!sectionId) return;
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('buykori:page-section', { detail: { pageId, sectionId } }));
    }, 50);
  };

  const apiOrigin = window.location.hostname === 'client.buykori.app'
    ? 'https://api.buykori.app'
    : window.location.origin;
  const packageSizeKb = pluginReleaseInfo?.package_size ? Math.round(pluginReleaseInfo.package_size / 1024) : 0;

  return (
    <SetupGuideWorkspace
      readiness={readiness}
      readinessLoading={readinessLoading}
      reloadReadiness={() => { void loadReadiness(); }}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      pluginDownloadUrl={`${apiOrigin}/api/v1/plugin/download`}
      pluginVersionLine={pluginReleaseInfo ? `v${pluginReleaseInfo.version} · WordPress ${pluginReleaseInfo.tested}+ · ${packageSizeKb} KB` : ''}
      faqs={staticFAQs}
      faqExpanded={faqExpanded}
      setFaqExpanded={setFaqExpanded}
      goToPage={setActivePage}
      openPortalSection={openPortalSection}
    />
  );
}
