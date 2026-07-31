export interface ProductItem {
  name?: string;
  content_name?: string;
  quantity?: number;
  price?: number;
}

export interface InvoiceOrder {
  orderId?: string;
  order_id?: string;
  recipientName?: string;
  recipient_name?: string;
  recipientPhone?: string;
  recipient_phone?: string;
  recipientAddress?: string;
  recipient_address?: string;
  amount?: number;
  cod_amount?: number;
  delivery_charge?: number;
  created_at?: string;
  timestamp?: string;
  products?: ProductItem[];
  courier_provider?: string;
  courier_order_id?: string;
  courier_tracking_id?: string;
}

export interface OrderCustomSettings {
  courierId: string;
  deliveryCharge: number;
  qrCodeDataUrl: string;
}

/**
 * Business details printed on every invoice. Editable inline through the
 * customizer panel; not persisted anywhere.
 */
export interface InvoiceBusinessProfile {
  name: string;
  phone: string;
  email: string;
  address: string;
  note: string;
}

export const DEFAULT_DELIVERY_CHARGE = 80;

export const DEFAULT_ORDER_SETTINGS: OrderCustomSettings = {
  courierId: '',
  deliveryCharge: DEFAULT_DELIVERY_CHARGE,
  qrCodeDataUrl: '',
};

export const DEFAULT_INVOICE_NOTE =
  'Thank you for shopping with us! If you have any inquiries regarding this invoice, please feel free to contact our customer support team.';

/** The key used to look an order up inside the per-order settings map. */
export function invoiceOrderKey(order: InvoiceOrder): string {
  return String(order.orderId || order.order_id || 'N/A');
}
