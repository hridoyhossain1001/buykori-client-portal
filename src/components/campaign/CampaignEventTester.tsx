import React from 'react';
import { Plus, Trash2, Send, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';
import { Badge } from '../common';
import { PlatformBadge } from '../common/PlatformLogo';
import type { Platform } from '../../types';
import { resolveCampaignDispatchBoundary, type CampaignCustomParam } from './campaignPayload';

interface CampaignEventTesterProps {
  active: boolean;
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
  customParams: CampaignCustomParam[];
  setCustomParams: React.Dispatch<React.SetStateAction<CampaignCustomParam[]>>;
  dispatchingTest: boolean;
  handleDispatchSandboxTest: (e: React.FormEvent) => Promise<void>;
}

const FIELD_LABEL = 'block text-xs font-medium text-slate-500 mb-1';
const MONO_INPUT = 'w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-mono placeholder-slate-400   ';
const SELECT_CLASS = 'w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded font-medium    cursor-pointer';
const SAMPLE_TAG = 'rounded bg-slate-100 px-1 text-[9px] font-bold uppercase tracking-wide text-slate-400';

const IDENTITY_TOOLTIP = 'এড প্ল্যাটফর্মে কাস্টমার প্রোফাইল ম্যাচ করার জন্য ইমেইল বা ফোন নম্বরকে SHA-256 সিকিউরড অ্যালগরিদমে হ্যাশ করে নিরাপদে পাঠানো হয়।';

export function CampaignEventTester({
  active,
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
  dispatchingTest,
  handleDispatchSandboxTest,
}: CampaignEventTesterProps) {
  const boundary = resolveCampaignDispatchBoundary();
  const sandboxed = boundary.mode === 'sandbox';

  return (
    <form id="campaign-event-tester" onSubmit={handleDispatchSandboxTest} className={`${active ? 'block' : 'hidden'} scroll-mt-24 rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-3 md:block md:p-6 md:space-y-6`}>
      <div className="flex items-start gap-2.5 border-b border-slate-100 pb-2.5 md:border-0 md:pb-0">
        <div className="rounded-lg bg-amber-50 p-1.5 text-amber-500 md:hidden">
          <Send className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Campaign Event Tester</h2>
            <Badge tone={sandboxed ? 'success' : 'warning'} dot>{sandboxed ? 'Sandbox' : 'Live'}</Badge>
          </div>
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
            className={SELECT_CLASS}
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
            className={SELECT_CLASS}
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

        {/* items-end keeps both inputs on one baseline at 375px, where the
            longer label plus its Sample tag wraps to a second line. */}
        <div className="grid grid-cols-2 items-end gap-2 md:gap-4">
          <div>
            <label htmlFor="campaign-test-value" className={FIELD_LABEL}>Assigned value (price) <span className={SAMPLE_TAG}>Sample</span></label>
            <input
              id="campaign-test-value"
              type="text"
              aria-label="Assigned value price"
              placeholder="0.00"
              value={builderValue}
              onChange={(e) => setBuilderValue(e.target.value)}
              className={MONO_INPUT}
            />
          </div>
          <div>
            <label htmlFor="campaign-test-currency" className={FIELD_LABEL}>Currency Schema <span className={SAMPLE_TAG}>Sample</span></label>
            <input
              id="campaign-test-currency"
              type="text"
              aria-label="Currency schema"
              placeholder="BDT"
              value={builderCurrency}
              onChange={(e) => setBuilderCurrency(e.target.value)}
              className={MONO_INPUT}
            />
          </div>
        </div>
      </div>

      {/* Customer matches indicators */}
      <div className="space-y-2 md:space-y-4">
        <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest bg-blue-50/50   py-1 px-2 rounded flex items-center">
          Identities (hashed automatically)
          <Tooltip content={IDENTITY_TOOLTIP} />
        </h3>

        <p className="text-xs leading-normal text-slate-400">Left empty on purpose. Nothing here is read from your store, so type made-up details if you want to test identity matching.</p>

        <div className="grid grid-cols-2 gap-2 md:gap-4">
          <div>
            <label htmlFor="campaign-test-email" className={FIELD_LABEL}>Email address</label>
            <input
              id="campaign-test-email"
              type="email"
              aria-label="Customer email address"
              placeholder="Optional test email"
              value={builderEmail}
              onChange={(e) => setBuilderEmail(e.target.value)}
              className={MONO_INPUT}
            />
          </div>
          <div>
            <label htmlFor="campaign-test-phone" className={FIELD_LABEL}>Phone number</label>
            <input
              id="campaign-test-phone"
              type="text"
              aria-label="Customer phone number"
              placeholder="Optional test phone"
              value={builderPhone}
              onChange={(e) => setBuilderPhone(e.target.value)}
              className={MONO_INPUT}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-4">
          <div>
            <label htmlFor="campaign-test-ip" className={FIELD_LABEL}>Client origin IP address</label>
            <input
              id="campaign-test-ip"
              type="text"
              aria-label="Client origin IP address"
              placeholder="Optional test IP"
              value={builderIp}
              onChange={(e) => setBuilderIp(e.target.value)}
              className={MONO_INPUT}
            />
          </div>
          <div>
            <label htmlFor="campaign-test-user-agent" className={FIELD_LABEL}>Client User Agent header</label>
            <input
              id="campaign-test-user-agent"
              type="text"
              aria-label="Client user agent header"
              placeholder="Optional test agent"
              value={builderUa}
              onChange={(e) => setBuilderUa(e.target.value)}
              className={MONO_INPUT}
            />
          </div>
        </div>
      </div>

      <div className="hidden h-px bg-slate-100 md:block" />

      {/* Add customized parameters */}
      <div className="space-y-2 md:space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider ">Custom Tracking Fields <span className={SAMPLE_TAG}>Sample keys</span></h3>
          <button
            type="button"
            onClick={() => setCustomParams(prev => [...prev, { k: '', v: '' }])}
            className="flex min-h-11 items-center gap-1 px-2 text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
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
                className="inline-flex h-11 w-11 items-center justify-center justify-self-end text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sandbox/live boundary. Sits directly above the submit button so the
          reach of the dispatch is stated where the decision is made, not in a
          tooltip somewhere else on the page. */}
      <div className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${sandboxed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`} role={sandboxed ? undefined : 'alert'}>
        {sandboxed ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <p className="min-w-0"><strong className="font-bold">{boundary.headline}</strong> {boundary.detail}</p>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={dispatchingTest}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-indigo-400 cursor-pointer"
        >
          {dispatchingTest ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Sending test event...</span>
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              <span>{sandboxed ? 'Dispatch sandbox test event' : 'Dispatch live tracked event'}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
