export const PLAN_PRICING = Object.freeze({
  growth: { label: 'Growth Plan', events: '500k Events / mo', price: 'BDT 899 / mo' },
  scale: { label: 'Scale Plan', events: '1M Events / mo', price: 'BDT 2,499 / mo' }
});

export type PlanTier = 'growth' | 'scale';

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

export const growthPlanFeatures = [
  '1 WooCommerce store',
  'Up to 500,000 tracked events each month',
  'Meta CAPI, TikTok Events API, and GA4',
  'Browser and server event deduplication',
  'Telegram order and recovery alerts',
  'Incomplete checkout recovery',
  'Manual courier booking tools',
  'Up to 60 days of event history',
];

export const scalePlanFeatures = [
  'Up to 3 WooCommerce stores',
  'Up to 1,000,000 tracked events each month',
  'Everything included in Growth',
  'Multiple pixels and tracking routes',
  'Advanced event quality checks',
  'Higher order and automation capacity',
  'Priority support and onboarding help',
  'Up to 60 days of event history',
];
