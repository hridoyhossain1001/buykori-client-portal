import { useMemo, useState } from 'react';
import { Clock3, Phone, Search } from 'lucide-react';
import type { IncompleteCheckoutData, RecoveryOrderPayload } from '../types';
import { IncompleteCheckoutsHeader } from './incompleteCheckouts/IncompleteCheckoutsHeader';
import { IncompleteCheckoutMobileList } from './incompleteCheckouts/IncompleteCheckoutMobileList';
import { IncompleteCheckoutsTable } from './incompleteCheckouts/IncompleteCheckoutsTable';
import { RecoveryOrderModal } from './incompleteCheckouts/RecoveryOrderModal';
import { useRecoveryOrderDraft } from './incompleteCheckouts/useRecoveryOrderDraft';

interface Props {
  data: IncompleteCheckoutData;
  onStatusChange: (id: number, status: string) => Promise<void>;
  onCreateOrder: (id: number, payload: RecoveryOrderPayload) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  showToast: (message: string, isError?: boolean) => void;
}

export function IncompleteCheckoutsView({ data, onStatusChange, onCreateOrder, onRefresh, showToast }: Props) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const recoveryOrder = useRecoveryOrderDraft({ onCreateOrder, showToast });

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
      <IncompleteCheckoutsHeader
        onRefresh={onRefresh}
        displayCounts={displayCounts}
        rawCounts={data.counts}
      />

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

        <IncompleteCheckoutMobileList
          items={filtered}
          updatingId={updatingId}
          onUpdateStatus={updateStatus}
          onOpenCreateOrder={recoveryOrder.openCreateOrder}
          showToast={showToast}
        />

        <IncompleteCheckoutsTable
          items={filtered}
          updatingId={updatingId}
          onUpdateStatus={updateStatus}
          onOpenCreateOrder={recoveryOrder.openCreateOrder}
          showToast={showToast}
        />
      </div>

      <p className="flex items-center gap-1 px-1 text-[9px] text-slate-400 md:px-0 md:text-xs"><Clock3 className="h-3 w-3 md:h-3.5 md:w-3.5" /> Unfinished checkout details are kept for 30 days.</p>

      {recoveryOrder.orderLead && recoveryOrder.orderDraft && (
        <RecoveryOrderModal
          orderLead={recoveryOrder.orderLead}
          orderDraft={recoveryOrder.orderDraft}
          creatingOrder={recoveryOrder.creatingOrder}
          draftTotal={recoveryOrder.draftTotal}
          onClose={recoveryOrder.closeCreateOrder}
          onUpdateDraft={recoveryOrder.updateOrderDraft}
          onUpdateItem={recoveryOrder.updateOrderItem}
          onUpdateItemAttribute={recoveryOrder.updateOrderItemAttribute}
          onAddItemAttribute={recoveryOrder.addOrderItemAttribute}
          onRemoveItemAttribute={recoveryOrder.removeOrderItemAttribute}
          onAddItem={recoveryOrder.addOrderItem}
          onRemoveItem={recoveryOrder.removeOrderItem}
          onSubmit={recoveryOrder.submitCreateOrder}
        />
      )}
    </div>
  );
}
