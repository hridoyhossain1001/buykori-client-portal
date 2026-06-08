import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { 
  Printer, 
  X, 
  Store, 
  User, 
  Phone, 
  MapPin, 
  FileText
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
  orders?: InvoiceOrder[] | null;
  storeName?: string;
  storeEmail?: string;
}

export function InvoiceModal({ isOpen, onClose, order, orders, storeName = "Buykori AdSync Shop", storeEmail = "" }: InvoiceModalProps) {
  if (!isOpen) return null;

  const ordersList = React.useMemo(() => {
    return orders && orders.length > 0 ? orders : (order ? [order] : []);
  }, [orders, order]);
  if (ordersList.length === 0) return null;

  return (
    <InvoiceContent
      onClose={onClose}
      ordersList={ordersList}
      storeName={storeName}
      storeEmail={storeEmail}
    />
  );
}

interface OrderCustomSettings {
  courierId: string;
  deliveryCharge: number;
  qrCodeDataUrl: string;
}

function InvoiceContent({ onClose, ordersList, storeName = "Buykori AdSync Shop", storeEmail = "" }: { onClose: () => void; ordersList: InvoiceOrder[]; storeName?: string; storeEmail?: string }) {

  // Business Profile Info (Editable inline by user for print customization)
  const [bizName, setBizName] = useState(storeName);
  const [bizPhone, setBizPhone] = useState('01700000000');
  const [bizEmail, setBizEmail] = useState(storeEmail || 'support@buykori.app');
  const [bizAddress, setBizAddress] = useState('Dhaka, Bangladesh');
  const [bizInvoiceNote, setBizInvoiceNote] = useState('Thank you for shopping with us! If you have any inquiries regarding this invoice, please feel free to contact our customer support team.');

  // Toggle edit state
  const [isEditingBiz, setIsEditingBiz] = useState(false);

  // Per-order settings map (contains courier ID, delivery charge, and QR data URL)
  const [orderSettings, setOrderSettings] = useState<Record<string, OrderCustomSettings>>(() => {
    const initial: Record<string, OrderCustomSettings> = {};
    ordersList.forEach(order => {
      const orderIdStr = String(order.orderId || order.order_id || 'N/A');
      initial[orderIdStr] = {
        courierId: order.courier_tracking_id || order.courier_order_id || '',
        deliveryCharge: order.delivery_charge !== undefined ? order.delivery_charge : 80,
        qrCodeDataUrl: ''
      };
    });
    return initial;
  });

  useEffect(() => {
    let cancelled = false;

    // Generate QR codes for each order
    const qrPromises = ordersList.map(async (order) => {
      const orderIdStr = String(order.orderId || order.order_id || 'N/A');
      const initialCourierId = order.courier_tracking_id || order.courier_order_id || '';

      let qrUrl = '';
      if (initialCourierId.trim()) {
        try {
          qrUrl = await QRCode.toDataURL(initialCourierId.trim(), {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 144,
          });
        } catch (e) {
          console.error(e);
        }
      }

      return {
        orderIdStr,
        qrCodeDataUrl: qrUrl
      };
    });

    Promise.all(qrPromises).then((results) => {
      if (cancelled) return;
      setOrderSettings(prev => {
        const updated = { ...prev };
        results.forEach(res => {
          const current = updated[res.orderIdStr] || { courierId: '', deliveryCharge: 80, qrCodeDataUrl: '' };
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
    let qrUrl = '';
    if (newCourierId.trim()) {
      try {
        qrUrl = await QRCode.toDataURL(newCourierId.trim(), {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 144,
        });
      } catch (e) {
        console.error("QR Code gen error in editing", e);
      }
    }

    setOrderSettings(prev => {
      const current = prev[orderIdStr] || { courierId: '', deliveryCharge: 80, qrCodeDataUrl: '' };
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
      const current = prev[orderIdStr] || { courierId: '', deliveryCharge: 80, qrCodeDataUrl: '' };
      return {
        ...prev,
        [orderIdStr]: {
          ...current,
          deliveryCharge: newCharge
        }
      };
    });
  };

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
    .text-indigo-600 { color: #4f46e5; }
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
    .border-slate-200 { border-color: #e2e8f0; }
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

    /* === SINGLE PRINT MODE (1 invoice = 1 page) === */
    .print-invoice-page {
      page-break-after: always;
      break-after: page;
    }
    .print-invoice-page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    .print-invoice-page * {
      page-break-inside: avoid;
    }

    /* === BULK PRINT MODE (2 invoices per page) === */
    .bulk-print-mode .print-invoice-page {
      page-break-after: auto;
      break-after: auto;
      padding: 3px 0;
      margin-bottom: 0;
      font-size: 8px;
      line-height: 1.2;
    }
    .bulk-print-mode .print-invoice-page .space-y-6 > *,
    .bulk-print-mode .print-invoice-page.space-y-6 {
      margin-top: 0;
    }
    /* Make each invoice take ~48% of page height */
    .bulk-print-mode .print-invoice-page {
      max-height: 48%;
      overflow: hidden;
    }
    /* Compact header */
    .bulk-print-mode .print-invoice-page .text-lg {
      font-size: 12px;
      line-height: 16px;
    }
    .bulk-print-mode .print-invoice-page .text-base {
      font-size: 10px;
      line-height: 14px;
    }
    /* Compact spacing */
    .bulk-print-mode .print-invoice-page .p-3 { padding: 3px; }
    .bulk-print-mode .print-invoice-page .pb-4,
    .bulk-print-mode .print-invoice-page .pb-6 { padding-bottom: 3px; }
    .bulk-print-mode .print-invoice-page .pt-3,
    .bulk-print-mode .print-invoice-page .pt-4 { padding-top: 2px; }
    .bulk-print-mode .print-invoice-page .gap-4 { gap: 4px; }
    .bulk-print-mode .print-invoice-page .rounded-xl { border-radius: 4px; }
    .bulk-print-mode .print-invoice-page .rounded-2xl { border-radius: 6px; }
    /* Compact QR code */
    .bulk-print-mode .courier-qr-card { width: 80px; padding: 2px; }
    .bulk-print-mode .courier-qr-card .courier-qr-image { width: 40px; height: 40px; }
    .bulk-print-mode .courier-qr-card .w-20 { width: 40px; }
    .bulk-print-mode .courier-qr-card .h-20 { height: 40px; }
    /* Compact signatures */
    .bulk-print-mode .invoice-signatures { padding-top: 6px; }
    .bulk-print-mode .invoice-signatures .w-32 { width: 80px; }
    /* Hide notes in bulk mode to save space */
    .bulk-print-mode .invoice-notes-area { display: none; }
    /* Separator between 2 invoices on same page */
    .bulk-print-mode .bulk-separator {
      border-top: 1px dashed #94a3b8;
      margin: 4px 0;
      display: block;
    }
    /* Page break after every 2nd invoice */
    .bulk-print-mode .bulk-page-break {
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
    }
    /* Last page break should not force extra blank page */
    .bulk-print-mode .bulk-page-break:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }
    
    /* Additional Tailwind Utility classes for Print layout */
    .p-6 { padding: 24px; }
    .p-8 { padding: 32px; }
    .pt-10 { padding-top: 40px; }
    .pt-1\\.5 { padding-top: 6px; }
    .pt-3 { padding-top: 12px; }
    .p-2\\.5 { padding: 10px; }
    .w-16 { width: 64px; }
    .w-24 { width: 96px; }
    .h-20 { height: 80px; }
    .p-1 { padding: 4px; }
    .gap-4 { gap: 16px; }
    .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
    
    @media print {
      .print\:border-0 { border: 0 !important; }
      .print\:p-0 { padding: 0 !important; }
      .print\:rounded-none { border-radius: 0 !important; }
    }
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
      <div className="bg-white  border border-slate-200  rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col my-8  ">
        
        {/* Modal Header - Hidden on Print */}
        <div className="flex items-center justify-between border-b border-slate-100  pb-3 p-6 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 " />
            <h3 className="font-bold text-slate-800  text-base">
              Invoice Generator {ordersList.length > 1 && `(Bulk Mode: ${ordersList.length} Invoices)`}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsEditingBiz(!isEditingBiz)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                isEditingBiz 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700  ' 
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50   '
              }`}
            >
              {isEditingBiz ? 'Save Info Changes' : 'Customize Shop Details'}
            </button>
            <button 
              onClick={handlePrint}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              {ordersList.length > 1 ? `Print All Invoices (${ordersList.length})` : 'Print Invoice'}
            </button>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50  cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100  print:flex-col print:divide-y-0 print:divide-x-0">
          
          {/* Customizer Sidebar - Hidden on Print */}
          {isEditingBiz && (
            <div className="w-full lg:w-80 p-6 bg-slate-50  space-y-4 print:hidden shrink-0 overflow-y-auto max-h-[70vh]">
              <h4 className="text-xs font-bold text-slate-700  uppercase tracking-wider flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-indigo-500" />
                Customize Invoice Print
              </h4>
              <p className="text-[11px] text-slate-400">
                You can change these values to match your store details. They will apply to all invoices currently being customized.
              </p>
              
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Store / Brand Name</label>
                  <input
                    type="text"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Support Email</label>
                  <input
                    type="email"
                    value={bizEmail}
                    onChange={(e) => setBizEmail(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={bizPhone}
                    onChange={(e) => setBizPhone(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Store Address</label>
                  <input
                    type="text"
                    value={bizAddress}
                    onChange={(e) => setBizAddress(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Global Invoice Notes</label>
                  <textarea
                    value={bizInvoiceNote}
                    onChange={(e) => setBizInvoiceNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                  />
                </div>

                {/* Per-order customization list */}
                {ordersList.length === 1 ? (
                  // Legacy single order inputs
                  <>
                    <div className="border-t border-slate-200  pt-3">
                      <h5 className="text-[10px] font-bold text-slate-600  uppercase tracking-wide mb-2">Order Customizations</h5>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Charge (৳)</label>
                          <input
                            type="number"
                            value={orderSettings[String(ordersList[0].orderId || ordersList[0].order_id)]?.deliveryCharge ?? 80}
                            onChange={(e) => handleOrderDeliveryChargeChange(String(ordersList[0].orderId || ordersList[0].order_id), Number(e.target.value))}
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Courier Consignment ID</label>
                          <input
                            type="text"
                            value={orderSettings[String(ordersList[0].orderId || ordersList[0].order_id)]?.courierId ?? ''}
                            onChange={(e) => handleOrderCourierIdChange(String(ordersList[0].orderId || ordersList[0].order_id), e.target.value)}
                            placeholder="e.g. 26E0531XXXX"
                            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  // Bulk items customization list
                  <div className="border-t border-slate-200  pt-3 space-y-3">
                    <h5 className="text-[10px] font-bold text-slate-600  uppercase tracking-wide">Per-Order Customizations</h5>
                    <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
                      {ordersList.map((ord) => {
                        const oId = String(ord.orderId || ord.order_id || 'N/A');
                        const settings = orderSettings[oId] || { courierId: '', deliveryCharge: 80, qrCodeDataUrl: '' };
                        return (
                          <div key={oId} className="p-3 bg-white  border border-slate-200  rounded-xl space-y-2 shadow-xs">
                            <div className="flex justify-between items-center border-b border-slate-100  pb-1">
                              <span className="font-mono font-bold text-[10px] text-indigo-600 ">#{oId}</span>
                              <span className="text-[9px] text-slate-400">{ord.recipientName || ord.recipient_name || 'Customer'}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Courier ID</label>
                                <input
                                  type="text"
                                  value={settings.courierId}
                                  onChange={(e) => handleOrderCourierIdChange(oId, e.target.value)}
                                  placeholder="Consignment ID"
                                  className="w-full px-2 py-1 text-[10px] bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Delivery (৳)</label>
                                <input
                                  type="number"
                                  value={settings.deliveryCharge}
                                  onChange={(e) => handleOrderDeliveryChargeChange(oId, Number(e.target.value))}
                                  className="w-full px-2 py-1 text-[10px] bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Printable Invoice Container */}
          <div className="print-invoice-area-parent flex-1 p-6 md:p-10 bg-slate-100  text-slate-800  max-h-[85vh] overflow-y-auto">

            {/* Invoice Printable Sheet */}
            <div className={`print-invoice-area ${ordersList.length > 1 ? 'bulk-print-mode' : ''} space-y-8 bg-white  text-slate-800  print:bg-white print:text-black`}>
              
              {ordersList.map((ord, idx) => {
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

                const settings = orderSettings[oId] || { courierId: '', deliveryCharge: 80, qrCodeDataUrl: '' };
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

                // In bulk mode: insert separator before odd-indexed invoices, page break after every 2nd
                const isBulk = ordersList.length > 1;
                const showSeparator = isBulk && idx > 0 && idx % 2 === 1; // before 2nd invoice on the page
                const showPageBreak = isBulk && idx % 2 === 1 && idx < ordersList.length - 1; // after 2nd invoice (not last)

                return (
                  <React.Fragment key={oId}>
                    {showSeparator && <div className="bulk-separator" />}
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
                          <span className="text-base font-bold tracking-tight text-slate-900  print:text-black">{bizName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400  space-y-0.5 print:text-slate-600">
                          <p>{bizAddress}</p>
                          <p>Phone: {bizPhone} | Email: {bizEmail}</p>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <h2 className="text-lg font-black tracking-wider text-slate-900  print:text-black uppercase">INVOICE</h2>
                        <div className="text-[10px] text-slate-500  print:text-slate-600 space-y-0.5 font-mono">
                          <p>Invoice #: <span className="font-bold text-slate-800  print:text-black">{oId}</span></p>
                          <p>Date: {invoiceDate}</p>
                          <p>Payment Mode: <span className="font-bold text-emerald-600 print:text-emerald-700">Cash on Delivery (COD)</span></p>
                        </div>
                      </div>
                    </div>

                    {/* Bill To / Ship To customer details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50  p-3 rounded-xl border border-slate-100  print:bg-slate-50 print:border-slate-200 print:grid-cols-2">
                      <div>
                        <h4 className="text-[9px] font-bold text-indigo-600  uppercase tracking-widest mb-1.5 flex items-center gap-1.5 print:text-indigo-600">
                          <User className="w-3 h-3" />
                          Billing & Shipping Recipient
                        </h4>
                        <div className="text-[11px] space-y-0.5">
                          <p className="font-bold text-slate-850  print:text-black">{customerName}</p>
                          <p className="font-mono flex items-center gap-1 text-slate-500  print:text-slate-600">
                            <Phone className="w-2.5 h-2.5 text-slate-400" /> {customerPhone}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[9px] font-bold text-indigo-600  uppercase tracking-widest mb-1.5 flex items-center gap-1.5 print:text-indigo-600">
                          <MapPin className="w-3 h-3" />
                          Delivery Destination
                        </h4>
                        <p className="text-[11px] text-slate-700  leading-normal print:text-black">
                          {customerAddress}
                        </p>
                      </div>
                    </div>

                    {/* Invoice Products Table */}
                    <div className="border border-slate-200  rounded-xl overflow-hidden print:border-slate-200">
                      <table className="w-full text-[10px] text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50  border-b border-slate-200  font-bold uppercase tracking-wider text-slate-500  print:bg-slate-100 print:border-slate-200 print:text-slate-600">
                            <th className="px-3 py-2 text-[9px]">Product Name</th>
                            <th className="px-3 py-2 text-center w-20 text-[9px]">Price</th>
                            <th className="px-3 py-2 text-center w-16 text-[9px]">Quantity</th>
                            <th className="px-3 py-2 text-right w-24 text-[9px]">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100  print:divide-slate-200">
                          {products.length === 0 ? (
                            <tr className="hover:bg-slate-50/50 ">
                              <td className="px-3 py-2 text-slate-500 italic text-[10px]">
                                Standard E-Commerce Product Order
                              </td>
                              <td className="px-3 py-2 text-center font-mono text-[10px]">৳{subtotal.toLocaleString()}</td>
                              <td className="px-3 py-2 text-center text-[10px]">1</td>
                              <td className="px-3 py-2 text-right font-semibold font-mono text-[10px]">৳{subtotal.toLocaleString()}</td>
                            </tr>
                          ) : (
                            products.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 ">
                                <td className="px-3 py-2 font-medium text-slate-800  print:text-black text-[10px]">
                                  {p.name}
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-slate-500  print:text-black text-[10px]">
                                  ৳{p.price.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-center font-bold text-slate-600  print:text-black text-[10px]">
                                  {p.quantity}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold font-mono text-slate-800  print:text-black text-[10px]">
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
                      <div className="invoice-notes-area flex-1 text-[10px] space-y-1">
                        <p className="font-bold text-[8px] uppercase text-slate-400  print:text-slate-600 tracking-wider">Terms & Notes</p>
                        <p className="text-[10px] text-slate-500  print:text-black leading-relaxed italic">
                          {bizInvoiceNote}
                        </p>
                      </div>

                      {/* Column 2: Courier QR Code Card */}
                      {courierId.trim() && (
                        <div className="courier-qr-card w-40 bg-slate-50  p-2.5 rounded-xl border border-slate-200  flex flex-col items-center justify-center text-center space-y-1 shrink-0 print:bg-slate-50 print:border-slate-200">
                          <span className="text-[8px] font-bold text-indigo-600  uppercase tracking-widest print:text-indigo-600">
                            Courier ID QR
                          </span>
                          {qrCodeDataUrl ? (
                            <img
                              src={qrCodeDataUrl}
                              alt={`Courier QR for ${courierId}`}
                              className="courier-qr-image w-20 h-20 shrink-0 bg-white p-1 rounded-lg border border-slate-200"
                            />
                          ) : (
                            <div className="w-20 h-20 shrink-0 border border-dashed border-slate-200 bg-white flex items-center justify-center text-[9px] text-slate-400">
                              Generating QR...
                            </div>
                          )}
                          <span className="font-mono text-[10px] font-black text-slate-800  print:text-black tracking-wider">
                            #{courierId.trim()}
                          </span>
                        </div>
                      )}

                      {/* Column 3: Subtotal & Total calculations */}
                      <div className="w-48 text-[10px] space-y-1.5 shrink-0">
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
                    <div className="invoice-signatures flex justify-between pt-10 text-[10px] text-slate-400  print:text-slate-600">
                      <div className="border-t border-slate-100  pt-1 w-32 text-center print:border-slate-350">
                        Customer Signature
                      </div>
                      <div className="border-t border-slate-100  pt-1 w-32 text-center print:border-slate-350">
                        Authorized Seal
                      </div>
                    </div>

                  </div>
                  {showPageBreak && <div className="bulk-page-break" />}
                  </React.Fragment>
                );
              })}

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
