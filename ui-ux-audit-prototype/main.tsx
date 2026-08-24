import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Filter,
  Headphones,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  PackageCheck,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Store,
  Truck,
  UserRound,
  X,
} from 'lucide-react';
import './styles.css';

type ViewKey = 'all' | 'attention' | 'ready' | 'transit' | 'delivered';
type Order = {
  id: string;
  customer: string;
  phone: string;
  location: string;
  items: string;
  itemCount: number;
  total: number;
  payment: 'COD' | 'Paid';
  risk: 'Low' | 'Medium' | 'High' | 'Unavailable';
  fulfillment: 'Pending review' | 'Ready to ship' | 'In transit' | 'Delivered';
  courier?: string;
  tracking?: string;
  placed: string;
};

const orders: Order[] = [
  { id: 'WC-9284', customer: 'Nusrat Jahan', phone: '01812 349999', location: 'Dhanmondi, Dhaka', items: 'Premium Linen Shirt', itemCount: 2, total: 4500, payment: 'COD', risk: 'High', fulfillment: 'Pending review', placed: '12h ago' },
  { id: 'WC-9283', customer: 'Rafi Ahmed', phone: '01711 112222', location: 'Uttara, Dhaka', items: 'Classic Oxford Shirt', itemCount: 1, total: 2490, payment: 'COD', risk: 'Unavailable', fulfillment: 'Ready to ship', placed: '5h ago' },
  { id: 'WC-9279', customer: 'Mahin Chowdhury', phone: '01955 448821', location: 'Agrabad, Chattogram', items: 'Everyday Polo', itemCount: 3, total: 6270, payment: 'Paid', risk: 'Low', fulfillment: 'In transit', courier: 'Pathao', tracking: 'PT-849201', placed: 'Yesterday' },
  { id: 'WC-9276', customer: 'Samia Rahman', phone: '01678 912444', location: 'Zindabazar, Sylhet', items: 'Relaxed Cotton Tee', itemCount: 2, total: 3180, payment: 'COD', risk: 'Medium', fulfillment: 'Ready to ship', placed: 'Yesterday' },
  { id: 'WC-9268', customer: 'Tanvir Islam', phone: '01310 225577', location: 'Sonadanga, Khulna', items: 'Essential Chino', itemCount: 1, total: 2890, payment: 'Paid', risk: 'Low', fulfillment: 'Delivered', courier: 'Steadfast', tracking: 'SF-291044', placed: 'Aug 17' },
];

const viewLabels: Array<{ key: ViewKey; label: string }> = [
  { key: 'all', label: 'All orders' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'ready', label: 'Ready to ship' },
  { key: 'transit', label: 'In transit' },
  { key: 'delivered', label: 'Delivered' },
];

const money = (value: number) => `BDT ${value.toLocaleString('en-BD')}`;

function RiskBadge({ value }: { value: Order['risk'] }) {
  const className = value === 'High' ? 'danger' : value === 'Medium' ? 'warning' : value === 'Low' ? 'success' : 'neutral';
  return <span className={`badge ${className}`}>{value === 'Unavailable' ? 'Not checked' : `${value} risk`}</span>;
}

function StatusBadge({ value }: { value: Order['fulfillment'] }) {
  const className = value === 'Delivered' ? 'success' : value === 'In transit' ? 'info' : value === 'Ready to ship' ? 'accent' : 'warning';
  return <span className={`badge ${className}`}>{value}</span>;
}

function App() {
  const [activeView, setActiveView] = useState<ViewKey>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [focusedOrder, setFocusedOrder] = useState<Order | null>(null);
  const [mobileNav, setMobileNav] = useState(false);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const matchesView = activeView === 'all'
      || (activeView === 'attention' && (order.risk === 'High' || order.fulfillment === 'Pending review'))
      || (activeView === 'ready' && order.fulfillment === 'Ready to ship')
      || (activeView === 'transit' && order.fulfillment === 'In transit')
      || (activeView === 'delivered' && order.fulfillment === 'Delivered');
    const needle = query.trim().toLowerCase();
    const matchesQuery = !needle || `${order.id} ${order.customer} ${order.phone} ${order.location}`.toLowerCase().includes(needle);
    return matchesView && matchesQuery;
  }), [activeView, query]);

  const allVisibleSelected = filteredOrders.length > 0 && filteredOrders.every((order) => selected.includes(order.id));
  const toggleOrder = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark">B</div>
          <div><strong>Buykori</strong><span>AdSync</span></div>
          <button className="icon-button sidebar-close" aria-label="Close menu" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>

        <button className="store-switcher">
          <span className="store-icon"><Store size={17} /></span>
          <span><small>ACTIVE STORE</small><strong>Buykori Demo Store</strong><em>buykori-demo.com</em></span>
          <ChevronDown size={15} />
        </button>

        <nav className="main-nav">
          <p>OPERATIONS</p>
          <button><LayoutDashboard size={18} /><span>Overview</span></button>
          <button className="active"><ClipboardList size={18} /><span>Orders</span><b>5</b></button>
          <button><Truck size={18} /><span>Shipping</span><b>2</b></button>
          <button><MessageSquareText size={18} /><span>Abandoned checkouts</span></button>
          <p>GROWTH</p>
          <button><BarChart3 size={18} /><span>Performance</span></button>
          <button><ShieldCheck size={18} /><span>Tracking health</span></button>
          <p>ADMIN</p>
          <button><Settings size={18} /><span>Settings</span></button>
          <button><Headphones size={18} /><span>Support</span></button>
        </nav>

        <div className="sidebar-account">
          <div className="avatar">MA</div>
          <div><strong>Malcolm Abbott</strong><span>Growth plan</span></div>
          <Ellipsis size={18} />
        </div>
      </aside>

      {mobileNav && <button className="nav-scrim" aria-label="Close menu" onClick={() => setMobileNav(false)} />}

      <div className="workspace">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Operations</span><ChevronRight size={14} /><strong>Orders</strong></div>
          <div className="top-actions">
            <button className="search-shortcut"><Search size={16} /><span>Search workspace</span><kbd>⌘ K</kbd></button>
            <button className="icon-button" aria-label="Notifications"><Bell size={18} /><i /></button>
            <button className="avatar-button" aria-label="Open profile">MA</button>
          </div>
        </header>

        <main>
          <section className="page-heading">
            <div>
              <p className="eyebrow">ORDER OPERATIONS</p>
              <h1>Orders</h1>
              <p>Review risk, prepare fulfillment, and track deliveries from one queue.</p>
            </div>
            <div className="heading-actions">
              <button className="button secondary"><Download size={16} />Export</button>
              <button className="button primary"><RefreshCw size={16} />Sync orders</button>
            </div>
          </section>

          <section className="metrics-band" aria-label="Order summary">
            <div><span>Open orders</span><strong>4</strong><small><Clock3 size={14} /> 1 needs review</small></div>
            <div><span>Open order value</span><strong>BDT 16,440</strong><small><CircleDollarSign size={14} /> Across COD and paid</small></div>
            <div><span>Ready to ship</span><strong>2</strong><small><PackageCheck size={14} /> BDT 5,670 ready</small></div>
            <div><span>Delivery rate</span><strong>94.2%</strong><small><Check size={14} /> Last 30 days</small></div>
          </section>

          <section className="orders-panel">
            <div className="view-tabs" role="tablist" aria-label="Order views">
              {viewLabels.map((view) => {
                const count = orders.filter((order) => view.key === 'all'
                  || (view.key === 'attention' && (order.risk === 'High' || order.fulfillment === 'Pending review'))
                  || (view.key === 'ready' && order.fulfillment === 'Ready to ship')
                  || (view.key === 'transit' && order.fulfillment === 'In transit')
                  || (view.key === 'delivered' && order.fulfillment === 'Delivered')).length;
                return <button key={view.key} className={activeView === view.key ? 'active' : ''} onClick={() => setActiveView(view.key)}>{view.label}<span>{count}</span></button>;
              })}
              <button className="add-view" aria-label="Add view">+</button>
            </div>

            <div className="toolbar">
              <label className="order-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, phone or location" /></label>
              <div className="toolbar-actions">
                <button className="button secondary"><Filter size={16} />Filters <span className="filter-count">2</span></button>
                <button className="button secondary">Newest first <ChevronDown size={15} /></button>
                <button className="icon-button bordered" aria-label="More table options"><Ellipsis size={18} /></button>
              </div>
            </div>

            {selected.length > 0 && (
              <div className="bulk-bar">
                <strong>{selected.length} selected</strong>
                <span />
                <button><Truck size={15} />Book courier</button>
                <button><FileText size={15} />Print invoice</button>
                <button>Update status <ChevronDown size={14} /></button>
                <button className="icon-button" aria-label="Clear selection" onClick={() => setSelected([])}><X size={17} /></button>
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="select-column"><input type="checkbox" aria-label="Select all orders" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? selected.filter((id) => !filteredOrders.some((order) => order.id === id)) : [...new Set([...selected, ...filteredOrders.map((order) => order.id)])])} /></th>
                    <th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Risk</th><th>Fulfillment</th><th>Total</th><th>Placed</th><th />
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className={selected.includes(order.id) ? 'selected' : ''} onClick={() => setFocusedOrder(order)}>
                      <td onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`Select ${order.id}`} checked={selected.includes(order.id)} onChange={() => toggleOrder(order.id)} /></td>
                      <td><button className="order-link" onClick={() => setFocusedOrder(order)}>{order.id}</button>{order.risk === 'High' && <span className="row-alert"><AlertTriangle size={13} />Review</span>}</td>
                      <td><strong>{order.customer}</strong><span>{order.location}</span></td>
                      <td><strong>{order.items}</strong><span>{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</span></td>
                      <td><strong>{order.payment}</strong><span>{order.payment === 'Paid' ? 'Online payment' : 'Collect on delivery'}</span></td>
                      <td><RiskBadge value={order.risk} /></td>
                      <td><StatusBadge value={order.fulfillment} />{order.courier && <span>{order.courier} · {order.tracking}</span>}</td>
                      <td className="amount">{money(order.total)}</td>
                      <td>{order.placed}</td>
                      <td><button className="icon-button" aria-label={`More actions for ${order.id}`} onClick={(event) => event.stopPropagation()}><Ellipsis size={18} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-order-list">
              {filteredOrders.map((order) => (
                <article key={order.id} onClick={() => setFocusedOrder(order)}>
                  <div className="mobile-order-top"><div><input type="checkbox" aria-label={`Select ${order.id}`} checked={selected.includes(order.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleOrder(order.id)} /><strong>{order.id}</strong></div><strong>{money(order.total)}</strong></div>
                  <div className="mobile-customer"><strong>{order.customer}</strong><span>{order.phone} · {order.location}</span></div>
                  <div className="mobile-badges"><StatusBadge value={order.fulfillment} /><RiskBadge value={order.risk} /></div>
                  <div className="mobile-order-bottom"><span>{order.items} · {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}</span><ChevronRight size={18} /></div>
                </article>
              ))}
            </div>

            <footer className="table-footer"><span>Showing {filteredOrders.length} of {orders.length} orders</span><div><button className="icon-button bordered" aria-label="Previous page"><ChevronLeft size={17} /></button><button className="page-number">1</button><button className="icon-button bordered" aria-label="Next page"><ChevronRight size={17} /></button></div></footer>
          </section>
        </main>
      </div>

      {focusedOrder && (
        <>
          <button className="drawer-scrim" aria-label="Close order details" onClick={() => setFocusedOrder(null)} />
          <aside className="order-drawer" aria-label={`Order ${focusedOrder.id} details`}>
            <header><div><span>ORDER</span><h2>{focusedOrder.id}</h2></div><button className="icon-button" aria-label="Close order details" onClick={() => setFocusedOrder(null)}><X size={20} /></button></header>
            <div className="drawer-status"><StatusBadge value={focusedOrder.fulfillment} /><RiskBadge value={focusedOrder.risk} /><span>{focusedOrder.placed}</span></div>
            <section><h3>Customer</h3><div className="detail-person"><div className="avatar small"><UserRound size={17} /></div><div><strong>{focusedOrder.customer}</strong><span>{focusedOrder.phone}</span><span>{focusedOrder.location}</span></div></div></section>
            <section><div className="section-heading"><h3>Items</h3><span>{focusedOrder.itemCount}</span></div><div className="item-line"><div className="item-thumb"><Box size={20} /></div><div><strong>{focusedOrder.items}</strong><span>Standard variant</span></div><strong>{money(focusedOrder.total)}</strong></div></section>
            <section><h3>Payment</h3><div className="totals"><span>Subtotal <strong>{money(focusedOrder.total)}</strong></span><span>Delivery <strong>BDT 0</strong></span><span className="grand-total">Total <strong>{money(focusedOrder.total)}</strong></span></div></section>
            <section><h3>Activity</h3><ol className="timeline"><li><i /><div><strong>Order received from WooCommerce</strong><span>{focusedOrder.placed}</span></div></li><li><i /><div><strong>Fraud screening completed</strong><span>{focusedOrder.risk === 'Unavailable' ? 'Provider response unavailable' : `${focusedOrder.risk} risk result`}</span></div></li></ol></section>
            <footer><button className="button secondary"><ExternalLink size={16} />Open in store</button><button className="button primary"><Truck size={16} />{focusedOrder.fulfillment === 'Delivered' ? 'View delivery' : 'Book courier'}</button></footer>
          </aside>
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
