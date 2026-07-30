import type { CourierOrder } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

interface CancelCourierOrderModalProps {
  orderToCancel: CourierOrder;
  cancelProviderName: string;
  onKeep: () => void;
  onConfirm: () => void;
}

export function CancelCourierOrderModal({
  orderToCancel,
  cancelProviderName,
  onKeep,
  onConfirm,
}: CancelCourierOrderModalProps) {
  return (
    <Modal
      onClose={onKeep}
      labelledBy="cancel-courier-title"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      panelClassName="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
    >
        <div className="space-y-1">
          <h3 id="cancel-courier-title" className="text-sm font-bold text-slate-900 ">Cancel courier order?</h3>
          <p className="text-xs leading-relaxed text-slate-500 ">
            {orderToCancel.courier_provider === 'steadfast'
              ? 'This cancels the order locally. Please also cancel it from the SteadFast merchant panel.'
              : `Cancel order ${orderToCancel.order_id} on ${cancelProviderName}? Pending or pickup orders can usually be cancelled.`}
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={onKeep}
            className="text-slate-600"
          >
            Keep Order
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onConfirm}
            className="bg-rose-900 hover:bg-rose-950"
          >
            Cancel Order
          </Button>
        </div>
    </Modal>
  );
}

export default CancelCourierOrderModal;
