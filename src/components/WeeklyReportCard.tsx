import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Download, RefreshCw, RotateCcw, ShoppingBag, TrendingDown, TrendingUp, WalletCards } from 'lucide-react';

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

export function WeeklyReportCard() {
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/reports/weekly');
      if (response.ok) setReport(await response.json());
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

  if (!report && !loading) return null;
  const metrics = report ? [
    { label: 'Tracked revenue', value: `${report.current.currency} ${report.current.revenue.toLocaleString()}`, change: report.changes.revenue, icon: WalletCards, tone: 'bg-blue-600 text-white' },
    { label: 'Confirmed orders', value: report.current.purchases.toLocaleString(), change: report.changes.purchases, icon: ShoppingBag, tone: 'bg-emerald-500 text-white' },
    { label: 'Recovered checkouts', value: report.current.recoveredCheckouts.toLocaleString(), change: report.changes.recoveredCheckouts, icon: RotateCcw, tone: 'bg-violet-500 text-white' },
    { label: 'Delivery success', value: report.current.deliveryRate === null ? 'No attempts' : `${report.current.deliveryRate}%`, change: report.changes.deliveryRate, points: true, icon: BadgeCheck, tone: 'bg-cyan-600 text-white' },
  ] : [];

  return (
    <>
    <section className="relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#142d4f] via-[#183d67] to-[#0f3156] p-4 text-white shadow-[0_12px_30px_rgba(15,49,86,0.18)] md:hidden">
      {loading && !report ? (
        <div className="h-[194px] animate-pulse rounded-2xl bg-white/10" />
      ) : report && (
        <>
          <div className="relative z-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-300">Tracked revenue · last 7 days</p>
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
                <stop offset="0%" stopColor="#7dd3a7" stopOpacity=".35" />
                <stop offset="100%" stopColor="#7dd3a7" stopOpacity="0" />
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
              stroke="#7dd3a7"
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
                <p className="text-[10px] font-semibold text-slate-300">{metric.label}</p>
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
          <button type="button" onClick={download} disabled={!report} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#285ac7] px-3 text-xs font-semibold text-white hover:bg-[#214fae] disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </div>
      {loading && !report ? (
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
      ) : report && (
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
      )}
    </section>
    </>
  );
}
