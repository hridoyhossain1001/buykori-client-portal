/**
 * Plan catalogue - the one source of truth for what a plan includes.
 *
 * Every allowance used to be written down twice: once as prose inside the plan
 * card copy and once as a short string in PLAN_PRICING, while the account's
 * enforced ceiling arrived separately from /api/profile. Nothing reconciled
 * them, so a Growth account could advertise "500,000 tracked events" on its
 * card directly above a "50K" usage meter and no code noticed. Each fact below
 * is stated once, as a number, and every string the portal renders is derived
 * from it.
 */
export type PlanKey = 'free' | 'starter' | 'growth' | 'pro' | 'agency';

interface PlanFacts {
  key: PlanKey;
  /** Short name on the plan card. */
  label: string;
  subtitle: string;
  /** Monthly event ceiling, or null when the allowance is agreed per account. */
  eventsQuota: number | null;
  ordersQuota: number | null;
  stores: number | null;
  /** Retained event history, or null when the plan card does not state one. */
  historyDays: number | null;
  /** Exact monthly charge, or null when billing is handled by support. */
  amount: string | null;
  /** Replaces the amount wherever there is no fixed monthly charge to state. */
  billingCopy: string | null;
  /** Card copy that is not derived from the numbers above. */
  extraFeatures: readonly string[];
}

export interface PlanEntitlement extends PlanFacts {
  /** Checkout and summary name, e.g. "Starter Plan". */
  planName: string;
  /** Plan card headline, e.g. "BDT 499" or "Contact us". */
  cardPrice: string;
  /** Current-plan line, e.g. "BDT 499 / month", "Free", "Custom billing". */
  monthlyPrice: string;
  /** Recurring charge shown beside a renewal date, e.g. "BDT 499". */
  renewalPrice: string;
  /** Plan card bullets, with the allowance stated exactly once. */
  features: readonly string[];
}

/**
 * The plan cards are fixed English marketing copy, so their thousands
 * separators are pinned to en-US: the number in the sentence has to be the same
 * number as the catalogue entry whatever locale the browser reports.
 */
const planNumber = (value: number) => value.toLocaleString('en-US');

const CONTACT_PRICE = 'Contact us';
const PRO_STORES = 3;

function definePlan(facts: PlanFacts): PlanEntitlement {
  const amountCopy = facts.amount === null ? null : `BDT ${planNumber(Number(facts.amount))}`;
  const storeFeature = facts.stores === null
    ? 'Multiple WooCommerce stores'
    : facts.stores === 1
      ? '1 WooCommerce store'
      : `Up to ${facts.stores} WooCommerce stores`;
  const allowanceFeature = facts.eventsQuota !== null && facts.ordersQuota !== null
    ? `Up to ${planNumber(facts.eventsQuota)} tracked events and ${planNumber(facts.ordersQuota)} orders each month`
    : 'Event and order allowance agreed with support';
  return Object.freeze({
    ...facts,
    planName: `${facts.label} Plan`,
    cardPrice: amountCopy ?? CONTACT_PRICE,
    monthlyPrice: facts.billingCopy ?? (amountCopy === null ? CONTACT_PRICE : `${amountCopy} / month`),
    renewalPrice: facts.billingCopy ?? amountCopy ?? CONTACT_PRICE,
    features: Object.freeze([
      storeFeature,
      allowanceFeature,
      ...facts.extraFeatures,
      ...(facts.historyDays === null ? [] : [`Up to ${facts.historyDays} days of event history`]),
    ]),
  });
}

export const PLAN_CATALOG: Readonly<Record<PlanKey, PlanEntitlement>> = Object.freeze({
  free: definePlan({
    key: 'free',
    label: 'Free',
    subtitle: 'Try Meta server-side tracking',
    eventsQuota: 10_000,
    ordersQuota: 50,
    stores: 1,
    historyDays: null,
    amount: '0.00',
    billingCopy: 'Free',
    extraFeatures: [
      'Meta Pixel and Conversions API',
      'Browser and server event deduplication',
      'Dashboard, event logs, and campaign URL tools',
    ],
  }),
  starter: definePlan({
    key: 'starter',
    label: 'Starter',
    subtitle: 'A complete toolkit for one small store',
    eventsQuota: 200_000,
    ordersQuota: 500,
    stores: 1,
    historyDays: 60,
    amount: '499.00',
    billingCopy: null,
    extraFeatures: [
      'Meta CAPI, TikTok Events API, and GA4',
      'Browser and server event deduplication',
      'WhatsApp order confirmations',
      'Incomplete checkout recovery',
      'COD controls and manual courier booking tools',
    ],
  }),
  growth: definePlan({
    key: 'growth',
    label: 'Growth',
    subtitle: 'More capacity for a growing store',
    eventsQuota: 500_000,
    ordersQuota: 2_000,
    stores: 1,
    historyDays: 60,
    amount: '799.00',
    billingCopy: null,
    extraFeatures: [
      'Everything included in Starter',
      'Higher event and order capacity',
    ],
  }),
  pro: definePlan({
    key: 'pro',
    label: 'Pro',
    subtitle: `Up to ${PRO_STORES} independent store workspaces`,
    eventsQuota: 1_000_000,
    ordersQuota: 5_000,
    stores: PRO_STORES,
    historyDays: null,
    amount: null,
    billingCopy: 'Custom billing',
    extraFeatures: [
      'Everything included in Growth',
      'One independent Meta, TikTok, and GA4 setup per store',
      'Priority support and onboarding help',
    ],
  }),
  agency: definePlan({
    key: 'agency',
    label: 'Agency',
    subtitle: 'Managed workspaces run with support',
    eventsQuota: null,
    ordersQuota: null,
    stores: null,
    historyDays: null,
    amount: null,
    billingCopy: 'Managed billing',
    extraFeatures: ['Everything included in Pro'],
  }),
});

/**
 * Map a plan label from /api/profile onto a catalogue entry.
 *
 * The highest tier in the label wins so a "Pro" or "Agency" account is never
 * read as one of the tiers it already includes, and an unrecognised label
 * returns null rather than guessing an allowance the account may not have.
 */
export function resolvePlanKey(planLabel: string | null | undefined): PlanKey | null {
  const label = (planLabel || '').toLowerCase();
  if (!label) return null;
  if (label.includes('agency')) return 'agency';
  if (label.includes('pro') || label.includes('scale')) return 'pro';
  if (label.includes('growth')) return 'growth';
  if (label.includes('starter')) return 'starter';
  if (label.includes('free')) return 'free';
  return null;
}

function planCheckoutPricing(plan: PlanEntitlement) {
  return Object.freeze({
    label: plan.planName,
    events: plan.eventsQuota !== null && plan.ordersQuota !== null
      ? `${plan.eventsQuota / 1_000}k events and ${planNumber(plan.ordersQuota)} orders / mo`
      : 'Allowance agreed with support',
    // A directly sellable plan always carries a fixed amount. The empty
    // fallback exists so paymentIntentMatchesPlan fails closed rather than
    // accepting an unverified total if that ever stops being true.
    amount: plan.amount ?? '',
    price: `${plan.cardPrice} / mo`,
  });
}

export const PLAN_PRICING = Object.freeze({
  starter: planCheckoutPricing(PLAN_CATALOG.starter),
  growth: planCheckoutPricing(PLAN_CATALOG.growth),
});

export type PlanTier = Extract<PlanKey, 'starter' | 'growth'>;

export type PaymentProvider = 'bkash' | 'nagad';

export type PaymentBrand = {
  name: string;
  primary: string;
  secondary: string;
  soft: string;
  text: string;
};

export type PaymentIntent = {
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

export type PaymentHistoryItem = {
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

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export function extractPaymentIntent(payload: unknown): PaymentIntent | null {
  if (!isRecord(payload)) return null;
  const candidate = payload.payment ?? payload.intent ?? payload.data ?? payload;
  if (!isRecord(candidate)) return null;

  const requiredFields: Array<keyof PaymentIntent> = [
    'reference',
    'paymentReference',
    'planTier',
    'totalAmount',
    'receivingPhone',
    'status',
    'expiresAt',
  ];
  const complete = requiredFields.every(field => (
    typeof candidate[field] === 'string' && candidate[field].trim().length > 0
  ));
  return complete ? candidate as PaymentIntent : null;
}

export function paymentIntentSecondsRemaining(intent: PaymentIntent, nowMs = Date.now()): number {
  const expiresAtMs = Date.parse(intent.expiresAt);
  if (!Number.isFinite(expiresAtMs)) return 0;
  return Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000));
}

export function paymentIntentMatchesPlan(intent: PaymentIntent, planTier: PlanTier): boolean {
  const expectedAmount = Number(PLAN_PRICING[planTier].amount);
  const baseAmount = Number(intent.baseAmount);
  const totalAmount = Number(intent.totalAmount);
  return intent.planTier.trim().toLowerCase() === planTier
    && Number.isFinite(baseAmount)
    && Number.isFinite(totalAmount)
    && baseAmount === expectedAmount
    && totalAmount === expectedAmount;
}

