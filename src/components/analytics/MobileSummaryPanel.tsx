import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AnalyticsOverview, SignalDoctor } from '../../types';
import type { AdSummary } from './analyticsTypes';
import { formatMoney, numberText, percentText, stepLabel } from './analyticsFormat';

type MobileSignal = { name: string; rate: number };
type MobileFix = { id: string; title: string; description: string; action: string; page: string };
type FunnelStep = { step: string; count: number };

type MobileSummaryPanelProps = {
  activeInsightTab: string;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  analyticsOverview: AnalyticsOverview | null | undefined;
  signalDoctor: SignalDoctor | null | undefined;
  adSummary: AdSummary;
  qualityScore: number;
  mobileSignalEntries: MobileSignal[];
  healthyMobileSignals: MobileSignal[];
  attentionMobileSignals: MobileSignal[];
  visibleMobileSignals: MobileSignal[];
  showAllMobileSignals: boolean;
  setShowAllMobileSignals: React.Dispatch<React.SetStateAction<boolean>>;
  mobileFixes: MobileFix[];
  setDismissedMobileFixes: React.Dispatch<React.SetStateAction<string[]>>;
  mobileFunnel: FunnelStep[];
  mobileFunnelMax: number;
  mobileTrackingGaps: number;
  setActivePage?: (page: string) => void;
};

export function MobileSummaryPanel({
  activeInsightTab,
  analyticsDays,
  setAnalyticsDays,
  analyticsOverview,
  signalDoctor,
  adSummary,
  qualityScore,
  mobileSignalEntries,
  healthyMobileSignals,
  attentionMobileSignals,
  visibleMobileSignals,
  showAllMobileSignals,
  setShowAllMobileSignals,
  mobileFixes,
  setDismissedMobileFixes,
  mobileFunnel,
  mobileFunnelMax,
  mobileTrackingGaps,
  setActivePage,
}: MobileSummaryPanelProps) {
  return (
      <div
        aria-hidden={activeInsightTab !== 'summary'}
        className={`${activeInsightTab === 'summary' ? 'space-y-3' : 'hidden'} md:hidden`}
      >
        <div className="grid grid-cols-3 rounded-xl bg-stone-100 p-1 text-center text-[11px] font-bold text-stone-500">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setAnalyticsDays(days)}
              className={`rounded-lg px-2 py-2 transition ${analyticsDays === days ? 'bg-white text-slate-800 shadow-sm' : ''}`}
            >
              {days} days
            </button>
          ))}
        </div>

        <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#17314f] via-[#1b416e] to-[#15385f] px-4 py-4 text-white shadow-[0_10px_24px_rgba(15,49,86,.16)]">
          <span className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/[0.06]" />
          <div className="relative flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#7dd3a7 ${qualityScore * 3.6}deg, rgba(255,255,255,.18) 0deg)` }}
            >
              <span className="h-10 w-10 rounded-full bg-[#183b64]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-300">Data quality score</p>
              <div className="mt-0.5 flex flex-wrap items-baseline gap-1.5">
                <strong className="text-[25px] font-black leading-none">{qualityScore}<span className="text-xs text-slate-300">/100</span></strong>
                <span className="text-[12px] font-bold text-emerald-200">· {signalDoctor?.grade || 'Waiting'}</span>
              </div>
              <p className="mt-2 text-[10px] text-slate-300">
                {healthyMobileSignals.length} of {mobileSignalEntries.length || 7} signals healthy
                {attentionMobileSignals.length > 0 ? ` · ${attentionMobileSignals.length} need attention` : ''}
              </p>
            </div>
          </div>
        </section>

        {analyticsOverview && (
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                title: 'Total events',
                value: numberText(analyticsOverview.total_events),
                note: `Last ${analyticsDays} days`,
              },
              {
                title: 'Delivery',
                value: percentText(analyticsOverview.success_rate),
                note: `${Math.round(Number(analyticsOverview.total_events || 0) * Number(analyticsOverview.success_rate || 0) / 100).toLocaleString()} of ${numberText(analyticsOverview.total_events)} delivered`,
              },
              {
                title: 'Daily average',
                value: numberText(analyticsOverview.avg_daily_events),
                note: `Across ${analyticsDays} days`,
              },
              {
                title: 'New orders',
                value: numberText(adSummary.placedPurchases),
                note: `${numberText(adSummary.confirmedPurchases)} confirmed`,
              },
            ].map(metric => (
              <section key={metric.title} className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,.03)]">
                <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">{metric.title}</p>
                <p className="mt-1 text-xl font-black leading-none tracking-tight text-slate-900">{metric.value}</p>
                <p className="mt-2 truncate text-[9px] text-slate-400">{metric.note}</p>
              </section>
            ))}
          </div>
        )}

        {mobileFixes.length > 0 && (
          <section className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-slate-800">Fix first</h3>
                <p className="text-[10px] text-slate-400">Biggest blockers to reliable ROAS</p>
              </div>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">{mobileFixes.length}</span>
            </div>
            <div className="mt-1">
              {mobileFixes.map((fix, index) => (
                <div key={fix.id} className={`flex items-start gap-2.5 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                  <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${index === 0 ? 'bg-orange-50 text-orange-500' : 'bg-blue-50 text-blue-500'}`}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[12px] font-bold text-slate-800">{fix.title}</h4>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">{fix.description}</p>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActivePage?.(fix.page)}
                        className="rounded-lg bg-[#2f80df] px-3 py-2 text-[10px] font-bold text-white"
                      >
                        {fix.action}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDismissedMobileFixes(current => [...current, fix.id])}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600"
                      >
                        Later
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-slate-800">Customer journey</h3>
              <p className="text-[10px] text-slate-500">Store visit → order · last {analyticsDays} days</p>
            </div>
            {mobileTrackingGaps > 0 && (
              <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[9px] font-bold text-orange-700">{mobileTrackingGaps} gap{mobileTrackingGaps > 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="mt-2">
            {mobileFunnel.length > 0 ? mobileFunnel.map((step, index) => {
              const currentCount = Number(step.count || 0);
              const previousCount = index > 0 ? Number(mobileFunnel[index - 1]?.count || 0) : currentCount;
              const hasGap = index > 0 && currentCount > previousCount;
              const storeVisitCount = Number(mobileFunnel[0]?.count || 0);
              const rate = index === 0
                ? 100
                : hasGap
                  ? (storeVisitCount > 0 ? Number(((currentCount / storeVisitCount) * 100).toFixed(1)) : 0)
                  : previousCount > 0
                    ? Number(((currentCount / previousCount) * 100).toFixed(1))
                    : 0;
              return (
                <div key={step.step} className="py-2">
                  <div className="flex items-center gap-2">
                    <strong className="text-[11px] text-slate-800">{stepLabel(step.step)}</strong>
                    <span className="text-[9px] text-slate-400">{numberText(currentCount)} {index === 0 ? 'sessions' : 'events'}</span>
                    <span className={`ml-auto text-[11px] font-bold ${hasGap || (index > 0 && rate < 25) ? 'text-orange-600' : 'text-slate-800'}`}>
                      {rate}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${hasGap || (index > 0 && rate < 25) ? 'bg-orange-300' : 'bg-[#4b9aeb]'}`}
                      style={{ width: `${Math.max((currentCount / mobileFunnelMax) * 100, currentCount > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                  {hasGap && <p className="mt-1 text-[9px] text-slate-400">Fewer than the next step — see note</p>}
                </div>
              );
            }) : (
              <p className="py-6 text-center text-[10px] text-slate-400">Journey data will appear after tracking starts.</p>
            )}
          </div>
          {mobileTrackingGaps > 0 && (() => {
            const gapIndex = mobileFunnel.findIndex((step, index) => index > 0 && Number(step.count || 0) > Number(mobileFunnel[index - 1]?.count || 0));
            const before = mobileFunnel[gapIndex - 1];
            const after = mobileFunnel[gapIndex];
            return before && after ? (
              <div className="mt-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-[10px] leading-4 text-orange-800">
                <strong>{stepLabel(before.step)} ({numberText(before.count)}) is lower than {stepLabel(after.step)} ({numberText(after.count)}).</strong>
                {' '}The earlier event may be firing late or missing.
              </div>
            ) : null;
          })()}
        </section>

        <section className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold text-slate-800">Data quality by signal</h3>
              <p className="text-[10px] text-slate-500">Worst first</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-600">{qualityScore} / 100</span>
          </div>
          {visibleMobileSignals.length > 0 ? (
            <div className="mt-2 space-y-2">
              {visibleMobileSignals.map(signal => (
                <div key={signal.name} className="grid grid-cols-[92px_1fr_40px] items-center gap-2">
                  <span className="truncate text-[10px] font-bold text-slate-700">
                    {signal.name}
                    {signal.rate < 80 && <em className="ml-1 rounded bg-rose-50 px-1 py-0.5 not-italic text-[8px] text-rose-500">FIX</em>}
                  </span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className={`h-full rounded-full ${signal.rate < 30 ? 'bg-rose-500' : signal.rate < 80 ? 'bg-orange-400' : 'bg-emerald-500'}`}
                      style={{ width: `${signal.rate}%` }}
                    />
                  </div>
                  <span className={`text-right text-[9px] font-bold ${signal.rate < 80 ? 'text-rose-500' : 'text-slate-800'}`}>{signal.rate}%</span>
                </div>
              ))}
              {mobileSignalEntries.length > 4 && (
                <button type="button" onClick={() => setShowAllMobileSignals(value => !value)} className="pt-2 text-[10px] font-bold text-[#2375d8]">
                  {showAllMobileSignals ? '▴ Show fewer signals' : `▾ Show ${mobileSignalEntries.length - 4} healthy signals`}
                </button>
              )}
            </div>
          ) : (
            <p className="py-6 text-center text-[10px] text-slate-400">Signal data will appear after tracking starts.</p>
          )}
        </section>

        <section className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
          <h3 className="text-[13px] font-bold text-slate-800">Business results</h3>
          <p className="text-[10px] text-slate-500">Available without ad spend</p>
          <div className="mt-3 grid grid-cols-2 divide-x divide-slate-200">
            <div className="pr-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">Confirmed sales</p>
              <p className="mt-1 text-base font-black text-slate-900">{formatMoney(adSummary.confirmedRevenue, adSummary.revenueCurrency)}</p>
              <p className="mt-1 text-[9px] text-slate-400">{numberText(adSummary.confirmedPurchases)} of {numberText(adSummary.placedPurchases)} orders</p>
            </div>
            <div className="pl-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">Return · Cost/order</p>
              <p className="mt-1 text-base font-black text-slate-400">
                {adSummary.spend > 0 ? `${adSummary.returnRate.toFixed(2)}x` : '—'}
              </p>
              <p className="mt-1 text-[9px] text-slate-400">{adSummary.spend > 0 ? formatMoney(adSummary.costPerOrder, adSummary.spendCurrency) : 'Needs ad spend'}</p>
            </div>
          </div>
        </section>
      </div>
  );
}

export default MobileSummaryPanel;
