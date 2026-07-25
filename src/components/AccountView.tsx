import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Clock3, Copy, CreditCard, Download, Eye, EyeOff, Info, KeyRound, Loader2, LockKeyhole, Monitor, QrCode, ReceiptText, RotateCcw, ShieldAlert, Smartphone, Sparkles, Trash2, UserRound, WalletCards, X } from 'lucide-react';
import QRCode from 'qrcode';
import { ClientConnection, UserProfile } from '../types';
import { Modal } from './common/Modal';

const PLAN_PRICING = Object.freeze({
  growth: { label: 'Growth Plan', events: '500k Events / mo', price: 'BDT 899 / mo' },
  scale: { label: 'Scale Plan', events: '1M Events / mo', price: 'BDT 2,499 / mo' }
});

type PaymentIntent = {
  reference: string;
  paymentReference?: string | null;
  planTier: string;
  baseAmount: string;
  feeRatePercent: string;
  feeAmount: string;
  totalAmount: string;
  provider: string;
  senderPhone: string;
  receivingPhone: string;
  trxId?: string | null;
  status: string;
  statusMessage?: string | null;
  refundAmount?: string | null;
  refundStatus?: string | null;
  refundRequestedAt?: string | null;
  expiresAt: string;
};

type PaymentHistoryItem = {
  reference: string;
  planTier: string;
  provider: string;
  baseAmount: string;
  feeAmount: string;
  totalAmount: string;
  currency: string;
  senderPhone?: string | null;
  trxId?: string | null;
  paymentType?: string | null;
  status: string;
  createdAt?: string | null;
  receivedAt?: string | null;
  reviewedAt?: string | null;
  isTest: boolean;
};

interface AccountViewProps {
  profile: UserProfile;
  connection: ClientConnection | null;
  profName: string;
  setProfName: (v: string) => void;
  profEmail: string;
  setProfEmail: (v: string) => void;
  profEmailCodeRequested: boolean;
  profEmailCode: string;
  setProfEmailCode: (v: string) => void;
  profEmailCurrentPassword: string;
  setProfEmailCurrentPassword: (v: string) => void;
  profNotifEmail: string;
  setProfNotifEmail: (v: string) => void;
  profUpdating: boolean;
  submitProfileSave: (e: React.FormEvent) => Promise<boolean>;
  passCurrent: string;
  setPassCurrent: (v: string) => void;
  passNew: string;
  setPassNew: (v: string) => void;
  passConfirm: string;
  setPassConfirm: (v: string) => void;
  submitPasswordUpdate: () => Promise<void>;
  submitPasswordResetEmail: () => Promise<void>;
  confirmRevokeText: string;
  setConfirmRevokeText: (v: string) => void;
  confirmDeleteText: string;
  setConfirmDeleteText: (v: string) => void;
  handleTokenRevoke: () => Promise<void>;
  handleDeleteAccountRequest: () => void;
  handleDemoReset: () => Promise<void>;
  showToast: (msg: string, isErr?: boolean) => void;
}

export function AccountView({
  profile,
  connection,
  profName,
  setProfName,
  profEmail,
  setProfEmail,
  profEmailCodeRequested,
  profEmailCode,
  setProfEmailCode,
  profEmailCurrentPassword,
  setProfEmailCurrentPassword,
  profNotifEmail,
  setProfNotifEmail,
  profUpdating,
  submitProfileSave,
  passCurrent,
  setPassCurrent,
  passNew,
  setPassNew,
  passConfirm,
  setPassConfirm,
  submitPasswordUpdate,
  submitPasswordResetEmail,
  confirmRevokeText,
  setConfirmRevokeText,
  confirmDeleteText,
  setConfirmDeleteText,
  handleTokenRevoke,
  handleDeleteAccountRequest,
  handleDemoReset,
  showToast
}: AccountViewProps) {
  const [paymentPlan, setPaymentPlan] = useState<'growth' | 'scale' | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'bkash' | 'nagad'>('bkash');
  const [paymentSender, setPaymentSender] = useState('');
  const [paymentTrxId, setPaymentTrxId] = useState('');
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentSecondsLeft, setPaymentSecondsLeft] = useState(0);
  const [paymentFeedback, setPaymentFeedback] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<{ title: string; message: string } | null>(null);
  const [accountSection, setAccountSection] = useState<'profile' | 'billing' | 'danger'>('profile');
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [paymentHistoryLoaded, setPaymentHistoryLoaded] = useState(false);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'cancelled' | 'expired'>('all');
  const [paymentPage, setPaymentPage] = useState(1);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const paymentBrand = paymentProvider === 'bkash'
    ? { name: 'bKash', primary: '#E2136E', secondary: '#A90052', soft: '#FFF1F7', text: '#9D174D' }
    : { name: 'Nagad', primary: '#D8292F', secondary: '#F37021', soft: '#FFF4ED', text: '#9A3412' };
  const paymentExpired = !!paymentIntent && new Date(paymentIntent.expiresAt).getTime() <= Date.now();
  const paymentSenderValid = /^01[3-9]\d{8}$/.test(paymentSender.replace(/\D/g, ''));
  const currentPlanLower = String(profile.plan || '').toLowerCase();
  const isGrowth = currentPlanLower.includes('growth');
  const isScale = currentPlanLower.includes('scale');
  const isAgency = currentPlanLower.includes('agency');
  const isDemo = window.location.hostname.includes('localhost') || 
                 window.location.hostname.includes('127.0.0.1');

  const readApiError = async (response: Response) => {
    const payload = await response.json().catch(() => ({}));
    return typeof payload?.detail === 'string' ? payload.detail : 'Payment request failed. Please try again.';
  };

  const openPayment = (plan: 'growth' | 'scale') => {
    setPaymentPlan(plan);
    setPaymentIntent(null);
    setPaymentTrxId('');
    setPaymentFeedback('');
    setPaymentSuccess(null);
  };

  const finishMatchedPayment = (intent: PaymentIntent, autoRedirect = false) => {
    const isTest = intent.planTier === 'test';
    const isApproved = ['approved', 'approved_overpaid'].includes(intent.status);
    const isOverpaid = intent.status === 'approved_overpaid';
    const needsReview = intent.status === 'needs_review';
    setPaymentIntent(intent);
    setPaymentPlan(null);
    setPaymentFeedback('');
    setPaymentSuccess({
      title: needsReview ? 'Payment found - review needed' : isOverpaid ? 'Payment received - extra amount found' : isTest ? 'Payment test successful!' : isApproved ? 'Payment approved!' : 'Payment received successfully!',
      message: needsReview
        ? 'The Cash In SMS matched your details. Our team will confirm it after a quick manual review.'
        : isOverpaid
        ? `${isTest ? 'Your payment test passed' : `Your ${PLAN_PRICING[intent.planTier as 'growth' | 'scale']?.label || 'paid plan'} is now active`}. BDT ${intent.refundAmount || '0.00'} extra can be requested as a refund.`
        : isTest
        ? 'The payment reference, sender number, and amount matched correctly. Your current plan was not changed.'
        : isApproved
          ? `Your ${PLAN_PRICING[intent.planTier as 'growth' | 'scale']?.label || 'paid plan'} is now active.`
          : 'Your payment matched successfully. We will activate your plan after a quick review.',
    });
  };

  const applyPaymentStatus = (intent: PaymentIntent, showStatusToast = false, autoRedirect = false) => {
    if (['matched', 'needs_review', 'approved', 'approved_overpaid'].includes(intent.status)) {
      finishMatchedPayment(intent, autoRedirect);
      return;
    }
    setPaymentIntent(intent);
    if (intent.status === 'pending') {
      setPaymentFeedback('Waiting for your payment SMS. We will verify it automatically.');
    } else {
      setPaymentFeedback(`Payment status: ${intent.status.replaceAll('_', ' ')}.`);
    }
    if (showStatusToast) showToast(`Payment status: ${intent.status.replaceAll('_', ' ')}`);
  };

  const loadPaymentStatus = async (showStatusToast = false, autoRedirect = false) => {
    const response = await fetch('/api/payments/intents/latest');
    if (!response.ok) throw new Error(await readApiError(response));
    const payload = await response.json();
    if (payload.payment) applyPaymentStatus(payload.payment, showStatusToast, autoRedirect);
  };

  useEffect(() => {
    if (!paymentIntent?.receivingPhone) {
      setPaymentQrUrl(null);
      return;
    }
    QRCode.toDataURL(paymentIntent.receivingPhone, { errorCorrectionLevel: 'M', margin: 1, width: 140 })
      .then((url) => setPaymentQrUrl(url))
      .catch(() => setPaymentQrUrl(null));
  }, [paymentIntent?.receivingPhone]);

  useEffect(() => {
    if (!paymentIntent?.expiresAt) {
      setPaymentSecondsLeft(0);
      return;
    }
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((new Date(paymentIntent.expiresAt).getTime() - Date.now()) / 1000));
      setPaymentSecondsLeft(remaining);
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timer);
  }, [paymentIntent?.expiresAt]);

  useEffect(() => {
    if (!paymentIntent?.reference || paymentIntent.status !== 'pending') return;
    let stopped = false;
    let timer: number | undefined;
    const poll = async () => {
      if (stopped || Date.now() >= new Date(paymentIntent.expiresAt).getTime()) {
        stopped = true;
        setPaymentSecondsLeft(0);
        if (timer !== undefined) window.clearInterval(timer);
        return;
      }
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(paymentIntent.reference)}/status`);
        if (!response.ok) return;
        const payload = await response.json();
        if (payload.isPaid) await loadPaymentStatus(false, true);
      } catch {
        // The next poll retries transient network failures.
      }
    };
    timer = window.setInterval(() => { void poll(); }, 3000);
    void poll();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [paymentIntent?.reference, paymentIntent?.status, paymentIntent?.expiresAt]);

  useEffect(() => {
    if (accountSection !== 'billing' || paymentHistoryLoaded || paymentHistoryLoading) return;
    setPaymentHistoryLoading(true);
    fetch('/api/payments/history?limit=100')
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json();
      })
      .then((payload) => {
        setPaymentHistory(Array.isArray(payload.payments) ? payload.payments : []);
        setPaymentHistoryLoaded(true);
      })
      .catch((error) => showToast(error instanceof Error ? error.message : 'Could not load payment history.', true))
      .finally(() => setPaymentHistoryLoading(false));
  }, [accountSection, paymentHistoryLoaded, paymentHistoryLoading]);

  const createPayment = async () => {
    if (!paymentPlan) return;
    setPaymentBusy(true);
    try {
      const response = await fetch('/api/payments/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planTier: paymentPlan, senderPhone: paymentSender, provider: paymentProvider }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = await response.json();
      setPaymentIntent(payload.payment);
      setPaymentFeedback('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not create payment request.', true);
    } finally {
      setPaymentBusy(false);
    }
  };

  const submitExpiredPaymentForReview = async () => {
    if (!paymentIntent || paymentTrxId.trim().length < 6) return;
    setPaymentBusy(true);
    try {
      const response = await fetch(`/api/payments/intents/${encodeURIComponent(paymentIntent.reference)}/manual-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trxId: paymentTrxId }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = await response.json();
      applyPaymentStatus(payload.payment, true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not submit the payment for review.', true);
    } finally {
      setPaymentBusy(false);
    }
  };

  const requestPaymentRefund = async () => {
    if (!paymentIntent) return;
    setPaymentBusy(true);
    try {
      const response = await fetch(`/api/payments/intents/${encodeURIComponent(paymentIntent.reference)}/refund-request`, { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = await response.json();
      setPaymentIntent(payload.payment);
      showToast('Refund request sent to the admin team.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not request the refund.', true);
    } finally {
      setPaymentBusy(false);
    }
  };

  const accountSections = [
    { id: 'profile' as const, label: 'Profile & Security', icon: UserRound },
    { id: 'billing' as const, label: 'Plan & Billing', icon: WalletCards },
    { id: 'danger' as const, label: 'Danger Zone', icon: ShieldAlert },
  ];

  const statusClasses = (paymentStatus: string) => {
    if (['approved', 'matched', 'approved_overpaid'].includes(paymentStatus)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (['needs_review', 'ambiguous'].includes(paymentStatus)) return 'border-amber-200 bg-amber-50 text-amber-700';
    if (paymentStatus === 'pending') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (['rejected', 'failed', 'underpaid'].includes(paymentStatus)) return 'border-rose-200 bg-rose-50 text-rose-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
  };

  const statusLabel = (paymentStatus: string) => {
    if (['approved', 'matched'].includes(paymentStatus)) return 'Paid';
    if (paymentStatus === 'approved_overpaid') return 'Paid - refund available';
    if (['needs_review', 'ambiguous'].includes(paymentStatus)) return 'Under review';
    if (paymentStatus === 'underpaid') return 'Paid less than required';
    if (paymentStatus === 'overpaid') return 'Paid more than required';
    return paymentStatus.replaceAll('_', ' ');
  };

  const growthPlanFeatures = [
    '1 WooCommerce store',
    'Up to 500,000 tracked events each month',
    'Meta CAPI, TikTok Events API, and GA4',
    'Browser and server event deduplication',
    'Telegram order and recovery alerts',
    'Incomplete checkout recovery',
    'Manual courier booking tools',
    'Up to 60 days of event history',
  ];
  const scalePlanFeatures = [
    'Up to 3 WooCommerce stores',
    'Up to 1,000,000 tracked events each month',
    'Everything included in Growth',
    'Multiple pixels and tracking routes',
    'Advanced event quality checks',
    'Higher order and automation capacity',
    'Priority support and onboarding help',
    'Up to 60 days of event history',
  ];

  const usagePercent = profile.eventsQuota > 0
    ? Math.min(100, (profile.eventsUsed / profile.eventsQuota) * 100)
    : 0;
  const passwordStrength = [
    passNew.length >= 8,
    /[a-z]/.test(passNew) && /[A-Z]/.test(passNew),
    /\d/.test(passNew),
    /[^A-Za-z0-9]/.test(passNew),
  ].filter(Boolean).length;
  const passwordStrengthLabel = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength];
  const maskedConnectionKey = connection?.api_key
    ? `${connection.api_key.slice(0, 7)}••••${connection.api_key.slice(-4)}`
    : 'Not available';
  const browserName = /Edg/i.test(navigator.userAgent)
    ? 'Edge'
    : /Firefox/i.test(navigator.userAgent)
      ? 'Firefox'
      : /Chrome/i.test(navigator.userAgent)
        ? 'Chrome'
        : /Safari/i.test(navigator.userAgent)
          ? 'Safari'
          : 'Browser';
  const operatingSystem = /Windows/i.test(navigator.userAgent)
    ? 'Windows'
    : /Android/i.test(navigator.userAgent)
      ? 'Android'
      : /iPhone|iPad/i.test(navigator.userAgent)
        ? 'iOS'
        : /Mac/i.test(navigator.userAgent)
          ? 'macOS'
          : 'this device';

  const paymentCategory = (status: string): 'paid' | 'cancelled' | 'expired' | 'other' => {
    if (['approved', 'matched', 'approved_overpaid'].includes(status)) return 'paid';
    if (['cancelled', 'rejected', 'failed'].includes(status)) return 'cancelled';
    if (status === 'expired') return 'expired';
    return 'other';
  };
  const paymentCounts = {
    all: paymentHistory.length,
    paid: paymentHistory.filter(payment => paymentCategory(payment.status) === 'paid').length,
    cancelled: paymentHistory.filter(payment => paymentCategory(payment.status) === 'cancelled').length,
    expired: paymentHistory.filter(payment => paymentCategory(payment.status) === 'expired').length,
  };
  const filteredPaymentHistory = paymentHistory.filter(payment =>
    paymentStatusFilter === 'all' || paymentCategory(payment.status) === paymentStatusFilter
  );
  const paymentPageSize = 6;
  const paymentPageCount = Math.max(1, Math.ceil(filteredPaymentHistory.length / paymentPageSize));
  const visiblePayments = filteredPaymentHistory.slice(
    (paymentPage - 1) * paymentPageSize,
    paymentPage * paymentPageSize,
  );
  const paidPayments = paymentHistory
    .filter(payment => paymentCategory(payment.status) === 'paid')
    .sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
  const currentMonth = new Date();
  const paidThisMonth = paidPayments
    .filter(payment => {
      const paidAt = new Date(payment.receivedAt || payment.createdAt || 0);
      return paidAt.getFullYear() === currentMonth.getFullYear() && paidAt.getMonth() === currentMonth.getMonth();
    })
    .reduce((total, payment) => total + Number(payment.totalAmount || 0), 0);
  const lastPaidPayment = paidPayments[0] || null;

  const downloadTextFile = (filename: string, content: string, type = 'text/plain') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPaymentHistory = () => {
    const csvRows = [
      ['Date', 'Plan', 'Method', 'Transaction', 'Amount', 'Currency', 'Status'],
      ...filteredPaymentHistory.map(payment => [
        payment.createdAt || '',
        payment.planTier,
        payment.provider,
        payment.trxId || '',
        payment.totalAmount,
        payment.currency,
        statusLabel(payment.status),
      ]),
    ];
    const csv = csvRows
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    downloadTextFile('buykori-payment-history.csv', csv, 'text/csv');
  };

  const downloadReceipt = (payment: PaymentHistoryItem) => {
    downloadTextFile(
      `buykori-receipt-${payment.reference}.txt`,
      [
        'Buykori AdSync Payment Receipt',
        `Reference: ${payment.reference}`,
        `Date: ${payment.createdAt ? new Date(payment.createdAt).toLocaleString() : 'Not available'}`,
        `Plan: ${payment.planTier}`,
        `Method: ${payment.provider}`,
        `Transaction: ${payment.trxId || 'Not submitted'}`,
        `Amount: ${payment.currency} ${payment.totalAmount}`,
        `Status: ${statusLabel(payment.status)}`,
      ].join('\n'),
    );
  };

  const renderPaymentHistory = () => (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="payment-history-heading">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <CreditCard className="h-4 w-4" />
          </span>
          <div>
            <h3 id="payment-history-heading" className="text-sm font-bold text-slate-900">Payment history</h3>
            <p className="mt-0.5 text-xs text-slate-500">Invoices, receipts and payment attempts.</p>
          </div>
        </div>
        <button type="button" onClick={exportPaymentHistory} disabled={paymentHistory.length === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid border-b border-slate-200 sm:grid-cols-3">
        <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paid this month</p>
          <p className="mt-1 text-sm font-bold text-slate-900">BDT {paidThisMonth.toFixed(2)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{paidPayments.length} successful payment{paidPayments.length === 1 ? '' : 's'} total</p>
        </div>
        <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last payment</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {lastPaidPayment?.createdAt
              ? new Date(lastPaidPayment.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
              : 'No successful payment'}
          </p>
          <p className="mt-1 text-[11px] capitalize text-slate-400">
            {lastPaidPayment ? `${lastPaidPayment.provider} · BDT ${lastPaidPayment.totalAmount}` : '—'}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next renewal</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{profile.renewalDate || 'Not scheduled'}</p>
          <p className="mt-1 text-[11px] text-slate-400">{profile.plan} · {isScale ? 'BDT 2,499' : 'BDT 899'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
        {([
          ['all', 'All'],
          ['paid', 'Paid'],
          ['cancelled', 'Cancelled'],
          ['expired', 'Expired'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={paymentStatusFilter === value}
            onClick={() => {
              setPaymentStatusFilter(value);
              setPaymentPage(1);
            }}
            className={`min-h-8 rounded-full border px-3 text-[11px] font-bold ${
              paymentStatusFilter === value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label} <span className="ml-1 opacity-70">{paymentCounts[value]}</span>
          </button>
        ))}
        <button type="button" onClick={() => setPaymentHistoryLoaded(false)} disabled={paymentHistoryLoading} className="ml-auto inline-flex min-h-8 items-center gap-1.5 px-2 text-[11px] font-bold text-indigo-600 disabled:opacity-50">
          <RotateCcw className={`h-3 w-3 ${paymentHistoryLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {paymentHistoryLoading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-14 text-xs text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Loading payment history…
        </div>
      ) : visiblePayments.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <ReceiptText className="mx-auto h-9 w-9 text-slate-300" />
          <h4 className="mt-3 text-sm font-bold text-slate-800">No matching payments</h4>
          <p className="mt-1 text-xs text-slate-500">Payment records will appear here when available.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-16 px-5 py-3" aria-label="Receipt" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePayments.map(payment => (
                  <tr key={payment.reference} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="block font-bold text-slate-800">{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString([], { dateStyle: 'medium' }) : '—'}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{payment.createdAt ? new Date(payment.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold capitalize text-slate-800">{payment.planTier}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{payment.reference}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold capitalize text-slate-800">{payment.provider}</span>
                      <span className="mt-0.5 block text-[11px] capitalize text-slate-400">{payment.paymentType?.replaceAll('_', ' ') || 'Awaiting SMS'}</span>
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px] text-slate-700">{payment.trxId || 'Not submitted'}</td>
                    <td className="px-4 py-4 text-right font-bold text-slate-900">BDT {payment.totalAmount}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${statusClasses(payment.status)}`}>{statusLabel(payment.status)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" disabled={paymentCategory(payment.status) !== 'paid'} onClick={() => downloadReceipt(payment)} aria-label={`Download receipt for ${payment.reference}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-[11px] text-slate-400">
            <span>Showing {(paymentPage - 1) * paymentPageSize + 1}–{Math.min(paymentPage * paymentPageSize, filteredPaymentHistory.length)} of {filteredPaymentHistory.length} payments</span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={paymentPage <= 1} onClick={() => setPaymentPage(page => Math.max(1, page - 1))} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40">‹</button>
              <span className="min-w-16 text-center font-bold text-slate-600">Page {paymentPage} / {paymentPageCount}</span>
              <button type="button" disabled={paymentPage >= paymentPageCount} onClick={() => setPaymentPage(page => Math.min(paymentPageCount, page + 1))} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40">›</button>
            </div>
          </div>
        </>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your profile, sign-in security and connected devices.</p>
      </div>

      <div className="inline-flex max-w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Account sections">
          {accountSections.map((section) => {
            const Icon = section.icon;
            const active = accountSection === section.id;
            return (
              <button key={section.id} type="button" role="tab" aria-selected={active} onClick={() => setAccountSection(section.id)} className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                <Icon className="h-4 w-4" /> {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {accountSection === 'profile' && (
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xl font-black uppercase text-white shadow-md shadow-indigo-200">
              {(profile.name || profile.email || 'A').trim().charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-bold text-slate-900">{profile.name || 'Your account'}</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><Check className="h-3 w-3" /> Active</span>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{profile.email}</p>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-3 lg:min-w-36 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current plan</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{profile.plan}</p>
            <p className="mt-1 text-[11px] text-slate-400">Renews {profile.renewalDate || 'not scheduled'}</p>
          </div>
          <div className="border-t border-slate-200 pt-3 lg:min-w-52 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly usage</p>
              <span className="text-[10px] font-bold text-indigo-600">{usagePercent.toFixed(2)}%</span>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900">{profile.eventsUsed.toLocaleString()} / {profile.eventsQuota.toLocaleString()}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${usagePercent}%` }} /></div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6">
      
      {/* Edit forms */}
      <div className={`${accountSection === 'billing' ? 'order-2' : 'order-1'} space-y-5`}>
        
        {/* Account detail profile save */}
        {accountSection === 'profile' && <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><UserRound className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Profile</h3>
              <p className="mt-0.5 text-xs text-slate-500">Your account details and where we send alerts.</p>
            </div>
          </div>
          
          <form onSubmit={submitProfileSave} className="space-y-4 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="account-display-name" className="block text-xs font-semibold text-slate-400  uppercase mb-1">Display Name</label>
                <input 
                  id="account-display-name"
                  type="text" 
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label htmlFor="account-profile-email" className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                  Sign-in Email
                  {profile.emailVerified !== false && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold normal-case text-emerald-700"><Check className="h-3 w-3" /> Verified</span>}
                </label>
                <div className="relative">
                  <input
                    id="account-profile-email"
                    type="email"
                    value={profile.email}
                    readOnly
                    aria-readonly="true"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 pr-9 text-xs text-slate-500"
                  />
                  <LockKeyhole className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Contact support to change your sign-in email.</p>
              </div>
            </div>

            <div>
              <label htmlFor="account-notification-email" className="block text-xs font-semibold text-slate-400  uppercase mb-1">Notification Email</label>
              <input 
                id="account-notification-email"
                type="email" 
                value={profNotifEmail}
                onChange={(e) => setProfNotifEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="mt-1 text-[11px] text-slate-400">Order alerts, weekly reports and billing receipts are sent here.</p>
            </div>


            <div className="pt-2 text-right">
              <button 
                type="submit"
                disabled={profUpdating}
                className="min-h-10 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                {profUpdating ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>}

        {accountSection === 'profile' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><LockKeyhole className="h-4 w-4" /></span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Password</h3>
              <p className="mt-0.5 text-xs text-slate-500">Use a unique password between 8 and 16 characters.</p>
            </div>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-3">
            {[
              {
                id: 'account-current-password',
                label: 'Current password',
                value: passCurrent,
                setValue: setPassCurrent,
                shown: showCurrentPassword,
                setShown: setShowCurrentPassword,
                placeholder: 'Enter current password',
                autoComplete: 'current-password',
              },
              {
                id: 'account-new-password',
                label: 'New password',
                value: passNew,
                setValue: setPassNew,
                shown: showNewPassword,
                setShown: setShowNewPassword,
                placeholder: 'At least 8 characters',
                autoComplete: 'new-password',
              },
              {
                id: 'account-confirm-password',
                label: 'Confirm new password',
                value: passConfirm,
                setValue: setPassConfirm,
                shown: showConfirmPassword,
                setShown: setShowConfirmPassword,
                placeholder: 'Repeat new password',
                autoComplete: 'new-password',
              },
            ].map(field => (
              <div key={field.id}>
                <label htmlFor={field.id} className="mb-1 block text-xs font-semibold uppercase text-slate-500">{field.label}</label>
                <div className="relative">
                  <input
                    id={field.id}
                    type={field.shown ? 'text' : 'password'}
                    value={field.value}
                    placeholder={field.placeholder}
                    minLength={field.id === 'account-current-password' ? undefined : 8}
                    maxLength={field.id === 'account-current-password' ? undefined : 16}
                    autoComplete={field.autoComplete}
                    onChange={event => field.setValue(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2.5 pr-10 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button type="button" onClick={() => field.setShown(!field.shown)} aria-label={`${field.shown ? 'Hide' : 'Show'} ${field.label}`} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
                    {field.shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {field.id === 'account-new-password' && passNew && (
                  <div className="mt-2 flex items-center gap-1">
                    {[1, 2, 3, 4].map(level => <span key={level} className={`h-1 flex-1 rounded-full ${passwordStrength >= level ? 'bg-emerald-500' : 'bg-slate-200'}`} />)}
                    <span className="ml-1 text-[10px] font-bold text-emerald-700">{passwordStrengthLabel}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={submitPasswordResetEmail} className="min-h-10 text-left text-xs font-bold text-indigo-600 hover:text-indigo-700">
              Forgot password? Send a reset link
            </button>
            <button type="button" disabled={!passCurrent || passNew.length < 8 || passNew !== passConfirm} onClick={submitPasswordUpdate} className="min-h-10 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              Update password
            </button>
          </div>
        </section>}

        {accountSection === 'profile' && <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><ShieldAlert className="h-4 w-4" /></span>
            <div>
              <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-slate-900">Two-step verification</h3><span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Off</span></div>
              <p className="mt-0.5 text-xs text-slate-500">Add a one-time code when signing in to protect your account and billing.</p>
            </div>
          </div>
          <button type="button" disabled title="Two-step verification is coming soon" className="min-h-10 shrink-0 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-400 disabled:cursor-not-allowed">Coming soon</button>
        </section>}

        {accountSection === 'profile' && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600"><Monitor className="h-4 w-4" /></span>
              <div><h3 className="text-sm font-bold text-slate-900">Active sessions</h3><p className="mt-0.5 text-xs text-slate-500">Devices currently signed in to this account.</p></div>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600">1 device</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><Monitor className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-900">{browserName} on {operatingSystem}</p><p className="mt-0.5 text-[11px] text-slate-400">Current authenticated browser session</p></div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">This device</span>
          </div>
        </section>}

        {accountSection === 'danger' && <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
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
        </section>}

        {accountSection === 'danger' && <section className="overflow-hidden rounded-xl border border-rose-200 bg-white shadow-sm">
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
        </section>}

        {accountSection === 'billing' && renderPaymentHistory()}

      </div>

      {accountSection === 'billing' && <div className="order-1 space-y-5">
        <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current plan</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{profile.plan}</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"><Check className="h-3 w-3" /> Active</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{isScale ? 'BDT 2,499' : 'BDT 899'} / month · Renews {profile.renewalDate || 'not scheduled'} · Tracking protection fully enabled</p>
          </div>
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly usage</p>
              <span className="text-[10px] font-bold text-emerald-700">{usagePercent.toFixed(2)}% used</span>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900">{profile.eventsUsed.toLocaleString()} / {profile.eventsQuota.toLocaleString()} events</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${usagePercent}%` }} /></div>
            <p className="mt-1.5 text-[11px] text-slate-400">Resets {profile.renewalDate || 'at the end of the billing period'}</p>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          {[
            { tier: 'growth' as const, label: 'Growth', subtitle: 'For a single store, up to 500,000 events / month', price: 'BDT 899', features: growthPlanFeatures.slice(0, 5), active: isGrowth, recommended: false },
            { tier: 'scale' as const, label: 'Scale', subtitle: 'For growing brands, up to 3 stores & 1M events / month', price: 'BDT 2,499', features: scalePlanFeatures.slice(0, 5), active: isScale, recommended: !isScale },
          ].map(plan => (
            <section key={plan.tier} className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${plan.recommended ? 'border-indigo-500' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">{plan.label}</h3>
                {plan.active && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Current plan</span>}
                {plan.recommended && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">Recommended</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{plan.subtitle}</p>
              <p className="mt-5 text-2xl font-bold text-slate-900">{plan.price} <span className="text-xs font-normal text-slate-500">/ month</span></p>
              <ul className="mt-5 flex-1 space-y-3">
                {plan.features.map(feature => <li key={feature} className="flex items-start gap-2 text-xs text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><span>{feature}</span></li>)}
              </ul>
              <button type="button" disabled={plan.active || isAgency} onClick={() => openPayment(plan.tier)} className={`mt-6 min-h-10 w-full rounded-lg px-4 text-xs font-bold transition ${plan.active ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:cursor-not-allowed`}>
                {plan.active ? 'Your current plan' : isAgency ? 'Managed by support' : plan.tier === 'scale' ? 'Upgrade to Scale' : 'Choose Growth'}
              </button>
            </section>
          ))}
        </div>

        {/* Reset demo sandbox context values widget */}
        {isDemo && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3  ">
            <div>
              <h4 className="font-bold text-slate-800  text-xs uppercase tracking-wider">Demo Controls</h4>
              <p className="text-xs text-slate-400 ">Restore test values for demos</p>
            </div>

            <button 
              onClick={handleDemoReset}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200    text-slate-800  rounded text-xs font-semibold border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Demo Data
            </button>
          </div>
        )}

      </div>}

      </div>

      {paymentPlan && (
        <Modal
          onClose={() => setPaymentPlan(null)}
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
                <button type="button" onClick={() => setPaymentPlan(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close payment">
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
                    আপনি যদি পেমেন্ট করে থাকেন আর রেফার আইডি দিতে ভুল করে থাকেন বা মিস করে থাকেন, তবে নিচে আপনার ট্রানজেকশন আইডি (TrxID) বসিয়ে <strong>Continue (কন্টিনিউ)</strong> চাপুন।
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
                            <strong>জরুরি নির্দেশাবলি:</strong> {paymentBrand.name} দিয়ে সেন্ড মানি/পেমেন্ট করার সময় <strong>Reference</strong> ফিল্ডে অবশ্যই <span className="rounded bg-white/30 px-1.5 py-0.5 font-mono text-xs font-black tracking-wide text-white underline">{paymentIntent.paymentReference || '1'}</span> এই রেফার আইডিটি বসাবেন।
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
      )}

      {paymentSuccess && (
        <Modal
          onClose={() => { setPaymentSuccess(null); setPaymentIntent(null); }}
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
              <button type="button" onClick={() => { setPaymentSuccess(null); setPaymentIntent(null); }} className={`${paymentIntent?.status === 'approved_overpaid' ? 'mt-2' : 'mt-6'} w-full rounded-xl bg-gradient-to-r from-blue-700 to-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5`}>
                Continue
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
