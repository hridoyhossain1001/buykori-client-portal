import { useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CircleGauge } from 'lucide-react';
import { Card, SectionTitle, Select } from '../common';
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_TOOLTIP_STYLE,
  SERIES_BLUE,
  SERIES_GREEN,
} from '../../lib/chartColors';
import type { DashboardChartPoint } from './useDashboardMetrics';

interface EventActivityChartProps {
  chartData: DashboardChartPoint[];
  analyticsDays: number;
  setAnalyticsDays: (days: number) => void;
  /** Events received across the window, for the prototype's caption line. */
  trendTotal: number;
  trendPeak: number;
  trendPeakLabel: string;
}

/**
 * The prototype's "Event delivery" panel: vertical bars on a 170px plot with a
 * y-scale, three axis labels and a one-line caption naming the total and the
 * peak day.
 *
 * Two series, not the prototype's one. The prototype's fixture had a single
 * "events delivered" number per day; the live portal knows both what was
 * received and what was actually delivered, and the gap between them is the
 * whole point of the panel — a day where 900 events came in and 300 landed must
 * not look like a day where 300 came in and 300 landed. So the bars are grouped
 * in the prototype's geometry (26px cap, 3px rounded tops, dashed horizontal
 * rules) rather than collapsed to one series to match the fixture.
 */
export function EventActivityChart({
  chartData,
  analyticsDays,
  setAnalyticsDays,
  trendTotal,
  trendPeak,
  trendPeakLabel,
}: EventActivityChartProps) {
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 720, height: 170 });

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

  const windowLabel = `Last ${analyticsDays} days`;

  return (
    <Card padding="none" className="min-w-0">
      <div className="p-5 pb-0">
        <SectionTitle
          title="Event delivery"
          detail={windowLabel}
          action={(
            <Select
              value={String(analyticsDays)}
              onChange={event => setAnalyticsDays(Number(event.target.value))}
              aria-label="Select dashboard timeframe"
              wrapperClassName="w-[138px]"
              options={[
                { value: '7', label: 'Last 7 days' },
                { value: '14', label: 'Last 14 days' },
                { value: '30', label: 'Last 30 days' },
                { value: '90', label: 'Last 90 days' },
              ]}
            />
          )}
        />
      </div>
      {/* The legend dots take their colour from the same constants as the bars
          below, so a palette change can never desynchronise them. */}
      <div className="mt-4 flex items-center gap-5 px-5 text-[11px] font-semibold text-[var(--bk-console-text-muted)]">
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: SERIES_BLUE }} />Events received</span>
        <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: SERIES_GREEN }} />Delivered</span>
      </div>
      <div className="px-5 pb-3 pt-[18px]">
        <div ref={chartHostRef} className="h-[170px] min-w-0">
          {chartData.length > 0 ? (
            <BarChart
              width={chartSize.width}
              height={chartSize.height}
              data={chartData}
              margin={{ top: 4, right: 4, left: -14, bottom: 0 }}
              barGap={2}
            >
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={CHART_GRID} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={11} stroke={CHART_AXIS} interval="preserveStartEnd" />
              <YAxis axisLine={false} tickLine={false} fontSize={11} stroke={CHART_AXIS} orientation="right" />
              <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgba(25,39,51,0.04)' }} />
              {/* 26px cap and 3px rounded tops: .chart-bars i in the prototype. */}
              <Bar dataKey="events" name="Received" fill={SERIES_BLUE} maxBarSize={26} radius={[3, 3, 0, 0]} />
              <Bar dataKey="delivered" name="Delivered" fill={SERIES_GREEN} maxBarSize={26} radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : (
            <div className="flex h-full items-center justify-center rounded-[var(--bk-radius-control)] border border-dashed border-[var(--bk-console-border)] bg-[var(--bk-console-bg)] text-center">
              <div>
                <CircleGauge className="mx-auto h-7 w-7 text-[var(--bk-console-text-subtle)]" />
                <p className="mt-2 text-caption font-semibold text-[var(--bk-console-text)]">Waiting for trend data</p>
                <p className="mt-1 text-[11px] text-[var(--bk-console-text-muted)]">Event activity will appear after tracking begins.</p>
              </div>
            </div>
          )}
        </div>
        {chartData.length > 0 && (
          <p className="mt-[9px] text-[11px] text-[var(--bk-console-text-muted)]">
            Events received per day · {trendTotal.toLocaleString()} in the {windowLabel.toLowerCase()}
            {trendPeakLabel ? `, peak ${trendPeak.toLocaleString()} on ${trendPeakLabel}` : ''}
          </p>
        )}
      </div>
    </Card>
  );
}
