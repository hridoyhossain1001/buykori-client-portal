import React from 'react';
import { Link } from 'lucide-react';
import { PlatformBadge } from '../common/PlatformLogo';
import type { SyncedAdCampaign } from '../../types';

interface CampaignUrlFormProps {
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
  handleGenerateCampaignUrl: () => void;
}

const LABEL_CLASS = 'mb-1 block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500 md:text-xs';
const INPUT_CLASS = 'h-8 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none transition-all duration-200 placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5';
const SELECT_CLASS = 'h-8 w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 md:h-auto md:p-2.5';

function sourceLabel(source: string) {
  if (source === 'facebook') return 'Facebook Ads';
  if (source === 'tiktok') return 'TikTok Ads';
  if (source === 'google') return 'Google Ads';
  return source;
}

export function CampaignUrlForm({
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
  handleGenerateCampaignUrl,
}: CampaignUrlFormProps) {
  const campaignOptions = React.useMemo(
    () => (Array.isArray(syncedAdCampaigns) ? syncedAdCampaigns : [])
      .filter((campaign) => campaign.platform === urlBuilderAdPlatform),
    [syncedAdCampaigns, urlBuilderAdPlatform]
  );

  return (
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
          <label htmlFor="campaign-url-base" className={LABEL_CLASS}>Base Website URL</label>
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
            <label htmlFor="campaign-url-source" className={LABEL_CLASS}>Campaign Source</label>
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
              className={SELECT_CLASS}
            >
              <option value="facebook">Facebook Ads</option>
              <option value="tiktok">TikTok Ads</option>
              <option value="google">Google CPC</option>
              <option value="newsletter">Email Newsletter</option>
              <option value="custom">Custom Partner</option>
            </select>
          </div>
          <div>
            <label htmlFor="campaign-url-medium" className={LABEL_CLASS}>Campaign Medium</label>
            <input
              id="campaign-url-medium"
              type="text"
              aria-label="Campaign medium"
              placeholder="paid_social"
              value={urlBuilderMedium}
              onChange={(e) => setUrlBuilderMedium(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        {/* Campaign Name */}
        <div>
          <label htmlFor="campaign-url-name" className={LABEL_CLASS}>Campaign Name</label>
          <input
            id="campaign-url-name"
            type="text"
            aria-label="Campaign name"
            placeholder="eid_sale_promotion"
            value={urlBuilderCampaign}
            onChange={(e) => setUrlBuilderCampaign(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-[150px_minmax(0,1fr)] md:gap-4">
          <div>
            <label htmlFor="campaign-url-ad-platform" className={LABEL_CLASS}>Ad Platform</label>
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
              className={SELECT_CLASS}
            >
              <option value="meta">Meta</option>
              <option value="tiktok">TikTok</option>
            </select>
            <div className="mt-2 hidden md:block">
              <PlatformBadge platform={urlBuilderSource} label={sourceLabel(urlBuilderSource)} active />
            </div>
          </div>
          <div className="md:hidden">
            <span className="mb-1 block text-[9px] font-bold uppercase leading-none tracking-wider text-slate-500">Connected</span>
            <div className="flex min-h-8 items-center">
              <PlatformBadge platform={urlBuilderSource} label={urlBuilderSource === 'facebook' ? 'Facebook Ads' : 'TikTok Ads'} active />
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label htmlFor="campaign-url-exact-campaign" className={LABEL_CLASS}>Choose Ad Campaign</label>
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
              className={SELECT_CLASS}
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
              className={INPUT_CLASS}
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
              className={INPUT_CLASS}
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
  );
}
