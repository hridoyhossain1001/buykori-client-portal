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
  const [storeSwitcherOpen, setStoreSwitcherOpen] = useState(false);
  const [switchingStore, setSwitchingStore] = useState<number | null>(null);
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
        { id: 'dashboard', name: 'Store Home', icon: LayoutDashboard },
        { id: 'analytics', name: 'Ad Insights', icon: TrendingUp },
      ],
    },
    {
      label: 'YOUR ORDERS',
      items: [
        {
          id: 'pending-purchases',
          name: 'COD Order Holds',
          icon: ShieldCheck,
          subtitle: 'Hold COD orders until confirmed',
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
          name: 'Lost Sales Recovery',
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
        { id: 'campaign-builder', name: 'Campaign Helper', icon: Megaphone },
        { id: 'suggestions', name: 'Smart Tips', icon: Lightbulb, count: suggestionsCount },
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
  const quotaColor = usagePercent > 90 ? 'bg-rose-600' : usagePercent > 70 ? 'bg-amber-500' : 'bg-indigo-600';
  const textQuotaColor = usagePercent > 90 ? 'text-rose-600' : usagePercent > 70 ? 'text-amber-600' : 'text-indigo-600';

  return (
    <>
    <aside
      className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-transform duration-300 md:transition-all   ${
        collapsed ? 'md:w-20' : 'md:w-64'
      } ${
        mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div className={`flex items-center h-12 md:h-14 border-b border-slate-100  ${
        collapsed ? 'justify-center px-2 gap-1' : 'justify-between px-5'
      }`}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold shrink-0">
            B
          </div>
          {!collapsed && (
            <span className="font-sans font-bold text-lg tracking-tight text-slate-800  truncate">
              Buykori
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
          className="p-1 px-[5px] rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-50    transition-colors"
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
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400  mb-1.5 px-1">Active Store</p>
          <div className="relative">
            <button
              onClick={() => setStoreSwitcherOpen(prev => !prev)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-200  bg-slate-50  hover:bg-white  transition-all cursor-pointer"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-100  shrink-0">
                <Store className="w-3.5 h-3.5 text-indigo-600 " />
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
              <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white  rounded-xl border border-slate-200  shadow-xl overflow-hidden">
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
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold text-indigo-600  hover:bg-indigo-50  transition-colors cursor-pointer"
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
            className="group relative p-2 rounded-lg hover:bg-slate-100  transition-colors cursor-pointer"
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
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {menuGroups.map((group, groupIndex) => {
          const visibleItems = group.items.filter(
            (item) => !item.requireOrderMgmt || orderManagementEnabled
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label} className={groupIndex === 0 ? '' : collapsed ? 'mt-3' : 'mt-5'}>
              {!collapsed && (
                <div className="mb-2 flex items-center gap-2 px-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ">
                    {group.label}
                  </span>
                  <span className="h-px flex-1 bg-slate-200/70 " />
                </div>
              )}

              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        setActivePage(item.id);
                        setMobileOpen(false);
                      }}
                      className={`group relative flex w-full overflow-visible rounded-md text-sm transition-all duration-200 ${
                        isActive
                          ? 'sidebar-active-glow font-semibold shadow-sm'
                          : 'font-medium text-slate-600 hover:bg-white/70 hover:text-slate-900 hover:shadow-sm   '
                      } ${collapsed ? 'justify-center px-0 py-2.5' : 'items-center gap-3 px-3 py-2.5'}`}
                    >
                      {isActive && (
                        <span className="sidebar-active-indicator absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full" />
                      )}

                      <Icon
                        strokeWidth={isActive ? 2.5 : 2}
                        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                          isActive
                            ? 'text-indigo-600 '
                            : 'text-slate-400 group-hover:text-slate-600 '
                        }`}
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

                      {Boolean(item.count) && !collapsed && (
                        <span className="ml-auto rounded-full border border-indigo-200/60 bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700   ">
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
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Usage Indicator */}
      <div className={`border-t border-slate-100 bg-slate-50/50   p-4 ${collapsed ? 'hidden md:block' : ''}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1.5" title="Monthly Event Usage">
            <span className={`text-[10px] font-mono font-semibold leading-none ${textQuotaColor}`}>
              {formatQuota(profile.eventsUsed)}
            </span>
            <div className="w-10 h-1.5 bg-slate-200  rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${quotaColor}`} style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider ">
              <span>Events Usage</span>
              <span className="font-bold">{usagePercent.toFixed(1)}%</span>
            </div>
            <div className="relative w-full h-1.5 bg-slate-200  rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-500 ${quotaColor}`} style={{ width: `${usagePercent}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400  leading-none mt-1">
              <span>{formatQuota(profile.eventsUsed)} / {formatQuota(profile.eventsQuota)} events</span>
              {profile.renewalDate ? (() => {
                const resetDate = new Date(profile.renewalDate);
                const today = new Date();
                const daysLeft = Math.ceil((resetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const label = resetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <span className={daysLeft <= 5 ? 'text-rose-500 font-semibold' : ''}>
                    Reset: {label} ({daysLeft}d)
                  </span>
                );
              })() : <span>Reset monthly</span>}
            </div>
          </div>

        )}
      </div>

      {/* User Profile & Logout */}
      <div className="p-4 bg-slate-50/85 border-t border-slate-150   space-y-3 shrink-0">
        {collapsed ? (
          <div className="flex justify-center">
            <button
              onClick={() => setActivePage('account')}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold select-none shadow-sm    hover:bg-indigo-200  transition-colors cursor-pointer"
              title="Account Settings"
            >
              {profile.name.split(' ').map(n => n[0]).join('')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setActivePage('account')}
            className="w-full flex items-center gap-3 text-left hover:bg-slate-100  p-1.5 rounded-lg transition-colors cursor-pointer"
            title="Account Settings"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold select-none shadow-sm    shrink-0">
              {profile.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex flex-col overflow-hidden leading-tight">
              <span className="text-xs font-semibold text-slate-700  truncate">{profile.name}</span>
              <span className="text-[10px] text-slate-400  truncate">{profile.plan}</span>
            </div>
          </button>
        )}

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={`flex items-center w-full text-slate-500 hover:text-rose-600   hover:bg-rose-50  rounded-lg text-sm font-medium transition-all duration-200 group ${
            collapsed ? 'justify-center py-2' : 'gap-3 py-2 px-3'
          }`}
          title="Log Out"
        >
          <LogOut className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          {!collapsed && <span className="text-xs">Log Out</span>}
        </button>
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
    </>
  );
}
