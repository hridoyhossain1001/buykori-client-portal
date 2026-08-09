export const PLAN_PRICING = Object.freeze({
  starter: { label: 'Starter Plan', events: '200k events and 500 orders / mo', price: 'BDT 499 / mo' },
  growth: { label: 'Growth Plan', events: '500k events and 2,000 orders / mo', price: 'BDT 799 / mo' },
});

export type PlanTier = 'starter' | 'growth';

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

export const freePlanFeatures = [
  '1 WooCommerce store',
  'Up to 10,000 tracked events and 50 orders each month',
  'Meta Pixel and Conversions API',
  'Browser and server event deduplication',
  'Dashboard, event logs, and campaign URL tools',
];

export const starterPlanFeatures = [
  '1 WooCommerce store',
  'Up to 200,000 tracked events and 500 orders each month',
  'Meta CAPI, TikTok Events API, and GA4',
  'Browser and server event deduplication',
  'Telegram order and recovery alerts',
  'Incomplete checkout recovery',
  'COD controls and manual courier booking tools',
  'Up to 60 days of event history',
];

export const growthPlanFeatures = [
  '1 WooCommerce store',
  'Up to 500,000 tracked events and 2,000 orders each month',
  'Everything included in Starter',
  'Higher event and order capacity',
  'Up to 60 days of event history',
];

export const proPlanFeatures = [
  'Up to 3 WooCommerce stores',
  'Up to 1,000,000 tracked events and 5,000 orders each month',
  'Everything included in Growth',
  'One independent Meta, TikTok, and GA4 setup per store',
  'Priority support and onboarding help',
];
