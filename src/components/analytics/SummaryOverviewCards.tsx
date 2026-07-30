import type { AnalyticsOverview, SignalDoctor } from '../../types';
import type { AdSummary } from './analyticsTypes';
import { formatMoney, numberText, percentText } from './analyticsFormat';

type SummaryOverviewCardsProps = {
  analyticsOverview: AnalyticsOverview | null | undefined;
  signalDoctor: SignalDoctor | null | undefined;
  analyticsDays: number;
  activeInsightTab: string;
  loadingAdPerformance: boolean;
  adPerformanceError: string | null;
  adSummary: AdSummary;
};

export function SummaryOverviewCards({
  analyticsOverview,
  signalDoctor,
  analyticsDays,
  activeInsightTab,
  loadingAdPerformance,
  adPerformanceError,
  adSummary,
}: SummaryOverviewCardsProps) {
  return (
    <>
      {analyticsOverview && (
        <div id="analytics-overview" role="tabpanel" aria-labelledby="ad-insights-tab-summary" className={`${activeInsightTab === 'summary' ? 'hidden md:grid' : 'hidden'} scroll-mt-24 grid-cols-2 gap-3 lg:grid-cols-4`}>
          {[
            { title: 'Total events', value: numberText(analyticsOverview.total_events), note: 'Tracked in this period' },
            { title: 'Success rate', value: percentText(analyticsOverview.success_rate), note: 'Delivery performance' },
            { title: 'Daily average', value: numberText(analyticsOverview.avg_daily_events), note: 'Events per day' },
            { title: 'Data quality', value: signalDoctor ? `${signalDoctor.score}/100` : '—', note: signalDoctor?.grade || 'Waiting for data' },
          ].map((metric, index) => (
            <section key={metric.title} className="min-h-36 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{metric.title}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">{metric.value}</p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${index === 1 || index === 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{metric.note}</span>
                <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
                  {[7, 11, 9, 15, 13, 18].map((height, barIndex) => <span key={barIndex} className="w-1 rounded-t bg-indigo-500" style={{ height }} />)}
                </span>
              </div>
            </section>
          ))}
        </div>
      )}

      <section aria-hidden={activeInsightTab !== 'summary'} className={`${activeInsightTab === 'summary' ? 'hidden md:block' : 'hidden'} overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm`}>
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">↗</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Business results</h3>
            <p className="mt-0.5 text-xs text-slate-500">Ad spend and confirmed sales for the last {analyticsDays} days.</p>
          </div>
          {loadingAdPerformance && <span className="ml-auto text-xs font-semibold text-slate-400">Updating…</span>}
        </header>
        {adPerformanceError && <div className="border-b border-rose-200 bg-rose-50 px-5 py-3 text-xs text-rose-800">{adPerformanceError}</div>}
        <div className="grid grid-cols-2 divide-slate-200 lg:grid-cols-5 lg:divide-x">
          {[
            { title: 'Ad cost', value: formatMoney(adSummary.spend, adSummary.spendCurrency), note: adSummary.spend ? 'Synced ad spend' : 'No spend synced yet' },
            { title: 'New orders', value: numberText(adSummary.placedPurchases), note: 'COD pending included' },
            { title: 'Confirmed sales', value: formatMoney(adSummary.confirmedRevenue, adSummary.revenueCurrency), note: `${numberText(adSummary.confirmedPurchases)} confirmed` },
            { title: 'Return', value: adSummary.spend ? `${adSummary.returnRate.toFixed(2)}x` : '—', note: 'Needs spend + sales' },
            { title: 'Cost / order', value: adSummary.placedPurchases ? formatMoney(adSummary.costPerOrder, adSummary.spendCurrency) : '—', note: 'Needs spend + orders' },
          ].map(metric => (
            <div key={metric.title} className="border-b border-slate-200 px-5 py-4 last:border-b-0 lg:border-b-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{metric.title}</p>
              <p className="mt-1 text-sm font-black text-slate-900">{metric.value}</p>
              <p className="mt-1 text-[11px] text-slate-500">{metric.note}</p>
            </div>
          ))}
        </div>
        <footer className="border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">No ad spend recorded? Connect your ad account spend sync in Settings to see Return and Cost/order.</footer>
      </section>
    </>
  );
}

export default SummaryOverviewCards;
