import { CheckCircle2 } from 'lucide-react';
import { PlatformLogo } from '../common/PlatformLogo';
import { panelClass } from './dashboardUtils';
import type { PlatformRow } from './useDashboardMetrics';

interface TrackingHealthPanelProps {
  platformRows: PlatformRow[];
  setActivePage: (page: string) => void;
}

export function TrackingHealthPanel({ platformRows, setActivePage }: TrackingHealthPanelProps) {
  return (
    <section className={`${panelClass} p-5 xl:col-span-7`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950">Tracking health</h2>
          <p className="mt-1 text-xs text-slate-500">Platform delivery at a glance</p>
        </div>
        <button onClick={() => setActivePage('settings')} className="text-xs font-bold text-blue-700 hover:text-blue-800">Manage platforms</button>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
        {platformRows.map((row, index) => (
          <button key={row.label} onClick={() => setActivePage('event-logs')} className={`grid w-full grid-cols-[minmax(0,1.4fr)_70px_74px_24px] items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 sm:grid-cols-[minmax(0,1.5fr)_90px_90px_minmax(100px,1fr)_24px] ${index > 0 ? 'border-t border-slate-100' : ''}`}>
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50"><PlatformLogo platform={row.platform} className="h-5 w-5" /></span>
              <strong className="truncate text-sm text-slate-900">{row.label}</strong>
            </span>
            <span><strong className={`block text-sm ${row.total > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{row.total > 0 ? `${row.rate}%` : '—'}</strong><small className="text-[10px] text-slate-400">{row.total > 0 ? 'Healthy' : 'Waiting'}</small></span>
            <span><strong className="block text-sm text-slate-800">{row.total.toLocaleString()}</strong><small className="text-[10px] text-slate-400">Events</small></span>
            <span className="hidden text-xs text-slate-500 sm:block">Last sync<br /><span className="font-mono text-[10px] text-slate-400">{row.lastTime || 'Waiting'}</span></span>
            <CheckCircle2 className={`h-4 w-4 ${row.total > 0 ? 'text-emerald-500' : 'text-slate-300'}`} />
          </button>
        ))}
      </div>
    </section>
  );
}
