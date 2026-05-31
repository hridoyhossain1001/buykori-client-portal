import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { 
  Printer, 
  X, 
  Store, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  FileText, 
  DollarSign,
  AlertCircle
} from 'lucide-react';

interface ProductItem {
  name: string;
  quantity: number;
  price: number;
}

interface InvoiceOrder {
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

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: InvoiceOrder | null;
  storeName?: string;
  storeEmail?: string;
}

export function InvoiceModal({ isOpen, onClose, order, storeName = "Buykori AdSync Shop", storeEmail = "" }: InvoiceModalProps) {
  if (!isOpen || !order) return null;

  return (
    <InvoiceContent
      onClose={onClose}
      order={order}
      storeName={storeName}
      storeEmail={storeEmail}
    />
  );
}

function InvoiceContent({ onClose, order, storeName = "Buykori AdSync Shop", storeEmail = "" }: Omit<InvoiceModalProps, 'isOpen' | 'order'> & { order: InvoiceOrder }) {

  // Invoice Order ID
  const orderId = order.orderId || order.order_id || 'N/A';
  
  // Recipient Details
  const customerName = order.recipientName || order.recipient_name || 'Customer';
  const customerPhone = order.recipientPhone || order.recipient_phone || '—';
  const customerAddress = order.recipientAddress || order.recipient_address || '—';

  // Date parsing
  const rawDate = order.created_at || order.timestamp || new Date().toISOString();
  const invoiceDate = new Date(rawDate).toLocaleDateString(undefined, { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Business Profile Info (Editable inline by user for print customization)
  const [bizName, setBizName] = useState(storeName);
  const [bizPhone, setBizPhone] = useState('01700000000');
  const [bizEmail, setBizEmail] = useState(storeEmail || 'support@buykori.app');
  const [bizAddress, setBizAddress] = useState('Dhaka, Bangladesh');
  const [bizInvoiceNote, setBizInvoiceNote] = useState('Thank you for shopping with us! If you have any inquiries regarding this invoice, please feel free to contact our customer support team.');

  // Calculation parameters
  const products = order.products || [];
  const codTotal = order.amount || order.cod_amount || 0;
  
  // Default delivery charge: order delivery charge, or 80 if not specified
  const initialDeliveryCharge = order.delivery_charge !== undefined ? order.delivery_charge : 80;
  const [deliveryCharge, setDeliveryCharge] = useState<number>(initialDeliveryCharge);

  // Subtotal calculation
  const calculatedSubtotal = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
  // If no products details or calculatedSubtotal is 0, subtotal is total - delivery charge
  const subtotal = calculatedSubtotal > 0 ? calculatedSubtotal : Math.max(0, codTotal - deliveryCharge);
  
  // Final total (customizable based on editable delivery charge)
  const finalTotal = calculatedSubtotal > 0 ? (calculatedSubtotal + deliveryCharge) : codTotal;

  // Toggle edit state
  const [isEditingBiz, setIsEditingBiz] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const [courierId, setCourierId] = useState(order.courier_tracking_id || order.courier_order_id || '');

  useEffect(() => {
    let cancelled = false;

    if (!courierId.trim()) {
      setQrCodeDataUrl('');
      return;
    }

    QRCode.toDataURL(courierId.trim(), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 144,
    }).then((dataUrl) => {
      if (!cancelled) setQrCodeDataUrl(dataUrl);
    }).catch(() => {
      if (!cancelled) setQrCodeDataUrl('');
    });

    return () => {
      cancelled = true;
    };
  }, [courierId]);

  const handlePrint = () => {
    const printArea = document.querySelector('.print-invoice-area');
    if (!printArea) return;

    const printContent = printArea.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      // Popup blocked fallback
      window.print();
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice Print</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    @page { size: auto; margin: 5mm 8mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      color: #0f172a;
      background: white;
      padding: 4px 8px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11px;
      line-height: 1.4;
    }
    .font-mono { font-family: 'JetBrains Mono', monospace; }
    .font-bold { font-weight: 700; }
    .font-black { font-weight: 900; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }
    .italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    .tracking-tight { letter-spacing: -0.025em; }
    .tracking-wider { letter-spacing: 0.05em; }
    .tracking-widest { letter-spacing: 0.1em; }
    .text-xs { font-size: 10px; line-height: 14px; }
    .text-sm { font-size: 11px; line-height: 16px; }
    .text-base { font-size: 13px; line-height: 18px; }
    .text-xl { font-size: 16px; line-height: 22px; }
    .text-2xl { font-size: 18px; line-height: 24px; }
    .text-\\[9px\\] { font-size: 8px; }
    .text-\\[10px\\] { font-size: 9px; }
    .text-\\[11px\\] { font-size: 10px; line-height: 1.4; }
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .leading-relaxed { line-height: 1.5; }
    .text-slate-400 { color: #94a3b8; }
    .text-slate-500 { color: #64748b; }
    .text-slate-600 { color: #475569; }
    .text-slate-700 { color: #334155; }
    .text-slate-800 { color: #1e293b; }
    .text-slate-900 { color: #0f172a; }
    .text-indigo-600, .text-indigo-650 { color: #4f46e5; }
    .text-emerald-600 { color: #059669; }
    .text-emerald-700 { color: #047857; }
    .text-white { color: white; }
    .text-black { color: black; }
    .bg-white { background-color: white; }
    .bg-slate-50 { background-color: #f8fafc; }
    .bg-slate-100 { background-color: #f1f5f9; }
    .bg-indigo-600 { background-color: #4f46e5; }
    .border-collapse { border-collapse: collapse; }
    .border { border: 1px solid #e2e8f0; }
    .border-t { border-top: 1px solid #e2e8f0; }
    .border-b { border-bottom: 1px solid #e2e8f0; }
    .border-slate-100 { border-color: #f1f5f9; }
    .border-slate-150, .border-slate-200 { border-color: #e2e8f0; }
    .border-dashed { border-style: dashed; }
    .rounded-lg { border-radius: 6px; }
    .rounded-xl { border-radius: 8px; }
    .overflow-hidden { overflow: hidden; }
    .shrink-0 { flex-shrink: 0; }
    .flex { display: flex; }
    .inline-flex { display: inline-flex; }
    .grid { display: grid; }
    .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
    .items-center { align-items: center; }
    .items-start { align-items: flex-start; }
    .justify-center { justify-content: center; }
    .justify-between { justify-content: space-between; }
    .flex-col { flex-direction: column; }
    .flex-1 { flex: 1 1 0%; }
    .gap-1 { gap: 2px; }
    .gap-1\\.5 { gap: 3px; }
    .gap-2 { gap: 5px; }
    .gap-6 { gap: 10px; }
    .space-y-0\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 1px; }
    .space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 2px; }
    .space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 3px; }
    .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 4px; }
    .space-y-2\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 5px; }
    .space-y-8 > :not([hidden]) ~ :not([hidden]) { margin-top: 6px; }
    .w-3 { width: 10px; } .h-3 { height: 10px; }
    .w-4 { width: 14px; } .h-4 { height: 14px; }
    .w-8 { width: 24px; } .h-8 { height: 24px; }
    .w-20 { width: 60px; }
    .w-28 { width: 80px; } .h-28 { height: 80px; }
    .w-40 { width: 130px; }
    .w-48 { width: 140px; }
    .w-64 { width: 210px; }
    .w-full { width: 100%; }
    .p-1\\.5 { padding: 3px; }
    .p-3 { padding: 6px; }
    .p-4 { padding: 8px; }
    .px-4 { padding-left: 8px; padding-right: 8px; }
    .py-3 { padding-top: 4px; padding-bottom: 4px; }
    .py-4 { padding-top: 6px; padding-bottom: 6px; }
    .pb-6 { padding-bottom: 8px; }
    .pt-2 { padding-top: 4px; }
    .pt-4 { padding-top: 6px; }
    .pt-16 { padding-top: 10px; }
    .mb-2 { margin-bottom: 4px; }
    .divide-y > :not([hidden]) ~ :not([hidden]) { border-top: 1px solid #e2e8f0; }
    table { width: 100%; font-size: 10px; text-align: left; border-collapse: collapse; }
    th { padding: 3px 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; font-size: 9px; color: #64748b; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    td { padding: 3px 8px; }
    tbody tr { border-top: 1px solid #f1f5f9; }
    svg { display: none; }
    .w-2\\.5 { width: 8px; } .h-2\\.5 { height: 8px; }
    img { display: inline-block; }
  </style>
</head>
<body>${printContent}</body>
</html>`);

    printWindow.document.close();

    // Wait for QR code images (data URLs) to be ready, then print
    const images = printWindow.document.querySelectorAll('img');
    let loadCount = 0;
    const totalImages = images.length;

    const tryPrint = () => {
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 100);
    };

    if (totalImages === 0) {
      tryPrint();
    } else {
      images.forEach((img) => {
        if (img.complete) {
          loadCount++;
          if (loadCount >= totalImages) tryPrint();
        } else {
          img.onload = () => { loadCount++; if (loadCount >= totalImages) tryPrint(); };
          img.onerror = () => { loadCount++; if (loadCount >= totalImages) tryPrint(); };
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
      
      {/* Modal Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col my-8 dark:print:bg-white dark:print:text-black">
        
        {/* Modal Header - Hidden on Print */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 p-6 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-800 dark:text-white text-base">Invoice Generator</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsEditingBiz(!isEditingBiz)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                isEditingBiz 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900' 
                  : 'border-slate-200 text-slate-655 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {isEditingBiz ? 'Save Info Changes' : 'Customize Shop Details'}
            </button>
            <button 
              onClick={handlePrint}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Invoice
            </button>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-655 p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-850 print:flex-col print:divide-y-0 print:divide-x-0">
          
          {/* Customizer Sidebar - Hidden on Print */}
          {isEditingBiz && (
            <div className="w-full lg:w-80 p-6 bg-slate-50 dark:bg-slate-950/40 space-y-4 print:hidden shrink-0">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-indigo-500" />
                Customize Invoice Print
              </h4>
              <p className="text-[11px] text-slate-400">
                You can change these values to match your store details. They will apply only to the print view of this invoice.
              </p>
              
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Store / Brand Name</label>
                  <input
                    type="text"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Support Email</label>
                  <input
                    type="email"
                    value={bizEmail}
                    onChange={(e) => setBizEmail(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={bizPhone}
                    onChange={(e) => setBizPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Store Address</label>
                  <input
                    type="text"
                    value={bizAddress}
                    onChange={(e) => setBizAddress(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Charge (৳)</label>
                  <input
                    type="number"
                    value={deliveryCharge}
                    onChange={(e) => setDeliveryCharge(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Courier Consignment ID</label>
                  <input
                    type="text"
                    value={courierId}
                    onChange={(e) => setCourierId(e.target.value)}
                    placeholder="e.g. 26E0531XXXX"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice Notes</label>
                  <textarea
                    value={bizInvoiceNote}
                    onChange={(e) => setBizInvoiceNote(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Printable Invoice Container */}
          <div className="print-invoice-area-parent flex-1 p-6 md:p-10 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">

            {/* Invoice Printable Sheet */}
            <div className="print-invoice-area space-y-8 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
              
              {/* Header: Store details and Invoice No */}
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-6 print:border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center print:bg-indigo-600 print:text-white shrink-0">
                      <Store className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white print:text-black">{bizName}</span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 space-y-0.5 print:text-slate-655">
                    <p>{bizAddress}</p>
                    <p>Phone: {bizPhone} | Email: {bizEmail}</p>
                  </div>
                </div>

                <div className="text-right space-y-1.5">
                  <h2 className="text-2xl font-black tracking-wider text-slate-900 dark:text-white print:text-black uppercase">INVOICE</h2>
                  <div className="text-xs text-slate-500 dark:text-slate-400 print:text-slate-655 space-y-0.5 font-mono">
                    <p>Invoice #: <span className="font-bold text-slate-800 dark:text-slate-200 print:text-black">{orderId}</span></p>
                    <p>Date: {invoiceDate}</p>
                    <p>Payment Mode: <span className="font-bold text-emerald-600 print:text-emerald-700">Cash on Delivery (COD)</span></p>
                  </div>
                </div>
              </div>

              {/* Bill To / Ship To customer details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-950/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800 print:bg-slate-50 print:border-slate-200 print:grid-cols-2">
                <div>
                  <h4 className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 print:text-indigo-600">
                    <User className="w-3 h-3" />
                    Billing & Shipping Recipient
                  </h4>
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-850 dark:text-white print:text-black">{customerName}</p>
                    <p className="font-mono flex items-center gap-1 text-slate-500 dark:text-slate-400 print:text-slate-655">
                      <Phone className="w-2.5 h-2.5 text-slate-400" /> {customerPhone}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 print:text-indigo-600">
                    <MapPin className="w-3 h-3" />
                    Delivery Destination
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-350 leading-relaxed print:text-black">
                    {customerAddress}
                  </p>
                </div>
              </div>

              {/* Invoice Products Table */}
              <div className="border border-slate-150 dark:border-slate-800 rounded-xl overflow-hidden print:border-slate-200">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950/70 border-b border-slate-150 dark:border-slate-800 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:bg-slate-100 print:border-slate-200 print:text-slate-655">
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3 text-center w-20">Price</th>
                      <th className="px-4 py-3 text-center w-20">Quantity</th>
                      <th className="px-4 py-3 text-right w-28">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 print:divide-slate-200">
                    {products.length === 0 ? (
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-4 text-slate-500 italic">
                          Standard E-Commerce Product Order
                        </td>
                        <td className="px-4 py-4 text-center font-mono">৳{subtotal.toLocaleString()}</td>
                        <td className="px-4 py-4 text-center">1</td>
                        <td className="px-4 py-4 text-right font-semibold font-mono">৳{subtotal.toLocaleString()}</td>
                      </tr>
                    ) : (
                      products.map((p, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 print:text-black">
                            {p.name}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-slate-500 dark:text-slate-400 print:text-black">
                            ৳{p.price.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-300 print:text-black">
                            {p.quantity}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold font-mono text-slate-800 dark:text-slate-100 print:text-black">
                            ৳{(p.price * p.quantity).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total calculations */}
              <div className="flex justify-between items-start pt-4 gap-6 border-t border-slate-100 dark:border-slate-800 print:border-slate-200">
                {/* Column 1: Note Area */}
                <div className="flex-1 text-xs space-y-2">
                  <p className="font-bold text-[10px] uppercase text-slate-400 dark:text-slate-500 print:text-slate-655 tracking-wider">Terms & Notes</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 print:text-black leading-relaxed italic">
                    {bizInvoiceNote}
                  </p>
                </div>

                {/* Column 2: Courier QR Code Card */}
                {courierId.trim() && (
                  <div className="courier-qr-card w-48 bg-slate-50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-150 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-1.5 shrink-0 print:bg-slate-50 print:border-slate-200">
                    <span className="text-[9px] font-bold text-indigo-650 dark:text-indigo-400 uppercase tracking-widest print:text-indigo-600">
                      Courier ID QR
                    </span>
                    {qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt={`Courier QR for ${courierId}`}
                        className="courier-qr-image w-28 h-28 shrink-0 bg-white p-1.5 rounded-lg border border-slate-200"
                      />
                    ) : (
                      <div className="w-28 h-28 shrink-0 border border-dashed border-slate-200 bg-white flex items-center justify-center text-[10px] text-slate-400">
                        Generating QR...
                      </div>
                    )}
                    <span className="font-mono text-xs font-black text-slate-800 dark:text-white print:text-black tracking-wider">
                      #{courierId.trim()}
                    </span>
                  </div>
                )}

                {/* Column 3: Subtotal & Total calculations */}
                <div className="w-64 text-xs space-y-2.5 shrink-0">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400 print:text-slate-655 font-mono">
                    <span>Subtotal:</span>
                    <span>৳{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 dark:text-slate-400 print:text-slate-655 font-mono">
                    <span>Delivery Charge:</span>
                    <span>৳{deliveryCharge.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-855 dark:text-white border-t border-slate-150 dark:border-slate-800 pt-2 print:border-slate-200 print:text-black">
                    <span>Total (COD):</span>
                    <span className="font-mono text-indigo-650 dark:text-indigo-400 print:text-black">৳{finalTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="invoice-signatures flex justify-between pt-16 text-xs text-slate-400 dark:text-slate-500 print:text-slate-655">
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 w-40 text-center print:border-slate-350">
                  Customer Signature
                </div>
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2 w-40 text-center print:border-slate-350">
                  Authorized Seal
                </div>
              </div>

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
