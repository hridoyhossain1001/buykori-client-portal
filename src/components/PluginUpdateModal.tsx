import React from 'react';
import { ArrowRight, ExternalLink, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Button } from './common/Button';
import { Modal } from './common/Modal';

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
  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="plugin-update-title"
      overlayClassName="bk-plugin-update-overlay fixed inset-0 z-[90] flex items-center justify-center px-4 py-6"
      panelClassName="bk-plugin-update-modal w-full max-w-md overflow-hidden bg-white"
    >
        <div className="bk-plugin-update-header relative px-5 py-4 text-white">
          <Button
            variant="icon"
            size="lg"
            onClick={onClose}
            className="absolute right-3 top-3 text-indigo-100 hover:bg-white/15 hover:text-white"
            aria-label="Close plugin update reminder"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <RefreshCw className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">WordPress plugin update</p>
              <h2 id="plugin-update-title" className="mt-0.5 text-base font-black leading-snug">A new Buykori AdSync version is ready</h2>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 p-5">
          <p className="text-[13px] leading-5 text-slate-600">
            Update Buykori AdSync to keep tracking and connection checks working correctly.
          </p>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Installed</span>
              <strong className="mt-0.5 block text-sm text-slate-700">v{installedVersion}</strong>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300" />
            <div className="min-w-0 text-right">
              <span className="text-xs font-bold uppercase tracking-wide text-indigo-500">Latest</span>
              <strong className="mt-0.5 block text-sm text-indigo-700">v{latestVersion}</strong>
            </div>
          </div>

          <div className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-xs leading-5 text-slate-700">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <div>
              Open WordPress <strong>Plugins</strong> and click <strong>Update now</strong> beside Buykori AdSync.
              {siteHost ? <span className="mt-0.5 block text-xs font-semibold text-indigo-700">Store: {siteHost}</span> : null}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              className="text-xs text-slate-600"
            >
              Remind me later
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onOpenWordPress}
              className="bk-plugin-update-primary text-xs"
            >
              Open WordPress Plugins
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
    </Modal>
  );
}
