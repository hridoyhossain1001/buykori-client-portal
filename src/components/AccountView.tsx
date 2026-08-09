import { useEffect, useState, type FormEvent } from 'react';
import { Trash2, UserRound, WalletCards } from 'lucide-react';
import QRCode from 'qrcode';
import type { ClientConnection, UserProfile } from '../types';
import {
  PLAN_PRICING,
  extractPaymentIntent,
  paymentIntentSecondsRemaining,
  type PaymentHistoryItem,
  type PaymentIntent,
  type PaymentProvider,
  type PlanTier,
} from './account/accountTypes';
import ProfileSummaryCard from './account/ProfileSummaryCard';
import ProfileForm from './account/ProfileForm';
import PasswordSection from './account/PasswordSection';
import { ActiveSessionsCard, TwoStepVerificationCard } from './account/SecuritySessionsSection';
import PlanBillingSection from './account/PlanBillingSection';
import PaymentHistorySection from './account/PaymentHistorySection';
import DangerZoneSection from './account/DangerZoneSection';
import PaymentCheckoutModal from './account/PaymentCheckoutModal';
import PaymentSuccessModal from './account/PaymentSuccessModal';

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
  profNotifyWhatsapp: boolean;
  setProfNotifyWhatsapp: (v: boolean) => void;
  profWhatsappNumber: string;
  setProfWhatsappNumber: (v: string) => void;
  profUpdating: boolean;
  submitProfileSave: (e: FormEvent) => Promise<boolean>;
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
  showToast: (msg: string, isErr?: boolean, action?: { label: string; onClick: () => void }) => void;
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
  showToast,
}: AccountViewProps) {
  const [paymentPlan, setPaymentPlan] = useState<PlanTier | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProvider>('bkash');
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

  const paymentBrand = paymentProvider === 'bkash'
    ? { name: 'bKash', primary: '#E2136E', secondary: '#A90052', soft: '#FFF1F7', text: '#9D174D' }
    : { name: 'Nagad', primary: '#D8292F', secondary: '#F37021', soft: '#FFF4ED', text: '#9A3412' };
  const paymentExpired = paymentSecondsLeft <= 0 && !!paymentIntent;
  const paymentSenderValid = /^01[3-9]\d{8}$/.test(paymentSender.replace(/\D/g, ''));
  const currentPlanLower = (profile.plan || '').toLowerCase();
  const isFree = currentPlanLower.includes('free');
  const isStarter = currentPlanLower.includes('starter');
  const isGrowth = currentPlanLower.includes('growth');
  const isPro = currentPlanLower.includes('pro') || currentPlanLower.includes('scale');
  const isAgency = currentPlanLower.includes('agency');
  const usagePercent = profile.eventsQuota > 0
    ? Math.min(100, (profile.eventsUsed / profile.eventsQuota) * 100)
    : 0;

  const readApiError = async (response: Response, fallback: string) => {
    try {
      const payload = await response.json();
      return payload?.error || payload?.message || payload?.detail || fallback;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    if (!paymentIntent?.receivingPhone) {
      setPaymentQrUrl(null);
      return;
    }
    let active = true;
    QRCode.toDataURL(paymentIntent.receivingPhone, { margin: 1, width: 220 })
      .then(url => {
        if (active) setPaymentQrUrl(url);
      })
      .catch(() => {
        if (active) setPaymentQrUrl(null);
      });
    return () => {
      active = false;
    };
  }, [paymentIntent?.receivingPhone]);

  useEffect(() => {
    if (!paymentIntent || paymentSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setPaymentSecondsLeft(seconds => (seconds > 0 ? seconds - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paymentIntent, paymentSecondsLeft]);

  const finishMatchedPayment = (title: string, message: string) => {
    setPaymentSuccess({ title, message });
    setPaymentPlan(null);
    setPaymentSender('');
    setPaymentTrxId('');
    setPaymentFeedback('');
    setPaymentHistoryLoaded(false);
  };

  const applyPaymentStatus = (intent: PaymentIntent) => {
    setPaymentIntent(intent);
    if (intent.status === 'approved' || intent.status === 'matched') {
      finishMatchedPayment('Payment confirmed', 'Your plan has been activated. Thank you!');
      return;
    }
    if (intent.status === 'approved_overpaid') {
      finishMatchedPayment('Payment confirmed (overpaid)', 'Your plan is active. You can request a refund for the extra amount.');
      return;
    }
    if (intent.status === 'needs_review' || intent.status === 'ambiguous') {
      setPaymentFeedback('We received your submission. Our team is verifying it manually.');
      return;
    }
    if (intent.status === 'underpaid' || intent.status === 'overpaid') {
      setPaymentFeedback('The amount does not match exactly. Support will contact you shortly.');
      return;
    }
    if (intent.status === 'rejected' || intent.status === 'failed' || intent.status === 'cancelled') {
      setPaymentFeedback('This payment could not be verified. Please start a new payment session.');
    }
  };

  const loadPaymentStatus = async (reference: string) => {
    try {
      const response = await fetch(`/api/orders/${reference}/status`);
      if (!response.ok) return;
      const payload = await response.json();
      const intent: PaymentIntent | null = payload?.intent || payload?.data || payload || null;
      if (intent && intent.status && intent.status !== 'pending') {
        applyPaymentStatus({ ...paymentIntent, ...intent } as PaymentIntent);
      }
    } catch {
      /* transient network error - the next poll will retry */
    }
  };

  useEffect(() => {
    if (!paymentIntent?.reference || paymentIntent.status !== 'pending' || paymentExpired) return;
    const reference = paymentIntent.reference;
    const poll = window.setInterval(() => {
      void loadPaymentStatus(reference);
    }, 3000);
    return () => window.clearInterval(poll);
  }, [paymentIntent?.reference, paymentIntent?.status, paymentExpired]);

  useEffect(() => {
    if (accountSection !== 'billing' || paymentHistoryLoaded) return;
    let active = true;
    setPaymentHistoryLoading(true);
    fetch('/api/payments/history?limit=100')
      .then(response => (response.ok ? response.json() : { payments: [] }))
      .then(payload => {
        if (!active) return;
        const items: PaymentHistoryItem[] = payload?.payments || payload?.history || payload?.data || [];
        setPaymentHistory(Array.isArray(items) ? items : []);
        setPaymentHistoryLoaded(true);
      })
      .catch(() => {
        if (active) setPaymentHistoryLoaded(true);
      })
      .finally(() => {
        if (active) setPaymentHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountSection, paymentHistoryLoaded]);

  const openPayment = (plan: PlanTier) => {
    setPaymentPlan(plan);
    setPaymentIntent(null);
    setPaymentTrxId('');
    setPaymentFeedback('');
    setPaymentSecondsLeft(0);
  };

  const createPayment = async () => {
    if (!paymentPlan || !paymentSenderValid) return;
    setPaymentBusy(true);
    setPaymentFeedback('');
    try {
      const response = await fetch('/api/payments/intents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planTier: paymentPlan,
          provider: paymentProvider,
          senderPhone: paymentSender.replace(/\D/g, ''),
        }),
      });
      if (!response.ok) {
        showToast(await readApiError(response, 'Could not start the payment session.'), true);
        return;
      }
      const payload = await response.json();
      const intent = extractPaymentIntent(payload);
      if (!intent) {
        showToast('The payment session response was incomplete. Please try again.', true);
        return;
      }
      const secondsRemaining = paymentIntentSecondsRemaining(intent);
      if (secondsRemaining <= 0) {
        showToast('The payment session expired before it could start. Please try again.', true);
        return;
      }
      setPaymentIntent(intent);
      setPaymentSecondsLeft(secondsRemaining);
    } catch {
      showToast('Network error while starting the payment session.', true);
    } finally {
      setPaymentBusy(false);
    }
  };

  const submitExpiredPaymentForReview = async () => {
    if (!paymentIntent?.reference || paymentTrxId.trim().length < 6) return;
    setPaymentBusy(true);
    try {
      const response = await fetch(`/api/payments/intents/${paymentIntent.reference}/manual-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trxId: paymentTrxId.trim().toUpperCase() }),
      });
      if (!response.ok) {
        showToast(await readApiError(response, 'Could not submit the transaction ID.'), true);
        return;
      }
      const payload = await response.json();
      const intent = extractPaymentIntent(payload);
      if (intent) {
        applyPaymentStatus(intent);
      } else {
        setPaymentFeedback('We received your submission. Our team is verifying it manually.');
      }
      showToast('Transaction ID submitted for verification.', false);
      setPaymentHistoryLoaded(false);
    } catch {
      showToast('Network error while submitting the transaction ID.', true);
    } finally {
      setPaymentBusy(false);
    }
  };

  const requestPaymentRefund = async () => {
    if (!paymentIntent?.reference) return;
    setPaymentBusy(true);
    try {
      const response = await fetch(`/api/payments/intents/${paymentIntent.reference}/refund-request`, {
        method: 'POST',
      });
      if (!response.ok) {
        showToast(await readApiError(response, 'Could not send the refund request.'), true);
        return;
      }
      setPaymentIntent(current => (current ? { ...current, refundStatus: 'requested' } : current));
      showToast('Refund request sent. Support will contact you.', false);
      setPaymentHistoryLoaded(false);
    } catch {
      showToast('Network error while sending the refund request.', true);
    } finally {
      setPaymentBusy(false);
    }
  };

  const accountSections = [
    { id: 'profile' as const, label: 'Profile & Security', icon: UserRound },
    { id: 'billing' as const, label: 'Plan & Billing', icon: WalletCards },
    { id: 'danger' as const, label: 'Danger Zone', icon: Trash2 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Account</h1>
        <p className="mt-1 text-xs text-slate-500">Manage your profile, security, plan and billing details.</p>
      </div>

      <div role="tablist" aria-label="Account sections" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {accountSections.map(section => {
          const Icon = section.icon;
          const active = accountSection === section.id;
          return (
            <button
              key={section.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setAccountSection(section.id)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {section.label}
            </button>
          );
        })}
      </div>

      {accountSection === 'profile' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="order-2 space-y-5 lg:order-1">
            <ProfileForm
                profile={profile}
                profName={profName}
                setProfName={setProfName}
                profEmail={profEmail}
                setProfEmail={setProfEmail}
                profEmailCodeRequested={profEmailCodeRequested}
                profEmailCode={profEmailCode}
                setProfEmailCode={setProfEmailCode}
                profEmailCurrentPassword={profEmailCurrentPassword}
                setProfEmailCurrentPassword={setProfEmailCurrentPassword}
                profNotifEmail={profNotifEmail}
              setProfNotifEmail={setProfNotifEmail}
              profUpdating={profUpdating}
              submitProfileSave={submitProfileSave}
            />
            <PasswordSection
              passCurrent={passCurrent}
              setPassCurrent={setPassCurrent}
              passNew={passNew}
              setPassNew={setPassNew}
              passConfirm={passConfirm}
              setPassConfirm={setPassConfirm}
              submitPasswordUpdate={submitPasswordUpdate}
              submitPasswordResetEmail={submitPasswordResetEmail}
            />
            <TwoStepVerificationCard />
            <ActiveSessionsCard />
          </div>
          <div className="order-1 lg:order-2">
            <ProfileSummaryCard profile={profile} usagePercent={usagePercent} />
          </div>
        </div>
      )}

      {accountSection === 'billing' && (
        <div className="space-y-5">
          <PlanBillingSection
            profile={profile}
            usagePercent={usagePercent}
            isFree={isFree}
            isStarter={isStarter}
            isGrowth={isGrowth}
            isPro={isPro}
            isAgency={isAgency}
            openPayment={openPayment}
          />
          <PaymentHistorySection
            profile={profile}
            paymentHistory={paymentHistory}
            paymentHistoryLoading={paymentHistoryLoading}
            paymentStatusFilter={paymentStatusFilter}
            setPaymentStatusFilter={setPaymentStatusFilter}
            paymentPage={paymentPage}
            setPaymentPage={setPaymentPage}
            onRefresh={() => setPaymentHistoryLoaded(false)}
          />
        </div>
      )}

      {accountSection === 'danger' && (
        <div className="space-y-5">
          <DangerZoneSection
            connection={connection}
            confirmRevokeText={confirmRevokeText}
            setConfirmRevokeText={setConfirmRevokeText}
            handleTokenRevoke={handleTokenRevoke}
            confirmDeleteText={confirmDeleteText}
            setConfirmDeleteText={setConfirmDeleteText}
            handleDeleteAccountRequest={handleDeleteAccountRequest}
          />
        </div>
      )}

      {paymentPlan && (
        <PaymentCheckoutModal
          paymentPlan={paymentPlan}
          onClose={() => setPaymentPlan(null)}
          paymentIntent={paymentIntent}
          setPaymentIntent={setPaymentIntent}
          paymentProvider={paymentProvider}
          setPaymentProvider={setPaymentProvider}
          paymentBrand={paymentBrand}
          paymentExpired={paymentExpired}
          paymentSecondsLeft={paymentSecondsLeft}
          paymentSender={paymentSender}
          setPaymentSender={setPaymentSender}
          paymentSenderValid={paymentSenderValid}
          paymentTrxId={paymentTrxId}
          setPaymentTrxId={setPaymentTrxId}
          paymentBusy={paymentBusy}
          paymentFeedback={paymentFeedback}
          setPaymentFeedback={setPaymentFeedback}
          paymentQrUrl={paymentQrUrl}
          createPayment={createPayment}
          submitExpiredPaymentForReview={submitExpiredPaymentForReview}
        />
      )}

      {paymentSuccess && (
        <PaymentSuccessModal
          paymentSuccess={paymentSuccess}
          paymentIntent={paymentIntent}
          paymentProvider={paymentProvider}
          paymentBrand={paymentBrand}
          paymentBusy={paymentBusy}
          onClose={() => {
            setPaymentSuccess(null);
            setPaymentIntent(null);
          }}
          requestPaymentRefund={requestPaymentRefund}
        />
      )}
    </div>
  );
}

export default AccountView;
