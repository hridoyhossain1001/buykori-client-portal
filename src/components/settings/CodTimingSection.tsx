import React from 'react';

interface CodTimingSectionProps {
  deferredEnabled: boolean;
  autoConfirmLabel: string;
  formattedConfirmStatus: string;
  onOpenPage?: (pageId: string) => void;
}

const CodTimingSection: React.FC<CodTimingSectionProps> = ({
  deferredEnabled,
  autoConfirmLabel,
  formattedConfirmStatus,
  onOpenPage,
}) => {
  return (
        <section id="settings-cod" aria-labelledby="settings-cod-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 id="settings-cod-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">COD Purchase Timing</h2>
              <p className="text-xs text-slate-400 ">
                Choose when a COD Purchase event is sent. You can send it at once, or wait until you confirm the order.
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
              deferredEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}>
              {deferredEnabled ? 'Protection on' : 'Protection off'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Purchase timing</p>
              <p className="mt-1 text-sm font-black text-slate-900">{deferredEnabled ? 'Wait for your confirmation' : 'Send right away'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Auto-confirm</p>
              <p className="mt-1 text-sm font-black text-slate-900">{autoConfirmLabel}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Confirm status</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formattedConfirmStatus}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-relaxed">
              To confirm a COD order or change its waiting time, open COD Protection.
            </p>
            <button
              type="button"
              onClick={() => onOpenPage?.('pending-purchases')}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!onOpenPage}
            >
              Open COD Protection
            </button>
          </div>
        </section>
  );
};

export default CodTimingSection;
