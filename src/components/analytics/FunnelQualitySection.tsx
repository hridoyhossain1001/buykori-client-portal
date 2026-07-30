import { ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';
import type { AnalyticsOverview, SignalDoctor } from '../../types';
import { asArray, numberText, stepLabel } from './analyticsFormat';

type FunnelQualitySectionProps = {
  activeInsightTab: string;
  analyticsDays: number;
  analyticsOverview: AnalyticsOverview | null | undefined;
  signalDoctor: SignalDoctor | null | undefined;
  signalRates: SignalDoctor['signal_rates'] | null;
};

export function FunnelQualitySection({
  activeInsightTab,
  analyticsDays,
  analyticsOverview,
  signalDoctor,
  signalRates,
}: FunnelQualitySectionProps) {
  return (
    <div
      id="analytics-funnel"
      aria-hidden={activeInsightTab !== 'summary'}
      className={`${activeInsightTab === 'summary' ? 'hidden md:grid' : 'hidden'} scroll-mt-24 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6`}
    >
      <div className="space-y-6 lg:contents">
        {/* Conversion Funnel */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-sm font-bold text-slate-900">Customer journey</h3>
            <p className="mt-0.5 text-xs text-slate-500">How people move from store visit to order · last {analyticsDays} days.</p>
          </div>

          <div className="space-y-0 px-5 py-5">
            {asArray(analyticsOverview?.funnel).length ? (
              (() => {
                const funnel = asArray(analyticsOverview?.funnel);
                const maxCount = Math.max(...funnel.map((f) => Number(f.count || 0)), 1);
                return funnel.map((step, i: number) => {
                  const currentCount = Number(step.count || 0);
                  const previousCount = i > 0 ? Number(funnel[i - 1]?.count || 0) : currentCount;
                  const hasTrackingGap = i > 0 && currentCount > previousCount;
                  const conversionRate = i === 0
                    ? 100
                    : previousCount > 0
                      ? (currentCount / previousCount) * 100
                      : 0;
                  const displayRate = Number(conversionRate.toFixed(1));
                  const pctWidth = Math.max((currentCount / maxCount) * 100, 5);
                  return (
                    <div key={step.step} className="grid grid-cols-[140px_1fr_100px] items-center gap-4 border-b border-dashed border-slate-200 py-4 last:border-0">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{stepLabel(step.step)}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{numberText(step.count)} actions</p>
                      </div>
                      <div className="h-6 overflow-hidden rounded-md bg-slate-100">
                        <div className="h-full rounded-md bg-gradient-to-r from-indigo-600 to-indigo-500" style={{ width: `${pctWidth}%` }} />
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold ${hasTrackingGap || (i > 0 && displayRate < 25) ? 'text-amber-700' : 'text-slate-900'}`}>
                          {hasTrackingGap ? '—' : `${displayRate}%`}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {i === 0 ? 'of visitors' : hasTrackingGap ? 'tracking gap detected' : 'from previous step'}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">Customer step data will appear after visitors browse, checkout, and order.</div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:order-3 lg:col-span-3">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Data quality</h3>
              <p className="mt-0.5 text-xs text-slate-500">How much useful customer data reaches each platform.</p>
            </div>
            {signalDoctor?.score !== undefined && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{signalDoctor.score} / 100 · {signalDoctor.grade}</span>
            )}
          </div>

          <div className="grid gap-x-10 gap-y-4 px-5 py-6 md:grid-cols-2">
            {signalRates ? (
              [
                ['Event ID', signalRates.event_id || 0],
                ['User match', signalRates.user_match || 0],
                ['Email / Phone', signalRates.email_or_phone || 0],
                ['Click IDs', signalRates.click_id || 0],
                ['Product ID', signalRates.content_ids || 0],
                ['Order value', signalRates.value || 0],
                ['UTM source', signalRates.utm || 0],
              ].map(([name, rate]) => (
                <div key={String(name)} className="grid grid-cols-[110px_1fr_42px] items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600">{name}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${Number(rate)}%` }} /></div>
                  <span className="text-right text-[11px] font-bold text-slate-900">{rate}%</span>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">Not enough data yet. Keep tracking.</div>
            )}
          </div>
          <footer className="border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-500">Lower-scoring signals can improve by using consistent campaign links and complete checkout details.</footer>
        </div>
      </div>

      <div className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-1">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Tracking health</h3>
            <p className="mt-0.5 text-xs text-slate-500">Checks that keep your ad data reliable.</p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">{asArray(signalDoctor?.issues).some(issue => issue.severity === 'critical' || issue.severity === 'high') ? 'Needs attention' : 'All good'}</span>
        </div>

        <div className="divide-y divide-dashed divide-slate-200 px-5 py-5">
          {asArray(signalDoctor?.issues).length ? (
            asArray(signalDoctor?.issues).map((issue, idx: number) => (
              <div key={idx} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2.5">
                  {issue.severity === 'critical' || issue.severity === 'high' ? <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" /> :
                   issue.severity === 'medium' ? <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" /> :
                   <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />}
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold leading-tight text-slate-900">{issue.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{issue.fix || issue.impact}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-8 text-center text-xs font-semibold text-emerald-700">
              Everything looks good.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default FunnelQualitySection;
