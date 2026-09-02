import type { AdPerformanceRow } from '../../types';

/** Aggregated ad-performance totals derived in the AnalyticsView container. */
export type AdSummary = {
  spend: number;
  placedPurchases: number;
  placedRevenue: number;
  confirmedPurchases: number;
  confirmedRevenue: number;
  spendCurrency: string;
  revenueCurrency: string;
  /** Confirmed revenue ÷ spend. null when there is no spend to divide by. */
  returnRate: number | null;
  /** Spend ÷ confirmed orders. null when no confirmed order carries the cost. */
  costPerOrder: number | null;
};

/** Badge descriptor returned by getAdStatus. */
export type AdStatus = {
  label: string;
  className: string;
};

export type GetAdStatus = (row: AdPerformanceRow) => AdStatus;
