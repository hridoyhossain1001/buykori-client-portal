import { CheckCircle2, ArrowRight, ReceiptText } from 'lucide-react';

export function OrderSuccessView() {
  const reference = decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || '');

  return (
    <section className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-xl shadow-emerald-100/60 sm:p-10">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-emerald-600">Payment confirmed</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Your payment was successful</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
          Your payment matched automatically. Your plan is now being updated.
        </p>
        {reference && (
          <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-xs font-bold text-slate-600">
            <ReceiptText className="h-4 w-4 text-emerald-600" />
            Reference: {reference}
          </div>
        )}
        <button
          type="button"
          onClick={() => window.location.assign('/account')}
          className="mx-auto mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
        >
          Open account
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
