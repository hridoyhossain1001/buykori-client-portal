import React from 'react';
import { Download } from 'lucide-react';
import { PlatformBadge } from '../common/PlatformLogo';
import type { AdPerformanceMeta, AdPerformanceRow } from '../../types';
import type { GetAdStatus } from './analyticsTypes';
import { formatMoney, numberText } from './analyticsFormat';

type AdResultsSectionProps = {
  activeInsightTab: string;
  adPerformance: AdPerformanceRow[];
  filteredAdPerformance: AdPerformanceRow[];
  adPerformanceMeta: AdPerformanceMeta | null;
  adPerformanceError: string | null;
  loadingAdPerformance: boolean;
  adSearch: string;
  setAdSearch: React.Dispatch<React.SetStateAction<string>>;
  adSort: string;
  setAdSort: React.Dispatch<React.SetStateAction<string>>;
  getAdStatus: GetAdStatus;
  fetchAdPerformance: () => void;
  exportAdResults: () => void;
};

export function AdResultsSection({
  activeInsightTab,
  adPerformance,
  filteredAdPerformance,
  adPerformanceMeta,
  adPerformanceError,
  loadingAdPerformance,
  adSearch,
  setAdSearch,
  adSort,
  setAdSort,
  getAdStatus,
  fetchAdPerformance,
  exportAdResults,
}: AdResultsSectionProps) {
  return (
    <div id="analytics-ad-performance" role="tabpanel" aria-labelledby="ad-insights-tab-ads" className={`${activeInsightTab === 'ads' ? 'flex' : 'hidden'} scroll-mt-24 flex-col space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-7`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Ad Results</h3>
          <p className="text-xs text-slate-500">See ad cost, new orders, confirmed sales, and return in one place.</p>
          {adPerformanceMeta?.last_synced_at && (
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Last synced: {new Date(adPerformanceMeta.last_synced_at).toLocaleString()}
            </p>
          )}
        </div>
        {loadingAdPerformance && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="animate-spin h-3.5 w-3.5 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <span>Updating ad data...</span>
          </div>
        )}
      </div>

      {adPerformanceMeta && (!adPerformanceMeta.sync_enabled || adPerformanceMeta.connected_accounts === 0 || adPerformanceMeta.missing_attribution_purchases > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          {!adPerformanceMeta.sync_enabled ? (
            <p><strong>Ad sync is off.</strong> Enable ENABLE_AD_SYNC on the server to refresh Meta/TikTok spend automatically.</p>
          ) : adPerformanceMeta.connected_accounts === 0 ? (
            <p><strong>No ad account connected.</strong> Connect a Meta ad account in Settings to populate campaign spend.</p>
          ) : (
            <p>
              <strong>{numberText(adPerformanceMeta.missing_attribution_purchases)} sale event(s) could not be matched to an ad campaign.</strong>
              {' '}Use Campaign Tools and choose a synced campaign so new ad links include bk_campaign_id.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
        <div>
          <label htmlFor="ad-results-search" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Find campaign</label>
          <input
            id="ad-results-search"
            type="search"
            value={adSearch}
            onChange={(event) => setAdSearch(event.target.value)}
            placeholder="Search by campaign name, ID, or platform"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div>
          <label htmlFor="ad-results-sort" className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Sort by</label>
          <select
            id="ad-results-sort"
            value={adSort}
            onChange={(event) => setAdSort(event.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="confirmed_revenue">Confirmed Sales</option>
            <option value="return">Return</option>
            <option value="cost_per_order">Cost/order</option>
            <option value="new_orders">New Orders</option>
            <option value="spend">Ad Cost</option>
          </select>
        </div>
        <button
          type="button"
          onClick={exportAdResults}
          disabled={!filteredAdPerformance.length}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
      </div>

      {/* Info Explainer Banner */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-xs text-slate-600 md:grid-cols-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-indigo-700">New Orders</p>
            <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold uppercase text-indigo-700">COD pending included</span>
          </div>
          <p className="leading-normal">Results from all orders placed, including pending COD orders.</p>
        </div>
        <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-indigo-700">Confirmed Sales</p>
            <span className="rounded bg-white px-1.5 py-0.5 text-xs font-bold uppercase text-emerald-700">confirmed only</span>
          </div>
          <p className="leading-normal">Results from confirmed or delivered orders after cancelled orders are removed.</p>
        </div>
        <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-4">
          <p className="font-bold text-indigo-700">Extra Tracking</p>
          <p className="leading-normal">Sales data found by Buykori that normal browser tracking missed.</p>
        </div>
      </div>

      {/* Mobile View */}
      <div className="space-y-2 md:hidden">
        {adPerformanceError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-6 text-center text-xs text-rose-700">
            <p>{adPerformanceError}</p>
            <button
              type="button"
              onClick={fetchAdPerformance}
              className="mt-3 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700"
            >
              Retry
            </button>
          </div>
        ) : !adPerformance || adPerformance.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
            No ad results yet. Connect an ad account in Settings to see results here.
          </div>
        ) : filteredAdPerformance.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs text-slate-400">
            No campaign matched your search.
          </div>
        ) : filteredAdPerformance.map((row, idx: number) => {
          const status = getAdStatus(row);
          return (
          <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap gap-1">
                  <PlatformBadge platform={row.platform} label={row.platform} />
                  <span className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <p className="font-bold text-slate-800 text-xs truncate">{row.campaign_name}</p>
                <p className="font-mono text-xs text-slate-400 truncate">ID: {row.campaign_id}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-black text-slate-900">{formatMoney(row.spend, row.spend_currency)}</p>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Spend</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded text-xs font-semibold text-slate-600">
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">New Orders</span>
                <span className="text-indigo-600 font-black">{row.placed_roas}x return</span> | {formatMoney(row.placed_cpa, row.spend_currency)} per order
                <span className="mt-0.5 block text-xs text-slate-400">
                  {numberText(row.pending_purchases)} pending, {numberText(row.cancelled_purchases)} cancelled/expired
                </span>
              </div>
              <div>
                <span className="block text-xs uppercase tracking-wider text-slate-400 font-bold">Confirmed Sales</span>
                <span className="text-emerald-600 font-black">{row.confirmed_roas}x return</span> | {formatMoney(row.confirmed_cpa, row.spend_currency)} per order
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Clicks: {row.clicks} (click rate: {row.ctr}%)</span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 font-bold uppercase text-xs">
                Extra Tracking: +{row.tracking_bypass_rate}%
              </span>
            </div>
          </div>
        )})}
      </div>

      {/* Desktop View */}
      <div className="hidden max-h-[620px] overflow-auto rounded-lg border border-slate-200 md:block">
        <table className="w-full min-w-[1100px] divide-y divide-slate-100 text-left text-sm text-slate-600">
          <thead className="sticky top-0 z-20 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <tr>
              <th className="sticky left-0 z-30 bg-slate-50 px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Cost &amp; Clicks</th>
              <th className="px-4 py-3">Click Cost</th>
              <th className="px-4 py-3">New Orders</th>
              <th className="px-4 py-3">Confirmed Sales</th>
              <th className="px-4 py-3 text-right">Extra Tracking</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {adPerformanceError ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-rose-600 font-medium">
                  <div className="flex flex-col items-center gap-3">
                    <span>{adPerformanceError}</span>
                    <button
                      type="button"
                      onClick={fetchAdPerformance}
                      className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                    >
                      Retry
                    </button>
                  </div>
                </td>
              </tr>
            ) : !adPerformance || adPerformance.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-medium">
                  No ad results yet. Ad account data updates every 6 hours.
                </td>
              </tr>
            ) : filteredAdPerformance.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-medium">
                  No campaign matched your search.
                </td>
              </tr>
            ) : (
              filteredAdPerformance.map((row, idx: number) => {
                const status = getAdStatus(row);
                return (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="sticky left-0 z-10 max-w-[280px] bg-white px-4 py-3.5 align-middle shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex flex-wrap gap-1">
                        <PlatformBadge platform={row.platform} label={row.platform} />
                        <span className={`w-fit rounded border px-1.5 py-0.5 text-xs font-black uppercase tracking-wider ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <span className="font-bold text-slate-800 truncate" title={row.campaign_name}>
                        {row.campaign_name}
                      </span>
                      <span className="font-mono text-xs text-slate-400 truncate">
                        ID: {row.campaign_id}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-800">{formatMoney(row.spend, row.spend_currency)}</span>
                      <span className="text-slate-500 text-xs">{numberText(row.clicks)} clicks | {numberText(row.impressions)} views</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{row.ctr}% click rate</span>
                      <span className="text-slate-400 text-xs">{formatMoney(row.cpc, row.spend_currency)} per click</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle bg-slate-50/30">
                    <div className="flex flex-col">
                      <span className="font-black text-indigo-600">{row.placed_roas}x return</span>
                      <span className="text-slate-600 text-xs">{row.placed_purchases} Orders ({formatMoney(row.placed_revenue, row.revenue_currency)})</span>
                      <span className="text-slate-400 text-xs">{numberText(row.pending_purchases)} pending, {numberText(row.cancelled_purchases)} cancelled/expired</span>
                      <span className="text-slate-400 text-xs">Cost/order: {formatMoney(row.placed_cpa, row.spend_currency)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle bg-emerald-50/10">
                    <div className="flex flex-col">
                      <span className="font-black text-emerald-600">{row.confirmed_roas}x return</span>
                      <span className="text-slate-600 text-xs">{row.confirmed_purchases} Confirmed ({formatMoney(row.confirmed_revenue, row.revenue_currency)})</span>
                      <span className="text-slate-400 text-xs">Cost/order: {formatMoney(row.confirmed_cpa, row.spend_currency)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-middle text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-black text-slate-800">+{row.tracking_bypass_rate}%</span>
                      <span className="rounded bg-emerald-50 px-1 py-0.5 text-xs font-bold uppercase text-emerald-700 tracking-wider">
                        data found
                      </span>
                    </div>
                  </td>
                </tr>
              )})
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdResultsSection;
