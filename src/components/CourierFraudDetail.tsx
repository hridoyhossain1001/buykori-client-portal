import { AlertTriangle, ChevronDown, Loader2, Search } from 'lucide-react';
import type { DeferredOrder } from '../types';
import { FraudVerdictBadge, getFraudVerdictKey, hasCourierData } from './FraudVerdictBadge';

type CourierSummary = NonNullable<NonNullable<DeferredOrder['fraudDetails']>['courier_summary']>;
type CourierProvider = CourierSummary['providers'][number];

const PROVIDER_LABELS: Record<string, string> = {
  redx: 'RedX',
  pathao: 'Pathao',
  steadfast: 'SteadFast',
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider.toLowerCase()] || provider;
}

/**
 * "Fraud check" pill. Shown until a lookup has run for the order.
 *
 * The label deliberately says "Fraud check" rather than "Check courier history":
 * that is what merchants here call a courier delivery-history lookup by phone
 * number, so it is the wording they recognise. The panel that opens afterwards
 * names RedX and Pathao explicitly, so the detail stays precise.
 *
 * Two heights, both taken from the prototype: `.cod-fraud-cell .p-button` is
 * 32px, because inside a desktop table cell a 44px box breaks the row rhythm,
 * and `.cod-mobile-reason .p-button` is 44px, because on a phone this is a thumb
 * target. `btn-touch-expand` carries the desktop hit area past 44px without
 * moving anything on screen, which is how the portal already handles in-row
 * controls (docs/UI_AUDIT_CONTRACT.md D2).
 *
 * `compact` is for the Orders table, whose rows are denser still; it keeps the
 * 9px pill and relies on the same hit-area growth.
 */
export function CourierCheckButton({
  onClick,
  busy = false,
  compact = false,
  label = 'Fraud check',
}: {
  onClick: () => void;
  busy?: boolean;
  compact?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`btn-touch-expand inline-flex items-center justify-center whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 font-bold text-blue-700 transition hover:bg-blue-100 disabled:cursor-wait disabled:opacity-70 ${
        compact ? 'gap-1 px-2 py-0.5 text-[9px]' : 'min-h-11 gap-1.5 px-2.5 py-1 text-xs md:min-h-8'
      }`}
    >
      {busy ? (
        <Loader2 className={`animate-spin ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`} aria-hidden="true" />
      ) : (
        <Search className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden="true" />
      )}
      {busy ? 'Checking…' : label}
    </button>
  );
}

/**
 * The "Fraud risk" cell: the verdict badge once a courier lookup has run (click to
 * open the per-courier breakdown), otherwise the "Fraud check" button.
 * Courier data is only fetched on request, so most orders start with the button.
 */
export function FraudRiskCell({
  order,
  expanded,
  onToggle,
  onCheck,
  busy,
  compact = false,
}: {
  order: DeferredOrder;
  expanded: boolean;
  onToggle: () => void;
  onCheck: () => void;
  busy: boolean;
  compact?: boolean;
}) {
  if (hasCourierData(order.fraudDetails)) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        title="Show courier delivery history"
        className="btn-touch-expand inline-flex items-center gap-1"
      >
        <FraudVerdictBadge details={order.fraudDetails} score={order.fraudScore} compact={compact} />
        <ChevronDown
          className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <span className={`inline-flex flex-wrap items-center ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {/* Velocity / gibberish-name checks are local and always run, so an order can
          already be flagged before anyone looks up its courier history. */}
      {getFraudVerdictKey(order.fraudDetails, order.fraudScore) !== 'NOT_CHECKED' && (
        <FraudVerdictBadge details={order.fraudDetails} score={order.fraudScore} compact={compact} />
      )}
      <CourierCheckButton onClick={onCheck} busy={busy} compact={compact} />
    </span>
  );
}

function providerLine(entry: CourierProvider): string {
  if (entry.status === 'new') return 'New customer (no delivery history)';
  if (entry.status === 'failed' || entry.status === 'config_error') {
    return entry.status === 'config_error' ? 'Not connected' : 'Could not be reached';
  }

  const parts: string[] = [];
  if (entry.total > 0) {
    parts.push(`${entry.total} ${entry.total === 1 ? 'parcel' : 'parcels'}`);
    parts.push(`${entry.delivered} delivered`);
    parts.push(`${entry.cancelled} cancelled`);
    if (entry.success_ratio != null) parts.push(`${entry.success_ratio}% success`);
  } else {
    parts.push('No delivery history');
  }
  // Pathao reports a rating instead of counts, so surface whichever it sent.
  if (entry.rating) parts.push(`rating: ${entry.rating}`);
  else if (entry.segment) parts.push(entry.segment);
  return parts.join(' · ');
}

/**
 * The per-courier breakdown behind the fraud badge. Only rendered once a lookup
 * has run — `courier_summary` is null until a merchant clicks the check button.
 *
 * When a courier failed, the result is incomplete, so `onRecheck` puts the retry
 * right next to the warning that asks for it. Both extra props are optional so a
 * read-only use of the panel stays valid.
 */
export function CourierDetailPanel({
  summary,
  onRecheck,
  busy = false,
}: {
  summary: CourierSummary;
  onRecheck?: () => void;
  busy?: boolean;
}) {
  const providers = summary.providers || [];
  const failed = summary.failed || [];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700">
      <div className="space-y-1.5">
        {providers.length === 0 ? (
          <p className="text-slate-500">No courier responded to this check.</p>
        ) : (
          providers.map((entry) => (
            <div key={entry.provider} className="flex flex-wrap items-baseline gap-x-2">
              <span className="w-20 shrink-0 font-bold text-slate-900">{providerLabel(entry.provider)}</span>
              <span
                className={
                  entry.status === 'failed' || entry.status === 'config_error'
                    ? 'text-amber-700'
                    : 'text-slate-600'
                }
              >
                {providerLine(entry)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 border-t border-slate-200 pt-2.5">
        <span className="w-20 shrink-0 font-bold text-slate-900">Combined</span>
        <span className="text-slate-600">
          {summary.total_orders > 0
            ? `${summary.total_orders} total · ${summary.total_delivered} delivered · ${summary.total_cancelled} cancelled`
            : 'No delivery history found'}
          {` · trust ${summary.trust_score}/100 · confidence ${summary.confidence}`}
        </span>
      </div>

      {failed.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
            {failed.map(providerLabel).join(', ')} unavailable — check again for a complete result.
          </p>
          {onRecheck && <CourierCheckButton onClick={onRecheck} busy={busy} compact label="Check again" />}
        </div>
      )}
    </div>
  );
}
