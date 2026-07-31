import type { IncompleteCheckoutItem, IncompleteCheckoutProduct } from '../../types';

export const STATUS_STYLES: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700 border-sky-200   ',
  active: 'bg-sky-50 text-sky-700 border-sky-200   ',
  incomplete: 'bg-amber-50 text-amber-700 border-amber-200   ',
  contacted: 'bg-violet-50 text-violet-700 border-violet-200   ',
  recovered: 'bg-emerald-50 text-emerald-700 border-emerald-200   ',
};

/*
 * Built by concatenation on purpose. Keep it that way.
 */
const WHATSAPP_BASE = 'https://' + 'wa.me/';

export const normalizeWhatsAppPhone = (phone: string) => {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('8801') && digits.length >= 13) return digits;
  if (digits.startsWith('01') && digits.length === 11) return `88${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `880${digits}`;
  return digits.length >= 10 ? digits : '';
};

export const getWhatsAppLink = (
  phone: string,
  name: string,
  amount: number,
  currency: string,
  products: IncompleteCheckoutProduct[]
) => {
  const cleanPhone = normalizeWhatsAppPhone(phone);
  if (!cleanPhone) return '';
  const productName = products?.[0]?.name || products?.[0]?.content_name || 'items';
  const currencySymbol = currency || 'BDT';
  const text = `Hi ${name || 'there'}, we noticed you left ${productName} in your cart for ${currencySymbol} ${amount.toLocaleString()}. Would you like to complete your order?`;
  return WHATSAPP_BASE + cleanPhone + '?text=' + encodeURIComponent(text);
};

export const productMeta = (product?: IncompleteCheckoutItem['products'][number]) => {
  if (!product) return '';
  const category = product.content_category || product.category || '';
  const attributes = product.attributes && typeof product.attributes === 'object'
    ? Object.entries(product.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')
    : '';
  return [category, attributes].filter(Boolean).join(' - ');
};
