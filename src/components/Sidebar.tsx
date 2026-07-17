/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  ListChecks,
  Megaphone,
  Lightbulb,
  Settings2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Terminal,
  X,
  Truck,
  BookOpen,
  ChevronDown,
  Plus,
  Store,
  Check,
  PhoneCall,
  LockKeyhole,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { UserProfile } from '../types';

interface StoreInfo {
  client_id: number;
  name: string;
  domain: string;
  is_current: boolean;
}

interface SidebarItem {
  id: string;
  name: string;
  icon: LucideIcon;
  subtitle?: string;
  requireOrderMgmt?: boolean;
  count?: number;
  locked?: boolean;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
  profile: UserProfile;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onLogout: () => Promise<void>;
  orderManagementEnabled: boolean;
  suggestionsCount: number;
  orderVerificationCount: number;
  deliveryBadgeCount: number;
  incompleteCheckoutCount: number;
  stores?: StoreInfo[];
  onSwitchStore?: (clientId: number) => Promise<void>;
  onCreateStore?: () => void;
}

export function Sidebar({
  activePage,
  setActivePage,
  profile,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  onLogout,
  orderManagementEnabled,
  suggestionsCount,
  orderVerificationCount,
  deliveryBadgeCount,
  incompleteCheckoutCount,
  stores = [],
  onSwitchStore,
  onCreateStore,
}: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showLockedFeature, setShowLockedFeature] = useState(false);
  const [storeSwitcherOpen, setStoreSwitcherOpen] = useState(false);
  const [switchingStore, setSwitchingStore] = useState<number | null>(null);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'YOUR STORE': true,
    'YOUR ORDERS': true,
    GROW: true,
    SYSTEM: true,
  });
  const storeSwitcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (storeSwitcherRef.current && !storeSwitcherRef.current.contains(e.target as Node)) {
        setStoreSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const currentStore = stores.find(s => s.is_current);
  const subNavSections: Record<string, { id: string; label: string }[]> = {
    analytics: [
      { id: 'analytics-overview', label: 'Summary' },
      { id: 'analytics-ad-performance', label: 'Ad Results' },
      { id: 'analytics-campaigns', label: 'Sales Source' },
      { id: 'analytics-audience', label: 'Customers' },
    ],
    orders: [
      { id: 'orders-pending', label: 'Pending queue' },
      { id: 'orders-shipped', label: 'Shipped log' },
    ],
    'campaign-builder': [
      { id: 'campaign-url-builder', label: 'URL builder' },
      { id: 'campaign-event-tester', label: 'Event tester' },
      { id: 'campaign-data-preview', label: 'Data preview' },
    ],
    'setup-guide': [
      { id: 'setup-wordpress', label: 'WordPress' },
      { id: 'setup-shopify', label: 'Shopify' },
      { id: 'setup-custom', label: 'Custom website' },
    ],
    settings: [
      { id: 'settings-domain', label: 'Store Connection' },
      { id: 'settings-platforms', label: 'Conversions API' },
      { id: 'settings-ad-accounts', label: 'Ad Accounts' },
      { id: 'settings-courier', label: 'Courier Logistics' },
      { id: 'settings-whatsapp', label: 'Alerts & Notifications' },
    ],
  };

  useEffect(() => {
    if (subNavSections[activePage]) {
      setOpenSubmenus(prev => ({ ...prev, [activePage]: true }));
    }
  }, [activePage]);

  const jumpToPageSection = (pageId: string, sectionId: string) => {
    setActivePage(pageId);
    setOpenSubmenus(prev => ({ ...prev, [pageId]: true }));
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('buykori:page-section', { detail: { pageId, sectionId } }));
    }, 80);
  };

  const handleSwitch = async (clientId: number) => {
    if (!onSwitchStore) return;
    setSwitchingStore(clientId);
    try {
      await onSwitchStore(clientId);
    } finally {
      setSwitchingStore(null);
      setStoreSwitcherOpen(false);
    }
  };

  const menuGroups: SidebarGroup[] = [
    {
      label: 'YOUR STORE',
      items: [
        { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
        { id: 'analytics', name: 'Ad Insights', icon: TrendingUp },
      ],
    },
    {
      label: 'YOUR ORDERS',
      items: [
        {
          id: 'pending-purchases',
          name: 'COD Protection',
          icon: ShieldCheck,
          subtitle: 'Verify COD orders before sending Purchase events',
          count: orderVerificationCount,
        },
        {
          id: 'orders',
          name: 'Courier Shipping',
          icon: Truck,
          count: deliveryBadgeCount,
        },
        {
          id: 'incomplete-checkouts',
          name: 'Incomplete Orders',
          icon: PhoneCall,
          subtitle: 'Recover abandoned checkouts with a phone number',
          count: incompleteCheckoutCount,
          locked: !profile.growthFeaturesEnabled,
        },
      ],
    },
    {
      label: 'GROW',
      items: [
        { id: 'campaign-builder', name: 'Campaign Tools', icon: Megaphone },
        { id: 'suggestions', name: 'Setup Health', icon: Lightbulb, count: suggestionsCount },
      ],
    },
    {
      label: 'SYSTEM',
      items: [
        { id: 'setup-guide', name: 'Setup Guide', icon: BookOpen },
        { id: 'event-logs', name: 'Event Logs', icon: ListChecks },
        { id: 'api-logs', name: 'API Logs', icon: Terminal },
        { id: 'settings', name: 'Settings', icon: Settings2 },
      ],
    },
  ];

  const formatQuota = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  const usagePercent = profile.eventsQuota > 0
    ? Math.min((profile.eventsUsed / profile.eventsQuota) * 100, 100)
    : 0;
  const quotaColor = usagePercent >= 85
    ? 'bg-gradient-to-r from-orange-500 to-rose-600'
    : usagePercent >= 60
      ? 'bg-gradient-to-r from-amber-400 to-orange-500'
      : 'bg-gradient-to-r from-emerald-400 to-emerald-600';
  const textQuotaColor = usagePercent >= 85
    ? 'text-rose-700'
    : usagePercent >= 60
      ? 'text-amber-700'
      : 'text-emerald-700';
  const usageCardColor = usagePercent >= 85
    ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50'
    : usagePercent >= 60
      ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50'
      : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50';
  const rawProfileName = String(profile.name || '').trim() || 'User';
  const profileInitial = rawProfileName.charAt(0).toUpperCase();
  const displayProfileName = `${profileInitial}${rawProfileName.slice(1)}`;

  return (
    <>
    <aside
      className={`bk-console-sidebar fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-transform duration-200 md:transition-all ${
        collapsed ? 'is-collapsed' : ''
      } ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div data-guide="brand" className={`bk-console-brand flex items-center ${
        collapsed ? 'justify-center px-2 gap-1' : 'justify-between px-5'
      }`}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="bk-console-logo flex h-8 w-8 shrink-0 items-center justify-center text-sm font-bold text-white">
            B
          </div>
          {!collapsed && (
            <span className="truncate font-sans text-[18px] font-semibold tracking-tight text-slate-900">
              Buykori AdSync
            </span>
          )}
        </div>
        <button
          onClick={() => {
            if (window.innerWidth < 768) {
              setMobileOpen(false);
            } else {
              setCollapsed(!collapsed);
            }
          }}
          className="rounded-full p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="md:hidden"><X className="w-4 h-4" /></span>
          <span className="hidden md:inline">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </span>
        </button>
      </div>

      {/* Store Switcher (expanded mode) */}
      {!collapsed && stores.length > 0 && (
        <div className="px-3 pt-3 pb-1" ref={storeSwitcherRef}>
          <p className="bk-console-group-label mb-1.5 px-1">Active store</p>
          <div className="relative">
            <button
              onClick={() => setStoreSwitcherOpen(prev => !prev)}
              data-guide="active-store"
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50">
                <Store className="h-3.5 w-3.5 text-blue-700" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-bold text-slate-800  truncate leading-tight">
                  {currentStore?.name || profile.name}
                </p>
                <p className="text-[9px] text-slate-400  truncate leading-tight">
                  {currentStore?.domain || 'No domain set'}
                </p>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${storeSwitcherOpen ? 'rotate-180' : ''}`} />
            </button>

            {storeSwitcherOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                <div className="py-1 max-h-48 overflow-y-auto">
                  {stores.map(store => (
                    <button
                      key={store.client_id}
                      onClick={() => !store.is_current && handleSwitch(store.client_id)}
                      disabled={store.is_current || switchingStore === store.client_id}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer ${
                        store.is_current
                          ? 'bg-indigo-50  cursor-default'
                          : 'hover:bg-slate-50 '
                      }`}
                    >
                      <div className={`flex items-center justify-center w-6 h-6 rounded-md shrink-0 ${
                        store.is_current ? 'bg-indigo-100 ' : 'bg-slate-100 '
                      }`}>
                        <Store className={`w-3.5 h-3.5 ${store.is_current ? 'text-indigo-600 ' : 'text-slate-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate leading-tight ${store.is_current ? 'text-indigo-700 ' : 'text-slate-700 '}`}>
                          {store.name}
                        </p>
                        <p className="text-[9px] text-slate-400  truncate leading-tight">
                          {store.domain || 'No domain'}
                        </p>
                      </div>
                      {store.is_current && <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                      {switchingStore === store.client_id && (
                        <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-slate-100 ">
                  <button
                    onClick={() => { setStoreSwitcherOpen(false); onCreateStore?.(); }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Store
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Store icon for collapsed mode */}
      {collapsed && stores.length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => { setCollapsed(false); setTimeout(() => setStoreSwitcherOpen(true), 310); }}
            className="group relative cursor-pointer rounded-full p-2 transition-colors hover:bg-slate-100"
            title="Switch Store"
          >
            <Store className="w-4 h-4 text-indigo-500" />
            <div className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
              Switch Store
            </div>
          </button>
        </div>
      )}

      {/* Primary Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-4 pr-3">
        {menuGroups.map((group, groupIndex) => {
          const visibleItems = group.items.filter(
            (item) => !item.requireOrderMgmt || orderManagementEnabled
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className={groupIndex === 0 ? '' : collapsed ? 'mt-3' : 'mt-5'}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => setOpenGroups(prev => ({ ...prev, [group.label]: !prev[group.label] }))}
                  className="mb-2 flex w-full items-center gap-2 rounded-full px-5 py-1.5 text-left transition-colors hover:bg-slate-100"
                >
                  <span className="bk-console-group-label">
                    {group.label}
                  </span>
                  <span className="h-px flex-1 bg-slate-200/70" />
                  <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${openGroups[group.label] ? 'rotate-180' : ''}`} />
                </button>
              )}

              <div className={`space-y-1 ${!collapsed && !openGroups[group.label] ? 'hidden' : ''}`}>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  const subSections = subNavSections[item.id];
                  const hasSubmenu = Boolean(subSections?.length);
                  const submenuOpen = Boolean(openSubmenus[item.id]);
                  return (
                    <div key={item.id} className="group/nav relative">
                      <button
                        aria-current={isActive ? 'page' : undefined}
                        aria-expanded={hasSubmenu && !collapsed ? submenuOpen : undefined}
                        data-guide={`nav-${item.id}`}
                        onClick={() => {
                          if (item.locked) {
                            setShowLockedFeature(true);
                            setMobileOpen(false);
                            return;
                          }
                          setActivePage(item.id);
                          setMobileOpen(false);
                        }}
                        className={`bk-console-nav-item group relative flex w-full overflow-visible text-sm transition-colors duration-150 ${
                          isActive
                            ? 'is-active sidebar-active-glow'
                            : 'font-medium'
                        } ${collapsed ? 'justify-center px-0 py-2.5' : 'items-center gap-3 py-2.5 pl-5 pr-3'}`}
                      >
                        {isActive && (
                          <span className="sidebar-active-indicator absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full" />
                        )}

                        <Icon
                          strokeWidth={isActive ? 2.5 : 2}
                          className="bk-console-nav-icon h-[18px] w-[18px] shrink-0 transition-colors"
                        />

                        {!collapsed && (
                          <span className="min-w-0 flex-1 text-left">
                            <span className="block truncate">{item.name}</span>
                            {item.subtitle && (
                              <span className="block max-h-0 overflow-hidden text-[10px] font-medium leading-4 text-slate-400 opacity-0 transition-all duration-200 group-hover:max-h-4 group-hover:opacity-100 ">
                                {item.subtitle}
                              </span>
                            )}
                          </span>
                        )}

                        {hasSubmenu && !collapsed && (
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label={`${submenuOpen ? 'Collapse' : 'Expand'} ${item.name} sections`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenSubmenus(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                setOpenSubmenus(prev => ({ ...prev, [item.id]: !prev[item.id] }));
                              }
                            }}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${submenuOpen ? 'rotate-180' : ''}`} />
                          </span>
                        )}

                        {Boolean(item.count) && !collapsed && !hasSubmenu && (
                          <span className="bk-console-chip ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold">
                            {item.count}
                          </span>
                        )}

                        {item.locked && !collapsed && (
                          <LockKeyhole className="ml-auto h-3.5 w-3.5 shrink-0 text-amber-500" />
                        )}

                        {collapsed && (
                          <div className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
                            {item.name}
                          </div>
                        )}
                      </button>

                      {hasSubmenu && collapsed && (
                        <div className="pointer-events-none absolute left-full top-0 z-50 ml-3 w-52 rounded-lg border border-slate-200 bg-white p-2 opacity-0 shadow-xl shadow-slate-900/15 transition-opacity duration-150 group-hover/nav:pointer-events-auto group-hover/nav:opacity-100">
                          <p className="px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-400">{item.name}</p>
                          <div className="mt-1 space-y-0.5">
                            {subSections.map((section) => (
                              <button
                                key={section.id}
                                type="button"
                                onClick={() => {
                                  jumpToPageSection(item.id, section.id);
                                  setMobileOpen(false);
                                }}
                                className="block w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                {section.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {hasSubmenu && !collapsed && submenuOpen && (
                        <div className="ml-11 mt-1 space-y-0.5 pb-1">
                          {subSections.map((section) => (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => {
                                jumpToPageSection(item.id, section.id);
                                setMobileOpen(false);
                              }}
                              className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
                            >
                              {section.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Usage Indicator */}
      <div className={`shrink-0 border-t border-slate-200 bg-white px-3 pt-3 ${collapsed ? 'hidden pb-3 md:block' : 'pb-2'}`}>
        {collapsed ? (
          <div className={`flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2 shadow-sm ${usageCardColor}`} title="Monthly Event Usage">
            <span className={`text-[10px] font-mono font-bold leading-none ${textQuotaColor}`}>
              {formatQuota(profile.eventsUsed)}
            </span>
            <div className="h-1.5 w-10 overflow-hidden rounded-full bg-white/80 ring-1 ring-black/5">
              <div className={`h-full rounded-full ${quotaColor}`} style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        ) : (
          <div className={`rounded-xl border px-3 py-2.5 shadow-sm ${usageCardColor}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${textQuotaColor}`}>Events usage</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {formatQuota(profile.eventsUsed)} of {formatQuota(profile.eventsQuota)} events
                </p>
              </div>
              <span className={`rounded-full bg-white/80 px-2 py-1 text-[11px] font-black shadow-sm ring-1 ring-black/5 ${textQuotaColor}`}>
                {usagePercent.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/80 shadow-inner ring-1 ring-black/5">
              <div className={`h-full rounded-full transition-all duration-500 ${quotaColor}`} style={{ width: `${usagePercent}%` }} />
            </div>
            <div className="mt-2 flex justify-end text-[9px] leading-none text-slate-500">
              {profile.renewalDate ? (() => {
                const resetDate = new Date(profile.renewalDate);
                const today = new Date();
                const daysLeft = Math.ceil((resetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const label = resetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <span className={daysLeft <= 5 ? 'font-bold text-rose-600' : ''}>
                    Resets {label} · {daysLeft}d left
                  </span>
                );
              })() : <span>Resets monthly</span>}
            </div>
          </div>
        )}
      </div>

      {/* User Profile & Logout */}
      <div className="shrink-0 bg-white p-3 pt-1">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setActivePage('account')}
              className="flex h-9 w-9 cursor-pointer select-none items-center justify-center rounded-full border border-indigo-200 bg-indigo-100 text-base font-black text-indigo-700 shadow-sm transition-colors hover:bg-indigo-200"
              title="Account Settings"
            >
              {profileInitial}
            </button>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="group flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
              title="Log Out"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_88px] items-stretch gap-2">
            <button
              onClick={() => setActivePage('account')}
              className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50/60"
              title="Account Settings"
            >
              <div className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full border border-indigo-200 bg-gradient-to-br from-indigo-100 to-violet-100 text-base font-black text-indigo-700 shadow-sm">
                {profileInitial}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-xs font-bold text-slate-800">{displayProfileName}</span>
                <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-gradient-to-r from-indigo-100 to-violet-100 px-2 py-0.5 text-[9px] font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200/70">
                  {profile.plan}
                </span>
              </div>
            </button>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="group flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-500 transition-all hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              title="Log Out"
            >
              <LogOut className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
    {showLogoutConfirm && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl  ">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900 ">Log out?</h3>
            <p className="text-xs leading-relaxed text-slate-500 ">You can log back in anytime.</p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50    "
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLogoutConfirm(false);
                onLogout();
              }}
              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-rose-700"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    )}
    {showLockedFeature && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
          <LockKeyhole className="h-6 w-6 text-amber-500" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">Growth feature locked</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Incomplete Orders is available with a Growth trial or paid plan.</p>
          <button type="button" onClick={() => setShowLockedFeature(false)} className="mt-5 w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700">Got it</button>
        </div>
      </div>
    )}
    </>
  );
}
