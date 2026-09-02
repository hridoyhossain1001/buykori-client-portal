import { useState } from 'react';
import { Phone } from 'lucide-react';
import type { IncompleteCheckoutData, RecoveryOrderPayload } from '../types';
/**
 * The workspace replaces the old page chrome — IncompleteCheckoutsHeader, the
 * search/filter bar, IncompleteCheckoutsTable and IncompleteCheckoutMobileList.
 * Those three files stay on disk untouched: nothing else imports them, and
 * keeping them makes reverting this page a matter of restoring one file.
 *
 * The recovery draft engine is unchanged. useRecoveryOrderDraft and
 * RecoveryOrderModal own multi-item editing, per-item attributes, delivery
 * charge, discount and validation, which is more than the prototype's drawer
 * does; the new workspace only opens them.
 */
import CheckoutsWorkspace from './incompleteCheckouts/CheckoutsWorkspace';
import { RecoveryOrderModal } from './incompleteCheckouts/RecoveryOrderModal';
import { useRecoveryOrderDraft } from './incompleteCheckouts/useRecoveryOrderDraft';

interface Props {
  data: IncompleteCheckoutData;
  /** Resolves true only when the write landed; the workspace's Undo depends on it. */
  onStatusChange: (id: number, status: string) => Promise<boolean>;
  onCreateOrder: (id: number, payload: RecoveryOrderPayload) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  showToast: (message: string, isError?: boolean) => void;
}

export function IncompleteCheckoutsView({ data, onStatusChange, onCreateOrder, onRefresh, showToast }: Props) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const recoveryOrder = useRecoveryOrderDraft({ onCreateOrder, showToast });

  const updateStatus = async (id: number, status: string) => {
    setUpdatingId(id);
    try {
      return await onStatusChange(id, status);
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
    <div className="space-y-3 md:space-y-6">
      <CheckoutsWorkspace
        items={data.items || []}
        counts={data.counts || {}}
        totalCount={data.totalCount}
        updatingId={updatingId}
        onUpdateStatus={updateStatus}
        onOpenCreateOrder={recoveryOrder.openCreateOrder}
        onRefresh={onRefresh}
        showToast={showToast}
      />

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
