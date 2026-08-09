import { CreditCard, Download, Loader2, ReceiptText, RotateCcw } from 'lucide-react';
import type { UserProfile } from '../../types';
import { starterPriceForOffer, type PaymentHistoryItem } from './accountTypes';
import { downloadTextFile, paymentCategory, statusClasses, statusLabel } from './accountStatus';

interface PaymentHistorySectionProps {
  profile: UserProfile;
  paymentHistory: PaymentHistoryItem[];
  paymentHistoryLoading: boolean;
  paymentStatusFilter: 'all' | 'paid' | 'cancelled' | 'expired';
  setPaymentStatusFilter: (value: 'all' | 'paid' | 'cancelled' | 'expired') => void;
  paymentPage: number;
  setPaymentPage: (updater: number | ((page: number) => number)) => void;
  onRefresh: () => void;
}

export function PaymentHistorySection({
  profile,
  paymentHistory,
  paymentHistoryLoading,
  paymentStatusFilter,
  setPaymentStatusFilter,
  paymentPage,
  setPaymentPage,
  onRefresh,
}: PaymentHistorySectionProps) {
  const currentPlan = (profile.plan || '').toLowerCase();
  const renewalPrice = currentPlan.includes('starter')
    ? starterPriceForOffer(profile.launchOffer)
    : currentPlan.includes('growth')
      ? 'BDT 799'
      : currentPlan.includes('free')
        ? 'Free'
        : 'Custom billing';
  const paymentCounts = {
    all: paymentHistory.length,
    paid: paymentHistory.filter(payment => paymentCategory(payment.status) === 'paid').length,
    cancelled: paymentHistory.filter(payment => paymentCategory(payment.status) === 'cancelled').length,
    expired: paymentHistory.filter(payment => paymentCategory(payment.status) === 'expired').length,
  };
  const filteredPaymentHistory = paymentHistory.filter(payment =>
    paymentStatusFilter === 'all' || paymentCategory(payment.status) === paymentStatusFilter
  );
  const paymentPageSize = 6;
  const paymentPageCount = Math.max(1, Math.ceil(filteredPaymentHistory.length / paymentPageSize));
  const visiblePayments = filteredPaymentHistory.slice(
    (paymentPage - 1) * paymentPageSize,
    paymentPage * paymentPageSize,
  );
  const paidPayments = paymentHistory
    .filter(payment => paymentCategory(payment.status) === 'paid')
    .sort((a, b) => new Date(b.receivedAt || b.createdAt || 0).getTime() - new Date(a.receivedAt || a.createdAt || 0).getTime());
  const currentMonth = new Date();
  const paidThisMonth = paidPayments
    .filter(payment => {
      const paidAt = new Date(payment.receivedAt || payment.createdAt || 0);
      return paidAt.getFullYear() === currentMonth.getFullYear() && paidAt.getMonth() === currentMonth.getMonth();
    })
    .reduce((total, payment) => total + Number(payment.totalAmount || 0), 0);
  const lastPaidPayment = paidPayments[0] || null;

  const exportPaymentHistory = () => {
    const csvRows = [
      ['Date', 'Plan', 'Method', 'Transaction', 'Amount', 'Currency', 'Status'],
      ...filteredPaymentHistory.map(payment => [
        payment.createdAt || '',
        payment.planTier,
        payment.provider,
        payment.trxId || '',
        payment.totalAmount,
        payment.currency,
        statusLabel(payment.status),
      ]),
    ];
    const csv = csvRows
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    downloadTextFile('buykori-payment-history.csv', csv, 'text/csv');
  };

  const downloadReceipt = (payment: PaymentHistoryItem) => {
    downloadTextFile(
      `buykori-receipt-${payment.reference}.txt`,
      [
        'Buykori AdSync Payment Receipt',
        `Reference: ${payment.reference}`,
        `Date: ${payment.createdAt ? new Date(payment.createdAt).toLocaleString() : 'Not available'}`,
        `Plan: ${payment.planTier}`,
        `Method: ${payment.provider}`,
        `Transaction: ${payment.trxId || 'Not submitted'}`,
        `Amount: ${payment.currency} ${payment.totalAmount}`,
        `Status: ${statusLabel(payment.status)}`,
      ].join('\n'),
    );
  };

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="payment-history-heading">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <CreditCard className="h-4 w-4" />
          </span>
          <div>
            <h3 id="payment-history-heading" className="text-sm font-bold text-slate-900">Payment history</h3>
            <p className="mt-0.5 text-xs text-slate-500">Invoices, receipts and payment attempts.</p>
          </div>
        </div>
        <button type="button" onClick={exportPaymentHistory} disabled={paymentHistory.length === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid border-b border-slate-200 sm:grid-cols-3">
        <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paid this month</p>
          <p className="mt-1 text-sm font-bold text-slate-900">BDT {paidThisMonth.toFixed(2)}</p>
          <p className="mt-1 text-[11px] text-slate-400">{paidPayments.length} successful payment{paidPayments.length === 1 ? '' : 's'} total</p>
        </div>
        <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Last payment</p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {lastPaidPayment?.createdAt
              ? new Date(lastPaidPayment.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
              : 'No successful payment'}
          </p>
          <p className="mt-1 text-[11px] capitalize text-slate-400">
            {lastPaidPayment ? `${lastPaidPayment.provider} · BDT ${lastPaidPayment.totalAmount}` : '—'}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next renewal</p>
          <p className="mt-1 text-sm font-bold text-slate-900">{profile.renewalDate || 'Not scheduled'}</p>
          <p className="mt-1 text-[11px] text-slate-400">{profile.plan} · {renewalPrice}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-5 py-3">
        {([
          ['all', 'All'],
          ['paid', 'Paid'],
          ['cancelled', 'Cancelled'],
          ['expired', 'Expired'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={paymentStatusFilter === value}
            onClick={() => {
              setPaymentStatusFilter(value);
              setPaymentPage(1);
            }}
            className={`min-h-8 rounded-full border px-3 text-[11px] font-bold ${
              paymentStatusFilter === value
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label} <span className="ml-1 opacity-70">{paymentCounts[value]}</span>
          </button>
        ))}
        <button type="button" onClick={onRefresh} disabled={paymentHistoryLoading} className="ml-auto inline-flex min-h-8 items-center gap-1.5 px-2 text-[11px] font-bold text-indigo-600 disabled:opacity-50">
          <RotateCcw className={`h-3 w-3 ${paymentHistoryLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {paymentHistoryLoading ? (
        <div className="flex items-center justify-center gap-2 px-5 py-14 text-xs text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Loading payment history…
        </div>
      ) : visiblePayments.length === 0 ? (
        <div className="px-5 py-14 text-center">
          <ReceiptText className="mx-auto h-9 w-9 text-slate-300" />
          <h4 className="mt-3 text-sm font-bold text-slate-800">No matching payments</h4>
          <p className="mt-1 text-xs text-slate-500">Payment records will appear here when available.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-16 px-5 py-3" aria-label="Receipt" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePayments.map(payment => (
                  <tr key={payment.reference} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="block font-bold text-slate-800">{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString([], { dateStyle: 'medium' }) : '—'}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">{payment.createdAt ? new Date(payment.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold capitalize text-slate-800">{payment.planTier}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-slate-400">{payment.reference}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold capitalize text-slate-800">{payment.provider}</span>
                      <span className="mt-0.5 block text-[11px] capitalize text-slate-400">{payment.paymentType?.replaceAll('_', ' ') || 'Awaiting SMS'}</span>
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px] text-slate-700">{payment.trxId || 'Not submitted'}</td>
                    <td className="px-4 py-4 text-right font-bold text-slate-900">BDT {payment.totalAmount}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold capitalize ${statusClasses(payment.status)}`}>{statusLabel(payment.status)}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" disabled={paymentCategory(payment.status) !== 'paid'} onClick={() => downloadReceipt(payment)} aria-label={`Download receipt for ${payment.reference}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-[11px] text-slate-400">
            <span>Showing {(paymentPage - 1) * paymentPageSize + 1}–{Math.min(paymentPage * paymentPageSize, filteredPaymentHistory.length)} of {filteredPaymentHistory.length} payments</span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={paymentPage <= 1} onClick={() => setPaymentPage(page => Math.max(1, page - 1))} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40">‹</button>
              <span className="min-w-16 text-center font-bold text-slate-600">Page {paymentPage} / {paymentPageCount}</span>
              <button type="button" disabled={paymentPage >= paymentPageCount} onClick={() => setPaymentPage(page => Math.min(paymentPageCount, page + 1))} className="h-8 w-8 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40">›</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default PaymentHistorySection;
