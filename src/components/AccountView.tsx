import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Copy, Loader2, RotateCcw, X } from 'lucide-react';
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Edit forms */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Account detail profile save */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
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
        </div>

        {/* Password modifier */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm  ">
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
        </div>

        {/* Danger parameters */}
        <div className="rounded-xl border border-rose-200 bg-rose-50   p-6 shadow-sm space-y-6">
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
        </div>

      </div>

      {/* Left side subscriptions container */}
      <div className="space-y-6">
        
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

      </div>

      {paymentPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Plan payment">
          <div
            className={`relative w-full overflow-hidden rounded-2xl shadow-2xl ${paymentIntent ? 'max-w-2xl border border-slate-700 bg-slate-900 text-white' : 'max-w-lg border border-slate-200 bg-white'}`}
            style={paymentIntent ? { background: 'linear-gradient(145deg, #111827 0%, #1e293b 52%, #0f172a 100%)' } : undefined}
          >
            {paymentIntent && <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 12% 12%, rgba(139,92,246,.35), transparent 28%), radial-gradient(circle at 88% 86%, rgba(245,158,11,.18), transparent 30%)' }} />}
            <div className={`relative flex items-start justify-between px-5 py-4 ${paymentIntent ? 'border-b border-white/10' : 'border-b border-slate-100'}`}>
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${paymentIntent ? 'text-violet-300' : 'text-indigo-600'}`}>Secure manual payment</p>
                <h3 className={`mt-1 text-lg font-bold ${paymentIntent ? 'text-white' : 'text-slate-900'}`}>Pay for {PLAN_PRICING[paymentPlan].label}</h3>
                {paymentPlan === 'test' && <p className={`mt-1 text-xs font-medium ${paymentIntent ? 'text-amber-300' : 'text-amber-600'}`}>Test only. Your active plan will not change.</p>}
              </div>
              <div className="flex items-start gap-3">
                {paymentIntent && (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full p-1 shadow-[0_0_24px_rgba(139,92,246,.35)]"
                    style={{ background: `conic-gradient(#a78bfa ${Math.min(100, (paymentSecondsLeft / 600) * 100)}%, #334155 0)` }}
                  >
                    <div className="flex h-full w-full items-center justify-center rounded-full border border-white/20 bg-slate-950 font-mono text-base font-black text-white">
                      {String(Math.floor(paymentSecondsLeft / 60)).padStart(2, '0')}:{String(paymentSecondsLeft % 60).padStart(2, '0')}
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => setPaymentPlan(null)} className={`rounded-lg p-2 ${paymentIntent ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`} aria-label="Close payment">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative space-y-4 p-5">
              {!paymentIntent ? (
                <>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-xs text-slate-700">
                    Enter the number you will pay from. We use it with the transaction ID to find the correct payment.
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => setPaymentProvider('bkash')} className={`rounded-xl border px-4 py-3 text-sm font-bold ${paymentProvider === 'bkash' ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 text-slate-600'}`}>bKash</button>
                    <button type="button" onClick={() => setPaymentProvider('nagad')} className={`rounded-xl border px-4 py-3 text-sm font-bold ${paymentProvider === 'nagad' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 text-slate-600'}`}>Nagad</button>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Your sender phone</span>
                    <input value={paymentSender} onChange={(event) => setPaymentSender(event.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500" />
                  </label>
                  <button type="button" disabled={paymentBusy} onClick={createPayment} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                    {paymentBusy ? 'Creating payment...' : 'Show payment amount'}
                  </button>
                </>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-[1.08fr_.92fr]">
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-xl border border-slate-600 bg-slate-800 shadow-inner">
                        <div className="grid grid-cols-2 divide-x divide-white/10 text-center">
                          <div className="px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{paymentPlan === 'test' ? 'Test amount' : 'Plan price'}</p><p className="mt-1 text-base font-bold text-white">৳{paymentIntent.baseAmount}</p></div>
                          <div className="px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Fee ({paymentIntent.feeRatePercent}%)</p><p className="mt-1 text-base font-bold text-white">৳{paymentIntent.feeAmount}</p></div>
                        </div>
                        <div className="border-t border-violet-400/40 bg-slate-900 px-4 py-3 text-center" style={{ background: 'linear-gradient(90deg, rgba(124,58,237,.18), rgba(245,158,11,.13), rgba(124,58,237,.18))' }}>
                          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-200">Pay exactly</p>
                          <p className="mt-1 text-3xl font-black tracking-tight text-amber-200 drop-shadow-[0_0_12px_rgba(253,230,138,.35)]">৳{paymentIntent.totalAmount}</p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-600 bg-slate-950 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-violet-200">{paymentProvider === 'bkash' ? 'bKash' : 'Nagad'} number</span>
                          <button type="button" onClick={() => navigator.clipboard.writeText(paymentIntent.receivingPhone)} className="flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"><Copy className="h-3.5 w-3.5" /> Copy</button>
                        </div>
                        <p className="mt-3 font-mono text-2xl font-black tracking-[0.08em] text-white">{paymentIntent.receivingPhone}</p>
                        <div className="mt-4 grid grid-cols-3 items-start text-center text-[8px] font-bold uppercase tracking-wide text-slate-400">
                          <div><span className="mx-auto mb-1 block h-3 w-3 rounded-full border-2 border-violet-300 bg-violet-400" />Initiated</div>
                          <div><span className="mx-auto mb-1 block h-3 w-3 rounded-full border-2 border-violet-200 bg-violet-300 shadow-[0_0_12px_#a78bfa]" />Send money</div>
                          <div><span className={`mx-auto mb-1 block h-3 w-3 rounded-full border-2 ${paymentIntent.status === 'pending' ? 'border-slate-500 bg-slate-700' : 'border-emerald-300 bg-emerald-400'}`} />Confirmation</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col rounded-xl border border-slate-600 bg-slate-800 p-4">
                      <label className="block">
                        <span className="mb-2 block text-[10px] font-bold uppercase tracking-wide text-slate-300">Transaction ID (TrxID)</span>
                        <input value={paymentTrxId} onChange={(event) => setPaymentTrxId(event.target.value.toUpperCase())} placeholder="Example: DG765H4K9Q" className="w-full rounded-xl border border-violet-400 bg-slate-950 px-4 py-3 font-mono text-sm uppercase text-white outline-none placeholder:text-slate-500 focus:border-violet-300 focus:ring-2 focus:ring-violet-400" />
                      </label>
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-[10px] leading-relaxed text-slate-300">
                        <Clock3 className={`h-4 w-4 shrink-0 ${paymentSecondsLeft <= 120 ? 'text-rose-400' : 'text-violet-300'}`} />
                        Finish within the timer. Cash In payments need a quick manual review.
                      </div>
                      {paymentFeedback && (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-300/25 bg-blue-400/10 px-3 py-2.5 text-[11px] leading-relaxed text-blue-100">
                          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                          <span>{paymentFeedback} We will check automatically.</span>
                        </div>
                      )}
                      <div className="mt-auto pt-4">
                        <button type="button" disabled={paymentBusy || paymentTrxId.trim().length < 6} onClick={submitPayment} className="w-full rounded-xl border border-violet-400 bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400" style={paymentBusy || paymentTrxId.trim().length < 6 ? undefined : { background: 'linear-gradient(90deg, #4f46e5, #7c3aed, #4f46e5)', boxShadow: '0 0 22px rgba(124,58,237,.3)' }}>
                          {paymentBusy ? 'Checking payment...' : paymentIntent.trxId ? 'Check payment again' : 'I have paid - check payment'}
                        </button>
                        <button type="button" onClick={() => setPaymentIntent(null)} className="mt-2 w-full rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white">Change payment details</button>
                      </div>
                    </div>
                  </div>
                  {paymentIntent.trxId && (
                    <button type="button" disabled={paymentBusy} onClick={checkPayment} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-violet-200 hover:bg-white/10 disabled:opacity-50">
                      Check payment status · {paymentIntent.status.replaceAll('_', ' ')}
                    </button>
                  )}
                  <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500">
                    <span>Reference: {paymentIntent.reference}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(paymentIntent.reference)} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Copy payment reference"><Copy className="h-3 w-3" /></button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {paymentSuccess && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Payment successful">
          <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">Payment update</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">{paymentSuccess.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{paymentSuccess.message}</p>
            <button type="button" onClick={() => setPaymentSuccess(null)} className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
