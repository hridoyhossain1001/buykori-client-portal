import { useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CircleGauge } from 'lucide-react';
import { panelClass } from './dashboardUtils';
import type { DashboardChartPoint } from './useDashboardMetrics';

interface EventActivityChartProps {
  chartData: DashboardChartPoint[];
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
}

export function EventActivityChart({ chartData, analyticsDays, setAnalyticsDays }: EventActivityChartProps) {
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 720, height: 280 });

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host) return;
    const resize = () => {
      const rect = host.getBoundingClientRect();
      setChartSize({ width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={`${panelClass} min-w-0 p-5 xl:col-span-8`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Event activity</h2>
          <p className="mt-1 text-xs text-slate-500">Tracked and successfully delivered server events</p>
        </div>
        <select
          value={analyticsDays}
          onChange={event => setAnalyticsDays(Number(event.target.value))}
          aria-label="Select dashboard timeframe"
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>
      <div className="mt-5 flex items-center gap-5 text-xs font-semibold text-slate-500">
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#285ac7]" />Events received</span>
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#12b886]" />Delivered</span>
      </div>
      <div ref={chartHostRef} className="mt-3 h-[270px] min-w-0">
        {chartData.length > 0 ? (
          <AreaChart width={chartSize.width} height={chartSize.height} data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="eventsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#285ac7" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#285ac7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e8edf5" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} stroke="#94a3b8" />
            <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="#94a3b8" />
            <RechartsTooltip contentStyle={{ borderRadius: 12, borderColor: '#dbe3ef', boxShadow: '0 12px 30px rgba(15,23,42,.08)', fontSize: 12 }} />
            <Area type="monotone" dataKey="events" stroke="#285ac7" strokeWidth={2.5} fill="url(#eventsGradient)" />
            <Line type="monotone" dataKey="delivered" stroke="#12b886" strokeWidth={2.25} dot={false} />
          </AreaChart>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
            <div>
              <CircleGauge className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-bold text-slate-700">Waiting for trend data</p>
              <p className="mt-1 text-xs text-slate-400">Event activity will appear after tracking begins.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
