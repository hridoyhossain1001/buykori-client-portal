import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Copy, ExternalLink, Phone, Search, UserRoundX } from 'lucide-react';

interface IncompleteCheckoutItem {
  id: number;
  phone: string;
  customerName: string;
  email: string;
  address: string;
  products: Array<{ name?: string; content_name?: string; quantity?: number }>;
  amount: number;
  currency: string;
  pageUrl: string;
  campaignData: Record<string, string>;
  status: string;
  orderId?: string | null;
  lastActivityAt: string;
}

interface Props {
  data: { items: IncompleteCheckoutItem[]; counts: Record<string, number>; restricted?: boolean };
  onStatusChange: (id: number, status: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  showToast: (message: string, isError?: boolean) => void;
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900',
  incomplete: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900',
  contacted: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-900',
  recovered: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-900',
};

export function IncompleteCheckoutsView({ data, onStatusChange, onRefresh, showToast }: Props) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const items = data.items || [];
  const filtered = useMemo(() => items.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
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

  if (data.restricted) {
    return (
      <div className="rounded-2xl border border-indigo-200 bg-white p-8 text-center dark:border-indigo-900 dark:bg-slate-900">
        <Phone className="mx-auto h-8 w-8 text-indigo-500" />
        <h2 className="mt-3 text-lg font-bold">Incomplete Checkout Recovery</h2>
        <p className="mt-2 text-sm text-slate-500">This recovery workspace is available with a Growth trial or paid plan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold">Incomplete Checkout Recovery</h2>
          <p className="mt-1 text-xs text-slate-500">Valid phone submissions appear here. Active drafts become incomplete after 20 minutes without an order.</p>
        </div>
        <button onClick={onRefresh} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Refresh list
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Active', data.counts.active || 0],
          ['Incomplete', data.counts.incomplete || 0],
          ['Contacted', data.counts.contacted || 0],
          ['Recovered', data.counts.recovered || 0],
        ].map(([label, count]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search phone, name, email or address..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-950" />
          </div>
          <select value={filter} onChange={event => setFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-950">
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="incomplete">Incomplete</option>
            <option value="contacted">Contacted</option>
            <option value="recovered">Recovered</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-950">
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
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">No incomplete checkout drafts found.</td></tr>
              ) : filtered.map(item => {
                const product = item.products?.[0];
                const source = item.campaignData?.utm_source || 'Direct';
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <p className="font-bold">{item.customerName}</p>
                      <p className="mt-1 font-mono text-[11px] text-slate-500">{item.phone}</p>
                      <p className="mt-0.5 max-w-[240px] truncate text-[10px] text-slate-400">{item.address}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{product?.content_name || product?.name || 'Product details unavailable'}</p>
                      <p className="mt-1 text-[10px] text-slate-400">Qty {product?.quantity || 1}</p>
                    </td>
                    <td className="px-4 py-3 font-bold">৳{Number(item.amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{source}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(item.lastActivityAt).toLocaleString()}</td>
                    <td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold capitalize ${STATUS_STYLES[item.status] || 'border-slate-200 text-slate-500'}`}>{item.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <a href={`tel:+${item.phone}`} title="Call customer" className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Phone className="h-3.5 w-3.5" /></a>
                        <button title="Copy phone" onClick={() => { navigator.clipboard.writeText(item.phone); showToast('Phone number copied.'); }} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><Copy className="h-3.5 w-3.5" /></button>
                        {item.pageUrl && <a href={item.pageUrl} target="_blank" rel="noreferrer" title="Open landing page" className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"><ExternalLink className="h-3.5 w-3.5" /></a>}
                        {!['recovered', 'contacted'].includes(item.status) && <button disabled={updatingId === item.id} title="Mark contacted" onClick={() => updateStatus(item.id, 'contacted')} className="rounded-lg border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900 dark:hover:bg-emerald-950/30"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        {!['recovered', 'ignored'].includes(item.status) && <button disabled={updatingId === item.id} title="Ignore draft" onClick={() => updateStatus(item.id, 'ignored')} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/30"><UserRoundX className="h-3.5 w-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="flex items-center gap-1 text-[11px] text-slate-400"><Clock3 className="h-3.5 w-3.5" /> Recovery data expires after 30 days.</p>
    </div>
  );
}
