import { useEffect, useRef, useState } from 'react';
import { Cell, Funnel, FunnelChart, LabelList, Tooltip as RechartsTooltip } from 'recharts';
import { Filter } from 'lucide-react';
import { buildFunnelData, formatCount, formatPercent, hasFunnelVolume } from './aiAdsMetrics';
import {
  CHART_AXIS,
  CHART_TOOLTIP_STYLE,
  SERIES_BLUE,
  SERIES_BLUE_DEEP,
  SERIES_GREEN,
} from '../../lib/chartColors';
import type { PerformanceSnapshot } from '../../services/aiAdsApi';

/**
 * Reach and clicks step down through the blues, and the stage that earns money
 * lands on green. Shared with the stage rows below the chart, so the swatch
 * beside each number always matches its band.
 */
const STAGE_COLORS = [SERIES_BLUE_DEEP, SERIES_BLUE, SERIES_GREEN];

/**
 * The conversion funnel for a performance window: how many of the people the ads reached went on
 * to click, and how many of those went on to buy.
 *
 * Sizing follows the house chart convention (`dashboard/EventActivityChart.tsx`): a
 * `ResizeObserver` on the host element feeds explicit `width`/`height` into recharts rather than
 * using `ResponsiveContainer`.
 *
 * The stage rows under the chart are not decoration. A real ad funnel is routinely 1000:1 from
 * impressions to purchases, and a funnel band that narrow draws as a hairline — the taper tells
 * the story of the drop-off truthfully, but only the rows can be relied on to carry the actual
 * numbers. They also give screen readers the content, which the chart's SVG does not.
 */
/**
 * Where the stages came from, printed under the chart.
 *
 * The default describes the stored snapshot, whose impressions and clicks are the providers' but
 * whose purchases are counted from our own tracked events — which is why the last step can read
 * above 100% and look like a bug. The live Analytics panel feeds this chart the platform's own
 * three numbers instead, so it passes its own note; leaving the default there would tell the
 * merchant the purchases came from a pixel that, on some stores, has never fired.
 */
const DEFAULT_SOURCE_NOTE =
  'Impressions and clicks come from your connected ad accounts. Purchases come from your tracked '
  + 'events, so they can include sales that did not come from these ads.';

export function PerformanceFunnelChart({ snapshot, days, sourceNote = DEFAULT_SOURCE_NOTE }: { snapshot: PerformanceSnapshot | null; days: number; sourceNote?: string }) {
  const stages = buildFunnelData(snapshot);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 640, height: 240 });

  useEffect(() => {
    const host = hostRef.current;
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
    <section className="rounded-xl border border-[var(--bk-console-border)] bg-[var(--bk-console-surface)] p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bk-console-blue-soft)]">
          <Filter className="h-4 w-4 text-[var(--bk-console-blue)]" />
        </span>
        <div>
          <h3 className="text-base font-bold text-[var(--bk-console-text)]">Conversion funnel</h3>
          <p className="mt-0.5 text-xs text-[var(--bk-console-text-muted)]">
            From reach to purchase over the last {days} days
          </p>
        </div>
      </div>

      {/* The host stays mounted in both branches so the ResizeObserver always has an element. */}
      <div ref={hostRef} className="mt-4 h-[240px] min-w-0" aria-hidden="true">
        {hasFunnelVolume(stages) ? (
          <FunnelChart width={chartSize.width} height={chartSize.height} margin={{ top: 8, right: 108, left: 8, bottom: 8 }}>
            <RechartsTooltip
              formatter={(value: unknown) => formatCount(Number(value))}
              contentStyle={CHART_TOOLTIP_STYLE}
            />
            <Funnel dataKey="value" nameKey="stage" data={stages} isAnimationActive={false} lastShapeType="rectangle">
              {stages.map((stage, index) => (
                <Cell key={stage.stage} fill={STAGE_COLORS[index]} />
              ))}
              <LabelList dataKey="stage" position="right" fill={CHART_AXIS} stroke="none" fontSize={12} />
            </Funnel>
          </FunnelChart>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 text-center">
            <div>
              <Filter className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-bold text-slate-700">Waiting for ad delivery data</p>
              <p className="mt-1 text-xs text-slate-400">
                The funnel appears once impressions and clicks have synced from your ad accounts.
              </p>
            </div>
          </div>
        )}
      </div>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {stages.map((stage, index) => (
          <li key={stage.stage} className="rounded-lg border border-[var(--bk-console-border)] px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: STAGE_COLORS[index] }} />
              <p className="text-xs font-semibold text-[var(--bk-console-text-muted)]">{stage.stage}</p>
            </div>
            <p className="mt-1 text-lg font-bold text-[var(--bk-console-text)]">{formatCount(stage.value)}</p>
            <p className="text-[11px] text-[var(--bk-console-text-subtle)]">
              {stage.rate === null || stage.of === null
                ? 'Starting point'
                : `${formatPercent(stage.rate)} of ${stage.of}`}
            </p>
          </li>
        ))}
      </ol>

      {/* Without this the last step can read above 100% and look like a bug — see the note on
          `DEFAULT_SOURCE_NOTE`; the live panel supplies its own wording. */}
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--bk-console-text-subtle)]">
        {sourceNote}
      </p>
    </section>
  );
}
