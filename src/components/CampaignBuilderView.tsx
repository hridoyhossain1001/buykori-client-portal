import React from 'react';
import { Plus, Trash2, Send, Terminal, Link, Copy, Check, Info } from 'lucide-react';
import { Tooltip } from './common/Tooltip';
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
      window.requestAnimationFrame(() => {
        document.getElementById(detail.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Campaign URL Builder Widget */}
      <div id="campaign-url-builder" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col space-y-4   md:p-6">
        <div className="flex items-start gap-2.5 pb-3 border-b border-slate-100 ">
          <div className="hidden p-2 rounded-lg bg-indigo-50  text-indigo-600  sm:block">
            <Link className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Campaign URL Builder</h2>
            <p className="text-xs text-slate-400 ">Create a campaign link so Buykori can show which ads bring visits and orders.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          
          {/* Input parameters Form */}
          <div className="space-y-4">
            
            {/* Base Website URL */}
            <div>
              <label htmlFor="campaign-url-base" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ">Base Website URL</label>
              <input 
                id="campaign-url-base"
                type="text" 
                aria-label="Base website URL"
                placeholder="https://your-domain.com/shop/item"
                value={urlBuilderBaseUrl}
                onChange={(e) => setUrlBuilderBaseUrl(e.target.value)}
                className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 font-mono   "
              />
            </div>

            {/* Source & Medium grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="campaign-url-source" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ">Campaign Source</label>
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
                  className="w-full p-2.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200    cursor-pointer"
                >
                  <option value="facebook">Facebook Ads</option>
                  <option value="tiktok">TikTok Ads</option>
                  <option value="google">Google CPC</option>
                  <option value="newsletter">Email Newsletter</option>
                  <option value="custom">Custom Partner</option>
                </select>
              </div>
              <div>
                <label htmlFor="campaign-url-medium" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ">Campaign Medium</label>
                <input 
                  id="campaign-url-medium"
                  type="text" 
                  aria-label="Campaign medium"
                  placeholder="paid_social"
                  value={urlBuilderMedium}
                  onChange={(e) => setUrlBuilderMedium(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200   "
                />
              </div>
            </div>

            {/* Campaign Name */}
            <div>
              <label htmlFor="campaign-url-name" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ">Campaign Name</label>
              <input 
                id="campaign-url-name"
                type="text" 
                aria-label="Campaign name"
                placeholder="eid_sale_promotion"
                value={urlBuilderCampaign}
                onChange={(e) => setUrlBuilderCampaign(e.target.value)}
                className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200   "
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[150px_minmax(0,1fr)] gap-4">
              <div>
                <label htmlFor="campaign-url-ad-platform" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ">Ad Platform</label>
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
                  className="w-full p-2.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 cursor-pointer"
                >
                  <option value="meta">Meta</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </div>
              <div>
                <label htmlFor="campaign-url-exact-campaign" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ">Choose Ad Campaign</label>
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
                  className="w-full p-2.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200 cursor-pointer"
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
                <p className="mt-1 text-xs leading-normal text-slate-400">
                  This helps Buykori match your ad cost with the orders from this campaign.
                </p>
              </div>
            </div>

            {/* Optional parameters Content & Term */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="campaign-url-content" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ">Ad Content (Optional)</label>
                <input 
                  id="campaign-url-content"
                  type="text" 
                  aria-label="Ad content"
                  placeholder="video_ad_1"
                  value={urlBuilderContent}
                  onChange={(e) => setUrlBuilderContent(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200   "
                />
              </div>
              <div>
                <label htmlFor="campaign-url-term" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ">Search Term (Optional)</label>
                <input 
                  id="campaign-url-term"
                  type="text" 
                  aria-label="Search term"
                  placeholder="buy_shoes"
                  value={urlBuilderTerm}
                  onChange={(e) => setUrlBuilderTerm(e.target.value)}
                  className="w-full p-2.5 text-xs text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-200   "
                />
              </div>
            </div>

            <button 
              type="button"
              onClick={handleGenerateCampaignUrl}
              className="min-h-10 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 shadow-md shadow-indigo-500/10 hover:shadow-indigo-500/20 cursor-pointer"
            >
              Create Campaign Link
            </button>

          </div>

          {/* Output generator result box */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-50/40 to-slate-50/20 border border-indigo-100/50 p-5 flex flex-col justify-between   ">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest ">Your Campaign Link</h3>
              <p className="text-xs text-slate-400 ">Copy this link and use it as the website link in Meta Ads Manager or TikTok Ads Manager.</p>
            </div>

            <div className="my-4 bg-white border border-slate-200 rounded-lg p-3 text-xs font-mono text-slate-700 break-all select-all    relative group min-h-24 flex items-center">
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

            <div className="text-xs text-slate-400 leading-normal flex items-start gap-1.5 ">
              <Info className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
              <span>Applying proper UTM discipline ensures tracking data cleanly attributes purchase value directly to campaigns.</span>
            </div>
          </div>

        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Builder Form controls */}
        <form id="campaign-event-tester" onSubmit={handleDispatchSandboxTest} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-5   md:p-6 md:space-y-6">
          <div>
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Campaign Event Tester</h2>
            <p className="text-xs text-slate-400 ">Build a sample WooCommerce event and test how it reaches your ad platforms.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="h-px bg-slate-100 " />

          {/* Transaction info fields */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-indigo-700 uppercase tracking-widest bg-indigo-50/50   py-1 px-2 rounded">Variables catalog metadata</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-cyan-700 uppercase tracking-widest bg-cyan-50/50   py-1 px-2 rounded flex items-center">
              Identities (hashed automatically)
              <Tooltip content="এড প্ল্যাটফর্মে কাস্টমার প্রোফাইল ম্যাচ করার জন্য ইমেইল বা ফোন নম্বরকে SHA-256 সিকিউরড অ্যালগরিদমে হ্যাশ করে নিরাপদে পাঠানো হয়।" />
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="h-px bg-slate-100 " />

          {/* Add customized parameters */}
          <div className="space-y-3">
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
                <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
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
        <div className="flex flex-col gap-6">
          
          {/* JSON Live representation page container */}
          <div id="campaign-data-preview" className="scroll-mt-24 rounded-xl border border-slate-200 bg-slate-900 p-4 shadow-sm text-slate-200 font-mono text-xs h-80 flex flex-col justify-between  md:h-96 md:p-5">
            <div>
              <div className="flex justify-between items-center mb-3 text-slate-400 font-sans border-b border-slate-800 pb-2">
                <span className="text-xs uppercase font-bold tracking-wider text-[#738196]">Event Data Preview</span>
                <span className="text-xs text-green-500 uppercase tracking-widest font-mono">Updating dynamically</span>
              </div>
              <pre tabIndex={0} aria-label="Event data JSON preview" className="overflow-auto max-h-56 select-all leading-normal whitespace-pre-wrap break-words outline-none focus:ring-2 focus:ring-indigo-400 md:max-h-72">{renderCampaignPayloadJson()}</pre>
            </div>

            <p className="text-xs text-[#7b8189] font-sans leading-normal pt-2 border-t border-slate-800 italic">
              Customer match details are protected before the test event is sent.
            </p>
          </div>

          {/* Sandboxed API gate output response */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex flex-col justify-between  ">
            <div>
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 ">Test Event Response</h3>
              <p className="text-xs text-slate-400  mb-4">Responses returned after sending the test event.</p>
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
              <div className="flex-1 border border-dashed border-slate-200  rounded-lg p-8 flex flex-col items-center justify-center text-center text-slate-400  space-y-3 min-h-36">
                <Terminal className="w-8 h-8 text-slate-300 " />
                <p className="text-xs leading-normal max-w-xs">Fill out the form and send a test event to see the response here.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
