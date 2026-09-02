import type { DeferredOrder } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface CancelPendingOrderModalProps {
  order: DeferredOrder;
  busy?: boolean;
  onKeep: () => void;
  onConfirm: () => void;
}

export function CancelPendingOrderModal({ order, busy = false, onKeep, onConfirm }: CancelPendingOrderModalProps) {
  return (
    <Modal
      onClose={busy ? () => undefined : onKeep}
      labelledBy="cancel-pending-order-title"
      describedBy="cancel-pending-order-description"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      panelClassName="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
    >
      <div className="space-y-1">
        <h3 id="cancel-pending-order-title" className="text-sm font-bold text-slate-900">Cancel order #{order.orderId}?</h3>
        <p id="cancel-pending-order-description" className="text-xs leading-relaxed text-slate-500">
          This removes the order from COD review, marks it cancelled here, and queues the same cancellation in WooCommerce.
        </p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onKeep} disabled={busy}>Keep order</Button>
        <Button variant="danger" size="sm" onClick={onConfirm} loading={busy}>Cancel order</Button>
      </div>
    </Modal>
  );
}

export default CancelPendingOrderModal;
