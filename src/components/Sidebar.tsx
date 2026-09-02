/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import {
  Activity,
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  MessageSquareText,
  Send,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { UserProfile } from '../types';
import { Button } from './common/Button';
import { Modal } from './common/Modal';
import { LockedFeatureModal, resolveLockedFeature, type LockedFeature } from './LockedFeatureModal';
import {
  compactNumber,
  formatQuotaLimit,
  isUnlimitedQuota,
  quotaPercent,
  quotaTone,
} from './dashboard/dashboardUtils';
import { clientPageAllowed } from '../lib/aiAdsFeatureGate';

/** The prototype's `.portal-nav button`: a 22px / 1fr / auto row at 39px. */
const NAV_ROW = 'bk-console-nav-item group grid w-full items-center text-left transition-colors duration-150';
const NAV_ROW_WIDE = 'grid-cols-[22px_minmax(0,1fr)_auto] gap-2 px-2.5';

/** The prototype's `.profile-chip`, on its 34px leading column. */
const CHIP_GRID = 'grid min-h-[62px] items-center gap-[9px]';

/**
 * The rail shows the real logo file, not the prototype's hand-drawn letter tile.
 * Which path serves that file depends on which origin is serving the portal: the
 * Vercel bundle carries it at the web root (`client-portal/public`), while the
 * API origin serves the same image out of `/static/css`. Try them in order, and
 * only fall back to the prototype's tile if neither loads — the old rail asked
 * for the `/static/css` path unconditionally and drew a broken-image glyph on
 * every host that is not the API origin.
 */
const BRAND_LOGO_SOURCES = ['/brand-logo.png', '/static/css/brand-logo.png'];


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
}

export function Sidebar({
  activePage,
  setActivePage,
  profile,
  collapsed: collapsedRail,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  onLogout,
  orderManagementEnabled,
  suggestionsCount,
  orderVerificationCount,
  deliveryBadgeCount,
  incompleteCheckoutCount,
}: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<LockedFeature | null>(null);
  const logoutTriggerRef = useRef<HTMLButtonElement>(null);
  const [brandLogoAttempt, setBrandLogoAttempt] = useState(0);
  const brandLogoSrc: string | undefined = BRAND_LOGO_SOURCES[brandLogoAttempt];

  /**
   * Collapsing is a *desktop rail* state: it trades labels for a 72px strip.
   * The mobile drawer is 284px wide, so honouring it there gives a full-width
   * panel showing nothing but icons. While the drawer is open, the rail is a
   * drawer and always renders in full.
   */
  const collapsed = collapsedRail && !mobileOpen;

  /**
   * The prototype's four groups, in its order and its wording — see `groups` in
   * `ui-ux-audit-prototype/portal.tsx`. Two rows depart from it, both because
   * the prototype is a design study over a smaller page set than the live one:
   *
   *  - "Delivery logs" is the live `api-logs` page, whose own heading is already
   *    "Platform delivery history". It had a route and no way to reach it, so
   *    until now a client could only land on it by typing the URL. The
   *    prototype's TRACKING group is exactly where it belongs.
   *  - "Ad Insights" has no prototype counterpart at all — the study has no
   *    analytics page. Dropping the row to match would strand a working page, so
   *    it leads GROWTH, next to the other two ad surfaces.
   *
   * The counts stay on the live sources rather than the prototype's. Its Orders
   * badge counts *every* order this month while its own screen-reader text reads
   * "Pending:", so the number contradicts its label; `deliveryBadgeCount` is the
   * one that actually needs action.
   */
  const menuGroups: SidebarGroup[] = [
    {
      label: 'OPERATIONS',
      items: [
        { id: 'dashboard', name: 'Overview', icon: LayoutDashboard },
        {
          id: 'orders',
          name: 'Orders',
          icon: ClipboardList,
          count: deliveryBadgeCount,
          locked: !profile.growthFeaturesEnabled,
        },
        {
          id: 'pending-purchases',
          name: 'COD review',
          icon: ShieldCheck,
          count: orderVerificationCount,
        },
        {
          id: 'incomplete-checkouts',
          name: 'Incomplete checkouts',
          icon: MessageSquareText,
          count: incompleteCheckoutCount,
          locked: !profile.growthFeaturesEnabled,
        },
      ],
    },
    {
      label: 'TRACKING',
      items: [
        { id: 'event-logs', name: 'Event activity', icon: Activity },
        { id: 'api-logs', name: 'Delivery logs', icon: Send },
        { id: 'suggestions', name: 'Setup health', icon: Zap, count: suggestionsCount },
      ],
    },
    {
      label: 'GROWTH',
      items: [
        { id: 'analytics', name: 'Ad Insights', icon: TrendingUp },
        { id: 'campaign-builder', name: 'Campaign tools', icon: Target },
        { id: 'ai-ads', name: 'AI Ads', icon: BriefcaseBusiness },
      ],
    },
    {
      label: 'ADMINISTRATION',
      items: [
        { id: 'setup-guide', name: 'Setup guide', icon: BookOpen },
        { id: 'settings', name: 'Settings', icon: Settings },
        { id: 'account', name: 'Account', icon: UserRound },
      ],
    },
  ];

  const usagePercent = quotaPercent(profile.eventsUsed, profile.eventsQuota);
  const unlimited = isUnlimitedQuota(profile.eventsQuota);
  /**
   * The prototype's meter is always mint, because its sample store is at 25%.
   * A real store can be at 96%, and a bar that stays mint there tells the owner
   * nothing — so the fill keeps the same tones the dashboard's usage panel uses,
   * from the same shared threshold function. The steps are the light end of each
   * ramp because the track behind them is nearly black.
   */
  const tone = quotaTone(usagePercent);
  const meterFill = tone === 'ok'
    ? 'bg-[var(--bk-accent-bright)]'
    : tone === 'warning'
      ? 'bg-amber-300'
      : 'bg-rose-400';
  const rawProfileName = String(profile.name || '').trim() || 'User';
  const profileInitial = rawProfileName.charAt(0).toUpperCase();
  const displayProfileName = `${profileInitial}${rawProfileName.slice(1)}`;
  /** The prototype's avatar holds two letters; a one-word name supplies one. */
  const avatarInitials = rawProfileName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  return (
    <>
    {/* The closed mobile drawer is pushed off-screen, and off-screen is not the
        same as gone: it kept 17 tab stops — "Log out" among them — so a keyboard
        user tabbed into a rail they could not see. `invisible` takes it out of
        both the tab order and the accessibility tree, and because `visibility`
        interpolates discretely it stays visible for the whole slide-out and only
        flips at the end, so the drawer is not cut off mid-slide. `md:visible`
        keeps the desktop rail, which is never "closed".

        The transition names `translate`, not `transform`: Tailwind v4 compiles
        `-translate-x-full` to the standalone `translate: -100%` property, so a
        `transition-transform` here transitioned a property nothing was changing
        and the drawer snapped instead of sliding (measured: fully off-screen
        70ms into a 200ms close). Do not "tidy" this back to transform. */}
    <aside
      className={`bk-console-sidebar fixed top-0 bottom-0 left-0 z-50 flex flex-col transition-[translate,visibility] duration-200 md:transition-all ${
        collapsed ? 'is-collapsed' : ''
      } ${
        mobileOpen ? 'translate-x-0' : 'invisible -translate-x-full md:visible md:translate-x-0'
      }`}
    >
      {/* Brand Header */}
      <div data-guide="brand" className={`bk-console-brand flex items-center gap-[11px] ${
        collapsed ? 'justify-center px-2' : 'px-[18px]'
      }`}>
        {/* The prototype draws the mark itself — a 32px mint tile holding the
            letter, `.brand-mark` — rather than loading one. The live rail has a
            real logo file and keeps using it; the tile is only the last-resort
            fallback when no origin can serve that image. See
            BRAND_LOGO_SOURCES. */}
        {brandLogoSrc ? (
          <img
            src={brandLogoSrc}
            alt="Buykori"
            className="h-8 w-8 shrink-0 object-contain drop-shadow-sm"
            onError={() => setBrandLogoAttempt(attempt => attempt + 1)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 select-none place-items-center rounded-[7px] bg-[var(--bk-accent-bright)] text-[18px] font-extrabold leading-none text-[var(--bk-sidebar-brand-mark-text)]"
          >
            B
          </span>
        )}
        {!collapsed && (
          /* The prototype stacks the name over the product, which is what lets a
             248px rail carry both without truncating either. */
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-[16px] font-bold leading-tight text-[var(--bk-sidebar-text-strong)]">
              Buykori
            </strong>
            <span className="mt-px block truncate text-label font-bold uppercase tracking-[0.05em] text-[var(--bk-sidebar-label)]">
              AdSync
            </span>
          </span>
        )}
        {/* One button, two jobs: the drawer's close on a phone and the rail's
            collapse toggle on a desktop. It was 28×28 on both — `p-1.5` around a
            16px icon — which is the prototype's chevron, right for a mouse and
            too small for the thumb that has to dismiss a full-height drawer. So
            the phone gets a real 44px box (the brand row is 68px tall and the
            drawer 248px wide, so nothing moves) and the desktop keeps the 28px
            chevron, with `btn-touch-expand` carrying its hit area to 48px the
            way Tooltip's 24×24 button does. The collapsed 72px rail is
            desktop-only — `collapsed` is `collapsedRail && !mobileOpen` — so the
            larger box never has to fit in it. */}
        <button
          onClick={() => {
            if (window.innerWidth < 768) {
              setMobileOpen(false);
            } else {
              setCollapsed(!collapsedRail);
            }
          }}
          className="btn-touch-expand grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--bk-sidebar-text)] transition-colors hover:bg-[var(--bk-sidebar-hover)] hover:text-[var(--bk-sidebar-text-strong)] md:h-auto md:w-auto md:p-1.5"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="md:hidden"><X className="w-4 h-4" /></span>
          <span className="hidden md:inline">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </span>
        </button>
      </div>

      {/* The "Active store" card used to sit here, between the brand header and
          the nav. It moved to the topbar (see StoreSwitcher in Header.tsx): the
          rail is the place you go to *navigate*, and a card naming the store —
          repeated on every page, directly under a logo that already says whose
          workspace this is — was the one block of the rail that was never
          clicked for navigation. The switching itself is not lost; it is the
          topbar's domain chip now, which is also where the merchant reads the
          store's address. */}

      {/* Primary Navigation Links */}
      <nav className={`min-h-0 flex-1 overflow-y-auto pb-3.5 pt-[3px] ${collapsed ? 'px-2' : 'px-2.5'}`}>
        {menuGroups.map((group, groupIndex) => {
          const visibleItems = group.items.filter(
            (item) => (!item.requireOrderMgmt || orderManagementEnabled) &&
              clientPageAllowed(item.id, profile)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={group.label}>
              {!collapsed && (
                /* The prototype's group label is a plain caption with margins —
                   no rule beside it, which is what keeps three groups from
                   reading as three separate panels. */
                <p className={`bk-console-group-label mx-[9px] mb-1.5 ${groupIndex === 0 ? 'mt-2.5' : 'mt-4'}`}>
                  {group.label}
                </p>
              )}

              <div id={`sidebar-group-${groupIndex}`} className={collapsed ? 'space-y-1' : ''}>
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      aria-current={isActive ? 'page' : undefined}
                      data-guide={`nav-${item.id}`}
                      /* A collapsed row shows an icon and nothing else, so the
                         name has to come from somewhere. It cannot be the styled
                         tooltip the rest of the rail uses: this <nav> scrolls, and
                         `overflow-y: auto` forces `overflow-x` to `auto` too, which
                         clips anything positioned past the 72px edge. Making the
                         tooltip `fixed` escapes the clip but then stops tracking
                         the row once the nav is scrolled, which is worse. The
                         native tooltip is never clipped and always correct. */
                      title={collapsed ? item.name : undefined}
                      onClick={() => {
                        if (item.locked) {
                          setLockedFeature(resolveLockedFeature(item.id, item.name));
                          setMobileOpen(false);
                          return;
                        }
                        setActivePage(item.id);
                        setMobileOpen(false);
                      }}
                      className={`${NAV_ROW} ${isActive ? 'is-active' : 'font-medium'} ${
                        collapsed ? 'justify-items-center px-0' : NAV_ROW_WIDE
                      }`}
                    >
                      <Icon
                        strokeWidth={isActive ? 2.5 : 2}
                        className="bk-console-nav-icon h-[18px] w-[18px] shrink-0 transition-colors"
                      />

                      {!collapsed && (
                        <span className="min-w-0 truncate text-body-sm font-semibold">{item.name}</span>
                      )}

                      {Boolean(item.count) && !collapsed && (
                        <b className="bk-console-chip grid place-items-center rounded-[10px] px-[5px] text-label font-bold">
                          <span className="sr-only">Pending: </span>
                          {item.count}
                        </b>
                      )}

                      {item.locked && !collapsed && (
                        <LockKeyhole className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Usage Indicator — the prototype's `.usage-mini`, a card in the rail
          rather than a bordered strip pinned to the bottom of it. */}
      <div className={`shrink-0 px-3 pb-2.5 ${collapsed ? 'hidden md:block' : ''}`}>
        {collapsed ? (
          <div className="bk-console-sidebar-card flex flex-col items-center gap-1.5 px-1.5 py-2" title="Event usage this billing cycle">
            <span className="font-mono text-label font-bold leading-none text-[var(--bk-sidebar-meter-label)]">
              {compactNumber(profile.eventsUsed)}
            </span>
            {!unlimited && (
              <span className="h-[5px] w-10 overflow-hidden rounded bg-[var(--bk-sidebar-track)]">
                <i className={`block h-full rounded ${meterFill}`} style={{ width: `${usagePercent}%` }} />
              </span>
            )}
          </div>
        ) : (
          <div className="bk-console-sidebar-card p-3">
            <span className="block text-label font-extrabold uppercase tracking-[0.05em] text-[var(--bk-sidebar-meter-label)]">
              Events usage
            </span>
            <strong className="mt-1 block text-body-sm font-bold text-[var(--bk-sidebar-text-strong)]">
              {profile.eventsUsed.toLocaleString('en-US')}{' '}
              <small className="text-caption font-medium text-[var(--bk-sidebar-label)]">
                / {unlimited ? formatQuotaLimit(profile.eventsQuota) : profile.eventsQuota.toLocaleString('en-US')} events
              </small>
            </strong>
            {/* An unlimited plan has no bar to fill and no percentage to quote,
                so it says so instead of showing a permanently empty meter. */}
            {!unlimited && (
              <div className="mt-[9px] h-[5px] overflow-hidden rounded bg-[var(--bk-sidebar-track)]">
                <i
                  className={`block h-full rounded transition-all duration-500 ${meterFill}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            )}
            {/* The prototype's caption is the percentage and nothing else. The
                reset date it replaces is still on the Account page ("Renews …")
                and in the dashboard's usage panel, which is where a merchant
                looks when the quota actually matters. */}
            <em className="mt-[7px] block text-label not-italic leading-[1.4] text-[var(--bk-sidebar-label)]">
              {unlimited ? 'Unlimited on this plan' : `${usagePercent.toFixed(1)}% used`}
            </em>
          </div>
        )}
      </div>

      {/* User Profile & Logout — the prototype's `.profile-chip`. It draws the
          whole chip as one button ending in an overflow glyph; the live rail has
          a real logout action, so that trailing slot is the logout button and the
          two sit side by side (a button cannot nest inside a button). */}
      <div className={`bk-console-sidebar-footer shrink-0 ${collapsed ? 'px-2 py-2.5' : 'px-[15px] py-2.5'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setActivePage('account')}
              className="flex h-[34px] w-[34px] cursor-pointer select-none items-center justify-center rounded-full bg-[var(--bk-sidebar-avatar)] text-label font-extrabold text-[var(--bk-sidebar-avatar-text)] transition-transform hover:scale-105"
              title="Account Settings"
              aria-label="Open account settings"
            >
              {avatarInitials}
            </button>
            <button
              ref={logoutTriggerRef}
              onClick={() => setShowLogoutConfirm(true)}
              className="group flex h-9 w-9 items-center justify-center rounded-[var(--bk-radius-control)] text-[var(--bk-sidebar-label)] transition-colors hover:bg-[var(--bk-sidebar-hover)] hover:text-rose-300"
              title="Log Out"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        ) : (
          <div className={`${CHIP_GRID} grid-cols-[minmax(0,1fr)_44px]`}>
            <button
              onClick={() => setActivePage('account')}
              className="grid min-w-0 cursor-pointer grid-cols-[34px_minmax(0,1fr)] items-center gap-[9px] rounded-[var(--bk-radius-control)] py-1 text-left"
              title="Account Settings"
              aria-label="Open account settings"
            >
              <span className="flex h-[34px] w-[34px] shrink-0 select-none items-center justify-center rounded-full bg-[var(--bk-sidebar-avatar)] text-label font-extrabold text-[var(--bk-sidebar-avatar-text)]">
                {avatarInitials}
              </span>
              <span className="min-w-0">
                <strong
                  className="block truncate text-body-sm font-bold text-[var(--bk-sidebar-text-strong)]"
                  title={displayProfileName}
                >
                  {displayProfileName}
                </strong>
                {/* The deployed prototype's line is `{plan} · Owner`, not its
                    fixture's `{plan} plan · Owner` — every real label from
                    plan_service already ends in "Plan" or "Trial", so the extra
                    word read "Growth Plan plan". "Owner" is a constant there and
                    here: the client portal has one login per tenant and no role
                    field, so whoever is reading this line is the account owner. */}
                <small
                  className="mt-[3px] block truncate text-caption text-[var(--bk-sidebar-label)]"
                  title={`${profile.plan} · Owner`}
                >
                  {profile.plan} · Owner
                </small>
              </span>
            </button>

            <button
              ref={logoutTriggerRef}
              onClick={() => setShowLogoutConfirm(true)}
              className="group flex h-11 w-11 items-center justify-center rounded-[var(--bk-radius-control)] text-[var(--bk-sidebar-label)] transition-colors hover:bg-[var(--bk-sidebar-hover)] hover:text-rose-300"
              title="Log Out"
              aria-label="Log out"
            >
              <LogOut className="h-[17px] w-[17px] shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}
      </div>

    </aside>
    {showLogoutConfirm && (
      <Modal
        onClose={() => setShowLogoutConfirm(false)}
        labelledBy="logout-confirm-title"
        returnFocusRef={logoutTriggerRef}
        overlayClassName="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
        panelClassName="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
      >
          <div className="space-y-1">
            <h3 id="logout-confirm-title" className="text-sm font-bold text-slate-900 ">Log out?</h3>
            <p className="text-xs leading-relaxed text-slate-500 ">You can log back in anytime.</p>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowLogoutConfirm(false)}
              className="text-slate-600"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setShowLogoutConfirm(false);
                onLogout();
              }}
            >
              Log Out
            </Button>
          </div>
      </Modal>
    )}
    <LockedFeatureModal feature={lockedFeature} onClose={() => setLockedFeature(null)} />
    </>
  );
}
