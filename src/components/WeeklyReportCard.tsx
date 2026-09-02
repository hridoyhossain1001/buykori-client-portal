import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Download, RefreshCw, RotateCcw, ShoppingBag, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';
import { SERIES_GREEN_ON_DARK } from '../lib/chartColors';

interface WeeklyMetricSet {
  purchases: number;
  revenue: number;
  currency: string;
  recoveredCheckouts: number;
  deliveryAttempts: number;
  deliveredEvents: number;
  deliveryRate: number | null;
  topSource: string | null;
  topSourcePurchases: number;
}

interface WeeklyReport {
  period: { start: string; end: string; label: string };
  current: WeeklyMetricSet;
  previous: WeeklyMetricSet;
  changes: Record<'purchases' | 'revenue' | 'recoveredCheckouts' | 'deliveryRate', number | null>;
}

const METRIC_LABELS = ['Tracked revenue', 'Confirmed orders', 'Recovered checkouts', 'Delivery success'];

/**
 * The three mobile tile captions, shared by the skeleton and the loaded row.
 *
 * They have to render at the same size in both, or the skeleton stops predicting
 * the height it is standing in for and the shift it exists to prevent comes back.
 * One constant makes that structural instead of a coincidence. 10px is below the
 * --text-* scale's smallest step (text-label, 11px), so it stays arbitrary here
 * rather than growing the scale for one caption.
 */
const MOBILE_TILE_LABEL = 'text-[10px] font-semibold text-slate-300';

/**
 * The phone card's shape, drawn without data.
 *
 * Mirrors the loaded mobile layout row for row — eyebrow, 29px figure, 58px
 * sparkline, three tiles — for the same reason as the desktop placeholder: at
 * 360x640 this whole section removing itself was a 0.346 layout shift, the
 * second largest on the dashboard. `invisible` lets the failure notice reuse the
 * footprint.
 */
function MobilePlaceholder({ tone }: { tone: 'loading' | 'hidden' }) {
  const bar = tone === 'loading' ? 'bg-white/15 animate-pulse' : 'bg-white/15';
  return (
    <div className={tone === 'hidden' ? 'invisible' : undefined} aria-hidden="true">
      <div className={`h-4 w-40 rounded ${bar}`} />
      <div className={`mt-1 h-[29px] w-52 rounded ${bar}`} />
      <div className={`mt-3 h-[58px] w-full rounded-lg ${bar}`} />
      <div className="mt-2 grid grid-cols-3 gap-2">
        {['Orders', 'Recovered', 'Delivery'].map(label => (
          <div key={label} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
            <p className={MOBILE_TILE_LABEL}>{label}</p>
            <div className={`mt-0.5 h-4 w-10 rounded ${bar}`} />
            <div className={`mt-2 h-[13px] w-8 rounded ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Change({ value, points = false }: { value: number | null; points?: boolean }) {
  if (value === null) return <span className="text-xs text-slate-400">No comparison</span>;
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon className="h-3.5 w-3.5" />
      {positive ? '+' : ''}{value}{points ? ' pts' : '%'}
    </span>
  );
}

/**
 * Placeholder for the four desktop metric tiles.
 *
 * It mirrors the loaded grid element for element — same columns, same gaps, same
 * internal spacing, same `h-7` value row — so the card is exactly as tall before
 * the numbers arrive as after. That is deliberate and load-bearing: the earlier
 * version guessed a flat `h-28`, and every state change (skeleton to numbers, or
 * skeleton to nothing) moved the whole dashboard underneath it. Copy any spacing
 * change in the real grid across to here.
 *
 * `invisible` keeps the box in the layout while hiding the paint — that is how
 * the failure state below borrows this footprint without redrawing tiles.
 */
function MetricGridPlaceholder({ tone }: { tone: 'loading' | 'hidden' }) {
  const bar = tone === 'loading' ? 'bg-slate-200/70 animate-pulse' : 'bg-slate-200/70';
  return (
    <div className={tone === 'hidden' ? 'invisible' : undefined} aria-hidden="true">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {METRIC_LABELS.map(label => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/45 p-4">
            <div className={`h-10 w-10 rounded-xl ${bar}`} />
            <p className="mt-4 text-xs font-semibold text-slate-400">{label}</p>
            <div className="mt-1 flex h-7 items-end">
              <div className={`h-5 w-24 rounded ${bar}`} />
            </div>
          </div>
        ))}
      </div>
      <div className={`mt-3 h-4 w-64 max-w-full rounded ${bar}`} />
    </div>
  );
}

/**
 * What the card says when the report cannot be fetched.
 *
 * It sits on top of an invisible copy of the real grid, so the card holds its
 * place instead of vanishing. Vanishing was the worse half of the bug: the
 * dashboard jumped ~266px and the merchant was never told the report had failed.
 */
function ReportUnavailable({ detail, onRetry }: { detail: string; onRetry: () => void }) {
  return (
    <div className="relative">
      <MetricGridPlaceholder tone="hidden" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5 text-center">
        <p className="text-sm font-bold text-slate-800">Last 7 days didn&rsquo;t load</p>
        <p className="max-w-md text-xs text-slate-500">
          Your tracking and orders are unaffected — only this summary is missing. {detail}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-[var(--bk-brand-border)]"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    </div>
  );
}

export function WeeklyReportCard() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  /** Set only when a fetch finished without a report, so the card can say so. */
  const [failure, setFailure] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reports/weekly');
      if (response.ok) {
        setReport(await response.json());
        setFailure(null);
      } else {
        // Named, not shrugged at: support can read the status straight off the
        // card, and 401 tells the merchant the real problem is the session.
        setFailure(response.status === 401
          ? 'Your session may have expired — reload the page to sign in again.'
          : `The report request came back with status ${response.status}.`);
      }
    } catch {
      setFailure('The request could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const download = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `buykori-weekly-report-${report.period.end.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // No `return null` on failure. A card that removes itself takes ~266px out of
  // the middle of the dashboard a second after paint, which moved everything
  // below it under the merchant's finger, and told them nothing about why the
  // report was gone. It now keeps its footprint and explains itself instead.
  const metrics = report ? [
    { label: METRIC_LABELS[0], value: `${report.current.currency} ${report.current.revenue.toLocaleString()}`, change: report.changes.revenue, icon: WalletCards, tone: 'bg-blue-600 text-white' },
    { label: METRIC_LABELS[1], value: report.current.purchases.toLocaleString(), change: report.changes.purchases, icon: ShoppingBag, tone: 'bg-emerald-500 text-white' },
    { label: METRIC_LABELS[2], value: report.current.recoveredCheckouts.toLocaleString(), change: report.changes.recoveredCheckouts, icon: RotateCcw, tone: 'bg-violet-500 text-white' },
    { label: METRIC_LABELS[3], value: report.current.deliveryRate === null ? 'No attempts' : `${report.current.deliveryRate}%`, change: report.changes.deliveryRate, points: true, icon: BadgeCheck, tone: 'bg-emerald-700 text-white' },
  ] : [];

  return (
    <>
    <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4 text-white shadow-[0_12px_30px_rgba(25,39,51,0.18)] md:hidden">
      {loading && !report ? (
        <MobilePlaceholder tone="loading" />
      ) : !report ? (
        <div className="relative">
          <MobilePlaceholder tone="hidden" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-bold">Last 7 days didn&rsquo;t load</p>
            <p className="max-w-[260px] text-label leading-relaxed text-slate-300">
              Your tracking and orders are unaffected — only this summary is missing.
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 text-xs font-semibold text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative z-10">
            <p className="text-label font-bold uppercase tracking-[0.1em] text-slate-300">Tracked revenue · last 7 days</p>
            <div className="mt-0.5 flex items-center gap-2">
              <h2 className="text-[29px] font-extrabold leading-none tracking-tight">
                {report.current.currency} {report.current.revenue.toLocaleString()}
              </h2>
              {report.changes.revenue !== null && (
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                  report.changes.revenue >= 0 ? 'bg-emerald-300/15 text-emerald-200' : 'bg-rose-300/15 text-rose-200'
                }`}>
                  {report.changes.revenue >= 0 ? '△' : '▽'} {Math.abs(report.changes.revenue)}%
                </span>
              )}
            </div>
          </div>

          <svg className="mt-3 h-[58px] w-full overflow-visible" viewBox="0 0 320 58" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="mobileWeeklyRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_GREEN_ON_DARK} stopOpacity=".35" />
                <stop offset="100%" stopColor={SERIES_GREEN_ON_DARK} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={report.current.revenue >= report.previous.revenue
                ? 'M0 48 C58 41 76 22 132 31 C187 41 198 50 226 24 C249 3 278 19 320 34 L320 58 L0 58 Z'
                : 'M0 20 C58 12 76 30 132 24 C187 18 198 30 226 35 C260 42 286 39 320 48 L320 58 L0 58 Z'}
              fill="url(#mobileWeeklyRevenue)"
            />
            <path
              d={report.current.revenue >= report.previous.revenue
                ? 'M0 48 C58 41 76 22 132 31 C187 41 198 50 226 24 C249 3 278 19 320 34'
                : 'M0 20 C58 12 76 30 132 24 C187 18 198 30 226 35 C260 42 286 39 320 48'}
              fill="none"
              stroke={SERIES_GREEN_ON_DARK}
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="319" cy={report.current.revenue >= report.previous.revenue ? 34 : 48} r="2.5" fill="#fff" />
          </svg>

          <div className="relative z-10 mt-2 grid grid-cols-3 gap-2">
            {[
              { label: 'Orders', value: report.current.purchases.toLocaleString(), change: report.changes.purchases, points: false },
              { label: 'Recovered', value: report.current.recoveredCheckouts.toLocaleString(), change: report.changes.recoveredCheckouts, points: false },
              { label: 'Delivery', value: report.current.deliveryRate === null ? '—' : `${report.current.deliveryRate}%`, change: report.changes.deliveryRate, points: true },
            ].map(metric => (
              <div key={metric.label} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2.5">
                <p className={MOBILE_TILE_LABEL}>{metric.label}</p>
                <p className="mt-0.5 text-base font-extrabold leading-none">{metric.value}</p>
                <p className={`mt-2 text-[10px] font-bold ${
                  metric.change === null ? 'text-slate-400' : metric.change >= 0 ? 'text-emerald-200' : 'text-rose-200'
                }`}>
                  {metric.change === null
                    ? '—'
                    : `${metric.change >= 0 ? '+' : ''}${metric.change}${metric.points ? ' pts' : '%'}`}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>

    <section className="hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:block">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Store performance</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Your last 7 days</h2>
          <p className="mt-1 text-xs text-slate-500">Compared with the previous 7-day period</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-blue-300 disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={download} disabled={!report} className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>
      {report ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(metric => (
              <div key={metric.label} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/45 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${metric.tone}`}><metric.icon className="h-5 w-5" /></div>
                <p className="mt-4 text-xs font-semibold text-slate-500">{metric.label}</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="text-xl font-bold tracking-tight text-slate-950">{metric.value}</p>
                  <Change value={metric.change} points={metric.points} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Top purchase source: <strong className="text-slate-700">{report.current.topSource || 'No attributed purchases'}</strong>
            {report.current.topSource ? ` (${report.current.topSourcePurchases})` : ''}
          </p>
        </>
      ) : loading ? (
        <MetricGridPlaceholder tone="loading" />
      ) : (
        <ReportUnavailable detail={failure ?? ''} onRetry={() => void load()} />
      )}
    </section>
    </>
  );
}
