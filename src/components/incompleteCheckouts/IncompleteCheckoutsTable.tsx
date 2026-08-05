import { CheckCircle2, Copy, MessageCircle, Phone, ShoppingCart, UserRoundX } from 'lucide-react';
import type { IncompleteCheckoutItem } from '../../types';
import { EmptyState } from '../common';
import { copyTextWithFeedback } from '../../lib/clipboard';
import { STATUS_STYLES, getWhatsAppLink, normalizeWhatsAppPhone, productMeta } from './incompleteCheckoutUtils';

interface IncompleteCheckoutsTableProps {
  items: IncompleteCheckoutItem[];
  updatingId: number | null;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
  onOpenCreateOrder: (item: IncompleteCheckoutItem) => void;
  showToast: (message: string, isError?: boolean) => void;
}

export function IncompleteCheckoutsTable({
  items,
  updatingId,
  onUpdateStatus,
  onOpenCreateOrder,
  showToast,
}: IncompleteCheckoutsTableProps) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[980px] text-left text-xs">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 ">
          <tr>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Amount</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Last Activity</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 ">
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-4">
                <EmptyState
                  icon={Phone}
                  title="No recoverable checkouts yet"
                  description="Customers who leave checkout with a phone number will appear here after 5 minutes."
                  compact
                />
              </td>
            </tr>
          ) : items.map(item => {
            const product = item.products?.[0];
            const meta = productMeta(product);
            const source = item.campaignData?.utm_source || 'Direct';
            const telPhone = normalizeWhatsAppPhone(item.phone);
            const whatsAppLink = getWhatsAppLink(item.phone, item.customerName, item.amount, item.currency, item.products);
            return (
              <tr key={item.id} className="hover:bg-slate-50/70 ">
                <td className="px-4 py-3">
                  <p className="font-bold">{item.customerName}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{item.phone}</p>
                  <p className="mt-0.5 max-w-[240px] truncate text-xs text-slate-400">{item.address}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{product?.content_name || product?.name || 'Product details unavailable'}</p>
                  <p className="mt-1 text-xs text-slate-400">Qty {product?.quantity || 1}</p>
                  {meta && <p className="mt-1 max-w-[220px] truncate text-xs text-slate-500" title={meta}>{meta}</p>}
                </td>
                <td className="px-4 py-3 font-bold">{item.currency || 'BDT'} {Number(item.amount || 0).toLocaleString()}</td>
                <td className="px-4 py-3 capitalize">{source}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(item.lastActivityAt).toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-xs font-bold capitalize ${STATUS_STYLES[item.status] || 'border-slate-200 text-slate-500'}`}>{item.status}</span></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <a href={`tel:+${telPhone}`} title="Call customer" className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50  "><Phone className="h-3.5 w-3.5" /></a>
                    {whatsAppLink && (
                      <a
                        href={whatsAppLink}
                        target="_blank"
                        rel="noreferrer"
                        title="WhatsApp recovery"
                        className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-600 hover:bg-green-100"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button title="Copy phone" onClick={() => { void copyTextWithFeedback(item.phone, showToast, { success: 'Phone number copied.', error: 'Could not copy phone number.' }); }} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50  "><Copy className="h-3.5 w-3.5" /></button>
                    {['open', 'incomplete', 'contacted'].includes(item.status) && <button disabled={updatingId === item.id} title="Create order" onClick={() => onOpenCreateOrder(item)} className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"><ShoppingCart className="h-3.5 w-3.5" /></button>}
                    {!['recovered', 'contacted'].includes(item.status) && <button disabled={updatingId === item.id} title="Mark contacted" onClick={() => onUpdateStatus(item.id, 'contacted')} className="rounded-lg border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50  "><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                    {!['recovered', 'ignored'].includes(item.status) && <button disabled={updatingId === item.id} title="Ignore draft" onClick={() => onUpdateStatus(item.id, 'ignored')} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50  "><UserRoundX className="h-3.5 w-3.5" /></button>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
