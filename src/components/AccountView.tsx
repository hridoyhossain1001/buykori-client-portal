import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ChevronDown, Trash2, UserRound, WalletCards } from 'lucide-react';
import QRCode from 'qrcode';
import type { ClientConnection, UserProfile } from '../types';
import { PageHeader, TabPanel, Tabs, type TabItem } from './common';
import {
  PLAN_PRICING,
  extractPaymentIntent,
  paymentIntentMatchesPlan,
  paymentIntentSecondsRemaining,
  resolvePlanKey,
  type PaymentHistoryItem,
  type PaymentIntent,
  type PaymentProvider,
  type PlanTier,
} from './account/accountTypes';
import { resolvePlanBillingDisplay } from './account/accountStatus';
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

/** The three regions of the Account page, named once for the strip and the state. */
type AccountSectionId = 'profile' | 'billing' | 'danger';

/**
 * Collapses one Account card behind a tap target on a phone, and shows it
 * outright on anything wider.
 *
 * This used to be a `<details>` on every width, unfolded on desktop by an
 * injected `@media (min-width:640px) { details > :not(summary) { display:block
 * !important } }` rule. That rule no longer does anything: current Chrome hides
 * a closed `<details>`'s content through `::details-content`'s
 * `content-visibility`, not through `display` on the children, so `!important`
 * on `display` cannot reach it. The visible result was that Password, Two-step
 * verification and Active sessions rendered in the DOM but were invisible on
 * desktop -- the merchant could not change their password from a laptop.
 *
 * So the width decides which element we render instead of which CSS wins.
 * `matchMedia` is read once for the first paint and then listened to, so
 * dragging a window across 640px switches form without a reload. Nothing is
 * lost by dropping the summary on desktop: every child already prints its own
 * `<h3>` with the same words.
 */
function MobileAccountDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(
    () => typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(min-width: 640px)');
    const sync = () => setExpanded(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  if (expanded) return <>{children}</>;

  return (
    <details className="account-mobile-disclosure group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
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
  const [accountSection, setAccountSection] = useState<AccountSectionId>('profile');
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = useState(false);
  const [paymentHistoryLoaded, setPaymentHistoryLoaded] = useState(false);
  // Distinct from "loaded": a failed request must not read as "never paid".
  const [paymentHistoryReady, setPaymentHistoryReady] = useState(false);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'cancelled' | 'expired'>('all');
  const [paymentPage, setPaymentPage] = useState(1);

  const paymentBrand = paymentProvider === 'bkash'
    ? { name: 'bKash', primary: '#E2136E', secondary: '#A90052', soft: '#FFF1F7', text: '#9D174D' }
    : { name: 'Nagad', primary: '#D8292F', secondary: '#F37021', soft: '#FFF4ED', text: '#9A3412' };
  const paymentExpired = paymentSecondsLeft <= 0 && !!paymentIntent;
  const paymentSenderValid = /^01[3-9]\d{8}$/.test(paymentSender.replace(/\D/g, ''));
  // One reading of the plan label feeds every plan-dependent claim on the screen.
  const planKey = resolvePlanKey(profile.plan);
  const isFree = planKey === 'free';
  const isStarter = planKey === 'starter';
  const isGrowth = planKey === 'growth';
  const isPro = planKey === 'pro';
  const isAgency = planKey === 'agency';
  const billing = resolvePlanBillingDisplay({
    profile,
    paymentHistory,
    paymentHistoryReady,
    now: new Date(),
  });

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
      .then(response => {
        if (!response.ok) throw new Error('Payment history could not be read.');
        return response.json();
      })
      .then(payload => {
        if (!active) return;
        const items: PaymentHistoryItem[] = payload?.payments || payload?.history || payload?.data || [];
        setPaymentHistory(Array.isArray(items) ? items : []);
        setPaymentHistoryReady(true);
        setPaymentHistoryLoaded(true);
      })
      .catch(() => {
        // An unreadable history is not evidence that the plan was never paid for,
        // so it stays "not ready" and the plan header keeps the profile's word.
        if (!active) return;
        setPaymentHistoryReady(false);
        setPaymentHistoryLoaded(true);
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
      if (!paymentIntentMatchesPlan(intent, paymentPlan)) {
        showToast(
          `Payment amount mismatch detected. Expected BDT ${PLAN_PRICING[paymentPlan].amount}. No payment session was opened.`,
          true,
        );
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

  /**
   * The console's own tab strip (`common/Tabs`), not a hand-rolled pill row.
   * Three things come with it that the old row did not have: arrow-key movement
   * between tabs, a roving tabindex so Tab reaches the panel instead of walking
   * through every tab, and `aria-controls` linking each tab to the region it
   * governs. The labels are the full words on every width -- the strip scrolls
   * on a phone -- so "Billing" no longer has to stand in for "Plan & billing".
   */
  const accountTabs: readonly TabItem<AccountSectionId>[] = [
    {
      id: 'profile',
      label: (
        <>
          <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Profile &amp; security
        </>
      ),
    },
    {
      id: 'billing',
      label: (
        <>
          <WalletCards className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Plan &amp; billing
        </>
      ),
    },
    {
      id: 'danger',
      label: (
        <>
          <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Danger zone
        </>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your workspace"
        title="Account"
        description="Your profile and sign-in security, the plan you are on, and every payment on record."
      />

      <Tabs<AccountSectionId>
        tabs={accountTabs}
        activeId={accountSection}
        onChange={setAccountSection}
        label="Account sections"
        idPrefix="account"
      />

      <TabPanel idPrefix="account" tabId="profile" activeId={accountSection} className="focus-visible:outline-none">
        {/* Forms stay on a narrower measure than the tables elsewhere in the
            console: a 1540px-wide text input is harder to fill in, not easier. */}
        <div className="max-w-4xl space-y-5">
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
          <MobileAccountDisclosure title="Password">
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
          </MobileAccountDisclosure>
          <MobileAccountDisclosure title="Two-step verification">
            <TwoStepVerificationCard />
          </MobileAccountDisclosure>
          <MobileAccountDisclosure title="Active sessions">
            <ActiveSessionsCard />
          </MobileAccountDisclosure>
        </div>
      </TabPanel>

      <TabPanel idPrefix="account" tabId="billing" activeId={accountSection} className="space-y-5 focus-visible:outline-none">
        <PlanBillingSection
          profile={profile}
          billing={billing}
          isFree={isFree}
          isStarter={isStarter}
          isGrowth={isGrowth}
          isPro={isPro}
          isAgency={isAgency}
          openPayment={openPayment}
        />
        <PaymentHistorySection
          profile={profile}
          renewal={billing.renewal}
          renewalPrice={billing.renewalPrice}
          paymentHistory={paymentHistory}
          paymentHistoryLoading={paymentHistoryLoading}
          paymentStatusFilter={paymentStatusFilter}
          setPaymentStatusFilter={setPaymentStatusFilter}
          paymentPage={paymentPage}
          setPaymentPage={setPaymentPage}
          onRefresh={() => setPaymentHistoryLoaded(false)}
        />
      </TabPanel>

      <TabPanel idPrefix="account" tabId="danger" activeId={accountSection} className="space-y-5 focus-visible:outline-none">
        <DangerZoneSection
          connection={connection}
          confirmRevokeText={confirmRevokeText}
          setConfirmRevokeText={setConfirmRevokeText}
          handleTokenRevoke={handleTokenRevoke}
          confirmDeleteText={confirmDeleteText}
          setConfirmDeleteText={setConfirmDeleteText}
          handleDeleteAccountRequest={handleDeleteAccountRequest}
        />
      </TabPanel>

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
