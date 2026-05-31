import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  CheckCircle2, 
  XCircle, 
  Search, 
  ExternalLink, 
  ShieldAlert, 
  Package, 
  Send,
  Loader2,
  RefreshCw,
  Plus,
  FileText,
  User,
  Phone,
  MapPin,
  DollarSign,
  Wifi,
  Copy,
  ChevronDown,
  ChevronUp,
  Info,
  Printer
} from 'lucide-react';
import { CourierOrder, CourierSettings } from '../types';
import { InvoiceModal } from './InvoiceModal';

// ─── BD Phone Normalizer ────────────────────────────────────────────────────
// Accepts any Bangladeshi phone format and returns clean 01XXXXXXXXX (11 digits)
// Handles: +8801XXXXXXXXX, 8801XXXXXXXXX, 01XXXXXXXXX, 1XXXXXXXXX
function normalizeBDPhone(phone: string): string {
  // Strip spaces, dashes, and parentheses
  let clean = phone.replace(/[\s\-\(\)]/g, '');
  // Strip leading country code +880 or 880
  if (clean.startsWith('+880')) clean = clean.substring(4);
  else if (clean.startsWith('880')) clean = clean.substring(3);
  // Ensure starts with 0 (i.e. 1XXXXXXXXX → 01XXXXXXXXX)
  if (clean.length === 10 && !clean.startsWith('0')) {
    clean = '0' + clean;
  }
  return clean; // Returns formatted 01XXXXXXXXX local string
}

interface OrdersViewProps {
  deferredData: any;
  fetchDeferred: () => Promise<void>;
  handleConfirmOrder: (orderId: string) => Promise<void>;
  handleCancelOrder: (orderId: string) => Promise<void>;
  showToast: (msg: string, isErr?: boolean) => void;
  apiKey?: string; // Client-এর api_key — webhook URL তৈরিতে ব্যবহার হয়
  storeName?: string;
  storeEmail?: string;
}

export function OrdersView({
  deferredData,
  fetchDeferred,
  handleConfirmOrder,
  handleCancelOrder,
  showToast,
  apiKey,
  storeName,
  storeEmail,
}: OrdersViewProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'shipped'>('pending');
  const [webhookGuideExpanded, setWebhookGuideExpanded] = useState<Record<string, boolean>>({});
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState<string | null>(null);

  // Webhook URLs
  const PATHAO_WEBHOOK_URL = `https://api.buykori.app/v1/webhook/pathao`;
  const STEADFAST_WEBHOOK_URL = `https://api.buykori.app/v1/webhook/steadfast`;
  const WEBHOOK_SECRET = apiKey ? apiKey.slice(0, 32) : ''; // api_key-এর প্রথম 32 char

  const handleCopyWebhook = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopiedWebhookUrl(label);
    setTimeout(() => setCopiedWebhookUrl(null), 2500);
    showToast('Webhook URL copied to clipboard!', false);
  };

  const toggleWebhookGuide = (provider: string) => {
    setWebhookGuideExpanded(prev => ({ ...prev, [provider]: !prev[provider] }));
  };
  const [courierOrders, setCourierOrders] = useState<CourierOrder[]>([]);
  const [courierSettings, setCourierSettings] = useState<CourierSettings | null>(null);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [submittingCourier, setSubmittingCourier] = useState<boolean>(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null); // which order is being cancelled
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const toggleExpand = (id: string) => setExpandedOrderId(prev => prev === id ? null : id);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Send to Courier Modal State
  const [isSendModalOpen, setIsSendModalOpen] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [courierProvider, setCourierProvider] = useState<string>('steadfast');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');
  const [itemId, setItemId] = useState<number>(0); // Pending Event ID
  
  // Pathao Store and Package details states
  const [pathaoStores, setPathaoStores] = useState<Array<{store_id: number, store_name: string}>>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | ''>('');
  const [loadingStores, setLoadingStores] = useState<boolean>(false);
  const [itemWeight, setItemWeight] = useState<number>(0.5);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [codAmount, setCodAmount] = useState<number>(0);

  // Selection state & functions for Shipped Courier Log
  const [selectedShippedOrderIds, setSelectedShippedOrderIds] = useState<number[]>([]);
  const [invoiceOrders, setInvoiceOrders] = useState<any[] | null>(null);

  // Clear selection on tab, search, or filter changes to avoid stale/hidden selections
  useEffect(() => {
    setSelectedShippedOrderIds([]);
  }, [activeTab, searchQuery, providerFilter, statusFilter]);

  const toggleSelectShippedOrder = (orderId: number) => {
    setSelectedShippedOrderIds(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId) 
        : [...prev, orderId]
    );
  };

  // Invoice Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [invoiceOrder, setInvoiceOrder] = useState<any>(null);

  const openInvoice = (order: any) => {
    setInvoiceOrder(order);
    setInvoiceOrders(null);
    setIsInvoiceModalOpen(true);
  };

  const openBulkInvoices = (ordersList: any[]) => {
    setInvoiceOrders(ordersList);
    setInvoiceOrder(null);
    setIsInvoiceModalOpen(true);
  };

  const fetchCourierOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/courier/orders');
      if (res.ok) {
        const data = await res.json();
        setCourierOrders(data);
      } else {
        showToast("Failed to fetch courier orders.", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading courier orders.", true);
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchCourierSettings = async () => {
    try {
      const res = await fetch('/api/courier/settings');
      if (res.ok) {
        const data = await res.json();
        setCourierSettings(data);
        if (data.default_courier) {
          setCourierProvider(data.default_courier);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPathaoStores = async () => {
    setLoadingStores(true);
    try {
      const res = await fetch('/api/courier/pathao/stores');
      if (res.ok) {
        const data = await res.json();
        setPathaoStores(data);
        if (data.length > 0) {
          const defaultStore = data.find((s: any) => String(s.store_id) === String(courierSettings?.pathao_store_id));
          if (defaultStore) {
            setSelectedStoreId(defaultStore.store_id);
          } else {
            setSelectedStoreId(data[0].store_id);
          }
        }
      } else {
        showToast("Failed to fetch Pathao stores.", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading Pathao stores.", true);
    } finally {
      setLoadingStores(false);
    }
  };

  useEffect(() => {
    fetchCourierSettings();
    fetchCourierOrders();
  }, []);

  useEffect(() => {
    if (isSendModalOpen && courierProvider === 'pathao') {
      fetchPathaoStores();
    }
  }, [isSendModalOpen, courierProvider, courierSettings]);

  const openSendModal = (order: any) => {
    // Find the original pending event from deferredData or fallback to fields
    // Find the event ID corresponding to orderId
    const pendingEvent = deferredData?.pendingList?.find((o: any) => o.orderId === order.orderId);
    
    // We need to fetch the full pending event metadata to get name, phone, address if available
    // For now, let's prefill with what we have
    setSelectedOrder(order);
    setRecipientName(order.recipientName || (order.customer.includes('@') ? '' : order.customer));
    setRecipientPhone(order.recipientPhone || (order.customer.match(/^\+?[0-9\s-]{10,15}$/) ? order.customer : ''));
    setRecipientAddress(order.recipientAddress || '');
    setCodAmount(order.amount);
    
    // Try to find full address or details if stored locally in raw event payload (deferredData may have details)
    // In our backend, user_data.ph contains phone, user_data.em contains email, 
    // Let's call /api/events to search or use default inputs.
    // Actually, we can fetch event details or let them type it.
    // Let's call a fast endpoint to get raw event data for recipient info!
    setIsSendModalOpen(true);

    // Fetch the pending event ID
    fetchPendingEventDetails(order.orderId);
  };

  const fetchPendingEventDetails = async (orderId: string) => {
    try {
      const res = await fetch(`/api/events?limit=5&search=${orderId}`);
      if (res.ok) {
        const data = await res.json();
        const found = data.events?.find((e: any) => e.deduplicationKey === orderId || e.payload?.order_id === orderId || e.payload?.custom_data?.order_id === orderId || e.id === orderId);
        
        // Find in local pending events instead
        const peRes = await fetch(`/api/deferred`);
        if (peRes.ok) {
          const peData = await peRes.json();
          // We need event ID
          // Let's fetch details of the specific order
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to retrieve the pending event DB ID
  const handleOpenSendToCourier = async (order: any) => {
    try {
      // Fetch matching pending event from server to get ID and customer details
      const res = await fetch(`/api/deferred`);
      if (res.ok) {
        const data = await res.json();
        // Since get_deferred_purchases returns pendingList with orderId, amount, customer, etc.
        // We need the database primary key ID of the PendingEvent to make a POST to /api/courier/send
        // Let's add a backend endpoint or search for the event
        // Wait! Let's check how we retrieve it.
        // We can expose the ID in `pendingList` in `client_api.py`!
        // Oh! Let's check `client_api.py` line 1020:
        // `pending_list.append({ "orderId": pe.order_id, "amount": ... })`
        // It does not include `id: pe.id`!
        // Let's modify `client_api.py` in our next step to include `"id": pe.id` in `pending_list`!
        // For now, let's assume `id` is passed, or we can find it.
        // Let's make sure we update client_api.py to include pe.id.
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendToCourierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      showToast("নাম, ফোন নম্বর এবং ঠিকানা অবশ্যই পূরণ করুন।", true);
      return;
    }

    setSubmittingCourier(true);
    try {
      // 'id' field is the DB primary key of the PendingEvent
      const dbId = selectedOrder?.id;
      if (!dbId) {
        showToast("Error: Pending Event ID পাওয়া যায়নি। পেজ রিফ্রেশ করুন।", true);
        setSubmittingCourier(false);
        return;
      }

      const payload: any = {
        pending_event_id: dbId,
        courier_provider: courierProvider,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        recipient_address: recipientAddress,
        cod_amount: Number(codAmount),
        item_weight: Number(itemWeight),
        item_quantity: Number(itemQuantity)
      };

      // Pathao: use selectedStoreId from API-fetched stores list
      if (courierProvider === 'pathao' && selectedStoreId !== '') {
        payload.store_id = Number(selectedStoreId);
      } else if (courierProvider === 'pathao' && courierSettings?.pathao_store_id) {
        // fallback: settings-এ store_id থাকলে সেটা ব্যবহার করো
        payload.store_id = Number(courierSettings.pathao_store_id);
      }

      const res = await fetch('/api/courier/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`✅ অর্ডার সফলভাবে ${courierProvider === 'pathao' ? 'Pathao' : 'SteadFast'}-এ পাঠানো হয়েছে!`, false);
        setIsSendModalOpen(false);
        fetchDeferred();
        fetchCourierOrders();
      } else {
        const errData = await res.json();
        showToast(errData.detail || "Courier-এ পাঠাতে সমস্যা হয়েছে।", true);
      }
    } catch (err) {
      console.error(err);
      showToast("নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।", true);
    } finally {
      setSubmittingCourier(false);
    }
  };

  // ─── Cancel Courier Order ───────────────────────────────────────────────
  const handleCancelCourierOrder = async (order: CourierOrder) => {
    const providerName = order.courier_provider === 'pathao' ? 'Pathao' : 'SteadFast';
    const confirmMsg =
      order.courier_provider === 'steadfast'
        ? `এই order টি locally cancelled হবে।\nSteadFast merchant panel থেকেও manually cancel করুন।\n\nCancel করবেন?`
        : `Pathao-তে Order ID "${order.order_id}" cancel করবেন?\nShুধু Pending/Pickup status-এ cancel সম্ভব।`;

    if (!window.confirm(confirmMsg)) return;

    setCancellingOrderId(order.id);
    try {
      const res = await fetch(`/api/courier/cancel/${order.id}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        const toastMsg = data.local_only
          ? `Order cancelled locally. Please also cancel from ${providerName} merchant panel.`
          : `Order ${order.order_id} successfully cancelled on ${providerName}!`;
        showToast(toastMsg, data.local_only);
        fetchCourierOrders();
        fetchDeferred();
      } else {
        showToast(data.detail || data.message || `Failed to cancel order on ${providerName}.`, true);
      }
    } catch (err) {
      console.error('Cancel error:', err);
      showToast('Network error while cancelling order.', true);
    } finally {
      setCancellingOrderId(null);
    }
  };

  // Filtered courier orders
  const filteredCourierOrders = courierOrders.filter(order => {
    const matchesSearch = 
      order.order_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.recipient_phone && order.recipient_phone.includes(searchQuery)) ||
      (order.recipient_name && order.recipient_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.courier_tracking_id && order.courier_tracking_id.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesProvider = providerFilter === 'all' ? true : order.courier_provider === providerFilter;
    const matchesStatus = statusFilter === 'all' ? true : order.courier_status === statusFilter;

    return matchesSearch && matchesProvider && matchesStatus;
  });

  const filteredShippedIds = filteredCourierOrders.map(o => o.id);
  const areAllFilteredSelected = filteredShippedIds.length > 0 && 
    filteredShippedIds.every(id => selectedShippedOrderIds.includes(id));

  const toggleSelectAllFilteredShipped = () => {
    if (areAllFilteredSelected) {
      setSelectedShippedOrderIds(prev => prev.filter(id => !filteredShippedIds.includes(id)));
    } else {
      setSelectedShippedOrderIds(prev => Array.from(new Set([...prev, ...filteredShippedIds])));
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'delivered' || s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40">
          Delivered
        </span>
      );
    }
    if (s === 'returned' || s === 'partial_returned') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/40">
          Returned
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800">
          Cancelled
        </span>
      );
    }
    if (s === 'in_transit' || s === 'picked_up' || s === 'shipped') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/40">
          In Transit
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40">
        Pending
      </span>
    );
  };

  const getCapiStatusBadge = (sent: boolean) => {
    return sent ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-250 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/60">
        Purchase Dispatched
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-800">
        Awaiting Delivery
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Tab bar header */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'pending'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-250'
          }`}
        >
          <Package className="w-4 h-4" />
          Pending COD Queue ({deferredData?.pendingCount || 0})
        </button>
        <button
          onClick={() => setActiveTab('shipped')}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'shipped'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-500 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-250'
          }`}
        >
          <Truck className="w-4 h-4" />
          Shipped Courier Log ({courierOrders.length})
        </button>
        
        <button 
          onClick={() => {
            fetchDeferred();
            fetchCourierOrders();
            showToast("Syncing data feeds...", false);
          }}
          className="ml-auto p-2 self-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
          title="Reload lists"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {activeTab === 'pending' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col space-y-4 dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">COD Hold Queue (Awaiting Verification)</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Orders placed via Cash on Delivery are held here. You can manually confirm them, cancel them, or automatically book them onto couriers.
            </p>
          </div>

          <div className="overflow-x-auto min-h-64">
            <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[750px] dark:text-slate-300 dark:divide-slate-800">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3">Order ID</th>
                  <th className="px-6 py-3">Customer Info</th>
                  <th className="px-6 py-3">Value</th>
                  <th className="px-6 py-3">Fraud Score</th>
                  <th className="px-6 py-3">Time Held</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {!deferredData?.pendingList || deferredData.pendingList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium dark:text-slate-500">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                      No pending orders waiting in the verification queue.
                    </td>
                  </tr>
                ) : (
                  deferredData.pendingList.map((order: any) => {
                    const isExpanded = expandedOrderId === order.orderId;
                    const products: any[] = order.products || [];
                    return (
                      <React.Fragment key={order.orderId}>
                        <tr className={`hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/40 ${isExpanded ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''}`}>
                          <td className="px-6 py-3">
                            <button
                              onClick={() => toggleExpand(order.orderId)}
                              className="flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                              {order.orderId}
                            </button>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex flex-col gap-0.5">
                              {order.recipientName && order.recipientName !== '—' && (
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{order.recipientName}</span>
                              )}
                              <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">{order.customer}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 font-semibold text-slate-800 dark:text-slate-200">৳{order.amount.toLocaleString()}</td>
                          <td className="px-6 py-3">
                            <span 
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                                order.fraudScore >= 75 ? 'bg-rose-50 text-rose-700 border-rose-150 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/60' : 
                                order.fraudScore >= 35 ? 'bg-amber-50 text-amber-700 border-amber-150 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/60' : 
                                'bg-green-50 text-green-700 border-green-150 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/60'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                order.fraudScore >= 75 ? 'bg-rose-500' : 
                                order.fraudScore >= 35 ? 'bg-amber-500' : 'bg-green-500'
                              }`} />
                              Score: {order.fraudScore}/100
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-400 font-mono dark:text-slate-500">{order.ageHours}h ago</td>
                          <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                            <button 
                              onClick={() => openInvoice(order)}
                              className="btn-touch-expand px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="View and Print Invoice"
                            >
                              <FileText className="w-2.5 h-2.5" /> Invoice
                            </button>
                            <button
                              onClick={() => {
                                // order.id = PendingEvent DB primary key (from /api/deferred)
                                setSelectedOrder(order);
                                setRecipientName(order.recipientName && order.recipientName !== '—' ? order.recipientName : '');
                                setRecipientPhone(order.recipientPhone && order.recipientPhone !== '—' ? order.recipientPhone : (order.customer && !order.customer.includes('@') ? order.customer : ''));
                                setRecipientAddress(order.recipientAddress && order.recipientAddress !== '—' ? order.recipientAddress : '');
                                setCodAmount(order.amount);
                                setIsSendModalOpen(true);
                              }}
                              className="btn-touch-expand px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Send className="w-2.5 h-2.5" /> Book Courier
                            </button>
                            <button 
                              onClick={() => handleConfirmOrder(order.orderId)}
                              className="btn-touch-expand px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer"
                              title="Confirm order. If auto courier is enabled, Purchase waits for delivery."
                            >
                              Confirm
                            </button>
                            <button 
                              onClick={() => handleCancelOrder(order.orderId)}
                              className="btn-touch-expand px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-900/60">
                            <td colSpan={6} className="px-6 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Customer Info Card */}
                                <div className="space-y-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Customer Details</p>
                                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
                                        <User className="w-3.5 h-3.5 text-indigo-500" />
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-bold">Name</p>
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{order.recipientName || '—'}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-bold">Phone</p>
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 font-mono">{order.recipientPhone || order.customer || '—'}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                      <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                                        <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                      </div>
                                      <div>
                                        <p className="text-[9px] text-slate-400 uppercase font-bold">Address</p>
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{order.recipientAddress || '—'}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Products Card */}
                                <div className="space-y-2.5">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    Order Items {products.length > 0 && <span className="ml-1 text-indigo-500">({products.length})</span>}
                                  </p>
                                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    {products.length === 0 ? (
                                      <div className="px-4 py-5 text-center">
                                        <Package className="w-5 h-5 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                                        <p className="text-[10px] text-slate-400">Product details not available for this order</p>
                                      </div>
                                    ) : (
                                      <table className="w-full text-xs">
                                        <thead className="bg-slate-50 dark:bg-slate-950">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-[9px] font-bold uppercase text-slate-400">Product</th>
                                            <th className="px-3 py-2 text-center text-[9px] font-bold uppercase text-slate-400">Qty</th>
                                            <th className="px-3 py-2 text-right text-[9px] font-bold uppercase text-slate-400">Price</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                          {products.map((p: any, i: number) => (
                                            <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                              <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 max-w-[160px] truncate" title={p.name}>{p.name}</td>
                                              <td className="px-3 py-2 text-center font-bold text-slate-600 dark:text-slate-300">{p.quantity}</td>
                                              <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{p.price > 0 ? `৳${p.price.toLocaleString()}` : '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'shipped' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col space-y-4 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Shipped Consignment Log</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Track delivery statuses on SteadFast or Pathao. Delivery completion triggers a CAPI Purchase event; Returns fire a Refund event.
              </p>
            </div>
          </div>

          {/* ─── Webhook Setup Banner ─── */}
          <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 dark:border-indigo-900/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <Wifi className="w-3.5 h-3.5 text-white" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Real-time Delivery Tracking Setup</h4>
                <p className="text-[10px] text-indigo-600/80 dark:text-indigo-400/70 mt-0.5">
                  Courier-এর Merchant Panel-এ Webhook URL যোগ করুন — তাহলে order status real-time আপডেট হবে। না করলেও প্রতি ৩০ মিনিটে auto-check হবে।
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Pathao Webhook */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-900/30 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-indigo-50 dark:border-indigo-900/20">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Pathao Courier Webhook</span>
                  </div>
                  <button
                    onClick={() => toggleWebhookGuide('pathao')}
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {webhookGuideExpanded['pathao'] ? 'Hide Guide' : 'How to Setup'}
                    {webhookGuideExpanded['pathao'] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Webhook URL (Copy করুন)</p>
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
                      <code className="flex-1 text-[10px] font-mono text-indigo-700 dark:text-indigo-400 truncate">{PATHAO_WEBHOOK_URL}</code>
                      <button
                        onClick={() => handleCopyWebhook(PATHAO_WEBHOOK_URL, 'pathao')}
                        className="shrink-0 p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                        title="Copy Pathao Webhook URL"
                      >
                        {copiedWebhookUrl === 'pathao' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {webhookGuideExpanded['pathao'] && (
                    <div className="mt-2 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
                      {/* Critical warning banner */}
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800">
                        <span className="text-rose-600 dark:text-rose-400 text-sm shrink-0 font-bold">⚠️</span>
                        <p className="text-[10px] text-rose-700 dark:text-rose-400 leading-relaxed font-semibold">
                          সতর্কতা: নিচের Callback URL-এ আপনার নিজের ওয়েবসাইটের URL দেওয়া যাবে না।
                          উপরে দেওয়া <strong>আমাদের Webhook URL</strong> কপি করে হুবহু বসান।
                        </p>
                      </div>

                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mt-2">Step-by-step Setup:</p>
                      {[
                        { step: '1', text: 'Pathao Merchant Panel-এ login করুন (parcel.pathao.com)' },
                        { step: '2', text: 'Developer API → Webhook Integration section-এ যান' },
                        { step: '3', text: 'Callback URL-এ উপরের আমাদের Webhook URL টি copy করে paste করুন' },
                      ].map(({ step, text }) => (
                        <div key={step} className="flex items-start gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[9px] font-bold flex items-center justify-center">{step}</span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">{text}</span>
                        </div>
                      ))}

                      {/* Secret field instructions */}
                      <div className="mt-1.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-amber-600 dark:text-amber-400 text-xs font-bold">🔑</span>
                          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                            Step 4 — Secret / Signature Key field-এ কী দেবেন?
                          </p>
                        </div>
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                          এই portal-এর <strong>Settings → Courier Settings → "Pathao Client Secret"</strong> field-এ যে secret দিয়েছেন, সেটিই হুবহু copy করে Pathao Panel-এর Secret field-এ দিন।
                        </p>
                        <p className="text-[9px] text-amber-600/80 dark:text-amber-500/70 italic">
                          (আমাদের সার্ভার এই same Client Secret দিয়েই Pathao-র ডেটা verify করে।)
                        </p>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[9px] font-bold flex items-center justify-center">5</span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">Events: "Delivered", "Returned", "Cancelled" সব enable করুন</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[9px] font-bold flex items-center justify-center">6</span>
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">Save করুন — এখন থেকে real-time update পাবেন! ✅</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SteadFast Webhook */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800/60 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50 dark:border-slate-800/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">SteadFast Courier Webhook</span>
                  </div>
                  <button
                    onClick={() => toggleWebhookGuide('steadfast')}
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {webhookGuideExpanded['steadfast'] ? 'Hide Guide' : 'How to Setup'}
                    {webhookGuideExpanded['steadfast'] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Webhook URL (Copy করুন)</p>
                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1.5">
                      <code className="flex-1 text-[10px] font-mono text-slate-700 dark:text-slate-400 truncate">{STEADFAST_WEBHOOK_URL}</code>
                      <button
                        onClick={() => handleCopyWebhook(STEADFAST_WEBHOOK_URL, 'steadfast')}
                        className="shrink-0 p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                        title="Copy SteadFast Webhook URL"
                      >
                        {copiedWebhookUrl === 'steadfast' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {webhookGuideExpanded['steadfast'] && (
                    <div className="mt-2 space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Step-by-step Setup:</p>
                      {[
                        { step: '1', text: 'SteadFast Merchant Portal-এ login করুন (portal.packzy.com)' },
                        { step: '2', text: 'Profile / Settings → Webhook Configuration-এ যান' },
                        { step: '3', text: 'উপরের Webhook URL টি paste করুন' },
                        { step: '4', text: 'Status Events: সব enable করুন' },
                        { step: '5', text: 'Save করুন — real-time updates চালু হবে!' },
                      ].map(({ step, text }) => (
                        <div key={step} className="flex items-start gap-2">
                          <span className="shrink-0 w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 text-[9px] font-bold flex items-center justify-center">{step}</span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">{text}</span>
                        </div>
                      ))}
                      <div className="flex items-start gap-2 mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30">
                        <Info className="w-3 h-3 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-[9px] text-blue-700 dark:text-blue-400">
                          Webhook না করলেও প্রতি <strong>৩০ মিনিট</strong> পর পর আমাদের system automatically status check করে।
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap gap-3 p-3 bg-slate-50 rounded-lg dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                placeholder="Search by Order ID, tracking or recipient..."
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
              />
            </div>
            
            <div className="w-[150px]">
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white cursor-pointer"
              >
                <option value="all">All Couriers</option>
                <option value="steadfast">SteadFast</option>
                <option value="pathao">Pathao</option>
              </select>
            </div>

            <div className="w-[150px]">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="returned">Returned</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedShippedOrderIds.length > 0 && (
            <div className="flex items-center justify-between p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-900/50 animate-fade-in mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-indigo-650 dark:bg-indigo-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {selectedShippedOrderIds.length} {selectedShippedOrderIds.length === 1 ? 'order' : 'orders'} selected for bulk actions
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const selectedOrders = courierOrders.filter(o => selectedShippedOrderIds.includes(o.id));
                    openBulkInvoices(selectedOrders);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Bulk Print Invoices ({selectedShippedOrderIds.length})
                </button>
                <button
                  onClick={() => setSelectedShippedOrderIds([])}
                  className="px-3 py-1.5 border border-slate-200 text-slate-655 hover:bg-slate-100 dark:border-slate-850 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto min-h-64">
            <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[1000px] dark:text-slate-300 dark:divide-slate-800">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 w-10 text-center">
                    <input 
                      type="checkbox" 
                      checked={areAllFilteredSelected} 
                      onChange={toggleSelectAllFilteredShipped}
                      className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                    />
                  </th>
                  <th className="px-5 py-3">Order ID</th>
                  <th className="px-5 py-3">Courier / Tracking</th>
                  <th className="px-5 py-3">Recipient Info</th>
                  <th className="px-5 py-3">COD Amount</th>
                  <th className="px-5 py-3">Courier Status</th>
                  <th className="px-5 py-3">CAPI Telemetry</th>
                  <th className="px-5 py-3">Booked Date</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loadingOrders ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 mx-auto animate-spin text-indigo-500 mb-2" />
                      Fetching consignment details...
                    </td>
                  </tr>
                ) : filteredCourierOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-medium">
                      No matching courier consignments found.
                    </td>
                  </tr>
                ) : (
                  filteredCourierOrders.map((order) => {
                    const isCancellable = !['cancelled', 'delivered', 'returned'].includes(
                      (order.courier_status || '').toLowerCase()
                    );
                    const isCancelling = cancellingOrderId === order.id;
                    return (
                    <tr key={order.id} className="hover:bg-slate-50/50 transition-colors dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedShippedOrderIds.includes(order.id)} 
                          onChange={() => toggleSelectShippedOrder(order.id)}
                          className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                        />
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-slate-800 dark:text-slate-100">{order.order_id}</td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs capitalize text-slate-800 dark:text-slate-200">
                            {order.courier_provider}
                          </span>
                          {order.courier_tracking_id ? (
                            <span className="font-mono text-[10px] text-slate-400 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              {order.courier_tracking_id}
                              <a
                                href={
                                  order.courier_provider === 'steadfast'
                                    ? `https://portal.packzy.com/tracking/${order.courier_tracking_id}`
                                    : `https://pathao.com/courier/tracking`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-500 hover:text-indigo-700 inline"
                              >
                                <ExternalLink className="w-2.5 h-2.5 inline" />
                              </a>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">No Tracking</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col text-[11px] leading-tight">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{order.recipient_name || '—'}</span>
                          <span className="text-slate-500 font-mono mt-0.5">{order.recipient_phone || '—'}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[200px] mt-0.5" title={order.recipient_address}>
                            {order.recipient_address || '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 dark:text-slate-100">৳{order.cod_amount.toLocaleString()}</span>
                          {order.delivery_charge > 0 && (
                            <span className="text-[10px] text-rose-500 font-medium">Charge: ৳{order.delivery_charge}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">{getStatusBadge(order.courier_status)}</td>
                      <td className="px-5 py-3">{getCapiStatusBadge(order.purchase_event_sent)}</td>
                      <td className="px-5 py-3 text-slate-400 font-mono text-[10px]">
                        {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 text-right space-x-2 whitespace-nowrap">
                        <button 
                          onClick={() => openInvoice(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                          title="View and Print Invoice"
                        >
                          <FileText className="w-2.5 h-2.5" /> Invoice
                        </button>
                        {isCancellable ? (
                          <button
                            id={`cancel-courier-order-${order.id}`}
                            onClick={() => handleCancelCourierOrder(order)}
                            disabled={isCancelling}
                            title={`Cancel this ${order.courier_provider} order`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer dark:bg-rose-950/20 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/40"
                          >
                            {isCancelling ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <XCircle className="w-2.5 h-2.5" />
                            )}
                            {isCancelling ? 'Cancelling...' : 'Cancel'}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-350 dark:text-slate-600 italic">
                            {(order.courier_status || '').toLowerCase() === 'cancelled' ? 'Cancelled' :
                             (order.courier_status || '').toLowerCase() === 'delivered' ? 'Delivered' : 'Returned'}
                          </span>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Book to Courier Form Modal */}
      {isSendModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col space-y-5 animate-slide-in-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-800 dark:text-white text-base">Book Consignment with Courier</h3>
              </div>
              <button 
                onClick={() => setIsSendModalOpen(false)}
                className="text-slate-400 hover:text-slate-655 p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSendToCourierSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Order Meta details read-only */}
                <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Order Reference ID</span>
                  <span className="font-mono font-bold text-sm text-slate-800 dark:text-white">{selectedOrder.orderId || selectedOrder.order_id}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Original Value</span>
                  <span className="font-bold text-sm text-slate-800 dark:text-white">৳{(selectedOrder.amount || selectedOrder.cod_amount || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Order Items (Products) */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order Items</label>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                  {(!selectedOrder?.products || selectedOrder.products.length === 0) ? (
                    <div className="px-4 py-3 text-center">
                      <p className="text-[10px] text-slate-400">Product details not available</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-950">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-[9px] font-bold uppercase text-slate-400">Product</th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-bold uppercase text-slate-400">Qty</th>
                          <th className="px-3 py-1.5 text-right text-[9px] font-bold uppercase text-slate-400">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedOrder.products.map((p: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200 max-w-[160px] truncate" title={p.name}>{p.name}</td>
                            <td className="px-3 py-1.5 text-center font-bold text-slate-600 dark:text-slate-300">{p.quantity}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-slate-700 dark:text-slate-200">{p.price > 0 ? `৳${p.price.toLocaleString()}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Courier Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Select Courier Partner</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                    courierProvider === 'steadfast' 
                      ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-400' 
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/20'
                  }`}>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">SteadFast Courier</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">Automated API Booking</span>
                    </div>
                    <input 
                      type="radio" 
                      name="provider" 
                      value="steadfast"
                      checked={courierProvider === 'steadfast'}
                      onChange={() => setCourierProvider('steadfast')}
                      className="accent-indigo-600 cursor-pointer h-4 w-4"
                    />
                  </label>

                  <label className={`border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                    courierProvider === 'pathao' 
                      ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-400' 
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950/20'
                  }`}>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Pathao Courier</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">OAuth-secured Aladdin Booking</span>
                    </div>
                    <input 
                      type="radio" 
                      name="provider" 
                      value="pathao"
                      checked={courierProvider === 'pathao'}
                      onChange={() => setCourierProvider('pathao')}
                      className="accent-indigo-600 cursor-pointer h-4 w-4"
                    />
                  </label>
                </div>
              </div>

              {/* Recipient details */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1">
                  Recipient Information
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Customer Name</label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. Hridoy Hossain"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="tel"
                        required
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        onBlur={(e) => {
                          // Auto-normalize BD phone format on field blur
                          const normalized = normalizeBDPhone(e.target.value);
                          setRecipientPhone(normalized);
                        }}
                        placeholder="e.g. 01712345678 or +8801712345678"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Delivery Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <textarea
                      required
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="Enter complete shipping details (Street, District, Area)..."
                      rows={2}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">COD সংগ্রহ পরিমাণ (৳)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="number"
                        required
                        value={codAmount}
                        onChange={(e) => setCodAmount(Number(e.target.value))}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white font-bold"
                      />
                    </div>
                  </div>
                  
                  {/* Pathao: Store — API থেকে auto-fetch করা */}
                  {courierProvider === 'pathao' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Pathao Store</label>
                      {loadingStores ? (
                        <div className="py-2 px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                          Stores লোড হচ্ছে...
                        </div>
                      ) : pathaoStores.length > 0 ? (
                        <select
                          value={selectedStoreId}
                          onChange={(e) => setSelectedStoreId(Number(e.target.value))}
                          className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                        >
                          {pathaoStores.map((store) => (
                            <option key={store.store_id} value={store.store_id}>
                              {store.store_name} (ID: {store.store_id})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="py-2 px-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 shrink-0" />
                          Pathao credentials সেট করা নেই — Settings এ যান
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Parcel Weight (KG)</label>
                    <select
                      value={itemWeight}
                      onChange={(e) => setItemWeight(Number(e.target.value))}
                      className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value={0.5}>0.5 KG (Standard)</option>
                      <option value={1.0}>1.0 KG</option>
                      <option value={2.0}>2.0 KG</option>
                      <option value={3.0}>3.0 KG</option>
                      <option value={4.0}>4.0 KG</option>
                      <option value={5.0}>5.0 KG</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Parcel Quantity</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSendModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCourier}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {submittingCourier ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Booking on Courier...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Book on Courier
                    </>
                  )}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {isInvoiceModalOpen && (
        <InvoiceModal 
          isOpen={isInvoiceModalOpen} 
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setInvoiceOrder(null);
            setInvoiceOrders(null);
          }} 
          order={invoiceOrder} 
          orders={invoiceOrders}
          storeName={storeName} 
          storeEmail={storeEmail} 
        />
      )}

    </div>
  );
}
