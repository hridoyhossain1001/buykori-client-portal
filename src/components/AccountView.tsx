import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Copy, CreditCard, KeyRound, Loader2, QrCode, ReceiptText, RotateCcw, ShieldAlert, Sparkles, UserRound, WalletCards, X } from 'lucide-react';
import QRCode from 'qrcode';
import { UserProfile } from '../types';
import { Modal } from './common/Modal';

const PLAN_PRICING = Object.freeze({
  test: { label: 'Test Payment', events: 'Checks SMS payment only', price: 'BDT 10' },
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
  const [paymentPlan, setPaymentPlan] = useState<'test' | 'growth' | 'scale' | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'bkash' | 'nagad'>('bkash');
  const [paymentSender, setPaymentSender] = useState('');
  const [paymentTrxId, setPaymentTrxId] = useState('');
  const [paymentIntent, setPaymentIntent] = useState<PaymentIntent | null>(null);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentSecondsLeft, setPaymentSecondsLeft] = useState(0);
  const [paymentFeedback, setPaymentFeedback] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<{ title: string; message: string } | null>(null);
  const [accountSection, setAccountSection] = useState<'profile' | 'billing' | 'payments' | 'danger'>('profile');
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [paymentHistoryLoaded, setPaymentHistoryLoaded] = useState(false);
  const paymentBrand = paymentProvider === 'bkash'
    ? { name: 'bKash', primary: '#E2136E', secondary: '#A90052', soft: '#FFF1F7', text: '#9D174D' }
    : { name: 'Nagad', primary: '#D8292F', secondary: '#F37021', soft: '#FFF4ED', text: '#9A3412' };
  const paymentExpired = !!paymentIntent && new Date(paymentIntent.expiresAt).getTime() <= Date.now();
  const currentPlanLower = String(profile.plan || '').toLowerCase();
  const isGrowth = currentPlanLower.includes('growth');
  const isScale = currentPlanLower.includes('scale');
  const isAgency = currentPlanLower.includes('agency');
  const emailChanged = profEmail.trim().toLowerCase() !== profile.email.trim().toLowerCase();
  const isDemo = window.location.hostname.includes('localhost') || 
                 window.location.hostname.includes('127.0.0.1');

  const readApiError = async (response: Response) => {
    const payload = await response.json().catch(() => ({}));
    return typeof payload?.detail === 'string' ? payload.detail : 'Payment request failed. Please try again.';
  };

  const openPayment = (plan: 'test' | 'growth' | 'scale') => {
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
    setPaymentIntent(null);
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
    if (accountSection !== 'payments' || paymentHistoryLoaded || paymentHistoryLoading) return;
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
    { id: 'payments' as const, label: 'Payment History', icon: ReceiptText },
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Account sections">
          {accountSections.map((section) => {
            const Icon = section.icon;
            const active = accountSection === section.id;
            return (
              <button key={section.id} type="button" role="tab" aria-selected={active} onClick={() => setAccountSection(section.id)} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <Icon className="h-4 w-4" /> {section.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
      
      {/* Edit forms */}
      <div className={`${accountSection === 'billing' ? 'hidden' : ''} space-y-6`}>
        
        {/* Account detail profile save */}
        {accountSection === 'profile' && <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <div className="mb-6 grid gap-4 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 md:grid-cols-[auto_1fr] md:items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-2xl font-black uppercase text-white shadow-lg shadow-indigo-200">{(profile.name || profile.email || 'A').trim().charAt(0)}</div>
            <div>
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-slate-900">{profile.name || 'Your account'}</h3><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">Active account</span></div>
              <p className="mt-1 text-xs text-slate-600">{profile.email}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-white/80 px-3 py-2"><span className="block text-xs font-bold uppercase text-slate-400">Current plan</span><strong className="mt-1 block text-xs text-slate-800">{profile.plan}</strong></div>
                <div className="rounded-lg bg-white/80 px-3 py-2"><span className="block text-xs font-bold uppercase text-slate-400">Notification email</span><strong className="mt-1 block truncate text-xs text-slate-800">{profile.notificationEmail || profile.email}</strong></div>
                <div className="rounded-lg bg-white/80 px-3 py-2"><span className="block text-xs font-bold uppercase text-slate-400">Monthly usage</span><strong className="mt-1 block text-xs text-slate-800">{profile.eventsUsed.toLocaleString()} / {profile.eventsQuota.toLocaleString()}</strong></div>
              </div>
            </div>
          </div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-4 ">Edit Profile</h3>
          
          <form onSubmit={submitProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="account-display-name" className="block text-xs font-semibold text-slate-400  uppercase mb-1">Display Name</label>
                <input 
                  id="account-display-name"
                  type="text" 
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded"
                />
              </div>

              <div>
                <label htmlFor="account-profile-email" className="block text-xs font-semibold text-slate-400  uppercase mb-1">Profile Email</label>
                <input 
                  id="account-profile-email"
                  type="email" 
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded"
                />
                {emailChanged && !profEmailCodeRequested && (
                  <p className="mt-1 text-xs leading-relaxed text-amber-600">Click the button below. We will send a code to your new email.</p>
                )}
              </div>
            </div>

            {emailChanged && profEmailCodeRequested && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-indigo-500">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={profEmailCode}
                    onChange={(e) => setProfEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    className="w-full rounded border border-indigo-200 bg-white p-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-indigo-500">Current Password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={profEmailCurrentPassword}
                    onChange={(e) => setProfEmailCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full rounded border border-indigo-200 bg-white p-2 text-xs"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="account-notification-email" className="block text-xs font-semibold text-slate-400  uppercase mb-1">Notification Email</label>
              <input 
                id="account-notification-email"
                type="email" 
                value={profNotifEmail}
                onChange={(e) => setProfNotifEmail(e.target.value)}
                className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded"
              />
            </div>


            <div className="pt-2 text-right">
              <button 
                type="submit"
                disabled={profUpdating}
                className="min-h-10 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                {profUpdating
                  ? 'Saving...'
                  : emailChanged && !profEmailCodeRequested
                      ? 'Send Code to New Email'
                    : emailChanged
                      ? 'Verify Email & Save'
                      : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>}

        {/* Password modifier */}
        {accountSection === 'profile' && <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-800"><KeyRound className="h-4 w-4 text-indigo-600" /> Change Password</h3>
          <p className="mb-4 text-xs text-slate-500">Use a unique password between 8 and 16 characters.</p>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="account-current-password" className="block text-xs font-semibold text-slate-400  uppercase mb-1">Current Password</label>
                <input 
                  id="account-current-password"
                  type="password" 
                  value={passCurrent} 
                  placeholder="**************"
                  onChange={(e) => setPassCurrent(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded font-mono"
                />
              </div>

              <div>
                <label htmlFor="account-new-password" className="block text-xs font-semibold text-slate-400  uppercase mb-1">New Password</label>
                <input 
                  id="account-new-password"
                  type="password" 
                  value={passNew} 
                  placeholder="8-16 character password"
                  minLength={8}
                  maxLength={16}
                  autoComplete="new-password"
                  onChange={(e) => setPassNew(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded font-mono"
                />
              </div>

              <div>
                <label htmlFor="account-confirm-password" className="block text-xs font-semibold text-slate-400  uppercase mb-1">Confirm New Password</label>
                <input 
                  id="account-confirm-password"
                  type="password" 
                  value={passConfirm} 
                  placeholder="Confirm secure password"
                  minLength={8}
                  maxLength={16}
                  autoComplete="new-password"
                  onChange={(e) => setPassConfirm(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={submitPasswordResetEmail}
                className="inline-flex min-h-10 items-center text-left text-xs font-bold text-indigo-600 hover:text-indigo-700 underline-offset-4 hover:underline"
              >
                Forgot current password? Send reset link
              </button>
              <button 
                type="button"
                onClick={submitPasswordUpdate}
                className="min-h-10 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Update Password
              </button>
            </div>
          </div>
        </div>}

        {/* Danger parameters */}
        {accountSection === 'danger' && <div className="rounded-xl border border-rose-200 bg-rose-50   p-6 shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-rose-800  text-sm uppercase tracking-wide">Danger Zone</h3>
            <p className="text-xs text-rose-600  leading-normal mt-0.5">These actions can't be undone. Please confirm carefully.</p>
          </div>

          <div className="space-y-5 divide-y divide-rose-200/50 ">
            
            {/* Webhook access key change */}
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-rose-800  uppercase tracking-widest mt-2">Create a New Plugin Key</h4>
              <p className="text-xs text-rose-700  leading-relaxed max-w-2xl">
                This creates a new connection key. Tracking will stop until you paste the new key into your WordPress plugin.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Type REVOKE to confirm"
                  value={confirmRevokeText}
                  onChange={(e) => setConfirmRevokeText(e.target.value)}
                  className="p-2 text-xs bg-white border border-rose-200/50 rounded font-mono text-rose-900 focus:outline-none focus:border-rose-500 w-full sm:w-80   "
                />
                <button 
                  type="button"
                  onClick={handleTokenRevoke}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shadow cursor-pointer whitespace-nowrap"
                >
                  Create New Key
                </button>
              </div>
            </div>

            {/* Deletion requests */}
            <div className="pt-5 space-y-3">
              <h4 className="font-bold text-xs text-rose-800  uppercase tracking-widest">Delete account request</h4>
              <p className="text-xs text-rose-700  leading-relaxed max-w-2xl">
                This does not delete your account right away. Send a request and Buykori support will contact you before removing your account and data.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Type DELETE to confirm"
                  value={confirmDeleteText}
                  onChange={(e) => setConfirmDeleteText(e.target.value)}
                  className="p-2 text-xs bg-white border border-rose-200/50 rounded font-mono text-rose-900 focus:outline-none focus:border-rose-500 w-full sm:w-80   "
                />
                <button 
                  type="button"
                  onClick={handleDeleteAccountRequest}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors shadow cursor-pointer whitespace-nowrap"
                >
                  Submit deletion request
                </button>
              </div>
            </div>

          </div>
        </div>}

        {accountSection === 'payments' && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-800"><ReceiptText className="h-4 w-4 text-indigo-600" /> Payment History</h3>
                <p className="mt-1 text-xs text-slate-500">Your plan payments, test checks, fees, and current payment status.</p>
              </div>
              <button type="button" onClick={() => setPaymentHistoryLoaded(false)} disabled={paymentHistoryLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><RotateCcw className={`h-3.5 w-3.5 ${paymentHistoryLoading ? 'animate-spin' : ''}`} /> Refresh</button>
            </div>
            {paymentHistoryLoading ? (
              <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Loading payment history...</div>
            ) : paymentHistory.length === 0 ? (
              <div className="px-5 py-14 text-center"><CreditCard className="mx-auto h-9 w-9 text-slate-300" /><h4 className="mt-3 text-sm font-bold text-slate-800">No payments yet</h4><p className="mt-1 text-xs text-slate-500">Your payment records will appear here after you start a payment.</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Sender / TrxID</th><th className="px-4 py-3">Amount</th><th className="px-5 py-3 text-right">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentHistory.map((payment) => (
                      <tr key={payment.reference} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-5 py-4"><span className="block font-semibold text-slate-700">{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '-'}</span><span className="mt-0.5 block text-xs text-slate-400">{payment.createdAt ? new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span></td>
                        <td className="px-4 py-4"><span className="font-bold capitalize text-slate-800">{payment.planTier}</span>{payment.isTest && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold uppercase text-violet-700">Test</span>}<span className="mt-1 block font-mono text-xs text-slate-400">{payment.reference}</span></td>
                        <td className="px-4 py-4"><span className="font-bold capitalize text-slate-700">{payment.provider}</span><span className="mt-1 block text-xs capitalize text-slate-400">{payment.paymentType?.replaceAll('_', ' ') || 'Awaiting SMS'}</span></td>
                        <td className="px-4 py-4"><span className="block font-mono font-semibold text-slate-700">{payment.senderPhone || '-'}</span><span className="mt-1 block font-mono text-xs text-slate-400">{payment.trxId || 'TrxID not submitted'}</span></td>
                        <td className="px-4 py-4"><span className="font-black text-slate-900">BDT {payment.totalAmount}</span><span className="mt-1 block text-xs text-slate-400">Price {payment.baseAmount} + fee {payment.feeAmount}</span></td>
                        <td className="px-5 py-4 text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${statusClasses(payment.status)}`}>{statusLabel(payment.status)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Left side subscriptions container */}
      {accountSection === 'billing' && <div className="space-y-6">
        
        {/* Current Active Plan summary card */}
        <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div>
            <span className="block text-xs font-bold uppercase tracking-wider text-indigo-600">Plan & Billing</span>
            <h3 className="mt-1 text-xl font-black text-slate-900">Your plan and available upgrades</h3>
            <p className="mt-1 text-xs text-slate-500">Review your usage and compare Growth with Scale in simple terms.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4"><span className="text-xs font-bold uppercase tracking-wide text-indigo-500">Current plan</span><strong className="mt-1 block text-base text-slate-900">{profile.plan}</strong></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-bold uppercase tracking-wide text-slate-400">Renewal date</span><strong className="mt-1 block text-sm text-slate-800">{profile.renewalDate || 'Not scheduled'}</strong></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-bold uppercase tracking-wide text-slate-400">Monthly usage</span><strong className="mt-1 block text-sm text-slate-800">{profile.eventsUsed.toLocaleString()} / {profile.eventsQuota.toLocaleString()}</strong></div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4"><span className="text-xs font-bold uppercase tracking-wide text-emerald-600">Tracking protection</span><strong className="mt-1 block text-sm text-emerald-800">Fully enabled</strong></div>
          </div>
          <div>
            <div className="mb-3"><span className="block text-xs font-bold uppercase tracking-wide text-indigo-600">Upgrade your plan</span><h4 className="mt-1 text-base font-black text-slate-900">Choose Growth or Scale</h4></div>
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { tier: 'growth' as const, label: 'Growth Plan', events: '500K events / month', price: 'BDT 899 / month', features: growthPlanFeatures, active: isGrowth },
                { tier: 'scale' as const, label: 'Scale Plan', events: '1M events / month', price: 'BDT 2,499 / month', features: scalePlanFeatures, active: isScale },
              ].map((plan) => (
                <div key={plan.tier} className={`flex flex-col rounded-2xl border p-5 ${plan.tier === 'growth' ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-white' : 'border-slate-200 bg-gradient-to-br from-slate-50 to-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div><span className={`text-xs font-black uppercase tracking-wider ${plan.tier === 'growth' ? 'text-indigo-600' : 'text-slate-500'}`}>{plan.events}</span><h5 className="mt-1 text-xl font-black text-slate-900">{plan.label}</h5><p className="mt-1 font-mono text-sm font-black text-slate-700">{plan.price}</p></div>
                    {plan.active && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black uppercase text-emerald-700">Current</span>}
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    {plan.features.map((feature) => <div key={feature} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"><CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${plan.tier === 'growth' ? 'text-indigo-600' : 'text-emerald-600'}`} /><span>{feature}</span></div>)}
                  </div>
                  <button type="button" disabled={plan.active || isAgency} onClick={() => openPayment(plan.tier)} className={`mt-6 w-full rounded-xl px-4 py-3 text-xs font-black text-white transition disabled:cursor-default disabled:bg-emerald-600 ${plan.tier === 'growth' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-900 hover:bg-slate-800'}`}>{plan.active ? 'Your current plan' : isAgency ? 'Managed by support' : `Choose ${plan.label}`}</button>
                </div>
              ))}
            </div>
          </div>


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
          panelClassName={`relative max-h-[100dvh] w-full overflow-y-auto overscroll-contain rounded-t-2xl shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl ${paymentIntent ? 'max-w-2xl border border-slate-200 bg-white text-slate-900' : 'max-w-lg border border-slate-200 bg-white'}`}
          panelStyle={paymentIntent ? { background: `linear-gradient(145deg, #ffffff 0%, ${paymentBrand.soft} 100%)` } : undefined}
        >
            {paymentIntent && <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at 12% 12%, ${paymentBrand.soft}, transparent 30%), radial-gradient(circle at 88% 86%, ${paymentBrand.soft}, transparent 34%)` }} />}
            <div className="sticky top-0 z-20 flex items-start justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md sm:px-5 sm:py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: paymentIntent ? paymentBrand.primary : '#4f46e5' }}>Secure manual payment</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">Pay for {PLAN_PRICING[paymentPlan].label}</h3>
                {paymentPlan === 'test' && <p className="mt-1 text-xs font-medium text-amber-600">Test only. Your active plan will not change.</p>}
              </div>
              <div className="flex items-start gap-3">
                {paymentIntent && (
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full p-1 shadow-[0_0_24px_rgba(139,92,246,.35)] sm:h-16 sm:w-16"
                    style={{ background: paymentExpired ? '#e2e8f0' : `conic-gradient(${paymentBrand.primary} ${Math.min(100, (paymentSecondsLeft / 300) * 100)}%, #e2e8f0 0)`, boxShadow: `0 0 22px ${paymentBrand.soft}` }}
                  >
                    <div className={`flex h-full w-full items-center justify-center rounded-full border border-slate-200 bg-white font-mono font-black ${paymentExpired ? 'text-xs uppercase tracking-wide text-rose-600 sm:text-xs' : 'text-xs text-slate-900 sm:text-base'}`}>
                      {paymentExpired ? 'Expired' : `${String(Math.floor(paymentSecondsLeft / 60)).padStart(2, '0')}:${String(paymentSecondsLeft % 60).padStart(2, '0')}`}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => setPaymentPlan(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close payment">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative space-y-3 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-4 sm:p-5">
              {!paymentIntent ? (
                <>
                  <div className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: `${paymentBrand.primary}33` }}>
                    <div className="h-1" style={{ background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})` }} />
                    <div className="p-4" style={{ background: `linear-gradient(135deg, #ffffff, ${paymentBrand.soft})` }}>
                      <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: paymentBrand.text }}>Start your secure payment</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">Choose where you will pay from, then enter that account's phone number.</p>
                      <div className="mt-4 grid grid-cols-3 items-start text-center text-xs font-bold uppercase tracking-wide text-slate-500">
                        {['Choose', 'Phone', 'Amount'].map((label, index) => (
                          <div key={label} className="relative">
                            {index < 2 && <span className="absolute left-[58%] top-2 h-px w-[84%] bg-slate-200" />}
                            <span className="relative mx-auto mb-1.5 flex h-4 w-4 items-center justify-center rounded-full text-xs text-white" style={{ background: index === 0 ? paymentBrand.primary : '#cbd5e1' }}>{index + 1}</span>
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { id: 'bkash' as const, name: 'bKash', color: '#E2136E', soft: '#FFF1F7' },
                      { id: 'nagad' as const, name: 'Nagad', color: '#D8292F', soft: '#FFF4ED' },
                    ]).map((provider) => {
                      const selected = paymentProvider === provider.id;
                      return (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => setPaymentProvider(provider.id)}
                          className="relative overflow-hidden rounded-xl border px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md"
                          style={{ borderColor: selected ? provider.color : '#e2e8f0', background: selected ? provider.soft : '#ffffff', boxShadow: selected ? `0 8px 20px ${provider.color}20` : undefined }}
                        >
                          <span className="flex items-center justify-between gap-3">
                            <span>
                              <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">Pay with</span>
                              <span className="mt-0.5 block text-sm font-black" style={{ color: selected ? provider.color : '#475569' }}>{provider.name}</span>
                            </span>
                            <span className="flex h-5 w-5 items-center justify-center rounded-full border" style={{ borderColor: selected ? provider.color : '#cbd5e1', background: selected ? provider.color : '#ffffff' }}>
                              {selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Your {paymentBrand.name} phone number</span>
                    <input value={paymentSender} onChange={(event) => setPaymentSender(event.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" className="w-full rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:ring-2" style={{ borderColor: `${paymentBrand.primary}55`, boxShadow: paymentSender ? `0 0 0 2px ${paymentBrand.soft}` : undefined }} />
                    <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">Use the same number that will appear in the payment SMS.</span>
                  </label>
                  <button type="button" disabled={paymentBusy} onClick={createPayment} className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60" style={{ background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})`, boxShadow: `0 10px 24px ${paymentBrand.primary}30` }}>
                    {paymentBusy ? 'Creating payment...' : 'Show payment amount'}
                  </button>
                </>
              ) : paymentExpired ? (
                <div className="py-3 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white shadow-lg" style={{ background: paymentBrand.soft, color: paymentBrand.primary, boxShadow: `0 12px 30px ${paymentBrand.primary}22` }}>
                    <Clock3 className="h-8 w-8" />
                  </div>
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-rose-600">Payment session expired</p>
                  <h4 className="mt-2 text-xl font-black text-slate-900">Your 5-minute payment window ended</h4>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                    আপনি যদি পেমেন্ট করে থাকেন আর রেফার আইডি দিতে ভুল করে থাকেন বা মিস করে থাকেন, তবে নিচে আপনার ট্রানজেকশন আইডি (TrxID) বসিয়ে <strong>Continue (কন্টিনিউ)</strong> চাপুন।
                  </p>
                  <div className="mx-auto mt-4 max-w-sm rounded-xl border bg-white px-4 py-3 text-xs text-slate-500" style={{ borderColor: `${paymentBrand.primary}33` }}>
                    রেফারেন্স আইডি (Refer ID): <span className="font-mono font-bold text-slate-700">{paymentIntent.paymentReference || 'N/A'}</span>
                  </div>
                  <div className="mx-auto mt-4 max-w-sm text-left">
                    <label htmlFor="expired-payment-trxid" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">Transaction Hash / TrxID</label>
                    <input id="expired-payment-trxid" value={paymentTrxId} onChange={(event) => setPaymentTrxId(event.target.value.toUpperCase())} placeholder="Example: DG765H4K9Q" className="w-full rounded-xl border bg-white px-4 py-3 font-mono text-sm uppercase text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2" style={{ borderColor: `${paymentBrand.primary}66` }} />
                    <button type="button" disabled={paymentBusy || paymentTrxId.trim().length < 6} onClick={submitExpiredPaymentForReview} className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400" style={paymentBusy || paymentTrxId.trim().length < 6 ? undefined : { background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})` }}>
                      {paymentBusy ? 'Submitting...' : 'Continue / কন্টিনিউ'}
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
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-xl border p-3.5 text-white shadow-lg sm:rounded-2xl sm:p-5" style={{ borderColor: `${paymentBrand.primary}55`, background: `linear-gradient(135deg, ${paymentBrand.primary}, ${paymentBrand.secondary})` }}>
                        <div className="pointer-events-none absolute -right-14 -top-16 h-44 w-44 rounded-full border border-white/15 bg-white/10" />
                        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-white/5 blur-xl" />
                        <div className="flex items-start justify-between gap-3">
                          <div className="relative">
                            <span className="rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">{paymentBrand.name} payment number</span>
                            <p className="mt-1.5 text-xs font-semibold text-white/80 sm:mt-2">Send the exact payment to this number</p>
                            <p className="relative mt-2 font-mono text-2xl font-black tracking-[0.07em] text-white sm:mt-3 sm:text-3xl">{paymentIntent.receivingPhone}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <button type="button" onClick={() => navigator.clipboard.writeText(paymentIntent.receivingPhone)} className="relative flex items-center gap-1 rounded-lg border border-white/60 bg-white px-2.5 py-1.5 text-xs font-bold shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50" style={{ color: paymentBrand.text }}><Copy className="h-3.5 w-3.5" /> Copy</button>
                            {paymentQrUrl && (
                              <div className="flex flex-col items-center rounded-xl border border-white/30 bg-white p-1 shadow-md">
                                <img src={paymentQrUrl} alt="Payment Number QR Code" className="h-16 w-16 rounded-md object-contain sm:h-20 sm:w-20" />
                                <span className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-slate-700">Scan Number</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="relative mt-3 rounded-lg border border-white/30 bg-white/20 px-3.5 py-2.5 text-xs leading-relaxed text-white sm:mt-4">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-white/80">রেফারেন্স আইডি (Refer ID)</span>
                          <span className="font-mono text-2xl font-black tracking-wider text-white">{paymentIntent.paymentReference || 'N/A'}</span>
                          <p className="mt-1 text-[11px] leading-relaxed text-white/95">
                            <strong>জরুরি নির্দেশাবলি:</strong> {paymentBrand.name} দিয়ে সেন্ড মানি/পেমেন্ট করার সময় <strong>Reference</strong> ফিল্ডে অবশ্যই <span className="rounded bg-white/30 px-1.5 py-0.5 font-mono text-xs font-black tracking-wide text-white underline">{paymentIntent.paymentReference || '1'}</span> এই রেফার আইডিটি বসাবেন।
                          </p>
                        </div>
                        <div className="relative mt-3 grid grid-cols-3 items-start rounded-lg border border-white/30 bg-white px-2 py-2 text-center text-xs font-bold uppercase tracking-wide shadow-sm sm:mt-4 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs" style={{ color: paymentBrand.text }}>
                          <span className="absolute left-[17%] right-[17%] top-[14px] h-0.5 rounded-full sm:top-[18px]" style={{ background: paymentBrand.primary }} />
                          <div className="relative"><span className="mx-auto mb-1.5 block h-3 w-3 rounded-full border-2" style={{ borderColor: paymentBrand.primary, background: paymentBrand.primary }} />Initiated</div>
                          <div className="relative"><span className="mx-auto mb-1.5 block h-3 w-3 rounded-full border-2 shadow-sm" style={{ borderColor: paymentBrand.primary, background: paymentBrand.primary, boxShadow: `0 0 10px ${paymentBrand.primary}66` }} />Send money</div>
                          <div className="relative"><span className="mx-auto mb-1.5 block h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: paymentBrand.primary, background: paymentIntent.status === 'pending' ? '#ffffff' : paymentBrand.primary }} />Confirmation</div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[.88fr_1.12fr]">
                      <div className="flex min-h-[145px] flex-col items-center justify-center overflow-hidden rounded-xl border px-4 py-4 text-center shadow-sm sm:px-5 sm:py-6 md:min-h-[220px]" style={{ borderColor: `${paymentBrand.primary}33`, background: `linear-gradient(145deg, #ffffff, ${paymentBrand.soft})` }}>
                        <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: paymentBrand.text }}>Pay exactly</p>
                        <p className="mt-1.5 text-3xl font-black tracking-tight sm:mt-2 sm:text-5xl" style={{ color: paymentBrand.primary }}>৳{paymentIntent.totalAmount}</p>
                        <div className="mt-2.5 h-px w-14 sm:mt-4 sm:w-16" style={{ background: `${paymentBrand.primary}55` }} />
                        <p className="mt-2.5 max-w-xs text-xs font-semibold leading-relaxed sm:mt-4 sm:text-xs" style={{ color: paymentBrand.text }}>Send this exact amount. Paying less or more will stop automatic verification.</p>
                      </div>

                    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">Automatic Verification Detection</p>
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-600">Send the exact amount and include reference <span className="font-mono font-bold text-slate-900">{paymentIntent.paymentReference || '1'}</span> above. No TrxID is needed right now.</p>
                      <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50/90 px-3 py-2.5 text-xs font-semibold leading-relaxed text-emerald-800 shadow-xs">
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
                        <span>লাইভ ডিটেকশন চালু রয়েছে — প্রতি ৩ সেকেন্ড পরপর অটোমেটিক পেমেন্ট ভেরিফাই করা হচ্ছে...</span>
                      </div>
                      {paymentFeedback && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-semibold leading-relaxed text-blue-700">
                          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                          <span>{paymentFeedback}</span>
                        </div>
                      )}
                      <div className="mt-auto pt-4">
                        <button type="button" onClick={() => setPaymentIntent(null)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900">Change payment details</button>
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
          onClose={() => setPaymentSuccess(null)}
          ariaLabel="Payment successful"
          overlayClassName="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          panelClassName="relative w-full max-w-md overflow-hidden rounded-2xl border bg-white text-center shadow-2xl"
          panelStyle={{ borderColor: `${paymentBrand.primary}44` }}
        >
            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})` }} />
            <div className="relative p-7" style={{ background: `radial-gradient(circle at 50% 0%, ${paymentBrand.soft}, #ffffff 54%)` }}>
              <div className="relative mx-auto flex h-16 w-16 animate-[pulse_1.4s_ease-in-out_2] items-center justify-center rounded-full border-4 border-white text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${paymentBrand.primary}, ${paymentBrand.secondary})`, boxShadow: `0 12px 28px ${paymentBrand.primary}35` }}>
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
              <button type="button" onClick={() => setPaymentSuccess(null)} className={`${paymentIntent?.status === 'approved_overpaid' ? 'mt-2' : 'mt-6'} w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5`} style={{ background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})`, boxShadow: `0 10px 24px ${paymentBrand.primary}30` }}>
                Continue
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
