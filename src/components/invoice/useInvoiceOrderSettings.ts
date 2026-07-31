import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  DEFAULT_DELIVERY_CHARGE,
  DEFAULT_ORDER_SETTINGS,
  invoiceOrderKey,
  type InvoiceOrder,
  type OrderCustomSettings,
} from './invoiceTypes';

const QR_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  width: 144,
};

async function toQrDataUrl(value: string, context: string): Promise<string> {
  if (!value.trim()) return '';
  try {
    return await QRCode.toDataURL(value.trim(), QR_OPTIONS);
  } catch (e) {
    console.error(context, e);
    return '';
  }
}

/**
 * Owns the per-order customizations (courier consignment id, delivery charge)
 * and keeps a QR code data URL in sync with the courier id.
 */
export function useInvoiceOrderSettings(ordersList: InvoiceOrder[]) {
  const [orderSettings, setOrderSettings] = useState<Record<string, OrderCustomSettings>>(() => {
    const initial: Record<string, OrderCustomSettings> = {};
    ordersList.forEach(order => {
      const orderIdStr = invoiceOrderKey(order);
      initial[orderIdStr] = {
        courierId: order.courier_tracking_id || order.courier_order_id || '',
        deliveryCharge: order.delivery_charge !== undefined ? order.delivery_charge : DEFAULT_DELIVERY_CHARGE,
        qrCodeDataUrl: ''
      };
    });
    return initial;
  });

  useEffect(() => {
    let cancelled = false;

    // Generate QR codes for each order
    const qrPromises = ordersList.map(async (order) => {
      const orderIdStr = invoiceOrderKey(order);
      const initialCourierId = order.courier_tracking_id || order.courier_order_id || '';

      return {
        orderIdStr,
        qrCodeDataUrl: await toQrDataUrl(initialCourierId, 'QR Code gen error')
      };
    });

    Promise.all(qrPromises).then((results) => {
      if (cancelled) return;
      setOrderSettings(prev => {
        const updated = { ...prev };
        results.forEach(res => {
          const current = updated[res.orderIdStr] || DEFAULT_ORDER_SETTINGS;
          updated[res.orderIdStr] = {
            ...current,
            qrCodeDataUrl: res.qrCodeDataUrl
          };
        });
        return updated;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [ordersList]);

  const handleOrderCourierIdChange = async (orderIdStr: string, newCourierId: string) => {
    const qrUrl = await toQrDataUrl(newCourierId, 'QR Code gen error in editing');

    setOrderSettings(prev => {
      const current = prev[orderIdStr] || DEFAULT_ORDER_SETTINGS;
      return {
        ...prev,
        [orderIdStr]: {
          ...current,
          courierId: newCourierId,
          qrCodeDataUrl: qrUrl
        }
      };
    });
  };

  const handleOrderDeliveryChargeChange = (orderIdStr: string, newCharge: number) => {
    setOrderSettings(prev => {
      const current = prev[orderIdStr] || DEFAULT_ORDER_SETTINGS;
      return {
        ...prev,
        [orderIdStr]: {
          ...current,
          deliveryCharge: newCharge
        }
      };
    });
  };

  return { orderSettings, handleOrderCourierIdChange, handleOrderDeliveryChargeChange };
}
