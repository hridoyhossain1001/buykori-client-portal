import { useState } from 'react';
import type { IncompleteCheckoutItem, RecoveryOrderItem, RecoveryOrderPayload } from '../../types';

interface UseRecoveryOrderDraftArgs {
  onCreateOrder: (id: number, payload: RecoveryOrderPayload) => Promise<boolean>;
  showToast: (message: string, isError?: boolean) => void;
}

export function useRecoveryOrderDraft({ onCreateOrder, showToast }: UseRecoveryOrderDraftArgs) {
  const [orderLead, setOrderLead] = useState<IncompleteCheckoutItem | null>(null);
  const [orderDraft, setOrderDraft] = useState<RecoveryOrderPayload | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);

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

  const closeCreateOrder = () => {
    setOrderLead(null);
    setOrderDraft(null);
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

  return {
    orderLead,
    orderDraft,
    creatingOrder,
    openCreateOrder,
    closeCreateOrder,
    updateOrderDraft,
    updateOrderItem,
    updateOrderItemAttribute,
    addOrderItemAttribute,
    removeOrderItemAttribute,
    addOrderItem,
    removeOrderItem,
    submitCreateOrder,
    draftTotal,
  };
}
