import type { DeferredOrderProduct } from '../../types';

// BD phone normalizer.
// Accepts any Bangladeshi phone format and returns clean 01XXXXXXXXX (11 digits).
// Handles: +8801XXXXXXXXX, 8801XXXXXXXXX, 01XXXXXXXXX, 1XXXXXXXXX
export function normalizeBDPhone(phone: string): string {
  // Strip spaces, dashes, and parentheses
  let clean = phone.replace(/[\s\-\(\)]/g, '');
  // Strip leading country code +880 or 880
  if (clean.startsWith('+880')) clean = clean.substring(4);
  else if (clean.startsWith('880')) clean = clean.substring(3);
  // Ensure starts with 0 (i.e. 1XXXXXXXXX -> 01XXXXXXXXX)
  if (clean.length === 10 && !clean.startsWith('0')) {
    clean = '0' + clean;
  }
  return clean; // Returns formatted 01XXXXXXXXX local string
}

export function usablePhone(value: unknown): string {
  const normalized = normalizeBDPhone(String(value || '').trim());
  return /^01\d{9}$/.test(normalized) ? normalized : '';
}

export function formatHeldAge(ageHours: unknown): string {
  const hours = Math.max(0, Number(ageHours) || 0);
  const minutes = Math.max(1, Math.round(hours * 60));
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) {
    const wholeHours = Math.floor(hours);
    const remainingMinutes = Math.round((hours - wholeHours) * 60);
    return remainingMinutes > 0 ? `${wholeHours}h ${remainingMinutes}m ago` : `${wholeHours}h ago`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h ago` : `${days}d ago`;
}

export function productMeta(product: DeferredOrderProduct): Array<{ label: string; value: string; category?: boolean }> {
  const meta: Array<{ label: string; value: string; category?: boolean }> = [];
  const category = String(product?.category || product?.content_category || '').trim();
  if (category) meta.push({ label: 'Category', value: category, category: true });

  if (product?.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes)) {
    Object.entries(product.attributes).forEach(([key, value]) => {
      const text = String(value || '').trim();
      if (text) meta.push({ label: key, value: text });
    });
  }
  return meta;
}
