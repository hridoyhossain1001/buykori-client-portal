import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Copy, CreditCard, KeyRound, Loader2, ReceiptText, RotateCcw, ShieldAlert, UserRound, WalletCards, X } from 'lucide-react';
import { UserProfile } from '../types';

const PLAN_PRICING = Object.freeze({
  test: { label: 'Test Payment', events: 'Checks SMS payment only', price: 'BDT 10 + fee' },
  growth: { label: 'Growth Plan', events: '500k Events / mo', price: 'BDT 899 / mo' },
  scale: { label: 'Scale Plan', events: '1M Events / mo', price: 'BDT 2,499 / mo' }
});

type PaymentIntent = {
  reference: string;
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
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentSecondsLeft, setPaymentSecondsLeft] = useState(0);
  const [paymentFeedback, setPaymentFeedback] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<{ title: string; message: string } | null>(null);
  const [accountSection, setAccountSection] = useState<'profile' | 'security' | 'billing' | 'payments' | 'danger'>('profile');
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [paymentHistoryLoaded, setPaymentHistoryLoaded] = useState(false);
  const paymentBrand = paymentProvider === 'bkash'
    ? { name: 'bKash', primary: '#E2136E', secondary: '#A90052', soft: '#FFF1F7', text: '#9D174D' }
    : { name: 'Nagad', primary: '#D8292F', secondary: '#F37021', soft: '#FFF4ED', text: '#9A3412' };
  const paymentExpired = !!paymentIntent && new Date(paymentIntent.expiresAt).getTime() <= Date.now();
  const currentPlanLower = String(profile.plan || '').toLowerCase();
  const isFreeOrTrial = currentPlanLower.includes('free') || currentPlanLower.includes('trial');
  const isGrowth = currentPlanLower.includes('growth');
  const isScale = currentPlanLower.includes('scale');
  const isAgency = currentPlanLower.includes('agency');
  const emailChanged = profEmail.trim().toLowerCase() !== profile.email.trim().toLowerCase();
  const planFeatures = profile.planFeatures?.length ? profile.planFeatures : [
    {
      key: 'client_alerts',
      label: 'Telegram order alerts',
      description: 'Purchase and recovery notifications can be sent securely to the store owner by Telegram.',
      included: !!profile.growthFeaturesEnabled,
      minimumPlan: 'Growth',
    },
    {
      key: 'incomplete_checkout_recovery',
      label: 'Incomplete checkout recovery',
      description: 'Abandoned checkout leads can be reviewed, contacted, and recovered from the portal.',
      included: !!profile.growthFeaturesEnabled,
      minimumPlan: 'Growth',
    },
  ];
  
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

  const finishMatchedPayment = (intent: PaymentIntent) => {
    const isTest = intent.planTier === 'test';
    const isApproved = intent.status === 'approved';
    const needsReview = intent.status === 'needs_review';
    setPaymentIntent(intent);
    setPaymentPlan(null);
    setPaymentFeedback('');
    setPaymentSuccess({
      title: needsReview ? 'Payment found - review needed' : isTest ? 'Payment test successful!' : isApproved ? 'Payment approved!' : 'Payment received successfully!',
      message: needsReview
        ? 'The Cash In SMS matched your details. Our team will confirm it after a quick manual review.'
        : isTest
        ? 'The SMS, sender number, amount, and TrxID matched correctly. Your current plan was not changed.'
        : isApproved
          ? `Your ${PLAN_PRICING[intent.planTier as 'growth' | 'scale']?.label || 'paid plan'} is now active.`
          : 'Your payment matched successfully. We will activate your plan after a quick review.',
    });
  };

  const applyPaymentStatus = (intent: PaymentIntent, showStatusToast = false) => {
    if (['matched', 'needs_review', 'approved'].includes(intent.status)) {
      finishMatchedPayment(intent);
      return;
    }
    setPaymentIntent(intent);
    if (intent.status === 'pending') {
      setPaymentFeedback('TrxID received. Waiting for the payment SMS to reach our server...');
    } else {
      setPaymentFeedback(`Payment status: ${intent.status.replaceAll('_', ' ')}.`);
    }
    if (showStatusToast) showToast(`Payment status: ${intent.status.replaceAll('_', ' ')}`);
  };

  const loadPaymentStatus = async (showStatusToast = false) => {
    const response = await fetch('/api/payments/intents/latest');
    if (!response.ok) throw new Error(await readApiError(response));
    const payload = await response.json();
    if (payload.payment) applyPaymentStatus(payload.payment, showStatusToast);
  };

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
    if (!paymentIntent?.trxId || paymentIntent.status !== 'pending') return;
    const timer = window.setInterval(() => {
      void loadPaymentStatus(false).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [paymentIntent?.reference, paymentIntent?.status, paymentIntent?.trxId]);

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

  const submitPayment = async () => {
    if (!paymentIntent) return;
    setPaymentBusy(true);
    try {
      const response = await fetch(`/api/payments/intents/${encodeURIComponent(paymentIntent.reference)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trxId: paymentTrxId }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = await response.json();
      applyPaymentStatus(payload.payment);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not submit transaction.', true);
    } finally {
      setPaymentBusy(false);
    }
  };

  const checkPayment = async () => {
    setPaymentBusy(true);
    try {
      await loadPaymentStatus(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not check payment status.', true);
    } finally {
      setPaymentBusy(false);
    }
  };

  const accountSections = [
    { id: 'profile' as const, label: 'Profile', icon: UserRound },
    { id: 'security' as const, label: 'Security', icon: KeyRound },
    { id: 'billing' as const, label: 'Plan & Billing', icon: WalletCards },
    { id: 'payments' as const, label: 'Payment History', icon: ReceiptText },
    { id: 'danger' as const, label: 'Danger Zone', icon: ShieldAlert },
  ];

  const statusClasses = (paymentStatus: string) => {
    if (['approved', 'matched'].includes(paymentStatus)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (['needs_review', 'ambiguous'].includes(paymentStatus)) return 'border-amber-200 bg-amber-50 text-amber-700';
    if (paymentStatus === 'pending') return 'border-blue-200 bg-blue-50 text-blue-700';
    if (['rejected', 'failed'].includes(paymentStatus)) return 'border-rose-200 bg-rose-50 text-rose-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Account sections">
          {accountSections.map((section) => {
            const Icon = section.icon;
            const active = accountSection === section.id;
            return (
              <button key={section.id} type="button" role="tab" aria-selected={active} onClick={() => setAccountSection(section.id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-bold transition ${active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
                <Icon className="h-4 w-4" /> {section.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-8 ${accountSection === 'billing' ? 'lg:grid-cols-3' : ''}`}>
      
      {/* Edit forms */}
      <div className={`${accountSection === 'billing' ? 'lg:col-span-2' : ''} space-y-6`}>
        
        {/* Account detail profile save */}
        {accountSection === 'profile' && <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-4 ">Edit Profile</h3>
          
          <form onSubmit={submitProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Display Name</label>
                <input 
                  type="text" 
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Profile Email</label>
                <input 
                  type="email" 
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded"
                />
                {emailChanged && !profEmailCodeRequested && (
                  <p className="mt-1 text-[10px] leading-relaxed text-amber-600">Click the button below. We will send a code to your new email.</p>
                )}
              </div>
            </div>

            {emailChanged && profEmailCodeRequested && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-indigo-200 bg-indigo-50 p-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-indigo-500">Verification Code</label>
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
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-indigo-500">Current Password</label>
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
              <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Notification Email</label>
              <input 
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
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
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
        {accountSection === 'security' && <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-4 ">Change Password</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Current Password</label>
                <input 
                  type="password" 
                  value={passCurrent} 
                  placeholder="**************"
                  onChange={(e) => setPassCurrent(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">New Password</label>
                <input 
                  type="password" 
                  value={passNew} 
                  placeholder="Enter secure password"
                  onChange={(e) => setPassNew(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-slate-400  uppercase mb-1">Confirm New Password</label>
                <input 
                  type="password" 
                  value={passConfirm} 
                  placeholder="Confirm secure password"
                  onChange={(e) => setPassConfirm(e.target.value)}
                  className="w-full p-2 text-xs bg-slate-50 border border-slate-200    rounded font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={submitPasswordResetEmail}
                className="text-left text-xs font-bold text-indigo-600 hover:text-indigo-700 underline-offset-4 hover:underline"
              >
                Forgot current password? Send reset link
              </button>
              <button 
                type="button"
                onClick={submitPasswordUpdate}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
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
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">Date</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Payment</th><th className="px-4 py-3">Sender / TrxID</th><th className="px-4 py-3">Amount</th><th className="px-5 py-3 text-right">Status</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentHistory.map((payment) => (
                      <tr key={payment.reference} className="hover:bg-slate-50/70">
                        <td className="whitespace-nowrap px-5 py-4"><span className="block font-semibold text-slate-700">{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '-'}</span><span className="mt-0.5 block text-[10px] text-slate-400">{payment.createdAt ? new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span></td>
                        <td className="px-4 py-4"><span className="font-bold capitalize text-slate-800">{payment.planTier}</span>{payment.isTest && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-700">Test</span>}<span className="mt-1 block font-mono text-[9px] text-slate-400">{payment.reference}</span></td>
                        <td className="px-4 py-4"><span className="font-bold capitalize text-slate-700">{payment.provider}</span><span className="mt-1 block text-[10px] capitalize text-slate-400">{payment.paymentType?.replaceAll('_', ' ') || 'Awaiting SMS'}</span></td>
                        <td className="px-4 py-4"><span className="block font-mono font-semibold text-slate-700">{payment.senderPhone || '-'}</span><span className="mt-1 block font-mono text-[10px] text-slate-400">{payment.trxId || 'TrxID not submitted'}</span></td>
                        <td className="px-4 py-4"><span className="font-black text-slate-900">BDT {payment.totalAmount}</span><span className="mt-1 block text-[10px] text-slate-400">Price {payment.baseAmount} + fee {payment.feeAmount}</span></td>
                        <td className="px-5 py-4 text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${statusClasses(payment.status)}`}>{payment.status.replaceAll('_', ' ')}</span></td>
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div>
            <span className="text-[10px] font-bold text-indigo-600  uppercase tracking-wider block">Your Plan</span>
            <h3 className="text-lg font-bold text-slate-800  mt-1">{profile.plan}</h3>
            <p className="text-[11px] text-slate-400  mt-0.5">Billing changes are handled by support</p>
          </div>

          <div className="space-y-2 text-xs text-slate-700  font-medium">
            <div className="flex justify-between border-b border-slate-100  pb-2">
              <span className="text-slate-400 ">Monthly renewal date:</span>
              <span className="font-semibold text-slate-800 ">{profile.renewalDate}</span>
            </div>
            
            <div className="flex justify-between border-b border-slate-100  pb-2">
              <span className="text-slate-400 ">Monthly Usage:</span>
              <span className="font-semibold text-slate-800 ">{(profile.eventsUsed).toLocaleString()} / {profile.eventsQuota.toLocaleString()} counts</span>
            </div>

            <div className="flex justify-between pb-2">
              <span className="text-slate-400 ">Ad Blocker Bypass:</span>
              <span className="font-semibold text-indigo-700 ">Fully Enabled ✓</span>
            </div>
          </div>

          <div className="h-px bg-slate-100 " />

          <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Growth features</span>
              {profile.growthFeaturesEnabled ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Included</span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Upgrade required</span>
              )}
            </div>
            <div className="space-y-2">
              {planFeatures.map((feature) => (
                <div key={feature.key} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 flex h-4 min-w-7 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-black ${feature.included ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {feature.included ? 'Yes' : 'No'}
                  </span>
                  <div>
                    <div className="font-bold text-slate-800 ">{feature.label}</div>
                    <p className="text-[11px] leading-snug text-slate-500 ">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-slate-100 " />

          <div>
            <span className="block text-[10px] font-bold text-slate-400  uppercase tracking-wide mb-2">Upgrade Plan</span>
            {isScale ? (
              <div className="p-4 border border-indigo-200  rounded bg-indigo-50/20  text-center space-y-2">
                <span className="font-bold text-slate-800  block text-xs uppercase tracking-wide">You are on our highest standard plan</span>
                <p className="text-[11px] text-slate-500  leading-relaxed">For custom event volume, extra tracking routes, or higher usage limits, please contact support.</p>
                <button 
                  onClick={() => showToast("Custom billing requests are not automated here. Contact support@buykori.app.", true)}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-[10px] cursor-pointer shadow-sm transition-colors"
                  type="button"
                >
                  Contact Enterprise Support
                </button>
              </div>
            ) : isAgency ? (
              <div className="p-4 border border-slate-200  rounded bg-slate-50/50  text-center space-y-2">
                <span className="font-bold text-slate-800  block text-xs uppercase tracking-wide">Active Premium Agency Plan</span>
                <p className="text-[11px] text-slate-500  leading-relaxed">Your account is configured with a customized event volume capacity.</p>
                <button 
                  onClick={() => showToast("Contact support@buykori.app for any plan modifications.", true)}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-semibold text-[10px] cursor-pointer shadow-sm transition-colors"
                  type="button"
                >
                  Contact Support
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-center text-xs">
                {isFreeOrTrial && (
                  <div className="p-3 border border-indigo-200  rounded bg-indigo-50/50  flex flex-col justify-between">
                    <span className="font-bold text-slate-800  leading-none">{PLAN_PRICING.growth.label}</span>
                    <span className="text-[10px] text-indigo-600  mt-1 leading-none">{PLAN_PRICING.growth.events}</span>
                    <span className="text-xs font-mono font-extrabold mt-3 text-indigo-700 ">{PLAN_PRICING.growth.price}</span>
                    <button 
                      onClick={() => openPayment('growth')}
                      className="mt-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold text-[10px] cursor-pointer"
                      type="button"
                    >
                      Upgrade Plan
                    </button>
                  </div>
                )}
                
                <div className="p-3 border border-slate-200  rounded hover:bg-slate-50  flex flex-col justify-between">
                  <span className="font-bold text-slate-800  leading-none">{PLAN_PRICING.scale.label}</span>
                  <span className="text-[10px] text-slate-400  mt-1 leading-none font-medium">{PLAN_PRICING.scale.events}</span>
                  <span className="text-xs font-mono font-extrabold mt-3 text-slate-700 ">{PLAN_PRICING.scale.price}</span>
                  <button 
                    onClick={() => openPayment('scale')}
                    className="mt-3 py-1 bg-slate-800 hover:bg-slate-900   text-white rounded font-semibold text-[10px] cursor-pointer"
                    type="button"
                  >
                    Upgrade Plan
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/70 p-3 text-center">
            <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-700">Payment system check</span>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800">Make a small payment to test SMS matching. This will not change your plan.</p>
            <button
              type="button"
              onClick={() => openPayment('test')}
              className="mt-2 w-full rounded-lg bg-amber-500 px-3 py-2 text-[11px] font-bold text-white hover:bg-amber-600"
            >
              Test with BDT 10 + fee
            </button>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Plan payment">
          <div
            className={`relative w-full overflow-hidden rounded-2xl shadow-2xl ${paymentIntent ? 'max-w-2xl border border-slate-200 bg-white text-slate-900' : 'max-w-lg border border-slate-200 bg-white'}`}
            style={paymentIntent ? { background: `linear-gradient(145deg, #ffffff 0%, ${paymentBrand.soft} 100%)` } : undefined}
          >
            {paymentIntent && <div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: `radial-gradient(circle at 12% 12%, ${paymentBrand.soft}, transparent 30%), radial-gradient(circle at 88% 86%, ${paymentBrand.soft}, transparent 34%)` }} />}
            <div className="relative flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: paymentIntent ? paymentBrand.primary : '#4f46e5' }}>Secure manual payment</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">Pay for {PLAN_PRICING[paymentPlan].label}</h3>
                {paymentPlan === 'test' && <p className="mt-1 text-xs font-medium text-amber-600">Test only. Your active plan will not change.</p>}
              </div>
              <div className="flex items-start gap-3">
                {paymentIntent && (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full p-1 shadow-[0_0_24px_rgba(139,92,246,.35)]"
                    style={{ background: paymentExpired ? '#e2e8f0' : `conic-gradient(${paymentBrand.primary} ${Math.min(100, (paymentSecondsLeft / 600) * 100)}%, #e2e8f0 0)`, boxShadow: `0 0 22px ${paymentBrand.soft}` }}
                  >
                    <div className={`flex h-full w-full items-center justify-center rounded-full border border-slate-200 bg-white font-mono font-black ${paymentExpired ? 'text-[10px] uppercase tracking-wide text-rose-600' : 'text-base text-slate-900'}`}>
                      {paymentExpired ? 'Expired' : `${String(Math.floor(paymentSecondsLeft / 60)).padStart(2, '0')}:${String(paymentSecondsLeft % 60).padStart(2, '0')}`}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => setPaymentPlan(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close payment">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative space-y-4 p-5">
              {!paymentIntent ? (
                <>
                  <div className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: `${paymentBrand.primary}33` }}>
                    <div className="h-1" style={{ background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})` }} />
                    <div className="p-4" style={{ background: `linear-gradient(135deg, #ffffff, ${paymentBrand.soft})` }}>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: paymentBrand.text }}>Start your secure payment</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">Choose where you will pay from, then enter that account's phone number.</p>
                      <div className="mt-4 grid grid-cols-3 items-start text-center text-[9px] font-bold uppercase tracking-wide text-slate-500">
                        {['Choose', 'Phone', 'Amount'].map((label, index) => (
                          <div key={label} className="relative">
                            {index < 2 && <span className="absolute left-[58%] top-2 h-px w-[84%] bg-slate-200" />}
                            <span className="relative mx-auto mb-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[8px] text-white" style={{ background: index === 0 ? paymentBrand.primary : '#cbd5e1' }}>{index + 1}</span>
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
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Pay with</span>
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
                    <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Your {paymentBrand.name} phone number</span>
                    <input value={paymentSender} onChange={(event) => setPaymentSender(event.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" className="w-full rounded-xl border bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:ring-2" style={{ borderColor: `${paymentBrand.primary}55`, boxShadow: paymentSender ? `0 0 0 2px ${paymentBrand.soft}` : undefined }} />
                    <span className="mt-1.5 block text-[10px] leading-relaxed text-slate-500">Use the same number that will appear in the payment SMS.</span>
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
                  <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-rose-600">Payment session expired</p>
                  <h4 className="mt-2 text-xl font-black text-slate-900">Your 10-minute payment time has ended</h4>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">For your safety, this payment reference can no longer be used. Start again to get a fresh amount, timer, and reference.</p>
                  <div className="mx-auto mt-4 max-w-sm rounded-xl border bg-white px-4 py-3 text-xs text-slate-500" style={{ borderColor: `${paymentBrand.primary}33` }}>
                    Expired reference: <span className="font-mono font-bold text-slate-700">{paymentIntent.reference}</span>
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
                  <div className="grid gap-4 md:grid-cols-[1.08fr_.92fr]">
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="grid grid-cols-2 divide-x divide-slate-200 text-center">
                          <div className="px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{paymentPlan === 'test' ? 'Test amount' : 'Plan price'}</p><p className="mt-1 text-base font-bold text-slate-900">৳{paymentIntent.baseAmount}</p></div>
                          <div className="px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Fee ({paymentIntent.feeRatePercent}%)</p><p className="mt-1 text-base font-bold text-slate-900">৳{paymentIntent.feeAmount}</p></div>
                        </div>
                        <div className="border-t px-4 py-3 text-center" style={{ borderColor: `${paymentBrand.primary}33`, background: paymentBrand.soft }}>
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: paymentBrand.text }}>Pay exactly</p>
                          <p className="mt-1 text-3xl font-black tracking-tight" style={{ color: paymentBrand.primary }}>৳{paymentIntent.totalAmount}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border p-4 text-white shadow-lg" style={{ borderColor: `${paymentBrand.primary}55`, background: `linear-gradient(135deg, ${paymentBrand.primary}, ${paymentBrand.secondary})` }}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full border border-white/40 bg-white/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">{paymentBrand.name} number</span>
                          <button type="button" onClick={() => navigator.clipboard.writeText(paymentIntent.receivingPhone)} className="flex items-center gap-1 rounded-lg border border-white/50 bg-white px-3 py-2 text-xs font-bold shadow-sm hover:bg-slate-50" style={{ color: paymentBrand.text }}><Copy className="h-3.5 w-3.5" /> Copy</button>
                        </div>
                        <p className="mt-3 font-mono text-2xl font-black tracking-[0.08em] text-white">{paymentIntent.receivingPhone}</p>
                        <div className="mt-4 grid grid-cols-3 items-start rounded-lg bg-white px-2 py-2.5 text-center text-[8px] font-bold uppercase tracking-wide shadow-sm" style={{ color: paymentBrand.text }}>
                          <div><span className="mx-auto mb-1 block h-3 w-3 rounded-full border-2" style={{ borderColor: paymentBrand.primary, background: paymentBrand.primary }} />Initiated</div>
                          <div><span className="mx-auto mb-1 block h-3 w-3 rounded-full border-2 shadow-sm" style={{ borderColor: paymentBrand.primary, background: paymentBrand.primary, boxShadow: `0 0 10px ${paymentBrand.primary}66` }} />Send money</div>
                          <div><span className="mx-auto mb-1 block h-3 w-3 rounded-full border-2 bg-white" style={{ borderColor: paymentBrand.primary, background: paymentIntent.status === 'pending' ? '#ffffff' : paymentBrand.primary }} />Confirmation</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-600">Transaction ID (TrxID)</span>
                        <input value={paymentTrxId} onChange={(event) => setPaymentTrxId(event.target.value.toUpperCase())} placeholder="Example: DG765H4K9Q" className="w-full rounded-xl border bg-white px-4 py-3 font-mono text-sm uppercase text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2" style={{ borderColor: `${paymentBrand.primary}66`, boxShadow: paymentTrxId ? `0 0 0 2px ${paymentBrand.soft}` : undefined }} />
                      </label>
                      <div className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[10px] leading-relaxed" style={{ borderColor: `${paymentBrand.primary}33`, background: paymentBrand.soft, color: paymentBrand.text }}>
                        <Clock3 className={`h-4 w-4 shrink-0 ${paymentSecondsLeft <= 120 ? 'text-rose-600' : ''}`} style={paymentSecondsLeft > 120 ? { color: paymentBrand.primary } : undefined} />
                        Finish within the timer. Cash In payments need a quick manual review.
                      </div>
                      {paymentFeedback && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-300/25 bg-blue-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-blue-100">
                          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                          <span>{paymentFeedback} We will check automatically.</span>
                        </div>
                      )}
                      <div className="mt-auto pt-4">
                        <button type="button" disabled={paymentBusy || paymentTrxId.trim().length < 6} onClick={submitPayment} className="w-full rounded-xl border px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400" style={paymentBusy || paymentTrxId.trim().length < 6 ? undefined : { borderColor: paymentBrand.primary, background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})`, boxShadow: `0 8px 22px ${paymentBrand.primary}33` }}>
                          {paymentBusy ? 'Checking payment...' : paymentIntent.trxId ? 'Check payment again' : paymentTrxId.trim().length < 6 ? 'Enter TrxID to continue' : 'I have paid - check payment'}
                        </button>
                        <button type="button" onClick={() => setPaymentIntent(null)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-900">Change payment details</button>
                      </div>
                    </div>
                  </div>
                  {paymentIntent.trxId && (
                    <button type="button" disabled={paymentBusy} onClick={checkPayment} className="w-full rounded-xl border bg-white px-4 py-2.5 text-xs font-bold hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: `${paymentBrand.primary}44`, color: paymentBrand.text }}>
                      Check payment status · {paymentIntent.status.replaceAll('_', ' ')}
                    </button>
                  )}
                  <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400">
                    <span>Reference: {paymentIntent.reference}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(paymentIntent.reference)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Copy payment reference"><Copy className="h-3 w-3" /></button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {paymentSuccess && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Payment successful">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-white text-center shadow-2xl" style={{ borderColor: `${paymentBrand.primary}44` }}>
            <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})` }} />
            <div className="relative p-7" style={{ background: `radial-gradient(circle at 50% 0%, ${paymentBrand.soft}, #ffffff 54%)` }}>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${paymentBrand.primary}, ${paymentBrand.secondary})`, boxShadow: `0 12px 28px ${paymentBrand.primary}35` }}>
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: paymentBrand.text }}>{paymentBrand.name} payment update</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">{paymentSuccess.title}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">{paymentSuccess.message}</p>
              {paymentIntent?.reference && (
                <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-500" style={{ borderColor: `${paymentBrand.primary}33` }}>
                  Reference: {paymentIntent.reference}
                </div>
              )}
              <button type="button" onClick={() => setPaymentSuccess(null)} className="mt-6 w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5" style={{ background: `linear-gradient(90deg, ${paymentBrand.primary}, ${paymentBrand.secondary})`, boxShadow: `0 10px 24px ${paymentBrand.primary}30` }}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
