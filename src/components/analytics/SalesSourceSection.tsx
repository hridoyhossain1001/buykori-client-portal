import React from 'react';
import { AlertTriangle, CheckCircle, Download } from 'lucide-react';
import type { AnalyticsCampaigns } from '../../types';
import { formatMoney, numberText } from './analyticsFormat';

type SalesSourceRow = NonNullable<AnalyticsCampaigns['campaigns']>[number];
type SalesCreditRow = { label: string; value: number; percent: number };

type SalesSourceSectionProps = {
  activeInsightTab: string;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  salesSourceRows: SalesSourceRow[];
  visibleSalesSources: SalesSourceRow[];
  inactiveSalesSources: SalesSourceRow[];
  primarySalesSource: SalesSourceRow | null;
  isUntaggedSource: (row: SalesSourceRow) => boolean;
  showInactiveSalesSources: boolean;
  setShowInactiveSalesSources: React.Dispatch<React.SetStateAction<boolean>>;
  salesCreditRows: SalesCreditRow[];
  salesCurrency: string;
  totalSourceSales: number;
  totalSourceOrders: number;
  totalProductsSeen: number;
  totalAddedToCart: number;
  totalCheckouts: number;
  totalStoreVisits: number;
  sourceAverageOrder: number;
  sourcesWithSales: number;
  sourceHasCartGap: boolean;
  untaggedSourceSales: number;
  attributedSourceSales: number;
  untaggedSalesPercent: number;
  attributedSalesPercent: number;
  visitOrderRate: number;
  exportSalesSources: () => void;
  setActivePage?: (page: string) => void;
};

export function SalesSourceSection({
  activeInsightTab,
  analyticsDays,
  setAnalyticsDays,
  salesSourceRows,
  visibleSalesSources,
  inactiveSalesSources,
  primarySalesSource,
  isUntaggedSource,
  showInactiveSalesSources,
  setShowInactiveSalesSources,
  salesCreditRows,
  salesCurrency,
  totalSourceSales,
  totalSourceOrders,
  totalProductsSeen,
  totalAddedToCart,
  totalCheckouts,
  totalStoreVisits,
  sourceAverageOrder,
  sourcesWithSales,
  sourceHasCartGap,
  untaggedSourceSales,
  attributedSourceSales,
  untaggedSalesPercent,
  attributedSalesPercent,
  visitOrderRate,
  exportSalesSources,
  setActivePage,
}: SalesSourceSectionProps) {
  return (
      <div id="analytics-campaigns" role="tabpanel" aria-labelledby="ad-insights-tab-sales" className={`${activeInsightTab === 'sales' ? 'flex' : 'hidden'} scroll-mt-24 flex-col space-y-3 md:space-y-4`}>
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Sales source</h2>
            <p className="mt-1 text-xs text-slate-500">Which ad place and link bring visitors, orders and sales · last {analyticsDays} days</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-[11px] font-bold text-slate-500">
              {[7, 30, 90].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setAnalyticsDays(days)}
                  className={`rounded-lg px-3 py-2 ${analyticsDays === days ? 'bg-white text-[#193b68] shadow-sm' : ''}`}
                >
                  {days} days
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportSalesSources}
              disabled={!salesSourceRows.length}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#285ac7] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#214fae] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 rounded-xl bg-stone-100 p-1 text-center text-[11px] font-bold text-stone-500 md:hidden">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              type="button"
              onClick={() => setAnalyticsDays(days)}
              className={`rounded-lg px-2 py-2 ${analyticsDays === days ? 'bg-white text-slate-800 shadow-sm' : ''}`}
            >
              {days} days
            </button>
          ))}
        </div>

        <section className={`rounded-[16px] border px-3.5 py-3 md:flex md:items-center md:gap-4 md:px-4 ${
          untaggedSalesPercent > 0 ? 'border-blue-200 bg-blue-50/80' : 'border-emerald-200 bg-emerald-50'
        }`}>
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ${untaggedSalesPercent > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {untaggedSalesPercent > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <h3 className={`text-[12px] font-bold md:text-sm ${untaggedSalesPercent > 0 ? 'text-[#173b68]' : 'text-emerald-800'}`}>
                {untaggedSalesPercent > 0
                  ? `${untaggedSalesPercent}% of sales land in “Direct — no campaign”`
                  : 'All tracked sales are attributed to a campaign'}
              </h3>
              <p className={`mt-1 text-[10px] leading-4 md:text-xs ${untaggedSalesPercent > 0 ? 'text-blue-700/80' : 'text-emerald-700'}`}>
                {untaggedSalesPercent > 0
                  ? `Untagged links account for ${formatMoney(untaggedSourceSales, salesCurrency)}, so those sales cannot be credited to Meta, TikTok or a campaign.`
                  : 'Campaign tags are reaching Buykori correctly.'}
              </p>
            </div>
          </div>
          {untaggedSalesPercent > 0 && (
            <div className="mt-3 md:mt-0 md:w-[40%]">
              <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
                <div className="h-full rounded-full bg-[#285ac7]" style={{ width: `${untaggedSalesPercent}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] font-bold text-[#285382] md:text-[10px]">
                <span>Untagged {untaggedSalesPercent}%</span>
                <span>Tagged {attributedSalesPercent}%</span>
              </div>
              <button onClick={() => setActivePage?.('campaign-builder')} className="mt-2 w-full rounded-lg bg-[#285ac7] px-3 py-2 text-[10px] font-bold text-white hover:bg-[#214fae] md:ml-auto md:block md:w-fit">
                Tag links with URL Builder
              </button>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {[
            { title: 'Total sales', value: formatMoney(totalSourceSales, salesCurrency), note: `${numberText(totalSourceOrders)} orders · avg ${formatMoney(sourceAverageOrder, salesCurrency)}` },
            { title: 'Attributed', value: formatMoney(attributedSourceSales, salesCurrency), note: attributedSourceSales > 0 ? `${attributedSalesPercent}% tagged` : 'Needs tagged links' },
            { title: 'Visit → order', value: `${visitOrderRate}%`, note: `${numberText(totalSourceOrders)} of ${numberText(totalStoreVisits)} visits` },
            { title: 'Sources with sales', value: numberText(sourcesWithSales), note: `${sourcesWithSales} of ${salesSourceRows.length} seen` },
          ].map(metric => (
            <section key={metric.title} className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,.03)] md:px-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-500 md:text-[10px]">{metric.title}</p>
              <p className="mt-1 text-lg font-black leading-none tracking-tight text-slate-900 md:text-2xl">{metric.value}</p>
              <p className="mt-2 truncate text-[9px] text-slate-400 md:text-[10px]">{metric.note}</p>
            </section>
          ))}
        </div>

        {!salesSourceRows.length ? (
          <div className="rounded-[16px] border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-xs text-slate-400">
            No sales source data yet. Build a tagged campaign link to start attribution.
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-12 gap-4 md:grid">
              <section className="col-span-8 overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,.03)]">
                <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Sources by sales</h3>
                    <p className="text-[10px] text-slate-500">Sorted by revenue · funnel shows Visit → Seen → Cart → Checkout → Order</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-[#285ac7]">
                    {salesSourceRows.filter(isUntaggedSource).length} untagged
                  </span>
                </header>
                <div className="grid grid-cols-[1.25fr_.85fr_1.15fr_.55fr_.8fr] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-400">
                  <span>Ad place</span><span>Campaign</span><span>Funnel</span><span className="text-right">Orders</span><span className="text-right">Sales</span>
                </div>
                {visibleSalesSources.map((row, index) => {
                  const rowSalesShare = totalSourceSales > 0 ? Number(row.revenue || 0) / totalSourceSales * 100 : 0;
                  const rowOrderRate = totalStoreVisits > 0 ? Number(row.purchase || 0) / totalStoreVisits * 100 : 0;
                  const funnelValues = [
                    index === 0 ? totalStoreVisits : Number(row.view_content || 0),
                    Number(row.view_content || 0),
                    Number(row.add_to_cart || 0),
                    Number(row.initiate_checkout || 0),
                    Number(row.purchase || 0),
                  ];
                  const funnelMax = Math.max(...funnelValues, 1);
                  return (
                    <div key={`${row.source}-${row.campaign}-${index}`} className="grid grid-cols-[1.25fr_.85fr_1.15fr_.55fr_.8fr] items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-[#285ac7]">{String(row.source || 'D').charAt(0).toUpperCase()}</span>
                        <span className="min-w-0">
                          <strong className="block truncate text-xs text-slate-800">{row.source || 'Direct'}</strong>
                          <small className="block truncate text-[9px] text-slate-400">{isUntaggedSource(row) ? 'No referrer or UTM found' : 'Tracked source'}</small>
                        </span>
                      </div>
                      <span className="truncate text-[10px] text-slate-500">{row.campaign || 'Not set'}</span>
                      <div>
                        <div className="flex h-7 items-end gap-1">
                          {funnelValues.map((value, funnelIndex) => (
                            <span key={funnelIndex} className="w-3 rounded-t bg-[#4b9aeb]" style={{ height: `${Math.max(4, value / funnelMax * 26)}px`, opacity: 1 - funnelIndex * .12 }} />
                          ))}
                        </div>
                        <small className="text-[8px] text-slate-400">{funnelValues.map(numberText).join(' · ')}</small>
                      </div>
                      <div className="text-right">
                        <strong className="block text-xs text-slate-800">{numberText(row.purchase)}</strong>
                        <small className="text-[8px] text-slate-400">{rowOrderRate.toFixed(1)}% visits</small>
                      </div>
                      <div className="text-right">
                        <strong className="block text-xs text-slate-900">{formatMoney(row.revenue, row.currency || salesCurrency)}</strong>
                        <div className="mt-1 ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#285ac7]" style={{ width: `${rowSalesShare}%` }} />
                        </div>
                        <small className="text-[8px] text-slate-400">{rowSalesShare.toFixed(1)}% sales</small>
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-[1.25fr_.85fr_1.15fr_.55fr_.8fr] gap-3 border-t border-slate-200 bg-slate-50/60 px-4 py-3 text-xs font-bold text-slate-800">
                  <span>Total</span><span /><span className="text-[9px] font-medium text-slate-400">{numberText(totalStoreVisits)} · {numberText(totalProductsSeen)} · {numberText(totalAddedToCart)} · {numberText(totalCheckouts)} · {numberText(totalSourceOrders)}</span><span className="text-right">{numberText(totalSourceOrders)}</span><span className="text-right">{formatMoney(totalSourceSales, salesCurrency)}</span>
                </div>
                {inactiveSalesSources.length > 0 && (
                  <button type="button" onClick={() => setShowInactiveSalesSources(value => !value)} className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-left text-[10px] font-bold text-slate-500">
                    <span>{inactiveSalesSources.map(row => row.source).join(', ')} · no activity in this period</span>
                    <span className="text-[#285ac7]">{showInactiveSalesSources ? 'Hide' : 'Show anyway'}</span>
                  </button>
                )}
              </section>

              <div className="col-span-4 space-y-4">
                <section className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-[0_4px_18px_rgba(15,23,42,.03)]">
                  <h3 className="text-sm font-bold text-slate-900">Where sales are credited</h3>
                  <p className="text-[10px] text-slate-500">Share of {formatMoney(totalSourceSales, salesCurrency)}</p>
                  <div className="mt-3 flex items-center gap-4">
                    <svg className="h-20 w-20 shrink-0 -rotate-90" viewBox="0 0 42 42" aria-label={`${untaggedSalesPercent}% direct or untagged sales`}>
                      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e9eef5" strokeWidth="6" />
                      <circle cx="21" cy="21" r="15.9" fill="none" stroke="#285ac7" strokeWidth="6" strokeDasharray={`${untaggedSalesPercent} ${100 - untaggedSalesPercent}`} strokeDashoffset="0" />
                    </svg>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {salesCreditRows.slice(0, 4).map((credit, index) => (
                        <div key={credit.label} className="flex items-center gap-2 text-[10px]">
                          <span className={`h-2 w-2 rounded-sm ${index === 0 ? 'bg-[#285ac7]' : 'bg-blue-200'}`} />
                          <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">{credit.label}</span>
                          <strong className="text-slate-800">{credit.percent}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-slate-500">Tagged links separate paid campaigns from direct traffic, so you can see which ads actually generate sales.</p>
                </section>

                <section className="rounded-[16px] border border-slate-200 bg-white px-4 py-3 shadow-[0_4px_18px_rgba(15,23,42,.03)]">
                  <h3 className="text-sm font-bold text-slate-900">Fix in 2 steps</h3>
                  <p className="text-[10px] text-slate-500">About 10 minutes · unlocks real ROAS</p>
                  {[
                    { number: 1, title: 'Build tagged ad links', description: 'Generate UTM + Click ID links, then replace destination URLs in live ads.', action: 'Open URL Builder', page: 'campaign-builder' },
                    { number: 2, title: 'Connect ad spend', description: 'Adds Return and Cost per order beside each source.', action: 'Connect', page: 'settings' },
                  ].map((step, index) => (
                    <div key={step.number} className={`flex gap-3 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[11px] font-bold text-[#285ac7]">{step.number}</span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">{step.title}</h4>
                        <p className="mt-1 text-[10px] leading-4 text-slate-500">{step.description}</p>
                        <button onClick={() => setActivePage?.(step.page)} className="mt-2 rounded-lg bg-[#285ac7] px-3 py-2 text-[10px] font-bold text-white">{step.action}</button>
                      </div>
                    </div>
                  ))}
                </section>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              <section className="rounded-[16px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[12px] font-bold text-slate-800">Sources by sales</h3>
                    <p className="text-[9px] text-slate-400">Sorted by revenue</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-bold text-[#285ac7]">{salesSourceRows.filter(isUntaggedSource).length} untagged</span>
                </div>
                {visibleSalesSources.slice(0, 4).map((row, index) => {
                  const share = totalSourceSales > 0 ? Number(row.revenue || 0) / totalSourceSales * 100 : 0;
                  return (
                    <div key={`${row.source}-${row.campaign}-${index}`} className={`py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black text-[#285ac7]">{String(row.source || 'D').charAt(0).toUpperCase()}</span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[11px] text-slate-800">{row.source || 'Direct'} {isUntaggedSource(row) && <em className="ml-1 rounded bg-blue-50 px-1 py-0.5 not-italic text-[8px] text-[#285ac7]">UNTAGGED</em>}</strong>
                          <small className="block truncate text-[9px] text-slate-400">{row.campaign || 'Campaign not set'}</small>
                        </span>
                        <span className="text-right">
                          <strong className="block text-xs text-slate-900">{formatMoney(row.revenue, row.currency || salesCurrency)}</strong>
                          <small className="text-[8px] text-slate-400">{share.toFixed(1)}% sales</small>
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#285ac7]" style={{ width: `${share}%` }} /></div>
                    </div>
                  );
                })}
              </section>

              <section className="rounded-[16px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
                <h3 className="text-[12px] font-bold text-slate-800">{primarySalesSource?.source || 'Direct'} · funnel</h3>
                <p className="text-[9px] text-slate-400">Visit → Seen → Cart → Checkout → Order</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {[
                    ['Visits', totalStoreVisits],
                    ['Seen', totalProductsSeen],
                    ['Cart', totalAddedToCart],
                    ['Checkout', totalCheckouts],
                    ['Orders', totalSourceOrders],
                    ['Conv.', `${visitOrderRate}%`],
                  ].map(([label, value], index) => (
                    <div key={String(label)} className={`rounded-lg border px-2 py-2 ${sourceHasCartGap && index === 2 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50/70'}`}>
                      <p className="text-[8px] font-bold uppercase text-slate-400">{label}</p>
                      <p className={`mt-1 text-sm font-black ${sourceHasCartGap && index === 2 ? 'text-amber-700' : 'text-slate-800'}`}>{value}</p>
                    </div>
                  ))}
                </div>
                {sourceHasCartGap && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[9px] leading-4 text-amber-800">
                    <strong>Cart ({numberText(totalAddedToCart)}) is lower than Checkout ({numberText(totalCheckouts)}).</strong> AddToCart may be firing late or missing.
                  </div>
                )}
                {inactiveSalesSources.length > 0 && (
                  <button type="button" onClick={() => setShowInactiveSalesSources(value => !value)} className="mt-3 flex w-full items-center justify-between border-t border-slate-100 pt-3 text-left text-[9px] font-bold text-slate-500">
                    <span>{inactiveSalesSources.map(row => row.source).join(', ')} · no activity</span>
                    <span className="text-[#285ac7]">{showInactiveSalesSources ? 'Hide' : 'Show anyway'}</span>
                  </button>
                )}
              </section>

              <section className="rounded-[16px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
                <h3 className="text-[12px] font-bold text-slate-800">Where sales are credited</h3>
                <p className="text-[9px] text-slate-400">Share of {formatMoney(totalSourceSales, salesCurrency)}</p>
                <div className="mt-3 flex items-center gap-4">
                  <svg className="h-20 w-20 shrink-0 -rotate-90" viewBox="0 0 42 42" aria-label={`${untaggedSalesPercent}% direct or untagged sales`}>
                    <circle cx="21" cy="21" r="15.9" fill="none" stroke="#e9eef5" strokeWidth="6" />
                    <circle cx="21" cy="21" r="15.9" fill="none" stroke="#285ac7" strokeWidth="6" strokeDasharray={`${untaggedSalesPercent} ${100 - untaggedSalesPercent}`} />
                  </svg>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {salesCreditRows.slice(0, 4).map((credit, index) => (
                      <div key={credit.label} className="flex items-center gap-2 text-[9px]">
                        <span className={`h-2 w-2 rounded-sm ${index === 0 ? 'bg-[#285ac7]' : 'bg-blue-200'}`} />
                        <span className="min-w-0 flex-1 truncate font-semibold text-slate-600">{credit.label}</span>
                        <strong className="text-slate-800">{credit.percent}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[16px] border border-slate-200 bg-white px-3.5 py-3 shadow-[0_4px_14px_rgba(15,23,42,.03)]">
                <h3 className="text-[12px] font-bold text-slate-800">Fix in 2 steps</h3>
                <p className="text-[9px] text-slate-400">About 10 minutes · unlocks real ROAS</p>
                {[
                  { number: 1, title: 'Build tagged ad links', description: 'Generate UTM + Click ID links, then replace destination URLs in live ads.', action: 'Open URL Builder', page: 'campaign-builder' },
                  { number: 2, title: 'Connect ad spend', description: 'Adds Return and Cost per order beside each source.', action: 'Connect', page: 'settings' },
                ].map((step, index) => (
                  <div key={step.number} className={`flex gap-2.5 py-3 ${index > 0 ? 'border-t border-slate-100' : ''}`}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[10px] font-bold text-[#285ac7]">{step.number}</span>
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-800">{step.title}</h4>
                      <p className="mt-1 text-[9px] leading-4 text-slate-500">{step.description}</p>
                      <button onClick={() => setActivePage?.(step.page)} className="mt-2 rounded-lg bg-[#285ac7] px-3 py-2 text-[9px] font-bold text-white">{step.action}</button>
                    </div>
                  </div>
                ))}
              </section>
            </div>
          </>
        )}
      </div>
  );
}

export default SalesSourceSection;
