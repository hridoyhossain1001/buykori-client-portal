import type { CAPIEvent } from '../../types';

export const panelClass = 'rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]';

export function compactNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return value.toLocaleString();
}

/**
 * Format a plan quota's denominator for the usage meters.
 *
 * The backend uses `0` as the "unlimited" sentinel for Agency/custom plans, so a
 * raw render produced "/ 0 events" (and the old Sidebar formatter turned
 * 1,000,000 into "1000.0k"). One shared formatter keeps every meter honest:
 * a real ceiling reads compactly (1M, 12.5K), and unlimited reads "Unlimited"
 * — never "0", "∞", or a NaN. `quota <= 0` (or non-finite) means unlimited.
 */
export function formatQuotaLimit(quota: number): string {
  if (!Number.isFinite(quota) || quota <= 0) return 'Unlimited';
  return compactNumber(quota);
}

/** True when a quota is the unlimited sentinel (0) rather than a finite ceiling. */
export function isUnlimitedQuota(quota: number): boolean {
  return !Number.isFinite(quota) || quota <= 0;
}

/**
 * Usage percentage clamped to 0–100.
 *
 * Unlimited quotas (0) return 0 so the meter bar stays empty instead of dividing
 * by zero into NaN/Infinity and rendering a full or broken bar.
 */
export function quotaPercent(used: number, quota: number): number {
  if (isUnlimitedQuota(quota) || !Number.isFinite(used)) return 0;
  return Math.min(100, Math.max(0, (used / quota) * 100));
}

export function eventContext(event: CAPIEvent) {
  if (event.contentName?.trim()) return event.contentName.trim();
  if (event.pageTitle?.trim()) return event.pageTitle.trim();
  if (event.orderId?.trim()) return `Order #${event.orderId.trim()}`;
  if (event.contextLabel?.trim() && event.contextLabel !== 'Website event') return event.contextLabel.trim();
  if (event.pageUrl) {
    try {
      const path = new URL(event.pageUrl).pathname.replace(/^\/|\/$/g, '').replace(/[-_]+/g, ' ');
      if (path) return decodeURIComponent(path);
    } catch {
      // Fall through to the generic label for malformed or relative URLs.
    }
  }
  return 'Website event';
}

export function relativeEventTime(timestamp: string) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Just now';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function shortPlatformName(platform: string) {
  if (platform === 'Meta CAPI') return 'Meta';
  if (platform === 'TikTok Events API') return 'TikTok';
  if (platform === 'Gateway Ingest') return 'Server';
  return platform;
}

/**
 * Delivery health for one platform.
 *
 * The verdict must depend on the SUCCESS RATE, not merely on whether any events
 * exist. Keying it on `total > 0` reported a platform delivering 10% of its
 * events as green "Healthy", which is the opposite of what the merchant needs
 * to know. `null` rate means "no attempts yet" — never a score.
 */
export type PlatformHealthTone = 'healthy' | 'degraded' | 'failing' | 'idle';

export interface PlatformHealth {
  tone: PlatformHealthTone;
  /** Short verdict for the badge/pill. */
  label: string;
  /** Displayed score, or an em dash when there is nothing to score. */
  display: string;
}

export const HEALTHY_DELIVERY_THRESHOLD = 95;
export const DEGRADED_DELIVERY_THRESHOLD = 80;

export function platformHealth(total: number, rate: number | null): PlatformHealth {
  if (total <= 0 || rate === null) {
    return { tone: 'idle', label: 'Waiting', display: '—' };
  }
  const display = `${rate}%`;
  if (rate >= HEALTHY_DELIVERY_THRESHOLD) return { tone: 'healthy', label: 'Healthy', display };
  if (rate >= DEGRADED_DELIVERY_THRESHOLD) return { tone: 'degraded', label: 'Degraded', display };
  return { tone: 'failing', label: 'Failing', display };
}

/** Tailwind classes per tone, so desktop and mobile cannot drift apart. */
export const PLATFORM_HEALTH_TEXT: Record<PlatformHealthTone, string> = {
  healthy: 'text-emerald-600',
  degraded: 'text-amber-600',
  failing: 'text-rose-600',
  idle: 'text-slate-400',
};

export const PLATFORM_HEALTH_PILL: Record<PlatformHealthTone, string> = {
  healthy: 'bg-emerald-50 text-emerald-600',
  degraded: 'bg-amber-50 text-amber-700',
  failing: 'bg-rose-50 text-rose-700',
  idle: 'bg-slate-100 text-slate-400',
};

export const PLATFORM_HEALTH_ICON: Record<PlatformHealthTone, string> = {
  healthy: 'text-emerald-500',
  degraded: 'text-amber-500',
  failing: 'text-rose-500',
  idle: 'text-slate-300',
};

/**
 * Quota pressure for the usage meters.
 *
 * The desktop panel previously hardcoded a green meter, so a merchant at 100%
 * saw the same healthy colour as one at 5% while their events were being
 * rejected with HTTP 429. Exhaustion has to be stated in words, not implied by
 * a bar that happens to be full.
 */
export type QuotaTone = 'ok' | 'warning' | 'critical' | 'exhausted';

export const QUOTA_WARNING_THRESHOLD = 75;
export const QUOTA_CRITICAL_THRESHOLD = 90;

export function quotaTone(percent: number): QuotaTone {
  if (percent >= 100) return 'exhausted';
  if (percent >= QUOTA_CRITICAL_THRESHOLD) return 'critical';
  if (percent >= QUOTA_WARNING_THRESHOLD) return 'warning';
  return 'ok';
}

export const QUOTA_BAR: Record<QuotaTone, string> = {
  ok: 'bg-gradient-to-r from-[#285ac7] to-[#12b886]',
  warning: 'bg-gradient-to-r from-amber-400 to-orange-500',
  critical: 'bg-gradient-to-r from-orange-500 to-rose-500',
  exhausted: 'bg-rose-600',
};

export const QUOTA_TEXT: Record<QuotaTone, string> = {
  ok: 'text-emerald-600',
  warning: 'text-amber-600',
  critical: 'text-rose-600',
  exhausted: 'text-rose-700',
};

export function chartGeometry(values: number[], width = 320, height = 86) {
  const safeValues = values.length > 0 ? values : [0, 0];
  const max = Math.max(...safeValues, 1);
  const denominator = Math.max(1, safeValues.length - 1);
  const points = safeValues.map((value, index) => ({
    x: (index / denominator) * width,
    y: height - 8 - (Math.max(0, value) / max) * (height - 22),
  }));
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  return {
    line,
    area: `${line} L${width} ${height} L0 ${height} Z`,
  };
}
