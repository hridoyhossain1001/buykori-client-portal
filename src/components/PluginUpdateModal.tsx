import React from 'react';
import { ExternalLink, RefreshCw, X } from 'lucide-react';

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
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plugin-update-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-5 text-white">
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
              <h2 id="plugin-update-title" className="mt-1 text-lg font-black">A new Buykori AdSync version is ready</h2>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm leading-6 text-slate-600">
            Please update the plugin from your WordPress dashboard to keep event tracking, connection checks, and new fixes working correctly.
          </p>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Installed</span>
              <strong className="mt-1 block text-sm text-slate-700">v{installedVersion}</strong>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">Latest</span>
              <strong className="mt-1 block text-sm text-indigo-700">v{latestVersion}</strong>
            </div>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
            Open WordPress, go to <strong>Plugins</strong>, then click <strong>Update now</strong> beside Buykori AdSync.
            {siteHost ? <span className="mt-1 block text-amber-700">Website: {siteHost}</span> : null}
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
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700"
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
