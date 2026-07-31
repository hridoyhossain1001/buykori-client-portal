import { Terminal, Copy, Check, RefreshCcw } from 'lucide-react';
import type { CampaignDispatchResponse } from '../../types';

interface CampaignPreviewPanelProps {
  active: boolean;
  /**
   * Called on render and again on copy, exactly as before the split, so the
   * event_time in a copied payload is the time of the click.
   */
  getPayloadJson: () => string;
  campaignResp: CampaignDispatchResponse | null;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
}

export function CampaignPreviewPanel({
  active,
  getPayloadJson,
  campaignResp,
  copiedStates,
  handleCopy,
}: CampaignPreviewPanelProps) {
  return (
    <div className={`${active ? 'flex' : 'hidden'} flex-col gap-2 md:flex md:gap-6`}>

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
                onClick={() => handleCopy(getPayloadJson(), 'campaign_payload')}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-800 text-slate-400 hover:text-white"
              >
                {copiedStates['campaign_payload'] ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>
          <pre tabIndex={0} aria-label="Event data JSON preview" className="overflow-auto max-h-56 select-all leading-normal whitespace-pre-wrap break-words outline-none focus:ring-2 focus:ring-indigo-400 md:max-h-72">{getPayloadJson()}</pre>
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
  );
}
