import React from 'react';
import { Plus, Trash2, Send, Terminal } from 'lucide-react';
import { Platform } from '../types';

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
  campaignResp: any;
  dispatchingTest: boolean;
  handleDispatchSandboxTest: (e: React.FormEvent) => Promise<void>;
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
  handleDispatchSandboxTest
}: CampaignBuilderViewProps) {

  // Custom live campaign payload sandbox generator helper
  const renderCampaignPayloadJson = () => {
    const customObj: Record<string, any> = {};
    customParams.forEach(p => {
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      
      {/* Builder Form controls */}
      <form onSubmit={handleDispatchSandboxTest} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 dark:bg-slate-900 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Test Campaign event payload generator</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500">Assemble customized payload structures to simulate WooCommerce transactions telemetry stream sandbox testing</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-450 uppercase mb-1">API target Router</label>
            <select 
              value={builderPlatform}
              onChange={(e) => setBuilderPlatform(e.target.value as Platform)}
              className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-medium dark:bg-slate-950 dark:border-slate-800 dark:text-white cursor-pointer"
            >
              <option value="Meta CAPI">Meta CAPI</option>
              <option value="TikTok Events API">TikTok Events API</option>
              <option value="GA4">GA4 Measurement Protocol</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-455 uppercase mb-1">Standard Event Trigger</label>
            <select 
              value={builderEventName}
              onChange={(e) => setBuilderEventName(e.target.value)}
              className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-medium dark:bg-slate-950 dark:border-slate-800 dark:text-white cursor-pointer"
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

        <div className="h-px bg-slate-100 dark:bg-slate-800" />

        {/* Transaction info fields */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-indigo-755 uppercase tracking-widest bg-indigo-50/50 dark:bg-indigo-950/20 dark:text-indigo-400 py-1 px-2 rounded">Variables catalog metadata</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Assigned value (price)</label>
              <input 
                type="text" 
                value={builderValue}
                onChange={(e) => setBuilderValue(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-500 mb-1">Currency Schema</label>
              <input 
                type="text" 
                value={builderCurrency}
                onChange={(e) => setBuilderCurrency(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Customer matches indicators */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-cyan-755 uppercase tracking-widest bg-cyan-50/50 dark:bg-cyan-950/20 dark:text-cyan-400 py-1 px-2 rounded">Identities (hashed automatically)</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-slate-505 mb-1">Email address</label>
              <input 
                type="email" 
                value={builderEmail}
                onChange={(e) => setBuilderEmail(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-505 mb-1">Phone number</label>
              <input 
                type="text" 
                value={builderPhone}
                onChange={(e) => setBuilderPhone(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-medium text-slate-505 mb-1">Client origin IP address</label>
              <input 
                type="text" 
                value={builderIp}
                onChange={(e) => setBuilderIp(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-slate-505 mb-1">Client User Agent header</label>
              <input 
                type="text" 
                value={builderUa}
                onChange={(e) => setBuilderUa(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono dark:bg-slate-955 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100 dark:bg-slate-800" />

        {/* Add customized parameters */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-450">Custom tracking parameters schema</h4>
            <button 
              type="button"
              onClick={() => setCustomParams(prev => [...prev, { k: '', v: '' }])}
              className="text-[10px] text-indigo-750 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Add item
            </button>
          </div>

          <div className="space-y-2">
            {customParams.map((param, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input 
                  type="text" 
                  placeholder="Key (e.g. content_name)"
                  value={param.k}
                  onChange={(e) => {
                    const updated = [...customParams];
                    updated[index].k = e.target.value;
                    setCustomParams(updated);
                  }}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                />
                <input 
                  type="text" 
                  placeholder="Value"
                  value={param.v}
                  onChange={(e) => {
                    const updated = [...customParams];
                    updated[index].v = e.target.value;
                    setCustomParams(updated);
                  }}
                  className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded text-xs font-mono dark:bg-slate-955 dark:border-slate-800 dark:text-white"
                />
                <button 
                  type="button"
                  onClick={() => setCustomParams(prev => prev.filter((_, idx) => idx !== index))}
                  className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
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
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            {dispatchingTest ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Streaming telemetry payload...</span>
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
        <div className="rounded-xl border border-slate-200 bg-slate-900 p-5 shadow-sm text-slate-200 font-mono text-[11px] h-96 flex flex-col justify-between dark:border-slate-800">
          <div>
            <div className="flex justify-between items-center mb-3 text-slate-400 font-sans border-b border-slate-800 pb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider">Telemetry JSON Payload Preview</span>
              <span className="text-[9px] text-green-500 uppercase tracking-widest font-mono">Updating dynamically</span>
            </div>
            <pre className="overflow-auto max-h-72 select-all leading-normal whitespace-pre-wrap">{renderCampaignPayloadJson()}</pre>
          </div>

          <p className="text-[10px] text-slate-500 font-sans leading-normal pt-2 border-t border-slate-800 italic">
            Matching indicators automatically pass through security hash encoders before exit transmission.
          </p>
        </div>

        {/* Sandboxed API gate output response */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex-1 flex flex-col justify-between dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider mb-2 dark:text-white">Sandbox endpoint telemetry execution console</h4>
            <p className="text-xs text-slate-400 dark:text-slate-550 mb-4">Returned API diagnostic responses from the Conversions backend</p>
          </div>

          {campaignResp ? (
            <div className="flex-1 bg-slate-950 p-4 rounded-lg font-mono text-xs text-slate-300 overflow-auto max-h-60 space-y-2 relative">
              <div className="flex justify-between border-b border-slate-800 pb-1.5 text-[10px] font-sans">
                <span className="text-slate-400">Response Status Code:</span>
                <span className={campaignResp.body.success ? 'text-green-400 font-bold' : 'text-rose-400 font-semibold'}>{campaignResp.statusCode} {campaignResp.body.success ? 'ACCEPTED' : 'REJECTED'}</span>
              </div>
              <pre className="whitespace-pre-wrap leading-tight text-[11px]">{JSON.stringify(campaignResp.body, null, 2)}</pre>
            </div>
          ) : (
            <div className="flex-1 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-8 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 space-y-3 min-h-36">
              <Terminal className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              <p className="text-xs leading-normal max-w-xs">Sandbox execute execution. Populate client parameter forms and click dispatch event trigger to verify telemetry pipelines.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
