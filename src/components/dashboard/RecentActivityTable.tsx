import { ArrowRight, CheckCircle2, PackageCheck } from 'lucide-react';
import type { CAPIEvent } from '../../types';
import { PlatformLogo } from '../common/PlatformLogo';
import { eventContext, panelClass } from './dashboardUtils';

const HEAD_CELL = 'px-5 py-3';

interface RecentActivityTableProps {
  recentEvents: CAPIEvent[];
  setActivePage: (page: string) => void;
}

export function RecentActivityTable({ recentEvents, setActivePage }: RecentActivityTableProps) {
  return (
    <section className={`${panelClass} overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-slate-950">Recent activity</h2>
          <p className="mt-1 text-xs text-slate-500">Latest tracking events from your store</p>
        </div>
        <button onClick={() => setActivePage('event-logs')} className="flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800">View all activity <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>
      {recentEvents.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50/80 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
              <tr><th className={HEAD_CELL}>Time</th><th className={HEAD_CELL}>Event</th><th className={HEAD_CELL}>Product / Page</th><th className={HEAD_CELL}>Platform</th><th className={HEAD_CELL}>Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentEvents.map(event => (
                <tr key={event.id} className="cursor-pointer hover:bg-slate-50/70" onClick={() => setActivePage('event-logs')}>
                  <td className="px-5 py-3 text-xs text-slate-500">{new Date(event.timestamp).toLocaleString()}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">{event.name}</td>
                  <td className="max-w-[260px] px-5 py-3 text-xs font-semibold text-slate-700"><span className="block truncate" title={eventContext(event)}>{eventContext(event)}</span></td>
                  <td className="px-5 py-3"><span className="flex items-center gap-2 text-xs font-semibold text-slate-700"><PlatformLogo platform={event.platform} className="h-4 w-4" />{event.platform}</span></td>
                  <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${event.status === 'Success' ? 'bg-emerald-50 text-emerald-700' : event.status === 'Retry' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}><CheckCircle2 className="h-3 w-3" />{event.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><PackageCheck className="h-5 w-5" /></span>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-800">No recent event logs</p>
              <p className="mt-1 text-xs text-slate-500">Your aggregate tracking data is available above. Send a test event to create a fresh log entry.</p>
            </div>
          </div>
          <button onClick={() => setActivePage('campaign-builder')} className="shrink-0 rounded-lg bg-[#285ac7] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#214fae]">Send test event</button>
        </div>
      )}
    </section>
  );
}
