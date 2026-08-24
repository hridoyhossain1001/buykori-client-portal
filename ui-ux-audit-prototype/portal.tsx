import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Box,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Code2,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Filter,
  Headphones,
  Info,
  KeyRound,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Menu,
  MessageSquareText,
  Monitor,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings as SettingsIcon,
  ShieldCheck,
  Smartphone,
  Store,
  Target,
  Trash2,
  Truck,
  Upload,
  UserRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import "./portal.css";
import { fetchLiveSnapshot, type LiveDeliveryLog, type LiveEvent, type LiveSnapshot } from "./liveAdapter";
import { fetchAiAdsAccess, fetchLiveAiAds, type LiveAiAds } from "./aiAdsAdapter";
import { makePrototypePage } from "./paginationState";

type Page =
  | "dashboard"
  | "orders"
  | "cod"
  | "checkouts"
  | "events"
  | "delivery"
  | "campaigns"
  | "aiads"
  | "setup"
  | "health"
  | "settings"
  | "account";
type SettingsSection = "store" | "tracking" | "ads" | "shipping" | "alerts";
type AiSection = "overview" | "accounts" | "campaigns" | "analytics" | "chat";

const routePage: Record<string, Page> = {
  "/dashboard": "dashboard",
  "/courier-shipping": "orders",
  "/cod-protection": "cod",
  "/incomplete-orders": "checkouts",
  "/event-logs": "events",
  "/api-logs": "delivery",
  "/campaign-tools": "campaigns",
  "/ai-ads": "aiads",
  "/ai-ads/accounts": "aiads",
  "/ai-ads/campaigns": "aiads",
  "/ai-ads/analytics": "aiads",
  "/ai-ads/chat": "aiads",
  "/setup-guide": "setup",
  "/setup-health": "health",
  "/settings/store-connection": "settings",
  "/settings/conversions-api": "settings",
  "/settings/ad-accounts": "settings",
  "/settings/courier-logistics": "settings",
  "/settings/alerts-notifications": "settings",
  "/account": "account",
};

const pagePath: Record<Page, string> = {
  dashboard: "/ui-ux-audit-prototype/?page=dashboard",
  orders: "/ui-ux-audit-prototype/?page=orders",
  cod: "/ui-ux-audit-prototype/?page=cod",
  checkouts: "/ui-ux-audit-prototype/?page=checkouts",
  events: "/ui-ux-audit-prototype/?page=events",
  delivery: "/ui-ux-audit-prototype/?page=delivery",
  campaigns: "/ui-ux-audit-prototype/?page=campaigns",
  aiads: "/ui-ux-audit-prototype/?page=aiads",
  setup: "/ui-ux-audit-prototype/?page=setup",
  health: "/ui-ux-audit-prototype/?page=health",
  settings: "/ui-ux-audit-prototype/?page=settings",
  account: "/ui-ux-audit-prototype/?page=account",
};

const pageMeta: Record<
  Page,
  { title: string; eyebrow: string; description: string }
> = {
  dashboard: {
    title: "Overview",
    eyebrow: "WORKSPACE",
    description:
      "A focused view of the signals that need your attention today.",
  },
  orders: {
    title: "Orders",
    eyebrow: "OPERATIONS",
    description:
      "Review risk, prepare fulfillment, and track deliveries from one queue.",
  },
  cod: {
    title: "COD review",
    eyebrow: "OPERATIONS",
    description:
      "Confirm real buyers before Purchase events reach your ad platforms.",
  },
  checkouts: {
    title: "Incomplete checkouts",
    eyebrow: "OPERATIONS",
    description: "Recover high-intent customers without losing context.",
  },
  events: {
    title: "Event activity",
    eyebrow: "TRACKING",
    description: "Inspect what arrived, where it went, and what needs a retry.",
  },
  delivery: {
    title: "Delivery logs",
    eyebrow: "TRACKING",
    description: "Monitor provider delivery health and failed requests.",
  },
  campaigns: {
    title: "Campaign tools",
    eyebrow: "GROWTH",
    description: "Build trackable links and test the events they produce.",
  },
  aiads: {
    title: "AI Ads",
    eyebrow: "GROWTH",
    description:
      "Plan, review, and approve advertising changes with guardrails.",
  },
  setup: {
    title: "Setup guide",
    eyebrow: "ADMINISTRATION",
    description: "Complete the essential connection steps for your store.",
  },
  health: {
    title: "Setup health",
    eyebrow: "ADMINISTRATION",
    description:
      "Resolve the issues that reduce tracking quality and attribution.",
  },
  settings: {
    title: "Settings",
    eyebrow: "ADMINISTRATION",
    description: "Configure connections, events, courier partners, and alerts.",
  },
  account: {
    title: "Account",
    eyebrow: "ADMINISTRATION",
    description: "Manage profile, security, plan, and billing details.",
  },
};

type Order = {
  id: string;
  customer: string;
  location: string;
  item: string;
  total: number;
  risk: string;
  status: string;
  age: string;
  payment: string;
  courier?: string;
  courierStatus?: "Not booked" | "Booked" | "In transit" | "Delivered" | "Booking failed";
  phone?: string;
  riskReason?: string;
  products?: Array<{ name: string; quantity: number; price: number; variant?: string }>;
};
// Audit remediation P1: "Not checked" was a dead end. The COD queue said "Fraud check has not run
// yet" -- true, but not a cause and nothing to act on -- the Orders table said nothing at all, and
// the order drawer asserted "Fraud screening completed · Not checked" in one breath. One helper owns
// the sentence now so all three read the same, and the unchecked case names why the check is missing
// instead of leaving the row stuck with no way forward.
const riskReason = (order: Pick<Order, "risk" | "riskReason">) =>
  order.riskReason ||
  (order.risk === "High risk"
    ? "IP mismatch · name signal"
    : order.risk === "Medium risk"
      ? "Address partly matched · no critical signal"
      : order.risk === "Not checked"
        ? "Screening timed out · provider did not answer"
        : "No critical signal");
const orderRows: Order[] = [
  {
    id: "WC-9284",
    customer: "Nusrat Jahan",
    location: "Dhanmondi, Dhaka",
    item: "Premium Linen Shirt",
    total: 4500,
    risk: "High risk",
    status: "Pending review",
    age: "Aug 20 · 22:40",
    payment: "COD",
    phone: "01812 349999",
    products: [{ name: "Premium Linen Shirt", quantity: 1, price: 4500, variant: "Linen / Large" }],
  },
  {
    id: "WC-9283",
    customer: "Rafi Ahmed",
    location: "Uttara, Dhaka",
    item: "Classic Oxford Shirt",
    total: 2490,
    risk: "Not checked",
    riskReason: "Screening timed out · provider did not answer in 30s",
    status: "Ready to ship",
    age: "Aug 21 · 05:35",
    payment: "COD",
    phone: "01711 234567",
    products: [{ name: "Classic Oxford Shirt", quantity: 1, price: 2490, variant: "White / 40" }],
  },
  {
    id: "WC-9279",
    customer: "Mahin Chowdhury",
    location: "Agrabad, Chattogram",
    item: "Everyday Polo",
    total: 6270,
    risk: "Low risk",
    status: "In transit",
    age: "Aug 20 · 19:12",
    payment: "Paid",
    phone: "01819 773311",
    products: [{ name: "Everyday Polo", quantity: 2, price: 3135, variant: "Navy / Mixed sizes" }],
    courier: "Pathao · PT-849201",
    courierStatus: "In transit",
  },
  {
    id: "WC-9276",
    customer: "Samia Rahman",
    location: "Zindabazar, Sylhet",
    item: "Relaxed Cotton Tee",
    total: 3180,
    risk: "Medium risk",
    status: "Ready to ship",
    age: "Aug 20 · 14:48",
    payment: "COD",
    phone: "01911 545454",
    products: [{ name: "Relaxed Cotton Tee", quantity: 2, price: 1590, variant: "Black / Medium" }],
  },
  {
    id: "WC-9268",
    customer: "Tanvir Islam",
    location: "Sonadanga, Khulna",
    item: "Essential Chino",
    total: 2890,
    risk: "Low risk",
    status: "Delivered",
    age: "Aug 17 · 11:20",
    payment: "Paid",
    phone: "01712 664422",
    products: [{ name: "Essential Chino", quantity: 1, price: 2890, variant: "Khaki / 34" }],
    courier: "Steadfast · SF-291044",
    courierStatus: "Delivered",
  },
];
const money = (n: number) => `BDT ${n.toLocaleString("en-BD")}`;
const courierDetails = (order: Pick<Order, "courier" | "courierStatus">) => {
  if (!order.courier) return { provider: "No courier assigned", tracking: "—", status: order.courierStatus || "Not booked" };
  const [provider, tracking] = order.courier.split(" · ");
  return { provider, tracking: tracking || "Tracking pending", status: order.courierStatus || "Booked" };
};

// Both bar charts used to render unlabelled bars with no scale, no values, and a bar
// count that did not match the stated period ("Last 7 days" drawn as 12 bars). These
// series carry their own labels so the axis, the scale, and the alt text agree.
const eventDeliveryTrend = [
  { label: "Aug 15", value: 498 },
  { label: "Aug 16", value: 542 },
  { label: "Aug 17", value: 476 },
  { label: "Aug 18", value: 613 },
  { label: "Aug 19", value: 588 },
  { label: "Aug 20", value: 651 },
  { label: "Aug 21", value: 624 },
];
const aiSpendTrend = [
  { label: "Jul 23–25", value: 1120 },
  { label: "Jul 26–28", value: 1380 },
  { label: "Jul 29–31", value: 1250 },
  { label: "Aug 1–3", value: 1610 },
  { label: "Aug 4–6", value: 1740 },
  { label: "Aug 7–9", value: 1890 },
  { label: "Aug 10–12", value: 2050 },
  { label: "Aug 13–15", value: 2210 },
  { label: "Aug 16–18", value: 2180 },
  { label: "Aug 19–21", value: 2570 },
];
// Audit remediation P2: both rows read "Premium Hoodie · Qty 1" at BDT 2,790 and BDT 4,250, so
// the same product carried two prices. Each row now has a unit price the amount derives from,
// and the products match the catalogue the Orders table uses. This lives at module scope so the
// sidebar badge counts the same queue the page renders. The Time column held "27 min ago" beside
// "Yesterday" -- two units in one column, and the relative one never aged -- so both are stamps now.
type Checkout = {
  id: string; name: string; phone: string; address: string; unitPrice: number;
  status: "Active" | "Contacted" | "Ignored" | "Recovered";
  source: string; lastActivity: string; today: boolean; item: string; quantity: number;
  recoveredOrderId?: string; syncState?: "synced" | "pending" | "failed";
};
const checkoutQueue: Checkout[] = [
  { id: "CHK-1048", name: "Rafi Ahmed", phone: "01711 234567", address: "Mirpur, Dhaka", unitPrice: 2790, status: "Active", source: "Facebook", lastActivity: "Aug 21 · 10:09", today: true, item: "Premium Hoodie", quantity: 1 },
  { id: "CHK-1041", name: "Nusrat Jahan", phone: "01812 349999", address: "Dhanmondi, Dhaka", unitPrice: 4500, status: "Contacted", source: "TikTok", lastActivity: "Aug 20 · 18:05", today: false, item: "Premium Linen Shirt", quantity: 1 },
];
// Audit remediation P2: the same fact was hard-coded with different values on different
// pages -- event allowance 50K vs 500K, tracking health 27% vs 93%, failed events 6 vs 1,
// failed delivery requests 6 vs 1, requests 103 vs 100. Pages now read these instead.
const workspaceMetrics = {
  setupChecks: 15,
  resolvedThisMonth: 6,
  // Audit remediation P2: 12,400 was labelled "this month" on Overview, "counted for Aug 1 –
  // Aug 31" on Billing and "tracked in the last 30 days" on Ad insights -- one number sold as
  // three different windows, and Ad insights divided it by a hardcoded 30 to get a daily
  // average. The window is month-to-date, stated once, and the day count travels with it.
  events: { used: 12400, limit: 500000, windowLabel: "Aug 1 – Aug 21, 2026", windowDays: 21 },
  // Derived from orderRows so the sidebar badge, the Overview action center and the Orders
  // metric strip cannot disagree. "Awaiting" used to be a hardcoded 5 beside an Orders page
  // that counted 4 open, and codPending a hardcoded 2 beside a queue built from the same rows.
  orders: {
    month: 26,
    awaiting: orderRows.filter((order) => order.status !== "Delivered").length,
    needsReview: orderRows.filter((order) => order.status === "Pending review").length,
    codPending: orderRows.filter((order) => order.payment === "COD" && (order.status === "Pending review" || order.risk === "Not checked")).length,
  },
  // COD review has a real denominator now: the false-purchase rate is skipped ÷ reviewed.
  cod: { confirmedThisMonth: 15, skippedThisMonth: 1 },
  // "Delivery rate 94.2% · Last 30 days" had no denominator anywhere on the page. Of the 26
  // orders this month, 4 are still open, so 22 shipments have concluded.
  delivery: { completed: 22, delivered: 21 },
  failedEvents: 1,
  requestsToday: 100,
  failedRequests: 1,
  retryAttempts: 2,
  destinations: { healthy: 2, total: 3 },
};
// Audit remediation P2: the store's own identity was typed out seven times -- the sidebar
// store switcher, the URL builder's base address, two Setup guide evidence lines, Settings →
// Store connection's plugin card and domain field, and Account → workspace facts. The
// heartbeat was the worst of it: "3 min ago" in one card, "3 minutes ago" in the card beside
// it and "3 min ago" again on Setup guide -- all relative, so all three were wrong the moment
// the tab sat open. One record, one absolute stamp.
const storeConnection = {
  workspace: "Buykori Demo Store",
  domain: "buykori-demo.com",
  // The domain field's own hint asks for "the canonical HTTPS domain" while the field held a
  // bare hostname, so the card contradicted its own instruction. Scheme included.
  siteUrl: "https://buykori-demo.com",
  shopUrl: "https://buykori-demo.com/shop",
  clientId: "clt_8f42c1",
  memberSince: "Feb 11, 2026",
  plugin: "Buykori AdSync",
  pluginVersion: "1.0.0",
  pluginSize: "184 KB",
  platform: "WooCommerce",
  wordpress: "WordPress 6.5",
  heartbeatAt: "Aug 21, 2026 · 10:44",
};
// Audit remediation P2: the COD hold settings lived only inside CodReview, so Settings →
// Tracking & events stated "Purchase events are held for review · Auto-confirm is currently
// off" as two literals. Turn the toggles the other way in the COD drawer and Settings still
// said the same thing. One record, lifted to App, read by both pages.
type CodProtection = { enabled: boolean; holdHours: string; autoConfirm: boolean };
const codProtectionDefaults: CodProtection = { enabled: true, holdHours: "24", autoConfirm: false };
// Audit remediation P3: Setup guide certified "6 events enabled · PageView through Purchase"
// while the routing table it describes ends on Lead, so the range excluded the last row it was
// counting. Both surfaces read the list, and the evidence names its endpoints.
const defaultTrackedEvents = ["PageView", "ViewContent", "AddToCart", "InitiateCheckout", "Purchase", "Lead"];
// Audit remediation P2: one `age` field fed a column headed "Placed" on Orders and a column headed
// "Waiting" on COD review, holding five values in three formats -- "12h ago", "12h ago",
// "Yesterday", "Yesterday", "Aug 17". A Placed column cannot say "12h ago" and a Waiting column
// cannot say "Aug 17", so each header was wrong about half its rows and the column could not be
// compared or sorted. `age` is the absolute placed-at stamp now, and the wait COD review needs is
// derived from it against the same notional clock the store heartbeat reports.
const stampToDate = (stamp: string) => {
  const [datePart, timePart] = stamp.split(" · ");
  return new Date(`${/\d{4}/.test(datePart) ? datePart.replace(",", "") : `${datePart} 2026`} ${timePart}`);
};
const waitingFor = (stamp: string) => {
  const minutes = Math.max(0, Math.round((stampToDate(storeConnection.heartbeatAt).getTime() - stampToDate(stamp).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
};
// Setup score is the share of setup checks that pass, so marking an issue fixed has to
// move it. It used to be a frozen "27%" beside a live issue list.
const setupScore = (openIssues: number) =>
  Math.round(((workspaceMetrics.setupChecks - openIssues) / workspaceMetrics.setupChecks) * 100);
// Account → Profile listed ops@buykori.com as the notification email while
// Settings → Alerts printed malcolmabbotte@gmail.com under the label "Account profile
// destination". One record, three named roles.
const contactEmails = {
  signIn: "malcolm@buykori.com",
  notifications: "ops@buykori.com",
  billing: "billing@buykori.com",
};
// Audit remediation P3: Ad insights → Tracking health printed one hardcoded "Aug 21, 2026 ·
// 10:42" under all three destinations, so a degraded destination and a healthy one claimed the
// same last delivery to the minute. Each destination carries its own stamp.
const platformDelivery = [
  { name: "Meta", key: "Meta CAPI", host: "graph.facebook.com", requests: 34, failed: 1, status: "Degraded", lastSync: "Aug 21, 2026 · 10:42" },
  { name: "TikTok", key: "TikTok Events API", host: "events.tiktok.com", requests: 33, failed: 0, status: "Healthy", lastSync: "Aug 21, 2026 · 10:39" },
  { name: "GA4", key: "GA4 Measurement", host: "www.google-analytics.com", requests: 33, failed: 0, status: "Healthy", lastSync: "Aug 21, 2026 · 10:41" },
];
// Shared so the Overview action center and the sidebar badge cannot drift from the list
// Setup health actually renders. The GA4 entry used to say "a destination is rejecting a
// portion of recent events", which contradicted GA4 showing 33 of 33 accepted.
// Audit remediation P1: an issue used to close on `Mark fixed` alone -- one click moved the badge
// to Resolved and pushed the tracking score up, with nothing checked. A setup score built from
// self-reported fixes is worse than no score, because it reads as verified. Closing an issue now
// runs a re-scan and the issue stays open unless that re-scan passes, so each `rescan` block below
// carries the evidence the check would report either way. Two of the four still fail, so the
// prototype shows both outcomes rather than a happy path.
const setupIssues = [
  {
    tone: "danger",
    title: "Purchase value is missing",
    platform: "Meta CAPI",
    detail: "Some Purchase events have no order value or currency.",
    impact: "Sales value and ROAS reporting become unreliable.",
    firstSeen: "Aug 18, 2026",
    evidence: "14% of Purchase events reached Meta with no order total · latest req_19204",
    rescan: {
      passes: false,
      checked: "Re-read the last 21 Purchase events sent to Meta",
      result: "3 of them still arrived with no order total",
      blocker: "Send order value and currency from the checkout, then re-scan.",
    },
  },
  {
    tone: "warning",
    title: "GA4 client ID is not passed on server events",
    platform: "GA4",
    detail: "Server-side GA4 events are sent without a client ID, so sessions do not join up.",
    impact: "GA4 counts these as new sessions instead of returning visitors.",
    firstSeen: "Aug 12, 2026",
    evidence: "Every server-side GA4 event since the destination was added",
    rescan: {
      passes: true,
      checked: "Re-read the last 40 server-side GA4 events",
      result: "All 40 carried a client ID",
    },
  },
  {
    tone: "warning",
    title: "Add to Cart may be counted twice",
    platform: "Browser + server",
    detail: "Review deduplication keys before scaling campaigns.",
    impact: "Duplicate events can inflate funnel and campaign results.",
    firstSeen: "Aug 19, 2026",
    evidence: "11 AddToCart pairs matched on the same order in 48 hours",
    rescan: {
      passes: true,
      checked: "Re-matched AddToCart pairs across the newest 48 hours",
      result: "No duplicate pairs found",
    },
  },
  {
    tone: "neutral",
    title: "TikTok match quality can improve",
    platform: "TikTok",
    detail: "Add more customer fields where consent allows.",
    impact: "Better matching can improve attribution quality.",
    firstSeen: "Jul 30, 2026",
    // Ad insights → Tracking health scores this 64% and Data quality lists Click IDs at 64%.
    // This line said "5.2 of 10", so the same check had two scores on two pages.
    evidence: "Match score 6.4 of 10 on the last TikTok sync",
    rescan: {
      passes: false,
      checked: "Re-read the match score from the newest TikTok sync",
      result: "Still 6.4 of 10 · unchanged since Jul 30",
      blocker: "Add phone or email to TikTok events where consent allows, then re-scan.",
    },
  },
];
// Audit remediation P2: three pages invented three campaign universes. Ad insights had
// "August Retargeting / cmp_meta_2048", AI Ads → Campaigns had "Summer retargeting" with a
// different spend and ROAS, and Campaign tools used provider IDs like 23861290481001 that
// appeared nowhere else. One workspace cannot have three campaign lists, so all three pages
// read this one. Provider IDs are the real ones a Meta/TikTok sync would return.
const adCampaigns = [
  { name: "August retargeting", id: "23861290481001", platform: "Meta", account: "Main Ads · •••1001", state: "Active", daily: 1200, spend: 7200, clicks: 486, placed: 18, confirmed: 14, revenue: 39200, status: "Strong", utm: "august_retargeting", creative: "retargeting_carousel_a" },
  { name: "New customer prospecting", id: "23861290481044", platform: "Meta", account: "Main Ads · •••1001", state: "Active", daily: 950, spend: 6100, clicks: 391, placed: 11, confirmed: 8, revenue: 21600, status: "Stable", utm: "new_customer_prospecting", creative: "prospecting_static_a" },
  // Audit remediation P3: Campaign tools defaulted Ad content to "hoodie_video_a" while the
  // selected campaign was Meta's August retargeting -- a TikTok creative name on a Meta link.
  // Each campaign names its own creative and the Ad content field follows the selection.
  { name: "Hoodie video conversions", id: "18374629004421", platform: "TikTok", account: "Buykori TikTok · •••4417", state: "Paused", daily: 0, spend: 4700, clicks: 363, placed: 9, confirmed: 5, revenue: 12500, status: "Watch", utm: "hoodie_video_conversions", creative: "hoodie_video_a" },
];
const sum = (pick: (c: (typeof adCampaigns)[number]) => number) => adCampaigns.reduce((total, c) => total + pick(c), 0);
// Every ad total on Ad insights and AI Ads is derived, so a campaign edit cannot leave a
// stale KPI tile behind. AD COST used to read "Last 7 days" here and "Last 30 days" on
// AI Ads while both showed 18,000 -- the window is 30 days, stated once.
const adTotals = {
  window: "Last 30 days",
  windowRange: "Jul 23 – Aug 21, 2026",
  // Two panels on Ad insights said "12 min ago", which stops being true the moment the tab
  // sits open. One absolute stamp, read by both.
  syncedAt: "Aug 21, 2026 · 10:18",
  spend: sum((c) => c.spend),
  clicks: sum((c) => c.clicks),
  placed: sum((c) => c.placed),
  confirmed: sum((c) => c.confirmed),
  revenue: sum((c) => c.revenue),
};
// Audit remediation P1: the comparison select offered "Previous period" and "Previous year"
// while not one panel rendered a single delta, and the Business results heading still claimed
// "vs previous period". Either the control does something or it should not be there, so the
// baselines it compares against live here and the strip renders the change.
const adBaselines = {
  "Previous period": { label: "Jun 23 – Jul 22, 2026", spend: 15400, placed: 31, confirmed: 22, revenue: 58900 },
  "Previous year": { label: "Jul 23 – Aug 21, 2025", spend: 4200, placed: 9, confirmed: 6, revenue: 14800 },
} as const;
// Non-ad sales sit outside adTotals, so the Sales source tab can add up to a real store
// total instead of contradicting the ad-attributed figures beside it.
const otherSales = [
  { label: "Direct", visitors: 620, orders: 7, revenue: 14700, detail: "Typed URL and saved links" },
  { label: "Organic search", visitors: 410, orders: 4, revenue: 8900, detail: "Google and other search" },
  { label: "Unattributed", visitors: 110, orders: 1, revenue: 3100, detail: "Campaign source unavailable" },
];
const storeTotals = {
  visitors: 2480,
  paidVisitors: 2480 - otherSales.reduce((t, s) => t + s.visitors, 0),
  orders: adTotals.confirmed + otherSales.reduce((t, s) => t + s.orders, 0),
  revenue: adTotals.revenue + otherSales.reduce((t, s) => t + s.revenue, 0),
  unattributedOrders: 1,
};
// Audit remediation P2: Ad insights → Customers carried its own copies of the funnel columns as
// four hardcoded arrays with a hardcoded footer, so the area table and the Customer journey
// funnel could disagree about the same store. The area rows are the source for both now.
const areaRows = [
  { area: "Dhaka", visitors: 1280, views: 940, carts: 217, checkouts: 31, orders: 25, revenue: 62000 },
  { area: "Chattogram", visitors: 620, views: 455, carts: 105, checkouts: 15, orders: 7, revenue: 18400 },
  { area: "Sylhet", visitors: 410, views: 270, carts: 62, checkouts: 9, orders: 4, revenue: 11300 },
  { area: "Khulna", visitors: 170, views: 155, carts: 36, checkouts: 5, orders: 3, revenue: 8300 },
].map((row) => ({ ...row, share: Math.round((row.revenue / storeTotals.revenue) * 1000) / 10 }));
const areaTotal = (pick: (row: (typeof areaRows)[number]) => number) => areaRows.reduce((total, row) => total + pick(row), 0);
// Audit remediation P2: Ad insights' funnel claimed 168 checkouts started against 39 confirmed
// orders -- 129 abandoned in a month -- while Incomplete checkouts held two rows. Both pages
// read these numbers now, and the queue states why it is shorter than the gap.
const checkoutFunnel = {
  started: areaTotal((row) => row.checkouts),
  window: "last 30 days",
  abandoned: areaTotal((row) => row.checkouts) - storeTotals.orders,
  recoverable: "Only abandoned checkouts that left a phone number enter this queue.",
  reachesQueue: "Only the ones that left a phone number reach the Incomplete checkouts queue.",
};
const unattributed = otherSales.find((source) => source.label === "Unattributed")!;
// Audit remediation P1: AI Ads proposed "Pause campaign · August retargeting" -- the workspace's
// strongest campaign at 5.44x, badged "Strong" on Ad insights and on AI Ads' own Campaigns tab.
// The proposal targets the weakest still-running campaign now and shows the numbers behind it.
const roasOf = (campaign: (typeof adCampaigns)[number]) => campaign.revenue / campaign.spend;
const weakestActive = adCampaigns.filter((c) => c.state === "Active").sort((a, b) => roasOf(a) - roasOf(b))[0];
const strongest = adCampaigns.reduce((best, c) => (roasOf(c) > roasOf(best) ? c : best));
const adProposal = {
  campaign: weakestActive,
  action: "Reduce daily budget",
  dailyAfter: Math.round((weakestActive.daily * 0.6) / 50) * 50,
  hash: "7f3c9ab1…d42e08",
  reason: `Return is ${roasOf(weakestActive).toFixed(2)}x against ${roasOf(strongest).toFixed(2)}x on ${strongest.name} over the same window, and daily spend is above the reviewed ceiling.`,
};

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`p-badge ${tone}`}>{children}</span>;
}
function Button({
  children,
  kind = "secondary",
  icon,
  onClick,
  className = "",
  label,
  disabled,
}: {
  children?: React.ReactNode;
  kind?: "primary" | "secondary" | "quiet" | "danger";
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  /** Accessible name. Required when the button renders an icon with no text. */
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`p-button ${kind} ${className}`}
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
    >
      {icon}
      {children}
    </button>
  );
}
// Audit remediation P1: six tab strips, six different levels of wrong. Five were plain <button>s with
// a visual `.active` class and nothing else, so a screen reader heard "Ad results, button" with no hint
// that it was one of four choices or which one was on. Campaign tools was worse than none: it declared
// `role="tablist"` while its children never claimed `role="tab"`, which is an invalid structure -- a
// tablist reporting zero tabs. Settings put `aria-label` on a bare <div>, where it is dropped.
// One component owns the pattern now, so it cannot drift again, and it brings the keyboard behaviour
// the roles imply: one Tab stop for the whole strip, arrows to move, Home/End to jump. Orders has
// eight view tabs -- a keyboard user used to press Tab eight times to get past them to the toolbar.
const tabSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
function Tabs({
  items,
  value,
  onChange,
  label,
  className = "section-tabs",
  panelId,
}: {
  items: Array<{ id: string; label: React.ReactNode }>;
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
  panelId?: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const step = (event: React.KeyboardEvent, index: number) => {
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = items[(next + items.length) % items.length];
    onChange(target.id);
    refs.current[target.id]?.focus();
  };
  return (
    <div className={className} role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={panelId ? `${panelId}-tab-${tabSlug(item.id)}` : undefined}
          ref={(node) => { refs.current[item.id] = node; }}
          aria-selected={value === item.id}
          aria-controls={panelId}
          tabIndex={value === item.id ? 0 : -1}
          className={value === item.id ? "active" : ""}
          onKeyDown={(event) => step(event, index)}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`p-panel ${className}`}>{children}</section>;
}
function MetricStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    hint: string;
    icon?: React.ReactNode;
  }>;
}) {
  return (
    <section className="metric-strip">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>
            {item.icon}
            {item.hint}
          </small>
        </div>
      ))}
    </section>
  );
}
function PageHeader({
  page,
  action,
}: {
  page: Page;
  action?: React.ReactNode;
}) {
  const meta = pageMeta[page];
  return (
    <section className="page-heading">
      <div>
        <p className="eyebrow">{meta.eyebrow}</p>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      {action && <div className="heading-actions">{action}</div>}
    </section>
  );
}
function SectionTitle({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}
function IntegrationStateNote({
  scope,
  source,
  freshness = "Sample data · last synced Aug 21, 10:42",
}: {
  scope: string;
  source: string;
  freshness?: string;
}) {
  return <div className="integration-state-note" role="note"><span className="integration-state-dot" aria-hidden="true" /><span><strong>Prototype data boundary</strong><small>{scope} · {source} · {freshness}</small></span></div>;
}

function PaginationControls({
  page,
  pageSize,
  total,
  historyMayBeIncomplete = true,
  onPageChange,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  historyMayBeIncomplete?: boolean;
  onPageChange: (page: number) => void;
  noun: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  return (
    <footer className="pagination-bar" aria-label={`${noun} pagination`}>
      <span>Showing {start}–{end} of {historyMayBeIncomplete ? "at least " : ""}{total} {noun}{historyMayBeIncomplete && <small className="pagination-boundary">History may be incomplete until the live API returns total/hasMore metadata.</small>}</span>
      <div>
        <button type="button" className="icon-button bordered" aria-label={`Previous ${noun} page`} disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}><ChevronLeft size={16} /></button>
        {pages.map((number) => <button type="button" key={number} className={number === safePage ? "page-number" : "page-number secondary"} aria-label={`${noun} page ${number}`} aria-current={number === safePage ? "page" : undefined} onClick={() => onPageChange(number)}>{number}</button>)}
        <button type="button" className="icon-button bordered" aria-label={`Next ${noun} page`} disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)}><ChevronRight size={16} /></button>
      </div>
    </footer>
  );
}
function Status({ value }: { value: string }) {
  const tone =
    value.includes("High") ||
    value.includes("Failed") ||
    value.includes("Critical")
      ? "danger"
      : value.includes("Medium") ||
          value.includes("Pending") ||
          value.includes("Warning") ||
          value.includes("Retry")
        ? "warning"
        : value.includes("Delivered") ||
            value.includes("Ready") ||
            value.includes("Low") ||
            value.includes("Connected") ||
            value.includes("Healthy") ||
            value.includes("Paid")
          ? "success"
          : value.includes("Transit") || value.includes("200")
            ? "info"
            : "neutral";
  return <Badge tone={tone}>{value}</Badge>;
}

/**
 * Makes a whole card operable as the button it already looks like. The mobile
 * lists put the click handler on the card itself and have no inner trigger, so
 * without this their detail drawer is mouse-only.
 */
function cardButtonProps(open: () => void) {
  return {
    role: "button",
    tabIndex: 0,
    onClick: open,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      // Space would scroll the page and Enter can submit an ancestor form.
      event.preventDefault();
      open();
    },
  };
}

/**
 * Takes everything outside `panel` out of the tab order, away from the pointer,
 * and out of the accessibility tree, then locks background scroll. Returns the
 * undo function. A keyboard trap alone only corrects the first/last boundary,
 * so the background stays reachable without this. Only elements marked here are
 * unmarked afterwards, so anything already inert for its own reasons — the
 * off-canvas sidebar — keeps the state React gave it.
 */
function lockBackground(panel: HTMLElement | null) {
  const inerted: HTMLElement[] = [];
  for (let node = panel; node?.parentElement; ) {
    const parent = node.parentElement;
    for (const child of Array.from(parent.children)) {
      if (child === node || !(child instanceof HTMLElement)) continue;
      // Scrims stay live: inert would swallow their click-to-close.
      if (child.classList.contains("drawer-scrim")) continue;
      if (child.classList.contains("nav-scrim")) continue;
      if (child.hasAttribute("inert")) continue;
      child.setAttribute("inert", "");
      inerted.push(child);
    }
    if (parent === document.body) break;
    node = parent;
  }
  const { body } = document;
  const previousOverflow = body.style.overflow;
  const previousPadding = body.style.paddingRight;
  // Compensate for the vanishing scrollbar so the page does not jump.
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  body.style.overflow = "hidden";
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
  return () => {
    for (const node of inerted) node.removeAttribute("inert");
    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPadding;
  };
}

/**
 * Shared modal behaviour for every drawer and dialog in the portal:
 * moves focus in, traps Tab, closes on Escape, locks background scroll, and
 * returns focus to whatever opened the overlay. Mount the component only while
 * the overlay is open — this hook keys its whole lifecycle off mount/unmount.
 */
function useDialogA11y<T extends HTMLElement>(close: () => void) {
  const panelRef = useRef<T | null>(null);
  // Call sites pass inline arrows, so keep the latest close in a ref instead of
  // a dependency: re-running the effect would steal focus on every render.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const panel = panelRef.current;
    const restoreTo = document.activeElement as HTMLElement | null;
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          ).filter((node) => node.getClientRects().length > 0)
        : [];
    (focusables()[0] ?? panel)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    const unlockBackground = lockBackground(panel);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      unlockBackground();
      restoreTo?.focus?.();
    };
  }, []);
  return panelRef;
}

function Drawer({
  eyebrow,
  title,
  className = "",
  close,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  className?: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useDialogA11y<HTMLElement>(close);
  return (
    <>
      <div className="drawer-scrim" onClick={close} aria-hidden="true" />
      <aside
        ref={panelRef}
        className={`order-drawer ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header>
          <div>
            <span>{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={close}
            aria-label="Close panel"
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </aside>
    </>
  );
}

function ConfirmDialog({
  title,
  children,
  close,
  actions,
}: {
  title: string;
  children?: React.ReactNode;
  close: () => void;
  actions: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useDialogA11y<HTMLDivElement>(close);
  return (
    <div className="confirm-overlay" onClick={close}>
      <div
        ref={panelRef}
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
        <div>{actions}</div>
      </div>
    </div>
  );
}

/** True while the sidebar behaves as an overlay drawer instead of a fixed rail. */
function useIsMobileNav() {
  const query = "(max-width: 760px)";
  const [isMobileNav, setIsMobileNav] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setIsMobileNav(list.matches);
    list.addEventListener("change", onChange);
    onChange();
    return () => list.removeEventListener("change", onChange);
  }, []);
  return isMobileNav;
}

function Sidebar({
  page,
  go,
  mobileOpen,
  close,
  openSetupIssues,
  openCheckouts,
}: {
  page: Page;
  go: (p: Page) => void;
  mobileOpen: boolean;
  close: () => void;
  /** Open Setup health issues, so the badge cannot outlive a "Mark fixed" click. */
  openSetupIssues: number;
  /** Checkouts still awaiting recovery, so the badge cannot outlive a "Create draft order". */
  openCheckouts: number;
}) {
  const groups: Array<{
    label: string;
    items: Array<{
      page: Page;
      label: string;
      icon: React.ReactNode;
      count?: string;
    }>;
  }> = [
    {
      label: "OPERATIONS",
      items: [
        {
          page: "dashboard",
          label: "Overview",
          icon: <LayoutDashboard size={17} />,
        },
        {
          page: "orders",
          label: "Orders",
          icon: <ClipboardList size={17} />,
          count: String(workspaceMetrics.orders.awaiting),
        },
        {
          page: "cod",
          label: "COD review",
          icon: <ShieldCheck size={17} />,
          count: String(workspaceMetrics.orders.codPending),
        },
        {
          page: "checkouts",
          label: "Incomplete checkouts",
          icon: <MessageSquareText size={17} />,
          count: openCheckouts ? String(openCheckouts) : undefined,
        },
      ],
    },
    {
      label: "TRACKING",
      items: [
        {
          page: "events",
          label: "Event activity",
          icon: <Activity size={17} />,
        },
        { page: "delivery", label: "Delivery logs", icon: <Send size={17} /> },
        {
          page: "health",
          label: "Setup health",
          icon: <Zap size={17} />,
          count: openSetupIssues ? String(openSetupIssues) : undefined,
        },
      ],
    },
    {
      label: "GROWTH",
      items: [
        {
          page: "campaigns",
          label: "Campaign tools",
          icon: <Target size={17} />,
        },
        {
          page: "aiads",
          label: "AI Ads",
          icon: <BriefcaseBusiness size={17} />,
        },
      ],
    },
    {
      label: "ADMINISTRATION",
      items: [
        { page: "setup", label: "Setup guide", icon: <BookOpen size={17} /> },
        {
          page: "settings",
          label: "Settings",
          icon: <SettingsIcon size={17} />,
        },
        { page: "account", label: "Account", icon: <UserRound size={17} /> },
      ],
    },
  ];
  const isMobileNav = useIsMobileNav();
  const drawerActive = isMobileNav && mobileOpen;
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!drawerActive) return;
    const panel = panelRef.current;
    const restoreTo = document.activeElement as HTMLElement | null;
    const focusables = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>("button:not([disabled])"),
          ).filter((node) => node.getClientRects().length > 0)
        : [];
    (focusables()[0] ?? panel)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    const unlockBackground = lockBackground(panel);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      unlockBackground();
      restoreTo?.focus?.();
    };
  }, [drawerActive]);
  return (
    <>
      <aside
        ref={panelRef}
        id="portal-navigation"
        className={`portal-sidebar ${mobileOpen ? "open" : ""}`}
        // Off-canvas but still rendered: keep its 16 controls out of the tab
        // order and out of the accessibility tree while it is hidden.
        inert={isMobileNav && !mobileOpen}
        role={drawerActive ? "dialog" : undefined}
        aria-modal={drawerActive ? true : undefined}
        aria-label={drawerActive ? "Main navigation" : undefined}
        tabIndex={drawerActive ? -1 : undefined}
      >
        <div className="brand-row">
          <div className="brand-mark">B</div>
          <div>
            <strong>Buykori</strong>
            <span>AdSync</span>
          </div>
          <button
            type="button"
            className="sidebar-close icon-button"
            onClick={close}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <button type="button" className="store-switch">
          <span className="store-icon">
            <Store size={17} />
          </span>
          <span>
            <small>ACTIVE STORE</small>
            <strong>{storeConnection.workspace}</strong>
            <em>{storeConnection.domain}</em>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav className="portal-nav" aria-label="Portal sections">
          {groups.map((group) => (
            <div key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.page}
                  type="button"
                  className={page === item.page ? "active" : ""}
                  aria-current={page === item.page ? "page" : undefined}
                  onClick={() => {
                    go(item.page);
                    close();
                  }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.count && (
                    <b>
                      <span className="sr-only">Pending: </span>
                      {item.count}
                    </b>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="usage-mini">
          <span>EVENTS USAGE</span>
          <strong>
            12.4K <small>/ {workspaceMetrics.events.limit / 1000}K events</small>
          </strong>
          <div>
            <i style={{ width: `${Math.max(2, Math.round((workspaceMetrics.events.used / workspaceMetrics.events.limit) * 100))}%` }} />
          </div>
          <em>{Math.round((workspaceMetrics.events.used / workspaceMetrics.events.limit) * 1000) / 10}% used · resets Sep 1</em>
        </div>
        <button
          type="button"
          className="profile-chip"
          onClick={() => go("account")}
        >
          <span className="avatar" aria-hidden="true">
            MA
          </span>
          <span>
            <strong>Malcolm Abbott</strong>
            <small>{billingProfile.plan} plan · Owner</small>
          </span>
          <Ellipsis size={17} />
        </button>
      </aside>
      {mobileOpen && (
        <div className="nav-scrim" onClick={close} aria-hidden="true" />
      )}
    </>
  );
}

// Audit remediation P1: the search box, the bell and the avatar were all decorative -- no
// onClick, no popup, no focus move -- while the bell still advertised "3 unread". Each one
// now opens a real menu built from the same sample data the pages use.
const topbarAlerts: Array<{ page: Page; title: string; detail: string; when: string; tone: "danger" | "warning" | "info" }> = [
  // Audit remediation P3: three alerts, three time formats -- "38 min ago", "1h ago", "Yesterday" --
  // and the middle one described the same Meta rejection that Delivery logs and Event activity date
  // to the minute, so the notification tray could not be reconciled with either page. Stamps now,
  // tied to that incident: 09:35 is when the Purchase was rejected first, 10:42 the latest retry.
  // "Next charge in 3 days" was arithmetic frozen against Aug 24, true only while today is Aug 21.
  { page: "health", title: "Purchase value is missing", detail: "Meta CAPI is receiving Purchase events without an order value.", when: "Aug 21 · 09:35", tone: "danger" },
  { page: "events", title: "1 event failed to deliver", detail: "HTTP 400 from Meta CAPI · retried twice so far.", when: "Aug 21 · 10:42", tone: "warning" },
  { page: "account", title: "Next charge is due Aug 24", detail: "BDT 799 on Aug 24, 2026 via bKash •••• 4821.", when: "Aug 20 · 09:02", tone: "info" },
];

function Topbar({
  page,
  openMenu,
  mobileOpen,
  go,
}: {
  page: Page;
  openMenu: () => void;
  mobileOpen: boolean;
  go: (p: Page) => void;
}) {
  const [menu, setMenu] = useState<"" | "search" | "alerts" | "account">("");
  const [query, setQuery] = useState("");
  const [readAlerts, setReadAlerts] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const wrap = useRef<HTMLDivElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const unread = topbarAlerts.filter((alert) => !readAlerts.includes(alert.title)).length;
  const pages = (Object.keys(pageMeta) as Page[]).filter((key) =>
    `${pageMeta[key].title} ${pageMeta[key].eyebrow} ${pageMeta[key].description}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const close = () => { setMenu(""); setQuery(""); };
  const open = (next: "search" | "alerts" | "account") => setMenu((current) => (current === next ? "" : next));
  const jump = (next: Page) => { close(); go(next); };
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); };
  useEffect(() => {
    if (menu === "search") searchInput.current?.focus();
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: MouseEvent) => { if (wrap.current && !wrap.current.contains(event.target as Node)) close(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menu]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setMenu("search"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <header className="portal-topbar">
      <button
        type="button"
        className="mobile-menu icon-button"
        onClick={openMenu}
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        aria-controls="portal-navigation"
      >
        <Menu size={20} />
      </button>
      <div className="crumbs">
        <span>Buykori workspace</span>
        <ChevronRight size={14} aria-hidden="true" />
        <strong>{pageMeta[page].title}</strong>
      </div>
      <div className="topbar-actions" ref={wrap}>
        <div className="topbar-menu-wrap">
          <button
            type="button"
            className="workspace-search"
            onClick={() => open("search")}
            aria-haspopup="dialog"
            aria-expanded={menu === "search"}
            aria-controls="topbar-search-panel"
          >
            <Search size={16} aria-hidden="true" />
            <span>Search workspace</span>
            <kbd>Ctrl K</kbd>
          </button>
          {menu === "search" && (
            <div className="topbar-panel search-panel" id="topbar-search-panel" role="dialog" aria-label="Search workspace">
              <label className="field-search">
                <Search size={15} aria-hidden="true" />
                <input
                  ref={searchInput}
                  value={query}
                  placeholder="Search pages, orders, settings"
                  aria-label="Search workspace"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && pages[0]) jump(pages[0]); }}
                />
              </label>
              <p className="topbar-panel-note">Page search only in this preview. Order and customer search lives on the Orders page.</p>
              {pages.length === 0 ? (
                <div className="empty-state">
                  <Search size={22} />
                  <strong>No page matches “{query}”</strong>
                  <span>Try “orders”, “billing”, “courier”, or “events”.</span>
                </div>
              ) : (
                <div className="topbar-result-list">
                  {pages.map((key) => (
                    <button key={key} type="button" onClick={() => jump(key)}>
                      <span>
                        <strong>{pageMeta[key].title}</strong>
                        <small>{pageMeta[key].eyebrow}</small>
                      </span>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="topbar-menu-wrap">
          <button
            type="button"
            className="icon-button"
            aria-label={unread ? `Notifications, ${unread} unread` : "Notifications, all read"}
            aria-haspopup="dialog"
            aria-expanded={menu === "alerts"}
            aria-controls="topbar-alerts-panel"
            onClick={() => open("alerts")}
          >
            <Bell size={18} />
            {unread > 0 && <i aria-hidden="true" />}
          </button>
          {menu === "alerts" && (
            <div className="topbar-panel alerts-panel" id="topbar-alerts-panel" role="dialog" aria-label="Notifications">
              <div className="topbar-panel-head">
                <strong>Notifications</strong>
                <button type="button" onClick={() => setReadAlerts(topbarAlerts.map((alert) => alert.title))} disabled={unread === 0}>
                  Mark all read
                </button>
              </div>
              <div className="topbar-alert-list">
                {topbarAlerts.map((alert) => (
                  <button key={alert.title} type="button" className={readAlerts.includes(alert.title) ? "read" : ""} onClick={() => { setReadAlerts((items) => items.includes(alert.title) ? items : [...items, alert.title]); jump(alert.page); }}>
                    <span className={`alert-dot ${alert.tone}`} aria-hidden="true" />
                    <span>
                      <strong>{alert.title}</strong>
                      <small>{alert.detail}</small>
                      <em>{alert.when} · {readAlerts.includes(alert.title) ? "Read" : "Unread"} · opens {pageMeta[alert.page].title}</em>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
              <p className="topbar-panel-note">Alert routing and quiet hours are configured in Settings → Alerts &amp; notifications.</p>
            </div>
          )}
        </div>
        <div className="topbar-menu-wrap">
          <button
            type="button"
            className="avatar-button"
            aria-label="Account menu for Malcolm Abbott"
            aria-haspopup="menu"
            aria-expanded={menu === "account"}
            aria-controls="topbar-account-panel"
            onClick={() => open("account")}
          >
            MA
          </button>
          {menu === "account" && (
            <div className="topbar-panel account-panel" id="topbar-account-panel" role="menu" aria-label="Account menu">
              <div className="topbar-identity">
                <span className="avatar" aria-hidden="true">MA</span>
                <span>
                  <strong>Malcolm Abbott</strong>
                  <small>{contactEmails.signIn}</small>
                  <em>Owner · Growth plan</em>
                </span>
              </div>
              <div className="topbar-result-list">
                <button type="button" role="menuitem" onClick={() => jump("account")}><span><strong>Account &amp; profile</strong><small>Name, email, time zone</small></span><ChevronRight size={15} /></button>
                <button type="button" role="menuitem" onClick={() => jump("account")}><span><strong>Plan &amp; billing</strong><small>Growth · BDT 799 monthly</small></span><ChevronRight size={15} /></button>
                <button type="button" role="menuitem" onClick={() => jump("settings")}><span><strong>Workspace settings</strong><small>Connections, events, couriers</small></span><ChevronRight size={15} /></button>
                <button type="button" role="menuitem" onClick={() => { close(); flash("Sign out is not connected in this design preview."); }}><span><strong>Sign out</strong><small>Not connected in this preview</small></span><ChevronRight size={15} /></button>
              </div>
            </div>
          )}
        </div>
      </div>
      {notice && <div className="inline-preview-feedback topbar-feedback"><Check size={15} />{notice}</div>}
    </header>
  );
}

function Dashboard({ go, openSetupIssues, liveDashboard }: { go: (p: Page) => void; openSetupIssues: number; liveDashboard?: LiveSnapshot["dashboard"] }) {
  const eventsUsed = liveDashboard?.eventsUsed ?? workspaceMetrics.events.used;
  const eventsLimit = liveDashboard?.eventsLimit ?? workspaceMetrics.events.limit;
  const ordersThisMonth = liveDashboard?.ordersThisMonth ?? workspaceMetrics.orders.month;
  const destinationsHealthy = liveDashboard?.destinationsHealthy ?? workspaceMetrics.destinations.healthy;
  const destinationsTotal = liveDashboard?.destinationsTotal ?? workspaceMetrics.destinations.total;
  const codPending = liveDashboard?.codPending ?? workspaceMetrics.orders.codPending;
  const failedEvents = liveDashboard?.failedEvents ?? workspaceMetrics.failedEvents;
  const trend = liveDashboard?.trend ?? eventDeliveryTrend;
  const platforms = liveDashboard?.platformDelivery ?? platformDelivery;
  const trendMax = Math.max(1, ...trend.map((point) => point.value));
  const trendTotal = trend.reduce((sum, point) => sum + point.value, 0);
  const trendPeak = trend.reduce((peak, point) => point.value > peak.value ? point : peak, trend[0] ?? { label: "No date", value: 0 });
  const eventsUsageHint = eventsLimit > 0 ? `${Math.round((eventsUsed / eventsLimit) * 1000) / 10}% of ${eventsLimit / 1000}K included` : "Usage quota unavailable in this read";
  return (
    <>
      <PageHeader
        page="dashboard"
        action={
          <Button kind="primary" icon={<RefreshCw size={15} />}>
            Refresh workspace
          </Button>
        }
      />
      <MetricStrip
        items={[
          {
            label: "Tracking health",
            value: `${setupScore(openSetupIssues)}%`,
            hint: `${openSetupIssues} of ${workspaceMetrics.setupChecks} setup checks need attention`,
            icon: <AlertTriangle size={14} />,
          },
          {
            label: "Events this month",
            value: eventsUsed.toLocaleString("en-BD"),
            hint: eventsUsageHint,
            icon: <Activity size={14} />,
          },
          {
            label: "Orders this month",
            value: String(ordersThisMonth),
            hint: liveDashboard ? "Loaded from the tenant order ledger" : `${workspaceMetrics.orders.awaiting} awaiting action`,
            icon: <ClipboardList size={14} />,
          },
          {
            label: "Destinations",
            value: `${destinationsHealthy} / ${destinationsTotal}`,
            hint: "Healthy connections",
            icon: <Link2 size={14} />,
          },
        ]}
      />
      <div className="dashboard-grid">
        <Panel>
          <SectionTitle
            title="Action center"
            detail="The next useful actions for your team"
          />
          <div className="action-list">
            <button onClick={() => go("cod")}>
              <span className="action-icon amber">
                <ShieldCheck size={18} />
              </span>
              <span>
              <strong>{codPending} COD orders need review</strong>
                <small>Confirm or skip pending purchase events</small>
              </span>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => go("health")}>
              <span className="action-icon blue">
                <Zap size={18} />
              </span>
              <span>
                <strong>
                  {openSetupIssues === 0
                    ? `All ${workspaceMetrics.setupChecks} setup checks pass`
                    : `${openSetupIssues} setup item${openSetupIssues === 1 ? "" : "s"} need${openSetupIssues === 1 ? "s" : ""} attention`}
                </strong>
                <small>{openSetupIssues === 0 ? "Nothing to fix right now" : "Resolve issues reducing delivery quality"}</small>
              </span>
              <ChevronRight size={17} />
            </button>
            <button onClick={() => go("events")}>
              <span className="action-icon green">
                <Activity size={18} />
              </span>
              <span>
                <strong>
                  {failedEvents} failed event{failedEvents === 1 ? "" : "s"} need
                  {failedEvents === 1 ? "s" : ""} review
                </strong>
                <small>Inspect details and retry safely</small>
              </span>
              <ChevronRight size={17} />
            </button>
          </div>
        </Panel>
        <Panel>
          <SectionTitle
            title="Event delivery"
            detail="Last 7 days"
            action={
              <Button kind="quiet">
                Last 7 days <ChevronDown size={14} />
              </Button>
            }
          />
          <div className="chart-placeholder">
            <div className="chart-plot">
              <div
                className="chart-bars"
                role="img"
                aria-label={`Events delivered per day across ${trend.length} days. ${trendTotal.toLocaleString("en-BD")} delivered; peak ${trendPeak.value.toLocaleString("en-BD")} on ${trendPeak.label}.`}
              >
                {trend.map((point) => (
                  <i key={point.label} style={{ height: `${Math.round((point.value / trendMax) * 100)}%` }} title={`${point.label}: ${point.value.toLocaleString("en-BD")} events`} />
                ))}
              </div>
              <div className="chart-scale" aria-hidden="true">
                <span>800</span>
                <span>400</span>
                <span>0</span>
              </div>
            </div>
            <div className="chart-axis">
              <span>{trend[0]?.label ?? "-"}</span>
              <span>{trend[Math.floor(trend.length / 2)]?.label ?? "-"}</span>
              <span>{trend[trend.length - 1]?.label ?? "-"}</span>
            </div>
            <p className="chart-caption">Events delivered per day · {trendTotal.toLocaleString("en-BD")} this week, peak {trendPeak.value.toLocaleString("en-BD")} on {trendPeak.label}</p>
          </div>
        </Panel>
        <Panel className="span-2">
          <SectionTitle
            title="Tracking health"
            detail="Platform delivery at a glance"
            action={
              <Button kind="quiet" onClick={() => go("settings")}>
                Manage connections <ChevronRight size={14} />
              </Button>
            }
          />
          <div className="platform-rows">
            {platforms.map((platform) => (
              <button key={platform.name} onClick={() => go("settings")}>
                <span className="platform-mark">{platform.name[0]}</span>
                <strong>{platform.name}<code>{platform.host}</code></strong>
                <span className="platform-score">
                  {Math.round(((platform.requests - platform.failed) / platform.requests) * 100)}%
                  <small>accepted</small>
                </span>
                <span>{platform.requests} events today</span>
                <span>
                  Last sync
                  <br />
                  <small>{platform.lastSync}</small>
                </span>
                <Status value={platform.status} />
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function Orders({ go, liveOrders }: { go: (p: Page) => void; liveOrders?: Order[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Order | null>(null);
  const [view, setView] = useState("all");
  const [provider, setProvider] = useState("all");
  const [risk, setRisk] = useState("all");
  const [sort, setSort] = useState("newest");
  const [notice, setNotice] = useState("");
  const [localRows, setLocalRows] = useState(orderRows);
  useEffect(() => { if (liveOrders) setLocalRows(liveOrders); }, [liveOrders]);
  const [page, setPage] = useState(1);
  const pageSize = 3;
  const providerName = (order: Order) => order.courier?.split(" · ")[0] || "Unassigned";
  // Audit remediation P2: the strip was hardcoded 4 / BDT 16,440 / 2 / BDT 5,670 beside a
  // table you can act on, so marking an order shipped left the tiles stale. It also offered a
  // Pathao filter with no Pathao rows and omitted RedX entirely; the list is derived now.
  const openOrders = localRows.filter((order) => order.status !== "Delivered");
  const readyOrders = localRows.filter((order) => order.status === "Ready to ship");
  const needsReview = localRows.filter((order) => order.status === "Pending review").length;
  const providerOptions = Array.from(new Set(localRows.map(providerName)));
  const matchesView = (o: Order, key: string) => {
    if (key === "attention") return o.risk.includes("High") || o.status.includes("Pending");
    if (key === "ready") return o.status === "Ready to ship";
    if (key === "transit") return o.status === "In transit";
    if (key === "delivered") return o.status === "Delivered";
    if (key === "courier") return Boolean(o.courier);
    if (key === "cancelled") return o.status === "Cancelled";
    if (key === "returned") return o.status === "Returned";
    return true;
  };
  const viewRows = localRows.filter((o) => matchesView(o, view));
  const rows = viewRows
    .filter((o) => `${o.id} ${o.customer} ${o.location} ${o.item} ${o.payment}`.toLowerCase().includes(query.toLowerCase()))
    .filter((o) => provider === "all" || providerName(o) === provider)
    .filter((o) => risk === "all" || o.risk === risk)
    .sort((a, b) => sort === "newest" ? localRows.indexOf(a) - localRows.indexOf(b) : localRows.indexOf(b) - localRows.indexOf(a));
  const pageData = makePrototypePage(rows, page, pageSize);
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); };
  // Cancelled and Returned are legitimately empty in the sample data. They used to render
  // a bare table header with no rows and no explanation, which reads as a broken page.
  const filtersOn = query !== "" || provider !== "all" || risk !== "all";
  const emptyOrders = filtersOn
    ? { title: "No orders match these filters", detail: "Clear the search box or set the courier and risk filters back to all." }
    : view === "cancelled"
      ? { title: "No cancelled orders", detail: "Nothing has been cancelled in the last 30 days. Cancelled orders stay listed here for 90 days." }
      : view === "returned"
        ? { title: "No returned orders", detail: "No return has been logged in the last 30 days. Orders appear here once a courier marks a parcel returned." }
        : { title: "No orders in this view", detail: "Orders move into this view as their fulfillment status changes." };
  const updateOrder = (order: Order, status: string) => {
    setLocalRows((items) => items.map((item) => item.id === order.id ? { ...item, status } : item));
    setDetail((current) => current?.id === order.id ? { ...current, status } : current);
    flash(`${order.id} marked ${status.toLowerCase()}. Preview only.`);
  };
  const bulkAction = (message: string, count = selected.length) => { flash(`${message} for ${count} order${count === 1 ? "" : "s"}. Preview only.`); setSelected([]); };
  // A courier can only be booked for an order that has no consignment yet. `order.courier` holds the
  // provider and tracking id once one exists, so its absence is the whole test.
  const selectedOrders = localRows.filter((order) => selected.includes(order.id));
  const bookable = selectedOrders.filter((order) => !order.courier);
  const alreadyBooked = selectedOrders.length - bookable.length;
  const bulkNote =
    bookable.length === 0
      ? "Every selected order already has a consignment · nothing left to book"
      : alreadyBooked > 0
        ? `${alreadyBooked} already ${alreadyBooked === 1 ? "has" : "have"} a consignment and will be skipped`
        : "";
  useEffect(() => { setSelected([]); setPage(1); }, [query, provider, risk, sort, view]);
  useEffect(() => setPage((current) => Math.min(current, Math.max(1, Math.ceil(rows.length / pageSize)))), [rows.length]);
  return (
    <>
      <IntegrationStateNote scope="Orders and courier state" source="tenant-scoped order ledger + provider snapshot" />
      <PageHeader
        page="orders"
        action={
          <>
            <Button icon={<Download size={15} />} onClick={() => flash("Order export prepared. Preview only.")}>Export</Button>
            <Button kind="primary" icon={<RefreshCw size={15} />} onClick={() => flash(liveOrders ? "Orders read-only snapshot refreshed locally. Preview only." : "Orders synced with sample data. Preview only.")}>
              Sync orders
            </Button>
          </>
        }
      />
      <MetricStrip
        items={[
          {
            label: "Open orders",
            value: String(openOrders.length),
            hint: liveOrders ? `${needsReview} needs review · monthly total unavailable in this read` : `${needsReview} needs review · ${workspaceMetrics.orders.month} orders this month`,
            icon: <Clock3 size={14} />,
          },
          {
            label: "Open order value",
            value: money(openOrders.reduce((total, order) => total + order.total, 0)),
            hint: "Across COD and paid",
            icon: <CircleDollarSign size={14} />,
          },
          {
            label: "Ready to ship",
            value: String(readyOrders.length),
            hint: `${money(readyOrders.reduce((total, order) => total + order.total, 0))} ready`,
            icon: <PackageCheck size={14} />,
          },
          {
            label: "Delivery rate",
            value: liveOrders ? "N/A" : `${Math.round((workspaceMetrics.delivery.delivered / workspaceMetrics.delivery.completed) * 1000) / 10}%`,
            hint: liveOrders ? "Delivery aggregate unavailable in this order read" : `Last 30 days · ${workspaceMetrics.delivery.delivered} of ${workspaceMetrics.delivery.completed} completed shipments`,
            icon: <Check size={14} />,
          },
        ]}
      />
      <Panel className="orders-panel">
        <Tabs
          className="view-tabs"
          label="Order views"
          value={view}
          onChange={(key) => { setView(key); setSelected([]); }}
          items={[['all','All orders'],['attention','Needs attention'],['ready','Ready to ship'],['transit','In transit'],['delivered','Delivered'],['courier','Courier log'],['cancelled','Cancelled'],['returned','Returned']].map(([key,label]) => ({ id: key, label: <>{label} <b>{localRows.filter((order) => matchesView(order, key)).length}</b></> }))}
        />
        <div className="toolbar">
          <label className="field-search">
            <Search size={17} />
            <input
              aria-label="Search orders"
              placeholder="Search order, customer, phone or location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="toolbar-actions">
            <label className="compact-select"><Filter size={15} /><select aria-label="Filter by courier provider" value={provider} onChange={(e) => setProvider(e.target.value)}><option value="all">All providers</option>{providerOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label className="compact-select"><select aria-label="Filter by risk level" value={risk} onChange={(e) => setRisk(e.target.value)}><option value="all">All risk</option>{Array.from(new Set(localRows.map((order) => order.risk))).map((level) => <option key={level}>{level}</option>)}</select></label>
            <label className="compact-select"><select aria-label="Sort orders" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
          </div>
        </div>
        {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}
        {selected.length > 0 && (
          <div className="bulk-bar">
            <strong>{selected.length} selected</strong>
            {/* Audit remediation P1: every bulk action reported success for the whole selection
                whether or not it could apply. Selecting all of All orders and pressing Book courier
                flashed "Courier booking queued for 5 orders" -- while two of those five already
                carried a consignment: WC-9282 is in transit on Pathao PT-849201 and WC-9280 was
                delivered by Steadfast SF-291044. The bar claimed to have booked couriers for
                parcels that had already travelled, which in a live system is a duplicate
                consignment. Booking is scoped to the orders that can actually be booked now, the
                button carries the real count, and when nothing in the selection qualifies the
                action is disabled with the reason beside it rather than flashing a false success. */}
            {bulkNote && <small className="bulk-note">{bulkNote}</small>}
            <span />
            <button onClick={() => bulkAction("Courier booking queued", bookable.length)} disabled={bookable.length === 0}>
              <Truck size={15} />
              Book courier{bookable.length > 0 && bookable.length < selectedOrders.length ? ` (${bookable.length})` : ""}
            </button>
            <button onClick={() => bulkAction("Invoices prepared")}>
              <FileText size={15} />
              Print invoice
            </button>
            <button onClick={() => bulkAction("Status update opened")}>
              Update status <ChevronDown size={14} />
            </button>
            <button type="button" className="icon-button" onClick={() => setSelected([])} aria-label="Clear selection">
              <X size={17} />
            </button>
          </div>
        )}
        {rows.length === 0 ? (
          <div className="empty-state">
            <PackageCheck size={24} />
            <strong>{emptyOrders.title}</strong>
            <span>{emptyOrders.detail}</span>
            {(filtersOn || view !== "all") && (
              <Button onClick={() => { setView("all"); setQuery(""); setProvider("all"); setRisk("all"); }}>Show all orders</Button>
            )}
          </div>
        ) : (
        <>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    aria-label="Select all orders in this view"
                    checked={pageData.items.length > 0 && pageData.items.every((row) => selected.includes(row.id))}
                    onChange={() =>
                      setSelected(
                        pageData.items.every((row) => selected.includes(row.id))
                          ? selected.filter((id) => !pageData.items.some((row) => row.id === id))
                          : Array.from(new Set([...selected, ...pageData.items.map((row) => row.id)])),
                      )
                    }
                  />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th>Product / items</th>
                <th>Payment</th>
                <th>Risk</th>
                <th>Fulfillment</th>
                <th>Total</th>
                <th>Placed</th>
                <th>
                  <span className="sr-only">Row actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pageData.items.map((row) => (
                <tr key={row.id} onClick={() => setDetail(row)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select order ${row.id}`}
                      checked={selected.includes(row.id)}
                      onChange={() =>
                        setSelected(
                          selected.includes(row.id)
                            ? selected.filter((id) => id !== row.id)
                            : [...selected, row.id],
                        )
                      }
                    />
                  </td>
                  <td>
                    <button type="button" className="order-link" onClick={(event) => { event.stopPropagation(); setDetail(row); }}>
                      {row.id}
                    </button>
                    {row.risk === "High risk" && (
                      <span className="row-alert">
                        <AlertTriangle size={12} aria-hidden="true" />
                        Review
                      </span>
                    )}
                  </td>
                  <td>
                    <strong>{row.customer}</strong>
                    <span>{row.location}</span>
                  </td>
                  <td className="order-product-cell"><strong>{row.products?.[0]?.name || row.item}</strong><span>Qty {row.products?.[0]?.quantity || 1} · {row.products?.[0]?.variant || "Standard variant"}</span></td>
                  <td>
                    <strong>{row.payment}</strong>
                    <span>
                      {row.payment === "COD"
                        ? "Collect on delivery"
                        : "Online payment"}
                    </span>
                  </td>
                  <td className="order-fraud-cell">
                    <Status value={row.risk} />
                    <span className="fraud-reason">{riskReason(row)}</span>
                  </td>
                  <td>
                    <Status value={row.status} />
                    {row.courier && <span>{row.courier}</span>}
                  </td>
                  <td className="amount">{money(row.total)}</td>
                  <td>{row.age}</td>
                  <td>
                    {/* Audit remediation P2: this was an Ellipsis labelled "More actions", with no
                        onClick, no aria-haspopup and no menu anywhere in the file. The click fell
                        through to the row and opened the detail drawer, so the control promised a
                        menu and delivered a drawer. It now says what it does and matches the chevron
                        Delivery logs already uses for the same job. */}
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Open details for ${row.id}`}
                      onClick={(event) => { event.stopPropagation(); setDetail(row); }}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-order-list">
          {pageData.items.map((row) => (
            <article key={row.id} {...cardButtonProps(() => setDetail(row))}>
              <div>
                <strong>{row.id}</strong>
                <strong>{money(row.total)}</strong>
              </div>
              <p>
                <strong>{row.customer}</strong>
                <span>{row.location}</span>
              </p>
              <div>
                <Status value={row.status} />
                <Status value={row.risk} />
              </div>
              <footer>
                {row.item}
                <ChevronRight size={16} />
              </footer>
            </article>
          ))}
        </div>
        <PaginationControls page={pageData.page} pageSize={pageData.limit} total={pageData.totalCount} historyMayBeIncomplete={pageData.historyMayBeIncomplete} noun="orders" onPageChange={(next) => { setPage(next); setSelected([]); }} />
        </>
        )}
      </Panel>
      {detail && (
        <OrderDrawer order={detail} close={() => setDetail(null)} go={go} updateOrder={updateOrder} flash={flash} />
      )}
    </>
  );
}
function OrderDrawer({
  order,
  close,
  go,
  updateOrder,
  flash,
}: {
  order: Order;
  close: () => void;
  go: (p: Page) => void;
  updateOrder: (order: Order, status: string) => void;
  flash: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [customer, setCustomer] = useState(order.customer);
  const [phone, setPhone] = useState(order.phone || "");
  const [location, setLocation] = useState(order.location);
  const [products, setProducts] = useState(order.products || [{ name: order.item, quantity: 1, price: order.total }]);
  // The timeline used to assert "Fraud screening completed" and then print `order.risk` under it, so
  // an unchecked order read "Fraud screening completed · Not checked". The step now reports the state
  // it is actually in, and the unchecked state is the one place in the drawer that offers a re-run.
  const [recheck, setRecheck] = useState<"idle" | "running" | "done">("idle");
  const unchecked = order.risk === "Not checked" && recheck !== "done";
  const courier = courierDetails(order);
  const runCheck = () => {
    if (recheck === "running") return;
    setRecheck("running");
    window.setTimeout(() => { setRecheck("done"); flash(`Fraud check re-run for ${order.id} · low risk, no critical signal. Preview only.`); }, 900);
  };
  const saveEdit = () => { flash(`${order.id} changes saved locally. Preview only.`); setEditing(false); };
  return (
    <Drawer eyebrow="ORDER" title={order.id} close={close}>
      <div className="drawer-status">
        <Status value={order.status} />
        <Status value={order.risk} />
        <span>Placed {order.age}</span>
      </div>
      <section>
        <h3>Customer</h3>
        <div className="detail-person">
          <span className="avatar" aria-hidden="true">
            <UserRound size={16} />
          </span>
          <div>
            {editing ? <div className="drawer-edit-grid"><label>Name<input value={customer} onChange={(e) => setCustomer(e.target.value)} /></label><label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label><label className="full">Location<input value={location} onChange={(e) => setLocation(e.target.value)} /></label></div> : <><strong>{customer}</strong><span>{phone}</span><span>{location}</span></>}
          </div>
        </div>
      </section>
      <section>
        <h3>Fulfillment</h3>
        <div className="drawer-fulfillment-summary">
          <div><span>Courier</span><strong>{courier.provider}</strong></div>
          <div><span>Tracking</span><strong>{courier.tracking}</strong></div>
          <div><span>Status</span><Status value={courier.status} /></div>
        </div>
        {!order.courier && <div className="drawer-prerequisite"><Truck size={14} /><span><strong>Booking prerequisites</strong><small>Live flow must verify an enabled courier, valid credentials, pickup configuration, and a usable recipient phone/address before creating a consignment.</small></span></div>}
        {courier.status === "Booking failed" && <div className="drawer-prerequisite danger"><AlertTriangle size={14} /><span><strong>Booking failed</strong><small>Keep the order ready to retry and show the provider error code; do not mark it shipped until a consignment ID is returned.</small></span></div>}
        <div className="drawer-actions"><Button onClick={() => updateOrder(order, "Ready to ship")} icon={<PackageCheck size={15} />}>Mark ready</Button><Button onClick={() => updateOrder(order, "In transit")} icon={<Truck size={15} />}>Mark shipped</Button><Button onClick={() => flash("Invoice preview opened. Preview only.")} icon={<FileText size={15} />}>Invoice</Button></div>
      </section>
      <section>
        <h3>Items</h3>
        <div className="item-line">
          <span className="item-thumb" aria-hidden="true">
            <Box size={18} />
          </span>
          <div>
            {editing ? products.map((product, index) => <div className="product-edit-row" key={`${product.name}-${index}`}><input aria-label={`Product ${index + 1} name`} value={product.name} onChange={(e) => setProducts((items) => items.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /><input aria-label={`Product ${index + 1} quantity`} type="number" min="1" value={product.quantity} onChange={(e) => setProducts((items) => items.map((item, i) => i === index ? { ...item, quantity: Number(e.target.value) } : item))} /><button type="button" className="icon-button bordered" aria-label={`Remove ${product.name}`} onClick={() => setProducts((items) => items.filter((_, i) => i !== index))}><Trash2 size={14} /></button></div>) : <><strong>{order.item}</strong><small>{products[0]?.variant || "Standard variant"} · Qty {products.reduce((sum, item) => sum + item.quantity, 0)}</small></>}
          </div>
          <strong>{money(products.reduce((sum, item) => sum + item.price * item.quantity, 0))}</strong>
        </div>
        {editing && <Button icon={<Plus size={14} />} onClick={() => setProducts((items) => [...items, { name: "New product", quantity: 1, price: 0 }])}>Add product</Button>}
      </section>
      <section>
        <h3>Activity</h3>
        <ul className="timeline">
          <li>
            <i aria-hidden="true" />
            <span>
              <strong>Order received from WooCommerce</strong>
              <small>{order.age}</small>
            </span>
          </li>
          <li className={unchecked ? "timeline-open" : undefined}>
            <i aria-hidden="true" />
            <span>
              <strong>
                {recheck === "running"
                  ? "Re-running fraud screening…"
                  : unchecked
                    ? "Fraud screening did not complete"
                    : "Fraud screening completed"}
              </strong>
              <small>
                {recheck === "done"
                  ? "Low risk · no critical signal"
                  : recheck === "running"
                    ? "Reading the provider response…"
                    : unchecked
                      ? riskReason(order)
                      : `${order.risk} · ${riskReason(order)}`}
              </small>
              {unchecked && (
                <Button kind="quiet" icon={<RefreshCw size={14} className={recheck === "running" ? "spin" : undefined} />} disabled={recheck === "running"} onClick={runCheck}>
                  {recheck === "running" ? "Running check…" : "Run check"}
                </Button>
              )}
            </span>
          </li>
        </ul>
      </section>
      <footer>
        <div className="order-primary-actions">
          <Button icon={<Pencil size={15} />} onClick={() => editing ? saveEdit() : setEditing(true)}>{editing ? "Save changes" : "Edit order"}</Button>
          <Button kind="primary" icon={<Truck size={15} />} onClick={() => { updateOrder(order, "Ready to ship"); flash("Courier booking form ready. Preview only."); }}>Book courier</Button>
        </div>
        <Button className="order-secondary-action" icon={<ExternalLink size={15} />} onClick={() => flash("Store link copied. Preview only.")}>Open in store</Button>
      </footer>
    </Drawer>
  );
}

function CodReview({ go, protection, setProtection, liveOrders }: { go: (p: Page) => void; protection: CodProtection; setProtection: React.Dispatch<React.SetStateAction<CodProtection>>; liveOrders?: Order[] }) {
  // The queue is the COD orders that have not been decided yet, taken from the same rows the
  // Orders page uses, instead of an index slice that happened to line up.
  const [pending, setPending] = useState(orderRows.filter((order) => order.payment === "COD" && (order.status === "Pending review" || order.risk === "Not checked")));
  useEffect(() => { if (liveOrders) setPending(liveOrders.filter((order) => order.payment === "COD" && order.status !== "Delivered")); }, [liveOrders]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("oldest");
  const [notice, setNotice] = useState("");
  const [decisions, setDecisions] = useState<Array<{ order: Order; decision: "Confirmed" | "Skipped"; decidedAt: string }>>([]);
  // A row whose fraud check never ran had nothing to act on: the cell said "Fraud check has not run
  // yet" and stopped there, so the only way forward was to confirm or skip blind. Re-running the check
  // is now a control on the row, and the result replaces the reason in place.
  const [rechecking, setRechecking] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 1;
  const { enabled: protectionEnabled, holdHours, autoConfirm } = protection;
  const setProtectionEnabled = () => setProtection((value) => ({ ...value, enabled: !value.enabled }));
  const setHoldHours = (hours: string) => setProtection((value) => ({ ...value, holdHours: hours }));
  const setAutoConfirm = () => setProtection((value) => ({ ...value, autoConfirm: !value.autoConfirm }));
  // Audit remediation P2: "Confirmed this month 35" sat above a workspace with 26 orders this
  // month, and "False purchase rate 3.8%" had no denominator anywhere on the page. Both are
  // now counters that move with the decisions you make here.
  const [confirmedCount, setConfirmedCount] = useState<number | null>(liveOrders ? null : workspaceMetrics.cod.confirmedThisMonth);
  const [skippedCount, setSkippedCount] = useState<number | null>(liveOrders ? null : workspaceMetrics.cod.skippedThisMonth);
  const reviewed = (confirmedCount ?? 0) + (skippedCount ?? 0);
  const falseRate = skippedCount == null ? null : reviewed ? Math.round((skippedCount / reviewed) * 1000) / 10 : 0;
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  const visibleRows = pending
    .filter((row) => `${row.id} ${row.customer} ${row.location} ${row.item}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "oldest" ? pending.indexOf(b) - pending.indexOf(a) : pending.indexOf(a) - pending.indexOf(b));
  const pageData = makePrototypePage(visibleRows, page, pageSize);
  const decide = (ids: string[], decision: "confirm" | "skip") => {
    if (!ids.length) return;
    const decidedOrders = pending.filter((row) => ids.includes(row.id));
    setPending((rows) => rows.filter((row) => !ids.includes(row.id)));
    setSelected((items) => items.filter((id) => !ids.includes(id)));
    const decidedAt = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    setDecisions((items) => [
      ...decidedOrders.map((order) => ({ order, decision: decision === "confirm" ? "Confirmed" as const : "Skipped" as const, decidedAt })),
      ...items,
    ].slice(0, 8));
    if (decision === "confirm") setConfirmedCount((count) => (count == null ? ids.length : count + ids.length));
    else setSkippedCount((count) => (count == null ? ids.length : count + ids.length));
    flash(decision === "confirm" ? `${ids.length} Purchase event${ids.length === 1 ? "" : "s"} confirmed. Preview only.` : `${ids.length} order${ids.length === 1 ? "" : "s"} skipped with no Purchase event sent. Preview only.`);
  };
  const restoreSkipped = (orderId: string) => {
    const decision = decisions.find((item) => item.order.id === orderId && item.decision === "Skipped");
    if (!decision) return;
    setPending((rows) => rows.some((row) => row.id === orderId) ? rows : [decision.order, ...rows]);
    setDecisions((items) => items.filter((item) => !(item.order.id === orderId && item.decision === "Skipped")));
    setSkippedCount((count) => count == null ? null : Math.max(0, count - 1));
    flash(`${orderId} restored to COD review. No Purchase event has been sent. Preview only.`);
  };
  const runCheck = (id: string) => {
    if (rechecking.includes(id)) return;
    setRechecking((ids) => [...ids, id]);
    window.setTimeout(() => {
      const at = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      setPending((rows) => rows.map((row) => row.id === id ? { ...row, risk: "Low risk", riskReason: `No critical signal · checked ${at}` } : row));
      setRechecking((ids) => ids.filter((item) => item !== id));
      flash(`Fraud check re-run for ${id} · low risk. Preview only.`);
    }, 900);
  };
  useEffect(() => { setSelected([]); setPage(1); }, [query, sort]);
  useEffect(() => setPage((current) => Math.min(current, Math.max(1, Math.ceil(visibleRows.length / pageSize)))), [visibleRows.length]);
  return (
    <>
      <PageHeader
        page="cod"
        action={
          <Button
            icon={<SettingsIcon size={15} />}
            onClick={() => setSettingsOpen(true)}
          >
            Protection settings
          </Button>
        }
      />
      <MetricStrip
        items={[
          {
            label: "Waiting for review",
            value: String(pending.length),
            hint: `${money(pending.reduce((sum, row) => sum + row.total, 0))} total`,
            icon: <Clock3 size={14} />,
          },
          {
            label: "High-risk orders",
            value: String(pending.filter((row) => row.risk === "High risk").length),
            hint: "Review before confirming",
            icon: <AlertTriangle size={14} />,
          },
          {
            label: "Confirmed this month",
            value: confirmedCount == null ? "N/A" : String(confirmedCount),
            hint: confirmedCount == null ? "Monthly review total unavailable in this order read" : "COD Purchase events released",
            icon: <Check size={14} />,
          },
          {
            label: "False purchase rate",
            value: falseRate == null ? "N/A" : `${falseRate}%`,
            hint: falseRate == null ? "Authoritative review denominator unavailable in this order read" : `${skippedCount} of ${reviewed} reviewed COD orders skipped`,
            icon: <BarChart3 size={14} />,
          },
        ]}
      />
      <Panel className="cod-panel">
        <div className="notice-bar">
          <ShieldCheck size={18} />
          <span>
            <strong>
              Purchase events are held until you confirm the order.
            </strong>
            <small>
              Confirm sends the held Purchase event to Meta, TikTok and GA4. Skip suppresses it
              until it is restored from decision history. A confirmed event cannot be recalled after delivery.
            </small>
          </span>
          <Button kind="quiet">
            Learn how it works <ChevronRight size={14} />
          </Button>
        </div>
        <div className="toolbar">
          <label className="field-search">
            <Search size={17} />
            <input aria-label="Search COD orders" placeholder="Search order, customer or location" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className="toolbar-actions">
            <label className="compact-select"><select aria-label="Sort COD queue" value={sort} onChange={(event) => setSort(event.target.value)}><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></label>
            <Button kind="primary" icon={<Check size={15} />} onClick={() => decide(selected, "confirm")}>
              Confirm purchase {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="Select all COD orders on this page" checked={pageData.items.length > 0 && pageData.items.every((row) => selected.includes(row.id))} onChange={() => setSelected(pageData.items.every((row) => selected.includes(row.id)) ? selected.filter((id) => !pageData.items.some((row) => row.id === id)) : Array.from(new Set([...selected, ...pageData.items.map((row) => row.id)])))} />
                </th>
                <th>Order</th>
                <th>Customer</th>
                <th>Product detail</th>
                <th>Amount</th>
                <th>Fraud check</th>
                <th>Waiting</th>
                {/* Audit remediation P2: the pair below is the point of no return, and the only place
                    that said what it does was the page banner and the toast that appears after the
                    click. The consequence now sits on the column the buttons are in, once, rather than
                    repeated on all five rows. */}
                <th className="cod-decision-head">Decision<small>Confirm sends the event · Skip keeps it unsent and restorable</small></th>
              </tr>
            </thead>
            <tbody>
              {pageData.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input type="checkbox" aria-label={`Select COD order ${row.id}`} checked={selected.includes(row.id)} onChange={() => setSelected(selected.includes(row.id) ? selected.filter((id) => id !== row.id) : [...selected, row.id])} />
                  </td>
                  <td>
                    <button type="button" className="order-link" onClick={() => go("orders")}>{row.id}</button>
                  </td>
                  <td>
                    <strong>{row.customer}</strong>
                    <span>{row.phone || "01812 349999"}</span>
                    <span>{row.location}</span>
                  </td>
                  <td className="cod-product-cell"><strong>{row.products?.[0]?.name || row.item}</strong><span>Qty {row.products?.[0]?.quantity || 1} · {row.products?.[0]?.variant || "Standard variant"}</span></td>
                  <td className="amount">{money(row.total)}</td>
                  <td className="cod-fraud-cell">
                    <Status value={row.risk} /><span className="fraud-reason">{rechecking.includes(row.id) ? "Re-running the check…" : riskReason(row)}</span>
                    {row.risk === "Not checked" && (
                      <Button kind="quiet" icon={<RefreshCw size={13} className={rechecking.includes(row.id) ? "spin" : undefined} />} disabled={rechecking.includes(row.id)} onClick={() => runCheck(row.id)}>
                        {rechecking.includes(row.id) ? "Checking…" : "Run check"}
                      </Button>
                    )}
                  </td>
                  {/* The header says "Waiting", so the cell leads with the wait and puts the
                      placed-at stamp under it -- the same two-line shape the Delivery logs Time
                      column uses. A hold decision needs the age to act on and the date to trust it. */}
                  <td className="cod-waiting-cell"><strong>{waitingFor(row.age)}</strong><span>{row.age}</span></td>
                  <td className="cod-decision-cell">
                    <div className="row-actions">
                      <Button kind="primary" icon={<Check size={14} />} onClick={() => decide([row.id], "confirm")}>
                        Confirm purchase
                      </Button>
                      <Button kind="quiet" icon={<X size={14} />} onClick={() => decide([row.id], "skip")}>
                        Skip
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-order-list">
          {pageData.items.map((row) => (
            <article key={row.id}>
              <div>
                <strong>{row.id}</strong>
                <strong>{money(row.total)}</strong>
              </div>
              <p>
                <strong>{row.customer}</strong>
                <span>
                  {row.products?.[0]?.name || row.item} · Qty {row.products?.[0]?.quantity || 1} · waiting {waitingFor(row.age)}
                </span>
              </p>
              <div>
                <Status value={row.risk} />
                <Button kind="primary" icon={<Check size={14} />} onClick={() => decide([row.id], "confirm")}>
                  Confirm purchase
                </Button>
              </div>
              <div className="cod-mobile-reason">
                <span>{rechecking.includes(row.id) ? "Re-running the check…" : riskReason(row)}</span>
                {row.risk === "Not checked" && (
                  <Button kind="quiet" icon={<RefreshCw size={13} className={rechecking.includes(row.id) ? "spin" : undefined} />} disabled={rechecking.includes(row.id)} onClick={() => runCheck(row.id)}>
                    {rechecking.includes(row.id) ? "Checking…" : "Run check"}
                  </Button>
                )}
              </div>
              {/* The phone has no column header to hang the consequence on, so it goes in the footer
                  slot that used to repeat the risk copy already shown as a badge two lines above. */}
              <footer><span>Confirm sends the event · Skip keeps it unsent and restorable</span><Button kind="quiet" icon={<X size={14} />} onClick={() => decide([row.id], "skip")}>Skip</Button></footer>
            </article>
          ))}
        </div>
        {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}
        {visibleRows.length === 0 && <div className="empty-state"><ShieldCheck size={24} /><strong>No COD orders match this view</strong><span>Confirmed and skipped decisions are removed from the local preview queue.</span></div>}
        {visibleRows.length > 0 && <PaginationControls page={pageData.page} pageSize={pageData.limit} total={pageData.totalCount} historyMayBeIncomplete={pageData.historyMayBeIncomplete} noun="COD orders" onPageChange={(next) => { setPage(next); setSelected([]); }} />}
      </Panel>
      <Panel className="cod-decision-history">
        <SectionTitle title="Recent decisions" detail="Preview of the decision audit trail required from the live API" />
        {decisions.length === 0 ? (
          <div className="empty-state"><Clock3 size={22} /><strong>No decisions in this preview session</strong><span>Confirm or skip an order to verify the audit and restore experience.</span></div>
        ) : (
          <div className="cod-history-list">
            {decisions.map((item) => (
              <div key={`${item.order.id}-${item.decision}-${item.decidedAt}`}>
                <span><strong>{item.order.id}</strong><small>{item.order.customer} · {money(item.order.total)}</small></span>
                <Badge tone={item.decision === "Confirmed" ? "success" : "neutral"}>{item.decision}</Badge>
                <span className="cod-history-impact">
                  <strong>{item.decision === "Confirmed" ? "Purchase event released" : "Purchase event not sent"}</strong>
                  <small>Decision recorded at {item.decidedAt}</small>
                </span>
                {item.decision === "Skipped" ? (
                  <Button kind="quiet" icon={<RefreshCw size={13} />} onClick={() => restoreSkipped(item.order.id)}>Restore to review</Button>
                ) : (
                  <span className="cod-history-final">Final after provider delivery</span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="prototype-integration-note"><Info size={15} /><span><strong>Live integration requirement</strong><small>Load this history from tenant-scoped audit data. Show actor, timestamp, result, and provider delivery state; never infer a successful delivery from the button click alone.</small></span></div>
      </Panel>
      {settingsOpen && <Drawer eyebrow="COD PROTECTION" title="Review settings" className="cod-settings-sheet" close={() => setSettingsOpen(false)}><section><div className="setting-row"><span><strong>Hold Purchase events</strong><small>Keep COD purchases pending until reviewed.</small></span><button type="button" aria-label="Hold Purchase events" aria-pressed={protectionEnabled} className={`toggle ${protectionEnabled ? "on" : ""}`} onClick={() => setProtectionEnabled()}><i /></button></div><div className="cod-setting-field"><label>Maximum review time<select value={holdHours} onChange={(event) => setHoldHours(event.target.value)}><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option></select></label><small>Orders still pending after this time remain visible for manual review.</small></div><div className="setting-row"><span><strong>Auto-confirm after hold</strong><small>Disabled is safer while the team reviews manually.</small></span><button type="button" aria-label="Auto-confirm after hold" aria-pressed={autoConfirm} className={`toggle ${autoConfirm ? "on" : ""}`} onClick={() => setAutoConfirm()}><i /></button></div></section><footer><Button onClick={() => { setSettingsOpen(false); go("settings"); }}>Open all settings</Button><Button kind="primary" onClick={() => { setSettingsOpen(false); flash("Protection settings saved locally. Preview only."); }}>Save preview</Button></footer></Drawer>}
    </>
  );
}

function Checkouts({ checkouts, setCheckouts, liveCheckouts }: { checkouts: Checkout[]; setCheckouts: React.Dispatch<React.SetStateAction<Checkout[]>>; liveCheckouts?: Checkout[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [createOrder, setCreateOrder] = useState<Checkout | null>(null);
  const [ignoreTarget, setIgnoreTarget] = useState<Checkout | null>(null);
  useEffect(() => { if (liveCheckouts) setCheckouts(liveCheckouts); }, [liveCheckouts, setCheckouts]);
  const [page, setPage] = useState(1);
  const pageSize = 1;
  // The recovery sheet used to show a quantity input that changed nothing while the line total
  // stayed at the checkout amount, so a 2-item draft still read BDT 2,790.
  const [recoverQty, setRecoverQty] = useState(1);
  const openRecovery = (item: Checkout) => { setRecoverQty(item.quantity); setCreateOrder(item); };
  const [notice, setNotice] = useState("");
  // Audit remediation P1: the status select changed a row on `onChange` and reported it with a toast
  // that had no way back. A select is the easiest control in the portal to hit by accident -- one
  // stray scroll on a phone moves a customer from Active to Recovered -- so the confirmation now
  // carries the previous value and an Undo that restores it.
  const [undo, setUndo] = useState<{ id: string; status: Checkout["status"] } | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const flash = (message: string, revert?: { id: string; status: Checkout["status"] }) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice(message);
    setUndo(revert || null);
    noticeTimer.current = window.setTimeout(() => { setNotice(""); setUndo(null); noticeTimer.current = null; }, 6000);
  };
  const amount = (item: Checkout) => item.unitPrice * item.quantity;
  const rows = checkouts.filter((item) => statusFilter === "All statuses" || item.status === statusFilter).filter((item) => `${item.id} ${item.name} ${item.phone} ${item.address} ${item.item}`.toLowerCase().includes(query.toLowerCase()));
  const pageData = makePrototypePage(rows, page, pageSize);
  const updateStatus = (id: string, status: string) => {
    const previous = checkouts.find((entry) => entry.id === id)?.status;
    if (!previous || previous === status || status === "Recovered") return;
    setCheckouts((items) => items.map((entry) => entry.id === id ? { ...entry, status: status as Checkout["status"] } : entry));
    flash(`${id} moved to ${status}. Preview only.`, { id, status: previous });
  };
  const ignoreCheckout = () => {
    if (!ignoreTarget) return;
    const target = ignoreTarget;
    setIgnoreTarget(null);
    setCheckouts((items) => items.map((entry) => entry.id === target.id ? { ...entry, status: "Ignored" } : entry));
    flash(`${target.id} ignored. You can undo this decision. Preview only.`, { id: target.id, status: target.status });
  };
  const notContacted = checkouts.filter((item) => item.status === "Active");
  const contacted = checkouts.filter((item) => item.status === "Contacted");
  const recovered = checkouts.filter((item) => item.status === "Recovered");
  const openQueue = checkouts.filter((item) => !["Recovered", "Ignored"].includes(item.status));
  const newToday = checkouts.filter((item) => item.today);
  useEffect(() => setPage(1), [query, statusFilter]);
  useEffect(() => setPage((current) => Math.min(current, Math.max(1, Math.ceil(rows.length / pageSize)))), [rows.length]);
  return (
    <>
      <IntegrationStateNote scope="Incomplete checkout recovery" source="store checkout ledger + order sync result" freshness={liveCheckouts ? "Authenticated tenant-scoped checkout read" : "Sample data · checkout timestamps are illustrative"} />
      <PageHeader
        page="checkouts"
        action={<Button icon={<RefreshCw size={15} />} onClick={() => flash("Recovery queue refreshed. Preview only.")}>Refresh</Button>}
      />
      <MetricStrip
        items={[
          {
            label: "In queue",
            value: String(openQueue.length),
            hint: `${money(openQueue.reduce((total, item) => total + amount(item), 0))} at stake`,
            icon: <Activity size={14} />,
          },
          {
            label: "Not contacted",
            value: String(notContacted.length),
            hint: newToday.length ? `${newToday.length} active today · latest ${newToday[0].lastActivity.split(" · ")[1]}` : "Nothing new today",
            icon: <Clock3 size={14} />,
          },
          {
            label: "Contacted",
            value: String(contacted.length),
            hint: "Awaiting response",
            icon: <MessageSquareText size={14} />,
          },
          {
            label: "Recovered",
            value: String(recovered.length),
            hint: "Marked recovered in this session",
            icon: <Check size={14} />,
          },
        ]}
      />
      <Panel className="incomplete-panel">
        <SectionTitle
          title="Incomplete checkout queue"
          detail="Checkout details are retained for 30 days."
            action={<label className="compact-select"><Filter size={15} /><select aria-label="Filter by recovery status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option><option>Active</option><option>Contacted</option><option>Ignored</option><option>Recovered</option></select></label>}
        />
        <div className="toolbar"><label className="field-search"><Search size={17} /><input aria-label="Search incomplete checkouts" placeholder="Search checkout, customer, phone or address" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="queue-count">{rows.length} of {checkouts.length} shown</span></div>
        <p className="inline-note">{checkoutFunnel.abandoned} of the {checkoutFunnel.started} checkouts started in the {checkoutFunnel.window} were abandoned. {checkoutFunnel.recoverable}</p>
        {notice && (
          <div className="inline-preview-feedback with-undo">
            <Check size={15} />
            <span>{notice}</span>
            {undo && (
              <Button kind="quiet" icon={<RotateCcw size={14} />} onClick={() => { const target = undo; setCheckouts((items) => items.map((entry) => entry.id === target.id ? { ...entry, status: target.status } : entry)); flash(`${target.id} restored to ${target.status}. Preview only.`); }}>
                Undo
              </Button>
            )}
          </div>
        )}
        <div className="table-wrap incomplete-table-wrap">
          <table className="incomplete-table">
            <thead><tr><th>Customer</th><th>Product</th><th>Amount</th><th>Source</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {pageData.items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong><span>{item.phone}</span><small><code>{item.id}</code> · {item.address}</small></td>
                  <td><strong>{item.item}</strong><span>Qty {item.quantity} · {money(item.unitPrice)} each</span></td>
                  <td className="checkout-amount">{money(amount(item))}</td>
                  <td><Badge tone="neutral">{item.source}</Badge></td>
                  <td className="checkout-time"><span>Last activity</span>{item.lastActivity}</td>
                  <td><select aria-label={`Recovery status for ${item.id}`} className={`checkout-status ${item.status.toLowerCase()}`} value={item.status} disabled={item.status === "Recovered"} onChange={(event) => updateStatus(item.id, event.target.value)}><option>Active</option><option>Contacted</option><option>Ignored</option>{item.status === "Recovered" && <option>Recovered</option>}</select>{item.recoveredOrderId && <small className="checkout-link">Order {item.recoveredOrderId} · {item.syncState || "sync pending"}</small>}</td>
                  <td><div className="checkout-actions">{item.status !== "Ignored" && item.status !== "Recovered" && <Button kind="primary" icon={<Phone size={14} />} onClick={() => flash(`Calling ${item.phone}. Preview only.`)}>Call customer</Button>}{item.status !== "Ignored" && item.status !== "Recovered" ? <Button icon={<ClipboardList size={14} />} onClick={() => openRecovery(item)}>Create order</Button> : item.status === "Recovered" ? <Badge tone="success">Order created</Badge> : <span className="muted">No active actions</span>}{item.status !== "Ignored" && item.status !== "Recovered" && <Button kind="quiet" onClick={() => setIgnoreTarget(item)}>Ignore</Button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-order-list incomplete-mobile-list">
          {pageData.items.map((item) => (
            <article key={item.id}>
              <div><strong>{item.name}</strong><strong>{money(amount(item))}</strong></div>
              <p><span>{item.phone} · {item.address}</span><strong>{item.item}</strong><span>Qty {item.quantity} × {money(item.unitPrice)} · {item.source} · Last activity {item.lastActivity}</span></p>
              <label className="mobile-checkout-status"><span>Status</span><select aria-label={`Recovery status for ${item.id}`} className={`checkout-status ${item.status.toLowerCase()}`} value={item.status} disabled={item.status === "Recovered"} onChange={(event) => updateStatus(item.id, event.target.value)}><option>Active</option><option>Contacted</option><option>Ignored</option>{item.status === "Recovered" && <option>Recovered</option>}</select></label>
              <footer>{item.status !== "Ignored" && item.status !== "Recovered" && <Button kind="primary" icon={<Phone size={14} />} onClick={() => flash(`Calling ${item.phone}. Preview only.`)}>Call customer</Button>}{item.status !== "Ignored" && item.status !== "Recovered" ? <Button icon={<ClipboardList size={14} />} onClick={() => openRecovery(item)}>Create order</Button> : item.status === "Recovered" ? <Badge tone="success">Order created</Badge> : <span className="muted">No active actions</span>}{item.status !== "Ignored" && item.status !== "Recovered" && <Button kind="quiet" onClick={() => setIgnoreTarget(item)}>Ignore</Button>}</footer>
            </article>
          ))}
        </div>
        {rows.length === 0 && <div className="empty-state"><MessageSquareText size={24} /><strong>No checkouts match this view</strong><span>Try a different status or search term.</span></div>}
        {rows.length > 0 && <PaginationControls page={pageData.page} pageSize={pageData.limit} total={pageData.totalCount} historyMayBeIncomplete={pageData.historyMayBeIncomplete} noun="checkouts" onPageChange={setPage} />}
      </Panel>
      {createOrder && <Drawer eyebrow="RECOVERY" title="Create order" className="recovery-sheet" close={() => setCreateOrder(null)}><section><div className="detail-person"><span className="avatar" aria-hidden="true"><UserRound size={16} /></span><div><strong>{createOrder.name}</strong><span>{createOrder.phone}</span><span>{createOrder.address}</span><small><code>{createOrder.id}</code> · {createOrder.source} · last activity {createOrder.lastActivity}</small></div></div></section><section><h3>Items</h3><div className="item-line"><span className="item-thumb" aria-hidden="true"><Box size={18} /></span><div><strong>{createOrder.item}</strong><small><label htmlFor="recovery-qty">Quantity</label> <input id="recovery-qty" className="inline-number" value={recoverQty} type="number" min="1" onChange={(event) => setRecoverQty(Math.max(1, Number(event.target.value) || 1))} /> × {money(createOrder.unitPrice)}</small></div><strong>{money(createOrder.unitPrice * recoverQty)}</strong></div></section><section><h3>Order creation check</h3><div className="recovery-contract-note"><ShieldCheck size={15} /><span><strong>One checkout → one order</strong><small>This preview blocks a second draft after recovery. Live flow must use the numeric checkout ID and display the server-returned order ID plus pending event state.</small></span></div></section><section><h3>Order note</h3><label className="sr-only" htmlFor="recovery-note">Order note</label><textarea id="recovery-note" className="recovery-note" defaultValue="Recovered from incomplete checkout" /></section><footer><Button onClick={() => setCreateOrder(null)}>Cancel</Button><Button kind="primary" onClick={() => { const recoveredId = createOrder.id; const simulatedServerOrderId = "manual-1048-1787474700"; setCreateOrder(null); setCheckouts((items) => items.map((item) => item.id === recoveredId ? { ...item, status: "Recovered", quantity: recoverQty, recoveredOrderId: simulatedServerOrderId, syncState: "pending" } : item)); flash(`Recovery order ${simulatedServerOrderId} returned by the server and queued for review. Preview only.`); }}>Create draft order</Button></footer></Drawer>}
      {ignoreTarget && <ConfirmDialog title={`Ignore ${ignoreTarget.id}?`} close={() => setIgnoreTarget(null)} actions={<><Button onClick={() => setIgnoreTarget(null)}>Keep in queue</Button><Button kind="danger" onClick={ignoreCheckout}>Ignore checkout</Button></>}><p>This removes the checkout from the active recovery queue but keeps it in history. You can undo the decision from the confirmation banner.</p></ConfirmDialog>}
    </>
  );
}

function EventActivity({ liveEvents }: { liveEvents?: LiveEvent[] }) {
  // Audit remediation P2: the one failed event here was a PageView rejected for "Missing
  // event_id", while Delivery logs blamed a Purchase with no order value and Setup health's
  // critical issue was "Purchase value is missing". Three pages, three stories about the same
  // single failure. The Purchase is the failure now, with the reason all three pages state.
  // Audit remediation P3: the times were computed as `${27 + i * 14} min ago`, so the queue read
  // "27 / 41 / 55 / 69 min ago" no matter how long the tab stayed open, and Delivery logs described
  // the same Meta rejection as "1h ago". Two pages, two numbers, and neither gave a clock time you
  // could join them on. Clock times now, beside the day column that was already here.
  const initial: LiveEvent[] = ["PageView","AddToCart","InitiateCheckout","Purchase","Contact","Lead","ViewContent"].map((event, i) => ({ id: `evt_8f2a...${920 + i}`, event, provider: i % 3 === 0 ? "Meta" : i % 3 === 1 ? "TikTok" : "GA4", status: i === 3 ? "Failed" : i === 2 ? "Retrying" : "Delivered", time: ["10:17","10:03","09:49","09:35","18:52","17:26","16:04"][i], day: i < 4 ? "Aug 21" : "Aug 20", page: ["/","/products/linen-shirt","/checkout","/checkout","/contact","/lead-form","/products/hoodie"][i], product: ["Store home","Premium Linen Shirt","Premium Linen Shirt","Premium Linen Shirt","Support request","Lead form","Premium Hoodie"][i], destinations: i === 2 ? ["Meta","TikTok"] : ["Meta","TikTok","GA4"], requestId: i === 3 ? "req_19204" : undefined, reason: i === 3 ? "HTTP 400 · Purchase event had no order value" : i === 2 ? "HTTP 429 · Rate limited, attempt 2 of 5" : "Accepted by destination" }));
  const [events, setEvents] = useState(initial); const [query, setQuery] = useState(""); const [provider, setProvider] = useState("All platforms"); const [status, setStatus] = useState("All statuses"); const [liveMode, setLiveMode] = useState(false); const [detail, setDetail] = useState<(typeof initial)[number] | null>(null); const [notice, setNotice] = useState(""); const [page, setPage] = useState(1); const pageSize = 3;
  useEffect(() => { if (liveEvents) setEvents(liveEvents); }, [liveEvents]);
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); }; const rows = events.filter((e) => provider === "All platforms" || e.destinations.includes(provider)).filter((e) => status === "All statuses" || e.status === status).filter((e) => `${e.id} ${e.event} ${e.provider} ${e.product} ${e.page}`.toLowerCase().includes(query.toLowerCase())); const pageData = makePrototypePage(rows, page, pageSize); const canRetry = (item: LiveEvent) => Number.isSafeInteger(item.outboxId) && (item.outboxId ?? 0) > 0 && item.retryable === true; const retry = (item: LiveEvent) => { if (!canRetry(item)) return; setEvents((list) => list.map((event) => event.id === item.id ? { ...event, status: "Retrying", reason: `Outbox #${item.outboxId} queued locally` } : event)); flash(`Outbox #${item.outboxId} queued through the application retry contract. Preview only.`); };
  useEffect(() => setPage(1), [query, provider, status]);
  useEffect(() => setPage((current) => Math.min(current, Math.max(1, Math.ceil(rows.length / pageSize)))), [rows.length]);
  return (
    <>
      <IntegrationStateNote scope="Event activity" source="tenant-scoped event ledger + delivery correlation" freshness={liveEvents ? "Authenticated tenant-scoped event read" : "Sample data · last synced Aug 21, 10:42"} />
      <PageHeader
        page="events"
        action={
          <>
            <Button icon={<Download size={15} />} onClick={() => flash("Event export prepared. Preview only.")}>Export CSV</Button>
            <Button kind="primary" icon={<RefreshCw size={15} />} onClick={() => flash(liveEvents ? "Event read-only snapshot refreshed locally. Preview only." : "Event activity refreshed. Preview only.")}>
              Refresh
            </Button>
          </>
        }
      />
      <MetricStrip
        items={[
          {
            label: "All events",
            value: String(events.length),
            hint: liveEvents ? "Authenticated tenant-scoped event read" : "7 event records · 3 destinations",
            icon: <Activity size={14} />,
          },
          {
            label: "Delivered",
            value: String(events.filter((e) => e.status === "Delivered").length),
            hint: events.length ? `${Math.round((events.filter((e) => e.status === "Delivered").length / events.length) * 1000) / 10}% of ${events.length} event records` : "No event records returned",
            icon: <Check size={14} />,
          },
          {
            label: "Failed",
            value: String(events.filter((e) => e.status === "Failed").length),
            hint: "Needs review",
            icon: <AlertTriangle size={14} />,
          },
          {
            label: "Retrying",
            value: String(events.filter((e) => e.status === "Retrying").length),
            hint: "Retried automatically for 24h",
            icon: <RefreshCw size={14} />,
          },
        ]}
      />
      <Panel className="event-activity-panel">
        <div className="event-filter-toolbar">
          <label className="field-search"><Search size={17} /><input aria-label="Search events" placeholder="Search event, ID, product or page" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          <button className={`event-live-control ${liveMode ? "active" : ""}`} onClick={() => { setLiveMode(false); flash("Automatic polling is not connected in this prototype. Use the page refresh to request a new read-only snapshot."); }} aria-pressed="false"><span><i />Snapshot view</span><small>Automatic polling unavailable</small><b><i /></b></button>
        </div>
        <div className="event-filter-chips">
          <button className={provider === "All platforms" && status === "All statuses" ? "active all" : ""} onClick={() => { setProvider("All platforms"); setStatus("All statuses"); }}>All events <span>{events.length}</span></button>
          {["Meta", "TikTok", "GA4"].map((platform) => <button key={platform} className={provider === platform ? "active" : ""} onClick={() => setProvider(provider === platform ? "All platforms" : platform)}>{platform} <span>{events.filter((event) => event.destinations.includes(platform)).length}</span></button>)}
          <i className="event-filter-divider" />
          {["Delivered", "Failed", "Retrying"].map((state) => <button key={state} className={`${status === state ? "active " : ""}${state.toLowerCase()}`} onClick={() => setStatus(status === state ? "All statuses" : state)}>{state} <span>{events.filter((event) => event.status === state).length}</span></button>)}
          {(provider !== "All platforms" || status !== "All statuses" || query) && <button className="event-clear-filter" onClick={() => { setProvider("All platforms"); setStatus("All statuses"); setQuery(""); }}><RefreshCw size={12} />Clear</button>}
        </div>
        <div className="event-results-bar"><span>Event history</span><small>Showing {rows.length} {liveEvents ? "authenticated" : "preview"} events · one row per event, destinations grouped</small></div>{notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}
        <div className="event-list-header"><span>Time</span><span>Event</span><span>Page / Product</span><span>Delivery</span><span>Details</span></div>
        <div className="event-list">
          {pageData.items.map((item) => (
            <button key={item.id} onClick={() => setDetail(item)}><span className="event-time"><strong>{item.time}</strong><small>{item.day}</small></span><span className="event-name-cell"><strong>{item.event}</strong><small>{item.id}</small></span><span className="event-context"><strong>{item.product}</strong><small>{item.page}</small></span><span className="event-delivery"><span className="event-destinations">{item.destinations.map((destination) => <span className="event-destination-result" key={destination} title={`${destination} · ${item.status}`}><Badge tone={item.status === "Failed" ? "danger" : item.status === "Retrying" ? "warning" : "success"}>{destination}</Badge></span>)}</span><small className={`event-row-status ${item.status.toLowerCase()}`}>{item.status === "Delivered" ? "Delivered · HTTP 200" : `${item.status} · ${item.reason}`}</small></span><span className="event-view">View <ChevronRight size={14} /></span>
            </button>
          ))}
        </div>
        {rows.length === 0 && <div className="empty-state"><Search size={24} /><strong>No events match these filters</strong><span>Clear filters or search for another event.</span></div>}
        {rows.length > 0 && <PaginationControls page={pageData.page} pageSize={pageData.limit} total={pageData.totalCount} historyMayBeIncomplete={pageData.historyMayBeIncomplete} noun="events" onPageChange={setPage} />}
        <div className="event-list-footer"><span>{liveEvents ? "Authenticated read · complete history requires server total/has-more metadata" : "Preview sample only · complete history requires server total/has-more metadata"}</span><span>Failed and retrying events stay listed until they succeed</span></div>
      </Panel>
      {detail && <Drawer eyebrow="EVENT DETAIL" title={detail.event} close={() => setDetail(null)}><div className="drawer-status"><Status value={detail.status} /><Badge tone="neutral">{detail.provider}</Badge><span>{detail.time} · {detail.day}</span></div><section><h3>Event context</h3><div className="detail-list"><div><span>Event ID</span><strong>{detail.id}</strong></div><div><span>Delivery request</span><strong>{detail.requestId || "Correlation unavailable"}</strong></div><div><span>Outbox retry authority</span><strong>{canRetry(detail) ? `#${detail.outboxId} · retryable` : "Not available"}</strong></div><div><span>Page</span><strong>{detail.page}</strong></div><div><span>Product</span><strong>{detail.product}</strong></div><div><span>Destinations</span><strong>{detail.destinations.join(" · ")}</strong></div><div><span>HTTP result</span><strong>{detail.status === "Failed" ? "400" : detail.status === "Retrying" ? "429" : "200"}</strong></div></div></section><section><h3>Sanitized failure reason</h3><p className="detail-copy">{detail.reason}. Credentials and raw query parameters are intentionally hidden in this preview. Retry is unavailable until the server returns both an outbox ID and explicit retry eligibility.</p></section><footer><Button onClick={() => flash("Payload copied without secrets. Preview only.")} icon={<FileText size={15} />}>Copy safe context</Button>{canRetry(detail) && <Button kind="primary" onClick={() => { retry(detail); setDetail(null); }} icon={<RefreshCw size={15} />}>Retry queued event</Button>}</footer></Drawer>}
    </>
  );
}

function DeliveryLogs({ liveLogs }: { liveLogs?: LiveDeliveryLog[] }) {
  // GA4 used to be missing from both the log rows and the provider filter even though the
  // provider-health strip above listed it, and every row showed a bare HTTP code with no
  // plain-language result. Each row now carries its own outcome sentence.
  // Audit remediation P3: every row said "Nh ago", so a table headed "recent requests" could not be
  // lined up against Ad insights → Tracking health, which dates the newest delivery per destination
  // to the minute. The three newest rows now carry exactly those stamps -- Meta 10:42, GA4 10:41,
  // TikTok 10:39 -- so the two pages agree, and Meta's Degraded badge finally has a visible cause:
  // its most recent request is the rejection. The 09:35 Purchase in Event activity is the same
  // incident seen from the event side; "2 retries" is the hour between them.
  const initial: LiveDeliveryLog[] = [
    { id: "req_19204", eventId: "evt_8f2a...923", outboxId: 8801, retryable: true, provider: "Meta CAPI", host: "graph.facebook.com", endpoint: "Conversions API", code: 400, outcome: "Rejected · Purchase event had no order value", retry: "2 retries", time: "10:42", day: "Aug 21" },
    { id: "req_19203", provider: "GA4 Measurement", host: "www.google-analytics.com", endpoint: "Measurement Protocol", code: 200, outcome: "Accepted by destination", retry: "No retry", time: "10:41", day: "Aug 21" },
    { id: "req_19202", provider: "TikTok Events API", host: "events.tiktok.com", endpoint: "Events API 2.0", code: 200, outcome: "Accepted by destination", retry: "No retry", time: "10:39", day: "Aug 21" },
    { id: "req_19201", provider: "Meta CAPI", host: "graph.facebook.com", endpoint: "Conversions API", code: 200, outcome: "Accepted by destination", retry: "No retry", time: "10:31", day: "Aug 21" },
    { id: "req_19200", provider: "GA4 Measurement", host: "www.google-analytics.com", endpoint: "Measurement Protocol", code: 200, outcome: "Accepted by destination", retry: "No retry", time: "10:24", day: "Aug 21" },
    { id: "req_19199", provider: "TikTok Events API", host: "events.tiktok.com", endpoint: "Events API 2.0", code: 200, outcome: "Accepted by destination", retry: "No retry", time: "10:18", day: "Aug 21" },
  ];
  const [logs, setLogs] = useState(initial); const [provider, setProvider] = useState("All providers"); const [failedOnly, setFailedOnly] = useState(false); const [detail, setDetail] = useState<(typeof initial)[number] | null>(null); const [notice, setNotice] = useState(""); const [page, setPage] = useState(1); const pageSize = 3; const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); }; const rows = logs.filter((log) => provider === "All providers" || log.provider === provider).filter((log) => !failedOnly || log.code >= 400); const pageData = makePrototypePage(rows, page, pageSize); const canRetry = (item: LiveDeliveryLog) => Number.isSafeInteger(item.outboxId) && (item.outboxId ?? 0) > 0 && item.retryable === true; const retry = (item: LiveDeliveryLog) => { if (!canRetry(item)) return; setLogs((list) => list.map((log) => log.id === item.id ? { ...log, retry: "Queued", code: 202, outcome: `Outbox #${item.outboxId} queued · waiting for worker result` } : log)); flash(`Outbox #${item.outboxId} queued through the application retry contract. Preview only.`); };
  useEffect(() => { if (liveLogs) setLogs(liveLogs); }, [liveLogs]);
  useEffect(() => setPage(1), [provider, failedOnly]);
  useEffect(() => setPage((current) => Math.min(current, Math.max(1, Math.ceil(rows.length / pageSize)))), [rows.length]);
  const requestCount = liveLogs ? logs.length : workspaceMetrics.requestsToday;
  const failedCount = liveLogs ? logs.filter((log) => log.code >= 400).length : workspaceMetrics.failedRequests;
  const accepted = Math.max(0, requestCount - failedCount);
  const retryAttempts = liveLogs ? logs.filter((log) => log.retry !== "No retry").length : workspaceMetrics.retryAttempts;
  return (
    <>
      <IntegrationStateNote scope="Provider delivery logs" source="delivery request ledger + event correlation" freshness={liveLogs ? "Authenticated tenant-scoped delivery read" : "Sample data · request timestamps are illustrative"} />
      <PageHeader
        page="delivery"
        action={
          <>
            <Button icon={<Download size={15} />} onClick={() => flash("Delivery export prepared. Preview only.")}>Export logs</Button>
            <Button kind="primary" icon={<RefreshCw size={15} />} onClick={() => flash(liveLogs ? "Delivery read-only snapshot refreshed locally. Preview only." : "Delivery logs refreshed. Preview only.")}>
              Refresh logs
            </Button>
          </>
        }
      />
      <MetricStrip
        items={[
          {
            label: "Delivery health",
            value: requestCount ? `${Math.round((accepted / requestCount) * 100)}%` : "N/A",
            hint: `${accepted} of ${requestCount} loaded requests accepted`,
            icon: <Check size={14} />,
          },
          {
            label: "Requests today",
            value: String(requestCount),
            hint: platformDelivery.map((platform) => `${platform.requests} ${platform.name}`).join(" · "),
            icon: <Send size={14} />,
          },
          {
            label: "Failed",
            value: String(failedCount),
            hint: `${retryAttempts} loaded requests show retry activity`,
            icon: <AlertTriangle size={14} />,
          },
          {
            label: "Average latency",
            value: "428ms",
            hint: "Normal range is under 800ms",
            icon: <Clock3 size={14} />,
          },
        ]}
      />
      <Panel className="delivery-panel">
        <SectionTitle
          title="Provider delivery history"
          detail="Requests are grouped by destination and result. Credentials are redacted."
        />
        <div className="provider-health">
          {platformDelivery.map((platform) => (
            <div key={platform.key}>
              <span className="platform-mark">{platform.name[0]}</span>
              <strong>{platform.key}</strong>
              <Status value={platform.status} />
              <small>{platform.requests} requests · {platform.failed} failed</small>
            </div>
          ))}
        </div>
        <div className="toolbar delivery-toolbar"><label className="compact-select"><Filter size={15} /><select aria-label="Filter by delivery platform" value={provider} onChange={(e) => setProvider(e.target.value)}><option>All providers</option>{platformDelivery.map((platform) => <option key={platform.key}>{platform.key}</option>)}</select></label><label className="toggle-label"><input type="checkbox" checked={failedOnly} onChange={(e) => setFailedOnly(e.target.checked)} /> Failed only</label><span className="queue-count">Showing {rows.length} preview requests · complete history is not asserted</span></div>{notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}
        {rows.length === 0 ? (
          <div className="empty-state">
            <Send size={24} />
            <strong>{failedOnly ? "No failed requests in this view" : `No recent requests for ${provider}`}</strong>
            <span>{failedOnly ? "Every request in the last 6 hours was accepted. Clear the filter to see them." : "This destination has not sent a request in the window shown here."}</span>
            <Button onClick={() => { setProvider("All providers"); setFailedOnly(false); }}>Show all requests</Button>
          </div>
        ) : (
        <>
        <div className="table-wrap delivery-log-table-wrap">
          <table className="delivery-log-table">
            <thead><tr><th>Time</th><th>Platform</th><th>Destination</th><th>Method</th><th>Result</th><th>Retries</th><th>Details</th></tr></thead>
            <tbody>{pageData.items.map((log) => (
              <tr key={log.id} onClick={() => setDetail(log)}>
                <td className="delivery-time"><strong>{log.time}</strong><span>{log.day} · <code>{log.id}</code></span></td>
                <td><strong>{log.provider}</strong></td>
                <td className="delivery-host"><strong>{log.endpoint}</strong><span>{log.host}</span></td>
                <td><span className="method">POST</span></td>
                <td className="delivery-result"><Status value={String(log.code)} /><small>{log.outcome}</small></td>
                <td className={log.retry === "No retry" ? "delivery-retry muted" : "delivery-retry"}>{log.retry}</td>
                <td><button className="icon-button" onClick={(e) => { e.stopPropagation(); setDetail(log); }} aria-label={`View ${log.id}`}><ChevronRight size={16} /></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="mobile-order-list delivery-mobile-list">
          {pageData.items.map((log) => (
            <article key={log.id} {...cardButtonProps(() => setDetail(log))}>
              <div><strong>{log.provider}</strong><Status value={String(log.code)} /></div>
              <p><strong>{log.endpoint}</strong><span>{log.outcome}</span></p>
              <footer><span>{log.time} · {log.day}</span><span className={log.retry === "No retry" ? "muted" : ""}>{log.retry}</span><ChevronRight size={15} /></footer>
            </article>
          ))}
        </div>
        <PaginationControls page={pageData.page} pageSize={pageData.limit} total={pageData.totalCount} historyMayBeIncomplete={pageData.historyMayBeIncomplete} noun="requests" onPageChange={setPage} />
        <div className="event-list-footer"><span>Preview sample only · do not infer the complete delivery history</span><span>Production retention and paging must come from the server contract</span></div>
        </>
        )}
      </Panel>
      {detail && <Drawer eyebrow="DELIVERY REQUEST" title={detail.id} close={() => setDetail(null)}><div className="drawer-status"><Status value={String(detail.code)} /><Badge tone="neutral">{detail.provider}</Badge><span>{detail.time} · {detail.day}</span></div><section><h3>Request detail</h3><div className="detail-list"><div><span>Result</span><strong>HTTP {detail.code} · {detail.outcome}</strong></div><div><span>Event ID</span><strong>{detail.eventId || "Correlation unavailable"}</strong></div><div><span>Outbox ID</span><strong>{canRetry(detail) ? `#${detail.outboxId}` : "Not linked for retry"}</strong></div><div><span>Method</span><strong>POST</strong></div><div><span>Endpoint</span><strong>{detail.endpoint}</strong></div><div><span>Host</span><strong>{detail.host}</strong></div><div><span>Retry state</span><strong>{detail.retry}</strong></div></div></section><section><h3>Payload safety</h3><p className="detail-copy">Sensitive query parameters and credentials are redacted. Retry is available only when the server returns a tenant-scoped outbox ID and marks it retryable.</p></section><footer><Button onClick={() => flash("Safe request context copied. Preview only.")} icon={<FileText size={15} />}>Copy safe context</Button>{canRetry(detail) && <Button kind="primary" onClick={() => { retry(detail); setDetail(null); }} icon={<RefreshCw size={15} />}>Retry queued event</Button>}</footer></Drawer>}
    </>
  );
}

function Analytics() {
  const [tab, setTab] = useState("Summary");
  const [period, setPeriod] = useState(adTotals.window); const [compare, setCompare] = useState("Previous period"); const [adSearch, setAdSearch] = useState(""); const [adSort, setAdSort] = useState("Confirmed sales"); const [notice, setNotice] = useState(""); const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(""), 2200); };
  // Cost / order used to be ÷confirmed on each row while the Summary strip divided by placed
  // orders, so the same column disagreed with its own definition one panel above.
  const campaigns = adCampaigns.map((campaign) => ({
    ...campaign,
    cost: money(Math.round(campaign.spend / campaign.placed)),
    roas: `${(Math.round((campaign.revenue / campaign.spend) * 100) / 100).toFixed(2)}x`,
  }));
  const adReturn = `${(Math.round((adTotals.revenue / adTotals.spend) * 100) / 100).toFixed(2)}x`;
  const costPerOrder = money(Math.round(adTotals.spend / adTotals.placed));
  const filteredCampaigns = campaigns.filter((campaign) => `${campaign.name} ${campaign.id} ${campaign.platform}`.toLowerCase().includes(adSearch.toLowerCase())).sort((a, b) => adSort === "Return" ? Number.parseFloat(b.roas) - Number.parseFloat(a.roas) : adSort === "Ad cost" ? b.spend - a.spend : b.revenue - a.revenue);
  // Orders and revenue here now add up to the store total instead of overshooting it by one
  // order and BDT 14,200, and "Paid social" carries the ad-attributed revenue exactly.
  const sources = [
    { label: "Paid social", visitors: storeTotals.paidVisitors, orders: adTotals.confirmed, revenue: adTotals.revenue, detail: "Meta + TikTok campaigns" },
    ...otherSales,
  ].map((source) => ({ ...source, share: Math.round((source.revenue / storeTotals.revenue) * 1000) / 10 }));
  const matchedOrders = storeTotals.orders - storeTotals.unattributedOrders;
  const attributionRate = Math.round((matchedOrders / storeTotals.orders) * 1000) / 10;
  // Audit remediation P2: every step below the first was a typed-in string beside a typed-in bar
  // width, so the percentages could not follow the numbers. Raw counts now, everything derived.
  const funnelSteps = [
    ["Store visits", storeTotals.visitors, "of visitors", "visits"],
    ["Product views", areaTotal((row) => row.views), "from visits", "views"],
    ["Added to cart", areaTotal((row) => row.carts), "from product views", "carts"],
    ["Checkout started", checkoutFunnel.started, "from cart", "checkouts"],
    ["Confirmed orders", storeTotals.orders, "from checkout", "orders"],
  ] as const;
  const funnel = funnelSteps.map(([label, value, suffix, unit], index) => {
    const previous = index === 0 ? value : funnelSteps[index - 1][1];
    return [
      label,
      `${value.toLocaleString("en-BD")} ${unit}`,
      Math.round((value / storeTotals.visitors) * 1000) / 10,
      `${((value / previous) * 100).toFixed(1)}% ${suffix}`,
    ] as const;
  });
  const signals = [["Event ID", 98], ["User match", 76], ["Email / Phone", 71], ["Click IDs", 64], ["Product ID", 92], ["Order value", 86], ["UTM source", 82]] as const;
  // Audit remediation P2: "82 / 100" was typed into two panels and the tile added "Good · 2
  // blockers" with no definition on the workspace -- Setup health reports 1 critical, 2 warnings
  // and 1 suggestion, so nothing added up to two. The score is the average of the signals below
  // and a blocker is a signal under 75%, which the tile now says out loud.
  const signalFloor = 75;
  const qualityScore = Math.round(signals.reduce((total, [, rate]) => total + rate, 0) / signals.length);
  const weakSignals = signals.filter(([, rate]) => rate < signalFloor);
  const qualityGrade = qualityScore >= 90 ? "Strong" : qualityScore >= signalFloor ? "Good" : "Needs work";
  const signalRate = (label: string) => signals.find(([name]) => name === label)![1];
  // Visitors used to sum to 2,150 beside a "2,480 unique visitors" tile, and orders/revenue
  // summed to 35 / BDT 87,500 against 39 / BDT 100,000 everywhere else. Rows live at module
  // scope now so the Customer journey funnel reads the same numbers as the area table.
  const areas = areaRows;
  // Device and browser rows carried a typed-in share beside a typed-in count, so the tile could
  // say "82% · 2,034 mobile visitors" while the bars added up to something else. Counts are the
  // source and every share is a share of the same 2,480 visitors.
  const shareOf = (count: number) => Math.round((count / storeTotals.visitors) * 1000) / 10;
  const deviceShare = ([["Mobile", 2034], ["Desktop", 372], ["Tablet", 74]] as Array<[string, number]>).map(([label, count]) => [label, count, shareOf(count)] as const);
  const browserShare = ([["Chrome", 1612], ["Facebook in-app", 496], ["Safari", 248], ["Other", 124]] as Array<[string, number]>).map(([label, count]) => [label, count, shareOf(count)] as const);
  const baseline = compare === "No comparison" ? null : adBaselines[compare as keyof typeof adBaselines];
  const delta = (now: number, was: number) => {
    const change = ((now - was) / was) * 100;
    return `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}% vs ${baseline!.label}`;
  };
  const eventsTracked = workspaceMetrics.events.used;
  const deliverySuccess = Math.round(((workspaceMetrics.requestsToday - workspaceMetrics.failedRequests) / workspaceMetrics.requestsToday) * 100);
  const tabMetrics: Record<string, Array<{ label: string; value: string; hint: string; icon: React.ReactNode }>> = {
    Summary: [{ label: "Total events", value: eventsTracked.toLocaleString("en-BD"), hint: `Tracked ${workspaceMetrics.events.windowLabel}`, icon: <Activity size={14} /> }, { label: "Success rate", value: `${deliverySuccess}%`, hint: "Accepted by destinations", icon: <Check size={14} /> }, { label: "Daily average", value: Math.round(eventsTracked / workspaceMetrics.events.windowDays).toLocaleString("en-BD"), hint: `Events per day across ${workspaceMetrics.events.windowDays} days`, icon: <BarChart3 size={14} /> }, { label: "Data quality", value: `${qualityScore} / 100`, hint: `${qualityGrade} · ${weakSignals.length} ${weakSignals.length === 1 ? "signal" : "signals"} below ${signalFloor}%`, icon: <ShieldCheck size={14} /> }],
    "Ad results": [{ label: "Ad cost", value: money(adTotals.spend), hint: `Meta + TikTok synced · ${adTotals.windowRange}`, icon: <WalletCards size={14} /> }, { label: "New orders", value: String(adTotals.placed), hint: "Placed from ad clicks · COD included", icon: <ClipboardList size={14} /> }, { label: "Confirmed sales", value: money(adTotals.revenue), hint: `${adTotals.confirmed} confirmed ad orders`, icon: <CircleDollarSign size={14} /> }, { label: "Return", value: adReturn, hint: "Confirmed revenue ÷ ad cost", icon: <BarChart3 size={14} /> }],
    "Sales source": [{ label: "Paid revenue", value: money(adTotals.revenue), hint: `${sources[0].share}% of store sales`, icon: <Target size={14} /> }, { label: "Store revenue", value: money(storeTotals.revenue), hint: `${storeTotals.orders} confirmed orders, all sources`, icon: <Store size={14} /> }, { label: "Attribution rate", value: `${attributionRate}%`, hint: `${matchedOrders} of ${storeTotals.orders} orders matched`, icon: <Link2 size={14} /> }, { label: "Unattributed", value: money(unattributed.revenue), hint: `${storeTotals.unattributedOrders} order needs review`, icon: <AlertTriangle size={14} /> }],
    Customers: [{ label: "Unique visitors", value: storeTotals.visitors.toLocaleString("en-BD"), hint: "Repeated visits removed", icon: <UserRound size={14} /> }, { label: "Known contacts", value: `${signalRate("Email / Phone")}%`, hint: "Phone or email available", icon: <Phone size={14} /> }, { label: "Mobile share", value: `${deviceShare[0][2]}%`, hint: `${deviceShare[0][1].toLocaleString("en-BD")} mobile visitors`, icon: <Activity size={14} /> }, { label: "Top area", value: areas[0].area, hint: `${areas[0].share}% of revenue`, icon: <Target size={14} /> }],
  };
  return (
    <>
      <PageHeader
        page="aiads"
        action={
          <div className="insight-header-controls">
            <Button icon={<Download size={15} />} onClick={() => flash("Performance export prepared. Preview only.")}>Export</Button><label className="compact-select"><select aria-label="Reporting period" value={period} onChange={(e) => setPeriod(e.target.value)}><option>{adTotals.window}</option>{/* Audit remediation P1: "Last 7 days" and "This month" were selectable and relabelled every
                tile while the numbers stayed on the 30-day figures, so the page confidently
                mislabelled its own data. The sample set only holds one window, and the options
                say so instead of pretending. */}<option disabled>Last 7 days — not in this preview</option><option disabled>This month — not in this preview</option></select></label><label className="compact-select"><select aria-label="Comparison period" value={compare} onChange={(e) => setCompare(e.target.value)}><option>Previous period</option><option>Previous year</option><option>No comparison</option></select></label>
          </div>
        }
      />
      <Tabs
        label="Ad insight views"
        value={tab}
        onChange={setTab}
        items={["Summary", "Ad results", "Sales source", "Customers"].map((item) => ({ id: item, label: item }))}
      />
      <MetricStrip
        items={tabMetrics[tab]}
      />
      {tab === "Summary" && <div className="analytics-grid insight-summary-grid">
        <Panel className="span-2 insight-business-panel"><SectionTitle title="Business results" detail={`Ad spend and confirmed sales · ${adTotals.window.toLowerCase()} (${adTotals.windowRange})${baseline ? ` vs ${compare.toLowerCase()} (${baseline.label})` : " · no comparison selected"} · Updated ${adTotals.syncedAt}`} /><div className="business-result-strip">{([["Ad cost",money(adTotals.spend),"Synced ad spend",baseline&&delta(adTotals.spend,baseline.spend),null],["New orders",String(adTotals.placed),"Placed from ad clicks",baseline&&delta(adTotals.placed,baseline.placed),true],["Confirmed sales",money(adTotals.revenue),`${adTotals.confirmed} confirmed`,baseline&&delta(adTotals.revenue,baseline.revenue),true],["Return",adReturn,"Confirmed revenue ÷ ad cost",baseline&&delta(adTotals.revenue/adTotals.spend,baseline.revenue/baseline.spend),true],["Cost / order",costPerOrder,`Ad cost ÷ ${adTotals.placed} placed orders`,baseline&&delta(adTotals.spend/adTotals.placed,baseline.spend/baseline.placed),false]] as Array<[string,string,string,string|null|false,boolean|null]>).map(([label,value,hint,change,higherIsBetter])=><div key={label}><span>{label}</span><strong>{value}</strong><small>{hint}</small>{change&&<em className={higherIsBetter===null?"flat":change.startsWith("+")===higherIsBetter?"up":"down"}>{change}</em>}</div>)}</div></Panel>
        <Panel><SectionTitle title="Tracking health" detail="Checks that keep ROAS reliable" /><div className="insight-health-list"><button onClick={() => flash("Purchase value issue opened. Preview only.")}><Badge tone="danger">Critical</Badge><span><strong>Purchase value coverage</strong><small>{signalRate("Order value")}% · review missing order totals</small></span><ChevronRight size={14}/></button><button onClick={() => flash("TikTok matching issue opened. Preview only.")}><Badge tone="warning">Watch</Badge><span><strong>TikTok match quality</strong><small>{signalRate("Click IDs")}% · add consented customer signals</small></span><ChevronRight size={14}/></button><button onClick={() => flash("UTM coverage opened. Preview only.")}><Badge tone="success">Good</Badge><span><strong>Campaign attribution</strong><small>{attributionRate}% of orders matched</small></span><ChevronRight size={14}/></button></div></Panel>
        <Panel><SectionTitle title="Data quality" detail="Useful signals reaching ad platforms" action={<Badge tone={qualityScore >= 90 ? "success" : "warning"}>{qualityScore} / 100</Badge>} /><div className="signal-rate-list">{signals.map(([label,rate])=><div key={label}><span>{label}</span><i><b style={{width:`${rate}%`}}/></i><strong>{rate}%</strong></div>)}</div><p className="inline-note">Signals under {signalFloor}% are counted as blockers: {weakSignals.map(([label])=>label).join(" and ")}.</p></Panel>
        <Panel className="span-2"><SectionTitle title="Customer journey" detail={`How visitors move from store visit to confirmed order · ${adTotals.window} (${adTotals.windowRange})`} /><div className="insight-funnel">{funnel.map(([label,value,width,note])=><div key={label}><span><strong>{label}</strong><small>{value}</small></span><i><b style={{width:`${Math.max(width,3)}%`}}/></i><span className="funnel-rate">{note}</span></div>)}</div><p className="inline-note">{checkoutFunnel.abandoned} checkouts were abandoned in the {checkoutFunnel.window}. {checkoutFunnel.reachesQueue}</p></Panel>
      </div>}
      {tab === "Ad results" && <Panel className="ad-results-preview"><SectionTitle title="Campaign results" detail={`Ad cost, placed orders, confirmed sales and return in one view · ${adTotals.windowRange}`} action={<span className="sync-note">Provider sync · {adTotals.syncedAt}</span>} /><div className="ad-results-toolbar"><label className="field-search"><Search size={16}/><input aria-label="Search campaigns" value={adSearch} onChange={(event)=>setAdSearch(event.target.value)} placeholder="Search campaign, ID or platform"/></label><label className="compact-select"><select aria-label="Sort campaigns" value={adSort} onChange={(event)=>setAdSort(event.target.value)}><option>Confirmed sales</option><option>Return</option><option>Ad cost</option></select></label><Button icon={<Download size={14}/>} onClick={()=>flash("Campaign results export prepared. Preview only.")}>Download</Button></div><div className="ad-result-explainer"><span><strong>New orders</strong> includes pending COD</span><span><strong>Confirmed sales</strong> includes reviewed orders only</span><span><strong>Cost / order</strong> is ad cost ÷ new orders</span><span><strong>Return</strong> is confirmed revenue ÷ ad cost</span></div>{filteredCampaigns.length === 0 ? <div className="empty-state"><Search size={24}/><strong>No campaign matches “{adSearch}”</strong><span>Search by campaign name, provider campaign ID or platform.</span><Button onClick={()=>setAdSearch("")}>Clear search</Button></div> : <><div className="table-wrap ad-results-table-wrap"><table className="ad-results-table"><thead><tr><th>Campaign</th><th>Ad cost</th><th>Clicks</th><th>New orders</th><th>Confirmed</th><th>Confirmed sales</th><th>Cost / order</th><th>Return</th><th>Status</th></tr></thead><tbody>{filteredCampaigns.map((campaign)=><tr key={campaign.id}><td><strong>{campaign.name}</strong><span>{campaign.platform} · {campaign.id}</span></td><td>{money(campaign.spend)}</td><td>{campaign.clicks}</td><td>{campaign.placed}</td><td>{campaign.confirmed}</td><td><strong>{money(campaign.revenue)}</strong></td><td>{campaign.cost}</td><td><strong>{campaign.roas}</strong></td><td><Badge tone={campaign.status==="Strong"?"success":campaign.status==="Watch"?"warning":"neutral"}>{campaign.status}</Badge></td></tr>)}</tbody><tfoot><tr><td><strong>All campaigns</strong><span>{filteredCampaigns.length} of {campaigns.length} shown</span></td><td>{money(adTotals.spend)}</td><td>{adTotals.clicks.toLocaleString("en-BD")}</td><td>{adTotals.placed}</td><td>{adTotals.confirmed}</td><td><strong>{money(adTotals.revenue)}</strong></td><td>{costPerOrder}</td><td><strong>{adReturn}</strong></td><td>—</td></tr></tfoot></table></div><div className="mobile-order-list ad-results-mobile-list">{filteredCampaigns.map((campaign)=><article key={campaign.id}><div><strong>{campaign.name}</strong><Badge tone={campaign.status==="Strong"?"success":campaign.status==="Watch"?"warning":"neutral"}>{campaign.status}</Badge></div><p><span>{campaign.platform} · {campaign.id}</span></p><div className="mobile-campaign-metrics"><span><small>Ad cost</small><strong>{money(campaign.spend)}</strong></span><span><small>Confirmed sales</small><strong>{money(campaign.revenue)}</strong></span><span><small>Return</small><strong>{campaign.roas}</strong></span><span><small>Orders</small><strong>{campaign.confirmed} / {campaign.placed}</strong></span></div></article>)}</div></>}</Panel>}
      {tab === "Sales source" && <div className="analytics-grid source-insight-grid"><Panel className="span-2"><SectionTitle title="Sales source" detail={`Where all ${storeTotals.orders} confirmed orders and ${money(storeTotals.revenue)} of revenue originated`} action={<Badge tone="neutral">{money(storeTotals.revenue)} total</Badge>} /><div className="source-breakdown-list">{sources.map((source)=><div key={source.label}><span><strong>{source.label}</strong><small>{source.detail} · {source.visitors.toLocaleString("en-BD")} visitors</small></span><span><strong>{source.orders}</strong><small>orders</small></span><span><strong>{money(source.revenue)}</strong><small>{source.share}% of sales</small></span><i><b style={{width:`${source.share}%`}}/></i></div>)}</div><div className="event-list-footer"><span>{sources.reduce((t,s)=>t+s.orders,0)} orders · {money(sources.reduce((t,s)=>t+s.revenue,0))} · {storeTotals.visitors.toLocaleString("en-BD")} visitors</span><span>Paid social revenue matches the Ad results tab exactly</span></div></Panel><Panel className="span-2"><SectionTitle title="Attribution quality" detail="How much revenue has a known source" action={<Badge tone="success">{attributionRate}%</Badge>} /><div className="attribution-summary"><strong>{matchedOrders} of {storeTotals.orders} orders matched</strong><p>{storeTotals.unattributedOrders === 1 ? `One order worth ${money(3100)} has no campaign or source context.` : `${storeTotals.unattributedOrders} orders have no campaign or source context.`}</p><button onClick={()=>flash("Unattributed order review opened. Preview only.")}>Review unattributed order <ChevronRight size={14}/></button></div><div className="attribution-checks"><div><Check size={14}/><span><strong>UTM coverage</strong><small>82% of tracked visits</small></span></div><div><Check size={14}/><span><strong>Campaign IDs</strong><small>All {adCampaigns.length} synced campaigns mapped</small></span></div><div><AlertTriangle size={14}/><span><strong>Direct traffic</strong><small>Review saved-link campaigns</small></span></div></div></Panel><Panel className="span-2"><SectionTitle title="Top attributed campaigns" detail={`Confirmed sales contribution · ${money(adTotals.revenue)} from ${adCampaigns.length} campaigns`} /><div className="attributed-campaigns">{campaigns.slice().sort((a,b)=>b.revenue-a.revenue).map((campaign,index)=><div key={campaign.id}><span className="rank">{index+1}</span><span><strong>{campaign.name}</strong><small>{campaign.platform} · {campaign.id}</small></span><strong>{money(campaign.revenue)}</strong><span>{campaign.roas} return</span></div>)}</div></Panel></div>}
      {tab === "Customers" && <div className="analytics-grid customer-insight-grid"><Panel><SectionTitle title="Where customers are" detail="Located visitors · confirmed orders" /><div className="customer-bar-list">{areas.map((row)=><div key={row.area}><span><strong>{row.area}</strong><small>{row.orders} orders · {money(row.revenue)}</small></span><span>{row.visitors.toLocaleString("en-BD")}</span><i><b style={{width:`${row.share}%`}}/></i></div>)}</div><div className="event-list-footer"><span>{areaTotal((row)=>row.visitors).toLocaleString("en-BD")} located visitors · {areaTotal((row)=>row.orders)} orders · {money(areaTotal((row)=>row.revenue))}</span><span>Share is revenue share, not visitor share</span></div></Panel><Panel><SectionTitle title="Devices" detail="Unique visitors by device" /><div className="customer-bar-list">{deviceShare.map(([label,count,share])=><div key={label}><span><strong>{label}</strong><small>{share}% of visitors</small></span><span>{count.toLocaleString("en-BD")}</span><i><b style={{width:`${share}%`}}/></i></div>)}</div></Panel><Panel><SectionTitle title="Browsers" detail="First tracked browser" /><div className="customer-bar-list">{browserShare.map(([label,count,share])=><div key={label}><span><strong>{label}</strong><small>{share}% of visitors</small></span><span>{count.toLocaleString("en-BD")}</span><i><b style={{width:`${share}%`}}/></i></div>)}</div></Panel><Panel className="span-2"><SectionTitle title="Actions by area" detail="Product view → cart → checkout → confirmed order" /><div className="table-wrap area-insight-table-wrap"><table className="area-insight-table"><thead><tr><th>Area</th><th>Visitors</th><th>Product views</th><th>Added to cart</th><th>Checkout</th><th>Orders</th><th>Sales</th><th>Share</th></tr></thead><tbody>{areas.map((row)=><tr key={row.area}><td><strong>{row.area}</strong></td><td>{row.visitors.toLocaleString("en-BD")}</td><td>{row.views.toLocaleString("en-BD")}</td><td>{row.carts}</td><td>{row.checkouts}</td><td>{row.orders}</td><td><strong>{money(row.revenue)}</strong></td><td><span className="area-share"><i><b style={{width:`${row.share}%`}}/></i>{row.share}%</span></td></tr>)}</tbody><tfoot><tr><td><strong>All areas</strong></td><td>{areaTotal((row)=>row.visitors).toLocaleString("en-BD")}</td><td>{areaTotal((row)=>row.views).toLocaleString("en-BD")}</td><td>{areaTotal((row)=>row.carts)}</td><td>{areaTotal((row)=>row.checkouts)}</td><td>{areaTotal((row)=>row.orders)}</td><td><strong>{money(areaTotal((row)=>row.revenue))}</strong></td><td>{areaRows.reduce((total,row)=>total+row.share,0).toFixed(1)}%</td></tr></tfoot></table></div><div className="mobile-order-list area-mobile-list">{areas.map((row)=><article key={row.area}><div><strong>{row.area}</strong><strong>{money(row.revenue)}</strong></div><p><span>{row.visitors.toLocaleString("en-BD")} visitors · {row.orders} orders</span></p><footer><span>Share of sales</span><strong>{row.share}%</strong></footer></article>)}</div><p className="chart-caption">Column totals match the Customer journey funnel on the Summary tab: {areaTotal((row)=>row.views).toLocaleString("en-BD")} product views, {areaTotal((row)=>row.carts)} carts, {areaTotal((row)=>row.checkouts)} checkouts, {areaTotal((row)=>row.orders)} confirmed orders.</p></Panel></div>}
      {notice && <div className="inline-preview-feedback analytics-feedback"><Check size={15} />{notice}</div>}
    </>
  );
}

function CampaignTools() {
  const [tab, setTab] = useState("URL builder");
  const [notice, setNotice] = useState("");
  const [baseUrl, setBaseUrl] = useState(storeConnection.shopUrl);
  const [source, setSource] = useState("facebook");
  const [medium, setMedium] = useState("paid_social");
  // Every default below used to be its own literal, so the form could open describing a campaign
  // that does not exist and a product price no page agreed with.
  const [campaignName, setCampaignName] = useState(adCampaigns[0].utm);
  const [adPlatform, setAdPlatform] = useState(adCampaigns[0].platform.toLowerCase());
  const [campaignId, setCampaignId] = useState(adCampaigns[0].id);
  const [content, setContent] = useState(adCampaigns[0].creative);
  const [term, setTerm] = useState("");
  const [createdUrl, setCreatedUrl] = useState("");
  const [eventTarget, setEventTarget] = useState("Meta CAPI");
  const [eventName, setEventName] = useState("Purchase");
  const [eventId, setEventId] = useState("test_preview_001");
  const [eventValue, setEventValue] = useState(String(checkoutQueue[0].unitPrice));
  const [currency, setCurrency] = useState("BDT");
  const [email, setEmail] = useState("customer@example.com");
  const [phone, setPhone] = useState("+8801712345678");
  // Audit remediation P2: the tester prefilled 103.120.34.18 -- the very IP Account → Profile &
  // security lists as the owner's current session -- so a sandbox form looked like it was
  // replaying a real person's request. Reserved documentation ranges cannot belong to anyone.
  const [clientIp, setClientIp] = useState("203.0.113.10");
  const [userAgent, setUserAgent] = useState("Mozilla/5.0 · Chrome desktop");
  const [customParams, setCustomParams] = useState([{ k: "content_name", v: checkoutQueue[0].item }, { k: "content_category", v: "Apparel" }]);
  const [history, setHistory] = useState<Array<{ id: string; target: string; event: string; time: string }>>([]);
  const [testResponse, setTestResponse] = useState<{ statusCode: number; success: boolean; eventId: string; destination: string } | null>(null);
  const syncedCampaigns = adCampaigns.map((campaign) => ({ id: campaign.id, platform: campaign.platform.toLowerCase(), name: campaign.name, utm: campaign.utm, creative: campaign.creative }));
  const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(""), 2200); };
  const compiledUrl = useMemo(() => {
    if (!baseUrl.trim() || !campaignName.trim()) return "";
    try {
      const normalizedBase = /^https?:\/\//i.test(baseUrl.trim()) ? baseUrl.trim() : `https://${baseUrl.trim()}`;
      const url = new URL(normalizedBase);
      url.searchParams.set("utm_source", source.trim());
      url.searchParams.set("utm_medium", medium.trim());
      url.searchParams.set("utm_campaign", campaignName.trim().toLowerCase().replace(/\s+/g, "_"));
      if (campaignId) {
        url.searchParams.set("bk_platform", adPlatform);
        url.searchParams.set("bk_campaign_id", campaignId);
      }
      if (content.trim()) url.searchParams.set("utm_content", content.trim());
      if (term.trim()) url.searchParams.set("utm_term", term.trim());
      return url.toString();
    } catch {
      return "";
    }
  }, [baseUrl, source, medium, campaignName, adPlatform, campaignId, content, term]);
  const eventPayload = useMemo(() => {
    const extra = Object.fromEntries(customParams.filter((item) => item.k.trim()).map((item) => [item.k.trim(), item.v]));
    return {
      event_source: "server",
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      destination: eventTarget,
      attribution: { campaign_id: campaignId || undefined, campaign_url: createdUrl || compiledUrl || undefined },
      user_data: { email: email ? "SHA-256 protected" : undefined, phone: phone ? "SHA-256 protected" : undefined, client_ip_address: clientIp, client_user_agent: userAgent },
      custom_data: { value: Number(eventValue) || 0, currency, ...extra },
    };
  }, [campaignId, clientIp, compiledUrl, createdUrl, currency, customParams, email, eventId, eventName, eventTarget, eventValue, phone, userAgent]);
  const payloadJson = JSON.stringify(eventPayload, null, 2);
  const copyText = (text: string, message: string) => {
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => undefined);
    flash(message);
  };
  const changeSource = (next: string) => {
    setSource(next);
    setMedium(next === "google" ? "cpc" : next === "newsletter" ? "email" : next === "custom" ? "referral" : "paid_social");
  };
  const changePlatform = (next: string) => {
    setAdPlatform(next);
    setCampaignId("");
    changeSource(next === "meta" ? "facebook" : "tiktok");
  };
  const sendTest = () => {
    const response = { statusCode: 202, success: true, eventId, destination: eventTarget };
    setTestResponse(response);
    setHistory((items) => [{ id: `${eventId}-${Date.now()}`, target: eventTarget, event: eventName, time: "just now" }, ...items].slice(0, 4));
    flash("Sandbox event accepted by the local preview queue.");
  };
  return (
    <>
      <PageHeader
        page="campaigns"
        action={<Button icon={<BookOpen size={15} />} onClick={() => flash("UTM guide opened. Preview only.")}>UTM guide</Button>}
      />
      {/* This strip used to declare `role="tablist"` while none of its children claimed
          role="tab" -- a tablist reporting zero tabs, which is worse for a screen reader
          than no roles at all. Both halves of the pattern now come from one component. */}
      <Tabs
        className="section-tabs campaign-tool-tabs"
        label="Campaign tools"
        value={tab}
        onChange={setTab}
        items={['URL builder','Event tester','Data preview'].map((name) => ({ id: name, label: name }))}
      />
      {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}
      {tab === "Event tester" && <div className="campaign-test-grid"><Panel><SectionTitle title="Event tester" detail="Build a sanitized commerce event and verify the local delivery path." /><div className="campaign-sandbox-banner"><Code2 size={16} /><span><strong>Sandbox mode</strong><small>No provider credential or production attribution is used. Email, phone, IP and user agent are prefilled with reserved sample values, not customer data.</small></span><Badge tone="success">Preview only</Badge></div><div className="campaign-form campaign-event-form"><label>API target router<select value={eventTarget} onChange={(event)=>setEventTarget(event.target.value)}><option>Meta CAPI</option><option>TikTok Events API</option><option>Google Analytics 4</option></select></label><label>Standard event<select value={eventName} onChange={(event)=>setEventName(event.target.value)}><option>Purchase</option><option>AddToCart</option><option>InitiateCheckout</option><option>PageView</option><option>Lead</option><option>Contact</option></select></label><label>Event ID<input value={eventId} onChange={(event)=>setEventId(event.target.value)} /></label><label>Assigned value<input inputMode="decimal" value={eventValue} onChange={(event)=>setEventValue(event.target.value)} /></label><label>Currency<input value={currency} onChange={(event)=>setCurrency(event.target.value.toUpperCase())} /></label><label>Email address<input type="email" value={email} onChange={(event)=>setEmail(event.target.value)} /></label><label>Phone number<input value={phone} onChange={(event)=>setPhone(event.target.value)} /></label><label>Client IP address<input value={clientIp} onChange={(event)=>setClientIp(event.target.value)} /></label><label className="span-2">Client user agent<input value={userAgent} onChange={(event)=>setUserAgent(event.target.value)} /></label></div><div className="custom-field-block"><div><span><strong>Custom tracking fields</strong><small>Included inside custom_data</small></span><button onClick={()=>setCustomParams((items)=>[...items,{k:"",v:""}])}><Plus size={14}/> Add field</button></div>{customParams.map((item,index)=><div className="custom-field-row" key={`${index}-${item.k}`}><input aria-label={`Custom field ${index+1} key`} value={item.k} placeholder="Field key" onChange={(event)=>setCustomParams((items)=>items.map((entry,itemIndex)=>itemIndex===index?{...entry,k:event.target.value}:entry))}/><input aria-label={`Custom field ${index+1} value`} value={item.v} placeholder="Value" onChange={(event)=>setCustomParams((items)=>items.map((entry,itemIndex)=>itemIndex===index?{...entry,v:event.target.value}:entry))}/><button aria-label={`Remove custom field ${index+1}`} onClick={()=>setCustomParams((items)=>items.filter((_,itemIndex)=>itemIndex!==index))}><Trash2 size={14}/></button></div>)}</div><Button kind="primary" icon={<Send size={15}/>} onClick={sendTest}>Send sandbox event</Button></Panel><Panel className="campaign-response-panel"><SectionTitle title="Delivery result" detail="Local response and recent test history" />{testResponse?<div className="test-response"><header><span>HTTP {testResponse.statusCode}</span><Badge tone="success">Accepted</Badge></header><div><span>Destination</span><strong>{testResponse.destination}</strong></div><div><span>Event ID</span><strong>{testResponse.eventId}</strong></div><small>Queued locally. No external provider request was made.</small></div>:<div className="campaign-empty"><Send size={22}/><strong>No test sent yet</strong><span>Complete the form and send a sandbox event to inspect the result.</span></div>}{history.length>0&&<div className="campaign-test-history"><strong>Recent tests</strong>{history.map((item)=><div key={item.id}><Status value="Delivered"/><span><strong>{item.event}</strong><small>{item.target} · {item.time}</small></span></div>)}</div>}</Panel></div>}
      {tab === "Data preview" && <div className="campaign-preview-grid"><Panel><SectionTitle title="Data preview" detail="Live sanitized payload built from the Event tester and URL builder." /><div className="campaign-preview-summary"><div><span>Event</span><strong>{eventName}</strong></div><div><span>Destination</span><strong>{eventTarget}</strong></div><div><span>Value</span><strong>{currency} {Number(eventValue||0).toLocaleString()}</strong></div><div><span>Campaign</span><strong>{campaignId?"Mapped":"UTM only"}</strong></div></div><div className="payload-preview"><header><span>EVENT PAYLOAD</span><button onClick={()=>copyText(payloadJson,"Sanitized payload copied.")}><FileText size={14}/> Copy JSON</button></header><pre>{payloadJson}</pre></div></Panel><Panel className="preview-security-panel"><SectionTitle title="Privacy and delivery checks" detail="What is included before a test can leave the application boundary." /><div className="preview-check-list"><div><ShieldCheck size={16}/><span><strong>Secrets are excluded</strong><small>Tokens, API keys and database credentials never appear.</small></span></div><div><Check size={16}/><span><strong>Customer identifiers protected</strong><small>Email and phone are represented as hashed fields.</small></span></div><div><Link2 size={16}/><span><strong>Campaign context connected</strong><small>{campaignId?`${adPlatform.toUpperCase()} · ${campaignId}`:"No synced campaign selected"}</small></span></div></div>{testResponse&&<div className="latest-delivery"><span>Latest sandbox response</span><strong>HTTP {testResponse.statusCode} · Accepted</strong><small>{testResponse.destination} · {testResponse.eventId}</small></div>}</Panel></div>}
      {tab === "URL builder" && <div className="builder-grid">
        <Panel>
          <SectionTitle
            title="Create a campaign link"
            detail="Use one naming convention so ad cost and orders stay connected."
          />
          <div className="campaign-form">
            <label className="span-2">Base website URL<input value={baseUrl} onChange={(event)=>setBaseUrl(event.target.value)} placeholder="https://your-domain.com/product" /></label>
            <label>Campaign source<select value={source} onChange={(event)=>changeSource(event.target.value)}><option value="facebook">Facebook Ads</option><option value="tiktok">TikTok Ads</option><option value="google">Google CPC</option><option value="newsletter">Email newsletter</option><option value="custom">Custom partner</option></select></label>
            <label>Campaign medium<input value={medium} onChange={(event)=>setMedium(event.target.value)} /></label>
            <label className="span-2">Campaign name<input value={campaignName} onChange={(event)=>setCampaignName(event.target.value)} placeholder="e.g. august_retargeting" /></label>
            <label>Ad platform<select value={adPlatform} onChange={(event)=>changePlatform(event.target.value)}><option value="meta">Meta</option><option value="tiktok">TikTok</option></select></label>
            <label>Synced campaign <span className="optional">Optional</span><select value={campaignId} onChange={(event)=>{const id=event.target.value;setCampaignId(id);const match=syncedCampaigns.find((item)=>item.id===id);if(match){setCampaignName(match.utm);setContent(match.creative);}}}><option value="">Use UTM only</option>{syncedCampaigns.filter((item)=>item.platform===adPlatform).map((item)=><option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select></label>
            <label>Ad content <span className="optional">Optional</span><input value={content} onChange={(event)=>setContent(event.target.value)} placeholder="creative_a" /></label>
            <label>Search term <span className="optional">Optional</span><input value={term} onChange={(event)=>setTerm(event.target.value)} placeholder="premium_hoodie" /></label>
          </div>
          <Button
            kind="primary"
            icon={<Link2 size={15} />}
            onClick={() => { if(!baseUrl.trim())return flash("Enter a base website URL.");if(!campaignName.trim())return flash("Enter a campaign name.");if(!compiledUrl)return flash("Check the website URL format.");setCreatedUrl(compiledUrl);flash("Campaign link created. Preview only."); }}
          >
            Create campaign link
          </Button>
        </Panel>
        <Panel className="preview-panel">
          <SectionTitle
            title="Your campaign link"
            detail="Preview before you paste it into Ads Manager."
          />
          <div className={`link-preview ${compiledUrl?"ready":""}`}>{compiledUrl||"Enter a valid base URL and campaign name to compile the link."}</div>
          <div className="campaign-link-actions"><Button icon={<FileText size={15}/>} onClick={()=>compiledUrl?copyText(createdUrl||compiledUrl,"Campaign link copied."):flash("Create a valid link first.")}>Copy link</Button><Button icon={<Code2 size={15}/>} onClick={()=>setTab("Data preview")}>Preview payload</Button></div>
          <div className="url-parameter-list"><div><span>Attribution</span><strong>{source} / {medium}</strong></div><div><span>Campaign mapping</span><strong>{campaignId?`${adPlatform} · ${campaignId}`:"UTM only"}</strong></div><div><span>Optional fields</span><strong>{[content&&"content",term&&"term"].filter(Boolean).join(", ")||"None"}</strong></div></div>
          <div className="tester-note"><Code2 size={17}/><span><strong>Need to validate delivery?</strong><small>Event tester uses this campaign context in the same sanitized payload.</small></span></div>
        </Panel>
      </div>}
    </>
  );
}

function AiAds({
  section,
  setSection,
  live,
}: {
  section: AiSection;
  setSection: (section: AiSection) => void;
  live?: LiveAiAds;
}) {
  const [notice, setNotice] = useState(""); const [proposalOpen, setProposalOpen] = useState(false); const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2300); };
  const livePendingProposal = live?.proposals.find((proposal) => proposal.status === "pending");
  const tabs: Array<{ id: AiSection; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "accounts", label: "Connected accounts" },
    { id: "campaigns", label: "Campaigns" },
    { id: "analytics", label: "Analytics" },
    { id: "chat", label: "AI workspace" },
  ];
  return (
    <>
      <PageHeader
        page="aiads"
        action={<Button icon={<RefreshCw size={15} />} onClick={() => flash("AI Ads read-only data refreshed. Preview only.")}>Refresh</Button>}
      />
      <Tabs label="AI Ads sections" value={section} onChange={setSection} items={tabs} />
      {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}
      {section === "overview" && (
        <>
          <MetricStrip
            items={[
              {
                label: "Spend",
                value: money(live?.performance.spend ?? adTotals.spend),
                hint: `${adTotals.window} · ${adTotals.windowRange}`,
                icon: <CircleDollarSign size={14} />,
              },
              {
                label: "Confirmed sales",
                value: money(live?.performance.revenue ?? adTotals.revenue),
                hint: live ? `${live.performance.conversions} provider conversions` : `${adTotals.confirmed} confirmed ad orders`,
                icon: <BarChart3 size={14} />,
              },
              {
                label: "ROAS",
                value: `${(live?.performance.roas ?? (adTotals.revenue / adTotals.spend)).toFixed(2)}x`,
                hint: "Confirmed revenue ÷ spend",
                icon: <Target size={14} />,
              },
              {
                label: "Pending proposals",
                value: String(live?.proposals.filter((proposal) => proposal.status === "pending").length ?? 1),
                hint: live?.proposals.length ? `${live.proposals[0].operation} · provider approval required` : `${adProposal.action} on ${adProposal.campaign.name}`,
                icon: <ShieldCheck size={14} />,
              },
            ]}
          />
          <div className="ai-grid">
            <Panel>
              <SectionTitle
                title="Pending proposal"
                detail="Exact change and policy check are shown before approval."
              />
              {live ? livePendingProposal ? <div className="proposal">
                <div>
                  <Badge tone="warning">{livePendingProposal.risk} risk</Badge>
                  <h3>{livePendingProposal.operation}</h3>
                  <p>The authenticated read contract returned proposal identity and status only. Exact before/after values must be reviewed in the server approval flow.</p>
                </div>
                <code>Proposal hash {livePendingProposal.proposal_hash || "Unavailable"}</code>
                <div className="row-actions">
                  <Button onClick={() => flash("Exact proposal review is unavailable in this read-only prototype. No approval recorded.")}>Read-only summary</Button>
                </div>
              </div> : <div className="empty-state"><ShieldCheck size={20} /><strong>No pending proposals</strong><span>The authenticated proposal read returned no pending item.</span></div> : <div className="proposal">
                <div>
                  <Badge tone="warning">Medium risk</Badge>
                  <h3>{adProposal.action} · {adProposal.campaign.name}</h3>
                  <p>{adProposal.reason}</p>
                </div>
                <code>Proposal hash {adProposal.hash}</code>
                <div className="row-actions">
                  <Button onClick={() => setProposalOpen(true)}>Review details</Button>
                  <Button kind="primary" icon={<Check size={14} />} onClick={() => flash(live?.writesEnabled ? "Approval requires exact proposal review. No action executed." : "Live writes are disabled. Review only; no action executed.")}>
                    Review exact proposal
                  </Button>
                </div>
              </div>}
            </Panel>
            <Panel>
              <SectionTitle
                title="Recent actions"
                detail="Append-only activity"
              />
              {live?.actions.length ? <div className="connection-list">{live.actions.map((action) => <div key={action.id}><span className="platform-mark">{action.provider[0]?.toUpperCase() || "A"}</span><span><strong>{action.operation}</strong><small>{action.provider} · {action.created_at || "Time unavailable"}</small></span><Status value={action.status} /></div>)}</div> : <div className="empty-state">
                <Check size={20} />
                <strong>No action history yet</strong>
                <span>{live ? "The authenticated action read returned no rows." : "Approved provider actions will appear here."}</span>
              </div>}
            </Panel>
          </div>
        </>
      )}
      {section === "accounts" && <AiAccounts live={live} />}
      {section === "campaigns" && <AiCampaigns live={live} />}
      {section === "analytics" && <AiAnalytics live={live} />}
      {section === "chat" && <AiChat live={live} />}
      {!live && proposalOpen && <Drawer eyebrow="PROPOSAL REVIEW" title={adProposal.action} close={() => setProposalOpen(false)}><div className="drawer-status"><Badge tone="warning">Medium risk</Badge><Badge tone="neutral">{adProposal.campaign.platform} · {adProposal.campaign.account}</Badge><span>Expires in 2h</span></div><section><h3>Exact change</h3><div className="detail-list"><div><span>Campaign</span><strong>{adProposal.campaign.name}</strong></div><div><span>Campaign ID</span><strong>{adProposal.campaign.id}</strong></div><div><span>Before</span><strong>{adProposal.campaign.state} · {money(adProposal.campaign.daily)}/day</strong></div><div><span>After</span><strong>{adProposal.campaign.state} · {money(adProposal.dailyAfter)}/day</strong></div><div><span>Why</span><strong>{roasOf(adProposal.campaign).toFixed(2)}x return · {adProposal.campaign.confirmed} of {adProposal.campaign.placed} orders confirmed</strong></div><div><span>Policy</span><strong>v3.4 · within ceiling</strong></div></div></section><section><h3>Approval boundary</h3><p className="detail-copy">Proposal hash: {adProposal.hash}. Revalidation and approval are required before any provider write. This preview never executes changes.</p></section><footer><Button onClick={() => setProposalOpen(false)}>Close</Button><Button kind="primary" onClick={() => { setProposalOpen(false); flash("Proposal marked for approval review. Preview only."); }}>Record approval intent</Button></footer></Drawer>}
    </>
  );
}

function AiAdsUpgradeNotice() {
  return (
    <Panel className="empty-state-panel">
      <div className="empty-state">
        <LockKeyhole size={28} />
        <strong>AI Ads upgrade in progress</strong>
        <span>This workspace will get AI Ads after the rollout is completed. Existing campaign and tracking workflows remain available.</span>
        <Badge tone="neutral">Coming soon</Badge>
      </div>
    </Panel>
  );
}
function AiAccounts({ live }: { live?: LiveAiAds }) {
  // Audit remediation P2: TikTok Ads read "No active connection" while a TikTok campaign,
  // TikTok spend and healthy TikTok delivery all appeared elsewhere, and Settings → Ad
  // accounts listed Meta only. Both accounts are connected, and each row now names the
  // campaigns and spend it actually accounts for.
  const accounts = (live?.connections ?? ["Meta", "TikTok"].map((platform) => ({ provider: platform, status: "connected", accounts: [] }))).map((connection: any) => {
    const platform = String(connection.provider).replace(/^./, (char) => char.toUpperCase());
    const owned = live ? live.campaigns.filter((campaign) => campaign.platform === platform) : adCampaigns.filter((campaign) => campaign.platform === platform);
    return {
      name: `${platform} Ads`,
      account: connection.accounts?.[0]?.account_name ?? owned[0]?.account ?? "",
      campaigns: owned.length,
      spend: live ? null : owned.reduce((total, campaign) => total + campaign.spend, 0),
      status: connection.status === "connected" ? "Connected" : "Disconnected",
    };
  });
  const connectedCount = accounts.filter((account) => account.status === "Connected").length;
  return (
    <div className="ai-grid">
      <Panel>
        <SectionTitle
          title="Connected accounts"
          detail="Read access is scoped per tenant and ad account."
          action={<Badge tone={connectedCount ? "success" : "warning"}>{connectedCount} connected</Badge>}
        />
        <div className="connection-list">
          {accounts.map((account) => (
            <div key={account.name}>
              <span className="platform-mark">{account.name[0]}</span>
              <span>
                <strong>{account.name}</strong>
                <small>{account.account || "Account name unavailable"} · {account.campaigns} campaign{account.campaigns === 1 ? "" : "s"} · {account.spend == null ? "Provider spend summary unavailable" : `${money(account.spend)} in the ${adTotals.window.toLowerCase()}`}</small>
              </span>
              <Status value={account.status} />
              <Button kind="quiet" icon={<SettingsIcon size={14} />}>
                Manage
              </Button>
            </div>
          ))}
        </div>
        <div className="inline-note">
          <Link2 size={15} />
          <span>
            <strong>Ad-account access and event delivery are separate connections.</strong>
            <small>These two read campaign spend. Where conversion events are sent is managed in Settings → Tracking &amp; events.</small>
          </span>
        </div>
      </Panel>
      <Panel>
        <SectionTitle
          title="Credential boundary"
          detail="Tokens stay outside the AI workspace."
        />
        <div className="security-note">
          <LockKeyhole size={20} />
          <span>
            <strong>Protected by Credential Broker</strong>
            <small>
              Models receive account health and performance summaries, never
              provider tokens or secrets.
            </small>
          </span>
        </div>
      </Panel>
    </div>
  );
}
function AiCampaigns({ live }: { live?: LiveAiAds }) {
  // Audit remediation P2: both controls on this panel were dead. "New proposal" had no onClick, and
  // each row carried an Ellipsis labelled "More actions" with no handler and no menu -- and unlike the
  // Orders table there is no clickable row underneath, so the click went nowhere at all. The panel
  // describes itself as having "proposal entry points", so both now open the proposal path they name.
  const [notice, setNotice] = useState("");
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2400); };
  return (
    <Panel>
      <SectionTitle
        title="Campaigns"
        detail={`Read-only performance view with proposal entry points · ${adTotals.windowRange}`}
        action={
          <Button kind="primary" icon={<Plus size={15} />} onClick={() => flash("Proposal draft started. Nothing is sent to Meta or TikTok — preview only.")}>
            New proposal
          </Button>
        }
      />
      <div className="campaign-list">
        {(live?.campaigns ?? adCampaigns.map((campaign) => ({ id: campaign.id, name: campaign.name, platform: campaign.platform, status: campaign.state }))).map((campaign) => (
          <div key={campaign.id}>
            <span>
              <strong>{campaign.name}</strong>
              <small>{campaign.platform} · {campaign.id}</small>
            </span>
            <Status value={campaign.status} />
            <strong>{live ? "Read-only" : money((campaign as any).spend)}</strong>
            <strong>{live ? "Provider data" : `${(Math.round(((campaign as any).revenue / (campaign as any).spend) * 100) / 100).toFixed(2)}x ROAS`}</strong>
            <button type="button" className="icon-button" aria-label={`Create a proposal for ${campaign.name}`} onClick={() => flash(`Proposal draft started for ${campaign.name}. Preview only.`)}>
              <Plus size={17} />
            </button>
          </div>
        ))}
      </div>
      {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}
      <div className="event-list-footer"><span>{live ? `${live.campaigns.length} campaigns · provider performance totals unavailable in this read` : `${adCampaigns.length} campaigns · ${money(adTotals.spend)} spend · ${money(adTotals.revenue)} confirmed sales`}</span><span>Campaign and performance figures share the AI Ads data source</span></div>
    </Panel>
  );
}
function AiAnalytics({ live }: { live?: LiveAiAds }) {
  const roas = (live?.performance.roas ?? (adTotals.revenue / adTotals.spend)).toFixed(2);
  const accounts = live ? live.connections.length : new Set(adCampaigns.map((campaign) => campaign.account)).size;
  // The caption and the chart's screen-reader label both stated the total, the peak and the low
  // as their own literals. They read the buckets now, and the buckets add up to adTotals.spend.
  const trendTotal = aiSpendTrend.reduce((total, point) => total + point.value, 0);
  const peak = aiSpendTrend.reduce((best, point) => (point.value > best.value ? point : best));
  const low = aiSpendTrend.reduce((worst, point) => (point.value < worst.value ? point : worst));
  const scaleTop = 3000;
  return (
    <>
      <MetricStrip
        items={[
          { label: "Spend", value: money(live?.performance.spend ?? adTotals.spend), hint: live ? "Authenticated provider read" : `${adTotals.window} · ${adTotals.windowRange}` },
          { label: "Clicks", value: (live?.performance.clicks ?? adTotals.clicks).toLocaleString("en-BD"), hint: `Across ${accounts} ad accounts` },
          { label: "Confirmed orders", value: String(live?.performance.conversions ?? adTotals.confirmed), hint: live ? "Provider conversion summary" : `CPA ${money(Math.round(adTotals.spend / adTotals.confirmed))}` },
          { label: "ROAS", value: `${roas}x`, hint: live ? "Provider conversion summary" : `Revenue ${money(adTotals.revenue)}` },
        ]}
      />
      <Panel>
        <SectionTitle
          title="Ad spend trend"
          detail={live ? "Historical trend is not returned by the current read contract." : `Spend in three-day buckets · ${adTotals.windowRange}`}
          action={<Badge>{live ? "Provider summary" : "Meta + TikTok"}</Badge>}
        />
        {live ? <div className="empty-state"><BarChart3 size={20} /><strong>Trend unavailable</strong><span>The authenticated AI Ads read returned summary metrics only. No trend data is inferred from sample values.</span></div> : <div className="chart-placeholder tall">
          <div className="chart-plot">
            <div
              className="chart-bars green"
              role="img"
              aria-label={`Ad spend in three-day buckets across ${adTotals.windowRange}. Lowest ${money(low.value)} in ${low.label}, highest ${money(peak.value)} in ${peak.label}, ${money(trendTotal)} total.`}
            >
              {aiSpendTrend.map((point) => (
                <i key={point.label} style={{ height: `${Math.round((point.value / scaleTop) * 100)}%` }} title={`${point.label}: ${money(point.value)}`} />
              ))}
            </div>
            <div className="chart-scale" aria-hidden="true">
              <span>BDT 3K</span>
              <span>BDT 1.5K</span>
              <span>BDT 0</span>
            </div>
          </div>
          <div className="chart-axis">
            <span>{aiSpendTrend[0].label.split("–")[0]}</span>
            <span>Aug 6</span>
            <span>Aug 21</span>
          </div>
          <p className="chart-caption">Spend only. Revenue for the same window is on the ROAS tile above · {money(trendTotal)} total, peak {money(peak.value)} in {peak.label}.</p>
        </div>}
      </Panel>
    </>
  );
}
function AiChat({ live }: { live?: LiveAiAds }) {
  // Audit remediation P1: all three prompt chips called setSent(true) and produced the same
  // canned paragraph, the paragraph claimed "ROAS is stable at 5.8x" while every other surface
  // said 4.07x, and the input plus Send button had no state or handler at all -- typing a
  // question and pressing Send did nothing. Each prompt has its own answer built from the same
  // campaign data the rest of the page reads, and a typed question is echoed and answered.
  const spend = live?.performance.spend ?? adTotals.spend;
  const revenue = live?.performance.revenue ?? adTotals.revenue;
  const roas = live?.performance.roas ?? (spend ? revenue / spend : 0);
  const liveCampaignName = live?.campaigns[0]?.name;
  const answers: Record<string, string> = {
    "How is return trending?": live ? `The authenticated provider summary reports ${roas.toFixed(2)}x ROAS — ${money(revenue)} revenue on ${money(spend)} spend, with ${live.performance.conversions} conversions. Historical comparison is not returned by this read contract.` : `Return is ${roas.toFixed(2)}x over ${adTotals.windowRange} — ${money(revenue)} confirmed on ${money(spend)} of spend, up ${(((roas) / (adBaselines["Previous period"].revenue / adBaselines["Previous period"].spend) - 1) * 100).toFixed(1)}% on ${adBaselines["Previous period"].label}.`,
    "Find campaigns to review": live ? (liveCampaignName ? `${liveCampaignName} is available in the authenticated campaign read. The live contract does not include campaign-level spend or ROAS, so this preview will not rank campaigns without those fields.` : "No campaign rows were returned by the authenticated provider read.") : `${weakestActive.name} is the weakest still-running campaign at ${roasOf(weakestActive).toFixed(2)}x, against ${roasOf(strongest).toFixed(2)}x on ${strongest.name}. ${adCampaigns.filter((c) => c.state !== "Active").map((c) => `${c.name} is already ${c.state.toLowerCase()}`).join(", ")}.`,
    "Plan a safe budget test": live ? "A live proposal cannot be drafted from this read-only prototype because campaign budget fields are not present in the GET contract. Review campaign data in the backend proposal flow; this preview never executes provider writes." : `A proposal is ready: ${adProposal.action.toLowerCase()} on ${adProposal.campaign.name} from ${money(adProposal.campaign.daily)} to ${money(adProposal.dailyAfter)} a day. It needs your approval before any provider write, and this preview never executes it.`,
  };
  const prompts = Object.keys(answers);
  const [thread, setThread] = useState<Array<{ question: string; answer: string }>>([]);
  const [draft, setDraft] = useState("");
  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setThread((items) => [...items, { question: trimmed, answer: answers[trimmed] ?? `The sample workspace only answers the three prompts above. “${trimmed}” is not part of this preview, so nothing was sent to a model.` }]);
    setDraft("");
  };
  return (
    <Panel className="chat-panel">
      <div className="chat-empty">
        <span className="ai-mark">
          <BriefcaseBusiness size={20} />
        </span>
        <h2>What should we review?</h2>
        <p>
          Ask about performance, account health, or a proposed change. The AI
          can read approved summaries and create proposals, but cannot execute
          writes.
        </p>
        <div className="prompt-chips">
          {prompts.map((prompt) => (
            <button key={prompt} onClick={() => ask(prompt)}>{prompt}</button>
          ))}
        </div>
        {thread.map((entry, index) => (
          <div className="chat-message" key={`${entry.question}-${index}`}>
            <strong>{entry.question}</strong>
            <span>{entry.answer}</span>
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input aria-label="Ask about your ads" placeholder="Ask about your ads..." value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") ask(draft); }} />
        <Button kind="primary" icon={<Send size={15} />} onClick={() => ask(draft)} disabled={!draft.trim()}>
          Send
        </Button>
      </div>
    </Panel>
  );
}

// Audit remediation P2: the guide reported 0% and "Not started yet" on every step while
// Settings → Store connection showed the plugin detected, a heartbeat minutes old and
// three healthy destinations. Each step now states the evidence that satisfies it, and
// only the one thing that genuinely has not happened is left open.
const setupSteps = [
  { title: "Install the WordPress plugin", verified: true, evidence: `${storeConnection.plugin} v${storeConnection.pluginVersion} detected on ${storeConnection.wordpress}`, todo: "Download the ZIP and activate it in WordPress." },
  { title: "Connect your Buykori account", verified: true, evidence: `Client ${storeConnection.clientId} linked on ${storeConnection.memberSince}`, todo: "Paste the workspace key from Settings → Store connection." },
  { title: "Connect a tracking destination", verified: true, evidence: `${platformDelivery.length} destinations connected · ${platformDelivery.map((p) => p.name).join(", ")}`, todo: "Add at least one destination in Settings → Tracking & events." },
  { title: "Choose which events to send", verified: true, evidence: `${defaultTrackedEvents.length} events enabled · ${defaultTrackedEvents[0]} through ${defaultTrackedEvents[defaultTrackedEvents.length - 1]}`, todo: "Pick the events your store should report." },
  { title: "Run a connection test", verified: true, evidence: `Heartbeat received ${storeConnection.heartbeatAt} from ${storeConnection.domain}`, todo: "Run Test connection from Settings → Store connection." },
  { title: "Send and verify a test event", verified: false, evidence: "", todo: "Fire one test Purchase and confirm it reaches all three destinations." },
];
const recommendedSteps: Array<{ page: Page; title: string; detail: string; icon: React.ReactNode }> = [
  { page: "settings", title: "Connect a courier", detail: "Book shipments and sync delivery updates.", icon: <Truck size={18} /> },
  { page: "cod", title: "Enable COD review", detail: "Keep false purchases out of ad data.", icon: <ShieldCheck size={18} /> },
  { page: "settings", title: "Add alerts", detail: "Get order and recovery notifications.", icon: <Bell size={18} /> },
];
function SetupGuide({ go }: { go: (p: Page) => void }) {
  const [done, setDone] = useState<string[]>(setupSteps.filter((step) => step.verified).map((step) => step.title));
  const [notice, setNotice] = useState("");
  const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(""), 2200); };
  const complete = setupSteps.filter((step) => done.includes(step.title)).length;
  const nextStep = setupSteps.find((step) => !done.includes(step.title));
  return (
    <>
      <PageHeader
        page="setup"
        action={<><Button icon={<Download size={15} />} onClick={() => flash(`Plugin download prepared: ${storeConnection.plugin} v${storeConnection.pluginVersion} · ${storeConnection.pluginSize}. Preview only.`)}>Download plugin</Button><Button icon={<RefreshCw size={15} />} onClick={() => flash("Setup status rechecked locally. Preview only.")}>Refresh status</Button></>}
      />
      <Panel className="setup-progress">
        <div>
            <span className="progress-ring">{Math.round((complete / setupSteps.length) * 100)}%</span>
          <span>
            <strong>{nextStep ? "One step left in your store setup" : "Store setup is complete"}</strong>
            <small>{complete} of {setupSteps.length} required steps complete · {recommendedSteps.length} recommended next</small>
          </span>
        </div>
        <Button kind="primary" disabled={!nextStep} onClick={() => { if (nextStep) { setDone((items) => [...items, nextStep.title]); flash(`${nextStep.title} verified locally. Preview only.`); } }}>
          {nextStep ? `Finish: ${nextStep.title}` : "All steps verified"} {nextStep && <ChevronRight size={15} />}
        </Button>
      </Panel>
      <div className="setup-grid">
        <Panel>
          <SectionTitle
            title="WooCommerce tracking setup"
            detail={`${setupSteps.length} steps are checked automatically as your store connects.`}
            action={<Badge tone={nextStep ? "warning" : "success"}>{nextStep ? `${setupSteps.length - complete} remaining` : "Complete"}</Badge>}
          />
          <div className="checklist">
            {setupSteps.map((step, i) => {
              const isDone = done.includes(step.title);
              return (
                <button key={step.title} onClick={() => { if (!isDone) { setDone((items) => [...items, step.title]); flash(`${step.title} verified locally. Preview only.`); } else { flash(`${step.title} is already verified.`); } }}>
                  <span className={isDone ? "step-number done" : "step-number"}>{isDone ? <Check size={13} /> : i + 1}</span>
                  <span>
                    <strong>{step.title}</strong>
                    <small>{isDone ? (step.evidence || "Verified locally in this preview") : step.todo}</small>
                  </span>
                  {isDone ? <Badge tone="success">Done</Badge> : <Badge tone="warning">To do</Badge>}
                  <ChevronRight size={16} />
                </button>
              );
            })}
          </div>
          <div className="inline-note">
            <ShieldCheck size={15} />
            <span>
              <strong>The first five steps are confirmed by your live connection.</strong>
              <small>Plugin version, heartbeat and destination health come from Settings → Store connection, so they cannot be marked incomplete here.</small>
            </span>
          </div>
        </Panel>
        <Panel>
          <SectionTitle
            title="What’s next"
            detail={`${recommendedSteps.length} recommended actions after the required setup.`}
          />
          <div className="next-list">
            {recommendedSteps.map((step) => (
              <button key={step.title} onClick={() => go(step.page)}>
                {step.icon}
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.detail}</small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
      {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}
    </>
  );
}
type ScanVerdict = { result: "pass" | "fail"; at: string; checked: string; note: string; blocker?: string };

function Health({ fixed, setFixed }: { fixed: string[]; setFixed: React.Dispatch<React.SetStateAction<string[]>> }) {
  const [notice, setNotice] = useState(""); const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(""), 2600); };
  // The strip used to be frozen at "27% / 4 need attention / Resolved 6" while the list
  // below reacted to Mark fixed, so the page contradicted itself after one click.
  const [checkedAt, setCheckedAt] = useState("Aug 21, 2026 · 09:52");
  // Audit remediation P1: `Mark fixed` closed an issue and raised the tracking score with nothing
  // verified. A re-scan is now the only path to Resolved, and its verdict stays on the row so the
  // score can be traced back to a check. A failing re-scan leaves the issue open and names the
  // blocker instead of silently doing nothing.
  const [scans, setScans] = useState<Record<string, ScanVerdict>>({});
  const [scanning, setScanning] = useState<string[]>([]);
  const issues = setupIssues;
  const openIssues = issues.filter((issue) => !fixed.includes(issue.title)).length;
  const stillFailing = issues.filter((issue) => !fixed.includes(issue.title) && scans[issue.title]?.result === "fail").length;
  const runScan = (targets: typeof setupIssues, summary: (passed: number, failed: number) => string) => {
    if (targets.length === 0 || scanning.length > 0) return;
    setScanning(targets.map((issue) => issue.title));
    window.setTimeout(() => {
      const at = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const verdicts: Record<string, ScanVerdict> = {};
      targets.forEach((issue) => {
        verdicts[issue.title] = { result: issue.rescan.passes ? "pass" : "fail", at, checked: issue.rescan.checked, note: issue.rescan.result, blocker: issue.rescan.blocker };
      });
      const passed = targets.filter((issue) => issue.rescan.passes).map((issue) => issue.title);
      setScans((current) => ({ ...current, ...verdicts }));
      setFixed((items) => [...items, ...passed.filter((title) => !items.includes(title))]);
      setScanning([]);
      setCheckedAt(`Aug 21, 2026 · ${at}`);
      flash(summary(passed.length, targets.length - passed.length));
    }, 850);
  };
  const recheckAll = () => {
    const open = issues.filter((issue) => !fixed.includes(issue.title));
    if (open.length === 0) { flash("Nothing left to re-scan — every issue is verified. Preview only."); return; }
    runScan(open, (passed, failed) => `Re-scanned ${open.length} open ${open.length === 1 ? "issue" : "issues"} · ${passed} verified fixed, ${failed} still failing. Preview only.`);
  };
  const busy = scanning.length > 0;
  return (
    <>
      <PageHeader
        page="health"
        action={
          <Button kind="primary" icon={<RefreshCw size={15} className={busy ? "spin" : ""} />} onClick={recheckAll} disabled={busy}>
            {busy ? "Checking…" : "Check my setup"}
          </Button>
        }
      />
      <MetricStrip
        items={[
          {
            label: "Tracking score",
            value: `${setupScore(openIssues)}%`,
            hint: `${openIssues} of ${workspaceMetrics.setupChecks} checks need attention`,
            icon: <AlertTriangle size={14} />,
          },
          {
            label: "Critical",
            value: String(issues.filter((issue) => issue.tone === "danger" && !fixed.includes(issue.title)).length),
            hint: "Fix first",
            icon: <AlertTriangle size={14} />,
          },
          {
            label: "Warnings",
            value: String(issues.filter((issue) => issue.tone === "warning" && !fixed.includes(issue.title)).length),
            hint: "Improve when ready",
            icon: <Zap size={14} />,
          },
          {
            label: "Resolved this month",
            value: String(workspaceMetrics.resolvedThisMonth + fixed.length),
            hint: `${workspaceMetrics.resolvedThisMonth} before this review · each verified by a re-scan`,
            icon: <Check size={14} />,
          },
        ]}
      />
      <Panel className="setup-health-panel">
        <SectionTitle
          title="Recommended fixes"
          detail={`An issue closes only when a re-scan passes · last checked ${checkedAt}`}
          action={<Button kind="quiet" icon={<RefreshCw size={14} className={busy ? "spin" : ""} />} onClick={recheckAll} disabled={busy}>{busy ? "Re-scanning…" : "Re-scan all open"}</Button>}
        />
        <div className="health-list-summary"><span><strong>{openIssues}</strong> open issues</span><span><strong>{fixed.length}</strong> verified by re-scan</span>{stillFailing > 0 && <span><strong>{stillFailing}</strong> failed the last re-scan</span>}<small>Work from critical to suggestion</small></div>
        <div className="health-list-header"><span /><span>Issue</span><span>Why it matters</span><span>Actions</span></div>
        <div className="health-list">
          {issues.map((issue) => {
            const resolved = fixed.includes(issue.title);
            const checking = scanning.includes(issue.title);
            const scan = scans[issue.title];
            return (
            <article key={issue.title} className={resolved ? "resolved" : ""}>
              <div className={`health-icon ${issue.tone}`}>
                {resolved ? <Check size={18} /> : <AlertTriangle size={18} />}
              </div>
              <div className="health-issue-copy">
                <div>
                  <Badge tone={resolved ? "success" : issue.tone}>
                    {resolved
                      ? "Verified fixed"
                      : issue.tone === "danger"
                      ? "Critical"
                      : issue.tone === "warning"
                        ? "Warning"
                        : "Suggestion"}
                  </Badge>
                  <span className="platform-label">{issue.platform}</span>
                </div>
                <h3>{issue.title}</h3>
                <p>{issue.detail}</p>
                <small className="health-evidence">{resolved ? `Was open since ${issue.firstSeen}` : `Open since ${issue.firstSeen} · ${issue.evidence}`}</small>
                {checking ? (
                  <p className="health-scan checking"><RefreshCw size={13} className="spin" /><span>{issue.rescan.checked}…</span></p>
                ) : scan ? (
                  <p className={`health-scan ${scan.result}`}>
                    {scan.result === "pass" ? <Check size={13} /> : <AlertTriangle size={13} />}
                    <span>
                      <strong>{scan.result === "pass" ? `Passed re-scan at ${scan.at}` : `Failed re-scan at ${scan.at}`}</strong>
                      {" "}{scan.checked} · {scan.note}.
                      {scan.result === "fail" && scan.blocker ? <em>Do this first: {scan.blocker}</em> : null}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="health-impact"><span>Impact</span><p>{issue.impact}</p></div>
              <div className="health-actions">{resolved ? (
                <>
                  <Button icon={<RotateCcw size={14} />} onClick={() => { setFixed((items) => items.filter((title) => title !== issue.title)); setScans((current) => { const next = { ...current }; delete next[issue.title]; return next; }); flash(`${issue.title} reopened. Re-scan to verify it again. Preview only.`); }}>Reopen</Button>
                  <Button kind="quiet" icon={<Check size={14} />} disabled>Verified</Button>
                </>
              ) : (
                <>
                  <Button icon={<ChevronRight size={14} />} onClick={() => flash(`${issue.title} fix path opened. Preview only.`)} disabled={checking}>Review fix</Button>
                  <Button
                    kind="primary"
                    icon={<RefreshCw size={14} className={checking ? "spin" : ""} />}
                    disabled={busy}
                    onClick={() => runScan([issue], (passed) => passed > 0 ? `${issue.title} passed its re-scan and is now verified fixed. Preview only.` : `${issue.title} failed its re-scan and stays open. Preview only.`)}
                  >
                    {checking ? "Verifying…" : "Re-scan"}
                  </Button>
                </>
              )}</div>
            </article>
            );
          })}
        </div>
      </Panel>
      {notice && <div className="inline-preview-feedback analytics-feedback"><Check size={15} />{notice}</div>}
    </>
  );
}

function Settings({
  section,
  setSection,
  go,
  codProtection,
}: {
  section: SettingsSection;
  setSection: (s: SettingsSection) => void;
  go: (p: Page) => void;
  codProtection: CodProtection;
}) {
  const nav: Array<{
    id: SettingsSection;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: "store", label: "Store connection", icon: <Store size={16} /> },
    {
      id: "tracking",
      label: "Tracking & events",
      icon: <Activity size={16} />,
    },
    { id: "ads", label: "Ad accounts", icon: <BarChart3 size={16} /> },
    { id: "shipping", label: "Courier partners", icon: <Truck size={16} /> },
    { id: "alerts", label: "Alerts & notifications", icon: <Bell size={16} /> },
  ];
  return (
    <>
      <PageHeader
        page="settings"
        action={<span className="heading-note">Every card saves on its own. Toggles apply immediately.</span>}
      />
      {/* `aria-label` was sitting on a bare <div> with no role, where it is simply dropped --
          the strip announced nothing. This is also the one strip whose content already lives in
          a single container, so it is the one place the full tab/panel relationship is free:
          the panel points back at the selected tab, so a screen reader reaching the content
          hears which section it belongs to. `aria-current` goes -- `aria-selected` is the
          property a tab is meant to carry, and two competing states is one too many. */}
      <Tabs
        className="settings-section-tabs section-tabs"
        label="Settings sections"
        value={section}
        onChange={setSection}
        panelId="settings-panel"
        items={nav.map((item) => ({ id: item.id, label: <>{item.icon}<span>{item.label}</span></> }))}
      />
      <div
        className="settings-content settings-content-wide"
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`settings-panel-tab-${tabSlug(section)}`}
        tabIndex={-1}
      >
          {section === "store" && <SettingStore />}
          {section === "tracking" && <SettingTracking go={go} codProtection={codProtection} />}
          {section === "ads" && <SettingAds />}
          {section === "shipping" && <SettingShipping />}
          {section === "alerts" && <SettingAlerts />}
      </div>
    </>
  );
}
function SettingStore() {
  const [notice, setNotice] = useState(""); const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2600); };
  // Audit remediation P2: the domain field was an uncontrolled defaultValue and Save domain
  // flashed the same sentence whatever you typed, so the card could not tell you it had read
  // anything. It is controlled now, Save reports the value it saved, and the field starts on
  // the HTTPS address its own hint asks for instead of a bare hostname.
  const [domain, setDomain] = useState(storeConnection.siteUrl);
  const save = () => {
    const value = domain.trim();
    if (!value) return flash("Enter your store address before saving.");
    if (!/^https:\/\//i.test(value)) return flash(`“${value}” is not an HTTPS address. Add https:// so event requests are signed against the same origin WordPress reports.`);
    flash(`Store address saved locally as ${value}. Preview only — nothing was sent to WordPress.`);
  };
  return (
    <>
      <Panel className="store-connection-overview">
        <SectionTitle
          title="Store connection"
          detail="One view of your website, plugin and connection heartbeat."
          action={<Status value="Healthy" />}
        />
        <div className="connection-health-grid store-health-grid">
          <div><span>Connection</span><strong><Status value="Connected" /></strong><small>Events can be received</small></div>
          <div><span>Plugin</span><strong>{storeConnection.plugin}</strong><small>Version {storeConnection.pluginVersion} · detected</small></div>
          <div><span>Last heartbeat</span><strong>{storeConnection.heartbeatAt}</strong><small>{storeConnection.platform} store</small></div>
        </div>
        <div className="store-connection-body">
          <div className="store-domain-block">
            <div className="store-block-heading"><div><strong>Website address</strong><small>The store address your plugin reports events from.</small></div><span className="platform-mark">W</span></div>
            <div className="form-grid one"><label>Store domain<input value={domain} onChange={(event) => setDomain(event.target.value)} inputMode="url" /></label></div>
            <div className="store-inline-actions"><Button kind="primary" onClick={save}>Save domain</Button><span>Use the canonical HTTPS domain from WordPress.</span></div>
          </div>
          <div className="store-heartbeat-block">
            <div className="store-block-heading"><div><strong>WordPress connection</strong><small>Connection status and plugin heartbeat.</small></div><Status value="Connected" /></div>
            <div className="heartbeat-detail"><span><strong>{storeConnection.platform} store</strong><small>{storeConnection.wordpress} · heartbeat received {storeConnection.heartbeatAt}</small></span><Button icon={<RefreshCw size={14} />} onClick={() => flash("Connection test passed in preview. No live request sent.")}>Test connection</Button></div>
          </div>
        </div>
        {notice && <div className="inline-preview-feedback store-feedback"><Check size={15} />{notice}</div>}
      </Panel>
    </>
  );
}
// The routing grid labels its columns visually only, so each checkbox has to
// carry both coordinates — event and destination — in its own name.
const routeDestinationLabels = { meta: "Meta CAPI", tiktok: "TikTok", ga4: "GA4" } as const;
function SettingTracking({ go, codProtection }: { go: (p: Page) => void; codProtection: CodProtection }) {
  const [notice, setNotice] = useState("");
  const [openPlatform, setOpenPlatform] = useState("Meta CAPI");
  const [events, setEvents] = useState(defaultTrackedEvents.slice());
  const [newEvent, setNewEvent] = useState("");
  const [eventPreset, setEventPreset] = useState("");
  const [automations, setAutomations] = useState([
    { id: "auto_stay", name: "Stay15Seconds", trigger: "timer", selector: "15", urlPattern: "", seconds: 15, scrollDepth: 50, value: "0", currency: "BDT", customParam: "landing_timer", enabled: true },
    { id: "auto_newsletter", name: "NewsletterSignup", trigger: "form", selector: ".newsletter-form", urlPattern: "", seconds: 15, scrollDepth: 50, value: "0", currency: "BDT", customParam: "footer_signup", enabled: true },
  ]);
  const [routes, setRoutes] = useState<Record<string, Record<string, boolean>>>({
    PageView: { meta: true, tiktok: true, ga4: true }, ViewContent: { meta: true, tiktok: true, ga4: true },
    AddToCart: { meta: true, tiktok: true, ga4: true }, InitiateCheckout: { meta: true, tiktok: true, ga4: true },
    Purchase: { meta: true, tiktok: true, ga4: true }, Lead: { meta: true, tiktok: false, ga4: true },
  });
  const [credentials, setCredentials] = useState<Record<string, { destination: string; secret: string; test: string; enabled: boolean }>>({
    "Meta CAPI": { destination: "", secret: "", test: "", enabled: false },
    "TikTok Events API": { destination: "", secret: "", test: "", enabled: false },
    "GA4 Measurement": { destination: "", secret: "", test: "", enabled: false },
  });
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2200); };
  const platforms = [
    { key: "Meta CAPI", short: "M", idLabel: "Meta Pixel ID", secretLabel: "Access Token", help: "Meta Events Manager → Data Sources → Pixel → Settings → Conversions API." },
    { key: "TikTok Events API", short: "T", idLabel: "TikTok Pixel ID", secretLabel: "Events API Access Token", help: "TikTok Events Manager → Web Events → Pixel → Events API." },
    { key: "GA4 Measurement", short: "G", idLabel: "Measurement ID", secretLabel: "API Secret", help: "Google Analytics → Admin → Data streams → Measurement Protocol API secrets." },
  ];
  const configuredCount = platforms.filter((platform) => credentials[platform.key].destination && credentials[platform.key].secret).length;
  const presetEvents = ["Search","Contact","CompleteRegistration","AddPaymentInfo","ViewCart","RemoveFromCart","Refund","Subscribe"];
  const updateCredential = (platform: string, field: "destination" | "secret" | "test", value: string) => setCredentials((items) => ({ ...items, [platform]: { ...items[platform], [field]: value } }));
  const addEvent = () => { const value = (newEvent || eventPreset).trim().replace(/[^A-Za-z0-9_]/g, ""); if (!value || events.includes(value)) return flash("Choose or enter a new unique event name."); setEvents((items) => [...items, value]); setRoutes((items) => ({ ...items, [value]: { meta: true, tiktok: false, ga4: true } })); setNewEvent(""); setEventPreset(""); flash(`${value} route added locally.`); };
  const updateAutomation = (index: number, patch: Record<string, string | number | boolean>) => setAutomations((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const addAutomation = () => setAutomations((items) => [...items, { id: `auto_${Date.now()}`, name: "", trigger: "timer", selector: "15", urlPattern: "", seconds: 15, scrollDepth: 50, value: "0", currency: "BDT", customParam: "", enabled: true }]);
  const saveAutomations = () => { const validNames = automations.map((item) => item.name.trim()).filter(Boolean); if (!validNames.length) return flash("Add an event name before saving custom events."); const missing = validNames.filter((name) => !events.includes(name)); if (missing.length) { setEvents((items) => [...items, ...missing]); setRoutes((items) => ({ ...items, ...Object.fromEntries(missing.map((name) => [name, { meta: true, tiktok: false, ga4: true }])) })); } flash(`Saved ${validNames.length} custom event configurations locally.`); };
  const triggerHelp = (automation: typeof automations[number]) => automation.trigger === "timer" ? `Runs once after a visitor stays ${automation.seconds || 15} seconds.` : automation.trigger === "scroll" ? `Runs after the visitor reaches ${automation.scrollDepth || 50}% scroll depth.` : automation.trigger === "url" ? `Runs when the page URL contains ${automation.urlPattern || "the configured text"}.` : automation.trigger === "form" ? `Runs when ${automation.selector || "the selected form"} is submitted.` : automation.trigger === "visible" ? `Runs when ${automation.selector || "the selected element"} becomes visible.` : `Runs when ${automation.selector || "the selected element"} is clicked.`;
  return (
    <>
      <Panel>
        <SectionTitle
          title="Tracking destinations"
          detail="Add the platform destination ID and delivery secret before enabling events."
          action={<Badge tone={configuredCount === 3 ? "success" : "warning"}>{configuredCount} of 3 configured</Badge>}
        />
        <div className="tracking-destination-list">{platforms.map((platform) => { const config = credentials[platform.key]; const configured = Boolean(config.destination && config.secret); return <div className={`tracking-destination-card ${openPlatform === platform.key ? "open" : ""}`} key={platform.key}><div className="tracking-destination-head"><span className="platform-mark">{platform.short}</span><span className="tracking-destination-copy"><strong>{platform.key}</strong><small>{configured ? "Credentials saved · ready for delivery" : "Setup required before events can be sent"}</small></span><Badge tone={configured ? "success" : "warning"}>{configured ? "Configured" : "Needs setup"}</Badge><button className="tracking-configure-button" onClick={() => setOpenPlatform(openPlatform === platform.key ? "" : platform.key)}>{openPlatform === platform.key ? "Hide details" : "Configure"}<ChevronDown size={14}/></button></div>{openPlatform === platform.key && <div className="tracking-credential-editor"><div className="tracking-help"><KeyRound size={15}/><span><strong>Where to find these values</strong><small>{platform.help}</small></span></div><div className="tracking-credential-grid"><label>{platform.idLabel}<input value={config.destination} onChange={(event)=>updateCredential(platform.key,"destination",event.target.value)} placeholder={platform.key === "GA4 Measurement" ? "G-XXXXXXXXXX" : "Paste destination ID"}/></label><label>{platform.secretLabel}<input type="password" value={config.secret} onChange={(event)=>updateCredential(platform.key,"secret",event.target.value)} placeholder="Paste secret securely"/></label><label>Test event code <span className="optional">Optional</span><input value={config.test} onChange={(event)=>updateCredential(platform.key,"test",event.target.value)} placeholder="Only for sandbox verification"/></label></div><div className="tracking-editor-footer"><span><ShieldCheck size={14}/> Secrets stay masked in the preview.</span><div><button onClick={()=>flash(`${platform.key} credentials validated locally.`)}>Validate setup</button><button type="button" aria-pressed={config.enabled} className={`toggle ${config.enabled ? "on" : ""}`} aria-label={`Toggle ${platform.key}`} onClick={()=>setCredentials((items)=>({...items,[platform.key]:{...items[platform.key],enabled:!items[platform.key].enabled}}))}><i/></button></div></div></div>}</div>})}</div>
      </Panel>
      <Panel>
        <SectionTitle
          title="Events to send"
          detail="Choose which events leave your store and where each event should be delivered."
          action={<div className="event-add-control"><select aria-label="Add a preset event" value={eventPreset} onChange={(event)=>{setEventPreset(event.target.value);setNewEvent("");}}><option value="">Preset event...</option>{presetEvents.filter((name)=>!events.includes(name)).map((name)=><option key={name}>{name}</option>)}</select><input aria-label="Custom event name" value={newEvent} onChange={(event)=>{setNewEvent(event.target.value.replace(/[^A-Za-z0-9_]/g,""));setEventPreset("");}} placeholder="Or custom name"/><Button icon={<Plus size={15} />} onClick={addEvent}>Add event</Button></div>}
        />
        <div className="event-routing-table"><div className="event-routing-header"><span>Event route</span><span>Meta CAPI</span><span>TikTok</span><span>GA4</span><span>State</span></div>{events.map((name)=><div className="event-routing-row" key={name}><span><strong>{name}</strong><small>{["PageView","ViewContent","AddToCart","InitiateCheckout","Purchase","Lead"].includes(name)?"Standard event":"Custom route"}</small></span>{(["meta","tiktok","ga4"] as const).map((provider)=><label key={provider} className="route-checkbox"><input type="checkbox" aria-label={`Send ${name} to ${routeDestinationLabels[provider]}`} checked={Boolean(routes[name]?.[provider])} onChange={()=>setRoutes((items)=>({...items,[name]:{...items[name], [provider]:!items[name]?.[provider]}}))}/><i/></label>)}<Badge tone={Object.values(routes[name]||{}).some(Boolean)?"success":"neutral"}>{Object.values(routes[name]||{}).filter(Boolean).length} destinations</Badge></div>)}</div>
        <div className="tracking-routing-note"><Check size={15}/><span><strong>Routing is credential-aware</strong><small>An enabled route only sends through a destination that has its required ID and secret configured.</small></span></div>
        {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}<Button kind="primary" onClick={() => flash("Event routing saved locally. Preview only.")}>Save event routing</Button>
      </Panel>
      <Panel className="custom-event-panel">
        <SectionTitle title="Create custom events" detail="Create an event from a timer, click, form, page URL, scroll depth or visible section—without adding code." action={<div className="custom-event-actions"><Button icon={<Plus size={15}/>} onClick={addAutomation}>Add custom event</Button><Button kind="primary" icon={<Check size={15}/>} onClick={saveAutomations}>Save custom events</Button></div>}/>
        <div className="custom-event-example"><Zap size={15}/><span><strong>Behavior becomes an event, then routing decides where it goes.</strong><small>Example: Stay15Seconds + Timer 15 sec, or NewsletterSignup + Form selector .newsletter-form.</small></span></div>
        <div className="custom-automation-list">{automations.map((automation,index)=>{const routeExists=events.includes(automation.name);const detailLabel=automation.trigger === "timer" ? "Seconds" : automation.trigger === "scroll" ? "Scroll percent" : automation.trigger === "url" ? "URL contains" : "CSS selector";const detailValue=automation.trigger === "url" ? automation.urlPattern : automation.trigger === "timer" ? String(automation.seconds) : automation.trigger === "scroll" ? String(automation.scrollDepth) : automation.selector;return <article key={automation.id} className={automation.enabled?"active":""}><header><span><strong>{automation.name || `Custom event ${index+1}`}</strong><small>{triggerHelp(automation)}</small></span><Badge tone={!automation.name?"warning":routeExists?"success":"info"}>{!automation.name?"Name required":routeExists?"Route ready":"Route added on save"}</Badge></header><div className="automation-primary-grid"><label>Event name<input value={automation.name} onChange={(event)=>updateAutomation(index,{name:event.target.value.replace(/[^A-Za-z0-9_]/g,"")})} placeholder="Stay15Seconds"/></label><label>Trigger<select value={automation.trigger} onChange={(event)=>updateAutomation(index,{trigger:event.target.value})}><option value="timer">Timer</option><option value="click">Button click</option><option value="url">URL match</option><option value="form">Form submit</option><option value="scroll">Scroll depth</option><option value="visible">Element visible</option></select></label><label>{detailLabel}<input type={automation.trigger === "timer" || automation.trigger === "scroll" ? "number":"text"} value={detailValue} onChange={(event)=>automation.trigger === "url"?updateAutomation(index,{urlPattern:event.target.value}):automation.trigger === "timer"?updateAutomation(index,{seconds:Number(event.target.value)||1,selector:event.target.value}):automation.trigger === "scroll"?updateAutomation(index,{scrollDepth:Math.min(100,Number(event.target.value)||1),selector:event.target.value}):updateAutomation(index,{selector:event.target.value})} placeholder={automation.trigger === "url"?"/thank-you":automation.trigger === "timer"?"15":automation.trigger === "scroll"?"50":".button-class"}/></label><div className="automation-manage"><button type="button" aria-pressed={automation.enabled} className={`toggle ${automation.enabled?"on":""}`} aria-label={`Toggle ${automation.name || `custom event ${index+1}`}`} onClick={()=>updateAutomation(index,{enabled:!automation.enabled})}><i/></button><button aria-label={`Remove ${automation.name || `custom event ${index+1}`}`} onClick={()=>setAutomations((items)=>items.filter((_,itemIndex)=>itemIndex!==index))}><Trash2 size={15}/></button></div></div><div className="automation-data-grid"><label>Event value<input type="number" value={automation.value} onChange={(event)=>updateAutomation(index,{value:event.target.value})}/></label><label>Currency<input value={automation.currency} onChange={(event)=>updateAutomation(index,{currency:event.target.value.toUpperCase()})}/></label><label>Custom parameter label<input value={automation.customParam} onChange={(event)=>updateAutomation(index,{customParam:event.target.value})} placeholder="landing_timer"/></label><div className="automation-route-preview"><span>Default route</span><strong>Meta + GA4</strong><small>Change per destination above after saving.</small></div></div></article>})}</div>
      </Panel>
      <Panel>
        <SectionTitle
          title="COD timing"
          detail="Control when confirmed COD orders become Purchase events."
          action={
            <Button onClick={() => go("cod")}>
              Open COD review <ChevronRight size={14} />
            </Button>
          }
        />
        <div className="inline-note">
          <Clock3 size={17} />
          <span>
            <strong>{codProtection.enabled ? `Purchase events are held for up to ${codProtection.holdHours} hours` : "Purchase events are sent as soon as the order is placed"}</strong>
            <small>{codProtection.enabled ? `Auto-confirm after the hold is currently ${codProtection.autoConfirm ? "on" : "off"}.` : "COD review is off, so nothing waits for a decision."}</small>
          </span>
        </div>
      </Panel>
    </>
  );
}
function SettingAds() {
  const [notice, setNotice] = useState(""); const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2200); };
  // Audit remediation P2: this panel had two read-only inputs describing Meta only, so a
  // workspace with TikTok spend and a TikTok campaign looked like it had no TikTok account.
  const accounts = ["Meta", "TikTok"].map((platform) => {
    const owned = adCampaigns.filter((campaign) => campaign.platform === platform);
    return { platform, account: owned[0]?.account ?? "", campaigns: owned.length, spend: owned.reduce((t, c) => t + c.spend, 0) };
  });
  return (
    <>
      <Panel>
        <SectionTitle
          title="Marketing insights"
          detail="Read-only campaign spend, clicks, and confirmed sales."
          action={<Badge tone="success">{accounts.length} connected</Badge>}
        />
        <div className="connection-list">
          {accounts.map((account) => (
            <div key={account.platform}>
              <span className="platform-mark">{account.platform[0]}</span>
              <span>
                <strong>{account.platform} Ads</strong>
                <small>{account.account} · {account.campaigns} campaign{account.campaigns === 1 ? "" : "s"} · {money(account.spend)} in the {adTotals.window.toLowerCase()}</small>
              </span>
              <Status value="Connected" />
              <Badge tone="neutral">Read only</Badge>
            </div>
          ))}
        </div>
        <div className="form-grid">
          <label>
            Access scope
            <input value="Read performance only" readOnly />
          </label>
          <label>
            {/* Audit remediation P2: this said "12 min ago · both accounts" -- the third copy of
                the ad sync stamp, and the last one still relative. Same record as Ad insights. */}
            Last sync
            <input value={`${adTotals.syncedAt} · both accounts`} readOnly />
          </label>
        </div>
        {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}<Button kind="primary" icon={<RefreshCw size={15} />} onClick={() => flash("Ad account sync preview completed. No provider request sent.")}>
          Sync now
        </Button>
      </Panel>
      <Panel>
        <SectionTitle
          title="Connection guide"
          detail="Read-only tokens only · ads_read for Meta, Reporting for TikTok."
        />
        <div className="guide-steps">
          {[
            "Open Meta Business Settings or TikTok Ads Manager",
            "Assign the ad account to Buykori",
            "Generate a read-only reporting token",
            "Connect and verify here",
          ].map((step, i) => (
            <div key={step}>
              <span>{i + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
        <div className="inline-note">
          <LockKeyhole size={15} />
          <span>
            <strong>Buykori never requests write access to an ad account.</strong>
            <small>Campaign changes stay in the AI Ads proposal flow, which needs your approval before any provider write.</small>
          </span>
        </div>
      </Panel>
    </>
  );
}
function SettingShipping() {
  const [notice, setNotice] = useState(""); const [openCourier, setOpenCourier] = useState("steadfast");
  // Audit remediation P2: an order in the Orders table is already booked with Pathao
  // (WC-9281 · PT-849201), yet this page showed Pathao with no credentials and RedX offered
  // as a bookable default. Pathao is connected here; RedX stays the honest "Needs setup"
  // example and is no longer selectable as a booking default.
  const [enabled, setEnabled] = useState({ steadfast: true, pathao: true, redx: false }); const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2200); };
  const [credentialValues, setCredentialValues] = useState<Record<string, Record<string,string>>>({ steadfast: { apiKey: "", secret: "", callback: "https://api.buykori.com/webhooks/courier/steadfast", webhookSecret: "" }, pathao: { clientId: "", clientSecret: "", email: "", password: "", storeId: "", callback: "https://api.buykori.com/webhooks/courier/pathao", webhookSecret: "" }, redx: { token: "", pickupStore: "", areaId: "", areaName: "", callback: "https://api.buykori.com/webhooks/courier/redx" } });
  const providers = [{ id: "steadfast", name: "Steadfast Express", short: "S", logo: "/couriers/steadfast.svg", detail: "Express courier", callbackSeen: "Aug 21, 2026 · 10:42", fields: [{key:"apiKey",label:"API Key"},{key:"secret",label:"Secret Key"}] }, { id: "pathao", name: "Pathao Courier", short: "P", logo: "/couriers/pathao.svg", detail: "Nationwide shipping", callbackSeen: "Aug 20, 2026 · 17:08", fields: [{key:"clientId",label:"Client ID"},{key:"clientSecret",label:"Client Secret"},{key:"email",label:"Merchant email"},{key:"password",label:"Merchant password"},{key:"storeId",label:"Store ID"}] }, { id: "redx", name: "RedX Logistics", short: "R", logo: "/couriers/redx.svg", detail: "Doorstep delivery", callbackSeen: "", fields: [{key:"token",label:"OpenAPI access token"},{key:"pickupStore",label:"Pickup store ID"},{key:"areaId",label:"Delivery area ID"},{key:"areaName",label:"Delivery area name"}] }];
  const isReady = (provider: (typeof providers)[number]) => provider.fields.every((field) => credentialValues[provider.id][field.key]) && enabled[provider.id as keyof typeof enabled];
  const ready = providers.filter(isReady);
  const notReady = providers.filter((provider) => !isReady(provider));
  // Audit remediation P3: "Webhook · 2 callbacks verified" counted providers whose credentials
  // were saved, not providers that have actually received a callback, and "Latest booking" was a
  // bare literal that copied Steadfast's callback minute with no shipment behind it. Both tiles
  // read the provider rows now, and the newest stamp names the provider it arrived from.
  const stampOf = (stamp: string) => new Date(stamp.replace(" · ", " ")).getTime();
  const withCallback = providers.filter((provider) => provider.callbackSeen);
  const latestCallback = withCallback.length
    ? withCallback.reduce((newest, provider) => (stampOf(provider.callbackSeen) > stampOf(newest.callbackSeen) ? provider : newest))
    : null;
  const updateCredential = (provider:string,key:string,value:string)=>setCredentialValues((items)=>({...items,[provider]:{...items[provider],[key]:value}}));
  return (
    <>
      <Panel>
        <SectionTitle
          title="Courier partners"
          detail="Enable a provider, add its credentials, then configure the delivery callback."
          action={<Badge tone={ready.length ? "success" : "warning"}>{ready.length} of {providers.length} ready</Badge>}
        />
        <div className="courier-provider-list">{providers.map((provider)=>{const isEnabled=enabled[provider.id as keyof typeof enabled]; const values=credentialValues[provider.id]; const hasCredentials=provider.fields.every((field)=>values[field.key]); return <div className={`courier-provider-card ${openCourier===provider.id?"open":""}`} key={provider.id}><div className="courier-provider-head"><span className="courier-logo-badge"><img src={provider.logo} alt={`${provider.name} logo`} /></span><span className="courier-provider-copy"><strong>{provider.name}</strong><small>{provider.detail} · {hasCredentials?"Credentials saved":"Setup needed"}</small></span><Badge tone={hasCredentials&&isEnabled?"success":"warning"}>{hasCredentials&&isEnabled?"Connected":"Needs setup"}</Badge><button type="button" aria-pressed={isEnabled} className={`toggle ${isEnabled?"on":""}`} aria-label={`Toggle ${provider.name}`} onClick={()=>setEnabled((items)=>({...items,[provider.id]:!items[provider.id as keyof typeof enabled]}))}><i/></button><button className="courier-configure-button" onClick={()=>setOpenCourier(openCourier===provider.id?"":provider.id)}>{openCourier===provider.id?"Hide":"Configure"}<ChevronDown size={14}/></button></div>{openCourier===provider.id&&<div className="courier-credential-editor"><div className="courier-editor-help"><KeyRound size={15}/><span><strong>{provider.name} credentials</strong><small>Copy these values from your {provider.name} merchant/API panel. Secrets remain masked in this preview.</small></span></div><div className="courier-field-grid">{provider.fields.map((field)=><label key={field.key}>{field.label}<input type={field.key.toLowerCase().includes("secret")||field.key.toLowerCase().includes("password")||field.key.includes("token")?"password":"text"} value={values[field.key]} onChange={(event)=>updateCredential(provider.id,field.key,event.target.value)} placeholder={`Enter ${field.label.toLowerCase()}`}/></label>)}</div><div className="courier-webhook-box"><div><strong>Webhook / callback setup</strong><small>Paste the callback URL into the courier panel, then add the provider authorization secret if required.</small></div><div className="courier-callback-row"><label>Callback URL<input readOnly value={values.callback}/></label><button onClick={()=>flash(`${provider.name} callback URL copied locally.`)}><FileText size={14}/> Copy URL</button></div>{provider.id!=="redx"&&<label className="courier-secret-field">{provider.id==="pathao"?"Webhook secret":"Authorization token"}<input type="password" value={values.webhookSecret||""} onChange={(event)=>updateCredential(provider.id,"webhookSecret",event.target.value)} placeholder="Paste webhook secret"/></label>}<div className="courier-webhook-status"><Badge tone={provider.callbackSeen?"success":"warning"}>{provider.callbackSeen?"Verified":"Waiting for callback"}</Badge><span>{provider.callbackSeen?`Last callback received ${provider.callbackSeen}`:"Save credentials and verify the callback after setup."}</span></div></div><div className="courier-editor-footer"><span><ShieldCheck size={14}/> Credentials are shown only in this local design preview.</span><button onClick={()=>flash(`${provider.name} setup validated locally.`)}>Validate setup</button></div></div>}</div>})}</div>
      </Panel>
      <Panel>
        <SectionTitle title="Connection health" detail="Credentials, callback verification and the newest callback are tracked separately." />
        <div className="connection-health-grid courier-health-grid"><div><span>Credentials</span><strong>{ready.length ? `${ready.map((provider)=>provider.name.split(" ")[0]).join(" + ")} saved` : "None configured"}</strong><Status value={ready.length ? "Connected" : "Needs setup"} /></div><div><span>Webhook</span><strong>{withCallback.length} of {providers.length} callback{withCallback.length===1?"":"s"} verified</strong><Status value={withCallback.length===providers.length ? "Healthy" : withCallback.length ? "Degraded" : "Needs setup"} /></div><div><span>Latest callback</span><strong>{latestCallback ? `${latestCallback.callbackSeen} · ${latestCallback.name.split(" ")[0]}` : "None received yet"}</strong><Status value={latestCallback ? "Healthy" : "Needs setup"} /></div></div>
        {notReady.length > 0 && <div className="inline-note"><AlertTriangle size={16} /><span><strong>{notReady.map((provider)=>provider.name).join(" and ")} {notReady.length===1?"is":"are"} not connected</strong><small>Enable and complete the credential form before booking shipments through {notReady.length===1?"it":"them"}. Unconnected providers are not offered as a booking default below.</small></span></div>}
      </Panel>
      <Panel>
        <SectionTitle
          title="Booking defaults"
          detail="Applied when you book a courier from Orders."
        />
        <div className="form-grid">
          <label>
            Default courier
            <select defaultValue={ready[0]?.name ?? ""}>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.name} disabled={!isReady(provider)}>
                  {provider.name}{isReady(provider) ? "" : " · needs setup"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Default weight
            <input defaultValue="500 g" />
          </label>
          <label>
            Pickup store
            <input defaultValue={storeConnection.workspace} />
          </label>
          <label>
            COD collection
            <select defaultValue="Order total">
              <option>Order total</option>
              <option>Manual amount</option>
            </select>
          </label>
        </div>
        {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}<Button kind="primary" onClick={() => flash("Courier defaults saved locally. Preview only.")}>Save courier settings</Button>
      </Panel>
    </>
  );
}
function SettingAlerts() {
  const [notice, setNotice] = useState("");
  const [telegram, setTelegram] = useState(false);
  const [telegramCode, setTelegramCode] = useState("");
  // Audit remediation P3: failures/weekly sat in this state object while their rows render no
  // toggle at all, so two of the four values could never change and never be read.
  const [preferenceState, setPreferenceState] = useState({ purchase: true, incomplete: true });
  const [testState, setTestState] = useState("");
  const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2200); };
  const generateTelegramCode = () => { setTelegramCode("BK-482913"); flash("One-time Telegram linking code generated locally."); };
  const togglePreference = (key: keyof typeof preferenceState) => setPreferenceState((items) => ({ ...items, [key]: !items[key] }));
  const enabledTelegramAlerts = [
    preferenceState.purchase && "Purchase and order alerts",
    preferenceState.incomplete && "Incomplete checkout recovery",
  ].filter(Boolean) as string[];
  return (
    <>
      <Panel>
        <SectionTitle
          title="Notification channels"
          detail="Only channels that exist in the current portal are shown here."
          action={<Badge tone={telegram ? "success" : "warning"}>{telegram ? "Telegram linked" : "Telegram not linked"}</Badge>}
        />
        <div className="alert-channel">
          <span className="channel-icon">
            <Bell size={17} />
          </span>
          <span>
            <strong>Telegram alerts</strong>
            <small>Private order and recovery alerts</small>
          </span>
           <Status value={telegram ? "Connected" : "Needs setup"} />
           <Button kind="primary" icon={<Link2 size={14} />} onClick={() => telegram ? flash("Telegram is already linked in this preview.") : generateTelegramCode()}>
             {telegram ? "Manage" : "Connect"}
           </Button>
        </div>
        <div className="alert-channel">
          <span className="channel-icon">
            <MessageSquareText size={17} />
          </span>
          <span>
            <strong>Email reports</strong>
            <small>Billing receipts and security emails only</small>
          </span>
           <Status value="Configured" />
           <Button icon={<SettingsIcon size={14} />} onClick={() => flash("Notification email is managed from Account → Profile & security.")}>Manage</Button>
        </div>
        {telegramCode && !telegram && <div className="telegram-link-preview"><div><span>One-time linking code</span><strong>{telegramCode}</strong><small>Open the official Buykori Telegram bot and send this code. It expires in 10 minutes.</small></div><div><Button onClick={() => flash("Telegram code copied locally.")}>Copy code</Button><Button kind="primary" onClick={() => { setTelegram(true); setTelegramCode(""); flash("Telegram connection confirmed in preview."); }}>Mark linked</Button></div></div>}
      </Panel>
      <Panel>
        {/* Audit remediation P2: Send test alert queued an "Email test" whenever Telegram was
            unlinked, while the email channel one panel up is scoped to "billing receipts and
            security emails only" -- so the button offered to test alerts down a channel that
            does not carry alerts. With no alert channel linked there is nothing to test, and the
            button says that instead of queueing a fiction. */}
        <SectionTitle title="Delivery and testing" detail="Test only a channel that is actually configured." action={<Button icon={<Send size={14} />} disabled={!telegram} onClick={() => { setTestState(`Telegram test queued · ${storeConnection.heartbeatAt}`); flash("Telegram test alert queued locally. Preview only."); }}>Send test alert</Button>} />
        <div className="alert-delivery-grid"><div><span>Telegram</span><strong>{telegram ? "Connected · chat linked" : "Not connected"}</strong><small>{telegram ? "Purchase + incomplete checkout alerts" : "Link Telegram to receive store alerts"}</small></div><div><span>Notification email</span><strong>{contactEmails.notifications}</strong><small>Set in Account → Profile &amp; security · billing receipts go to {contactEmails.billing}</small></div></div>
        {!telegram && <p className="inline-note">Store alerts only leave through Telegram, so there is nothing to test yet. Email carries billing receipts and security mail, not order alerts.</p>}
        {testState && <div className="inline-preview-feedback"><Check size={15}/>{testState}</div>}
      </Panel>
      <Panel>
        <SectionTitle
          title="Alert preferences"
          detail="These are the notification capabilities currently supported by the portal."
        />
        {notice && <div className="inline-preview-feedback"><Check size={15} />{notice}</div>}
        {[{key:"purchase",label:"Purchase and order alerts",detail:"Telegram · Included in current client alert capability",supported:true},{key:"incomplete",label:"Incomplete checkout recovery",detail:"Telegram · Review and contact leads from the portal",supported:true},{key:"failures",label:"Failed delivery requests",detail:"Visible in Delivery logs and Setup health · channel preference is not persisted yet",supported:false},{key:"weekly",label:"Weekly performance report",detail:"Available from Dashboard download · scheduled email preference is not implemented",supported:false}].map((item)=><div className="alert-preference-row" key={item.key}><span className="alert-preference-icon">{item.supported?<Check size={15}/>:<Clock3 size={15}/>}</span><span><strong>{item.label}</strong><small>{item.detail}</small></span><Badge tone={item.supported?"success":"neutral"}>{item.supported?"Available":"Informational"}</Badge>{item.supported&&<button type="button" aria-pressed={preferenceState[item.key as keyof typeof preferenceState]} aria-label={`Toggle ${item.label}`} className={`toggle ${preferenceState[item.key as keyof typeof preferenceState]?"on":""}`} onClick={()=>togglePreference(item.key as keyof typeof preferenceState)}><i /></button>}</div>)}
        {/* Both supported preferences default to on, which read as "alerts are working" while the
            only channel that carries them was never linked. The gap is stated rather than implied. */}
        {!telegram && enabledTelegramAlerts.length > 0 && <p className="inline-note">{enabledTelegramAlerts.length === 1 ? `${enabledTelegramAlerts[0]} is on` : `${enabledTelegramAlerts.join(" and ")} are on`}, but nothing is delivered until Telegram is linked above.</p>}
      </Panel>
    </>
  );
}

// One source of truth for everything the billing tab states. The cycle anchor is
// day 24, so with "today" at Aug 21 2026 the last issued invoice is Jul 24 and the
// next charge is Aug 24 -- the old copy claimed a Sep 24 renewal off a Jun 24
// payment, which silently skipped two months.
// Audit remediation P2: Compare plans hardcoded its own limits while the usage bars above it
// hardcoded different ones, and "Growth" was flagged current by a literal `current:true` that
// would keep pointing at Growth after a plan change. One catalogue now feeds the plan cards,
// the usage limits and the downgrade warning.
const planCatalog = [
  { name: "Free", price: 0, stores: 1, events: 10000, orders: 50, description: "Start server-side Meta tracking", extras: ["Meta Pixel and Conversions API", "Browser and server event deduplication", "Dashboard, event logs, and campaign URL tools", "7 days of event history"] },
  { name: "Starter", price: 499, stores: 1, events: 200000, orders: 500, description: "Complete tools for one small store", extras: ["Meta CAPI, TikTok Events API, and GA4", "Telegram order and recovery alerts", "Incomplete checkout recovery", "COD controls and manual courier booking", "60 days of event history"] },
  { name: "Growth", price: 799, stores: 1, events: 500000, orders: 2000, description: "More capacity for a growing store", extras: ["Everything included in Starter", "Higher event and order capacity", "60 days of event history"] },
  { name: "Pro", price: null, stores: 3, events: 1000000, orders: 5000, description: "Independent tracking for multiple stores", extras: ["Everything included in Growth", "Independent Meta, TikTok, and GA4 setup per store", "Priority support and onboarding help"] },
];
// Prices are VAT-inclusive, so an invoice has to break the 15% out to match the VAT BIN this
// workspace files under. The billing page used to show a flat total and no tax line at all.
const vatSplit = (total: number) => { const base = Math.round(total / 1.15); return { base, vat: total - base }; };
const currentPlan = planCatalog.find((plan) => plan.name === "Growth")!;
// Audit remediation P2: `daysToCharge: 3` was a hand-typed number sitting beside a hand-typed
// "Aug 24, 2026" -- two statements about the same gap, maintained separately. Move either and the
// plan header starts lying with no test to catch it. The prototype is a frozen snapshot dated
// Aug 21, 2026, so the snapshot date becomes a named constant and the gap is derived from it.
const notionalToday = "Aug 21, 2026";
const nextChargeDate = "Aug 24, 2026";
const daysUntil = (target: string) => Math.round((Date.parse(target) - Date.parse(notionalToday)) / 86400000);
const billingProfile = {
  plan: currentPlan.name,
  price: currentPlan.price ?? 0,
  cycle: "Monthly",
  anchor: "the 24th of each month",
  nextCharge: nextChargeDate,
  daysToCharge: daysUntil(nextChargeDate),
  method: { label: "bKash", masked: "•••• 4821", holder: "Malcolm Abbott", verified: "Verified Jun 24, 2026" },
  // Billing labelled the same 12,400 events "Counted for Aug 1 – Aug 31, 2026" while Analytics
  // labelled that number "Aug 1 – Aug 21, 2026". Only one of those can be the counted range, and
  // the full-month version is the misleading one: it reads as a finished month closing 97.5% under
  // the limit, when eleven days of the cycle have not happened yet. The counted range now comes
  // from the same constant Analytics prints, so the two pages cannot drift apart again, and the
  // note answers the question the calendar window raises next to a charge date on the 24th.
  period: {
    label: workspaceMetrics.events.windowLabel,
    resets: "Resets Sep 1, 2026",
    note: `Calendar-month window · separate from the ${nextChargeDate.replace(", 2026", "")} charge date`,
  },
  // Both counters used to be their own literals. Events matched workspaceMetrics by luck and
  // orders did not: billing claimed 18 orders this month while every other page said 26.
  events: { used: workspaceMetrics.events.used, limit: currentPlan.events },
  orders: { used: workspaceMetrics.orders.month, limit: currentPlan.orders },
  stores: { used: 1, limit: currentPlan.stores },
  contact: { company: "Buykori Demo Store", name: "Malcolm Abbott", email: contactEmails.billing, bin: "004512789-0101", address: "House 42, Road 7, Dhanmondi, Dhaka 1205" },
  overage: "Events past the monthly limit are queued rather than dropped. Tracking pauses at 110% of the limit until the next cycle or a plan upgrade.",
  orderOverage: "Orders past the monthly limit are still recorded, but COD review and courier booking pause until the cycle resets.",
  annual: "Annual billing is not offered on this plan yet. Only the monthly cycle is available.",
};
// Audit remediation P2: the workspace has existed since Feb 11, 2026 and the table footer said
// "Feb 2026 onward", but the oldest invoice was Apr 24 -- two months of billing were missing.
// April was worse: it held only the refunded duplicate, so the month looked never paid.
const invoices = [
  { date: "Jul 24, 2026", number: "INV-2026-0714", ref: "PAY-93C47", method: "bKash •••• 4821", amount: 799, status: "Paid", plan: "Growth", note: "Settled the same day" },
  { date: "Jun 24, 2026", number: "INV-2026-0619", ref: "PAY-86B21", method: "bKash •••• 4821", amount: 799, status: "Paid", plan: "Growth", note: "Settled the same day" },
  { date: "May 24, 2026", number: "INV-2026-0522", ref: "PAY-74A19", method: "bKash •••• 4821", amount: 799, status: "Paid", plan: "Growth", note: "Settled the same day" },
  { date: "Apr 24, 2026", number: "INV-2026-0431", ref: "PAY-51F08", method: "Nagad •••• 7130", amount: 799, status: "Refunded", plan: "Growth", note: "Duplicate attempt, refunded Apr 26, 2026" },
  { date: "Apr 24, 2026", number: "INV-2026-0430", ref: "PAY-51E97", method: "bKash •••• 4821", amount: 799, status: "Paid", plan: "Growth", note: "Upgraded from Starter on Apr 24, 2026" },
  { date: "Mar 24, 2026", number: "INV-2026-0318", ref: "PAY-33C55", method: "bKash •••• 4821", amount: 499, status: "Paid", plan: "Starter", note: "Settled the same day" },
  { date: "Feb 24, 2026", number: "INV-2026-0212", ref: "PAY-21D04", method: "bKash •••• 4821", amount: 499, status: "Paid", plan: "Starter", note: "First charge after the 13-day trial" },
];
// The security card used to claim "1 browser session" while the danger zone offered
// to sign out "all other sessions". Two sessions -- one of them current -- makes both
// statements true and gives the Review action something to show.
const activeSessions = [
  { device: "Chrome 127 · Windows 11", place: "Dhaka, Bangladesh", ip: "103.120.34.18", seen: "Active now", current: true },
  // Audit remediation P3: "Last active 2 days ago" was the only relative stamp left on a page
  // where invoices, the trial end, the renewal date and the last sign-in are all absolute, so the
  // one row you might act on was the one row you could not date.
  { device: "Safari 17 · iPhone 15", place: "Dhaka, Bangladesh", ip: "103.120.34.62", seen: "Last active Aug 19, 2026 · 21:37", current: false },
];
const workspaceFacts = [
  ["Client ID", storeConnection.clientId],
  ["Workspace", storeConnection.workspace],
  ["Store domain", storeConnection.domain],
  ["Your role", "Owner · full access"],
  ["Member since", storeConnection.memberSince],
  ["Last sign-in", "Aug 21, 2026 · 09:14 from Dhaka"],
];

function Account() {
  const [tab, setTab] = useState("Profile & security");
  const [notice, setNotice] = useState(""); const [confirmDelete, setConfirmDelete] = useState(false); const [payFilter, setPayFilter] = useState("All statuses"); const flash = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 2300); };
  // Audit remediation P2: signing out a device only flashed a toast, so "2 signed in", the
  // danger-zone count and the row itself all stayed put after you acted. Two-step verification
  // had the same problem in reverse -- Enable did nothing, which left Recovery codes
  // permanently disabled with no way to reach it.
  const [sessions, setSessions] = useState(activeSessions);
  const [mfaOn, setMfaOn] = useState(false);
  const [codesIssued, setCodesIssued] = useState(false);
  const visibleInvoices = invoices.filter((invoice) => payFilter === "All statuses" || invoice.status === payFilter);
  const otherSessions = sessions.filter((session) => !session.current);
  const signOut = (ip: string, device: string) => { setSessions((list) => list.filter((session) => session.ip !== ip)); flash(`${device} signed out in this preview.`); };
  const invoiceMonths = Array.from(new Set(invoices.map((invoice) => invoice.date.replace(/ \d+,/, ""))));
  const paidToDate = invoices.filter((invoice) => invoice.status === "Paid").reduce((total, invoice) => total + invoice.amount, 0);
  const refunded = invoices.filter((invoice) => invoice.status === "Refunded").reduce((total, invoice) => total + invoice.amount, 0);
  const charge = vatSplit(billingProfile.price);
  const share = (used: number, limit: number) => Math.round((used / limit) * 1000) / 10;
  const usage = [
    { label: "Tracked events", used: billingProfile.events.used, limit: billingProfile.events.limit, note: "" },
    { label: "Orders", used: billingProfile.orders.used, limit: billingProfile.orders.limit, note: "" },
    { label: "Connected stores", used: billingProfile.stores.used, limit: billingProfile.stores.limit, note: `Plan maximum · ${billingProfile.plan} covers ${billingProfile.stores.limit} store` },
  ];
  const overLimitPlans = planCatalog.filter((plan) => plan.events < billingProfile.events.used || plan.orders < billingProfile.orders.used);
  return (
    <>
      <PageHeader
        page="account"
        action={
          <Button icon={<Headphones size={15} />} onClick={() => flash("Support request staged locally. Preview only.")}>Contact support</Button>
        }
      />
      <Tabs
        className="section-tabs account-tabs"
        label="Account sections"
        value={tab}
        onChange={setTab}
        items={["Profile & security", "Plan & billing", "Danger zone"].map((item) => ({ id: item, label: item }))}
      />
      {notice && <div className="inline-preview-feedback account-feedback"><Check size={15} />{notice}</div>}
      {tab === "Profile & security" && (
        <div className="account-grid">
          <Panel>
            <SectionTitle
              title="Profile"
              detail="Your account details and where alerts are sent."
              action={<Badge tone="success">Sign-in email verified</Badge>}
            />
            <div className="form-grid">
              <label>
                Display name
                <input defaultValue="Malcolm Abbott" autoComplete="name" />
              </label>
              <label>
                Phone
                <input type="tel" defaultValue="+880 1711 204866" autoComplete="tel" />
                <small>Used for two-step verification codes.</small>
              </label>
              <label>
                Sign-in email
                <input type="email" defaultValue={contactEmails.signIn} autoComplete="email" />
                <small>Verified Feb 11, 2026 · changing it needs a new confirmation.</small>
              </label>
              <label>
                Notification email
                <input type="email" defaultValue={contactEmails.notifications} autoComplete="email" />
                <small>Verified Feb 11, 2026 · alerts stop until a new address is confirmed.</small>
              </label>
              <label>
                Time zone
                <select defaultValue="Asia/Dhaka (GMT+6)">
                  <option>Asia/Dhaka (GMT+6)</option>
                  <option>Asia/Kolkata (GMT+5:30)</option>
                  <option>UTC</option>
                </select>
                <small>Report dates and billing periods follow this zone.</small>
              </label>
              <label>
                Report language
                <select defaultValue="English">
                  <option>English</option>
                  <option>বাংলা</option>
                </select>
                <small>Applies to weekly email reports, not this portal.</small>
              </label>
            </div>
            <div className="inline-note">
              <Bell size={15} />
              <span>
                <strong>Alerts and weekly reports go to the notification email.</strong>
                <small>Sign-in codes, invoices, and payment receipts always go to the sign-in email.</small>
              </span>
            </div>
            <Button kind="primary" onClick={() => flash("Profile changes saved locally. Preview only.")}>Save changes</Button>
          </Panel>
          <Panel>
            <SectionTitle
              title="Workspace"
              detail="Read-only identifiers. Quote the client ID when you contact support."
            />
            <dl className="account-meta">
              {workspaceFacts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel>
            <SectionTitle
              title="Security"
              detail="Protect access to your Buykori workspace."
              action={<Badge tone={mfaOn ? "success" : "warning"}>{mfaOn ? "2 of 3 in place" : "1 of 3 in place"}</Badge>}
            />
            <div className="security-list">
              <div>
                <KeyRound size={18} />
                <span>
                  <strong>Password <Badge tone="success">Set</Badge></strong>
                  {/* "· 28 days ago" was arithmetic frozen at Jul 24 + 28, true only while the
                      notional today stays Aug 21. The absolute date already carries the fact. */}
                  <small>Last changed Jul 24, 2026</small>
                </span>
                <Button onClick={() => flash("Password update flow opened. Preview only.")}>Update</Button>
              </div>
              <div>
                <LockKeyhole size={18} />
                <span>
                  <strong>Two-step verification <Badge tone={mfaOn ? "success" : "warning"}>{mfaOn ? "On" : "Off"}</Badge></strong>
                  <small>{mfaOn ? "Authenticator app · codes also sent to +880 1711 204866." : "Recommended for Owner accounts. Uses an authenticator app or SMS to +880 1711 204866."}</small>
                </span>
                <Button kind={mfaOn ? "secondary" : "primary"} onClick={() => { const next = !mfaOn; setMfaOn(next); if (!next) setCodesIssued(false); flash(next ? "Two-step verification enabled in this preview." : "Two-step verification turned off in this preview."); }}>{mfaOn ? "Turn off" : "Enable"}</Button>
              </div>
              <div>
                <ShieldCheck size={18} />
                <span>
                  <strong>Recovery codes {codesIssued ? <Badge tone="success">10 unused</Badge> : <Badge tone="neutral">None</Badge>}</strong>
                  <small>{codesIssued ? "Generated just now in this preview. Store them somewhere safe." : mfaOn ? "Ready to generate. Ten single-use codes for when your phone is unavailable." : "Not generated yet. Available once two-step verification is on."}</small>
                </span>
                <Button disabled={!mfaOn} onClick={() => { setCodesIssued(true); flash("Ten recovery codes generated. Preview only."); }}>{codesIssued ? "Regenerate" : "Generate"}</Button>
              </div>
            </div>
          </Panel>
          <Panel>
            <SectionTitle
              title="Active sessions"
              detail="Signing out a device ends its access immediately."
              action={<Badge tone={sessions.length > 1 ? "info" : "neutral"}>{sessions.length} signed in</Badge>}
            />
            <div className="session-list">
              {sessions.map((session) => (
                <div className="session-row" key={session.ip}>
                  {session.device.includes("iPhone") ? <Smartphone size={17} /> : <Monitor size={17} />}
                  <span>
                    <strong>{session.device}</strong>
                    <small>{session.place} · IP {session.ip}</small>
                  </span>
                  <small className="session-seen">{session.seen}</small>
                  {session.current ? (
                    <Badge tone="success">This device</Badge>
                  ) : (
                    <Button onClick={() => signOut(session.ip, session.device)}>Sign out</Button>
                  )}
                </div>
              ))}
            </div>
            <div className="inline-note">
              <ShieldCheck size={15} />
              <span>
                <strong>{otherSessions.length ? `${otherSessions.length} other ${otherSessions.length === 1 ? "device is" : "devices are"} signed in.` : "No other devices are signed in."}</strong>
                <small>Sessions expire after 30 days without activity. Changing your password signs every other device out.</small>
              </span>
            </div>
          </Panel>
        </div>
      )}
      {tab === "Plan & billing" && (
        <div className="billing-page-stack">
          <Panel className="current-plan-panel">
            <SectionTitle
              title={`${billingProfile.plan} plan`}
              detail={`${billingProfile.cycle} billing · ${money(billingProfile.price)} on ${billingProfile.nextCharge}, in ${billingProfile.daysToCharge} days`}
              action={<Badge tone="success">Active</Badge>}
            />
            <div className="current-plan-body">
              <div className="current-plan-price">
                <span>Monthly price</span>
                <strong>{money(billingProfile.price)} <small>/ month</small></strong>
                <p>Charged on {billingProfile.anchor} · includes {money(charge.vat)} VAT at 15% on a {money(charge.base)} base</p>
              </div>
              <div className="current-plan-usage">
                {usage.map((row) => (
                  <div key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.used.toLocaleString("en-BD")} <small>of {row.limit.toLocaleString("en-BD")}</small></strong>
                    <i><b style={{ width: `${Math.min(100, Math.max(1, share(row.used, row.limit)))}%` }} /></i>
                    <small>{row.note || `${share(row.used, row.limit)}% used · ${(row.limit - row.used).toLocaleString("en-BD")} left`}</small>
                  </div>
                ))}
                <p className="usage-period">Counted {billingProfile.period.label} so far · {billingProfile.period.resets}<small>{billingProfile.period.note}</small></p>
              </div>
              <div className="current-plan-actions">
                <Button kind="primary" onClick={() => flash("Plan management opened. Preview only.")}>Manage subscription</Button>
                <Button onClick={() => flash("Cancellation flow opened. Preview only.")}>Cancel plan</Button>
                <small>{billingProfile.annual}</small>
                <small>Cancelling keeps tracking live until {billingProfile.nextCharge}, then stops billing.</small>
              </div>
            </div>
            <dl className="billing-facts">
              <div>
                <dt><WalletCards size={14} /> Payment method</dt>
                <dd>{billingProfile.method.label} {billingProfile.method.masked}</dd>
                <small>{billingProfile.method.holder} · {billingProfile.method.verified}<br />Next attempt {billingProfile.nextCharge}. A failed charge retries for 7 days before tracking pauses.</small>
                <Button onClick={() => flash("Payment method update opened. Preview only.")}>Update method</Button>
              </div>
              <div>
                <dt><Clock3 size={14} /> Overage policy</dt>
                <dd>Queued, never dropped</dd>
                <small>{billingProfile.overage}<br />{billingProfile.orderOverage}</small>
              </div>
              <div>
                <dt><FileText size={14} /> Billing contact</dt>
                <dd>{billingProfile.contact.company}</dd>
                <small>{billingProfile.contact.name} · {billingProfile.contact.email}<br />VAT BIN {billingProfile.contact.bin}<br />{billingProfile.contact.address}</small>
                <Button onClick={() => flash("Billing contact editor opened. Preview only.")}>Edit contact</Button>
              </div>
            </dl>
          </Panel>
          <Panel className="plan-comparison-panel">
            <SectionTitle title="Compare plans" detail="Limits below are the same ones your usage is measured against." action={<Badge tone="neutral">Prices include 15% VAT</Badge>} />
            <div className="plan-card-grid">
              {planCatalog.map((plan, index) => {
                const isCurrent = plan.name === billingProfile.plan;
                const currentIndex = planCatalog.findIndex((entry) => entry.name === billingProfile.plan);
                const action = isCurrent ? "Your current plan" : plan.price === null ? "Contact support" : index < currentIndex ? `Downgrade to ${plan.name}` : `Upgrade to ${plan.name}`;
                return (
                  <article className={`plan-card ${isCurrent ? "current" : ""}`} key={plan.name}>
                    <header>
                      <div><strong>{plan.name}</strong><small>{plan.description}</small></div>
                      {isCurrent && <Badge tone="success">Current</Badge>}
                    </header>
                    <div className="plan-card-price">{plan.price === null ? "Contact us" : money(plan.price)}{plan.price ? <small> / month</small> : null}</div>
                    <ul>
                      <li key="stores"><Check size={14} /><span>{plan.stores} WooCommerce {plan.stores === 1 ? "store" : "stores"}</span></li>
                      <li key="limits"><Check size={14} /><span>{plan.events.toLocaleString("en-BD")} events and {plan.orders.toLocaleString("en-BD")} orders / month</span></li>
                      {plan.extras.map((feature) => <li key={feature}><Check size={14} /><span>{feature}</span></li>)}
                    </ul>
                    <Button className={isCurrent ? "plan-current-state" : ""} disabled={isCurrent} onClick={() => flash(`${plan.name} plan flow opened. Preview only.`)}>{action}</Button>
                  </article>
                );
              })}
            </div>
            {overLimitPlans.length > 0 && (
              <div className="inline-note">
                <AlertTriangle size={15} />
                <span>
                  <strong>{overLimitPlans.map((plan) => plan.name).join(" and ")} cannot hold this month's usage.</strong>
                  <small>You have used {billingProfile.events.used.toLocaleString("en-BD")} events and {billingProfile.orders.used} orders in {billingProfile.period.label} so far, with the cycle still open. Downgrading pauses tracking until it resets.</small>
                </span>
              </div>
            )}
          </Panel>
          <Panel className="billing-history-panel">
            <SectionTitle
              title="Billing history"
              detail="Every invoice raised on this workspace, newest first."
              action={
                <div className="billing-history-actions">
                  <select aria-label="Filter invoices by status" value={payFilter} onChange={(event) => setPayFilter(event.target.value)}>
                    <option>All statuses</option>
                    <option>Paid</option>
                    <option>Refunded</option>
                  </select>
                  <Button icon={<Download size={14} />} onClick={() => flash("Payment history CSV prepared. Preview only.")}>Export CSV</Button>
                </div>
              }
            />
            <div className="billing-table">
              <div className="billing-table-head"><span>Date</span><span>Invoice</span><span>Method</span><span>Amount</span><span>Status</span><span /></div>
              {visibleInvoices.map((invoice) => (
                <div className="billing-table-row" key={invoice.number}>
                  <span>{invoice.date}</span>
                  <span>
                    <code>{invoice.number}</code>
                    <small>Ref {invoice.ref} · {invoice.plan} plan · {invoice.note}</small>
                  </span>
                  <span>{invoice.method}</span>
                  <strong>{money(invoice.amount)}<small>incl. {money(vatSplit(invoice.amount).vat)} VAT</small></strong>
                  <Badge tone={invoice.status === "Paid" ? "success" : "info"}>{invoice.status}</Badge>
                  <Button icon={<Download size={14} />} onClick={() => flash(`Receipt for ${invoice.number} prepared. Preview only.`)}>Receipt</Button>
                </div>
              ))}
              {visibleInvoices.length === 0 && (
                <div className="empty-state">
                  <FileText size={24} />
                  <strong>No invoices with this status</strong>
                  <span>Switch back to all statuses to see the full history.</span>
                </div>
              )}
              {visibleInvoices.length > 0 && (
                <div className="billing-table-foot">
                  <span>Showing {visibleInvoices.length} of {invoices.length} invoices · {invoiceMonths[invoiceMonths.length - 1]} to {invoiceMonths[0]}</span>
                  <strong>Paid to date {money(paidToDate)}{refunded > 0 ? ` · ${money(refunded)} refunded` : ""}</strong>
                </div>
              )}
            </div>
            <div className="inline-note">
              <FileText size={15} />
              <span>
                <strong>Receipts and invoices go to {billingProfile.contact.email}.</strong>
                <small>Invoices are kept for 5 years to meet tax rules, even if the workspace is deleted.</small>
              </span>
            </div>
          </Panel>
        </div>
      )}
      {tab === "Danger zone" && (
        <Panel className="danger-panel">
          <SectionTitle
            title="Danger zone"
            detail="These actions are difficult to reverse. Export first if you need the data."
          />
          <div className="danger-row">
            <span>
              <strong>Export workspace data</strong>
              <small>
                Orders, events, delivery logs, and invoices as CSV. Ready in about 10 minutes, download link valid 24 hours.
              </small>
            </span>
            <Button icon={<Download size={14} />} onClick={() => flash("Export queued. Preview only.")}>Request export</Button>
          </div>
          <div className="danger-row">
            <span>
              <strong>{otherSessions.length ? `Sign out ${otherSessions.length} other ${otherSessions.length === 1 ? "session" : "sessions"}` : "No other sessions to sign out"}</strong>
              <small>{otherSessions.length === 1 ? `${otherSessions[0].device} loses access immediately. This device stays signed in.` : otherSessions.length ? "Every device except this one loses access immediately." : "This device is the only one signed in right now."}</small>
            </span>
            <Button disabled={!otherSessions.length} onClick={() => { setSessions((list) => list.filter((session) => session.current)); flash("Other sessions signed out in this preview."); }}>{!otherSessions.length ? "Nothing to sign out" : otherSessions.length === 1 ? "Sign out that session" : "Sign out those sessions"}</Button>
          </div>
          <div className="danger-row">
            <span>
              <strong>Delete client account</strong>
              <small>
                Disconnects every tracking destination and courier connection, then removes the workspace.
                Deletion starts after a 14-day grace period and you can cancel any time inside it.
                Event and order history is erased 30 days after that; invoices are kept for 5 years to meet tax rules.
              </small>
            </span>
            <Button kind="danger" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
              Request deletion
            </Button>
          </div>
        </Panel>
      )}
      {confirmDelete && <ConfirmDialog title="Request account deletion?" close={() => setConfirmDelete(false)} actions={<><Button onClick={() => setConfirmDelete(false)}>Cancel</Button><Button kind="danger" onClick={() => { setConfirmDelete(false); flash("Deletion request staged for review. Preview only."); }}>Confirm request</Button></>}><p>Deletion begins after 14 days and can be cancelled inside that window. Export your data first — event and order history is erased 30 days later. This is irreversible in production; the preview will not delete anything.</p></ConfirmDialog>}
    </>
  );
}

function App() {
  const initialPath = window.location.pathname;
  const routeKey = (path: string) => path.replace(/^\/ui-ux-audit-prototype/, "") || "/dashboard";
  const queryPage = new URLSearchParams(window.location.search).get("page") as Page | null;
  const isPrototypePreviewRoute = initialPath.startsWith("/ui-ux-audit-prototype");
  const liveMode = !isPrototypePreviewRoute || new URLSearchParams(window.location.search).get("live") === "1";
  const [aiAdsEnabledForClient, setAiAdsEnabledForClient] = useState(false);
  const [liveSnapshot, setLiveSnapshot] = useState<LiveSnapshot | null>(null);
  const [liveAiAds, setLiveAiAds] = useState<LiveAiAds | null>(null);
  const [liveState, setLiveState] = useState<"idle" | "loading" | "ready" | "error">(liveMode ? "loading" : "idle");
  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController();
    setLiveState("loading");
    fetchLiveSnapshot(controller.signal)
      .then((snapshot) => { setLiveSnapshot(snapshot); setLiveState("ready"); })
      .catch((error) => { if ((error as { name?: string }).name !== "AbortError") setLiveState("error"); });
    return () => controller.abort();
  }, [liveMode]);
  useEffect(() => {
    if (!liveMode) return;
    const controller = new AbortController();
    fetchAiAdsAccess(controller.signal).then((access) => {
      setAiAdsEnabledForClient(access.enabled);
      if (access.enabled) return fetchLiveAiAds(controller.signal).then(setLiveAiAds);
      return undefined;
    }).catch(() => setAiAdsEnabledForClient(false));
    return () => controller.abort();
  }, [liveMode]);
  const resolvePage = () => queryPage && Object.prototype.hasOwnProperty.call(pagePath, queryPage) ? queryPage : routePage[routeKey(window.location.pathname)] || "dashboard";
  const [page, setPage] = useState<Page>(resolvePage());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(
    initialPath.includes("conversions") || initialPath.includes("event-routing")
      ? "tracking"
      : initialPath.includes("ad-accounts")
        ? "ads"
        : initialPath.includes("courier")
          ? "shipping"
          : initialPath.includes("alerts")
            ? "alerts"
            : "store",
  );
  // Lifted out of Health so the sidebar badge and the page agree after "Mark fixed".
  const [resolvedIssues, setResolvedIssues] = useState<string[]>([]);
  const openSetupIssues = setupIssues.filter((issue) => !resolvedIssues.includes(issue.title)).length;
  // Lifted out of Checkouts for the same reason: the badge read a hardcoded 2 and stayed there
  // after a checkout was recovered.
  const [checkouts, setCheckouts] = useState<Checkout[]>(checkoutQueue);
  const openCheckouts = checkouts.filter((item) => item.status !== "Recovered").length;
  // Lifted for the third time for the same reason: Settings → Tracking & events described the
  // COD hold in two literals while the drawer that changes it kept its own private state.
  const [codProtection, setCodProtection] = useState<CodProtection>(codProtectionDefaults);
  const liveOrders = liveSnapshot?.orders as Order[] | undefined;
  const liveCheckouts = liveSnapshot?.checkouts as Checkout[] | undefined;
  const [aiSection, setAiSection] = useState<AiSection>(
    initialPath.endsWith("/accounts")
      ? "accounts"
      : initialPath.endsWith("/campaigns")
        ? "campaigns"
        : initialPath.endsWith("/analytics")
          ? "analytics"
          : initialPath.endsWith("/chat")
            ? "chat"
            : "overview",
  );
  useEffect(() => {
    const syncRoute = () => {
      const nextQuery = new URLSearchParams(window.location.search).get("page") as Page | null;
      setPage(nextQuery && Object.prototype.hasOwnProperty.call(pagePath, nextQuery) ? nextQuery : routePage[routeKey(window.location.pathname)] || "dashboard");
    };
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);
  useEffect(() => {
    document.title = `${pageMeta[page].title} | Buykori AdSync Preview`;
  }, [page]);
  const go = (next: Page) => {
    setPage(next);
    window.history.pushState({}, "", pagePath[next]);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const content =
    page === "dashboard" ? (
      <Dashboard go={go} openSetupIssues={openSetupIssues} liveDashboard={liveSnapshot?.dashboard} />
    ) : page === "orders" ? (
      <Orders go={go} liveOrders={liveOrders} />
    ) : page === "cod" ? (
      <CodReview go={go} protection={codProtection} setProtection={setCodProtection} liveOrders={liveOrders} />
    ) : page === "checkouts" ? (
      <Checkouts checkouts={checkouts} setCheckouts={setCheckouts} liveCheckouts={liveCheckouts} />
    ) : page === "events" ? (
      <EventActivity liveEvents={liveSnapshot?.events} />
    ) : page === "delivery" ? (
      <DeliveryLogs liveLogs={liveSnapshot?.logs} />
    ) : page === "campaigns" ? (
      <CampaignTools />
    ) : page === "aiads" ? (
      aiAdsEnabledForClient ? <AiAds section={aiSection} setSection={setAiSection} live={liveAiAds ?? undefined} /> : <AiAdsUpgradeNotice />
    ) : page === "setup" ? (
      <SetupGuide go={go} />
    ) : page === "health" ? (
      <Health fixed={resolvedIssues} setFixed={setResolvedIssues} />
    ) : page === "settings" ? (
      <Settings
        section={settingsSection}
        setSection={setSettingsSection}
        go={go}
        codProtection={codProtection}
      />
    ) : (
      <Account />
    );
  const liveBoundary = liveMode && liveState !== "ready";
  return (
    <div className="portal-shell">
      <a className="skip-link" href="#portal-main">
        Skip to main content
      </a>
      <Sidebar
        page={page}
        go={go}
        mobileOpen={mobileOpen}
        close={() => setMobileOpen(false)}
        openSetupIssues={openSetupIssues}
        openCheckouts={openCheckouts}
      />
      <div className="portal-workspace">
        <Topbar
          page={page}
          openMenu={() => setMobileOpen(true)}
          mobileOpen={mobileOpen}
          go={go}
        />
        <main id="portal-main" className="portal-main" tabIndex={-1}>
          <div className="preview-notice">
            <strong>{liveMode ? "Read-only live adapter" : "Design preview"}</strong>
            <span>
              {liveMode
                ? liveState === "ready" ? "Authenticated tenant-scoped GET data is connected. Mutations remain disabled." : liveState === "error" ? "Live reads failed; sample data remains visible. Check your session and retry." : "Loading tenant-scoped GET data…"
                : "Sample data and visual workflows only. Production actions are intentionally not connected."}
            </span>
          </div>
          {liveBoundary ? (
            <section className="empty-state" role={liveState === "error" ? "alert" : "status"}>
              <strong>{liveState === "error" ? "Could not load this workspace" : "Loading your workspace"}</strong>
              <span>
                {liveState === "error"
                  ? "Your authenticated data could not be loaded. Sign in again or retry; sample data is never shown on the live client route."
                  : "Connecting to your tenant-scoped data."}
              </span>
            </section>
          ) : content}
        </main>
      </div>
    </div>
  );
}

// Vite re-runs this module on every hot update, so a bare createRoot call re-rooted the same
// container each time and filled the console with "already been passed to createRoot" errors --
// noise that buries the warnings worth reading while auditing the prototype.
const container = document.getElementById("root")! as HTMLElement & { _root?: ReturnType<typeof createRoot> };
container._root = container._root || createRoot(container);
container._root.render(<App />);
