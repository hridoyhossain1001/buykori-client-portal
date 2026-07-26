import React from 'react';
import { Plus, Trash2, Send, Terminal, Link, Copy, Check, Info, RefreshCcw } from 'lucide-react';
import { Tooltip } from './common/Tooltip';
import { PlatformBadge } from './common/PlatformLogo';
import { CampaignDispatchResponse, Platform, SyncedAdCampaign } from '../types';

interface CampaignBuilderViewProps {
  builderPlatform: Platform;
  setBuilderPlatform: (p: Platform) => void;
  builderEventName: string;
  setBuilderEventName: (name: string) => void;
  builderValue: string;
  setBuilderValue: (v: string) => void;
  builderCurrency: string;
  setBuilderCurrency: (c: string) => void;
  builderEmail: string;
  setBuilderEmail: (e: string) => void;
  builderPhone: string;
  setBuilderPhone: (p: string) => void;
  builderIp: string;
  setBuilderIp: (ip: string) => void;
  builderUa: string;
  setBuilderUa: (ua: string) => void;
  customParams: { k: string; v: string }[];
  setCustomParams: React.Dispatch<React.SetStateAction<{ k: string; v: string }[]>>;
  campaignResp: CampaignDispatchResponse | null;
  dispatchingTest: boolean;
  handleDispatchSandboxTest: (e: React.FormEvent) => Promise<void>;
  urlBuilderBaseUrl: string;
  setUrlBuilderBaseUrl: (url: string) => void;
  urlBuilderSource: string;
  setUrlBuilderSource: (source: string) => void;
  urlBuilderMedium: string;
  setUrlBuilderMedium: (medium: string) => void;
  urlBuilderCampaign: string;
  setUrlBuilderCampaign: (campaign: string) => void;
  urlBuilderContent: string;
  setUrlBuilderContent: (content: string) => void;
  urlBuilderTerm: string;
  setUrlBuilderTerm: (term: string) => void;
  urlBuilderAdPlatform: 'meta' | 'tiktok';
  setUrlBuilderAdPlatform: (platform: 'meta' | 'tiktok') => void;
  urlBuilderCampaignId: string;
  setUrlBuilderCampaignId: (campaignId: string) => void;
  syncedAdCampaigns: SyncedAdCampaign[];
  loadingSyncedAdCampaigns: boolean;
  generatedCampaignUrl: string;
  handleGenerateCampaignUrl: () => void;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
}

export function CampaignBuilderView({
  builderPlatform,
  setBuilderPlatform,
  builderEventName,
  setBuilderEventName,
  builderValue,
  setBuilderValue,
  builderCurrency,
  setBuilderCurrency,
  builderEmail,
  setBuilderEmail,
  builderPhone,
  setBuilderPhone,
  builderIp,
  setBuilderIp,
  builderUa,
  setBuilderUa,
  customParams,
  setCustomParams,
  campaignResp,
  dispatchingTest,
  handleDispatchSandboxTest,
  urlBuilderBaseUrl,
  setUrlBuilderBaseUrl,
  urlBuilderSource,
  setUrlBuilderSource,
  urlBuilderMedium,
  setUrlBuilderMedium,
  urlBuilderCampaign,
  setUrlBuilderCampaign,
  urlBuilderContent,
  setUrlBuilderContent,
  urlBuilderTerm,
  setUrlBuilderTerm,
  urlBuilderAdPlatform,
  setUrlBuilderAdPlatform,
  urlBuilderCampaignId,
  setUrlBuilderCampaignId,
  syncedAdCampaigns,
  loadingSyncedAdCampaigns,
  generatedCampaignUrl,
  handleGenerateCampaignUrl,
  copiedStates,
  handleCopy
}: CampaignBuilderViewProps) {
  const [mobileTab, setMobileTab] = React.useState<'url' | 'tester' | 'preview'>('url');
  const campaignOptions = React.useMemo(
    () => (Array.isArray(syncedAdCampaigns) ? syncedAdCampaigns : [])
      .filter((campaign) => campaign.platform === urlBuilderAdPlatform),
    [syncedAdCampaigns, urlBuilderAdPlatform]
  );

  // Custom live campaign payload sandbox generator helper
  const renderCampaignPayloadJson = () => {
    const customObj: Record<string, string> = {};
    (customParams || []).forEach(p => {
      if (p.k.trim()) customObj[p.k.trim()] = p.v;
    });

    return JSON.stringify({
      event_source: "server",
      event_name: builderEventName,
      event_time: Math.floor(Date.now() / 1000),
      user_data: {
        em: builderEmail ? [builderEmail] : undefined,
        ph: builderPhone ? [builderPhone] : undefined,
        client_ip_address: builderIp,
        client_user_agent: builderUa
      },
      custom_data: (builderValue || builderCurrency) ? {
        value: builderValue,
        currency: builderCurrency,
        ...customObj
      } : customObj
    }, null, 2);
  };

  React.useEffect(() => {
    const handleSectionJump = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId: string; sectionId: string }>).detail;
      if (detail?.pageId !== 'campaign-builder') return;
      if (detail.sectionId === 'campaign-url-builder') setMobileTab('url');
      if (detail.sectionId === 'campaign-event-tester') setMobileTab('tester');
      if (detail.sectionId === 'campaign-data-preview') setMobileTab('preview');
      window.requestAnimationFrame(() => {
        document.getElementById(detail.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  return (
    <div className="space-y-2 md:space-y-8">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 md:hidden" role="tablist" aria-label="Campaign tools">
        {([
          ['url', 'URL builder'],
          ['tester', 'Event tester'],
          ['preview', 'Data preview']
        ] as const).map(([tab, label]) => (
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

      {/* Campaign URL Builder Widget */}
      <div id="campaign-url-builder" className={`${mobileTab === 'url' ? 'flex' : 'hidden'} scroll-mt-24 flex-col gap-2 md:grid md:grid-cols-2 md:gap-6 md:rounded-xl md:border md:border-slate-200 md:bg-white md:p-6 md:shadow-sm`}>
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:contents">
          <div className="flex items-start gap-2.5 border-b border-slate-100 pb-2.5 md:col-span-2 md:pb-3">
            <div className="rounded-lg bg-indigo-50 p-1.5 text-indigo-600 md:p-2">
              <Link className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Campaign URL Builder</h2>
              <p className="text-[10px] leading-snug text-slate-400 md:text-xs">Create a campaign link so Buykori can show which ads bring visits and orders.</p>
            </div>
          </div>
          
          {/* Input parameters Form */}
          <div className="space-y-2 md:space-y-4 md:pt-2">
            
            {/* Base Website URL */}
            <div>
              <label htmlFor="campaign-url-base" className="mb-1 block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500 md:text-xs">Base Website URL</label>
              <input 
                id="campaign-url-base"
                type="text" 
                aria-label="Base website URL"
                placeholder="https://your-domain.com/shop/item"
                value={urlBuilderBaseUrl}
                onChange={(e) => setUrlBuilderBaseUrl(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 font-mono text-xs text-slate-800 outline-none transition-all duration-200 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5"
              />
            </div>

            {/* Source & Medium grid */}
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div>
                <label htmlFor="campaign-url-source" className="mb-1 block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500 md:text-xs">Campaign Source</label>
                <select 
                  id="campaign-url-source"
                  aria-label="Campaign source"
                  value={urlBuilderSource}
                  onChange={(e) => {
                    setUrlBuilderSource(e.target.value);
                    if (e.target.value === 'facebook') setUrlBuilderMedium('paid_social');
                    else if (e.target.value === 'tiktok') setUrlBuilderMedium('paid_social');
                    else if (e.target.value === 'google') setUrlBuilderMedium('cpc');
                    else if (e.target.value === 'newsletter') setUrlBuilderMedium('email');
                    else setUrlBuilderMedium('referral');
                  }}
                  className="h-8 w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5"
                >
                  <option value="facebook">Facebook Ads</option>
                  <option value="tiktok">TikTok Ads</option>
                  <option value="google">Google CPC</option>
                  <option value="newsletter">Email Newsletter</option>
                  <option value="custom">Custom Partner</option>
                </select>
              </div>
              <div>
                <label htmlFor="campaign-url-medium" className="mb-1 block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500 md:text-xs">Campaign Medium</label>
                <input 
                  id="campaign-url-medium"
                  type="text" 
                  aria-label="Campaign medium"
                  placeholder="paid_social"
                  value={urlBuilderMedium}
                  onChange={(e) => setUrlBuilderMedium(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none transition-all duration-200 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5"
                />
              </div>
            </div>

            {/* Campaign Name */}
            <div>
              <label htmlFor="campaign-url-name" className="mb-1 block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500 md:text-xs">Campaign Name</label>
              <input 
                id="campaign-url-name"
                type="text" 
                aria-label="Campaign name"
                placeholder="eid_sale_promotion"
                value={urlBuilderCampaign}
                onChange={(e) => setUrlBuilderCampaign(e.target.value)}
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none transition-all duration-200 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-[150px_minmax(0,1fr)] md:gap-4">
              <div>
                <label htmlFor="campaign-url-ad-platform" className="mb-1 block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500 md:text-xs">Ad Platform</label>
                <select
                  id="campaign-url-ad-platform"
                  aria-label="Ad platform"
                  value={urlBuilderAdPlatform}
                  onChange={(e) => {
                    const nextPlatform = e.target.value as 'meta' | 'tiktok';
                    setUrlBuilderAdPlatform(nextPlatform);
                    setUrlBuilderCampaignId('');
                    setUrlBuilderSource(nextPlatform === 'meta' ? 'facebook' : 'tiktok');
                    setUrlBuilderMedium('paid_social');
                  }}
                  className="h-8 w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5"
                >
                  <option value="meta">Meta</option>
                  <option value="tiktok">TikTok</option>
                </select>
                <div className="mt-2 hidden md:block">
                  <PlatformBadge platform={urlBuilderSource} label={urlBuilderSource === 'facebook' ? 'Facebook Ads' : urlBuilderSource === 'tiktok' ? 'TikTok Ads' : urlBuilderSource === 'google' ? 'Google Ads' : urlBuilderSource} active />
                </div>
              </div>
              <div className="md:hidden">
                <span className="mb-1 block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500">Connected</span>
                <div className="flex min-h-8 items-center">
                  <PlatformBadge platform={urlBuilderSource} label={urlBuilderSource === 'facebook' ? 'Facebook Ads' : 'TikTok Ads'} active />
                </div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="campaign-url-exact-campaign" className="mb-1 block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500 md:text-xs">Choose Ad Campaign</label>
                <select
                  id="campaign-url-exact-campaign"
                  aria-label="Choose an ad campaign"
                  value={urlBuilderCampaignId}
                  onChange={(e) => {
                    const campaignId = e.target.value;
                    setUrlBuilderCampaignId(campaignId);
                    const selected = campaignOptions.find((campaign) => campaign.external_campaign_id === campaignId);
                    if (selected?.name && !urlBuilderCampaign.trim()) {
                      setUrlBuilderCampaign(String(selected.name));
                    }
                  }}
                  className="h-8 w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5"
                >
                  <option value="">
                    {loadingSyncedAdCampaigns ? 'Loading campaigns...' : 'Optional: choose a campaign'}
                  </option>
                  {campaignOptions.map((campaign) => (
                    <option key={`${campaign.platform}-${campaign.external_campaign_id}`} value={campaign.external_campaign_id}>
                      {campaign.name} ({campaign.external_campaign_id})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[9px] leading-normal text-slate-400 md:text-xs">
                  This helps Buykori match your ad cost with the orders from this campaign.
                </p>
              </div>
            </div>

            {/* Optional parameters Content & Term */}
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div>
                <label htmlFor="campaign-url-content" className="mb-1 block whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500 md:text-xs">Ad Content <span className="rounded bg-slate-100 px-1 text-[8px] text-slate-400">OPT</span></label>
                <input 
                  id="campaign-url-content"
                  type="text" 
                  aria-label="Ad content"
                  placeholder="video_ad_1"
                  value={urlBuilderContent}
                  onChange={(e) => setUrlBuilderContent(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none transition-all duration-200 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5"
                />
              </div>
              <div>
                <label htmlFor="campaign-url-term" className="mb-1 block whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500 md:text-xs">Search Term <span className="rounded bg-slate-100 px-1 text-[8px] text-slate-400">OPT</span></label>
                <input 
                  id="campaign-url-term"
                  type="text" 
                  aria-label="Search term"
                  placeholder="buy_shoes"
                  value={urlBuilderTerm}
                  onChange={(e) => setUrlBuilderTerm(e.target.value)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none transition-all duration-200 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5"
                />
              </div>
            </div>

            <button 
              type="button"
              onClick={handleGenerateCampaignUrl}
              className="min-h-10 w-full rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 hover:shadow-indigo-500/20 cursor-pointer"
            >
              Create Campaign Link
            </button>

          </div>
        </div>

        {/* Output generator result box */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:border-indigo-100/50 md:bg-gradient-to-br md:from-indigo-50/40 md:to-slate-50/20 md:p-5 md:shadow-none">
          <div className="flex items-start gap-2.5">
            <div className="rounded-lg bg-sky-50 p-1.5 text-sky-500 md:hidden">
              <Copy className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest ">Your Campaign Link</h3>
              <p className="text-[10px] leading-snug text-slate-400 md:text-xs">Use this as the website link in Meta or TikTok Ads Manager.</p>
            </div>
          </div>

          <div className="group relative my-2 flex min-h-12 items-center break-all rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-2.5 font-mono text-[10px] text-slate-700 select-all md:my-4 md:min-h-24 md:border-solid md:bg-white md:p-3 md:text-xs">
            {generatedCampaignUrl ? (
              <>
                <span className="pr-8">{generatedCampaignUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopy(generatedCampaignUrl, 'generated_campaign_url')}
                  className="absolute top-2 right-2 p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer    transition-colors"
                  title="Copy URL"
                >
                  {copiedStates['generated_campaign_url'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </>
            ) : (
              <span className="text-slate-400 italic">Enter a base URL and campaign name to compile the UTM link automatically...</span>
            )}
          </div>

          <div className="flex items-start gap-1.5 text-[9px] leading-normal text-slate-400 md:text-xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>Applying proper UTM discipline ensures tracking data cleanly attributes purchase value directly to campaigns.</span>
          </div>
        </div>
      </div>

      <div className="contents md:grid md:grid-cols-1 md:gap-8 lg:grid-cols-2">
        
        {/* Builder Form controls */}
        <form id="campaign-event-tester" onSubmit={handleDispatchSandboxTest} className={`${mobileTab === 'tester' ? 'block' : 'hidden'} scroll-mt-24 rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-3 md:block md:p-6 md:space-y-6`}>
          <div className="flex items-start gap-2.5 border-b border-slate-100 pb-2.5 md:border-0 md:pb-0">
            <div className="rounded-lg bg-amber-50 p-1.5 text-amber-500 md:hidden">
              <Send className="h-4 w-4" />
            </div>
            <div>
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Campaign Event Tester</h2>
            <p className="text-xs text-slate-400 ">Build a sample WooCommerce event and test how it reaches your ad platforms.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <div>
              <label htmlFor="campaign-test-platform" className="block text-xs font-bold text-slate-400 uppercase mb-1">API target Router</label>
              <select 
                id="campaign-test-platform"
                aria-label="API target router"
                value={builderPlatform}
                onChange={(e) => setBuilderPlatform(e.target.value as Platform)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-medium    cursor-pointer"
              >
                <option value="Meta CAPI">Meta CAPI</option>
                <option value="TikTok Events API">TikTok Events API</option>
                <option value="GA4">Google Analytics 4</option>
              </select>
              <div className="mt-2">
                <PlatformBadge platform={builderPlatform} label={builderPlatform} active />
              </div>
            </div>

            <div>
              <label htmlFor="campaign-test-event" className="block text-xs font-bold text-slate-400 uppercase mb-1">Standard Event Trigger</label>
              <select 
                id="campaign-test-event"
                aria-label="Standard event trigger"
                value={builderEventName}
                onChange={(e) => setBuilderEventName(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-medium    cursor-pointer"
              >
                <option value="Purchase">Purchase</option>
                <option value="AddToCart">AddToCart</option>
                <option value="InitiateCheckout">InitiateCheckout</option>
                <option value="PageView">PageView</option>
                <option value="Lead">Lead</option>
                <option value="Contact">Contact</option>
              </select>
            </div>
          </div>

          <div className="hidden h-px bg-slate-100 md:block" />

          {/* Transaction info fields */}
          <div className="space-y-2 md:space-y-4">
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-widest bg-indigo-50/50   py-1 px-2 rounded">Variables catalog metadata</h3>
            
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div>
                <label htmlFor="campaign-test-value" className="block text-xs font-medium text-slate-500 mb-1">Assigned value (price)</label>
                <input 
                  id="campaign-test-value"
                  type="text" 
                  aria-label="Assigned value price"
                  value={builderValue}
                  onChange={(e) => setBuilderValue(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono   "
                />
              </div>
              <div>
                <label htmlFor="campaign-test-currency" className="block text-xs font-medium text-slate-500 mb-1">Currency Schema</label>
                <input 
                  id="campaign-test-currency"
                  type="text" 
                  aria-label="Currency schema"
                  value={builderCurrency}
                  onChange={(e) => setBuilderCurrency(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono   "
                />
              </div>
            </div>
          </div>

          {/* Customer matches indicators */}
          <div className="space-y-2 md:space-y-4">
            <h3 className="text-xs font-bold text-cyan-700 uppercase tracking-widest bg-cyan-50/50   py-1 px-2 rounded flex items-center">
              Identities (hashed automatically)
              <Tooltip content="এড প্ল্যাটফর্মে কাস্টমার প্রোফাইল ম্যাচ করার জন্য ইমেইল বা ফোন নম্বরকে SHA-256 সিকিউরড অ্যালগরিদমে হ্যাশ করে নিরাপদে পাঠানো হয়।" />
            </h3>
            
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div>
                <label htmlFor="campaign-test-email" className="block text-xs font-medium text-slate-500 mb-1">Email address</label>
                <input 
                  id="campaign-test-email"
                  type="email" 
                  aria-label="Customer email address"
                  value={builderEmail}
                  onChange={(e) => setBuilderEmail(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono   "
                />
              </div>
              <div>
                <label htmlFor="campaign-test-phone" className="block text-xs font-medium text-slate-500 mb-1">Phone number</label>
                <input 
                  id="campaign-test-phone"
                  type="text" 
                  aria-label="Customer phone number"
                  value={builderPhone}
                  onChange={(e) => setBuilderPhone(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono   "
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:gap-4">
              <div>
                <label htmlFor="campaign-test-ip" className="block text-xs font-medium text-slate-500 mb-1">Client origin IP address</label>
                <input 
                  id="campaign-test-ip"
                  type="text" 
                  aria-label="Client origin IP address"
                  value={builderIp}
                  onChange={(e) => setBuilderIp(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono   "
                />
              </div>
              <div>
                <label htmlFor="campaign-test-user-agent" className="block text-xs font-medium text-slate-500 mb-1">Client User Agent header</label>
                <input 
                  id="campaign-test-user-agent"
                  type="text" 
                  aria-label="Client user agent header"
                  value={builderUa}
                  onChange={(e) => setBuilderUa(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono   "
                />
              </div>
            </div>
          </div>

          <div className="hidden h-px bg-slate-100 md:block" />

          {/* Add customized parameters */}
          <div className="space-y-2 md:space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider ">Custom Tracking Fields</h3>
              <button 
                type="button"
                onClick={() => setCustomParams(prev => [...prev, { k: '', v: '' }])}
                className="flex min-h-10 items-center gap-1 px-2 text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>

            <div className="space-y-2">
              {(customParams || []).map((param, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_auto] items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="Key (e.g. content_name)"
                    aria-label={`Custom tracking field ${index + 1} key`}
                    value={param.k}
                    onChange={(e) => {
                      const updated = [...(customParams || [])];
                      updated[index].k = e.target.value;
                      setCustomParams(updated);
                    }}
                    className="min-w-0 p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono   "
                  />
                  <input 
                    type="text" 
                    placeholder="Value"
                    aria-label={`Custom tracking field ${index + 1} value`}
                    value={param.v}
                    onChange={(e) => {
                      const updated = [...(customParams || [])];
                      updated[index].v = e.target.value;
                      setCustomParams(updated);
                    }}
                    className="min-w-0 p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono   "
                  />
                  <button 
                    type="button"
                    onClick={() => setCustomParams(prev => (prev || []).filter((_, idx) => idx !== index))}
                    aria-label={`Remove custom tracking field ${index + 1}`}
                    title={`Remove custom tracking field ${index + 1}`}
                    className="inline-flex h-10 w-10 items-center justify-center justify-self-end text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              disabled={dispatchingTest}
              className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-indigo-400 cursor-pointer"
            >
              {dispatchingTest ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending test event...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Dispatch sandbox Test event</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Right live preview monitor and sandbox gateway results viewer */}
        <div className={`${mobileTab === 'preview' ? 'flex' : 'hidden'} flex-col gap-2 md:flex md:gap-6`}>
          
          {/* JSON Live representation page container */}
          <div id="campaign-data-preview" className="scroll-mt-24 flex h-[304px] flex-col justify-between rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-xs text-slate-200 shadow-sm md:h-96 md:p-5">
            <div>
              <div className="flex justify-between items-center mb-3 text-slate-400 font-sans border-b border-slate-800 pb-2">
                <span className="text-xs uppercase font-bold tracking-wider text-[#738196]">Event Data Preview</span>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-400 before:h-1 before:w-1 before:rounded-full before:bg-emerald-400">Updating dynamically</span>
                  <button
                    type="button"
                    aria-label="Copy event data preview"
                    onClick={() => handleCopy(renderCampaignPayloadJson(), 'campaign_payload')}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-400 hover:text-white"
                  >
                    {copiedStates['campaign_payload'] ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
              <pre tabIndex={0} aria-label="Event data JSON preview" className="overflow-auto max-h-56 select-all leading-normal whitespace-pre-wrap break-words outline-none focus:ring-2 focus:ring-indigo-400 md:max-h-72">{renderCampaignPayloadJson()}</pre>
            </div>

            <p className="text-xs text-[#7b8189] font-sans leading-normal pt-2 border-t border-slate-800 italic">
              Customer match details are protected before the test event is sent.
            </p>
          </div>

          {/* Sandboxed API gate output response */}
          <div className="flex flex-1 flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-5">
            <div className="flex items-start gap-2.5">
              <div className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
                <RefreshCcw className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider ">Test Event Response</h3>
                <p className="mb-3 text-[10px] leading-snug text-slate-400 md:mb-4 md:text-xs">Responses returned after sending the test event.</p>
              </div>
            </div>

            {campaignResp ? (
              <div className="flex-1 bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 overflow-auto max-h-60 space-y-2 relative">
                <div className="flex justify-between border-b border-slate-800 pb-1.5 text-xs font-sans">
                  <span className="text-slate-400">Response Status Code:</span>
                  <span className={campaignResp?.body?.success ? 'text-green-400 font-bold' : 'text-rose-400 font-semibold'}>{campaignResp?.statusCode} {campaignResp?.body?.success ? 'ACCEPTED' : 'REJECTED'}</span>
                </div>
                <pre className="whitespace-pre-wrap leading-tight text-xs">{JSON.stringify(campaignResp?.body, null, 2)}</pre>
              </div>
            ) : (
              <div className="flex min-h-20 flex-1 flex-col items-center justify-center space-y-2 rounded-lg border border-dashed border-slate-200 p-4 text-center text-slate-400 md:min-h-36 md:space-y-3 md:p-8">
                <Terminal className="h-6 w-6 text-slate-300 md:h-8 md:w-8" />
                <p className="text-xs leading-normal max-w-xs">Fill out the form and send a test event to see the response here.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
