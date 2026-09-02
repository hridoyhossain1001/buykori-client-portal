import type { IncompleteCheckoutItem } from '../../types';

export const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 border-blue-200   ',
  active: 'bg-blue-50 text-blue-700 border-blue-200   ',
  incomplete: 'bg-amber-50 text-amber-700 border-amber-200   ',
  contacted: 'bg-violet-50 text-violet-700 border-violet-200   ',
  recovered: 'bg-emerald-50 text-emerald-700 border-emerald-200   ',
};

export const normalizePhone = (phone: string) => {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('8801') && digits.length >= 13) return digits;
  if (digits.startsWith('01') && digits.length === 11) return `88${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `880${digits}`;
  return digits.length >= 10 ? digits : '';
};

export const productMeta = (product?: IncompleteCheckoutItem['products'][number]) => {
  if (!product) return '';
  const category = product.content_category || product.category || '';
  const attributes = product.attributes && typeof product.attributes === 'object'
    ? Object.entries(product.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')
    : '';
  return [category, attributes].filter(Boolean).join(' - ');
};
