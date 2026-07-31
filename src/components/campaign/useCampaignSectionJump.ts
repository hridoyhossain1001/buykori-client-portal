import React from 'react';

export type CampaignTab = 'url' | 'tester' | 'preview';

const SECTION_TO_TAB: Record<string, CampaignTab> = {
  'campaign-url-builder': 'url',
  'campaign-event-tester': 'tester',
  'campaign-data-preview': 'preview',
};

/**
 * Owns the mobile tab selection and listens for the global
 * 'buykori:page-section' jump event so a deep link from elsewhere in the app
 * opens the right tab and then scrolls to the section.
 */
export function useCampaignSectionJump() {
  const [mobileTab, setMobileTab] = React.useState<CampaignTab>('url');

  React.useEffect(() => {
    const handleSectionJump = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId: string; sectionId: string }>).detail;
      if (detail?.pageId !== 'campaign-builder') return;
      const nextTab = SECTION_TO_TAB[detail.sectionId];
      if (nextTab) setMobileTab(nextTab);
      window.requestAnimationFrame(() => {
        document.getElementById(detail.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  return { mobileTab, setMobileTab };
}
