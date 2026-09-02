import { useEffect, useState } from 'react';
import type { SyncedAdCampaign, UserProfile } from '../types';

const HTTPS_PREFIX = 'https://';

type ShowToast = (msg: string, isErr?: boolean, action?: { label: string; onClick: () => void }) => void;

/**
 * Owns every piece of state behind the Campaign Tools UTM builder: the form
 * fields, the synced ad campaign list and the compiled tracking URL.
 *
 * `storeBaseUrl` comes from the connected store (see resolveCampaignBaseUrl).
 * It used to be a domain guessed from the account name, which handed clients
 * tracking links pointing at a site they do not own.
 */
export function useCampaignUrlBuilder(profile: UserProfile | null, showToast: ShowToast, storeBaseUrl: string) {
  const [urlBuilderBaseUrl, setUrlBuilderBaseUrl] = useState<string>('');
  const [urlBuilderSource, setUrlBuilderSource] = useState<string>('facebook');
  const [urlBuilderMedium, setUrlBuilderMedium] = useState<string>('paid_social');
  const [urlBuilderCampaign, setUrlBuilderCampaign] = useState<string>('');
  const [urlBuilderContent, setUrlBuilderContent] = useState<string>('');
  const [urlBuilderTerm, setUrlBuilderTerm] = useState<string>('');
  const [urlBuilderAdPlatform, setUrlBuilderAdPlatform] = useState<'meta' | 'tiktok'>('meta');
  const [urlBuilderCampaignId, setUrlBuilderCampaignId] = useState<string>('');
  const [syncedAdCampaigns, setSyncedAdCampaigns] = useState<SyncedAdCampaign[]>([]);
  const [loadingSyncedAdCampaigns, setLoadingSyncedAdCampaigns] = useState<boolean>(false);
  const [generatedCampaignUrl, setGeneratedCampaignUrl] = useState<string>('');

  useEffect(() => {
    // Stores load after the first render, so this fills the field once the
    // domain arrives - and only while it is still empty, so a late store
    // response cannot overwrite a URL the client already typed.
    if (storeBaseUrl) setUrlBuilderBaseUrl(prev => prev || storeBaseUrl);
  }, [storeBaseUrl]);

  useEffect(() => {
    if (!profile) return;
    const fetchSyncedAdCampaigns = async () => {
      setLoadingSyncedAdCampaigns(true);
      try {
        const res = await fetch('/api/v1/ad-campaigns');
        if (res.ok) {
          const data = await res.json();
          setSyncedAdCampaigns(Array.isArray(data) ? data : []);
        } else {
          showToast('Could not load your synced ad campaigns. You can still build a URL manually.', true);
        }
      } catch (err) {
        console.error('Failed to load synced ad campaigns', err);
        showToast('Could not load your synced ad campaigns. You can still build a URL manually.', true);
      } finally {
        setLoadingSyncedAdCampaigns(false);
      }
    };
    fetchSyncedAdCampaigns();
  }, [profile]);

  const compileCampaignUrl = () => {
    if (!urlBuilderBaseUrl.trim() || !urlBuilderCampaign.trim()) return '';
    try {
      let base = urlBuilderBaseUrl.trim();
      if (!/^https?:\/\//i.test(base)) {
        base = HTTPS_PREFIX + base;
      }
      const url = new URL(base);
      url.searchParams.set('utm_source', urlBuilderSource.trim());
      url.searchParams.set('utm_medium', urlBuilderMedium.trim());
      url.searchParams.set('utm_campaign', urlBuilderCampaign.trim().toLowerCase().replace(/\s+/g, '_'));
      if (urlBuilderCampaignId.trim()) {
        url.searchParams.set('bk_platform', urlBuilderAdPlatform);
        url.searchParams.set('bk_campaign_id', urlBuilderCampaignId.trim());
      }
      if (urlBuilderContent.trim()) {
        url.searchParams.set('utm_content', urlBuilderContent.trim());
      }
      if (urlBuilderTerm.trim()) {
        url.searchParams.set('utm_term', urlBuilderTerm.trim());
      }
      return url.toString();
    } catch {
      return '';
    }
  };

  useEffect(() => {
    setGeneratedCampaignUrl(compileCampaignUrl());
  }, [
    urlBuilderBaseUrl,
    urlBuilderSource,
    urlBuilderMedium,
    urlBuilderCampaign,
    urlBuilderContent,
    urlBuilderTerm,
    urlBuilderAdPlatform,
    urlBuilderCampaignId,
  ]);

  const handleGenerateCampaignUrl = () => {
    if (!urlBuilderBaseUrl.trim()) {
      showToast('Please enter a base website URL', true);
      return;
    }
    if (!urlBuilderCampaign.trim()) {
      showToast('Please enter a campaign name', true);
      return;
    }
    const compiled = compileCampaignUrl();
    if (compiled) {
      setGeneratedCampaignUrl(compiled);
      showToast('Campaign URL is ready.', false);
    } else {
      showToast('Invalid base URL format', true);
    }
  };

  return {
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
  };
}

export default useCampaignUrlBuilder;
