import { RefreshCw } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

const HEADER_TOOLTIP = 'Incomplete checkout sessions that remain unfinished after the customer entered checkout details.';
const HEADER_SUBTITLE = 'Customers who start checkout but do not order within 5 minutes appear here.';

interface IncompleteCheckoutsHeaderProps {
  onRefresh: () => Promise<void>;
  displayCounts: {
    active: number;
    incomplete: number;
    contacted: number;
    recovered: number;
  };
  rawCounts: {
    active?: number;
    incomplete?: number;
    contacted?: number;
    recovered?: number;
  };
}

export function IncompleteCheckoutsHeader({ onRefresh, displayCounts, rawCounts }: IncompleteCheckoutsHeaderProps) {
  return (
    <>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:hidden">
        <div className="flex items-start justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <h2 className="flex items-center text-[14px] font-black leading-tight text-slate-900">
              Incomplete Checkout Recovery
              <Tooltip content={HEADER_TOOLTIP} />
            </h2>
            <p className="mt-0.5 text-[9px] leading-[13px] text-slate-500">
              {HEADER_SUBTITLE}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh incomplete orders"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold text-slate-600"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-4 border-t border-slate-100">
          {[
            ['Active', displayCounts.active, 'text-slate-900'],
            ['Incomplete', displayCounts.incomplete, 'text-amber-600'],
            ['Contacted', displayCounts.contacted, 'text-violet-600'],
            ['Recovered', displayCounts.recovered, 'text-emerald-600'],
          ].map(([label, count, tone], index) => (
            <div key={String(label)} className={`px-1 py-2 text-center ${index > 0 ? 'border-l border-slate-100' : ''}`}>
              <p className="truncate text-[7px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</p>
              <p className={`mt-1 text-[18px] font-black leading-none ${tone}`}>{count}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="hidden flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:flex md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center">
            Incomplete Checkout Recovery
            <Tooltip content={HEADER_TOOLTIP} />
          </h2>
          <p className="mt-1 text-xs text-slate-500">{HEADER_SUBTITLE}</p>
        </div>
        <button onClick={onRefresh} className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50  ">
          Refresh list
        </button>
      </div>

      <div className="hidden grid-cols-2 gap-3 md:grid md:grid-cols-4">
        {[
          ['Active', rawCounts.active || 0],
          ['Incomplete', rawCounts.incomplete || 0],
          ['Contacted', rawCounts.contacted || 0],
          ['Recovered', rawCounts.recovered || 0],
        ].map(([label, count]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4  ">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>
    </>
  );
}
