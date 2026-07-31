import React, { useState } from 'react';
import { Printer, X, FileText } from 'lucide-react';
import { Modal } from './common/Modal';
import { InvoiceCustomizerPanel } from './invoice/InvoiceCustomizerPanel';
import { InvoiceSheet } from './invoice/InvoiceSheet';
import { printInvoiceArea } from './invoice/invoicePrint';
import { useInvoiceOrderSettings } from './invoice/useInvoiceOrderSettings';
import {
  DEFAULT_INVOICE_NOTE,
  DEFAULT_ORDER_SETTINGS,
  type InvoiceBusinessProfile,
  type InvoiceOrder,
} from './invoice/invoiceTypes';

export type { InvoiceOrder, ProductItem } from './invoice/invoiceTypes';

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

function InvoiceContent({ onClose, ordersList, storeName = "Buykori AdSync Shop", storeEmail = "" }: { onClose: () => void; ordersList: InvoiceOrder[]; storeName?: string; storeEmail?: string }) {

  // Business Profile Info (Editable inline by user for print customization)
  const [biz, setBiz] = useState<InvoiceBusinessProfile>({
    name: storeName,
    phone: '01700000000',
    email: storeEmail || 'support@buykori.app',
    address: 'Dhaka, Bangladesh',
    note: DEFAULT_INVOICE_NOTE,
  });

  const handleBizChange = (patch: Partial<InvoiceBusinessProfile>) => {
    setBiz(prev => ({ ...prev, ...patch }));
  };

  // Toggle edit state
  const [isEditingBiz, setIsEditingBiz] = useState(false);

  const {
    orderSettings,
    handleOrderCourierIdChange,
    handleOrderDeliveryChargeChange,
  } = useInvoiceOrderSettings(ordersList);

  return (
    <Modal
      onClose={onClose}
      labelledBy="invoice-modal-title"
      overlayClassName="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
      panelClassName="my-8 flex w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
    >

        {/* Modal Header - Hidden on Print */}
        <div className="flex items-center justify-between border-b border-slate-100  pb-3 p-6 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600 " />
            <h3 id="invoice-modal-title" className="font-bold text-slate-800  text-base">
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
              onClick={printInvoiceArea}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              {ordersList.length > 1 ? `Print All Invoices (${ordersList.length})` : 'Print Invoice'}
            </button>
            <button 
              type="button"
              onClick={onClose}
              aria-label="Close invoice dialog"
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
            <InvoiceCustomizerPanel
              biz={biz}
              onBizChange={handleBizChange}
              ordersList={ordersList}
              orderSettings={orderSettings}
              handleOrderCourierIdChange={handleOrderCourierIdChange}
              handleOrderDeliveryChargeChange={handleOrderDeliveryChargeChange}
            />
          )}

          {/* Printable Invoice Container */}
          <div className="print-invoice-area-parent flex-1 p-6 md:p-10 bg-slate-100  text-slate-800  max-h-[85vh] overflow-y-auto">

            {/* Invoice Printable Sheet */}
            <div className={`print-invoice-area ${ordersList.length > 1 ? 'bulk-print-mode' : ''} space-y-8 bg-white  text-slate-800  print:bg-white print:text-black`}>

              {ordersList.map((ord, idx) => {
                const oId = String(ord.orderId || ord.order_id || 'N/A');
                const settings = orderSettings[oId] || DEFAULT_ORDER_SETTINGS;

                // In bulk mode: insert separator before odd-indexed invoices, page break after every 2nd
                const isBulk = ordersList.length > 1;
                const showSeparator = isBulk && idx > 0 && idx % 2 === 1; // before 2nd invoice on the page
                const showPageBreak = isBulk && idx % 2 === 1 && idx < ordersList.length - 1; // after 2nd invoice (not last)

                return (
                  <React.Fragment key={oId}>
                    {showSeparator && <div className="bulk-separator" />}
                    <InvoiceSheet ord={ord} settings={settings} biz={biz} />
                    {showPageBreak && <div className="bulk-page-break" />}
                  </React.Fragment>
                );
              })}

            </div>

          </div>

        </div>

    </Modal>
  );
}
