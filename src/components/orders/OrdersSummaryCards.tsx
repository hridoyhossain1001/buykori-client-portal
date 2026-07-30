import type { Dispatch, SetStateAction } from 'react';
import { ChevronDown, Info, Truck } from 'lucide-react';

interface OrdersSummaryCardsProps {
  pendingCount: number;
  pendingValueTotal: number;
  heldOverWeek: number;
  bookedThisMonth: number;
  highRiskPending: number;
  pendingOverviewOpen: boolean;
  setPendingOverviewOpen: Dispatch<SetStateAction<boolean>>;
}

export function OrdersSummaryCards({
  pendingCount,
  pendingValueTotal,
  heldOverWeek,
  bookedThisMonth,
  highRiskPending,
  pendingOverviewOpen,
  setPendingOverviewOpen,
}: OrdersSummaryCardsProps) {
  return (
    <>
      <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white p-2.5 shadow-sm md:hidden">
        <div className={`flex items-center justify-between ${pendingOverviewOpen ? 'border-b border-slate-100 pb-2' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-[#2f80df]">
              <Truck className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px] font-bold text-slate-900">Courier overview</span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-black text-[#285ac7]">
              {pendingCount} pending
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPendingOverviewOpen((current) => !current)}
            aria-expanded={pendingOverviewOpen}
            aria-label={pendingOverviewOpen ? 'Hide courier overview details' : 'Show courier overview details'}
            className={`flex h-7 items-center justify-center gap-1 rounded-lg border px-2 transition ${
              pendingOverviewOpen
                ? 'border-blue-200 bg-blue-50 text-[#2f80df]'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            <Info className="h-3.5 w-3.5" />
            <ChevronDown className={`h-3 w-3 transition-transform ${pendingOverviewOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {pendingOverviewOpen && (
          <div className="grid grid-cols-2 pt-1">
            {[
              ['Pending orders', pendingCount, `BDT ${pendingValueTotal.toLocaleString()} waiting`, 'text-slate-900'],
              ['Held over 7 days', heldOverWeek, heldOverWeek > 0 ? 'Needs review' : 'No ageing orders', 'text-orange-600'],
              ['Booked this month', bookedThisMonth, 'Connected couriers', 'text-slate-900'],
              ['High fraud risk', highRiskPending, highRiskPending > 0 ? 'Review before booking' : 'All orders look safe', highRiskPending > 0 ? 'text-rose-600' : 'text-emerald-600'],
            ].map(([label, value, helper, tone], index) => (
              <div
                key={String(label)}
                className={`min-w-0 px-2.5 py-2 ${index % 2 === 1 ? 'border-l border-slate-100' : ''} ${index > 1 ? 'border-t border-slate-100' : ''}`}
              >
                <p className="whitespace-nowrap text-[7.5px] font-bold uppercase tracking-[0.09em] text-slate-500">{label}</p>
                <p className={`mt-0.5 text-[16px] font-black leading-none tracking-tight ${tone}`}>{value}</p>
                <p className="mt-1 text-[8px] font-medium leading-[11px] text-slate-500">{helper}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:grid md:grid-cols-2 lg:grid-cols-4">
        {[
          ['Pending orders', pendingCount, `BDT ${pendingValueTotal.toLocaleString()} waiting to ship`, 'text-slate-900'],
          ['Held over 7 days', heldOverWeek, heldOverWeek > 0 ? 'Needs review' : 'No ageing orders', 'text-amber-700'],
          ['Booked this month', bookedThisMonth, 'Across connected couriers', 'text-slate-900'],
          ['High fraud risk', highRiskPending, highRiskPending > 0 ? 'Review before booking' : 'All pending orders look safe', highRiskPending > 0 ? 'text-rose-700' : 'text-emerald-700'],
        ].map(([label, value, helper, tone]) => (
          <div key={String(label)} className="border-b border-slate-100 px-5 py-4 last:border-b-0 sm:border-r lg:border-b-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className={`mt-1 text-lg font-black ${tone}`}>{value}</p>
            <p className="mt-1 text-xs text-slate-400">{helper}</p>
          </div>
        ))}
      </section>
    </>
  );
}

export default OrdersSummaryCards;
