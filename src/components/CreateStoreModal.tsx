import React, { useState } from 'react';
import { X, Store, Globe, Loader2, Check, AlertCircle } from 'lucide-react';

interface CreateStoreModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showToast: (msg: string, isErr?: boolean) => void;
}

export function CreateStoreModal({ open, onClose, onCreated, showToast }: CreateStoreModalProps) {
  const [businessName, setBusinessName] = useState('');
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<{ title: string; message: string } | null>(null);

  const handleCreate = async () => {
    if (!businessName.trim()) {
      setInlineError({
        title: 'Store name required',
        message: 'Please enter a Business / Store Name before creating the store.',
      });
      return;
    }
    setInlineError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/create-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: businessName.trim(), domain: domain.trim() || null }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Store "${businessName}" created! Switching...`, false);
        setBusinessName('');
        setDomain('');
        setInlineError(null);
        onCreated();
        onClose();
      } else {
        const message = data.detail || 'Failed to create store. Please try again.';
        setInlineError({
          title: res.status === 403 ? 'Store limit reached' : 'Could not create store',
          message,
        });
        showToast(message, true);
      }
    } catch {
      const message = 'Network error. Please check your connection and try again.';
      setInlineError({ title: 'Connection problem', message });
      showToast(message, true);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center">
              <Store className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white">Add New Store</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Create a new workspace for another business</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {inlineError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/30"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <div className="space-y-1">
                <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
                  {inlineError.title}
                </p>
                <p className="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300">
                  {inlineError.message}
                </p>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
            <Check className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
              নতুন store তৈরি হলে আপনাকে automatically ওই store-এ switch করা হবে। আপনার password একই থাকবে — নতুন login করতে হবে না।
            </p>
          </div>

          {/* Business Name */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Business / Store Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Store className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={businessName}
                onChange={e => {
                  setBusinessName(e.target.value);
                  setInlineError(null);
                }}
                placeholder="e.g. My Fashion Store"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-slate-800 dark:text-white transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {/* Domain (optional) */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Website Domain <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={domain}
                onChange={e => {
                  setDomain(e.target.value);
                  setInlineError(null);
                }}
                placeholder="e.g. myfashionstore.com"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-slate-800 dark:text-white transition-all"
                disabled={loading}
              />
            </div>
            <p className="text-[10px] text-slate-400">Later-এ Settings থেকে domain, pixel ID সব configure করতে পারবেন।</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !businessName.trim()}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 rounded-lg transition-all shadow-md shadow-indigo-500/15 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Store className="w-3.5 h-3.5" />
                Create Store
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
