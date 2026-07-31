import React from 'react';
import { CampaignDispatchResponse, Platform, SyncedAdCampaign } from '../types';
import { CampaignMobileTabs } from './campaign/CampaignMobileTabs';
import { CampaignUrlForm } from './campaign/CampaignUrlForm';
import { CampaignUrlResult } from './campaign/CampaignUrlResult';
import { CampaignEventTester } from './campaign/CampaignEventTester';
import { CampaignPreviewPanel } from './campaign/CampaignPreviewPanel';
import { buildCampaignPayloadJson } from './campaign/campaignPayload';
import { useCampaignSectionJump } from './campaign/useCampaignSectionJump';

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
  const { mobileTab, setMobileTab } = useCampaignSectionJump();

  // Custom live campaign payload sandbox generator helper
  const renderCampaignPayloadJson = () => buildCampaignPayloadJson({
    builderEventName,
    builderValue,
    builderCurrency,
    builderEmail,
    builderPhone,
    builderIp,
    builderUa,
    customParams,
  });

  return (
    <div className="space-y-2 md:space-y-8">
      <CampaignMobileTabs mobileTab={mobileTab} setMobileTab={setMobileTab} />

      {/* Campaign URL Builder Widget */}
      <div id="campaign-url-builder" className={`${mobileTab === 'url' ? 'flex' : 'hidden'} scroll-mt-24 flex-col gap-2 md:grid md:grid-cols-2 md:gap-6 md:rounded-xl md:border md:border-slate-200 md:bg-white md:p-6 md:shadow-sm`}>
        <CampaignUrlForm
          urlBuilderBaseUrl={urlBuilderBaseUrl}
          setUrlBuilderBaseUrl={setUrlBuilderBaseUrl}
          urlBuilderSource={urlBuilderSource}
          setUrlBuilderSource={setUrlBuilderSource}
          urlBuilderMedium={urlBuilderMedium}
          setUrlBuilderMedium={setUrlBuilderMedium}
          urlBuilderCampaign={urlBuilderCampaign}
          setUrlBuilderCampaign={setUrlBuilderCampaign}
          urlBuilderContent={urlBuilderContent}
          setUrlBuilderContent={setUrlBuilderContent}
          urlBuilderTerm={urlBuilderTerm}
          setUrlBuilderTerm={setUrlBuilderTerm}
          urlBuilderAdPlatform={urlBuilderAdPlatform}
          setUrlBuilderAdPlatform={setUrlBuilderAdPlatform}
          urlBuilderCampaignId={urlBuilderCampaignId}
          setUrlBuilderCampaignId={setUrlBuilderCampaignId}
          syncedAdCampaigns={syncedAdCampaigns}
          loadingSyncedAdCampaigns={loadingSyncedAdCampaigns}
          handleGenerateCampaignUrl={handleGenerateCampaignUrl}
        />

        <CampaignUrlResult
          generatedCampaignUrl={generatedCampaignUrl}
          copiedStates={copiedStates}
          handleCopy={handleCopy}
        />
      </div>

      <div className="contents md:grid md:grid-cols-1 md:gap-8 lg:grid-cols-2">

        {/* Builder Form controls */}
        <CampaignEventTester
          active={mobileTab === 'tester'}
          builderPlatform={builderPlatform}
          setBuilderPlatform={setBuilderPlatform}
          builderEventName={builderEventName}
          setBuilderEventName={setBuilderEventName}
          builderValue={builderValue}
          setBuilderValue={setBuilderValue}
          builderCurrency={builderCurrency}
          setBuilderCurrency={setBuilderCurrency}
          builderEmail={builderEmail}
          setBuilderEmail={setBuilderEmail}
          builderPhone={builderPhone}
          setBuilderPhone={setBuilderPhone}
          builderIp={builderIp}
          setBuilderIp={setBuilderIp}
          builderUa={builderUa}
          setBuilderUa={setBuilderUa}
          customParams={customParams}
          setCustomParams={setCustomParams}
          dispatchingTest={dispatchingTest}
          handleDispatchSandboxTest={handleDispatchSandboxTest}
        />

        {/* Right live preview monitor and sandbox gateway results viewer */}
        <CampaignPreviewPanel
          active={mobileTab === 'preview'}
          getPayloadJson={renderCampaignPayloadJson}
          campaignResp={campaignResp}
          copiedStates={copiedStates}
          handleCopy={handleCopy}
        />

      </div>
    </div>
  );
}
