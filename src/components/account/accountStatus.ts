export const paymentCategory = (status: string): 'paid' | 'cancelled' | 'expired' | 'other' => {
  if (['approved', 'matched', 'approved_overpaid'].includes(status)) return 'paid';
  if (['cancelled', 'rejected', 'failed'].includes(status)) return 'cancelled';
  if (status === 'expired') return 'expired';
  return 'other';
};

export const statusClasses = (paymentStatus: string) => {
  if (['approved', 'matched', 'approved_overpaid'].includes(paymentStatus)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (['needs_review', 'ambiguous'].includes(paymentStatus)) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (paymentStatus === 'pending') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (['rejected', 'failed', 'underpaid'].includes(paymentStatus)) return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
};

export const statusLabel = (paymentStatus: string) => {
  if (['approved', 'matched'].includes(paymentStatus)) return 'Paid';
  if (paymentStatus === 'approved_overpaid') return 'Paid - refund available';
  if (['needs_review', 'ambiguous'].includes(paymentStatus)) return 'Under review';
  if (paymentStatus === 'underpaid') return 'Paid less than required';
  if (paymentStatus === 'overpaid') return 'Paid more than required';
  return paymentStatus.replaceAll('_', ' ');
};

export const downloadTextFile = (filename: string, content: string, type = 'text/plain') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
