import { Store } from 'lucide-react';
import {
  DEFAULT_DELIVERY_CHARGE,
  DEFAULT_ORDER_SETTINGS,
  type InvoiceBusinessProfile,
  type InvoiceOrder,
  type OrderCustomSettings,
} from './invoiceTypes';

interface InvoiceCustomizerPanelProps {
  biz: InvoiceBusinessProfile;
  onBizChange: (patch: Partial<InvoiceBusinessProfile>) => void;
  ordersList: InvoiceOrder[];
  orderSettings: Record<string, OrderCustomSettings>;
  handleOrderCourierIdChange: (orderIdStr: string, newCourierId: string) => void;
  handleOrderDeliveryChargeChange: (orderIdStr: string, newCharge: number) => void;
}

const FIELD_CLASS =
  'w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   ';
const LABEL_CLASS = 'block text-xs font-bold text-slate-500 uppercase mb-1';

export function InvoiceCustomizerPanel({
  biz,
  onBizChange,
  ordersList,
  orderSettings,
  handleOrderCourierIdChange,
  handleOrderDeliveryChargeChange,
}: InvoiceCustomizerPanelProps) {
  return (
    <div className="w-full lg:w-80 p-6 bg-slate-50  space-y-4 print:hidden shrink-0 overflow-y-auto max-h-[70vh]">
      <h4 className="text-xs font-bold text-slate-700  uppercase tracking-wider flex items-center gap-1.5">
        <Store className="w-3.5 h-3.5 text-indigo-500" />
        Customize Invoice Print
      </h4>
      <p className="text-xs text-slate-400">
        You can change these values to match your store details. They will apply to all invoices currently being customized.
      </p>

      <div className="space-y-3 pt-2">
        <div>
          <label className={LABEL_CLASS}>Store / Brand Name</label>
          <input
            type="text"
            value={biz.name}
            onChange={(e) => onBizChange({ name: e.target.value })}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Support Email</label>
          <input
            type="email"
            value={biz.email}
            onChange={(e) => onBizChange({ email: e.target.value })}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Phone Number</label>
          <input
            type="text"
            value={biz.phone}
            onChange={(e) => onBizChange({ phone: e.target.value })}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Store Address</label>
          <input
            type="text"
            value={biz.address}
            onChange={(e) => onBizChange({ address: e.target.value })}
            className={FIELD_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Global Invoice Notes</label>
          <textarea
            value={biz.note}
            onChange={(e) => onBizChange({ note: e.target.value })}
            rows={3}
            className={FIELD_CLASS}
          />
        </div>

        {/* Per-order customization list */}
        {ordersList.length === 1 ? (
          // Legacy single order inputs
          <div className="border-t border-slate-200  pt-3">
            <h5 className="text-xs font-bold text-slate-600  uppercase tracking-wide mb-2">Order Customizations</h5>
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLASS}>Delivery Charge (\u09F3)</label>
                <input
                  type="number"
                  {/* TODO(FE-01): this key omits the 'N/A' fallback the settings map is built with. Kept verbatim; fix separately. */}
                  value={orderSettings[String(ordersList[0].orderId || ordersList[0].order_id)]?.deliveryCharge ?? DEFAULT_DELIVERY_CHARGE}
                  onChange={(e) => handleOrderDeliveryChargeChange(String(ordersList[0].orderId || ordersList[0].order_id), Number(e.target.value))}
                  className={FIELD_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Courier Consignment ID</label>
                <input
                  type="text"
                  value={orderSettings[String(ordersList[0].orderId || ordersList[0].order_id)]?.courierId ?? ''}
                  onChange={(e) => handleOrderCourierIdChange(String(ordersList[0].orderId || ordersList[0].order_id), e.target.value)}
                  placeholder="e.g. 26E0531XXXX"
                  className={FIELD_CLASS}
                />
              </div>
            </div>
          </div>
        ) : (
          // Bulk items customization list
          <div className="border-t border-slate-200  pt-3 space-y-3">
            <h5 className="text-xs font-bold text-slate-600  uppercase tracking-wide">Per-Order Customizations</h5>
            <div className="space-y-3 max-h-[30vh] overflow-y-auto pr-1">
              {ordersList.map((ord) => {
                const oId = String(ord.orderId || ord.order_id || 'N/A');
                const settings = orderSettings[oId] || DEFAULT_ORDER_SETTINGS;
                return (
                  <div key={oId} className="p-3 bg-white  border border-slate-200  rounded-xl space-y-2 shadow-xs">
                    <div className="flex justify-between items-center border-b border-slate-100  pb-1">
                      <span className="font-mono font-bold text-xs text-indigo-600 ">#{oId}</span>
                      <span className="text-xs text-slate-400">{ord.recipientName || ord.recipient_name || 'Customer'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-0.5">Courier ID</label>
                        <input
                          type="text"
                          value={settings.courierId}
                          onChange={(e) => handleOrderCourierIdChange(oId, e.target.value)}
                          placeholder="Consignment ID"
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-0.5">Delivery (\u09F3)</label>
                        <input
                          type="number"
                          value={settings.deliveryCharge}
                          onChange={(e) => handleOrderDeliveryChargeChange(oId, Number(e.target.value))}
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500   "
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
  );
}
