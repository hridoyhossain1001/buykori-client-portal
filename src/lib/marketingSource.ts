/**
 * One vocabulary for "where did this come from", shared by the Orders table and
 * the Incomplete checkouts table.
 *
 * Both read the same captured tags (`utm_source`, and the campaign or medium
 * beside it), so they must print the same words for the same tag — a merchant
 * comparing the two pages should not have to work out that "fb" and "Facebook"
 * are one channel. Nothing is inferred here: an untagged visit is "Direct",
 * which is a statement about our data, not a claim about the customer.
 */

/** Slugs stores actually send, in the casing a merchant recognises. */
const SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  fb: 'Facebook',
  meta: 'Meta',
  instagram: 'Instagram',
  ig: 'Instagram',
  tiktok: 'TikTok',
  google: 'Google',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  messenger: 'Messenger',
};

/** Values a store sends when it means "nothing": placeholders, not sources. */
const EMPTY_VALUES = new Set(['', 'n/a', 'null', 'undefined', 'none', '-']);

export const realText = (value: unknown): string => {
  const text = String(value ?? '').trim();
  return EMPTY_VALUES.has(text.toLowerCase()) ? '' : text;
};

/** The channel name to print, or 'Direct' when the store tagged nothing. */
export function sourceLabel(raw: unknown): string {
  const value = realText(raw);
  if (!value) return 'Direct';
  return SOURCE_LABELS[value.toLowerCase()] || value;
}
