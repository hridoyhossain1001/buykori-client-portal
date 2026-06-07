import React, { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';

function appendReturnParam(returnUrl: string, params: Record<string, string>) {
  const url = new URL(returnUrl);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

function normalizeHost(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

function safeCancelUrl(returnUrl: string, siteUrl: string, state: string) {
  const target = new URL(returnUrl);
  const site = new URL(siteUrl);
  const returnHost = normalizeHost(target.hostname);
  const siteHost = normalizeHost(site.hostname);
  const localHost = returnHost === 'localhost' || returnHost === '127.0.0.1';
  if (returnHost !== siteHost) {
    throw new Error('Return URL does not match this WordPress site.');
  }
  if (target.protocol !== 'https:' && !localHost) {
    throw new Error('Return URL must use HTTPS.');
  }
  return appendReturnParam(target.toString(), {
    error: 'access_denied',
    state,
  });
}

export function PluginConnectAuthorizeView() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const siteUrl = params.get('site_url') || '';
  const returnUrl = params.get('return_url') || '';
  const state = params.get('state') || '';
  const codeChallenge = params.get('code_challenge') || '';
  const siteHost = useMemo(() => {
    try {
      return new URL(siteUrl).hostname.replace(/^www\./, '');
    } catch {
      return siteUrl;
    }
  }, [siteUrl]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingParams = !siteUrl || !returnUrl || !state || !codeChallenge;

  const approve = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/plugin-connect/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          returnUrl,
          state,
          codeChallenge,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Could not authorize this WordPress connection.');
      }
      window.location.assign(data.redirectUrl);
    } catch (err: any) {
      setError(err.message || 'Authorization failed.');
      setSubmitting(false);
    }
  };

  const cancel = () => {
    if (!returnUrl) {
      window.location.assign('/');
      return;
    }
    try {
      window.location.assign(safeCancelUrl(returnUrl, siteUrl, state));
    } catch {
      window.location.assign('/?plugin_connect=cancelled');
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Connect WordPress Site</h1>
            <p className="text-sm text-slate-500">Authorize Buykori AdSync for this store.</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase text-slate-500">WordPress site</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900">{siteHost || 'Unknown site'}</p>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <div className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>Save the workspace API configuration inside the WordPress plugin.</span>
          </div>
          <div className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>Allow the plugin to send signed tracking events to Buykori.</span>
          </div>
        </div>

        {missingParams && (
          <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This connection request is incomplete. Start again from WordPress.</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={missingParams || submitting}
            onClick={approve}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-emerald-700 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Authorize
          </button>
        </div>
      </section>
    </main>
  );
}
