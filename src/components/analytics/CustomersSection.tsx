import React from 'react';
import { AlertTriangle, CheckCircle, Download } from 'lucide-react';
import type { AnalyticsAudience } from '../../types';
import { formatMoney, numberText } from './analyticsFormat';

type AreaRow = { label: string; count: number; percentage: number };
type DistrictFunnelRow = NonNullable<AnalyticsAudience['district_funnel']>[number];

type CustomersSectionProps = {
  activeInsightTab: string;
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  analyticsAudience: AnalyticsAudience | null | undefined;
  exportCustomerInsights: () => void;
  topDistricts: AreaRow[];
  deviceMix: AreaRow[];
  browserMix: AreaRow[];
  customerAreas: AreaRow[];
  customerAreaRows: AreaRow[];
  topRealCity: AreaRow | null;
  mobileDevice?: AreaRow;
  mobileShare: number;
  desktopShare: number;
  uniqueCustomerVisitors: number;
  knownLocationVisitors: number;
  knownLocationPercent: number;
  unknownLocationVisitors: number;
  totalAudienceOrders: number;
  topOrderArea?: DistrictFunnelRow;
  topOrderShare: number;
  totalSourceSales: number;
  showAllCustomerAreas: boolean;
  setShowAllCustomerAreas: React.Dispatch<React.SetStateAction<boolean>>;
  districtFunnel: DistrictFunnelRow[];
  eventDistrictFunnel: DistrictFunnelRow[];
  primaryAreaFunnel: DistrictFunnelRow | null;
  unknownAreaFunnel: DistrictFunnelRow | null;
  districtFunnelMode: 'events' | 'visitors';
  setDistrictFunnelMode: React.Dispatch<React.SetStateAction<'events' | 'visitors'>>;
  isUnknownArea: (label: string) => boolean;
};

export function CustomersSection({
  activeInsightTab,
  analyticsDays,
  setAnalyticsDays,
  analyticsAudience,
  exportCustomerInsights,
  topDistricts,
  deviceMix,
  browserMix,
  customerAreas,
  customerAreaRows,
  topRealCity,
  mobileDevice,
  mobileShare,
  desktopShare,
  uniqueCustomerVisitors,
  knownLocationVisitors,
  knownLocationPercent,
  unknownLocationVisitors,
  totalAudienceOrders,
  topOrderArea,
  topOrderShare,
  totalSourceSales,
  showAllCustomerAreas,
  setShowAllCustomerAreas,
  districtFunnel,
  eventDistrictFunnel,
  primaryAreaFunnel,
  unknownAreaFunnel,
  districtFunnelMode,
  setDistrictFunnelMode,
  isUnknownArea,
}: CustomersSectionProps) {
  return (
      <div
        id="analytics-audience"
        role="tabpanel"
        aria-labelledby="ad-insights-tab-customers"
        className={`${activeInsightTab === 'customers' ? 'space-y-3 md:space-y-4' : 'hidden'} scroll-mt-24`}
      >
        <div className="hidden items-end justify-between gap-4 md:flex">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">Customers</h2>
            <p className="mt-1 text-xs text-slate-500">
              Who visits and who buys · {numberText(uniqueCustomerVisitors)} tracked visitors · last {analyticsDays} days
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-[11px] font-bold text-slate-500">
              {[7, 30, 90].map(days => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setAnalyticsDays(days)}
                  className={`rounded-lg px-4 py-2 transition ${analyticsDays === days ? 'bg-white text-[#193b68] shadow-sm' : ''}`}
                >
                  {days} days
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={exportCustomerInsights}
              disabled={!analyticsAudience}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#285ac7] px-4 text-xs font-bold text-white shadow-sm transition hover:bg-[#214fae] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 rounded-xl bg-stone-100 p-1 text-center text-[11px] font-bold text-stone-500 md:hidden">
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

        {uniqueCustomerVisitors > 0 && <section className="rounded-[16px] border border-orange-200 bg-orange-50 px-3 py-3 text-orange-900 md:flex md:items-center md:gap-3 md:px-4">
          <div className="flex items-start gap-2.5 md:min-w-0 md:flex-1">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-orange-500">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[12px] font-bold leading-5">
                {desktopShare > 0
                  ? `${Number(desktopShare.toFixed(1))}% of visitors use desktop${topOrderArea?.district ? ` — ${Number(topOrderShare.toFixed(1))}% of orders came from ${topOrderArea.district}` : ''}`
                  : `${numberText(unknownLocationVisitors)} visitors need a location-quality review`}
              </h3>
              <p className="mt-0.5 text-[10px] leading-4 text-orange-700">
                {numberText(unknownLocationVisitors)} of {numberText(uniqueCustomerVisitors)} visitors have no reliable city. Treat location and device mix as directional.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAllCustomerAreas(true)}
            className="mt-2 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-[10px] font-bold text-orange-800 md:mt-0 md:w-auto md:shrink-0"
          >
            Review traffic quality
          </button>
        </section>}

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          {[
            {
              title: 'Unique visitors',
              value: numberText(uniqueCustomerVisitors),
              badge: uniqueCustomerVisitors ? `${analyticsDays} days` : 'Waiting',
              note: 'Deduplicated tracked visitors',
            },
            {
              title: 'Top real city',
              value: topRealCity?.label || 'No data yet',
              badge: topRealCity ? numberText(topRealCity.count) : '',
              note: topRealCity ? `${Number(topRealCity.percentage || 0)}% of tracked visitors` : 'Waiting for location data',
            },
            {
              title: 'Mobile share',
              value: `${Number(mobileShare.toFixed(1))}%`,
              badge: `${numberText(mobileDevice?.count || 0)} visitors`,
              note: `Desktop ${Number(desktopShare.toFixed(1))}%`,
            },
            {
              title: 'Location known',
              value: `${knownLocationPercent}%`,
              badge: `${numberText(unknownLocationVisitors)} unknown`,
              note: `${numberText(knownLocationVisitors)} of ${numberText(uniqueCustomerVisitors)} have a city`,
            },
          ].map(metric => (
            <section key={metric.title} className="rounded-[14px] border border-slate-200 bg-white px-3 py-3 shadow-[0_3px_12px_rgba(15,23,42,.03)] md:min-h-24 md:px-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 md:text-[10px]">{metric.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <p className="text-xl font-black leading-none tracking-tight text-slate-900 md:text-2xl">{metric.value}</p>
                {metric.badge && <span className="rounded-full bg-blue-50 px-1.5 py-1 text-[8px] font-bold text-[#285ac7] md:text-[9px]">{metric.badge}</span>}
              </div>
              <p className="mt-2 text-[9px] text-slate-400 md:text-[10px]">{metric.note}</p>
            </section>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <section className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm">
            <header className="flex items-start justify-between gap-3 px-4 pt-4">
              <div>
                <h3 className="text-[13px] font-bold text-slate-900">Where customers are</h3>
                <p className="text-[10px] text-slate-500">Located visitors · green tag = ordered</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">Top {Math.min(customerAreas.length, 6)}</span>
            </header>
            <div className="space-y-3 px-4 py-3">
              {customerAreaRows.length ? customerAreaRows.map(row => {
                const funnelRow = eventDistrictFunnel.find(item => item.district.toLowerCase() === row.label.toLowerCase());
                const orderCount = Number(funnelRow?.purchase || 0);
                const unknown = isUnknownArea(row.label);
                return (
                  <div key={row.label}>
                    <div className="flex items-center gap-2 text-[11px]">
                      <strong className={unknown ? 'text-orange-700' : 'text-slate-800'}>{row.label}</strong>
                      {orderCount > 0 && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600">{numberText(orderCount)} ORDERS</span>}
                      <span className="ml-auto font-bold text-slate-700">{numberText(row.count)}</span>
                      <span className="w-10 text-right text-slate-400">{Number(row.percentage || 0)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full ${unknown ? 'bg-orange-400' : 'bg-[#2f80df]'}`}
                        style={{ width: `${Math.max(Number(row.percentage || 0), Number(row.count || 0) > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              }) : <p className="py-8 text-center text-[11px] text-slate-400">Location data will appear after tracking starts.</p>}
              {!showAllCustomerAreas && customerAreas.length > 6 && (
                <button type="button" onClick={() => setShowAllCustomerAreas(true)} className="text-[10px] font-bold text-[#285ac7]">
                  Show {customerAreas.length - 6} more areas
                </button>
              )}
            </div>
            <footer className="border-t border-slate-100 px-4 py-3 text-[9px] leading-4 text-slate-400">
              City is estimated from IP and checkout details — useful for trends, not exact addresses.
            </footer>
          </section>

          <section className="hidden overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm md:block">
            <header className="px-4 pt-4">
              <h3 className="text-[13px] font-bold text-slate-900">Devices</h3>
              <p className="text-[10px] text-slate-500">Unique visitors by device</p>
            </header>
            <div className="space-y-3 px-4 py-3">
              {deviceMix.length ? deviceMix.map(row => (
                <div key={row.label}>
                  <div className="flex items-center gap-2 text-[11px]">
                    <strong className="text-slate-800">{row.label}</strong>
                    {row.label.toLowerCase() === 'mobile' && totalAudienceOrders > 0 && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600">{numberText(totalAudienceOrders)} ORDERS</span>}
                    <span className="ml-auto font-bold text-slate-800">{numberText(row.count)}</span>
                    <span className="w-10 text-right text-slate-400">{Number(row.percentage || 0)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-[#2f80df]" style={{ width: `${Math.max(Number(row.percentage || 0), 2)}%` }} />
                  </div>
                </div>
              )) : <p className="py-8 text-center text-[11px] text-slate-400">Device data is not available yet.</p>}
              {desktopShare >= 60 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-[10px] leading-4 text-orange-800">
                  <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                  <strong>Desktop {Number(desktopShare.toFixed(1))}% is unusual for a Bangladesh-focused store.</strong> Test checkout on a phone as well.
                </div>
              )}
            </div>
            <footer className="mt-auto border-t border-slate-100 px-4 py-3 text-[9px] leading-4 text-slate-400">
              Device comes from the first tracked browser event.
            </footer>
          </section>

          <section className="hidden overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm md:block">
            <header className="px-4 pt-4">
              <h3 className="text-[13px] font-bold text-slate-900">Browsers</h3>
              <p className="text-[10px] text-slate-500">Unique visitors by browser</p>
            </header>
            <div className="space-y-3 px-4 py-3">
              {browserMix.length ? browserMix.map((row, index) => {
                const unknown = /unknown/i.test(row.label);
                return (
                  <div key={row.label}>
                    <div className="flex items-center gap-2 text-[11px]">
                      <strong className={unknown ? 'text-orange-700' : 'text-slate-800'}>{row.label}</strong>
                      <span className="ml-auto font-bold text-slate-800">{numberText(row.count)}</span>
                      <span className="w-10 text-right text-slate-400">{Number(row.percentage || 0)}%</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-full rounded-full ${unknown ? 'bg-orange-400' : 'bg-[#2f80df]'}`} style={{ width: `${Math.max(Number(row.percentage || 0), 2)}%` }} />
                    </div>
                    {index === 1 && <div className="mt-0" />}
                  </div>
                );
              }) : <p className="py-8 text-center text-[11px] text-slate-400">Browser data is not available yet.</p>}
              {!!browserMix[0] && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[10px] leading-4 text-emerald-800">
                  <CheckCircle className="mr-1 inline h-3.5 w-3.5" />
                  Test {browserMix[0].label} first — it covers {Number(browserMix[0].percentage || 0)}% of visitors.
                </div>
              )}
            </div>
            <footer className="border-t border-slate-100 px-4 py-3 text-[9px] leading-4 text-slate-400">
              Browser is read from the user agent; privacy tools may hide it.
            </footer>
          </section>
        </div>

        <section className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm md:hidden">
          <header className="px-4 pt-4">
            <h3 className="text-[13px] font-bold text-slate-900">Devices &amp; browsers</h3>
            <p className="text-[10px] text-slate-500">Unique visitors</p>
          </header>
          <div className="space-y-3 px-4 py-3">
            {deviceMix.map(row => (
              <div key={`mobile-device-${row.label}`}>
                <div className="flex items-center gap-2 text-[11px]">
                  <strong className="text-slate-800">{row.label}</strong>
                  {row.label.toLowerCase() === 'mobile' && totalAudienceOrders > 0 && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600">{numberText(totalAudienceOrders)} ORDERS</span>}
                  <span className="ml-auto font-bold text-slate-800">{numberText(row.count)}</span>
                  <span className="w-10 text-right text-slate-400">{Number(row.percentage || 0)}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-[#2f80df]" style={{ width: `${Math.max(Number(row.percentage || 0), 2)}%` }} />
                </div>
              </div>
            ))}
            {deviceMix.length > 0 && browserMix.length > 0 && <div className="border-t border-slate-100" />}
            {browserMix.map(row => {
              const unknown = /unknown/i.test(row.label);
              return (
                <div key={`mobile-browser-${row.label}`}>
                  <div className="flex items-center gap-2 text-[11px]">
                    <strong className={unknown ? 'text-orange-700' : 'text-slate-800'}>{row.label}</strong>
                    <span className="ml-auto font-bold text-slate-800">{numberText(row.count)}</span>
                    <span className="w-10 text-right text-slate-400">{Number(row.percentage || 0)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div className={`h-full rounded-full ${unknown ? 'bg-orange-400' : 'bg-[#2f80df]'}`} style={{ width: `${Math.max(Number(row.percentage || 0), 2)}%` }} />
                  </div>
                </div>
              );
            })}
            {!deviceMix.length && !browserMix.length && <p className="py-8 text-center text-[10px] text-slate-400">Device and browser data will appear after tracking starts.</p>}
            {desktopShare >= 60 && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-[10px] leading-4 text-orange-800">
                <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                <strong>Desktop {Number(desktopShare.toFixed(1))}% is unusual.</strong> Every order so far came from {topOrderArea?.district || 'your leading customer area'}, so test checkout on a phone first.
              </div>
            )}
            {!!browserMix[0] && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[10px] leading-4 text-emerald-800">
                <CheckCircle className="mr-1 inline h-3.5 w-3.5" />
                Test {browserMix[0].label} first — {Number(browserMix[0].percentage || 0)}% of visitors.
              </div>
            )}
          </div>
          <footer className="border-t border-slate-100 px-4 py-3 text-[9px] leading-4 text-slate-400">
            Device and browser come from the user agent, which some privacy tools hide.
          </footer>
        </section>

        <section className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-sm">
          <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h3 className="text-[13px] font-bold text-slate-900">Actions by area</h3>
              <p className="text-[10px] text-slate-500">Product view → order · repeated actions removed</p>
            </div>
            <div className="inline-flex rounded-lg bg-stone-100 p-1 text-[9px] font-bold">
              <button type="button" onClick={() => setDistrictFunnelMode('events')} className={`rounded-md px-3 py-1.5 ${districtFunnelMode === 'events' ? 'bg-white text-[#193b68] shadow-sm' : 'text-slate-500'}`}>Events</button>
              <button type="button" onClick={() => setDistrictFunnelMode('visitors')} className={`rounded-md px-3 py-1.5 ${districtFunnelMode === 'visitors' ? 'bg-white text-[#193b68] shadow-sm' : 'text-slate-500'}`}>Visitors</button>
            </div>
          </header>

          <div className="space-y-3 p-3 md:hidden">
            {primaryAreaFunnel ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <strong className="text-[12px] text-slate-800">{primaryAreaFunnel.district}</strong>
                    <p className="mt-0.5 text-[9px] text-slate-400">
                      {numberText(topDistricts.find(row => row.label.toLowerCase() === primaryAreaFunnel.district.toLowerCase())?.count || 0)} visitors
                    </p>
                  </div>
                  <div className="text-right">
                    <strong className="text-sm text-slate-900">{formatMoney(primaryAreaFunnel.revenue, primaryAreaFunnel.currency || 'BDT')}</strong>
                    <p className="text-[9px] text-slate-400">{numberText(primaryAreaFunnel.purchase)} orders</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  {[
                    ['Seen', primaryAreaFunnel.page_view],
                    ['Cart', primaryAreaFunnel.add_to_cart],
                    ['Checkout', primaryAreaFunnel.initiate_checkout],
                    ['Orders', primaryAreaFunnel.purchase],
                  ].map(([label, value]) => (
                    <div key={String(label)} className={`rounded-lg border px-2 py-2 ${label === 'Cart' && Number(primaryAreaFunnel.add_to_cart) < Number(primaryAreaFunnel.initiate_checkout) ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}>
                      <p className="text-[8px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-1 text-sm font-black text-slate-800">{numberText(value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="py-6 text-center text-[10px] text-slate-400">Area actions will appear after tracking starts.</p>}

            {unknownAreaFunnel && unknownAreaFunnel !== primaryAreaFunnel && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div>
                  <strong className="text-[11px] text-orange-700">Unknown location</strong>
                  <p className="text-[9px] text-slate-400">{numberText(unknownLocationVisitors)} visitors · location unavailable</p>
                </div>
                <div className="text-right">
                  <strong className="text-[11px] text-slate-500">{formatMoney(unknownAreaFunnel.revenue, unknownAreaFunnel.currency || 'BDT')}</strong>
                  <p className="text-[9px] text-slate-400">{numberText(unknownAreaFunnel.purchase)} orders</p>
                </div>
              </div>
            )}
            {districtFunnel.length > 1 && (
              <button type="button" onClick={() => setShowAllCustomerAreas(value => !value)} className="text-left text-[10px] font-bold text-[#285ac7]">
                {showAllCustomerAreas ? 'Show fewer areas' : `Show all ${districtFunnel.length} areas →`}
              </button>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3">Funnel · Seen → Cart → Checkout</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Sales</th>
                  <th className="px-4 py-3">Share of sales</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {districtFunnel.length ? districtFunnel.map(row => {
                  const salesShare = totalSourceSales > 0 ? Number(((Number(row.revenue || 0) / totalSourceSales) * 100).toFixed(1)) : 0;
                  const visitorCount = topDistricts.find(area => area.label.toLowerCase() === row.district.toLowerCase())?.count || 0;
                  return (
                    <tr key={row.district}>
                      <td className="px-4 py-3">
                        <strong className={isUnknownArea(row.district) ? 'text-orange-700' : 'text-slate-800'}>{row.district}</strong>
                        <p className="mt-0.5 text-[10px] text-slate-400">{numberText(visitorCount)} visitors</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex h-8 items-end gap-1" aria-label={`Seen ${row.page_view}, cart ${row.add_to_cart}, checkout ${row.initiate_checkout}, orders ${row.purchase}`}>
                          {[row.page_view, row.add_to_cart, row.initiate_checkout, row.purchase].map((value, index) => (
                            <span key={index} className="w-4 rounded-t bg-[#5a9ce6]" style={{ height: `${Math.max(4, Math.min(30, Number(value || 0) * 2))}px` }} />
                          ))}
                        </div>
                        <p className="mt-1 text-[9px] text-slate-400">{numberText(row.page_view)} · {numberText(row.add_to_cart)} · {numberText(row.initiate_checkout)} · {numberText(row.purchase)}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <strong className="text-slate-800">{numberText(row.purchase)}</strong>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <strong className="text-slate-800">{formatMoney(row.revenue, row.currency || 'BDT')}</strong>
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                          <div className="h-full rounded-full bg-[#2f80df]" style={{ width: `${Math.max(salesShare, salesShare > 0 ? 2 : 0)}%` }} />
                        </div>
                        <p className="mt-1 text-[9px] text-slate-400">{salesShare}% of sales</p>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Area actions will appear after tracking starts.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
  );
}

export default CustomersSection;
