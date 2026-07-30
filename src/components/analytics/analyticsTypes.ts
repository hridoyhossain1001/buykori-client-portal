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
  returnRate: number;
  costPerOrder: number;
};

/** Badge descriptor returned by getAdStatus. */
export type AdStatus = {
  label: string;
  className: string;
};

export type GetAdStatus = (row: AdPerformanceRow) => AdStatus;
