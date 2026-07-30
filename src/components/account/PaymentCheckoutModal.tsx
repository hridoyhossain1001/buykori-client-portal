import { ArrowRight, CheckCircle2, Clock3, Copy, Loader2, LockKeyhole, RotateCcw, ShieldAlert, Smartphone, X } from 'lucide-react';
import { Modal } from '../common/Modal';
import { PLAN_PRICING, type PaymentBrand, type PaymentIntent, type PaymentProvider, type PlanTier } from './accountTypes';

interface PaymentCheckoutModalProps {
  paymentPlan: PlanTier;
  onClose: () => void;
  paymentIntent: PaymentIntent | null;
  setPaymentIntent: (intent: PaymentIntent | null) => void;
  paymentProvider: PaymentProvider;
  setPaymentProvider: (provider: PaymentProvider) => void;
  paymentBrand: PaymentBrand;
  paymentExpired: boolean;
  paymentSecondsLeft: number;
  paymentSender: string;
  setPaymentSender: (value: string) => void;
  paymentSenderValid: boolean;
  paymentTrxId: string;
  setPaymentTrxId: (value: string) => void;
  paymentBusy: boolean;
  paymentFeedback: string;
  setPaymentFeedback: (value: string) => void;
  paymentQrUrl: string | null;
  createPayment: () => Promise<void>;
  submitExpiredPaymentForReview: () => Promise<void>;
}

export function PaymentCheckoutModal({
  paymentPlan,
  onClose,
  paymentIntent,
  setPaymentIntent,
  paymentProvider,
  setPaymentProvider,
  paymentBrand,
  paymentExpired,
  paymentSecondsLeft,
  paymentSender,
  setPaymentSender,
  paymentSenderValid,
  paymentTrxId,
  setPaymentTrxId,
  paymentBusy,
  paymentFeedback,
  setPaymentFeedback,
  paymentQrUrl,
  createPayment,
  submitExpiredPaymentForReview,
}: PaymentCheckoutModalProps) {
  return (
    <Modal
      onClose={onClose}
      ariaLabel="Plan payment"
      overlayClassName="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      panelClassName="relative max-h-[100dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:h-[min(660px,calc(100dvh-2rem))] sm:rounded-2xl"
      panelStyle={paymentIntent ? { background: `linear-gradient(145deg, #ffffff 0%, ${paymentBrand.soft} 100%)` } : undefined}
    >
        {paymentIntent && <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at 12% 12%, ${paymentBrand.soft}, transparent 30%), radial-gradient(circle at 88% 86%, ${paymentBrand.soft}, transparent 34%)` }} />}
        <div className="sticky top-0 z-20 flex items-start justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: paymentIntent ? paymentBrand.primary : '#4f46e5' }}>Secure manual payment</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">Pay for {PLAN_PRICING[paymentPlan].label}</h3>
          </div>
          <div className="flex items-start gap-3">
            {paymentIntent && (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full p-1 shadow-[0_0_20px_rgba(139,92,246,.25)]"
                style={{ background: paymentExpired ? '#e2e8f0' : `conic-gradient(${paymentBrand.primary} ${Math.min(100, (paymentSecondsLeft / 300) * 100)}%, #e2e8f0 0)`, boxShadow: `0 0 22px ${paymentBrand.soft}` }}
              >
                <div className={`flex h-full w-full items-center justify-center rounded-full border border-slate-200 bg-white font-mono font-black ${paymentExpired ? 'text-[9px] uppercase tracking-wide text-rose-600' : 'text-xs text-slate-900'}`}>
                  {paymentExpired ? 'Expired' : `${String(Math.floor(paymentSecondsLeft / 60)).padStart(2, '0')}:${String(paymentSecondsLeft % 60).padStart(2, '0')}`}
                </div>
              </div>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close payment">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          {!paymentIntent ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-emerald-50/60 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] text-emerald-700"><LockKeyhole className="h-3 w-3" /> Secure checkout</span>
                    <h4 className="mt-3 text-xl font-black text-slate-950">{PLAN_PRICING[paymentPlan].label}</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{PLAN_PRICING[paymentPlan].events} · Cancel anytime</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Plan total</p>
                    <p className="mt-1 text-lg font-black text-blue-700">{PLAN_PRICING[paymentPlan].price}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-blue-100/80 pt-3 text-xs font-semibold text-slate-600">
                  <ShieldAlert className="h-4 w-4 text-emerald-600" /> Your plan changes only after payment verification.
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[.13em] text-slate-600">1. Select payment method</p>
                  <span className="text-[11px] font-semibold text-slate-400">Personal account</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                {([
                  { id: 'bkash' as const, name: 'bKash', color: '#E2136E', soft: '#FFF1F7', logo: '/payment-providers/bkash.svg' },
                  { id: 'nagad' as const, name: 'Nagad', color: '#D8292F', soft: '#FFF4ED', logo: '/payment-providers/nagad.svg' },
                ]).map((provider) => {
                  const selected = paymentProvider === provider.id;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setPaymentProvider(provider.id)}
                      className="relative overflow-hidden rounded-2xl border-2 px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                      style={{ borderColor: selected ? '#2563eb' : '#e2e8f0', background: selected ? '#eff6ff' : '#ffffff', boxShadow: selected ? '0 8px 24px rgba(37,99,235,.12)' : undefined }}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-3">
                          <span className="flex h-11 w-16 items-center justify-center rounded-xl border border-slate-100 bg-white px-2 shadow-sm"><img src={provider.logo} alt={`${provider.name} logo`} className="max-h-8 w-full object-contain" /></span>
                          <span><span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Pay with</span><span className="mt-0.5 block text-sm font-black" style={{ color: provider.color }}>{provider.name}</span></span>
                        </span>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border" style={{ borderColor: selected ? '#2563eb' : '#cbd5e1', background: selected ? '#2563eb' : '#ffffff' }}>
                          {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                        </span>
                      </span>
                    </button>
                  );
                })}
                </div>
              </div>
              <label className="block rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <span className="mb-2 block text-xs font-black uppercase tracking-[.13em] text-slate-600">2. Your {paymentBrand.name} number</span>
                <span className="relative block">
                  <Smartphone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={paymentSender} maxLength={11} onChange={(event) => setPaymentSender(event.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="numeric" autoComplete="tel" placeholder="01XXXXXXXXX" className={`w-full rounded-xl border bg-white py-3.5 pl-10 pr-4 text-sm font-bold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:ring-2 ${paymentSender && !paymentSenderValid ? 'border-rose-300 focus:ring-rose-100' : 'border-slate-200 focus:border-blue-500 focus:ring-blue-100'}`} />
                </span>
                <span className={`mt-2 block text-xs leading-relaxed ${paymentSender && !paymentSenderValid ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>{paymentSender && !paymentSenderValid ? 'Enter a valid 11-digit Bangladesh mobile number.' : 'Use the number that will appear in the payment SMS.'}</span>
              </label>
              <button type="button" disabled={paymentBusy || !paymentSenderValid} onClick={createPayment} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-emerald-600 px-4 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none">
                {paymentBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing checkout...</> : <>Continue to payment <ArrowRight className="h-4 w-4" /></>}
              </button>
              <div className="flex items-center justify-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-400"><span className="flex items-center gap-1"><LockKeyhole className="h-3 w-3" /> Encrypted</span><span>•</span><span>Auto verified</span><span>•</span><span>5 min session</span></div>
            </>
          ) : paymentExpired ? (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50/80 to-white p-5 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-amber-100 text-amber-700 shadow-lg">
                <Clock3 className="h-8 w-8" />
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-rose-600">Payment session expired</p>
              <h4 className="mt-2 text-xl font-black text-slate-900">Your 5-minute payment window ended</h4>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                আপনি যদি পেমেন্ট করে থাকেন আর রেফার আইডি দিতে ভুল করে থাকেন বা মিস করে থাকেন, তবে নিচে আপনার ট্রানজেকশন আইডি (TrxID) বসিয়ে <strong>Continue (কন্টিনিউ)</strong> চাপুন।
              </p>
              <div className="mx-auto mt-4 flex max-w-sm items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
                <span><span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Expected reference</span><span className="mt-1 block font-mono text-lg font-black text-slate-900">{paymentIntent.paymentReference || 'N/A'}</span></span>
                <img src={`/payment-providers/${paymentProvider}.svg`} alt={`${paymentBrand.name} logo`} className="h-10 w-20 object-contain" />
              </div>
              <div className="mx-auto mt-4 max-w-sm text-left">
                <label htmlFor="expired-payment-trxid" className="mb-2 block text-xs font-black uppercase tracking-wide text-slate-600">Submit your transaction ID</label>
                <input id="expired-payment-trxid" value={paymentTrxId} maxLength={24} onChange={(event) => setPaymentTrxId(event.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())} placeholder="Example: DG765H4K9Q" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 font-mono text-sm font-bold uppercase text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                <p className="mt-2 text-xs leading-relaxed text-slate-500">We will match this TrxID with your sender number and payment amount. Your plan changes only after verification.</p>
                <button type="button" disabled={paymentBusy || paymentTrxId.trim().length < 6} onClick={submitExpiredPaymentForReview} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-700 to-emerald-600 px-4 py-3.5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400">
                  {paymentBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</> : <>Submit for verification <ArrowRight className="h-4 w-4" /></>}
                </button>
              </div>
              <button
                type="button"
                disabled={paymentBusy}
                onClick={() => {
                  setPaymentTrxId('');
                  setPaymentFeedback('');
                  void createPayment();
                }}
                className="mx-auto mt-5 flex w-full max-w-sm items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:opacity-60"
                style={{ background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})`, boxShadow: `0 10px 24px ${paymentBrand.primary}30` }}
              >
                <RotateCcw className={`h-4 w-4 ${paymentBusy ? 'animate-spin' : ''}`} />
                {paymentBusy ? 'Starting a new session...' : 'Start payment again'}
              </button>
              <button type="button" onClick={() => setPaymentIntent(null)} className="mt-2 text-xs font-bold text-slate-500 hover:text-slate-800">Change payment details</button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-2xl border p-4 text-white shadow-lg" style={{ borderColor: `${paymentBrand.primary}55`, background: `linear-gradient(135deg, ${paymentBrand.primary}, ${paymentBrand.secondary})` }}>
                    <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full border border-white/15 bg-white/10" />
                    <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-xl" />
                    <div className="flex items-start justify-between gap-3">
                      <div className="relative">
                        <span className="inline-flex items-center rounded-xl bg-white px-3 py-1.5 shadow-sm"><img src={`/payment-providers/${paymentProvider}.svg`} alt={`${paymentBrand.name} logo`} className="h-7 w-20 object-contain" /></span>
                        <p className="mt-1.5 text-xs font-semibold text-white/80 sm:mt-2">Send the exact payment to this number</p>
                        <p className="relative mt-2 font-mono text-2xl font-black tracking-[0.05em] text-white">{paymentIntent.receivingPhone}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button type="button" onClick={() => navigator.clipboard.writeText(paymentIntent.receivingPhone)} className="relative flex items-center gap-1 rounded-lg border border-white/60 bg-white px-2.5 py-1.5 text-xs font-bold shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50" style={{ color: paymentBrand.text }}><Copy className="h-3.5 w-3.5" /> Copy</button>
                        {paymentQrUrl && (
                          <div className="flex flex-col items-center rounded-xl border border-white/30 bg-white p-1 shadow-md">
                            <img src={paymentQrUrl} alt="Payment Number QR Code" className="h-14 w-14 rounded-md object-contain" />
                            <span className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-slate-700">Scan Number</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="relative mt-3 rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-xs leading-relaxed text-white">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-white/80">রেফারেন্স আইডি (Refer ID)</span>
                      <span className="font-mono text-xl font-black tracking-wider text-white">{paymentIntent.paymentReference || 'N/A'}</span>
                      <p className="mt-1 text-[11px] leading-relaxed text-white/95">
                        <strong>জরুরি নির্দেশাবলি:</strong> {paymentBrand.name} দিয়ে সেন্ড মানি/পেমেন্ট করার সময় <strong>Reference</strong> ফিল্ডে অবশ্যই <span className="rounded bg-white/30 px-1.5 py-0.5 font-mono text-xs font-black tracking-wide text-white underline">{paymentIntent.paymentReference || '1'}</span> এই রেফার আইডিটি বসাবেন।
                      </p>
                    </div>
                    <div className="relative mt-3 grid grid-cols-3 items-start rounded-lg border border-white/30 bg-white px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide shadow-sm" style={{ color: paymentBrand.text }}>
                      <span className="absolute left-[17%] right-[17%] top-[14px] h-0.5 rounded-full sm:top-[18px]" style={{ background: paymentBrand.primary }} />
                      <div className="relative"><span className="mx-auto mb-1.5 block h-3 w-3 rounded-full border-2" style={{ borderColor: paymentBrand.primary, background: paymentBrand.primary }} />Initiated</div>
                      <div className="relative"><span className="mx-auto mb-1.5 block h-3 w-3 rounded-full border-2 shadow-sm" style={{ borderColor: paymentBrand.primary, background: paymentBrand.primary, boxShadow: `0 0 10px ${paymentBrand.primary}66` }} />Send money</div>
                      <div className="relative"><span className="mx-auto mb-1.5 block h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: paymentBrand.primary, background: paymentIntent.status === 'pending' ? '#ffffff' : paymentBrand.primary }} />Confirmation</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-[.82fr_1.18fr]">
                  <div className="flex min-h-[150px] flex-col items-center justify-center overflow-hidden rounded-xl border px-3 py-4 text-center shadow-sm" style={{ borderColor: `${paymentBrand.primary}33`, background: `linear-gradient(145deg, #ffffff, ${paymentBrand.soft})` }}>
                    <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: paymentBrand.text }}>Pay exactly</p>
                    <p className="mt-1.5 text-3xl font-black tracking-tight" style={{ color: paymentBrand.primary }}>৳{paymentIntent.totalAmount}</p>
                    <div className="mt-2.5 h-px w-14 sm:mt-4 sm:w-16" style={{ background: `${paymentBrand.primary}55` }} />
                    <p className="mt-2.5 max-w-xs text-[10px] font-semibold leading-relaxed" style={{ color: paymentBrand.text }}>Send this exact amount for automatic verification.</p>
                  </div>

                <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-700">Automatic verification</p>
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-slate-600">Include reference <span className="font-mono font-bold text-slate-900">{paymentIntent.paymentReference || '1'}</span>. No TrxID is needed now.</p>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50/90 px-2.5 py-2 text-[10px] font-semibold leading-relaxed text-emerald-800 shadow-xs">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
                    <span>লাইভ ডিটেকশন চালু—প্রতি ৩ সেকেন্ডে পেমেন্ট যাচাই হচ্ছে...</span>
                  </div>
                  {paymentFeedback && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold leading-relaxed text-blue-700">
                      <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      <span>{paymentFeedback}</span>
                    </div>
                  )}
                  <div className="mt-auto pt-2">
                    <button type="button" onClick={() => setPaymentIntent(null)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900">Change details</button>
                  </div>
                </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <span>Reference code: {paymentIntent.paymentReference || 'N/A'}</span>
                <button type="button" onClick={() => navigator.clipboard.writeText(paymentIntent.paymentReference || paymentIntent.reference)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Copy payment reference"><Copy className="h-3 w-3" /></button>
              </div>
            </>
          )}
        </div>
    </Modal>
  );
}

export default PaymentCheckoutModal;
