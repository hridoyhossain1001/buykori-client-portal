import { Monitor, ShieldAlert } from 'lucide-react';

export function TwoStepVerificationCard() {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><ShieldAlert className="h-4 w-4" /></span>
        <div>
          <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-slate-900">Two-step verification</h3><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Off</span></div>
          <p className="mt-0.5 text-xs text-slate-500">Add a one-time code when signing in to protect your account and billing.</p>
        </div>
      </div>
      <button type="button" disabled title="Two-step verification is coming soon" className="min-h-10 shrink-0 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-600 disabled:cursor-not-allowed">Enable</button>
    </section>
  );
}

export function ActiveSessionsCard() {
  const browserName = /Edg/i.test(navigator.userAgent)
    ? 'Edge'
    : /Firefox/i.test(navigator.userAgent)
      ? 'Firefox'
      : /Chrome/i.test(navigator.userAgent)
        ? 'Chrome'
        : /Safari/i.test(navigator.userAgent)
          ? 'Safari'
          : 'Browser';
  const operatingSystem = /Windows/i.test(navigator.userAgent)
    ? 'Windows'
    : /Android/i.test(navigator.userAgent)
      ? 'Android'
      : /iPhone|iPad/i.test(navigator.userAgent)
        ? 'iOS'
        : /Mac/i.test(navigator.userAgent)
          ? 'macOS'
          : 'this device';

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Monitor className="h-4 w-4" /></span>
          <div><h3 className="text-sm font-bold text-slate-900">Active sessions</h3><p className="mt-0.5 text-xs text-slate-500">Devices currently signed in to this account.</p></div>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">1 device</span>
      </div>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Monitor className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-900">{browserName} on {operatingSystem}</p><p className="mt-0.5 text-[11px] text-slate-400">Current authenticated browser session</p></div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">This device</span>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-slate-400">Signing out ends dashboard access on that device only.</p>
        <button type="button" disabled title="No other active devices" className="min-h-10 rounded-lg border border-rose-200 bg-white px-4 text-xs font-bold text-rose-600 disabled:cursor-not-allowed disabled:opacity-50">Log out all other devices</button>
      </div>
    </section>
  );
}
