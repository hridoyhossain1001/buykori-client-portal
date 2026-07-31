import { Copy, Check, Info } from 'lucide-react';

interface CampaignUrlResultProps {
  generatedCampaignUrl: string;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
}

export function CampaignUrlResult({ generatedCampaignUrl, copiedStates, handleCopy }: CampaignUrlResultProps) {
  return (
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
  );
}
