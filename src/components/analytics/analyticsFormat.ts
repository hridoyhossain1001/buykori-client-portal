/**
 * Shared formatting helpers for the Ad Insights (Analytics) screens.
 *
 * These were defined inside the AnalyticsView component body. They are pure
 * functions with no dependency on React state or component scope, so they are
 * extracted here during the FE-01 split and imported by each section
 * component rather than being passed down as props.
 *
 * Bodies are copied verbatim - this file introduces no behaviour change.
 */

/** Returns the value when it is already an array, otherwise an empty array. */
export const asArray = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

/** Formats a possibly missing numeric value using the visitor's locale. */
export const numberText = (value: unknown) => Number(value || 0).toLocaleString();

/** Formats a percentage, falling back to 0% for non-finite input. */
export const percentText = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric}%` : '0%';
};

/**
 * Formats a money amount with two decimals.
 * BDT and USD get their familiar prefixes; any other currency code is shown
 * as-is so new markets do not silently render an unlabelled number.
 */
export const formatMoney = (value: number, currency?: string) => {
  const code = String(currency || '').trim().toUpperCase();
  const amount = Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (code === 'BDT') return `BDT ${amount}`;
  if (code === 'USD') return `$${amount}`;
  return code ? `${code} ${amount}` : amount;
};

/** Maps a raw tracking event name to the merchant-facing funnel step label. */
export const stepLabel = (step: string) => ({
  PageView: 'Store visit',
  ViewContent: 'Product seen',
  AddToCart: 'Added to cart',
  InitiateCheckout: 'Checkout started',
  Purchase: 'Order placed',
}[step] || step);

/** True when a location label carries no usable city information. */
export const isUnknownArea = (label: string) => /unknown|not set|n\/a|unavailable/i.test(String(label || ''));
