import { AlertTriangle, Info, Megaphone } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../common/Table';
import {
  campaignDeliveryNote,
  campaignTableRows,
  describeAccount,
  describePeriod,
  describeSource,
} from './liveAnalytics';
import type { AiAdsLiveAnalytics } from '../../services/aiAdsApi';

/**
 * The Campaigns tab's live half: what the platform is actually delivering right now.
 *
 * The tab used to render our synced rows and print their `status`, which is only the switch someone
 * last flipped. Two campaigns therefore read `ACTIVE` here while Ads Manager's Delivery column read
 * "Off" — a campaign switch can be on with every ad under it paused or rejected. `effective_status`
 * is the field that decides delivery and it exists only on a live read, so this asks the platform.
 * All the wording and arithmetic lives in `liveAnalytics.ts`; this file only lays it out.
 */
export function LiveCampaignsPanel({ live }: { live: AiAdsLiveAnalytics }) {
  const rows = campaignTableRows(live);
  const note = campaignDeliveryNote(live);
  const accountLabel = describeAccount(live);
  const source = describeSource(live.source);

  return (
    <section className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)]">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bk-console-blue-soft)]">
            <Megaphone className="h-4 w-4 text-[var(--bk-console-blue)]" />
          </span>
          <div>
            <h3 className="text-base font-bold text-[var(--bk-console-text)]">What each campaign is delivering</h3>
            <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">
              {accountLabel ? `${accountLabel} · ` : ''}{describePeriod(live)}
            </p>
            {note ? (
              <p className="mt-1 text-xs font-semibold text-[var(--bk-console-text)]">{note.headline}</p>
            ) : null}
          </div>
        </div>
        <Badge tone={source.tone} dot>{source.label}</Badge>
      </div>

      {/* The owner's exact complaint, stated by the page itself rather than left for them to
          discover by opening Ads Manager beside it. */}
      {note?.mismatch ? (
        <p className="mx-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{note.mismatch}</span>
        </p>
      ) : null}

      {/* When the provider refused to describe delivery, the rows say "Not reported" and no count of
          on or off is printed anywhere — a delivery claim with no source behind it is the defect. */}
      {note?.unreadable ? (
        <p className="mx-5 flex items-start gap-2 rounded-lg border border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)] px-3 py-2 text-xs leading-relaxed text-[var(--bk-console-text-muted)]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{note.unreadable}</span>
        </p>
      ) : null}

      <div className="mt-3">
        <Table
          caption="Each campaign in this window with what the platform is delivering, its spend and its return"
          wrapperClassName="[&>table]:min-w-[900px]"
        >
          <TableHead>
            <TableRow>
              <TableHeaderCell className="min-w-[190px]">Campaign</TableHeaderCell>
              <TableHeaderCell>Delivery</TableHeaderCell>
              <TableHeaderCell className="text-right">Spend</TableHeaderCell>
              <TableHeaderCell className="text-right">Purchases</TableHeaderCell>
              <TableHeaderCell className="text-right">Revenue</TableHeaderCell>
              <TableHeaderCell className="text-right">Cost per purchase</TableHeaderCell>
              <TableHeaderCell className="text-right">ROAS</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.campaignId || String(index)}>
                <TableCell className="align-top">
                  <p className="font-semibold text-[var(--bk-console-text)]">{row.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">
                    {[row.objective, row.maskedId].filter(Boolean).join(' · ')}
                  </p>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
