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
    <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
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
  );
}
