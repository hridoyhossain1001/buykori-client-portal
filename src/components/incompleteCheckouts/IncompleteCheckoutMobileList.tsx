import { CheckCircle2, Copy, MessageCircle, Phone, ShoppingCart, UserRoundX } from 'lucide-react';
import type { IncompleteCheckoutItem } from '../../types';
import { STATUS_STYLES, getWhatsAppLink, normalizeWhatsAppPhone } from './incompleteCheckoutUtils';

const ICON_BUTTON = 'inline-flex h-7 w-7 items-center justify-center rounded-lg';

interface IncompleteCheckoutMobileListProps {
  items: IncompleteCheckoutItem[];
  updatingId: number | null;
  onUpdateStatus: (id: number, status: string) => Promise<void>;
  onOpenCreateOrder: (item: IncompleteCheckoutItem) => void;
  showToast: (message: string, isError?: boolean) => void;
}

export function IncompleteCheckoutMobileList({
  items,
  updatingId,
  onUpdateStatus,
  onOpenCreateOrder,
  showToast,
}: IncompleteCheckoutMobileListProps) {
  return (
    <div className="divide-y divide-slate-100 md:hidden">
      {items.length === 0 ? (
        <div className="m-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-400">
          <Phone className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-xs font-bold text-slate-600">No recoverable checkouts yet</p>
        </div>
      ) : items.map(item => {
        const product = item.products?.[0];
        const source = item.campaignData?.utm_source || 'Direct';
        const displayStatus = item.status === 'open' ? 'active' : item.status;
        const telPhone = normalizeWhatsAppPhone(item.phone);
        const whatsAppLink = getWhatsAppLink(item.phone, item.customerName, item.amount, item.currency, item.products);
        return (
          <article key={item.id} className="bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="truncate text-[12px] font-black leading-none text-slate-800">{item.customerName || 'Customer'}</p>
                <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase leading-none ${STATUS_STYLES[item.status] || 'border-slate-200 text-slate-500'}`}>{displayStatus}</span>
              </div>
              <strong className="shrink-0 text-[13px] font-black leading-none text-slate-800">
                {item.currency || 'BDT'} {Number(item.amount || 0).toLocaleString()}
              </strong>
            </div>

            <p className="mt-1 truncate text-[9px] leading-3 text-slate-400">
              <span className="font-mono font-semibold text-slate-500">{item.phone || 'No phone'}</span>
              {item.address ? <span> · {item.address}</span> : null}
            </p>

            <p className="mt-1.5 truncate text-[10px] font-medium leading-4 text-slate-700">
              {product?.content_name || product?.name || 'Product details unavailable'}
              <span className="text-slate-400"> · Qty {product?.quantity || 1}</span>
            </p>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[8px] text-slate-400">
                <span className="capitalize">{source}</span>
                <span> · {new Date(item.lastActivityAt).toLocaleString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </p>
              <div className="flex shrink-0 items-center gap-1">
                <a href={`tel:+${telPhone}`} title="Call customer" aria-label="Call customer" className={`${ICON_BUTTON} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}><Phone className="h-3 w-3" /></a>
                {whatsAppLink && (
                  <a
                    href={whatsAppLink}
                    target="_blank"
                    rel="noreferrer"
                    title="WhatsApp recovery"
                    aria-label="Open WhatsApp recovery"
                    className={`${ICON_BUTTON} border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}
                  >
                    <MessageCircle className="h-3 w-3" />
                  </a>
                )}
                <button title="Copy phone" aria-label="Copy phone" onClick={() => { navigator.clipboard.writeText(item.phone); showToast('Phone number copied.'); }} className={`${ICON_BUTTON} border border-slate-200 bg-white text-slate-500 hover:bg-slate-50`}><Copy className="h-3 w-3" /></button>
                {['open', 'incomplete', 'contacted'].includes(item.status) && <button disabled={updatingId === item.id} title="Create order" aria-label="Create order" onClick={() => onOpenCreateOrder(item)} className={`${ICON_BUTTON} border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50`}><ShoppingCart className="h-3 w-3" /></button>}
                {!['recovered', 'contacted'].includes(item.status) && <button disabled={updatingId === item.id} title="Mark contacted" aria-label="Mark contacted" onClick={() => onUpdateStatus(item.id, 'contacted')} className={`${ICON_BUTTON} border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50`}><CheckCircle2 className="h-3 w-3" /></button>}
                {!['recovered', 'ignored'].includes(item.status) && <button disabled={updatingId === item.id} title="Ignore draft" aria-label="Ignore draft" onClick={() => onUpdateStatus(item.id, 'ignored')} className={`${ICON_BUTTON} border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50`}><UserRoundX className="h-3 w-3" /></button>}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
