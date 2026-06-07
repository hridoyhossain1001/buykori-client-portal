/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Search, 
  HelpCircle, 
  RefreshCw,
  CheckCircle2,
  XCircle,
  Menu,
  Sun,
  Moon,
  X,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { ClientConnection, Suggestion } from '../types';

interface HeaderProps {
  title: string;
  connection: ClientConnection;
  onRefreshConnection: () => Promise<void>;
  searchVal: string;
  setSearchVal: (value: string) => void;
  onMenuClick?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  suggestions?: Suggestion[];
  setActivePage?: (p: string) => void;
}

const pageSuggestions = [
  { id: 'dashboard', name: 'Dashboard / Overview', keywords: ['dashboard', 'home', 'overview', 'main', 'quota'] },
  { id: 'analytics', name: 'Insights & Analytics', keywords: ['insights', 'analytics', 'chart', 'trend', 'volume', 'quality'] },
  { id: 'pending-purchases', name: 'COD Order Holds', keywords: ['order verification', 'cod protection', 'verify', 'pending', 'cancel', 'hold'] },
  { id: 'orders', name: 'Courier Shipping', keywords: ['orders', 'delivery', 'courier', 'pathao', 'steadfast', 'redx'] },
  { id: 'incomplete-checkouts', name: 'Lost Sales Recovery', keywords: ['incomplete checkouts', 'abandoned', 'recovery', 'checkout', 'phone'] },
  { id: 'campaign-builder', name: 'Campaign Helper', keywords: ['campaigns', 'builder', 'url', 'utm', 'test'] },
  { id: 'suggestions', name: 'Smart Tips', keywords: ['suggestions', 'tips', 'health', 'issues'] },
  { id: 'setup-guide', name: 'Setup Guide / Docs', keywords: ['setup guide', 'docs', 'faq', 'wordpress', 'installation'] },
  { id: 'event-logs', name: 'Event Logs', keywords: ['event history', 'logs', 'success', 'retry', 'event key'] },
  { id: 'api-logs', name: 'API Logs', keywords: ['api logs', 'endpoint', 'latency', 'responses'] },
  { id: 'settings', name: 'Settings', keywords: ['settings', 'pixel', 'access token', 'rules', 'connection'] },
  { id: 'account', name: 'Account Details', keywords: ['account', 'profile', 'password', 'delete', 'reset'] }
];

export function Header({ 
  title, 
  connection, 
  onRefreshConnection, 
  searchVal, 
  setSearchVal, 
  onMenuClick,
  isDark,
  onToggleTheme,
  suggestions = [],
  setActivePage
}: HeaderProps) {
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; msg: string; err: boolean }>({ show: false, msg: '', err: false });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const unresolvedSuggestions = suggestions.filter(s => !s.resolved);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const matchingPages = searchVal.trim()
    ? pageSuggestions.filter(p => 
        p.name.toLowerCase().includes(searchVal.toLowerCase()) || 
        p.keywords.some(k => k.toLowerCase().includes(searchVal.toLowerCase()))
      )
    : [];

  const triggerHeartbeat = async () => {
    setTesting(true);
    try {
      await onRefreshConnection();
      setToast({
        show: true,
        msg: "WordPress connected! Everything looks good.",
        err: false
      });
    } catch {
      setToast({
        show: true,
        msg: "Couldn't reach your WordPress site. Please check your plugin.",
        err: true
      });
    } finally {
      setTesting(false);
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 4000);
    }
  };

  const getStatusBadge = () => {
    switch (connection.status) {
      case 'Active':
        return (
          <div className="flex items-center gap-1.5 rounded-full border border-green-150 bg-green-50 px-2.5 py-0.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-wider text-green-700 uppercase">Connected</span>
          </div>
        );
      case 'Degraded':
        return (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-150 bg-amber-50 px-2.5 py-0.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-wider text-amber-700 uppercase">Slow Connection</span>
          </div>
        );
      case 'Disconnected':
      default:
        return (
          <div className="flex items-center gap-1.5 rounded-full border border-rose-150 bg-rose-50 px-2.5 py-0.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-wider text-rose-700 uppercase">Disconnected</span>
          </div>
        );
    }
  };

  return (
    <>
      <header className="sticky top-0 z-35 flex h-12 md:h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-8 dark:bg-slate-900 dark:border-slate-800">
        {/* Title & Status */}
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="block md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
              aria-label="Toggle navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-sm md:text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100 truncate">{title}</h1>
          <div className="hidden sm:block shrink-0">{getStatusBadge()}</div>
        </div>

        {/* Centered Glowing Search Capsule */}
        <div ref={searchContainerRef} className="relative hidden lg:flex flex-1 justify-center max-w-xs xl:max-w-md mx-auto group">
          {/* Soft ambient orange glow beneath */}
          <div className="ambient-glow-capsule"></div>
          
          {/* Input container */}
          <div className="orange-glow-capsule-input relative z-10 flex items-center justify-between w-full max-w-[320px] rounded-full px-5 py-2">
            <input
              type="text"
              placeholder="Search"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="text-xs text-slate-800 dark:text-slate-100 placeholder-slate-850 dark:placeholder-slate-100 font-semibold"
            />
            <Search className="absolute right-4 top-3 h-3.5 w-3.5 text-slate-700 dark:text-slate-300 pointer-events-none" />
          </div>

          {/* Quick-navigation suggestions dropdown */}
          {isSearchFocused && matchingPages.length > 0 && setActivePage && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-full max-w-[320px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-slide-up">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-[9px] font-bold text-slate-400 uppercase tracking-widest select-none">
                Quick Navigation
              </div>
              <div className="py-1 divide-y divide-slate-100 dark:divide-slate-850/40">
                {matchingPages.map(page => (
                  <div
                    key={page.id}
                    onClick={() => {
                      setActivePage(page.id);
                      setSearchVal('');
                      setIsSearchFocused(false);
                    }}
                    className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between group cursor-pointer select-none"
                    role="button"
                  >
                    <span>{page.name}</span>
                    <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Jump to →</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Query Search / Controls */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          {/* Mobile Search Button (Visible only on <1024px screens / lg:hidden) */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="block lg:hidden p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500"
            title="Search logs"
          >
            <Search className="w-4 h-4 text-slate-500" />
          </button>



          {/* Sync trigger */}
          <button
            onClick={triggerHeartbeat}
            disabled={testing}
            className={`p-1.5 md:p-2 rounded-full text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
              testing ? 'animate-spin' : ''
            }`}
            title="Check Connection"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

           {/* Notifications & Help */}
          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2 md:pl-4">
            <div className="relative" ref={notificationsRef}>
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative rounded-full p-1.5 md:p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus:outline-none cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />                 {unresolvedSuggestions.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full border border-white dark:border-slate-900 bg-indigo-500 animate-pulse"></span>
                )}
              </button>

              {/* Interactive notification dropdown menu listing diagnostics issues */}
              {isNotificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden animate-slide-up">
                  {/* Dropdown Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issues Found</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-mono">
                      {unresolvedSuggestions.length} Pending
                    </span>
                  </div>

                  {/* Dropdown Content */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {unresolvedSuggestions.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 font-medium">
                        <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-500 mb-2" />
                        <p className="text-xs">Your tracking is healthy!</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Your tracking looks healthy.</p>
                      </div>
                    ) : (
                      unresolvedSuggestions.map((s) => (
                        <div 
                          key={s.id} 
                          onClick={() => {
                            if (setActivePage) {
                              setActivePage('suggestions');
                              setIsNotificationsOpen(false);
                            }
                          }}
                          className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider shrink-0 ${
                              s.severity === 'Critical' ? 'bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40' : 
                              s.severity === 'Warning' ? 'bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40' : 
                              'bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/40'
                            }`}>
                              {s.severity}
                            </span>
                            {s.platform && <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">{s.platform}</span>}
                          </div>
                          <h4 className="text-xs font-bold uppercase text-slate-800 dark:text-white tracking-wider">Issues Found</h4>
                          <p className="text-[10.5px] text-slate-400 dark:text-slate-500 leading-normal mt-0.5 truncate">{s.explanation}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Dropdown Footer */}
                  {unresolvedSuggestions.length > 0 && setActivePage && (
                    <div 
                      onClick={() => {
                        setActivePage('suggestions');
                        setIsNotificationsOpen(false);
                      }}
                      className="block text-center py-2.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 text-[10px] font-bold text-indigo-600 hover:text-indigo-750 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      View all suggestions →
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button className="hidden sm:block rounded-full p-1.5 md:p-2 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800" title="Help & Support">
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {toast.show && (
          <div className="fixed top-14 right-4 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-100 shadow-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white animate-slide-in-right">
            {toast.err ? (
              <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">
              {toast.msg}
            </span>
          </div>
        )}
      </header>

      {/* Responsive dedicated trigger search modal for mobile views (<768px) */}
      {isSearchOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" 
          onClick={() => setIsSearchOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Search</span>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 space-y-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by event name, ID, or customer data..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-9 py-2.5 text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 dark:bg-slate-800 dark:border-slate-700 font-mono transition-all"
                  autoFocus
                />
                <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                {searchVal && (
                  <button
                    onClick={() => setSearchVal('')}
                    className="absolute right-3 top-2.5 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Instant Highlight Feature Info */}
              <div className="text-[10px] text-slate-400 flex items-center justify-between">
                <span>Results update as you type</span>
                {searchVal && (
                  <span className="text-indigo-600 dark:text-indigo-400 font-mono text-[9px] bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                    "{searchVal}"
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSearchVal('');
                    setIsSearchOpen(false);
                  }}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 rounded-lg text-xs font-bold transition-all border border-slate-200 dark:border-slate-700"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
