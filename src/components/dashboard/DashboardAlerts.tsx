import { AlertTriangle, BookOpen, Send, Settings2 } from 'lucide-react';
import { panelClass } from './dashboardUtils';

interface DeliveryIssueAlertProps {
  serverAttempts: number;
  serverFailures: number;
  setActivePage: (page: string) => void;
}

export function DeliveryIssueAlert({ serverAttempts, serverFailures, setActivePage }: DeliveryIssueAlertProps) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-amber-950">Some events need attention</h2>
          <p className="mt-1 text-xs leading-5 text-amber-800">
            Buykori attempted {serverAttempts.toLocaleString()} deliveries and recorded {serverFailures.toLocaleString()} failures.
          </p>
        </div>
      </div>
      <button onClick={() => setActivePage('event-logs')} className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white hover:bg-amber-800">
        Review failed events
      </button>
    </section>
  );
}

const GETTING_STARTED_LINKS = [
  { label: 'Setup guide', icon: BookOpen, page: 'setup-guide' },
  { label: 'Connect store', icon: Settings2, page: 'settings' },
  { label: 'Send test event', icon: Send, page: 'campaign-builder' },
];

interface GettingStartedPanelProps {
  setActivePage: (page: string) => void;
}

export function GettingStartedPanel({ setActivePage }: GettingStartedPanelProps) {
  return (
    <section className={`${panelClass} border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 p-5`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Welcome to Buykori</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Connect your store and send the first event</h2>
          <p className="mt-1 text-sm text-slate-500">The dashboard will fill with real performance data as soon as tracking starts.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {GETTING_STARTED_LINKS.map(item => (
            <button key={item.label} onClick={() => setActivePage(item.page)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-blue-300 hover:text-blue-700">
              <item.icon className="h-4 w-4" /> {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
