import { CheckCircle2, Sparkles } from 'lucide-react';
import { Modal } from '../common/Modal';
import type { PaymentBrand, PaymentIntent, PaymentProvider } from './accountTypes';

interface PaymentSuccessModalProps {
  paymentSuccess: { title: string; message: string };
  paymentIntent: PaymentIntent | null;
  paymentProvider: PaymentProvider;
  paymentBrand: PaymentBrand;
  paymentBusy: boolean;
  onClose: () => void;
  requestPaymentRefund: () => Promise<void>;
}

export function PaymentSuccessModal({
  paymentSuccess,
  paymentIntent,
  paymentProvider,
  paymentBrand,
  paymentBusy,
  onClose,
  requestPaymentRefund,
}: PaymentSuccessModalProps) {
  return (
    <Modal
      onClose={onClose}
      ariaLabel="Payment successful"
      overlayClassName="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      panelClassName="relative w-full max-w-md overflow-hidden rounded-2xl border bg-white text-center shadow-2xl"
      panelStyle={{ borderColor: `${paymentBrand.primary}44` }}
    >
        <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})` }} />
        <div className="relative p-7" style={{ background: `radial-gradient(circle at 50% 0%, ${paymentBrand.soft}, #ffffff 54%)` }}>
          <img src={`/payment-providers/${paymentProvider}.svg`} alt={`${paymentBrand.name} logo`} className="mx-auto mb-3 h-9 w-24 object-contain" />
          <div className="relative mx-auto flex h-16 w-16 animate-[pulse_1.4s_ease-in-out_2] items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-blue-700 to-emerald-600 text-white shadow-lg shadow-emerald-700/20">
            <CheckCircle2 className="h-9 w-9 animate-[bounce_.7s_ease-out_1]" />
            <Sparkles className="absolute -right-2 -top-2 h-5 w-5 animate-pulse" style={{ color: paymentBrand.primary }} />
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.2em]" style={{ color: paymentBrand.text }}>{paymentBrand.name} payment update</p>
          <h3 className="mt-2 text-xl font-black text-slate-900">{paymentSuccess.title}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{paymentSuccess.message}</p>
          {paymentIntent?.reference && (
            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs font-semibold text-slate-500" style={{ borderColor: `${paymentBrand.primary}33` }}>
              Reference: {paymentIntent.reference}
            </div>
          )}
          {paymentIntent?.status === 'approved_overpaid' && (
            <button type="button" disabled={paymentBusy || paymentIntent.refundStatus === 'requested'} onClick={requestPaymentRefund} className="mt-5 w-full rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70">
              {paymentIntent.refundStatus === 'requested' ? 'Refund request sent' : `Request BDT ${paymentIntent.refundAmount || '0.00'} refund`}
            </button>
          )}
          <button type="button" onClick={onClose} className={`${paymentIntent?.status === 'approved_overpaid' ? 'mt-2' : 'mt-6'} w-full rounded-xl bg-gradient-to-r from-blue-700 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5`}>
            Continue
          </button>
        </div>
    </Modal>
  );
}

export default PaymentSuccessModal;
