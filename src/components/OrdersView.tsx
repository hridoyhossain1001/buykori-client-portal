import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import { CourierBookingPayload, CourierOrder, CourierSettings, DeferredData, DeferredOrder, FulfillmentOrder, OrderWorkflowStatus, StoreOrderLedgerItem } from '../types';
import { CourierLabelModal } from './CourierLabelModal';
import { InvoiceModal } from './InvoiceModal';
import { loadCourierOrders, loadPathaoStores, type PathaoStore } from '../services/courierApi';
import { CourierDetailPanel, FraudRiskCell } from './CourierFraudDetail';
import { usablePhone } from './orders/ordersUtils';
import { copyTextWithFeedback } from '../lib/clipboard';
/**
 * The workspace and the drawer replace the old two-panel layout
 * (OrdersSummaryCards + PendingOrdersPanel + ShippedOrdersPanel). Those three
 * files stay on disk untouched: nothing else imports them, and keeping them
 * makes reverting this page a matter of restoring one file.
 */
import OrdersWorkspace from './orders/OrdersWorkspace';
import OrderDetailDrawer from './orders/OrderDetailDrawer';
import {
  buildUnifiedOrders,
  filterOrders,
  matchesView,
  paginateOrders,
  type OrderFilters,
  type OrderViewKey,
  type UnifiedOrder,
} from './orders/unifiedOrders';
import CourierBookingModal from './orders/CourierBookingModal';
import OrderEditModal from './orders/OrderEditModal';
import CancelCourierOrderModal from './orders/CancelCourierOrderModal';
import CancelPendingOrderModal from './orders/CancelPendingOrderModal';
import { cancelPendingOrder, fetchStoreOrderLedger, fetchStoreOrderWatermark, updateOrderWorkflowStatus } from '../services/operationsApi';
import WhatsAppConfirmCell from './orders/WhatsAppConfirmCell';
import {
  fetchWhatsAppConfirmations,
  fetchWhatsAppStatus,
  sendWhatsAppConfirmation,
  type WhatsAppConfirmation,
} from '../services/whatsappApi';

/**
 * The workspace probes a one-row watermark on this cadence and only refetches
 * the 100-order ledger when the watermark moves, so a faster tick costs almost
 * nothing. See fetchStoreOrderWatermark.
 */
const ORDER_INTAKE_PROBE_MS = 2500;
/**
 * Fallback full refresh, for changes the watermark cannot see: a row edited in
 * place without moving the count, or a backend too old to serve the probe at all.
 */
const ORDER_INTAKE_FULL_REFRESH_MS = 60000;
/**
 * How often the WhatsApp confirmation badges refresh while at least one customer
 * still has an open "reply 1 to confirm" request. The reply arrives on the
 * gateway webhook, so the portal only has to notice it, not wait for it.
 */
const WHATSAPP_CONFIRMATION_POLL_MS = 15000;

interface OrdersViewProps {
  deferredData: DeferredData;
  deferredLoadError?: string | null;
  fetchDeferred: () => Promise<void>;
  /** Runs the on-demand RedX/Pathao lookup for one order. */
  handleCourierCheck: (order: DeferredOrder) => Promise<void>;
  /** Pending-event IDs with a courier lookup currently in flight. */
  courierCheckBusyIds: number[];
  showToast: (msg: string, isErr?: boolean) => void;
  storeName?: string;
  storeEmail?: string;
}

export function OrdersView({
  deferredData,
  deferredLoadError,
  fetchDeferred,
  handleCourierCheck,
  courierCheckBusyIds,
  showToast,
  storeName,
  storeEmail,
}: OrdersViewProps) {
  /**
   * Which of the eight order views the table is showing. Replaces the old
   * pending/shipped pair: both feeds are now in one table, and the tab only
   * decides which rows pass matchesView().
   */
  const [activeView, setActiveView] = useState<OrderViewKey>('all');
  const [capturedOrders, setCapturedOrders] = useState<StoreOrderLedgerItem[]>([]);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [courierOrders, setCourierOrders] = useState<CourierOrder[]>([]);
  const [courierSettings, setCourierSettings] = useState<CourierSettings | null>(null);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [submittingCourier, setSubmittingCourier] = useState<boolean>(false);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null); // which order is being cancelled
  const [orderToCancel, setOrderToCancel] = useState<CourierOrder | null>(null);
  const [pendingOrderToCancel, setPendingOrderToCancel] = useState<DeferredOrder | null>(null);
  const [cancellingPendingOrderId, setCancellingPendingOrderId] = useState<string | null>(null);
  const [updatingStatusOrderId, setUpdatingStatusOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [whatsappAvailable, setWhatsappAvailable] = useState<boolean>(false);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean>(false);
  const [whatsappConfirmations, setWhatsappConfirmations] = useState<Record<string, WhatsAppConfirmation>>({});
  const [whatsappBusyOrderIds, setWhatsappBusyOrderIds] = useState<string[]>([]);
  const toggleExpand = (id: string) => setExpandedOrderId(prev => prev === id ? null : id);
  /**
   * Memoised because buildUnifiedOrders() below is memoised on it. `||` hands
   * back a fresh array identity on every render when the first operand is
   * undefined, which would rebuild every row on every keystroke.
   */
  const codVerificationOrders = useMemo<DeferredOrder[]>(
    () => deferredData?.operationsPendingList || deferredData?.pendingList || [],
    [deferredData],
  );
  const activeVerificationOrders = useMemo(
    () => codVerificationOrders.filter((order) => (
      (order.workflowStatus || order.status) !== 'cancelled'
    )),
    [codVerificationOrders],
  );
  const copyPhone = async (phone: unknown) => {
    const value = usablePhone(phone);
    if (!value) return;
    await copyTextWithFeedback(value, showToast, {
      success: 'Phone number copied.',
      error: 'Could not copy phone number.',
    });
  };

  useEffect(() => {
    const handleSectionJump = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId: string; sectionId: string }>).detail;
      if (detail?.pageId !== 'orders') return;
      // The tour still asks for the two old sections by name. They are now views
      // in one table: the shipped log is 'courier', the pending queue is 'ready'.
      setActiveView(detail.sectionId === 'orders-shipped' ? 'courier' : 'ready');
      window.requestAnimationFrame(() => {
        document.getElementById(detail.sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  /**
   * Search, provider, risk and sort for the one table. The old page carried two
   * independent sets — one per panel — plus a third unused pair; a single table
   * needs one.
   */
  const [orderFilters, setOrderFilters] = useState<OrderFilters>({
    search: '',
    provider: 'all',
    risk: 'all',
    sort: 'newest',
  });
  const [ordersPage, setOrdersPage] = useState(1);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  /** The order whose detail drawer is open, by orderId. */
  const [drawerOrderId, setDrawerOrderId] = useState<string | null>(null);

  // Send to Courier Modal State
  const [isSendModalOpen, setIsSendModalOpen] = useState<boolean>(false);
  const [selectedOrder, setSelectedOrder] = useState<FulfillmentOrder | null>(null);
  const [orderBeingEdited, setOrderBeingEdited] = useState<DeferredOrder | null>(null);
  const [resumeBookingAfterEdit, setResumeBookingAfterEdit] = useState(false);
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

  const openPendingCourierModal = (order: DeferredOrder, options?: { preserveBookingContext?: boolean }) => {
    const preserveBookingContext = options?.preserveBookingContext === true;
    setSelectedOrder(order);
    setRecipientName(order.recipientName && order.recipientName !== '-' ? order.recipientName : '');
    setRecipientPhone(usablePhone(order.recipientPhone) || usablePhone(order.customer));
    setRecipientAddress(order.recipientAddress && order.recipientAddress !== '-' ? order.recipientAddress : '');
    setCodAmount(order.amount);
    setItemQuantity(Math.max(1, (order.products || []).reduce((total, product) => total + (Number(product.quantity) || 1), 0)));
    if (!preserveBookingContext) {
      setCourierProvider(courierSettings?.default_courier || 'steadfast');
      setItemWeight(0.5);
      setSelectedStoreId(courierSettings?.pathao_store_id || '');
      setSelectedPathaoCity('');
      setSelectedPathaoZone('');
      setSelectedPathaoArea('');
      setPathaoStores([]);
      setRedxDeliveryAreaId(courierSettings?.redx_delivery_area_id || '');
      setRedxDeliveryAreaName(courierSettings?.redx_delivery_area_name || '');
      setRedxPickupStoreId(courierSettings?.redx_pickup_store_id || '');
      setRedxAreaSearch(courierSettings?.redx_delivery_area_name || '');
      setRedxAreas([]);
    }
    setIsSendModalOpen(true);
  };

  /**
   * Loads the merchant's order rows. Deliberately one call: the ledger.
   *
   * This used to be Promise.all([store-ledger, intake-health]). intake-health is
   * an internal ingestion metric the portal is not allowed to render (CLAUDE.md →
   * "Never show order-intake diagnostics"), so its result was fetched, stored and
   * never read — and because Promise.all rejects if *either* side fails, a bad
   * answer from that unused endpoint blanked the whole order table and told the
   * merchant their store could not be reached. The order list must not depend on
   * a number it is forbidden to show.
   */
  const fetchIntakeOverview = async () => {
    try {
      const orders = await fetchStoreOrderLedger();
      setCapturedOrders(orders.items);
      setIntakeError(null);
    } catch (error) {
      setIntakeError(error instanceof Error ? error.message : 'Orders could not be loaded.');
    }
  };

  // Keep the interval calling the newest closure without resubscribing.
  const intakeRefreshRef = useRef(fetchIntakeOverview);
  intakeRefreshRef.current = fetchIntakeOverview;

  // The Order Intake table used to load once on mount and never again, so a
  // newly captured order only appeared after a manual reload. It now probes a
  // one-row watermark every couple of seconds and refetches the full ledger
  // only when that watermark moves — quicker than a fixed poll and cheaper,
  // because an idle store no longer pulls 100 orders every tick. Paused while
  // the tab is hidden, with one probe on return.
  useEffect(() => {
    let cancelled = false;
    let lastWatermark = '';
    let lastFullRefreshAt = 0;
    // The probe is an optimisation on top of the full refresh, and a backend
    // that predates the route answers 404. One 404 is harmless; one every
    // 2.5s for as long as the screen is open is not, and it would bury real
    // errors in the network log. So the first 404 retires the fast path for
    // this mount and the workspace keeps running on the 60s refresh. Nothing
    // has to be re-enabled by hand: the next mount probes again and lights the
    // fast path the moment the route exists.
    let probeSupported = true;

    const fullRefresh = async (watermark: string) => {
      lastWatermark = watermark;
      lastFullRefreshAt = Date.now();
      await intakeRefreshRef.current();
    };

    const probe = async () => {
      if (cancelled || document.hidden) return;
      const overdueNow = () => Date.now() - lastFullRefreshAt >= ORDER_INTAKE_FULL_REFRESH_MS;
      if (!probeSupported) {
        if (overdueNow()) await fullRefresh(lastWatermark);
        return;
      }
      try {
        const probed = await fetchStoreOrderWatermark();
        if (cancelled) return;
        if (probed === null) {
          probeSupported = false;
          if (overdueNow()) await fullRefresh(lastWatermark);
          return;
        }
        const watermark = `${probed.count}:${probed.lastChangedAt ?? ''}`;
        // A row can be edited in place without moving the count or the
        // timestamp, so refresh periodically even when the watermark is still.
        const overdue = overdueNow();
        if (watermark !== lastWatermark || overdue) {
          await fullRefresh(watermark);
        }
      } catch {
        // Probe failed (offline, 5xx). Don't hammer the heavy endpoint every
        // tick; let the periodic full refresh surface the error instead.
        if (!cancelled && overdueNow()) {
          await fullRefresh(lastWatermark);
        }
      }
    };

    const runProbe = () => { void probe(); };
    runProbe();
    const intervalId = window.setInterval(runProbe, ORDER_INTAKE_PROBE_MS);
    document.addEventListener('visibilitychange', runProbe);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', runProbe);
    };
  }, []);

  const openOrderEditModal = (order: DeferredOrder) => {
    setResumeBookingAfterEdit(false);
    setOrderBeingEdited(order);
  };

  const handleOrderSaved = async (updatedOrder: DeferredOrder, continueToCourier: boolean) => {
    const shouldResumeBooking = resumeBookingAfterEdit;
    setResumeBookingAfterEdit(false);
    setOrderBeingEdited(null);
    await Promise.allSettled([fetchDeferred()]);
    if (continueToCourier) openPendingCourierModal(updatedOrder, { preserveBookingContext: shouldResumeBooking });
  };

  const openPendingOrderCancelModal = (order: DeferredOrder) => {
    setPendingOrderToCancel(order);
  };

  const handlePendingStatusChange = async (order: DeferredOrder, status: OrderWorkflowStatus) => {
    if (status === (order.workflowStatus || order.status || 'pending')) return;
    if (status === 'cancelled') {
      openPendingOrderCancelModal(order);
      return;
    }
    setUpdatingStatusOrderId(order.orderId);
    try {
      const data = await updateOrderWorkflowStatus(order.orderId, status);
      showToast(`Order #${order.orderId} changed to ${data.status}. ${data.wooSync?.message || ''}`.trim());
      await fetchDeferred();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update this order status.', true);
    } finally {
      setUpdatingStatusOrderId(null);
    }
  };

  const confirmCancelPendingOrder = async () => {
    const order = pendingOrderToCancel;
    if (!order?.orderId || cancellingPendingOrderId) return;
    setCancellingPendingOrderId(order.orderId);
    try {
      const data = await cancelPendingOrder(order.orderId);
      setPendingOrderToCancel(null);
      showToast(`${data.message || `Order #${order.orderId} cancelled.`} ${data.wooSync?.message || ''}`.trim(), false);
      await Promise.allSettled([fetchDeferred()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not cancel this order.', true);
    } finally {
      setCancellingPendingOrderId(null);
    }
  };

  const [invoiceOrders, setInvoiceOrders] = useState<FulfillmentOrder[] | null>(null);

  /**
   * A hidden row must never stay selected: the bulk bar would print or book an
   * order the merchant can no longer see. One table means one effect, where the
   * old page had two.
   */
  useEffect(() => {
    setOrdersPage(1);
    setSelectedOrderIds([]);
  }, [activeView, orderFilters]);

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
      setCourierOrders((await loadCourierOrders()).items);
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

  const handleShippedStatusChange = async (order: CourierOrder, status: OrderWorkflowStatus) => {
    if (status === (order.workflowStatus || 'processing')) return;
    if (status === 'cancelled') {
      handleCancelCourierOrder(order);
      return;
    }
    setUpdatingStatusOrderId(order.order_id);
    try {
      const data = await updateOrderWorkflowStatus(order.order_id, status);
      showToast(`Order #${order.order_id} changed to ${data.status}. ${data.wooSync?.message || ''}`.trim());
      await Promise.allSettled([fetchCourierOrders(), fetchDeferred()]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update this order status.', true);
    } finally {
      setUpdatingStatusOrderId(null);
    }
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
        try {
          const syncResult = await updateOrderWorkflowStatus(order.order_id, 'cancelled');
          showToast(`${toastMsg} ${syncResult.wooSync?.message || ''}`.trim(), data.local_only);
        } catch (syncError) {
          const syncMessage = syncError instanceof Error ? syncError.message : 'Order status sync could not be queued.';
          showToast(`${toastMsg} Buykori/WooCommerce status needs attention: ${syncMessage}`, true);
        }
        await Promise.allSettled([fetchCourierOrders(), fetchDeferred()]);
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

  const filteredRedxAreas = redxAreas
    .filter(area => {
      const needle = redxAreaSearch.trim().toLowerCase();
      if (!needle) return true;
      return `${area.name} ${area.post_code || ''} ${area.id}`.toLowerCase().includes(needle);
    })
    .slice(0, 30);

  /**
   * The "Fraud risk" cell. Shows the verdict badge once a courier lookup has run,
   * otherwise a "Fraud check" button — courier history is only fetched on request.
   * Clicking the badge reuses the row's existing expand/collapse state.
   */
  const renderCourierVerdict = (order: DeferredOrder, compact = false) => (
    <FraudRiskCell
      order={order}
      expanded={expandedOrderId === order.orderId}
      onToggle={() => toggleExpand(order.orderId)}
      onCheck={() => { void handleCourierCheck(order); }}
      busy={courierCheckBusyIds.includes(Number(order.id))}
      compact={compact}
    />
  );

  /** Per-courier breakdown, rendered inside the row's expanded area. */
  const renderCourierDetail = (order: DeferredOrder, className = '') => {
    const summary = order.fraudDetails?.courier_summary;
    if (!summary) return null;
    return (
      <div className={className}>
        <CourierDetailPanel
          summary={summary}
          onRecheck={() => { void handleCourierCheck(order); }}
          busy={courierCheckBusyIds.includes(Number(order.id))}
        />
      </div>
    );
  };

  /**
   * The one row list behind all eight views. buildUnifiedOrders is pure: it
   * merges the three feeds this page already fetches — the deferred COD queue,
   * the courier consignments and the 100-order store ledger — and issues no
   * request of its own, so the table costs no extra API call.
   */
  const unifiedOrders = useMemo(
    () => buildUnifiedOrders({
      deferredOrders: codVerificationOrders,
      courierOrders,
      ledger: capturedOrders,
    }),
    [codVerificationOrders, courierOrders, capturedOrders],
  );

  const rowsInView = useMemo(
    () => filterOrders(
      unifiedOrders.filter((order) => matchesView(order, activeView)),
      orderFilters,
    ),
    [unifiedOrders, activeView, orderFilters],
  );

  /**
   * The rows actually on screen. OrdersWorkspace slices the same list with the
   * same helper, so the WhatsApp poll below can never watch a different page than
   * the merchant is looking at.
   */
  const visibleOrders = paginateOrders(rowsInView, ordersPage).rows;

  /** Only the COD queue has confirmations; a booked row has no send button. */
  const visibleWhatsAppOrderIds = visibleOrders
    .filter((order) => order.deferred)
    .map((order) => order.orderId)
    .filter(Boolean);
  /** Stable key so the effect below refetches only when the visible page changes. */
  const visibleWhatsAppOrderKey = visibleWhatsAppOrderIds.join(',');
  const hasOpenWhatsAppRequest = visibleWhatsAppOrderIds.some(
    (orderId) => whatsappConfirmations[orderId]?.status === 'sent',
  );

  // One cheap read that tells the cells whether to render at all. The feature is
  // off on most servers, so this must fail silently.
  useEffect(() => {
    let cancelled = false;
    fetchWhatsAppStatus()
      .then((status) => {
        if (cancelled) return;
        setWhatsappAvailable(status.available);
        setWhatsappConnected(status.connected);
      })
      .catch(() => { /* feature unavailable: cells stay hidden */ });
    return () => { cancelled = true; };
  }, []);

  const loadWhatsAppConfirmations = async (orderIds: string[], signal?: AbortSignal) => {
    if (orderIds.length === 0) return;
    try {
      const result = await fetchWhatsAppConfirmations(orderIds, signal);
      // Merge, never replace: a merchant paging back and forth should not lose
      // the badges for orders that are momentarily off-screen.
      setWhatsappConfirmations((current) => ({ ...current, ...result.confirmations }));
    } catch {
      /* badges are optional context, never an error the merchant must handle */
    }
  };

  useEffect(() => {
    if (!whatsappAvailable || !visibleWhatsAppOrderKey) return undefined;
    const controller = new AbortController();
    void loadWhatsAppConfirmations(visibleWhatsAppOrderKey.split(','), controller.signal);
    return () => controller.abort();
  }, [whatsappAvailable, visibleWhatsAppOrderKey]);

  useEffect(() => {
    if (!whatsappAvailable || !hasOpenWhatsAppRequest || !visibleWhatsAppOrderKey) return undefined;
    const timer = window.setInterval(() => {
      void loadWhatsAppConfirmations(visibleWhatsAppOrderKey.split(','));
    }, WHATSAPP_CONFIRMATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [whatsappAvailable, hasOpenWhatsAppRequest, visibleWhatsAppOrderKey]);

  const handleWhatsAppSend = async (order: DeferredOrder) => {
    const orderId = order.orderId;
    if (!orderId || whatsappBusyOrderIds.includes(orderId)) return;
    setWhatsappBusyOrderIds((current) => [...current, orderId]);
    try {
      const confirmation = await sendWhatsAppConfirmation(orderId);
      setWhatsappConfirmations((current) => ({ ...current, [orderId]: confirmation }));
      showToast(`WhatsApp confirmation sent for #${orderId}. The order moves on its own when the customer replies.`, false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not send the WhatsApp confirmation.', true);
      // A refused send may still have written a row (failed / no_whatsapp), so
      // pull the real state rather than guessing.
      void loadWhatsAppConfirmations([orderId]);
    } finally {
      setWhatsappBusyOrderIds((current) => current.filter((id) => id !== orderId));
    }
  };

  /** The "WhatsApp" cell: send button, or the badge for the latest request. */
  const renderWhatsAppCell = (order: DeferredOrder, compact = false) => (
    <WhatsAppConfirmCell
      confirmation={whatsappConfirmations[order.orderId] || null}
      available={whatsappAvailable}
      connected={whatsappConnected}
      busy={whatsappBusyOrderIds.includes(order.orderId)}
      compact={compact}
      onSend={() => { void handleWhatsAppSend(order); }}
    />
  );
  const heldOverWeek = activeVerificationOrders.filter((order) => (Number(order.ageHours) || 0) >= 168).length;

  /**
   * Opens the detail drawer, and expands the row's fraud detail at the same time
   * so a breakdown that has already been fetched is visible without a second
   * click. The drawer has the width for it; the 94px table column does not.
   */
  const openOrderDrawer = (row: UnifiedOrder) => {
    setDrawerOrderId(row.orderId);
    setExpandedOrderId(row.orderId);
  };

  /** Re-read from the live list, so the drawer follows every refetch. */
  const drawerOrder = drawerOrderId
    ? unifiedOrders.find((order) => order.orderId === drawerOrderId) || null
    : null;

  /**
   * The record the invoice and label printers want. Both take FulfillmentOrder — a
   * permissive superset that DeferredOrder and CourierOrder each satisfy — so this
   * only has to pick the right one: the consignment when the order is booked (it
   * carries the tracking id and the courier's own delivery charge), otherwise the
   * held record. A cancelled-after-booking row holds both, and a consignment can
   * arrive without line items, so the merged products are spread back in when the
   * chosen record has none.
   */
  const fulfillmentOf = (row: UnifiedOrder): FulfillmentOrder => {
    const base = (row.courier || row.deferred) as FulfillmentOrder;
    if (!base) return { orderId: row.orderId, products: row.products } as FulfillmentOrder;
    if (base.products && base.products.length > 0) return base;
    return { ...base, products: row.products };
  };

  /**
   * The table's "Risk" cell. A courier-only row carries no fraud fields at all —
   * /courier/orders never returns them — so there is nothing to show once an order
   * has left the held queue. The old Shipped log had no risk column either.
   */
  const renderRowRisk = (row: UnifiedOrder) => {
    const deferred = row.deferred;
    if (!deferred) {
      return (
        <span
          className="text-[10px] font-semibold text-[var(--bk-console-text-muted)]"
          title="Courier history is checked before booking, so a booked order keeps no verdict here."
        >
          —
        </span>
      );
    }
    return (
      <FraudRiskCell
        order={deferred}
        // The row opens the drawer rather than expanding in place: the
        // per-courier breakdown needs more width than this column has.
        expanded={false}
        onToggle={() => openOrderDrawer(row)}
        onCheck={() => { void handleCourierCheck(deferred); }}
        busy={courierCheckBusyIds.includes(Number(deferred.id))}
        compact
      />
    );
  };

  /** The table's WhatsApp cell. Only the held queue can send one. */
  const renderRowWhatsApp = (row: UnifiedOrder) => (
    row.deferred ? renderWhatsAppCell(row.deferred, true) : null
  );

  /**
   * Book courier from the bulk bar. POST /courier/send takes exactly one
   * pending_event_id, so there is no bulk booking to offer: the workspace hands
   * over the first bookable selection and this says so out loud.
   */
  const handleWorkspaceBookCourier = (row: UnifiedOrder) => {
    if (!row.deferred) {
      showToast('This order is already booked with a courier.', true);
      return;
    }
    if (selectedOrderIds.length > 1) {
      showToast('Opening the first selected order. Complete each courier booking with its delivery details.');
    }
    openPendingCourierModal(row.deferred);
  };

  /** Status change routed to whichever feed owns the order. */
  const handleRowStatusChange = (row: UnifiedOrder, status: OrderWorkflowStatus) => {
    if (row.courier) {
      void handleShippedStatusChange(row.courier, status);
      return;
    }
    if (row.deferred) {
      void handlePendingStatusChange(row.deferred, status);
    }
  };

  const refreshAllFeeds = () => {
    fetchDeferred();
    fetchCourierOrders();
    void fetchIntakeOverview();
    showToast('Syncing order feeds…', false);
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
      {/*
        One workspace replaces the old page: a header, the four metrics, the eight
        views and one table. The page header and the refresh control live inside
        it, which is why the standalone <header>, the Universal Order Intake panel
        and the two-button tab strip are gone from here. Every callback below is a
        handler this file already owned — the table adds no fetch of its own.
      */}
      <OrdersWorkspace
        orders={unifiedOrders}
        loading={loadingOrders}
        view={activeView}
        onViewChange={setActiveView}
        filters={orderFilters}
        onFiltersChange={setOrderFilters}
        page={ordersPage}
        onPageChange={setOrdersPage}
        selectedIds={selectedOrderIds}
        onSelectionChange={setSelectedOrderIds}
        intakeError={intakeError}
        onRefresh={refreshAllFeeds}
        onOpenOrder={openOrderDrawer}
        onBookCourier={handleWorkspaceBookCourier}
        onPrintInvoices={(rows) => openBulkInvoices(rows.map(fulfillmentOf))}
        onPrintLabels={(rows) => openBulkLabels(rows.map(fulfillmentOf))}
        onStatusChange={handleRowStatusChange}
        statusBusyOrderId={updatingStatusOrderId || cancellingPendingOrderId}
        renderRisk={renderRowRisk}
        renderWhatsApp={renderRowWhatsApp}
        whatsappAvailable={whatsappAvailable}
        showToast={showToast}
      />

      {activeView === 'all' && heldOverWeek > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>{heldOverWeek} order{heldOverWeek === 1 ? '' : 's'} have been waiting over a week.</strong> Long-held COD orders cancel more often — book them now or move them out of the queue.</p>
        </div>
      )}

      {drawerOrder && (
        /* risk / whatsApp are deliberately not `compact`. That flag shrinks both
           cells to 9px type and a ~18px pill so they fit a dense table row. The
           drawer is a full-width panel on a phone and — since the mobile order
           card carries no controls — the only place either action can be reached
           there, so it renders them at full size. */
        <OrderDetailDrawer
          order={drawerOrder}
          onClose={() => setDrawerOrderId(null)}
          onBookCourier={(row) => { if (row.deferred) openPendingCourierModal(row.deferred); }}
          onEditOrder={(row) => { if (row.deferred) openOrderEditModal(row.deferred); }}
          onPrintInvoice={(row) => openInvoice(fulfillmentOf(row))}
          onPrintLabel={(row) => openLabel(fulfillmentOf(row))}
          onStatusChange={handleRowStatusChange}
          onCopyPhone={copyPhone}
          statusBusy={updatingStatusOrderId === drawerOrder.orderId || cancellingPendingOrderId === drawerOrder.orderId}
          risk={drawerOrder.deferred ? renderCourierVerdict(drawerOrder.deferred) : null}
          whatsApp={drawerOrder.deferred ? renderWhatsAppCell(drawerOrder.deferred) : null}
          fraudDetail={drawerOrder.deferred ? renderCourierDetail(drawerOrder.deferred) : null}
        />
      )}

      {/* Book to Courier Form Modal */}
      {orderBeingEdited && (
        <OrderEditModal
          order={orderBeingEdited}
          onClose={() => setOrderBeingEdited(null)}
          onSaved={handleOrderSaved}
          showToast={showToast}
        />
      )}

      {isSendModalOpen && selectedOrder && (
        <CourierBookingModal
          selectedOrder={selectedOrder}
          onClose={() => setIsSendModalOpen(false)}
          onEditOrder={() => {
            setResumeBookingAfterEdit(true);
            setIsSendModalOpen(false);
            setOrderBeingEdited(selectedOrder as DeferredOrder);
          }}
          onSubmit={handleSendToCourierSubmit}
          submittingCourier={submittingCourier}
          courierSettings={courierSettings}
          courierProvider={courierProvider}
          setCourierProvider={setCourierProvider}
          recipientName={recipientName}
          recipientPhone={recipientPhone}
          recipientAddress={recipientAddress}
          codAmount={codAmount}
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

      {pendingOrderToCancel && (
        <CancelPendingOrderModal
          order={pendingOrderToCancel}
          busy={cancellingPendingOrderId === pendingOrderToCancel.orderId}
          onKeep={() => setPendingOrderToCancel(null)}
          onConfirm={confirmCancelPendingOrder}
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
