import React, { useRef, useState } from 'react';
import { X, Store, Globe, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from './common/Button';
import { Modal } from './common/Modal';

interface CreateStoreModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  showToast: (msg: string, isErr?: boolean) => void;
}

export function CreateStoreModal({ open, onClose, onCreated, showToast }: CreateStoreModalProps) {
  const businessNameRef = useRef<HTMLInputElement>(null);
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="create-store-title"
      initialFocusRef={businessNameRef}
      closeOnBackdrop={!loading}
      overlayClassName="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      panelClassName="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up"
    >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 ">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100  flex items-center justify-center">
              <Store className="w-5 h-5 text-indigo-600 " />
            </div>
            <div>
              <h2 id="create-store-title" className="text-sm font-bold text-slate-800 ">Add New Store</h2>
              <p className="text-xs text-slate-400 ">Create a new workspace for another business</p>
            </div>
          </div>
          <Button
            variant="icon"
            size="lg"
            onClick={onClose}
            disabled={loading}
            aria-label="Close add store dialog"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {inlineError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5  "
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 " />
              <div className="space-y-1">
                <p className="text-xs font-bold text-rose-700 ">
                  {inlineError.title}
                </p>
                <p className="text-xs leading-relaxed text-rose-700 ">
                  {inlineError.message}
                </p>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50  border border-indigo-100 ">
            <Check className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
            <p className="text-xs text-indigo-700  leading-relaxed">
              নতুন store তৈরি হলে আপনাকে automatically ওই store-এ switch করা হবে। আপনার password একই থাকবে — নতুন login করতে হবে না।
            </p>
          </div>

          {/* Business Name */}
          <div className="space-y-1.5">
            <label htmlFor="create-store-business-name" className="block text-xs font-bold text-slate-500  uppercase tracking-wider">
              Business / Store Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Store className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                ref={businessNameRef}
                id="create-store-business-name"
                type="text"
                autoFocus
                value={businessName}
                onChange={e => {
                  setBusinessName(e.target.value);
                  setInlineError(null);
                }}
                placeholder="e.g. My Fashion Store"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50  border border-slate-200  rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-slate-800  transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {/* Domain (optional) */}
          <div className="space-y-1.5">
            <label htmlFor="create-store-domain" className="block text-xs font-bold text-slate-500  uppercase tracking-wider">
              Website Domain <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                id="create-store-domain"
                type="text"
                value={domain}
                onChange={e => {
                  setDomain(e.target.value);
                  setInlineError(null);
                }}
                placeholder="e.g. myfashionstore.com"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50  border border-slate-200  rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 text-slate-800  transition-all"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-slate-400">You can add or change this domain later.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100  flex gap-3 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleCreate}
            disabled={loading || !businessName.trim()}
            loading={loading}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 shadow-md shadow-indigo-500/15 hover:from-indigo-700 hover:to-violet-700"
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
          </Button>
        </div>
    </Modal>
  );
}
