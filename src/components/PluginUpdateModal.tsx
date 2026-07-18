import React from 'react';
import { ArrowRight, ExternalLink, RefreshCw, ShieldCheck, X } from 'lucide-react';

interface PluginUpdateModalProps {
  open: boolean;
  installedVersion: string;
  latestVersion: string;
  siteHost?: string;
  onClose: () => void;
  onOpenWordPress: () => void;
}

export function PluginUpdateModal({
  open,
  installedVersion,
  latestVersion,
  siteHost,
  onClose,
  onOpenWordPress,
}: PluginUpdateModalProps) {
  if (!open) return null;

  return (
    <div
      className="bk-plugin-update-overlay fixed inset-0 z-[90] flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plugin-update-title"
    >
      <div className="bk-plugin-update-modal w-full max-w-md overflow-hidden bg-white">
        <div className="bk-plugin-update-header relative px-5 py-4 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-indigo-100 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="Close plugin update reminder"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <RefreshCw className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-100">WordPress plugin update</p>
              <h2 id="plugin-update-title" className="mt-0.5 text-base font-black leading-snug">A new version is ready</h2>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 p-5">
          <p className="text-[13px] leading-5 text-slate-600">
            Update Buykori AdSync to keep tracking and connection checks working correctly.
          </p>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Installed</span>
              <strong className="mt-0.5 block text-sm text-slate-700">v{installedVersion}</strong>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" />
            <div className="min-w-0 text-right">
              <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">Latest</span>
              <strong className="mt-0.5 block text-sm text-indigo-700">v{latestVersion}</strong>
            </div>
          </div>

          <div className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-xs leading-5 text-slate-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <div>
              Open WordPress <strong>Plugins</strong> and click <strong>Update now</strong> beside Buykori AdSync.
              {siteHost ? <span className="mt-0.5 block text-[11px] font-semibold text-indigo-700">Store: {siteHost}</span> : null}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Remind me later
            </button>
            <button
              type="button"
              onClick={onOpenWordPress}
              className="bk-plugin-update-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold text-white transition-colors"
            >
              Open WordPress Plugins
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
