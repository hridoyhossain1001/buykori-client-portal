import React, { useMemo, useState } from 'react';
import { MapPin, Package, Pencil, Phone, Plus, Save, Send, Trash2, User, XCircle } from 'lucide-react';
import type { DeferredOrder, DeferredOrderProduct, DeferredOrderUpdatePayload } from '../../types';
import { updateDeferredOrder } from '../../services/operationsApi';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { normalizeBDPhone, usablePhone } from './ordersUtils';

interface EditableProduct {
  contentId: string;
  name: string;
  category: string;
  attributes: Record<string, string>;
  quantity: number;
  price: number;
}

interface OrderEditModalProps {
  order: DeferredOrder;
  onClose: () => void;
  onSaved: (order: DeferredOrder, continueToCourier: boolean) => void | Promise<void>;
  showToast: (message: string, isError?: boolean) => void;
}

const editableProduct = (product: DeferredOrderProduct, index: number): EditableProduct => ({
  contentId: String(product.content_id || product.id || `item-${index + 1}`),
  name: String(product.name || product.content_name || ''),
  category: String(product.category || product.content_category || ''),
  attributes: Object.fromEntries(
    Object.entries(product.attributes || {}).map(([key, value]) => [key, String(value || '')]),
  ),
  quantity: Math.max(1, Number(product.quantity) || 1),
  price: Math.max(0, Number(product.price) || 0),
});

export function OrderEditModal({ order, onClose, onSaved, showToast }: OrderEditModalProps) {
  const [customerName, setCustomerName] = useState(order.recipientName || order.customerName || '');
  const [phone, setPhone] = useState(usablePhone(order.recipientPhone || order.phone || order.customer));
  const [address, setAddress] = useState(order.recipientAddress || order.address || '');
  const [products, setProducts] = useState<EditableProduct[]>(
    order.products?.length ? order.products.map(editableProduct) : [editableProduct({}, 0)],
  );
  const [deliveryCharge, setDeliveryCharge] = useState(Number(order.deliveryCharge) || 0);
  const [discount, setDiscount] = useState(Number(order.discount) || 0);
  const [codAmount, setCodAmount] = useState(Number(order.orderTotal ?? order.amount) || 0);
  const [note, setNote] = useState(order.note || '');
  const [savingMode, setSavingMode] = useState<'save' | 'courier' | null>(null);

  const productSubtotal = useMemo(
    () => products.reduce((total, item) => total + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0),
    [products],
  );
  const calculatedTotal = Math.max(0, productSubtotal + deliveryCharge - discount);

  const updateProduct = (index: number, changes: Partial<EditableProduct>) => {
    setProducts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
  };

  const addProduct = () => {
    setProducts((current) => [...current, editableProduct({}, current.length)]);
  };

  const removeProduct = (index: number) => {
    setProducts((current) => current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current);
  };

  const saveOrder = async (continueToCourier: boolean) => {
    const normalizedPhone = normalizeBDPhone(phone);
    if (!order.id) {
      showToast('Order details are missing. Refresh the page and try again.', true);
      return;
    }
    if (!customerName.trim() || !usablePhone(normalizedPhone) || address.trim().length < 5) {
      showToast('Enter a customer name, valid Bangladesh phone number, and complete address.', true);
      return;
    }
    if (products.length === 0 || products.some((item) => !item.name.trim() || item.quantity < 1 || item.price < 0)) {
      showToast('Each product needs a name, quantity, and valid price.', true);
      return;
    }

    const payload: DeferredOrderUpdatePayload = {
      customer_name: customerName.trim(),
      phone: normalizedPhone,
      address: address.trim(),
      items: products.map((item) => ({
        name: item.name.trim(),
        content_id: item.contentId,
        quantity: Math.max(1, Number(item.quantity) || 1),
        price: Math.max(0, Number(item.price) || 0),
        attributes: item.attributes,
        category: item.category.trim(),
      })),
      delivery_charge: Math.max(0, Number(deliveryCharge) || 0),
      discount: Math.max(0, Number(discount) || 0),
      cod_amount: Math.max(0, Number(codAmount) || 0),
      note: note.trim(),
    };

    setSavingMode(continueToCourier ? 'courier' : 'save');
    try {
      const updatedOrder = await updateDeferredOrder(order.id, payload);
      showToast('Order updated successfully.');
      await onSaved(updatedOrder, continueToCourier);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update this order.', true);
    } finally {
      setSavingMode(null);
    }
  };

  return (
    <Modal
      onClose={onClose}
      labelledBy="order-edit-title"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm animate-fade-in sm:p-4"
      panelClassName="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-slide-in-up sm:max-h-[calc(100vh-2rem)]"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Pencil className="h-4 w-4 shrink-0 text-indigo-600" />
          <div className="min-w-0">
            <h3 id="order-edit-title" className="truncate text-sm font-bold text-slate-900">Edit order #{order.orderId}</h3>
            <p className="text-xs text-slate-400">Before courier booking</p>
          </div>
        </div>
        <Button variant="icon" size="lg" onClick={onClose} aria-label="Close order editor">
          <XCircle className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="space-y-3">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
            <User className="h-3.5 w-3.5" /> Customer and delivery
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              Customer name
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500" />
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              Phone number
              <span className="relative block">
                <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input value={phone} onChange={(event) => setPhone(event.target.value)} onBlur={() => setPhone(normalizeBDPhone(phone))} className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-indigo-500" />
              </span>
            </label>
          </div>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Delivery address
            <span className="relative block">
              <MapPin className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <textarea value={address} onChange={(event) => setAddress(event.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-indigo-500" />
            </span>
          </label>
        </section>

        <section className="space-y-2 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
              <Package className="h-3.5 w-3.5" /> Order items
            </h4>
            <button type="button" onClick={addProduct} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50">
              <Plus className="h-3.5 w-3.5" /> Add item
            </button>
          </div>
          <div className="space-y-2">
            {products.map((item, index) => (
              <div key={`${item.contentId}-${index}`} className="grid gap-2 rounded-lg border border-slate-200 p-2.5 sm:grid-cols-[minmax(0,1fr)_76px_110px_32px] sm:items-end">
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Product
                  <input value={item.name} onChange={(event) => updateProduct(index, { name: event.target.value })} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500" />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Quantity
                  <input type="number" min={1} value={item.quantity} onChange={(event) => updateProduct(index, { quantity: Math.max(1, Number(event.target.value) || 1) })} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-indigo-500" />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Unit price
                  <input type="number" min={0} step="0.01" value={item.price} onChange={(event) => updateProduct(index, { price: Math.max(0, Number(event.target.value) || 0) })} className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-indigo-500" />
                </label>
                <button type="button" disabled={products.length === 1} onClick={() => removeProduct(index)} className="inline-flex h-9 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30" aria-label={`Remove product ${index + 1}`} title="Remove product">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Product subtotal
            <input readOnly value={productSubtotal.toFixed(2)} className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Delivery charge
            <input type="number" min={0} step="0.01" value={deliveryCharge} onChange={(event) => setDeliveryCharge(Math.max(0, Number(event.target.value) || 0))} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            Discount
            <input type="number" min={0} step="0.01" value={discount} onChange={(event) => setDiscount(Math.max(0, Number(event.target.value) || 0))} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-500" />
          </label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">
            COD to collect
            <input type="number" min={0} step="0.01" value={codAmount} onChange={(event) => setCodAmount(Math.max(0, Number(event.target.value) || 0))} className="h-9 w-full rounded-lg border border-indigo-200 px-3 text-xs font-bold text-indigo-700 outline-none focus:border-indigo-500" />
          </label>
          <p className="text-xs text-slate-400 sm:col-span-2 lg:col-span-4">Calculated total: BDT {calculatedTotal.toLocaleString()}</p>
          <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2 lg:col-span-4">
            Internal note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-indigo-500" />
          </label>
        </section>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
        <Button variant="secondary" size="sm" type="button" loading={savingMode === 'save'} disabled={savingMode !== null} onClick={() => void saveOrder(false)}>
          <Save className="h-3.5 w-3.5" /> Save only
        </Button>
        <Button variant="primary" size="sm" type="button" loading={savingMode === 'courier'} disabled={savingMode !== null} onClick={() => void saveOrder(true)}>
          <Send className="h-3.5 w-3.5" /> Save &amp; continue booking
        </Button>
      </div>
    </Modal>
  );
}

export default OrderEditModal;
