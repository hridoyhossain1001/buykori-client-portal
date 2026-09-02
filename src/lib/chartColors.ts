/**
 * The chart palette.
 *
 * Chart colours cannot come from the Tailwind token layer the way the rest of
 * the portal's colours do: recharts writes them out as SVG presentation
 * attributes (`stroke="..."`, `fill="..."`), and `var()` is not substituted in
 * those. So they are declared twice on purpose - as a `--color-chart-*` family
 * in src/index.css, for the handful of places that need a Tailwind class
 * (gradient stops, bar fills), and as the plain values below, for everything
 * recharts draws.
 *
 * Those two copies must be kept in sync by hand. src/lib/designTokens.test.ts
 * asserts every constant here equals its --color-* token, so a change to one
 * without the other fails the suite rather than shipping a chart whose legend
 * does not match its line.
 *
 * Every value below is copied from the prototype's own chart rules in
 * ui-ux-audit-prototype/portal.css:
 *
 *   .chart-bars i        { background:#4a83be }              -> SERIES_BLUE
 *   .chart-bars.green i  { background:#3c9b82 }              -> SERIES_GREEN
 *   .chart-bars          { border-bottom:1px solid #e1e6e8 } -> CHART_GRID
 *   .chart-axis,
 *   .chart-scale         { color:#5b6a74 }                   -> CHART_AXIS
 *   .progress-ring       { border:4px solid #d8eee8;
 *                          border-top-color:var(--accent) }  -> RING_TRACK / RING_FILL
 *
 * Two distinct jobs, and they do not share colours:
 *
 *   - A multi-series chart compares quantities. Its series use SERIES_*, never
 *     the accent. The accent teal (--bk-accent, #176b5b) sits only 0.152 from
 *     the success green in OKLab, so an accent-plus-green chart reads as two
 *     shades of one colour. The prototype keeps a separate blue for data.
 *   - A progress ring or donut shows one percentage. It has no second series to
 *     be confused with, so it uses RING_FILL (the accent) on RING_TRACK, exactly
 *     as .progress-ring does.
 *
 * Any new series colour must stay at least 0.06 OKLab from every other series in
 * the same chart, and reach 3.0:1 against the panel behind it (WCAG non-text).
 * src/lib/designTokens.test.ts asserts all of this, and will also refuse a new
 * export it has not been told how to check.
 */

/** Primary data series - counts, volume, "what came in". */
export const SERIES_BLUE = '#4a83be';

/** Secondary data series - the outcome that matters: delivered, converted, paid. */
export const SERIES_GREEN = '#3c9b82';

/** Deepest step of a sequential (funnel) ramp, drawn before SERIES_BLUE. */
export const SERIES_BLUE_DEEP = '#265b84';

/** Series colour for the dark mobile cards, where SERIES_GREEN is too dim. */
export const SERIES_GREEN_ON_DARK = '#7ead95';

/** Gridlines and axis rules. */
export const CHART_GRID = '#e1e6e8';

/** Axis tick labels. These are text, so they meet 4.5:1 - matches --bk-muted. */
export const CHART_AXIS = '#5b6a74';

/** Unfilled part of a progress ring or single-value donut. */
export const RING_TRACK = '#d8eee8';

/** Filled part of a progress ring or single-value donut - the accent. */
export const RING_FILL = '#176b5b';

/** Shared recharts tooltip chrome, so every chart's tooltip looks the same. */
export const CHART_TOOLTIP_STYLE = {
  borderRadius: 12,
  borderColor: '#dfe4e6',
  boxShadow: '0 12px 30px rgba(25, 39, 51, 0.09)',
  fontSize: 12,
} as const;
