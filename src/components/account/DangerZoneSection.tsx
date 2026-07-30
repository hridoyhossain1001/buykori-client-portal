import { Info, KeyRound, Trash2, X } from 'lucide-react';
import type { ClientConnection } from '../../types';

interface DangerZoneSectionProps {
  connection: ClientConnection | null;
  confirmRevokeText: string;
  setConfirmRevokeText: (v: string) => void;
  handleTokenRevoke: () => Promise<void>;
  confirmDeleteText: string;
  setConfirmDeleteText: (v: string) => void;
  handleDeleteAccountRequest: () => void;
}

export function DangerZoneSection({
  connection,
  confirmRevokeText,
  setConfirmRevokeText,
  handleTokenRevoke,
  confirmDeleteText,
  setConfirmDeleteText,
  handleDeleteAccountRequest,
}: DangerZoneSectionProps) {
  const maskedConnectionKey = connection?.api_key
    ? `${connection.api_key.slice(0, 7)}••••${connection.api_key.slice(-4)}`
    : 'Not available';

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-700"><KeyRound className="h-4 w-4" /></span>
            <div><h3 className="text-sm font-bold text-slate-900">Rotate plugin connection key</h3><p className="mt-0.5 text-xs text-slate-500">Maintenance action—reversible, but tracking pauses briefly.</p></div>
          </div>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">Caution</span>
        </div>
        <div className="space-y-4 p-5">
          <p className="max-w-2xl text-xs leading-relaxed text-slate-600">Generates a new connection key for your WordPress plugin. The old key stops working immediately, so tracking pauses until you paste the new key into the plugin.</p>
          <div className="space-y-2 text-xs text-slate-600">
            <p className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-slate-400" /> Current key <code className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px]">{maskedConnectionKey}</code></p>
            <p className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-slate-400" /> Tracking pauses until the new key is saved in WordPress.</p>
            <p className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-slate-400" /> Event history and settings are not affected.</p>
          </div>
          <div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input type="text" autoComplete="off" placeholder="Type REVOKE to confirm" value={confirmRevokeText} onChange={event => setConfirmRevokeText(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100 sm:max-w-xs" />
              <button type="button" disabled={confirmRevokeText.toUpperCase() !== 'REVOKE'} onClick={handleTokenRevoke} className="min-h-10 rounded-lg bg-amber-600 px-4 text-xs font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Rotate key</button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">The button unlocks after you type <code className="rounded bg-slate-100 px-1 font-mono">REVOKE</code>.</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-rose-200 bg-rose-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600"><Trash2 className="h-4 w-4" /></span>
            <div><h3 className="text-sm font-bold text-slate-900">Delete account</h3><p className="mt-0.5 text-xs text-slate-500">Permanent—Buykori support confirms with you before anything is removed.</p></div>
          </div>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-600">Irreversible</span>
        </div>
        <div className="space-y-4 p-5">
          <p className="max-w-2xl text-xs leading-relaxed text-slate-600">Sends a deletion request to Buykori support. Nothing is removed right away—our team contacts you to confirm the request.</p>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex gap-2"><X className="mt-0.5 h-3.5 w-3.5 text-slate-400" /> All stores, event history and courier data are permanently deleted.</li>
            <li className="flex gap-2"><X className="mt-0.5 h-3.5 w-3.5 text-slate-400" /> Meta, TikTok and GA4 connections are disconnected.</li>
            <li className="flex gap-2"><X className="mt-0.5 h-3.5 w-3.5 text-slate-400" /> Remaining plan time is not refundable.</li>
          </ul>
          <div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input type="text" autoComplete="off" placeholder="Type DELETE to confirm" value={confirmDeleteText} onChange={event => setConfirmDeleteText(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100 sm:max-w-xs" />
              <button type="button" disabled={confirmDeleteText.toUpperCase() !== 'DELETE'} onClick={handleDeleteAccountRequest} className="min-h-10 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">Submit deletion request</button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-400">You’ll receive confirmation before anything is deleted.</p>
          </div>
        </div>
      </section>
    </>
  );
}

export default DangerZoneSection;
