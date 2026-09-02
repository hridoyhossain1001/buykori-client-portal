import { AlertTriangle, BarChart3, Layers, Scale } from 'lucide-react';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { StatCard } from '../common/StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../common/Table';
import {
  adTableRows,
  describeAccount,
  describePeriod,
  describeSource,
  platformKpis,
  threeViewRows,
  wastedSpendNote,
} from './liveAnalytics';
import type { AiAdsLiveAnalytics } from '../../services/aiAdsApi';

/**
 * The Analytics tab's live half: what the ad platform reports right now, the same window counted
 * three ways, and one row per ad.
 *
 * The tab used to render only the stored snapshot, whose purchases and revenue come from our own
 * tracked events. A store that sends us no events therefore saw its real spend beside eleven
 * zeros — the account looked dead when the platform was reporting sales. All the arithmetic and
 * wording lives in `liveAnalytics.ts` so it is unit-tested; this file only lays it out.
 */
export function LiveAnalyticsPanel({ live }: { live: AiAdsLiveAnalytics }) {
  const kpis = platformKpis(live);
  const views = threeViewRows(live);
  const rows = adTableRows(live);
  const accountLabel = describeAccount(live);
  const accountSource = describeSource(live.source);
  const adsSource = describeSource(live.ads?.source);
  const wasted = wastedSpendNote(live);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bk-console-blue-soft)]">
              <BarChart3 className="h-4 w-4 text-[var(--bk-console-blue)]" />
            </span>
            <div>
              <h3 className="text-base font-bold text-[var(--bk-console-text)]">What the platform reports</h3>
              <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">
                {accountLabel ? `${accountLabel} · ` : ''}{describePeriod(live)}
              </p>
            </div>
          </div>
          {/* The account read and the per-ad read fall back separately, so each states its own
              source. A stored figure shown as live is how a merchant spends against stale data. */}
          <Badge tone={accountSource.tone} dot>{accountSource.label}</Badge>
        </div>

        {live.data_notice ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            {live.data_notice}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(tile => <StatCard key={tile.key} label={tile.label} value={tile.value} caption={tile.caption} />)}
        </div>
      </section>

      <ThreeViewsCard views={views} note={live.reconciliation?.how_to_present ?? null} />

      <section className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bk-console-blue-soft)]">
              <Layers className="h-4 w-4 text-[var(--bk-console-blue)]" />
            </span>
            <div>
              <h3 className="text-base font-bold text-[var(--bk-console-text)]">Every ad, ranked by spend</h3>
              {/* The account average is the one number a merchant cannot act on: a single CPA can
                  hide one ad selling everything while the rest spend for nothing. */}
              <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">
                Each ad on its own row, so ads of the same product are never merged.
              </p>
            </div>
          </div>
          <Badge tone={adsSource.tone} dot>{adsSource.label}</Badge>
        </div>

        {wasted ? (
          <p className="mx-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{wasted}</span>
          </p>
        ) : null}

        {live.ads?.data_notice ? (
          <p className="mx-5 mt-2 rounded-lg border border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--bk-console-text-muted)]">
            {live.ads.data_notice}
          </p>
        ) : null}

        <div className="mt-3">
          {rows.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No individual ads to show"
              description={
                adsSource.live
                  ? 'The platform reported no ads in this window for this account. A wider window usually shows the ones that ran earlier.'
                  : 'The per-ad breakdown could not be read from the platform just now. The account numbers above are unaffected.'
              }
            />
          ) : (
            <AdRankingTable rows={rows} />
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * The same window counted three ways, side by side and never averaged.
 *
 * Neither count is wrong. The platform credits a purchase inside its own attribution window, our
 * tracking only ever sees what the store sent us, and a cash-on-delivery order is not money until
 * it is delivered. A merchant reading one number without knowing which of the three it is cannot
 * tell a tracking gap from a real drop in sales.
 */
function ThreeViewsCard({ views, note }: { views: ReturnType<typeof threeViewRows>; note: string | null }) {
  return (
    <section className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]">
      <div className="flex items-start gap-3 p-5 pb-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bk-console-blue-soft)]">
          <Scale className="h-4 w-4 text-[var(--bk-console-blue)]" />
        </span>
        <div>
          <h3 className="text-base font-bold text-[var(--bk-console-text)]">Three ways to count the same window</h3>
          <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">
            The platform&rsquo;s report, your own tracking, and the orders your store confirmed.
          </p>
        </div>
      </div>

      <Table caption="Purchases and return counted by the platform, by our tracking, and by confirmed orders">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Counted by</TableHeaderCell>
            <TableHeaderCell className="text-right">Purchases</TableHeaderCell>
            <TableHeaderCell className="text-right">Revenue</TableHeaderCell>
            <TableHeaderCell className="text-right">Cost per purchase</TableHeaderCell>
            <TableHeaderCell className="text-right">ROAS</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {views.map(view => (
            <TableRow key={view.key}>
              <TableCell>
                <p className="font-semibold text-[var(--bk-console-text)]">{view.label}</p>
                <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">{view.note}</p>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{view.purchases}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{view.revenue}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{view.cpa}</TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{view.roas}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {note ? (
        <p className="border-t border-[var(--bk-console-border)] px-5 py-3 text-[11px] leading-relaxed text-[var(--bk-console-text-subtle)]">
          {note}
        </p>
      ) : null}
    </section>
  );
}

/**
 * One row per ad, in the order the money went out.
 *
 * The delivery pill reads `effective_status`, not the on/off switch: an ad can be switched on and
 * still not run because its campaign is paused or because Meta rejected it, which is exactly the
 * mismatch a merchant sees as "Ad off" in Ads Manager while our tab said ACTIVE. Ads that share a
 * name are marked, because then the rank number is the only thing telling them apart.
 */
function AdRankingTable({ rows }: { rows: ReturnType<typeof adTableRows> }) {
  return (
    /* Nine columns do not fit a laptop viewport beside the sidebar, and the shared 640px minimum
       lets the browser break "9,400.00 BDT" across two lines — a money figure split mid-value is
       harder to read than a scrollbar. The wider minimum makes the table scroll instead. */
    <Table
      caption="Each ad in this window with its delivery state, spend and return"
      wrapperClassName="[&>table]:min-w-[1040px]"
    >
      <TableHead>
        <TableRow>
          <TableHeaderCell className="w-10 text-right">#</TableHeaderCell>
          <TableHeaderCell className="min-w-[190px]">Ad</TableHeaderCell>
          <TableHeaderCell>Delivery</TableHeaderCell>
          <TableHeaderCell className="text-right">Spend</TableHeaderCell>
          <TableHeaderCell className="text-right">Purchases</TableHeaderCell>
          <TableHeaderCell className="text-right">Revenue</TableHeaderCell>
          <TableHeaderCell className="text-right">Cost per purchase</TableHeaderCell>
          <TableHeaderCell className="text-right">ROAS</TableHeaderCell>
          <TableHeaderCell className="text-right">Link clicks</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map(row => (
          <TableRow key={row.adId || String(row.index)}>
            <TableCell className="text-right align-top tabular-nums text-[var(--bk-console-text-subtle)]">{row.index}</TableCell>
            <TableCell className="align-top">
              <p className="font-semibold text-[var(--bk-console-text)]">{row.name}</p>
              {row.place ? <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">{row.place}</p> : null}
              {row.nameIsDuplicated ? (
                <p className="mt-0.5 text-[11px] text-[var(--bk-console-text-subtle)]">
                  Another ad shares this name — this is #{row.index}.
                </p>
              ) : null}
              {row.structureMissing ? (
                <p className="mt-0.5 text-[11px] text-amber-700">
                  The platform billed this ad but would not return its details.
                </p>
              ) : null}
            </TableCell>
            <TableCell className="align-top">
              <Badge tone={row.delivery.tone} dot>{row.delivery.label}</Badge>
              {row.delivery.switchedOnButIdle ? (
                <p className="mt-1 max-w-[9rem] text-[11px] leading-snug text-[var(--bk-console-text-subtle)]">
                  Switched on, but not delivering.
                </p>
              ) : null}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right align-top tabular-nums">
              {row.spend}
              {row.spentWithoutSelling ? (
                <span className="mt-0.5 block text-[11px] font-semibold text-amber-700">No purchase</span>
              ) : null}
            </TableCell>
            <TableCell className="whitespace-nowrap text-right align-top tabular-nums">{row.purchases}</TableCell>
            <TableCell className="whitespace-nowrap text-right align-top tabular-nums">{row.revenue}</TableCell>
            <TableCell className="whitespace-nowrap text-right align-top tabular-nums">{row.cpa}</TableCell>
            <TableCell className="whitespace-nowrap text-right align-top tabular-nums">{row.roas}</TableCell>
            <TableCell className="whitespace-nowrap text-right align-top tabular-nums">
              {row.linkClicks}
              <span className="mt-0.5 block text-[11px] text-[var(--bk-console-text-subtle)]">CTR {row.ctr}</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
