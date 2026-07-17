import React, { useState, useEffect } from 'react';
import { useRef } from 'react';
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
  ChevronDown,
  ChevronUp,
  Printer,
  Copy
} from 'lucide-react';
import { CourierOrder, CourierSettings } from '../types';
import { CourierLabelModal } from './CourierLabelModal';
import { InvoiceModal } from './InvoiceModal';

// â”€â”€â”€ BD Phone Normalizer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Accepts any Bangladeshi phone format and returns clean 01XXXXXXXXX (11 digits)
// Handles: +8801XXXXXXXXX, 8801XXXXXXXXX, 01XXXXXXXXX, 1XXXXXXXXX
function normalizeBDPhone(phone: string): string {
  // Strip spaces, dashes, and parentheses
  let clean = phone.replace(/[\s\-\(\)]/g, '');
  // Strip leading country code +880 or 880
  if (clean.startsWith('+880')) clean = clean.substring(4);
  else if (clean.startsWith('880')) clean = clean.substring(3);
  // Ensure starts with 0 (i.e. 1XXXXXXXXX â†’ 01XXXXXXXXX)
  if (clean.length === 10 && !clean.startsWith('0')) {
    clean = '0' + clean;
  }
  return clean; // Returns formatted 01XXXXXXXXX local string
}

function usablePhone(value: unknown): string {
  const normalized = normalizeBDPhone(String(value || '').trim());
  return /^01\d{9}$/.test(normalized) ? normalized : '';
}

function formatHeldAge(ageHours: unknown): string {
  const hours = Math.max(0, Number(ageHours) || 0);
  const minutes = Math.max(1, Math.round(hours * 60));
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) {
    const wholeHours = Math.floor(hours);
    const remainingMinutes = Math.round((hours - wholeHours) * 60);
    return remainingMinutes > 0 ? `${wholeHours}h ${remainingMinutes}m ago` : `${wholeHours}h ago`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  return remainingHours > 0 ? `${days}d ${remainingHours}h ago` : `${days}d ago`;
}

function productMeta(product: any): Array<{ label: string; value: string; category?: boolean }> {
  const meta: Array<{ label: string; value: string; category?: boolean }> = [];
  const category = String(product?.category || product?.content_category || '').trim();
  if (category) meta.push({ label: 'Category', value: category, category: true });

  if (product?.attributes && typeof product.attributes === 'object' && !Array.isArray(product.attributes)) {
    Object.entries(product.attributes).forEach(([key, value]) => {
      const text = String(value || '').trim();
      if (text) meta.push({ label: key, value: text });
    });
  }
  return meta;
}

interface OrdersViewProps {
  deferredData: any;
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
  const [shippedStatsOpen, setShippedStatsOpen] = useState(false);
  const [shippedStatsVisible, setShippedStatsVisible] = useState(true);
  const shippedStatsLastYRef = useRef(0);

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
    try {
      await navigator.clipboard.writeText(value);
      showToast('Phone number copied.');
    } catch {
      showToast('Could not copy phone number.', true);
    }
  };

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
  const [redxAreas, setRedxAreas] = useState<Array<{id: number, name: string, post_code?: number}>>([]);
  const [redxAreaSearch, setRedxAreaSearch] = useState<string>('');
  const [loadingRedxAreas, setLoadingRedxAreas] = useState<boolean>(false);
  const [loadingStores, setLoadingStores] = useState<boolean>(false);
  const [itemWeight, setItemWeight] = useState<number>(0.5);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [codAmount, setCodAmount] = useState<number>(0);

  const openPendingCourierModal = (order: any) => {
    setSelectedOrder(order);
    setRecipientName(order.recipientName && order.recipientName !== '-' ? order.recipientName : '');
    setRecipientPhone(usablePhone(order.recipientPhone) || usablePhone(order.customer));
    setRecipientAddress(order.recipientAddress && order.recipientAddress !== '-' ? order.recipientAddress : '');
    setCodAmount(order.amount);
    setIsSendModalOpen(true);
  };

  // Selection state & functions for Shipped Courier Log
  const [selectedShippedOrderIds, setSelectedShippedOrderIds] = useState<number[]>([]);
  const [invoiceOrders, setInvoiceOrders] = useState<any[] | null>(null);

  // Clear selection on tab, search, or filter changes to avoid stale/hidden selections
  useEffect(() => {
    setSelectedShippedOrderIds([]);
  }, [activeTab, searchQuery, providerFilter, statusFilter]);

  useEffect(() => {
    shippedStatsLastYRef.current = window.scrollY;
    const handleScroll = () => {
      const currentY = window.scrollY;
      const scrollingUp = currentY < shippedStatsLastYRef.current;
      const nearTop = currentY < 120;

      setShippedStatsVisible(nearTop || scrollingUp);
      if (!nearTop && currentY > shippedStatsLastYRef.current + 8) {
        setShippedStatsOpen(false);
      }

      shippedStatsLastYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
  const [isLabelModalOpen, setIsLabelModalOpen] = useState<boolean>(false);
  const [labelOrder, setLabelOrder] = useState<any>(null);
  const [labelOrders, setLabelOrders] = useState<any[] | null>(null);

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

  const openLabel = (order: any) => {
    setLabelOrder(order);
    setLabelOrders(null);
    setIsLabelModalOpen(true);
  };

  const openBulkLabels = (ordersList: any[]) => {
    setLabelOrders(ordersList);
    setLabelOrder(null);
    setIsLabelModalOpen(true);
  };

  const fetchCourierOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/courier/orders');
      if (res.ok) {
        const data = await res.json();
        setCourierOrders(Array.isArray(data) ? data.map((order: any) => ({
          ...order,
          order_id: String(order?.order_id || ''),
          courier_provider: String(order?.courier_provider || ''),
          courier_status: String(order?.courier_status || 'pending'),
          recipient_name: String(order?.recipient_name || ''),
          recipient_phone: String(order?.recipient_phone || ''),
          courier_tracking_id: String(order?.courier_tracking_id || ''),
          cod_amount: Number(order?.cod_amount || 0),
          delivery_charge: Number(order?.delivery_charge || 0),
          products: Array.isArray(order?.products) ? order.products : [],
        })) : []);
      } else {
        showToast("Failed to fetch courier orders.", true);
      }
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

  const openSendModal = (order: any) => {
    setSelectedOrder(order);
    setRecipientName(order.recipientName || (order.customer.includes('@') ? '' : order.customer));
    setRecipientPhone(order.recipientPhone || (order.customer.match(/^\+?[0-9\s-]{10,15}$/) ? order.customer : ''));
    setRecipientAddress(order.recipientAddress || '');
    setCodAmount(order.amount);
    setIsSendModalOpen(true);
  };

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

  // â”€â”€â”€ Cancel Courier Order â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  const getStatusBadge = (status: string) => {
    const s = String(status || 'pending').toLowerCase();
    if (s === 'booking_queued' || s === 'booking_processing') {
      return (
        <span className="inline-flex min-w-[86px] justify-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
          {s === 'booking_processing' ? 'Booking Now' : 'Booking Queued'}
        </span>
      );
    }
    if (s === 'booking_failed') {
      return (
        <span className="inline-flex min-w-[86px] justify-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
          Booking Failed
        </span>
      );
    }
    if (s === 'delivered' || s === 'completed') {
      return (
        <span className="inline-flex min-w-[86px] justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
          Delivered
        </span>
      );
    }
    if (s === 'returned' || s === 'partial_returned') {
      return (
        <span className="inline-flex min-w-[86px] justify-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
          Returned
        </span>
      );
    }
    if (s === 'cancelled') {
      return (
        <span className="inline-flex min-w-[86px] justify-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700">
          Cancelled
        </span>
      );
    }
    if (s === 'in_transit' || s === 'picked_up' || s === 'shipped') {
      return (
        <span className="inline-flex min-w-[86px] justify-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
          In Transit
        </span>
      );
    }
    return (
      <span className="inline-flex min-w-[86px] justify-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
        Pending
      </span>
    );
  };

  const getCapiStatusBadge = (sent: boolean) => {
    return sent ? (
      <span className="inline-flex min-w-[86px] justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
        Synced
      </span>
    ) : (
      <span className="inline-flex min-w-[86px] justify-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-500">
        Waiting
      </span>
    );
  };

  const getCourierTrackingUrl = (provider: string, trackingId: string) => {
    const id = encodeURIComponent(trackingId);
    if (provider === 'steadfast') return `https://portal.packzy.com/tracking/${id}`;
    if (provider === 'redx') return `https://redx.com.bd/track-delivery/?trackingId=${id}`;
    if (provider === 'pathao') return `https://pathao.com/courier/tracking?tracking_id=${id}`;
    return '';
  };
  const filteredRedxAreas = redxAreas
    .filter(area => {
      const needle = redxAreaSearch.trim().toLowerCase();
      if (!needle) return true;
      return `${area.name} ${area.post_code || ''} ${area.id}`.toLowerCase().includes(needle);
    })
    .slice(0, 30);

  const renderRiskGauge = (scoreValue: number) => {
    const score = Math.max(0, Math.min(100, Number(scoreValue) || 0));
    const tone = score >= 75
      ? { label: 'High', text: 'text-rose-700', bar: 'bg-rose-500' }
      : score >= 35
        ? { label: 'Medium', text: 'text-amber-700', bar: 'bg-amber-500' }
        : { label: 'Low', text: 'text-green-700', bar: 'bg-green-500' };

    return (
      <div className="w-[96px]">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={`text-[10px] font-black uppercase tracking-wide ${tone.text}`}>{tone.label}</span>
          <span className="font-mono text-[10px] font-bold text-slate-500">{score}/100</span>
        </div>
        <div className="grid h-1.5 grid-cols-3 overflow-hidden rounded-full bg-slate-100">
          <span className="bg-green-400" />
          <span className="bg-amber-400" />
          <span className="bg-rose-400" />
        </div>
        <div className="mt-1 h-0.5 rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${score}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {deferredLoadError && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-bold">COD orders could not be loaded</p>
            <p className="mt-0.5 text-[11px] text-amber-700">{deferredLoadError} Courier settings and shipped orders are still available.</p>
          </div>
        </div>
      )}
      {activeTab === 'shipped' && (
        <div
          className={`fixed right-2 top-32 z-30 md:hidden transition-all duration-200 ${
            shippedStatsVisible ? 'translate-x-0 opacity-100' : 'translate-x-16 opacity-0 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={() => setShippedStatsOpen(prev => !prev)}
            className="flex w-[72px] flex-col gap-1 rounded-2xl border border-slate-200 bg-white/95 p-1.5 text-left shadow-lg shadow-slate-200/70 backdrop-blur"
            aria-label="Shipment status summary"
          >
            {shippedStatItems.map(item => (
              <span key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-1.5 py-1">
                <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                <span className="text-[9px] font-bold uppercase leading-none text-slate-500">{item.shortLabel}</span>
                <span className={`font-mono text-[10px] font-black leading-none ${item.tone}`}>{item.value}</span>
              </span>
            ))}
          </button>

          {shippedStatsOpen && (
            <div className="absolute right-20 top-0 w-40 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/80">
              <p className="px-1 pb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Shipment summary</p>
              <div className="space-y-1">
                {shippedStatItems.map(item => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-2 py-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                      <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                      {item.label}
                    </span>
                    <span className={`font-mono text-xs font-black ${item.tone}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Tab bar header */}
      <div className="flex border-b border-slate-200 ">
        <button
          onClick={() => setActiveTab('pending')}
          data-guide="orders-pending-tab"
          className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-bold transition-all cursor-pointer sm:flex-none sm:justify-start sm:gap-2 sm:px-5 sm:py-3 sm:text-sm ${
            activeTab === 'pending'
              ? 'border-indigo-600 text-indigo-600  '
              : 'border-transparent text-slate-500 hover:text-slate-700  '
          }`}
        >
          <Package className="w-4 h-4" />
          <span className="sm:hidden">Pending</span>
          <span className="hidden sm:inline">Pending Orders</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600">{deferredData?.operationsPendingCount ?? deferredData?.pendingCount ?? codVerificationOrders.length}</span>
        </button>
        <button
          onClick={() => setActiveTab('shipped')}
          data-guide="orders-shipped-tab"
          className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-bold transition-all cursor-pointer sm:flex-none sm:justify-start sm:gap-2 sm:px-5 sm:py-3 sm:text-sm ${
            activeTab === 'shipped'
              ? 'border-indigo-600 text-indigo-600  '
              : 'border-transparent text-slate-500 hover:text-slate-700  '
          }`}
        >
          <Truck className="w-4 h-4" />
          <span className="sm:hidden">Shipped</span>
          <span className="hidden sm:inline">Shipped Courier Log</span>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600">{courierOrders.length}</span>
        </button>
        
        <button 
          onClick={() => {
            fetchDeferred();
            fetchCourierOrders();
            showToast("Syncing data feeds...", false);
          }}
          className="ml-auto p-2 self-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50  cursor-pointer"
          title="Reload lists"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {activeTab === 'pending' && (
        <div id="orders-pending" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col space-y-4  ">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Pending Courier Orders</h2>
              <p className="text-xs text-slate-400 ">
                Review order details, create invoices, and book orders with a courier.
              </p>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {codVerificationOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-400  ">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
                <p className="text-xs font-semibold">No COD orders are waiting for your review.</p>
              </div>
            ) : codVerificationOrders.map((order: any) => {
              const isExpanded = expandedOrderId === order.orderId;
              const products: any[] = order.products || [];
              return (
                <div key={order.orderId} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm  ">
                  <button type="button" onClick={() => toggleExpand(order.orderId)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-bold text-slate-900 ">#{order.orderId}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800 ">{order.recipientName || 'Customer unavailable'}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{usablePhone(order.recipientPhone) || usablePhone(order.customer) || 'No phone'}</p>
                      </div>
                      <span className="font-bold text-slate-900 ">BDT {Number(order.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-lg bg-slate-50 p-2 ">
                        <p className="font-bold uppercase text-slate-400">Risk</p>
                        <div className="mt-1">{renderRiskGauge(order.fraudScore)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2 ">
                        <p className="font-bold uppercase text-slate-400">Held</p>
                        <p className="mt-1 font-mono font-bold text-slate-700 ">{formatHeldAge(order.ageHours)}</p>
                      </div>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 ">
                      <div className="rounded-lg bg-slate-50 p-3 text-xs ">
                        <p className="font-bold uppercase tracking-wider text-slate-400">Address</p>
                        <p className="mt-1 font-semibold text-slate-800 ">{order.recipientAddress || 'Address unavailable'}</p>
                      </div>
                      {products.length > 0 && (
                        <div className="rounded-lg border border-slate-200 ">
                          {products.slice(0, 4).map((p: any, i: number) => {
                            const meta = productMeta(p);
                            return (
                              <div key={i} className="border-b border-slate-100 px-3 py-2 text-xs last:border-b-0 ">
                                <p className="font-semibold text-slate-700 ">{p.name || p.content_name || 'Product'}</p>
                                {meta.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {meta.map((item) => (
                                      <span key={`${item.label}-${item.value}`} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.category ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700'}`}>
                                        {item.label}: {item.value}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <p className="mt-1 text-[10px] text-slate-500">
                                  Qty {p.quantity || 1} · {Number(p.price || 0) > 0 ? `BDT ${Number(p.price || 0).toLocaleString()}` : 'Price unavailable'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button onClick={() => openInvoice(order)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">Invoice</button>
                    <button onClick={() => openPendingCourierModal(order)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Book Courier</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto min-h-64 md:block">
            <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-100 min-w-[750px]  ">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500  ">
                <tr>
                  <th className="px-6 py-3">Order ID</th>
                  <th className="px-6 py-3">Customer Info</th>
                  <th className="px-6 py-3">Value</th>
                  <th className="px-6 py-3">Fraud Score</th>
                  <th className="px-6 py-3">Time Held</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 ">
                {codVerificationOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium ">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                      No COD orders are waiting for your review.
                    </td>
                  </tr>
                ) : (
                  codVerificationOrders.map((order: any) => {
                    const isExpanded = expandedOrderId === order.orderId;
                    const products: any[] = order.products || [];
                    return (
                      <React.Fragment key={order.orderId}>
                        <tr className={`hover:bg-slate-50/50 transition-colors  ${isExpanded ? 'bg-indigo-50/20 ' : ''}`}>
                          <td className="px-6 py-3">
                            <button
                              onClick={() => toggleExpand(order.orderId)}
                              className="flex items-center gap-1.5 font-mono font-bold text-slate-800  hover:text-indigo-600  transition-colors cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                              {order.orderId}
                            </button>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex flex-col gap-0.5">
                              {order.recipientName && order.recipientName !== '-' && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(order.orderId)}
                                  className="w-fit text-left font-semibold text-slate-700 hover:text-indigo-600   transition-colors cursor-pointer"
                                  aria-expanded={isExpanded}
                                  title="View customer and order details"
                                >
                                  {order.recipientName}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3 font-semibold text-slate-800 ">BDT {Number(order.amount || 0).toLocaleString()}</td>
                          <td className="px-6 py-3">
                            {renderRiskGauge(order.fraudScore)}
                          </td>
                          <td className="px-6 py-3 text-slate-400 font-mono ">{formatHeldAge(order.ageHours)}</td>
                          <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                            <button 
                              onClick={() => openInvoice(order)}
                              className="btn-touch-expand px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700    text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="View and Print Invoice"
                            >
                              <FileText className="w-2.5 h-2.5" /> Invoice
                            </button>
                            <button
                              onClick={() => openPendingCourierModal(order)}
                              className="btn-touch-expand px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Send className="w-2.5 h-2.5" /> Book Courier
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 ">
                            <td colSpan={6} className="px-6 py-3">
                              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.35fr)]">
                                {/* Customer Info Card */}
                                <div className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white">
                                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer Details</p>
                                    <span className="font-mono text-[10px] font-bold text-slate-400">#{order.orderId}</span>
                                  </div>
                                  <div className="space-y-2 p-3">
                                    <div className="flex items-start gap-2.5">
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
                                        <User className="w-3.5 h-3.5 text-indigo-500" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold">Name</p>
                                        <p className="truncate text-xs font-semibold text-slate-800">{order.recipientName || '-'}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold">Phone</p>
                                        <div className="flex items-center gap-1.5">
                                          <p className="font-mono text-xs font-semibold text-slate-800">{usablePhone(order.recipientPhone) || '-'}</p>
                                          {usablePhone(order.recipientPhone) && (
                                            <button
                                              type="button"
                                              onClick={() => copyPhone(order.recipientPhone)}
                                              className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600"
                                              title="Copy phone number"
                                              aria-label="Copy phone number"
                                            >
                                              <Copy className="h-3 w-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                                        <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[9px] text-slate-400 uppercase font-bold">Address</p>
                                        <p className="text-xs font-semibold leading-relaxed text-slate-800">{order.recipientAddress || '-'}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Products Card */}
                                <div className="self-start overflow-hidden rounded-xl border border-slate-200 bg-white">
                                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Order Items</p>
                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">{products.length} item{products.length === 1 ? '' : 's'}</span>
                                  </div>
                                  <div>
                                    {products.length === 0 ? (
                                      <div className="px-4 py-5 text-center">
                                        <Package className="w-5 h-5 mx-auto text-slate-300  mb-1" />
                                        <p className="text-[10px] text-slate-400">Product details not available for this order</p>
                                      </div>
                                    ) : (
                                      <div className="divide-y divide-slate-100">
                                        {products.map((p: any, i: number) => {
                                          const meta = productMeta(p);
                                          return (
                                            <div key={i} className="px-3 py-3 hover:bg-slate-50/50">
                                              <div className="flex items-start justify-between gap-4">
                                                <p className="text-xs font-semibold leading-snug text-slate-800">{p.name || p.content_name || 'Product'}</p>
                                                <div className="shrink-0 text-right">
                                                  <p className="text-[9px] font-bold uppercase text-slate-400">Unit price</p>
                                                  <p className="text-xs font-bold text-slate-800">{Number(p.price || 0) > 0 ? `BDT ${Number(p.price || 0).toLocaleString()}` : 'No price'}</p>
                                                </div>
                                              </div>
                                              {meta.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                  {meta.map((item) => (
                                                    <span key={`${item.label}-${item.value}`} className={`rounded-md border px-2 py-1 text-[9px] font-bold ${item.category ? 'border-slate-200 bg-slate-50 text-slate-600' : 'border-indigo-100 bg-indigo-50 text-indigo-700'}`}>
                                                      {item.label}: {item.value}
                                                    </span>
                                                  ))}
                                                </div>
                                              )}
                                              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                                                <span className="rounded bg-slate-100 px-1.5 py-0.5">Qty <strong className="text-slate-700">{p.quantity || 1}</strong></span>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-2.5">
                                    <div className="ml-auto max-w-xs space-y-1 text-[10px]">
                                      <div className="flex items-center justify-between gap-5 text-slate-500">
                                        <span>Product subtotal</span>
                                        <strong className="text-slate-700">BDT {Number(order.productSubtotal ?? order.amount ?? 0).toLocaleString()}</strong>
                                      </div>
                                      {Number(order.deliveryCharge || 0) > 0 && (
                                        <div className="flex items-center justify-between gap-5 text-slate-500">
                                          <span>Delivery charge</span>
                                          <strong className="text-slate-700">+ BDT {Number(order.deliveryCharge).toLocaleString()}</strong>
                                        </div>
                                      )}
                                      {Number(order.otherAdjustment || 0) !== 0 && (
                                        <div className="flex items-center justify-between gap-5 text-slate-500">
                                          <span>Delivery / adjustments</span>
                                          <strong className="text-slate-700">{Number(order.otherAdjustment) > 0 ? '+' : '-'} BDT {Math.abs(Number(order.otherAdjustment)).toLocaleString()}</strong>
                                        </div>
                                      )}
                                      {Number(order.discount || 0) > 0 && (
                                        <div className="flex items-center justify-between gap-5 text-slate-500">
                                          <span>Discount</span>
                                          <strong className="text-slate-700">- BDT {Number(order.discount).toLocaleString()}</strong>
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between gap-5 border-t border-slate-200 pt-1.5 text-xs">
                                        <span className="font-bold text-slate-700">Total order value</span>
                                        <strong className="text-indigo-700">BDT {Number(order.orderTotal ?? order.amount ?? 0).toLocaleString()}</strong>
                                      </div>
                                    </div>
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
        <div id="orders-shipped" className="scroll-mt-24 flex flex-col space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:space-y-4 md:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xs font-black uppercase tracking-wide text-slate-800 md:text-sm">Shipped Orders & Delivery Tracking</h2>
              <p className="hidden text-xs text-slate-400 sm:block">
                Track delivery statuses on SteadFast, Pathao, or RedX. Delivered orders send purchase data; returned orders send refund data.
              </p>
            </div>
          </div>

          <div className="hidden grid-cols-5 gap-2 md:grid">
            {shippedStatItems.map(item => (
              <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className={`text-base font-bold leading-none ${item.tone}`}>{item.value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
            <div className="relative min-w-full flex-1 sm:min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                placeholder="Search by Order ID, tracking or recipient..."
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            
            <div className="min-w-0 flex-1 sm:w-[140px] sm:flex-none">
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                aria-label="Filter shipped orders by courier"
                className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Couriers</option>
                <option value="steadfast">SteadFast</option>
                <option value="pathao">Pathao</option>
                <option value="redx">RedX</option>
              </select>
            </div>

            <div className="min-w-0 flex-1 sm:w-[140px] sm:flex-none">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter shipped orders by status"
                className="h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            <div className="flex items-center justify-between p-3.5 bg-indigo-50  rounded-xl border border-indigo-200  animate-fade-in mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600 " />
                <span className="text-xs font-bold text-slate-800 ">
                  {selectedShippedOrderIds.length} {selectedShippedOrderIds.length === 1 ? 'order' : 'orders'} selected for bulk actions
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const selectedOrders = courierOrders.filter(o => selectedShippedOrderIds.includes(o.id));
                    openBulkLabels(selectedOrders);
                  }}
                  className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Package className="w-3.5 h-3.5" />
                  Bulk Print Labels ({selectedShippedOrderIds.length})
                </button>
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
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100    rounded-lg text-xs font-semibold transition-all cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="space-y-3 md:hidden">
            {loadingOrders ? (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-slate-400  ">
                <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-500" />
                <p className="text-xs font-semibold">Fetching shipment details...</p>
              </div>
            ) : filteredCourierOrders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-400  ">
                <Truck className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-xs font-bold text-slate-600 ">No courier orders found</p>
              </div>
            ) : filteredCourierOrders.map((order) => {
              const isCancellable = !['cancelled', 'delivered', 'returned'].includes((order.courier_status || '').toLowerCase());
              const isCancelling = cancellingOrderId === order.id;
              return (
                <div key={order.id} className={`rounded-xl border bg-white p-4 shadow-sm ${
                  (order.courier_status || '').toLowerCase() === 'booking_failed' ? 'border-rose-200' : 'border-slate-200'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedShippedOrderIds.includes(order.id)}
                        onChange={() => toggleSelectShippedOrder(order.id)}
                        className="mt-1 rounded accent-indigo-600"
                      />
                      <span>
                        <span className="block font-mono text-sm font-bold text-slate-900 ">#{order.order_id}</span>
                        <span className="mt-1 block text-xs font-bold capitalize text-slate-800 ">{order.courier_provider}</span>
                        <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{order.courier_tracking_id || 'No tracking'}</span>
                      </span>
                    </label>
                    <span className="font-bold text-slate-900 ">BDT {Number(order.cod_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs ">
                    <p className="font-bold text-slate-900 ">{order.recipient_name || 'Customer'}</p>
                    <p className="mt-1 font-mono text-slate-500">{order.recipient_phone || 'No phone'}</p>
                    <p className="mt-0.5 line-clamp-2 text-slate-500">{order.recipient_address || 'No address'}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div>{getStatusBadge(order.courier_status)}</div>
                    <div className="text-right">{getCapiStatusBadge(order.purchase_event_sent)}</div>
                    <span className="font-mono text-slate-500">{new Date(order.created_at).toLocaleDateString()}</span>
                    <span className="text-right text-slate-500">{order.delivery_charge > 0 ? `Charge BDT ${order.delivery_charge}` : 'No charge'}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <button onClick={() => openInvoice(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                      <FileText className="h-3.5 w-3.5" />
                      Invoice
                    </button>
                    <button onClick={() => openLabel(order)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700">
                      <Package className="h-3.5 w-3.5" />
                      Label
                    </button>
                    {isCancellable ? (
                      <button onClick={() => handleCancelCourierOrder(order)} disabled={isCancelling} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">
                        {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        {isCancelling ? 'Cancelling...' : 'Cancel'}
                      </button>
                    ) : (
                      <span className="self-center text-[11px] italic text-slate-400">{(order.courier_status || '').toLowerCase()}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden min-h-64 overflow-x-auto rounded-lg border border-slate-200 md:block">
            <table className="w-full min-w-[820px] divide-y divide-slate-100 text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-3 text-center">
                    <input 
                      type="checkbox" 
                      checked={areAllFilteredSelected} 
                      onChange={toggleSelectAllFilteredShipped}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                    />
                  </th>
                  <th className="px-4 py-3">Order & recipient</th>
                  <th className="px-4 py-3">Courier</th>
                  <th className="px-4 py-3">Amount / booked</th>
                  <th className="px-4 py-3">Delivery status</th>
                  <th className="px-4 py-3">Purchase sync</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 ">
                {loadingOrders ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 mx-auto animate-spin text-indigo-500 mb-2" />
                      Fetching shipment details...
                    </td>
                  </tr>
                ) : filteredCourierOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                        <Truck className="h-7 w-7 text-slate-300" />
                        <p className="font-bold text-slate-600 ">No courier orders found</p>
                        <p className="text-xs font-normal text-slate-400">Confirmed COD orders will appear here after they are booked with a courier.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredCourierOrders.map((order) => {
                    const isCancellable = !['cancelled', 'delivered', 'returned'].includes(
                      (order.courier_status || '').toLowerCase()
                    );
                    const isCancelling = cancellingOrderId === order.id;
                    return (
                    <tr key={order.id} className={`transition-colors hover:bg-slate-50/70 ${
                      (order.courier_status || '').toLowerCase() === 'booking_failed' ? 'bg-rose-50/30' : ''
                    }`}>
                      <td className="px-4 py-3 text-center align-top">
                        <input 
                          type="checkbox" 
                          checked={selectedShippedOrderIds.includes(order.id)} 
                          onChange={() => toggleSelectShippedOrder(order.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer accent-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-slate-900">#{order.order_id}</span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                              {order.courier_provider}
                            </span>
                          </div>
                          <p className="mt-1 font-bold text-slate-800">{order.recipient_name || '-'}</p>
                          <p className="font-mono text-[11px] text-slate-500">{order.recipient_phone || '-'}</p>
                          <p className="mt-0.5 max-w-[260px] truncate text-[11px] text-slate-400" title={order.recipient_address}>
                            {order.recipient_address || '-'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Tracking
                          </span>
                          {order.courier_tracking_id ? (
                            <span className="mt-1 flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700">
                              {order.courier_tracking_id}
                              <a
                                href={getCourierTrackingUrl(order.courier_provider, order.courier_tracking_id)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-indigo-500 hover:text-indigo-700 inline"
                              >
                                <ExternalLink className="w-2.5 h-2.5 inline" />
                              </a>
                            </span>
                          ) : (
                            <span className="mt-1 text-[11px] text-slate-400">No tracking yet</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col text-[11px] leading-tight">
                          <span className="font-bold text-slate-900">BDT {Number(order.cod_amount || 0).toLocaleString()}</span>
                          {order.delivery_charge > 0 && (
                            <span className="mt-0.5 text-[10px] font-medium text-slate-400">Charge BDT {order.delivery_charge}</span>
                          )}
                          <span className="mt-1 font-mono text-[10px] text-slate-400">
                            {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {new Date(order.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">{getStatusBadge(order.courier_status)}</td>
                      <td className="px-4 py-3 align-top">{getCapiStatusBadge(order.purchase_event_sent)}</td>
                      <td className="px-4 py-3 text-right align-top">
                        <div className="flex justify-end gap-1.5 whitespace-nowrap">
                        <button 
                          onClick={() => openInvoice(order)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-100"
                          title="View and Print Invoice"
                          aria-label="View and print invoice"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openLabel(order)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700 transition-colors hover:bg-violet-100"
                          title="Preview and Print Courier Label"
                          aria-label="Preview and print courier label"
                        >
                          <Package className="h-3.5 w-3.5" />
                        </button>
                        {isCancellable ? (
                          <button
                            id={`cancel-courier-order-${order.id}`}
                            onClick={() => handleCancelCourierOrder(order)}
                            disabled={isCancelling}
                            title={`Cancel this ${order.courier_provider} order`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Cancel ${order.courier_provider} order`}
                          >
                            {isCancelling ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="self-center px-1 text-[10px] italic text-slate-400">
                            {(order.courier_status || '').toLowerCase() === 'cancelled' ? 'Cancelled' :
                             (order.courier_status || '').toLowerCase() === 'delivered' ? 'Delivered' : 'Returned'}
                          </span>
                        )}
                        </div>
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
          <div className="bg-white  border border-slate-200  rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col space-y-5 animate-slide-in-up">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100  pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600 " />
                <h3 className="font-bold text-slate-800  text-base">Book Consignment with Courier</h3>
              </div>
              <button 
                onClick={() => setIsSendModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50  cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSendToCourierSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Order Meta details read-only */}
                <div className="p-3 bg-slate-50 rounded-lg  border border-slate-100 ">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Order Reference ID</span>
                  <span className="font-mono font-bold text-sm text-slate-800 ">{selectedOrder.orderId || selectedOrder.order_id}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg  border border-slate-100 ">
                  <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Original Value</span>
                  <span className="font-bold text-sm text-slate-800 ">BDT {(selectedOrder.amount || selectedOrder.cod_amount || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Order Items (Products) */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500  uppercase tracking-wider">Order Items</label>
                <div className="bg-white  rounded-lg border border-slate-200  overflow-hidden">
                  {(!selectedOrder?.products || selectedOrder.products.length === 0) ? (
                    <div className="px-4 py-3 text-center">
                      <p className="text-[10px] text-slate-400">Product details not available</p>
                    </div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 ">
                        <tr>
                          <th className="px-3 py-1.5 text-left text-[9px] font-bold uppercase text-slate-400">Product</th>
                          <th className="px-3 py-1.5 text-center text-[9px] font-bold uppercase text-slate-400">Qty</th>
                          <th className="px-3 py-1.5 text-right text-[9px] font-bold uppercase text-slate-400">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 ">
                        {selectedOrder.products.map((p: any, i: number) => {
                          const meta = productMeta(p);
                          return (
                            <tr key={i} className="hover:bg-slate-50/50 ">
                              <td className="max-w-[260px] px-3 py-2">
                                <p className="font-medium leading-snug text-slate-700" title={p.name}>{p.name}</p>
                                {meta.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {meta.map((item) => (
                                      <span key={`${item.label}-${item.value}`} className={`rounded px-1.5 py-0.5 text-[8px] font-bold ${item.category ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700'}`}>
                                        {item.label}: {item.value}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-center font-bold text-slate-600 ">{p.quantity}</td>
                              <td className="px-3 py-1.5 text-right font-semibold text-slate-700 ">{Number(p.price || 0) > 0 ? `BDT ${Number(p.price || 0).toLocaleString()}` : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Courier Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500  uppercase tracking-wider mb-1">Select Courier Partner</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                    courierProvider === 'steadfast' 
                      ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700   ' 
                      : 'border-slate-200 hover:bg-slate-50  '
                  }`}>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 ">SteadFast Courier</span>
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
                      ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700   ' 
                      : 'border-slate-200 hover:bg-slate-50  '
                  }`}>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 ">Pathao Courier</span>
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

                  <label className={`border rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all duration-200 ${
                    courierProvider === 'redx'
                      ? 'border-indigo-600 bg-indigo-50/10 text-indigo-700   '
                      : 'border-slate-200 hover:bg-slate-50  '
                  }`}>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800 ">RedX Courier</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">Token-secured OpenAPI Booking</span>
                    </div>
                    <input
                      type="radio"
                      name="provider"
                      value="redx"
                      checked={courierProvider === 'redx'}
                      onChange={() => setCourierProvider('redx')}
                      className="accent-indigo-600 cursor-pointer h-4 w-4"
                    />
                  </label>
                </div>
              </div>

              {/* Recipient details */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-bold text-indigo-600  uppercase tracking-wider border-b border-slate-100  pb-1">
                  Recipient Information
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Customer Name</label>
                    <div className="relative">
                      <User className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="e.g. Hridoy Hossain"
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Phone Number</label>
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
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Delivery Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                    <textarea
                      required
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      placeholder="Enter complete shipping details (Street, District, Area)..."
                      rows={2}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Cash on Delivery Amount to Collect (BDT)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="number"
                        required
                        value={codAmount}
                        onChange={(e) => setCodAmount(Number(e.target.value))}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500    font-bold"
                      />
                    </div>
                  </div>
                  
                  {/* Pathao stores are fetched from the courier API when credentials are available. */}
                  {courierProvider === 'pathao' && (
                    <div className="space-y-3 md:col-span-2">
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Pathao Store</label>
                      {loadingStores ? (
                        <div className="py-2 px-3 bg-slate-50  border border-slate-200  rounded-lg text-xs text-slate-500 flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                          Stores loading...
                        </div>
                      ) : pathaoStores.length > 0 ? (
                        <select
                          value={selectedStoreId}
                          onChange={(e) => setSelectedStoreId(Number(e.target.value))}
                          className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                        >
                          {pathaoStores.map((store) => (
                            <option key={store.store_id} value={store.store_id}>
                              {store.store_name} (ID: {store.store_id})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="py-2 px-3 bg-red-50  border border-red-200  rounded-lg text-xs text-red-600  font-semibold flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 shrink-0" />
                          Pathao is not connected yet. Add its API details in Settings.
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <select
                          value={selectedPathaoCity}
                          onChange={(e) => setSelectedPathaoCity(e.target.value ? Number(e.target.value) : '')}
                          disabled={loadingPathaoLocations || pathaoCities.length === 0}
                          className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-60"
                        >
                          <option value="">Auto-detect city</option>
                          {pathaoCities.map((city) => <option key={city.city_id} value={city.city_id}>{city.city_name}</option>)}
                        </select>
                        <select
                          value={selectedPathaoZone}
                          onChange={(e) => setSelectedPathaoZone(e.target.value ? Number(e.target.value) : '')}
                          disabled={selectedPathaoCity === '' || pathaoZones.length === 0}
                          className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-60"
                        >
                          <option value="">Auto-detect zone</option>
                          {pathaoZones.map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zone.zone_name}</option>)}
                        </select>
                        <select
                          value={selectedPathaoArea}
                          onChange={(e) => setSelectedPathaoArea(e.target.value ? Number(e.target.value) : '')}
                          disabled={selectedPathaoZone === '' || pathaoAreas.length === 0}
                          className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-60"
                        >
                          <option value="">Auto-detect area</option>
                          {pathaoAreas.map((area) => <option key={area.area_id} value={area.area_id}>{area.area_name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {courierProvider === 'redx' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:col-span-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">RedX Delivery Area</label>
                        {loadingRedxAreas ? (
                          <div className="py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg   ">Loading areas...</div>
                        ) : (
                          <div className="space-y-1.5">
                            <input
                              type="search"
                              value={redxAreaSearch}
                              onChange={(e) => setRedxAreaSearch(e.target.value)}
                              placeholder="Search area, post code, or ID"
                              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                            />
                            <select
                              required
                              value={redxDeliveryAreaId}
                              onChange={(e) => {
                                const area = redxAreas.find((item) => String(item.id) === e.target.value);
                                setRedxDeliveryAreaId(e.target.value);
                                if (area) {
                                  setRedxDeliveryAreaName(area.name);
                                  setRedxAreaSearch(area.name);
                                }
                              }}
                              className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                            >
                              <option value="">Select from matches</option>
                              {filteredRedxAreas.map((area) => <option key={area.id} value={area.id}>{area.name}{area.post_code ? ` (${area.post_code})` : ''} - ID {area.id}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">RedX Delivery Area Name</label>
                        <input required type="text" value={redxDeliveryAreaName} onChange={(e) => setRedxDeliveryAreaName(e.target.value)} className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg   " />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">RedX Pickup Store ID</label>
                        <input type="number" value={redxPickupStoreId} onChange={(e) => setRedxPickupStoreId(e.target.value)} className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg   " />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Parcel Weight (KG)</label>
                    <select
                      value={itemWeight}
                      onChange={(e) => setItemWeight(Number(e.target.value))}
                      className="w-full p-2 text-xs bg-slate-50  border border-slate-200  rounded-lg text-slate-800  focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
                    <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Parcel Quantity</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2 text-xs bg-slate-50  border border-slate-200  rounded-lg text-slate-800  focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100 ">
                <button
                  type="button"
                  onClick={() => setIsSendModalOpen(false)}
                  className="px-4 py-2 border border-slate-200  rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700   transition-colors cursor-pointer"
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

      {orderToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl  ">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 ">Cancel courier order?</h3>
              <p className="text-xs leading-relaxed text-slate-500 ">
                {orderToCancel.courier_provider === 'steadfast'
                  ? 'This cancels the order locally. Please also cancel it from the SteadFast merchant panel.'
                  : `Cancel order ${orderToCancel.order_id} on ${cancelProviderName}? Pending or pickup orders can usually be cancelled.`}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50    "
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={confirmCancelCourierOrder}
                className="rounded-lg bg-rose-900 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-950"
              >
                Cancel Order
              </button>
            </div>
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
