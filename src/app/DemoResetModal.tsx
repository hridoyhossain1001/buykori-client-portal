import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';

interface DemoResetModalProps {
  onClose: () => void;
  onConfirm: () => void;
}

/** Confirmation dialog before restoring demo metrics and tracking history. */
export function DemoResetModal({ onClose, onConfirm }: DemoResetModalProps) {
  return (
    <Modal
      onClose={onClose}
      labelledBy="demo-reset-title"
      overlayClassName="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      panelClassName="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
    >
      <div className="space-y-1">
        <h3 id="demo-reset-title" className="text-sm font-bold text-slate-900">Reset demo data?</h3>
        <p className="text-xs leading-relaxed text-slate-500">This restores demo metrics and tracking history to their default values.</p>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          className="text-slate-600"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirm}
        >
          Reset Data
        </Button>
      </div>
    </Modal>
  );
}

export default DemoResetModal;
