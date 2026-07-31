import type { CampaignTab } from './useCampaignSectionJump';

interface CampaignMobileTabsProps {
  mobileTab: CampaignTab;
  setMobileTab: (tab: CampaignTab) => void;
}

const TABS: ReadonlyArray<readonly [CampaignTab, string]> = [
  ['url', 'URL builder'],
  ['tester', 'Event tester'],
  ['preview', 'Data preview'],
] as const;

export function CampaignMobileTabs({ mobileTab, setMobileTab }: CampaignMobileTabsProps) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 md:hidden" role="tablist" aria-label="Campaign tools">
      {TABS.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={mobileTab === tab}
          onClick={() => setMobileTab(tab)}
          className={`min-h-9 rounded-lg px-2 text-[11px] font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            mobileTab === tab
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
