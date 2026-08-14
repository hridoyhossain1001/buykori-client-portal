import React, { useState, useEffect } from 'react';
import { Package, RefreshCw, ShieldAlert, Truck } from 'lucide-react';
import { CourierBookingPayload, CourierOrder, CourierSettings, DeferredData, DeferredOrder, FulfillmentOrder, OrderIntakeHealth, StoreOrderLedgerItem } from '../types';
import { CourierLabelModal } from './CourierLabelModal';
import { InvoiceModal } from './InvoiceModal';
import { loadCourierOrders, loadPathaoStores, type PathaoStore } from '../services/courierApi';
import { FraudVerdictBadge, getFraudVerdictKey } from './FraudVerdictBadge';
import { usablePhone } from './orders/ordersUtils';
import { copyTextWithFeedback } from '../lib/clipboard';
import OrdersSummaryCards from './orders/OrdersSummaryCards';
import PendingOrdersPanel from './orders/PendingOrdersPanel';
import ShippedOrdersPanel from './orders/ShippedOrdersPanel';
import CourierBookingModal from './orders/CourierBookingModal';
import CancelCourierOrderModal from './orders/CancelCourierOrderModal';
import { fetchOrderIntakeHealth, fetchStoreOrderLedger } from '../services/operationsApi';

interface OrdersViewProps {
  deferredData: DeferredData;
  deferredLoadError?: string | null;
  fetchDeferred: () => Promise<void>;
  showToast: (msg: string, isErr?: boolean) => void;
  storeName?: string;
  storeEmail?: string;
}

export function OrdersView({
  deferredData,
  deferredLoadError,
  fetchDeferred,
  showToast,
  storeName,
  storeEmail,
}: OrdersViewProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'shipped'>('pending');
  const [capturedOrders, setCapturedOrders] = useState<StoreOrderLedgerItem[]>([]);
  const [intakeHealth, setIntakeHealth] = useState<OrderIntakeHealth | null>(null);
  const [intakeError, setIntakeError] = useState<string | null>(null);

  const [courierOrders, setCourierOrders] = useState<CourierOrder[]>([]);
  const [courierSettings, setCourierSettings] = useState<CourierSettings | null>(null);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [submittingCourier, setSubmittingCourier] = useState<boolean>(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null); // which order is being cancelled
  const [orderToCancel, setOrderToCancel] = useState<CourierOrder | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const toggleExpand = (id: string) => setExpandedOrderId(prev => prev === id ? null : id);
  const codVerificationOrders = deferredData?.operationsPendingList || deferredData?.pendingList || [];
  const copyPhone = async (phone: unknown) => {
    const value = usablePhone(phone);
    if (!value) return;
    await copyTextWithFeedback(value, showToast, {
      success: 'Phone number copied.',
      error: 'Could not copy phone number.',
    });
  };

  const fetchIntakeOverview = async () => {
    try {
      const [orders, health] = await Promise.all([fetchStoreOrderLedger(), fetchOrderIntakeHealth()]);
      setCapturedOrders(orders);
      setIntakeHealth(health);
      setIntakeError(null);
    } catch (error) {
      setIntakeError(error instanceof Error ? error.message : 'Order Intake status could not be loaded.');
    }
  };

  useEffect(() => {
    void fetchIntakeOverview();
  }, []);

  useEffect(() => {
    const handleSectionJump = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId: string; sectionId: string }>).detail;
      if (detail?.pageId !== 'orders') return;
      setActiveTab(detail.sectionId === 'orders-shipped' ? 'shipped' : 'pending');
      window.requestAnimationFrame(() => {
        document.getElementById(detail.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pendingSearch, setPendingSearch] = useState<string>('');
  const [pendingFraudFilter, setPendingFraudFilter] = useState<string>('all');
  const [pendingSort, setPendingSort] = useState<'oldest' | 'newest'>('newest');
  const [pendingPage, setPendingPage] = useState(1);
  const [selectedPendingOrderIds, setSelectedPendingOrderIds] = useState<string[]>([]);
  const [pendingOverviewOpen, setPendingOverviewOpen] = useState(false);

  useEffect(() => {
    if (!pendingOverviewOpen) return undefined;
    const timer = window.setTimeout(() => setPendingOverviewOpen(false), 5000);
    return () => window.clearTimeout(timer);
  }, [pendingOverviewOpen]);

  // Send to Courier Modal State
  const [isSendModalOpen, setIsSendModalOpen] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<FulfillmentOrder | null>(null);
  const [courierProvider, setCourierProvider] = useState<string>('steadfast');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');

  // Pathao Store and Package details states
  const [pathaoStores, setPathaoStores] = useState<PathaoStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | string | ''>('');
  const [pathaoCities, setPathaoCities] = useState<Array<{city_id: number, city_name: string}>>([]);
  const [pathaoZones, setPathaoZones] = useState<Array<{zone_id: number, zone_name: string}>>([]);
  const [pathaoAreas, setPathaoAreas] = useState<Array<{area_id: number, area_name: string}>>([]);
  const [selectedPathaoCity, setSelectedPathaoCity] = useState<number | ''>('');
  const [selectedPathaoZone, setSelectedPathaoZone] = useState<number | ''>('');
  const [selectedPathaoArea, setSelectedPathaoArea] = useState<number | ''>('');
  const [loadingPathaoLocations, setLoadingPathaoLocations] = useState<boolean>(false);
  const [redxDeliveryAreaId, setRedxDeliveryAreaId] = useState<string>('');
  const [redxDeliveryAreaName, setRedxDeliveryAreaName] = useState<string>('');
  const [redxPickupStoreId, setRedxPickupStoreId] = useState<string>('');
  const [redxAreas, setRedxAreas] = useState<Array<{id: number | string, name: string, post_code?: number}>>([]);
  const [redxAreaSearch, setRedxAreaSearch] = useState<string>('');
  const [loadingRedxAreas, setLoadingRedxAreas] = useState<boolean>(false);
  const [loadingStores, setLoadingStores] = useState<boolean>(false);
  const [itemWeight, setItemWeight] = useState<number>(0.5);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [codAmount, setCodAmount] = useState<number>(0);

  const openPendingCourierModal = (order: DeferredOrder) => {
    setSelectedOrder(order);
    setRecipientName(order.recipientName && order.recipientName !== '-' ? order.recipientName : '');
    setRecipientPhone(usablePhone(order.recipientPhone) || usablePhone(order.customer));
    setRecipientAddress(order.recipientAddress && order.recipientAddress !== '-' ? order.recipientAddress : '');
    setCodAmount(order.amount);
    setIsSendModalOpen(true);
  };

  // Selection state & functions for Shipped Courier Log
  const [selectedShippedOrderIds, setSelectedShippedOrderIds] = useState<number[]>([]);
  const [invoiceOrders, setInvoiceOrders] = useState<FulfillmentOrder[] | null>(null);

  // Clear selection on tab, search, or filter changes to avoid stale/hidden selections
  useEffect(() => {
    setSelectedShippedOrderIds([]);
  }, [activeTab, searchQuery, providerFilter, statusFilter]);

  useEffect(() => {
    setPendingPage(1);
    setSelectedPendingOrderIds([]);
  }, [pendingSearch, pendingFraudFilter, pendingSort]);

  const toggleSelectShippedOrder = (orderId: number) => {
    setSelectedShippedOrderIds(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  // Invoice Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState<boolean>(false);
  const [invoiceOrder, setInvoiceOrder] = useState<FulfillmentOrder | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState<boolean>(false);
  const [labelOrder, setLabelOrder] = useState<FulfillmentOrder | null>(null);
  const [labelOrders, setLabelOrders] = useState<FulfillmentOrder[] | null>(null);

  const openInvoice = (order: FulfillmentOrder) => {
    setInvoiceOrder(order);
    setInvoiceOrders(null);
    setIsInvoiceModalOpen(true);
  };

  const openBulkInvoices = (ordersList: FulfillmentOrder[]) => {
    setInvoiceOrders(ordersList);
    setInvoiceOrder(null);
    setIsInvoiceModalOpen(true);
  };

  const openLabel = (order: FulfillmentOrder) => {
    setLabelOrder(order);
    setLabelOrders(null);
    setIsLabelModalOpen(true);
  };

  const openBulkLabels = (ordersList: FulfillmentOrder[]) => {
    setLabelOrders(ordersList);
    setLabelOrder(null);
    setIsLabelModalOpen(true);
  };

  const fetchCourierOrders = async () => {
    setLoadingOrders(true);
    try {
      setCourierOrders(await loadCourierOrders());
    } catch (err) {
      console.error(err);
      showToast("Network error. Please try again.", true);
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
        setRedxDeliveryAreaId(data.redx_delivery_area_id || '');
        setRedxDeliveryAreaName(data.redx_delivery_area_name || '');
        setRedxPickupStoreId(data.redx_pickup_store_id || '');
      } else {
        showToast("Could not load courier settings. Booking options may be incomplete.", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Could not load courier settings. Check your connection and try again.", true);
    }
  };

  const fetchPathaoStores = async () => {
    setLoadingStores(true);
    try {
      const stores = await loadPathaoStores();
      {
        setPathaoStores(stores);
        if (stores.length > 0) {
          const defaultStore = stores.find(s => String(s.store_id) === String(courierSettings?.pathao_store_id));
          if (defaultStore) {
            setSelectedStoreId(defaultStore.store_id);
          } else {
            setSelectedStoreId(stores[0].store_id);
          }
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Error loading Pathao stores.", true);
    } finally {
      setLoadingStores(false);
    }
  };

  const fetchPathaoLocations = async (level: 'cities' | 'zones' | 'areas', parentId?: number) => {
    setLoadingPathaoLocations(true);
    try {
      const query = level === 'zones' ? `?city_id=${parentId}` : level === 'areas' ? `?zone_id=${parentId}` : '';
      const res = await fetch(`/api/courier/pathao/${level}${query}`);
      if (!res.ok) throw new Error(`Failed to fetch Pathao ${level}`);
      const data = await res.json();
      if (level === 'cities') setPathaoCities(data);
      if (level === 'zones') setPathaoZones(data);
      if (level === 'areas') setPathaoAreas(data);
    } catch (err) {
      console.error(err);
      showToast(`Failed to fetch Pathao ${level}.`, true);
    } finally {
      setLoadingPathaoLocations(false);
    }
  };

  const fetchRedxAreas = async () => {
    setLoadingRedxAreas(true);
    try {
      const res = await fetch('/api/courier/redx/areas');
      if (res.ok) setRedxAreas(await res.json());
      else showToast("Failed to fetch RedX delivery areas.", true);
    } catch (err) {
      console.error(err);
      showToast("Error loading RedX delivery areas.", true);
    } finally {
      setLoadingRedxAreas(false);
    }
  };

  useEffect(() => {
    fetchCourierSettings();
    fetchCourierOrders();
  }, []);

  useEffect(() => {
    if (isSendModalOpen && courierProvider === 'pathao') {
      fetchPathaoStores();
      fetchPathaoLocations('cities');
    }
    if (isSendModalOpen && courierProvider === 'redx') {
      fetchRedxAreas();
    }
  }, [isSendModalOpen, courierProvider, courierSettings]);

  useEffect(() => {
    setSelectedPathaoZone('');
    setSelectedPathaoArea('');
    setPathaoZones([]);
    setPathaoAreas([]);
    if (selectedPathaoCity !== '') fetchPathaoLocations('zones', Number(selectedPathaoCity));
  }, [selectedPathaoCity]);

  useEffect(() => {
    setSelectedPathaoArea('');
    setPathaoAreas([]);
    if (selectedPathaoZone !== '') fetchPathaoLocations('areas', Number(selectedPathaoZone));
  }, [selectedPathaoZone]);

  const handleSendToCourierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !recipientPhone.trim() || !recipientAddress.trim()) {
      showToast("Please enter recipient name, phone, and shipping address.", true);
      return;
    }

    setSubmittingCourier(true);
    try {
      // 'id' field is the DB primary key of the PendingEvent
      const dbId = selectedOrder?.id;
      if (!dbId) {
        showToast("Order details are missing. Please refresh the page and try again.", true);
        setSubmittingCourier(false);
        return;
      }

      const payload: CourierBookingPayload = {
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
        // Fallback to the saved Pathao store ID when the live store list is unavailable.
        payload.store_id = Number(courierSettings.pathao_store_id);
      }
      if (courierProvider === 'pathao' && selectedPathaoCity !== '' && selectedPathaoZone !== '' && selectedPathaoArea !== '') {
        payload.recipient_city = Number(selectedPathaoCity);
        payload.recipient_zone = Number(selectedPathaoZone);
        payload.recipient_area = Number(selectedPathaoArea);
      }
      if (courierProvider === 'redx') {
        payload.delivery_area_id = Number(redxDeliveryAreaId);
        payload.delivery_area_name = redxDeliveryAreaName;
        if (redxPickupStoreId) payload.pickup_store_id = Number(redxPickupStoreId);
      }

      const res = await fetch('/api/courier/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const booking = await res.json();
        const providerName = courierProvider === 'pathao' ? 'Pathao' : courierProvider === 'redx' ? 'RedX' : 'SteadFast';
        if (booking.queued || !booking.tracking_id) {
          showToast(`Order queued for ${providerName}. Tracking details will appear shortly.`, false);
          setIsSendModalOpen(false);
          fetchDeferred();
          fetchCourierOrders();
          return;
        }
        showToast(`Order sent to ${providerName} successfully!`, false);
        setIsSendModalOpen(false);
        openLabel({
          order_id: selectedOrder?.orderId || selectedOrder?.order_id,
          courier_provider: courierProvider,
          courier_order_id: booking.courier_order_id,
          courier_tracking_id: booking.tracking_id,
          recipient_name: recipientName,
          recipient_phone: recipientPhone,
          recipient_address: recipientAddress,
          cod_amount: Number(codAmount),
        });
        fetchDeferred();
        fetchCourierOrders();
      } else {
        const errData = await res.json();
        showToast(errData.detail || "Failed to send this order to the courier.", true);
      }
    } catch (err) {
      console.error(err);
      showToast("Network error. Please try again.", true);
    } finally {
      setSubmittingCourier(false);
    }
  };

  // Cancel Courier Order
  const handleCancelCourierOrder = async (order: CourierOrder) => {
    setOrderToCancel(order);
  };

  const confirmCancelCourierOrder = async () => {
    const order = orderToCancel;
    if (!order) return;
    setOrderToCancel(null);
    const providerName = order.courier_provider === 'pathao' ? 'Pathao' : order.courier_provider === 'redx' ? 'RedX' : 'SteadFast';

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
        if (data.needs_manual_cancel || data.state === 'cancel_failed_provider_active') {
          fetchCourierOrders();
          fetchDeferred();
        }
      }
    } catch (err) {
      console.error('Cancel error:', err);
      showToast('Network error while cancelling order.', true);
    } finally {
      setCancellingOrderId(null);
    }
  };

  const cancelProviderName = orderToCancel?.courier_provider === 'pathao'
    ? 'Pathao'
    : orderToCancel?.courier_provider === 'redx'
      ? 'RedX'
      : 'SteadFast';

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
  const shippedSummary = {
    total: courierOrders.length,
    pending: courierOrders.filter(order => ['pending', 'booking_queued', 'booking_processing'].includes((order.courier_status || '').toLowerCase())).length,
    failed: courierOrders.filter(order => (order.courier_status || '').toLowerCase() === 'booking_failed').length,
    inTransit: courierOrders.filter(order => ['in_transit', 'picked_up', 'shipped'].includes((order.courier_status || '').toLowerCase())).length,
    delivered: courierOrders.filter(order => ['delivered', 'completed'].includes((order.courier_status || '').toLowerCase())).length,
  };
  const shippedStatItems = [
    { label: 'Shipped', shortLabel: 'Ship', value: shippedSummary.total, tone: 'text-slate-900', dot: 'bg-slate-500' },
    { label: 'Pending', shortLabel: 'Pend', value: shippedSummary.pending, tone: 'text-amber-700', dot: 'bg-amber-500' },
    { label: 'Failed', shortLabel: 'Fail', value: shippedSummary.failed, tone: 'text-rose-700', dot: 'bg-rose-500' },
    { label: 'In transit', shortLabel: 'Transit', value: shippedSummary.inTransit, tone: 'text-indigo-700', dot: 'bg-indigo-500' },
    { label: 'Delivered', shortLabel: 'Done', value: shippedSummary.delivered, tone: 'text-emerald-700', dot: 'bg-emerald-500' },
  ];

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

  const filteredRedxAreas = redxAreas
    .filter(area => {
      const needle = redxAreaSearch.trim().toLowerCase();
      if (!needle) return true;
      return `${area.name} ${area.post_code || ''} ${area.id}`.toLowerCase().includes(needle);
    })
    .slice(0, 30);

  const renderCourierVerdict = (details?: DeferredOrder['fraudDetails'], scoreValue?: number, compact = false) => (
    <FraudVerdictBadge details={details} score={scoreValue} compact={compact} />
  );

  const pendingFilteredOrders = codVerificationOrders
    .filter((order) => {
      const query = pendingSearch.trim().toLowerCase();
      const matchesSearch = !query || [
        order.orderId,
        order.recipientName,
        order.recipientPhone,
        order.recipientAddress,
        order.products?.map((product) => product.name || product.content_name).join(' '),
      ].some((value) => String(value || '').toLowerCase().includes(query));
      const verdict = getFraudVerdictKey(order.fraudDetails, order.fraudScore);
      const matchesFraud = pendingFraudFilter === 'all' || verdict === pendingFraudFilter;
      return matchesSearch && matchesFraud;
    })
    .sort((a, b) => {
      const aTime = new Date(a.orderOccurredAt || a.timestamp || 0).getTime();
      const bTime = new Date(b.orderOccurredAt || b.timestamp || 0).getTime();
      if (aTime !== bTime) return pendingSort === 'oldest' ? aTime - bTime : bTime - aTime;
      return pendingSort === 'oldest'
        ? String(a.orderId).localeCompare(String(b.orderId), undefined, { numeric: true })
        : String(b.orderId).localeCompare(String(a.orderId), undefined, { numeric: true });
    });
  const pendingPageSize = 10;
  const pendingTotalPages = Math.max(1, Math.ceil(pendingFilteredOrders.length / pendingPageSize));
  const pendingPageSafe = Math.min(pendingPage, pendingTotalPages);
  const pendingPageOrders = pendingFilteredOrders.slice(
    (pendingPageSafe - 1) * pendingPageSize,
    pendingPageSafe * pendingPageSize,
  );
  const heldOverWeek = codVerificationOrders.filter((order) => (Number(order.ageHours) || 0) >= 168).length;
  const highRiskPending = codVerificationOrders.filter((order) => (
    getFraudVerdictKey(order.fraudDetails, order.fraudScore) === 'HIGH_RISK'
  )).length;
  const bookedThisMonth = courierOrders.filter((order) => {
    const createdAt = new Date(order.created_at);
    const today = new Date();
    return createdAt.getFullYear() === today.getFullYear() && createdAt.getMonth() === today.getMonth();
  }).length;
  const pendingValueTotal = codVerificationOrders.reduce((sum, order) => sum + (Number(order.amount) || 0), 0);

  const togglePendingOrder = (orderId: string, checked: boolean) => {
    setSelectedPendingOrderIds((current) => checked
      ? (current.includes(orderId) ? current : [...current, orderId])
      : current.filter((id) => id !== orderId));
  };

  const openFirstSelectedPendingOrder = () => {
    const order = codVerificationOrders.find((item) => selectedPendingOrderIds.includes(item.orderId));
    if (!order) return;
    if (selectedPendingOrderIds.length > 1) {
      showToast('Opening the first selected order. Complete each courier booking with its delivery details.');
    }
    openPendingCourierModal(order);
  };

  return (
    <div className="space-y-3 md:space-y-6">
      {deferredLoadError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">COD orders could not be loaded</p>
            <p className="mt-0.5 text-xs text-amber-700">{deferredLoadError} Courier settings and shipped orders are still available.</p>
          </div>
        </div>
      )}
      <header className="hidden md:block">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Orders & Shipping</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review pending orders, create invoices and book couriers — without leaving the page.
        </p>
      </header>

      <section className={`rounded-xl border px-4 py-3 ${intakeHealth?.status === 'warning' || intakeError ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-slate-900">Universal Order Intake</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {intakeError || (intakeHealth?.total
                ? `${intakeHealth.total} orders captured in 24h · ${intakeHealth.incomplete} need data review`
                : 'Waiting for the first order from the connected store.')}
            </p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[11px] font-black uppercase ${intakeHealth?.status === 'healthy' ? 'bg-emerald-600 text-white' : intakeHealth?.status === 'warning' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
            {intakeHealth?.status || (intakeError ? 'unavailable' : 'loading')}
          </span>
        </div>
        {capturedOrders.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {capturedOrders.slice(0, 4).map((order) => (
              <div key={order.id} className="rounded-lg border border-white/80 bg-white px-3 py-2 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-slate-800">#{order.orderId}</span>
                  <span className={`text-[10px] font-bold ${order.dataQuality === 'complete' ? 'text-emerald-700' : 'text-amber-700'}`}>{order.dataQuality.replaceAll('_', ' ')}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{order.status || 'unknown'} · {order.currency || ''} {order.total ?? '—'} · {order.itemCount} item(s)</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <OrdersSummaryCards
        pendingCount={codVerificationOrders.length}
        pendingValueTotal={pendingValueTotal}
        heldOverWeek={heldOverWeek}
        bookedThisMonth={bookedThisMonth}
        highRiskPending={highRiskPending}
        pendingOverviewOpen={pendingOverviewOpen}
        setPendingOverviewOpen={setPendingOverviewOpen}
      />

      {/* Tab bar header */}
      <div className="flex w-full max-w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm md:w-fit">
        <button
          onClick={() => setActiveTab('pending')}
          data-guide="orders-pending-tab"
          className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer sm:flex-none sm:justify-start sm:gap-2 sm:px-4 ${
            activeTab === 'pending'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="sm:hidden">Pending</span>
          <span className="hidden sm:inline">Pending Orders</span>
          <span className={`rounded-full px-1.5 py-0.5 text-xs font-black ${activeTab === 'pending' ? 'bg-white text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{deferredData?.operationsPendingCount ?? deferredData?.pendingCount ?? codVerificationOrders.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('shipped')}
          data-guide="orders-shipped-tab"
          className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all cursor-pointer sm:flex-none sm:justify-start sm:gap-2 sm:px-4 ${
            activeTab === 'shipped'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span className="sm:hidden">Shipped</span>
          <span className="hidden sm:inline">Shipped Courier Log</span>
          <span className={`rounded-full px-1.5 py-0.5 text-xs font-black ${activeTab === 'shipped' ? 'bg-white text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>{courierOrders.length}</span>
        </button>

        <button
          onClick={() => {
            fetchDeferred();
            fetchCourierOrders();
            void fetchIntakeOverview();
            showToast("Syncing data feeds...", false);
          }}
          className="inline-flex h-10 w-10 self-center items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 cursor-pointer"
          aria-label="Reload lists"
          title="Reload lists"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {activeTab === 'pending' && (
        <PendingOrdersPanel
          pendingSearch={pendingSearch}
          setPendingSearch={setPendingSearch}
          pendingFraudFilter={pendingFraudFilter}
          setPendingFraudFilter={setPendingFraudFilter}
          pendingSort={pendingSort}
          setPendingSort={setPendingSort}
          selectedPendingOrderIds={selectedPendingOrderIds}
          setSelectedPendingOrderIds={setSelectedPendingOrderIds}
          togglePendingOrder={togglePendingOrder}
          openFirstSelectedPendingOrder={openFirstSelectedPendingOrder}
          pendingPageOrders={pendingPageOrders}
          pendingFilteredCount={pendingFilteredOrders.length}
          pendingPageSize={pendingPageSize}
          pendingPageSafe={pendingPageSafe}
          pendingTotalPages={pendingTotalPages}
          setPendingPage={setPendingPage}
          goToPendingPage={(page) => setPendingPage(page)}
          expandedOrderId={expandedOrderId}
          toggleExpand={toggleExpand}
          openInvoice={openInvoice}
          openPendingCourierModal={openPendingCourierModal}
          renderCourierVerdict={renderCourierVerdict}
          copyPhone={copyPhone}
        />
      )}

      {activeTab === 'pending' && heldOverWeek > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>{heldOverWeek} order{heldOverWeek === 1 ? '' : 's'} have been waiting over a week.</strong> Long-held COD orders cancel more often — book them now or move them out of the queue.</p>
        </div>
      )}

      {activeTab === 'shipped' && (
        <ShippedOrdersPanel
          courierOrders={courierOrders}
          filteredCourierOrders={filteredCourierOrders}
          loadingOrders={loadingOrders}
          shippedStatItems={shippedStatItems}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          providerFilter={providerFilter}
          setProviderFilter={setProviderFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          selectedShippedOrderIds={selectedShippedOrderIds}
          setSelectedShippedOrderIds={setSelectedShippedOrderIds}
          toggleSelectShippedOrder={toggleSelectShippedOrder}
          areAllFilteredSelected={areAllFilteredSelected}
          toggleSelectAllFilteredShipped={toggleSelectAllFilteredShipped}
          cancellingOrderId={cancellingOrderId}
          handleCancelCourierOrder={handleCancelCourierOrder}
          openInvoice={openInvoice}
          openLabel={openLabel}
          openBulkInvoices={openBulkInvoices}
          openBulkLabels={openBulkLabels}
        />
      )}

      {/* Book to Courier Form Modal */}
      {isSendModalOpen && selectedOrder && (
        <CourierBookingModal
          selectedOrder={selectedOrder}
          onClose={() => setIsSendModalOpen(false)}
          onSubmit={handleSendToCourierSubmit}
          submittingCourier={submittingCourier}
          courierProvider={courierProvider}
          setCourierProvider={setCourierProvider}
          recipientName={recipientName}
          setRecipientName={setRecipientName}
          recipientPhone={recipientPhone}
          setRecipientPhone={setRecipientPhone}
          recipientAddress={recipientAddress}
          setRecipientAddress={setRecipientAddress}
          codAmount={codAmount}
          setCodAmount={setCodAmount}
          itemWeight={itemWeight}
          setItemWeight={setItemWeight}
          itemQuantity={itemQuantity}
          setItemQuantity={setItemQuantity}
          loadingStores={loadingStores}
          pathaoStores={pathaoStores}
          selectedStoreId={selectedStoreId}
          setSelectedStoreId={setSelectedStoreId}
          loadingPathaoLocations={loadingPathaoLocations}
          pathaoCities={pathaoCities}
          pathaoZones={pathaoZones}
          pathaoAreas={pathaoAreas}
          selectedPathaoCity={selectedPathaoCity}
          setSelectedPathaoCity={setSelectedPathaoCity}
          selectedPathaoZone={selectedPathaoZone}
          setSelectedPathaoZone={setSelectedPathaoZone}
          selectedPathaoArea={selectedPathaoArea}
          setSelectedPathaoArea={setSelectedPathaoArea}
          loadingRedxAreas={loadingRedxAreas}
          redxAreas={redxAreas}
          filteredRedxAreas={filteredRedxAreas}
          redxAreaSearch={redxAreaSearch}
          setRedxAreaSearch={setRedxAreaSearch}
          redxDeliveryAreaId={redxDeliveryAreaId}
          setRedxDeliveryAreaId={setRedxDeliveryAreaId}
          redxDeliveryAreaName={redxDeliveryAreaName}
          setRedxDeliveryAreaName={setRedxDeliveryAreaName}
          redxPickupStoreId={redxPickupStoreId}
          setRedxPickupStoreId={setRedxPickupStoreId}
        />
      )}

      {orderToCancel && (
        <CancelCourierOrderModal
          orderToCancel={orderToCancel}
          cancelProviderName={cancelProviderName}
          onKeep={() => setOrderToCancel(null)}
          onConfirm={confirmCancelCourierOrder}
        />
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

      {isLabelModalOpen && (
        <CourierLabelModal
          isOpen={isLabelModalOpen}
          onClose={() => {
            setIsLabelModalOpen(false);
            setLabelOrder(null);
            setLabelOrders(null);
          }}
          order={labelOrder}
          orders={labelOrders}
          storeName={storeName}
        />
      )}

    </div>
  );
}
