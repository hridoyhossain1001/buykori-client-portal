import type { CAPIEvent } from '../../types';

export const panelClass = 'rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]';

export function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return value.toLocaleString();
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
