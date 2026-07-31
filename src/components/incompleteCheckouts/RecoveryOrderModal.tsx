import { Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import type { IncompleteCheckoutItem, RecoveryOrderItem, RecoveryOrderPayload } from '../../types';

const FIELD_LABEL = 'text-xs font-bold uppercase tracking-wider text-slate-500';
const TEXT_INPUT = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400';
const NUMBER_INPUT = 'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold normal-case tracking-normal outline-none focus:border-indigo-400';
const ITEM_INPUT = 'rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-indigo-400';
const ATTRIBUTE_INPUT = 'rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400';

interface RecoveryOrderModalProps {
  orderLead: IncompleteCheckoutItem;
  orderDraft: RecoveryOrderPayload;
  creatingOrder: boolean;
  draftTotal: number;
  onClose: () => void;
  onUpdateDraft: (patch: Partial<RecoveryOrderPayload>) => void;
  onUpdateItem: (index: number, patch: Partial<RecoveryOrderItem>) => void;
  onUpdateItemAttribute: (itemIndex: number, oldKey: string, nextKey: string, nextValue: string) => void;
  onAddItemAttribute: (itemIndex: number) => void;
  onRemoveItemAttribute: (itemIndex: number, key: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onSubmit: () => Promise<void>;
}

export function RecoveryOrderModal({
  orderLead,
  orderDraft,
  creatingOrder,
  draftTotal,
  onClose,
  onUpdateDraft,
  onUpdateItem,
  onUpdateItemAttribute,
  onAddItemAttribute,
  onRemoveItemAttribute,
  onAddItem,
  onRemoveItem,
  onSubmit,
}: RecoveryOrderModalProps) {
  return (
    <Modal
      onClose={onClose}
      labelledBy="recovery-order-title"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6 backdrop-blur-sm"
      panelClassName="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 id="recovery-order-title" className="text-sm font-bold text-slate-900">Create recovery order</h3>
          <p className="mt-0.5 text-xs text-slate-500">Confirm details before sending this lead to the COD order queue.</p>
        </div>
        <Button variant="icon" size="lg" onClick={onClose} className="border border-slate-200 text-slate-500" aria-label="Close recovery order dialog">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-4 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className={FIELD_LABEL}>
            Customer name
            <input value={orderDraft.customer_name} onChange={event => onUpdateDraft({ customer_name: event.target.value })} className={TEXT_INPUT} />
          </label>
          <label className={FIELD_LABEL}>
            Phone
            <input value={orderDraft.phone} onChange={event => onUpdateDraft({ phone: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400" />
          </label>
          <label className={`md:col-span-2 ${FIELD_LABEL}`}>
            Shipping address
            <textarea value={orderDraft.address} onChange={event => onUpdateDraft({ address: event.target.value })} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold normal-case tracking-normal text-slate-800 outline-none focus:border-indigo-400" />
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className={FIELD_LABEL}>Order items</p>
            <button type="button" onClick={onAddItem} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50">
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
          </div>
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {orderDraft.items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 p-3 md:grid-cols-[minmax(0,1.4fr)_0.55fr_0.7fr_auto]">
                <input value={item.name} onChange={event => onUpdateItem(index, { name: event.target.value })} placeholder="Product name" className={ITEM_INPUT} />
                <input type="number" min={1} value={item.quantity} onChange={event => onUpdateItem(index, { quantity: Number(event.target.value || 1) })} aria-label="Quantity" className={ITEM_INPUT} />
                <input type="number" min={0} value={item.price} onChange={event => onUpdateItem(index, { price: Number(event.target.value || 0) })} aria-label="Price" className={ITEM_INPUT} />
                <button type="button" onClick={() => onRemoveItem(index)} disabled={orderDraft.items.length <= 1} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40" title="Remove item">
                  <Trash2 className="h-4 w-4" />
                </button>
                <input value={item.category} onChange={event => onUpdateItem(index, { category: event.target.value })} placeholder="Category" className="md:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-400" />
                <div className="space-y-2 md:col-span-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Attributes</p>
                    <button type="button" onClick={() => onAddItemAttribute(index)} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 px-2 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50">
                      <Plus className="h-3 w-3" /> Add attribute
                    </button>
                  </div>
                  {Object.entries(item.attributes || {}).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2">
                      <input value={key} onChange={event => onUpdateItemAttribute(index, key, event.target.value, String(value ?? ''))} placeholder="Key, e.g. Color" aria-label="Attribute key" className={ATTRIBUTE_INPUT} />
                      <input value={String(value ?? '')} onChange={event => onUpdateItemAttribute(index, key, key, event.target.value)} placeholder="Value, e.g. Black, Blue" aria-label="Attribute value" className={ATTRIBUTE_INPUT} />
                      <button type="button" onClick={() => onRemoveItemAttribute(index, key)} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" title="Remove attribute">
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
          <label className={FIELD_LABEL}>
            Delivery charge
            <input type="number" min={0} value={orderDraft.delivery_charge} onChange={event => onUpdateDraft({ delivery_charge: Number(event.target.value || 0) })} className={NUMBER_INPUT} />
          </label>
          <label className={FIELD_LABEL}>
            Discount
            <input type="number" min={0} value={orderDraft.discount} onChange={event => onUpdateDraft({ discount: Number(event.target.value || 0) })} className={NUMBER_INPUT} />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">COD total</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{orderLead.currency || 'BDT'} {draftTotal.toLocaleString()}</p>
          </div>
          <label className={`md:col-span-3 ${FIELD_LABEL}`}>
            Note
            <textarea value={orderDraft.note} onChange={event => onUpdateDraft({ note: event.target.value })} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs normal-case tracking-normal outline-none focus:border-indigo-400" />
          </label>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <Button variant="secondary" size="sm" onClick={onClose} className="text-slate-600">Cancel</Button>
        <Button variant="primary" size="sm" onClick={onSubmit} loading={creatingOrder}>
          <ShoppingCart className="h-4 w-4" /> {creatingOrder ? 'Creating...' : 'Create Order'}
        </Button>
      </div>
    </Modal>
  );
}
