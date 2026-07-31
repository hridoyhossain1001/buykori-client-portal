import { MapPin, Phone, Store, User } from 'lucide-react';
import type { InvoiceBusinessProfile, InvoiceOrder, OrderCustomSettings } from './invoiceTypes';

interface InvoiceSheetProps {
  ord: InvoiceOrder;
  settings: OrderCustomSettings;
  biz: InvoiceBusinessProfile;
}

/**
 * One printable invoice page. Markup is moved verbatim out of InvoiceModal.tsx,
 * so the class names the print stylesheet targets (print-invoice-page,
 * courier-qr-card, invoice-signatures, invoice-notes-area) must not change.
 */
export function InvoiceSheet({ ord, settings, biz }: InvoiceSheetProps) {
  const oId = String(ord.orderId || ord.order_id || 'N/A');
  const customerName = ord.recipientName || ord.recipient_name || 'Customer';
  const customerPhone = ord.recipientPhone || ord.recipient_phone || '-';
  const customerAddress = ord.recipientAddress || ord.recipient_address || '-';

  const rawDate = ord.created_at || ord.timestamp || new Date().toISOString();
  const invoiceDate = new Date(rawDate).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const courierId = settings.courierId;
  const deliveryCharge = settings.deliveryCharge;
  const qrCodeDataUrl = settings.qrCodeDataUrl;

  const products = ord.products || [];
  const codTotal = ord.amount || ord.cod_amount || 0;

  // Subtotal & Total calculations
  const calculatedSubtotal = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
  const finalTotal = codTotal;
  const subtotal = calculatedSubtotal > 0 ? calculatedSubtotal : Math.max(0, codTotal - deliveryCharge);
  const discount = calculatedSubtotal > 0 ? Math.max(0, (calculatedSubtotal + deliveryCharge) - finalTotal) : 0;

  return (
    <div
      className="print-invoice-page bg-white  text-slate-800  border border-slate-200  rounded-2xl p-6 md:p-8 space-y-6 print:border-0 print:p-0 print:rounded-none border-b border-dashed pb-8 mb-8 last:border-b-0 last:pb-0 last:mb-0 print:border-b-0 print:pb-0 print:mb-0"
    >
      {/* Header: Store details and Invoice No */}
      <div className="flex justify-between items-start border-b border-slate-100  pb-4 print:border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center print:bg-indigo-600 print:text-white shrink-0">
              <Store className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900  print:text-black">{biz.name}</span>
          </div>
          <div className="invoice-print-10 text-slate-400  space-y-0.5 print:text-slate-600">
            <p>{biz.address}</p>
            <p>Phone: {biz.phone} | Email: {biz.email}</p>
          </div>
        </div>

        <div className="text-right space-y-1">
          <h2 className="text-lg font-black tracking-wider text-slate-900  print:text-black uppercase">INVOICE</h2>
          <div className="invoice-print-10 text-slate-500  print:text-slate-600 space-y-0.5 font-mono">
            <p>Invoice #: <span className="font-bold text-slate-800  print:text-black">{oId}</span></p>
            <p>Date: {invoiceDate}</p>
            <p>Payment Mode: <span className="font-bold text-emerald-600 print:text-emerald-700">Cash on Delivery (COD)</span></p>
          </div>
        </div>
      </div>

      {/* Bill To / Ship To customer details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50  p-3 rounded-xl border border-slate-100  print:bg-slate-50 print:border-slate-200 print:grid-cols-2">
        <div>
          <h4 className="invoice-print-9 font-bold text-indigo-600  uppercase tracking-widest mb-1.5 flex items-center gap-1.5 print:text-indigo-600">
            <User className="w-3 h-3" />
            Billing & Shipping Recipient
          </h4>
          <div className="invoice-print-11 space-y-0.5">
            <p className="font-bold text-slate-850  print:text-black">{customerName}</p>
            <p className="font-mono flex items-center gap-1 text-slate-500  print:text-slate-600">
              <Phone className="w-2.5 h-2.5 text-slate-400" /> {customerPhone}
            </p>
          </div>
        </div>

        <div>
          <h4 className="invoice-print-9 font-bold text-indigo-600  uppercase tracking-widest mb-1.5 flex items-center gap-1.5 print:text-indigo-600">
            <MapPin className="w-3 h-3" />
            Delivery Destination
          </h4>
          <p className="invoice-print-11 text-slate-700  leading-normal print:text-black">
            {customerAddress}
          </p>
        </div>
      </div>

      {/* Invoice Products Table */}
      <div className="border border-slate-200  rounded-xl overflow-hidden print:border-slate-200">
        <table className="w-full invoice-print-10 text-left border-collapse">
          <thead>
            <tr className="bg-slate-50  border-b border-slate-200  font-bold uppercase tracking-wider text-slate-500  print:bg-slate-100 print:border-slate-200 print:text-slate-600">
              <th className="px-3 py-2 invoice-print-9">Product Name</th>
              <th className="px-3 py-2 text-center w-20 invoice-print-9">Price</th>
              <th className="px-3 py-2 text-center w-16 invoice-print-9">Quantity</th>
              <th className="px-3 py-2 text-right w-24 invoice-print-9">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100  print:divide-slate-200">
            {products.length === 0 ? (
              <tr className="hover:bg-slate-50/50 ">
                <td className="px-3 py-2 text-slate-500 italic invoice-print-10">
                  Standard E-Commerce Product Order
                </td>
                <td className="px-3 py-2 text-center font-mono invoice-print-10">৳{subtotal.toLocaleString()}</td>
                <td className="px-3 py-2 text-center invoice-print-10">1</td>
                <td className="px-3 py-2 text-right font-semibold font-mono invoice-print-10">৳{subtotal.toLocaleString()}</td>
              </tr>
            ) : (
              products.map((p, i) => (
                <tr key={i} className="hover:bg-slate-50/50 ">
                  <td className="px-3 py-2 font-medium text-slate-800  print:text-black invoice-print-10">
                    {p.name}
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-slate-500  print:text-black invoice-print-10">
                    ৳{p.price.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-slate-600  print:text-black invoice-print-10">
                    {p.quantity}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold font-mono text-slate-800  print:text-black invoice-print-10">
                    ৳{(p.price * p.quantity).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Total calculations */}
      <div className="flex justify-between items-start pt-3 gap-4 border-t border-slate-100  print:border-slate-200">
        {/* Column 1: Note Area */}
        <div className="invoice-notes-area flex-1 invoice-print-10 space-y-1">
          <p className="font-bold invoice-print-8 uppercase text-slate-400  print:text-slate-600 tracking-wider">Terms & Notes</p>
          <p className="invoice-print-10 text-slate-500  print:text-black leading-relaxed italic">
            {biz.note}
          </p>
        </div>

        {/* Column 2: Courier QR Code Card */}
        {courierId.trim() && (
          <div className="courier-qr-card w-40 bg-slate-50  p-2.5 rounded-xl border border-slate-200  flex flex-col items-center justify-center text-center space-y-1 shrink-0 print:bg-slate-50 print:border-slate-200">
            <span className="invoice-print-8 font-bold text-indigo-600  uppercase tracking-widest print:text-indigo-600">
              Courier ID QR
            </span>
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt={`Courier QR for ${courierId}`}
                className="courier-qr-image w-20 h-20 shrink-0 bg-white p-1 rounded-lg border border-slate-200"
              />
            ) : (
              <div className="w-20 h-20 shrink-0 border border-dashed border-slate-200 bg-white flex items-center justify-center invoice-print-9 text-slate-400">
                Generating QR...
              </div>
            )}
            <span className="font-mono invoice-print-10 font-black text-slate-800  print:text-black tracking-wider">
              #{courierId.trim()}
            </span>
          </div>
        )}

        {/* Column 3: Subtotal & Total calculations */}
        <div className="w-48 invoice-print-10 space-y-1.5 shrink-0">
          <div className="flex justify-between text-slate-500  print:text-slate-600 font-mono">
            <span>Subtotal:</span>
            <span>৳{subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-slate-500  print:text-slate-600 font-mono">
            <span>Delivery Charge:</span>
            <span>৳{deliveryCharge.toLocaleString()}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-rose-600 print:text-rose-700 font-mono">
              <span>Discount:</span>
              <span>-৳{discount.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-xs font-bold text-slate-800  border-t border-slate-200  pt-1.5 print:border-slate-200 print:text-black">
            <span>Total (COD):</span>
            <span className="font-mono text-indigo-600  print:text-black">৳{finalTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="invoice-signatures flex justify-between pt-10 invoice-print-10 text-slate-400  print:text-slate-600">
        <div className="border-t border-slate-100  pt-1 w-32 text-center print:border-slate-350">
          Customer Signature
        </div>
        <div className="border-t border-slate-100  pt-1 w-32 text-center print:border-slate-350">
          Authorized Seal
        </div>
      </div>

    </div>
  );
}
