import { ChevronRight, Gauge, PackageCheck, ShieldCheck, ShoppingBag } from 'lucide-react';
import { panelClass, quotaTone } from './dashboardUtils';

const ROW = 'flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50';
const ROW_ICON = 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl';
const ROW_TITLE = 'block text-sm text-slate-900';
const ROW_SUBTITLE = 'mt-0.5 block text-xs text-slate-500';

interface ActionCenterProps {
  pendingOrderCount: number;
  openSuggestions: number;
  optScore: number;
  usagePercent: number;
  setActivePage: (page: string) => void;
}

export function ActionCenter({ pendingOrderCount, openSuggestions, optScore, usagePercent, setActivePage }: ActionCenterProps) {
  const tone = quotaTone(usagePercent);

  return (
    <section className={`${panelClass} p-5 xl:col-span-4`}>
      <div>
        <h2 className="text-base font-bold text-slate-950">Action center</h2>
        <p className="mt-1 text-xs text-slate-500">The next useful actions for your team</p>
      </div>
      <div className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
        {/* Quota pressure outranks everything else: once it is exhausted no other
            action matters, because nothing is being tracked. */}
        {tone !== 'ok' && (
          <button onClick={() => setActivePage('account')} className={ROW}>
            <span className={`${ROW_ICON} ${tone === 'exhausted' ? 'bg-rose-50 text-rose-600' : tone === 'critical' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
              <Gauge className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className={ROW_TITLE}>
                {tone === 'exhausted' ? 'Event limit reached — tracking paused' : `Event usage at ${usagePercent.toFixed(0)}%`}
              </strong>
              <span className={ROW_SUBTITLE}>
                {tone === 'exhausted' ? 'Upgrade your plan to resume tracking' : 'Review your plan before the limit is reached'}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </button>
        )}
        <button onClick={() => setActivePage('pending-purchases')} className={ROW}>
          <span className={`${ROW_ICON} ${pendingOrderCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <ShoppingBag className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className={ROW_TITLE}>{pendingOrderCount > 0 ? `${pendingOrderCount} COD orders need review` : 'COD review queue is clear'}</strong>
            <span className={ROW_SUBTITLE}>Confirm or skip pending purchase events</span>
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
        <button onClick={() => setActivePage('suggestions')} className={ROW}>
          <span className={`${ROW_ICON} ${openSuggestions > 0 ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-600'}`}>
            <PackageCheck className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className={ROW_TITLE}>{openSuggestions > 0 ? `${openSuggestions} setup items need attention` : 'Setup checklist complete'}</strong>
            <span className={ROW_SUBTITLE}>Review tracking recommendations</span>
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
        <button onClick={() => setActivePage('settings')} className={ROW}>
          <span className={`${ROW_ICON} bg-emerald-50 text-emerald-600`}>
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className={ROW_TITLE}>Tracking health {optScore}%</strong>
            <span className={ROW_SUBTITLE}>Check platform connections and delivery</span>
          </span>
          <ChevronRight className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </section>
  );
}
