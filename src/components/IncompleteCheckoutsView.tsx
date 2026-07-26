import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, MessageCircle, Phone, Plus, RefreshCw, Search, ShoppingCart, Trash2, UserRoundX, X } from 'lucide-react';
import { Tooltip } from './common/Tooltip';
import { Button } from './common/Button';
import { Modal } from './common/Modal';
import type { IncompleteCheckoutData, IncompleteCheckoutItem, IncompleteCheckoutProduct, RecoveryOrderItem, RecoveryOrderPayload } from '../types';

interface Props {
  data: IncompleteCheckoutData;
  onStatusChange: (id: number, status: string) => Promise<void>;
  onCreateOrder: (id: number, payload: RecoveryOrderPayload) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  showToast: (message: string, isError?: boolean) => void;
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700 border-sky-200   ',
  active: 'bg-sky-50 text-sky-700 border-sky-200   ',
  incomplete: 'bg-amber-50 text-amber-700 border-amber-200   ',
  contacted: 'bg-violet-50 text-violet-700 border-violet-200   ',
  recovered: 'bg-emerald-50 text-emerald-700 border-emerald-200   ',
};

const normalizeWhatsAppPhone = (phone: string) => {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('8801') && digits.length >= 13) return digits;
  if (digits.startsWith('01') && digits.length === 11) return `88${digits}`;
  if (digits.startsWith('1') && digits.length === 10) return `880${digits}`;
  return digits.length >= 10 ? digits : '';
};

const getWhatsAppLink = (phone: string, name: string, amount: number, currency: string, products: IncompleteCheckoutProduct[]) => {
  const cleanPhone = normalizeWhatsAppPhone(phone);
  if (!cleanPhone) return '';
  const productName = products?.[0]?.name || products?.[0]?.content_name || 'items';
  const currencySymbol = currency || 'BDT';
  const text = `Hi ${name || 'there'}, we noticed you left ${productName} in your cart for ${currencySymbol} ${amount.toLocaleString()}. Would you like to complete your order?`;
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
};

export function IncompleteCheckoutsView({ data, onStatusChange, onCreateOrder, onRefresh, showToast }: Props) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [orderLead, setOrderLead] = useState<IncompleteCheckoutItem | null>(null);
  const [orderDraft, setOrderDraft] = useState<RecoveryOrderPayload | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const items = data.items || [];
  const displayCounts = {
    active: data.counts.active || items.filter(item => ['active', 'open'].includes(item.status)).length,
    incomplete: data.counts.incomplete || items.filter(item => item.status === 'incomplete').length,
    contacted: data.counts.contacted || items.filter(item => item.status === 'contacted').length,
    recovered: data.counts.recovered || items.filter(item => item.status === 'recovered').length,
  };
  const filtered = useMemo(() => items.filter(item => {
    const normalizedStatus = item.status === 'open' ? 'active' : item.status;
    if (filter !== 'all' && normalizedStatus !== filter) return false;
    const haystack = `${item.phone} ${item.customerName} ${item.email} ${item.address}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }), [items, filter, query]);

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      await onStatusChange(id, status);
    } finally {
      setUpdatingId(null);
    }
  };

  const productMeta = (product?: IncompleteCheckoutItem['products'][number]) => {
    if (!product) return '';
    const category = product.content_category || product.category || '';
    const attributes = product.attributes && typeof product.attributes === 'object'
      ? Object.entries(product.attributes).map(([key, value]) => `${key}: ${value}`).join(', ')
      : '';
    return [category, attributes].filter(Boolean).join(' - ');
  };

  const openCreateOrder = (item: IncompleteCheckoutItem) => {
    const products = item.products?.length ? item.products : [{}];
    setOrderLead(item);
    setOrderDraft({
      customer_name: item.customerName && item.customerName !== '—' ? item.customerName : '',
      phone: item.phone || '',
      address: item.address && item.address !== '—' ? item.address : '',
      items: products.map((product, index) => ({
        name: product.content_name || product.name || '',
        content_id: product.content_id || product.id || `manual-${item.id}-${index + 1}`,
        quantity: Number(product.quantity || 1),
        price: Number(product.item_price || product.price || (products.length === 1 ? item.amount : 0) || 0),
        attributes: product.attributes || {},
        category: product.content_category || product.category || '',
      })),
      delivery_charge: 0,
      discount: 0,
      note: '',
    });
  };

  const updateOrderDraft = (patch: Partial<RecoveryOrderPayload>) => {
    setOrderDraft(prev => prev ? { ...prev, ...patch } : prev);
  };

  const updateOrderItem = (index: number, patch: Partial<RecoveryOrderItem>) => {
    setOrderDraft(prev => {
      if (!prev) return prev;
      const nextItems = prev.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
      return { ...prev, items: nextItems };
    });
  };

  const updateOrderItemAttribute = (itemIndex: number, oldKey: string, nextKey: string, nextValue: string) => {
    setOrderDraft(prev => {
      if (!prev) return prev;
      const nextItems = prev.items.map((item, index) => {
        if (index !== itemIndex) return item;
        const attributes = { ...item.attributes };
        const cleanNextKey = nextKey.trim();
        if (cleanNextKey !== oldKey && Object.prototype.hasOwnProperty.call(attributes, cleanNextKey)) return item;
        delete attributes[oldKey];
        if (cleanNextKey) attributes[cleanNextKey] = nextValue;
        return { ...item, attributes };
      });
      return { ...prev, items: nextItems };
    });
  };

  const addOrderItemAttribute = (itemIndex: number) => {
    const item = orderDraft?.items[itemIndex];
    if (!item) return;
    let key = 'Attribute';
    let suffix = 2;
    while (Object.prototype.hasOwnProperty.call(item.attributes, key)) key = `Attribute ${suffix++}`;
    updateOrderItem(itemIndex, { attributes: { ...item.attributes, [key]: '' } });
  };

  const removeOrderItemAttribute = (itemIndex: number, key: string) => {
    const item = orderDraft?.items[itemIndex];
    if (!item) return;
    const attributes = { ...item.attributes };
    delete attributes[key];
    updateOrderItem(itemIndex, { attributes });
  };

  const addOrderItem = () => {
    setOrderDraft(prev => prev ? {
      ...prev,
      items: [...prev.items, { name: '', content_id: `manual-${orderLead?.id || 'item'}-${prev.items.length + 1}`, quantity: 1, price: 0, attributes: {}, category: '' }],
    } : prev);
  };

  const removeOrderItem = (index: number) => {
    setOrderDraft(prev => prev ? { ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) } : prev);
  };

  const submitCreateOrder = async () => {
    if (!orderLead || !orderDraft) return;
    if (!orderDraft.customer_name.trim() || !orderDraft.phone.trim() || !orderDraft.address.trim()) {
      showToast('Customer name, phone, and address are required.', true);
      return;
    }
    if (!orderDraft.items.length || orderDraft.items.some(item => !item.name.trim() || item.quantity < 1)) {
      showToast('At least one valid product item is required.', true);
      return;
    }
    setCreatingOrder(true);
    try {
      const payload = {
        ...orderDraft,
        items: orderDraft.items.map(item => ({
          ...item,
          attributes: Object.fromEntries(
            Object.entries(item.attributes)
              .map(([key, value]) => [key.trim(), String(value ?? '').trim()])
              .filter(([key, value]) => key && value)
          ),
        })),
      };
      const ok = await onCreateOrder(orderLead.id, payload);
      if (ok) {
        setOrderLead(null);
        setOrderDraft(null);
      }
    } finally {
      setCreatingOrder(false);
    }
  };

  const draftSubtotal = orderDraft?.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0) || 0;
  const draftTotal = Math.max(0, draftSubtotal + Number(orderDraft?.delivery_charge || 0) - Number(orderDraft?.discount || 0));

  if (data.restricted) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-white p-8 text-center  ">
        <Phone className="mx-auto h-8 w-8 text-indigo-500" />
        <h2 className="mt-3 text-lg font-bold">Incomplete Checkout Recovery</h2>
        <p className="mt-2 text-sm text-slate-500">Upgrade to Growth to view and recover unfinished checkouts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:hidden">
        <div className="flex items-start justify-between gap-2 px-3 py-2.5">
          <div className="min-w-0">
            <h2 className="flex items-center text-[14px] font-black leading-tight text-slate-900">
              Incomplete Checkout Recovery
              <Tooltip content="Incomplete checkout sessions that remain unfinished after the customer entered checkout details." />
            </h2>
            <p className="mt-0.5 text-[9px] leading-[13px] text-slate-500">
              Customers who start checkout but do not order within 5 minutes appear here.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh incomplete orders"
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[9px] font-bold text-slate-600"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-4 border-t border-slate-100">
          {[
            ['Active', displayCounts.active, 'text-slate-900'],
            ['Incomplete', displayCounts.incomplete, 'text-amber-600'],
            ['Contacted', displayCounts.contacted, 'text-violet-600'],
            ['Recovered', displayCounts.recovered, 'text-emerald-600'],
          ].map(([label, count, tone], index) => (
            <div key={String(label)} className={`px-1 py-2 text-center ${index > 0 ? 'border-l border-slate-100' : ''}`}>
              <p className="truncate text-[7px] font-black uppercase tracking-[0.08em] text-slate-400">{label}</p>
              <p className={`mt-1 text-[18px] font-black leading-none ${tone}`}>{count}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="hidden flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:flex md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center">
            Incomplete Checkout Recovery
            <Tooltip content="Incomplete checkout sessions that remain unfinished after the customer entered checkout details." />
          </h2>
          <p className="mt-1 text-xs text-slate-500">Customers who start checkout but do not order within 5 minutes appear here.</p>
        </div>
        <button onClick={onRefresh} className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50  ">
          Refresh list
        </button>
      </div>

      <div className="hidden grid-cols-2 gap-3 md:grid md:grid-cols-4">
        {[
          ['Active', data.counts.active || 0],
          ['Incomplete', data.counts.incomplete || 0],
          ['Contacted', data.counts.contacted || 0],
          ['Recovered', data.counts.recovered || 0],
        ].map(([label, count]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4  ">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:rounded-2xl md:shadow-none">
        <div className="flex gap-2 border-b border-slate-100 p-2 md:flex-row md:gap-3 md:p-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 md:h-4 md:w-4" />
          <input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search incomplete orders" placeholder="Search phone, name, email or address..." className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-2 text-[10px] outline-none focus:border-indigo-400 md:text-xs" />
          </div>
          <select value={filter} onChange={event => setFilter(event.target.value)} aria-label="Filter incomplete checkouts by status" className="h-9 w-[104px] shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold md:w-auto md:px-3 md:text-xs">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="incomplete">Incomplete</option>
            <option value="contacted">Contacted</option>
            <option value="recovered">Recovered</option>
          </select>
        </div>
        <div className="divide-y divide-slate-100 md:hidden">
          {filtered.length === 0 ? (
            <div className="m-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-400">
              <Phone className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-xs font-bold text-slate-600">No recoverable checkouts yet</p>
            </div>
          ) : filtered.map(item => {
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
                  <a href={`tel:+${telPhone}`} title="Call customer" aria-label="Call customer" className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"><Phone className="h-3 w-3" /></a>
                  {whatsAppLink && (
                    <a
                      href={whatsAppLink}
                      target="_blank"
                      rel="noreferrer"
                      title="WhatsApp recovery"
                      aria-label="Open WhatsApp recovery"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    >
                      <MessageCircle className="h-3 w-3" />
                    </a>
                  )}
                  <button title="Copy phone" aria-label="Copy phone" onClick={() => { navigator.clipboard.writeText(item.phone); showToast('Phone number copied.'); }} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><Copy className="h-3 w-3" /></button>
                  {['open', 'incomplete', 'contacted'].includes(item.status) && <button disabled={updatingId === item.id} title="Create order" aria-label="Create order" onClick={() => openCreateOrder(item)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"><ShoppingCart className="h-3 w-3" /></button>}
                  {!['recovered', 'contacted'].includes(item.status) && <button disabled={updatingId === item.id} title="Mark contacted" aria-label="Mark contacted" onClick={() => updateStatus(item.id, 'contacted')} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"><CheckCircle2 className="h-3 w-3" /></button>}
                  {!['recovered', 'ignored'].includes(item.status) && <button disabled={updatingId === item.id} title="Ignore draft" aria-label="Ignore draft" onClick={() => updateStatus(item.id, 'ignored')} className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"><UserRoundX className="h-3 w-3" /></button>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                      <Phone className="h-7 w-7 text-slate-300" />
                      <p className="font-bold text-slate-600 ">No recoverable checkouts yet</p>
                      <p className="text-xs">Customers who leave checkout with a phone number will appear here after 5 minutes.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(item => {
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
                        <button title="Copy phone" onClick={() => { navigator.clipboard.writeText(item.phone); showToast('Phone number copied.'); }} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50  "><Copy className="h-3.5 w-3.5" /></button>
                        {['open', 'incomplete', 'contacted'].includes(item.status) && <button disabled={updatingId === item.id} title="Create order" onClick={() => openCreateOrder(item)} className="rounded-lg border border-indigo-200 bg-indigo-50 p-2 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"><ShoppingCart className="h-3.5 w-3.5" /></button>}
                        {!['recovered', 'contacted'].includes(item.status) && <button disabled={updatingId === item.id} title="Mark contacted" onClick={() => updateStatus(item.id, 'contacted')} className="rounded-lg border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50  "><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        {!['recovered', 'ignored'].includes(item.status) && <button disabled={updatingId === item.id} title="Ignore draft" onClick={() => updateStatus(item.id, 'ignored')} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50  "><UserRoundX className="h-3.5 w-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="flex items-center gap-1 px-1 text-[9px] text-slate-400 md:px-0 md:text-xs"><Clock3 className="h-3 w-3 md:h-3.5 md:w-3.5" /> Unfinished checkout details are kept for 30 days.</p>
      {orderLead && orderDraft && (
        <Modal
          onClose={() => { setOrderLead(null); setOrderDraft(null); }}
          labelledBy="recovery-order-title"
          overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm"
          panelClassName="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 id="recovery-order-title" className="text-sm font-bold text-slate-900">Create recovery order</h3>
                <p className="mt-0.5 text-xs text-slate-500">Confirm details before sending this lead to the COD order queue.</p>
              </div>
              <Button variant="icon" size="lg" onClick={() => { setOrderLead(null); setOrderDraft(null); }} className="border border-slate-200 text-slate-500" aria-label="Close recovery order dialog">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Customer name
                  <input value={orderDraft.customer_name} onChange={event => updateOrderDraft({ customer_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400" />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Phone
                  <input value={orderDraft.phone} onChange={event => updateOrderDraft({ phone: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400" />
                </label>
                <label className="md:col-span-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Shipping address
                  <textarea value={orderDraft.address} onChange={event => updateOrderDraft({ address: event.target.value })} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400" />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Order items</p>
                  <button type="button" onClick={addOrderItem} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50">
                    <Plus className="h-3.5 w-3.5" /> Add item
                  </button>
                </div>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {orderDraft.items.map((item, index) => (
                    <div key={index} className="grid grid-cols-1 gap-2 p-3 md:grid-cols-[minmax(0,1.4fr)_0.55fr_0.7fr_auto]">
                      <input value={item.name} onChange={event => updateOrderItem(index, { name: event.target.value })} placeholder="Product name" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-400" />
                      <input type="number" min={1} value={item.quantity} onChange={event => updateOrderItem(index, { quantity: Number(event.target.value || 1) })} aria-label="Quantity" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-400" />
                      <input type="number" min={0} value={item.price} onChange={event => updateOrderItem(index, { price: Number(event.target.value || 0) })} aria-label="Price" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-400" />
                      <button type="button" onClick={() => removeOrderItem(index)} disabled={orderDraft.items.length <= 1} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" title="Remove item">
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <input value={item.category} onChange={event => updateOrderItem(index, { category: event.target.value })} placeholder="Category" className="md:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400" />
                      <div className="space-y-2 md:col-span-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Attributes</p>
                          <button type="button" onClick={() => addOrderItemAttribute(index)} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 px-2 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50">
                            <Plus className="h-3 w-3" /> Add attribute
                          </button>
                        </div>
                        {Object.entries(item.attributes || {}).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2">
                            <input value={key} onChange={event => updateOrderItemAttribute(index, key, event.target.value, String(value ?? ''))} placeholder="Key, e.g. Color" aria-label="Attribute key" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400" />
                            <input value={String(value ?? '')} onChange={event => updateOrderItemAttribute(index, key, key, event.target.value)} placeholder="Value, e.g. Black, Blue" aria-label="Attribute value" className="rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400" />
                            <button type="button" onClick={() => removeOrderItemAttribute(index, key)} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" title="Remove attribute">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Delivery charge
                  <input type="number" min={0} value={orderDraft.delivery_charge} onChange={event => updateOrderDraft({ delivery_charge: Number(event.target.value || 0) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold normal-case tracking-normal outline-none focus:border-indigo-400" />
                </label>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Discount
                  <input type="number" min={0} value={orderDraft.discount} onChange={event => updateOrderDraft({ discount: Number(event.target.value || 0) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold normal-case tracking-normal outline-none focus:border-indigo-400" />
                </label>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">COD total</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{orderLead.currency || 'BDT'} {draftTotal.toLocaleString()}</p>
                </div>
                <label className="md:col-span-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Note
                  <textarea value={orderDraft.note} onChange={event => updateOrderDraft({ note: event.target.value })} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs normal-case tracking-normal outline-none focus:border-indigo-400" />
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <Button variant="secondary" size="sm" onClick={() => { setOrderLead(null); setOrderDraft(null); }} className="text-slate-600">Cancel</Button>
              <Button variant="primary" size="sm" onClick={submitCreateOrder} loading={creatingOrder}>
                <ShoppingCart className="h-4 w-4" /> {creatingOrder ? 'Creating...' : 'Create Order'}
              </Button>
            </div>
        </Modal>
      )}
    </div>
  );
}
