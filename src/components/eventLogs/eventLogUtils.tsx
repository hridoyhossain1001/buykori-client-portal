import type { ReactNode } from 'react';
import { CAPIEvent } from '../../types';

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightText(
  text: string | number | undefined | null,
  search: string,
): ReactNode {
  if (text === undefined || text === null) return '';
  const textValue = String(text);
  if (!search.trim()) return textValue;

  try {
    const regex = new RegExp(`(${escapeRegExp(search.trim())})`, 'gi');
    return (
      <>
        {textValue.split(regex).map((part, index) =>
          part.toLowerCase() === search.trim().toLowerCase() ? (
            <mark key={index} className="rounded bg-amber-100 px-0.5 text-amber-900">
              {part}
            </mark>
          ) : (
            part
          ),
        )}
      </>
    );
  } catch {
    return textValue;
  }
}

export const platformOrder: CAPIEvent['platform'][] = [
  'Meta CAPI',
  'TikTok Events API',
  'TikTok Browser Pixel',
  'GA4',
  'Gateway Ingest',
];

export const platformShortName: Record<CAPIEvent['platform'], string> = {
  'Meta CAPI': 'Meta',
  'TikTok Events API': 'TikTok',
  'TikTok Browser Pixel': 'TikTok Pixel',
  GA4: 'GA4',
  'Gateway Ingest': 'Gateway',
};

export interface GroupedEvent {
  key: string;
  eventId: string;
  name: string;
  timestamp: string;
  contextLabel: string;
  pageUrl: string | null;
  events: CAPIEvent[];
  deliveries: CAPIEvent[];
  failedCount: number;
  retryingCount: number;
}

export function groupEvents(events: CAPIEvent[]): GroupedEvent[] {
  const groups = new Map<string, CAPIEvent[]>();

  events.forEach(event => {
    const sharedId = event.deduplicationKey || event.id;
    const key = `${sharedId}::${event.name}`;
    const current = groups.get(key) || [];
    current.push(event);
    groups.set(key, current);
  });

  return Array.from(groups.entries())
    .map(([key, entries]) => {
      const sortedEntries = [...entries].sort((a, b) => {
        const platformDifference =
          platformOrder.indexOf(a.platform) - platformOrder.indexOf(b.platform);
        if (platformDifference !== 0) return platformDifference;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
      const newest = [...entries].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0];
      const latestByPlatform = new Map<CAPIEvent['platform'], CAPIEvent>();
      [...entries]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .forEach(event => {
          if (!latestByPlatform.has(event.platform)) latestByPlatform.set(event.platform, event);
        });
      const deliveries = platformOrder
        .map(platform => latestByPlatform.get(platform))
        .filter((event): event is CAPIEvent => Boolean(event));

      return {
        key,
        eventId: newest.deduplicationKey || newest.id,
        name: newest.name,
        timestamp: newest.timestamp,
        contextLabel: newest.contextLabel || newest.pageTitle || 'Website event',
        pageUrl: newest.pageUrl || null,
        events: sortedEntries,
        deliveries,
        failedCount: deliveries.filter(event => event.status === 'Failed').length,
        retryingCount: deliveries.filter(event => event.status === 'Retry').length,
      };
    })
    .sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

export function relativeTime(timestamp: string): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000),
  );
  if (elapsedSeconds < 60) return 'Just now';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function statusStyles(status: CAPIEvent['status']): string {
  if (status === 'Success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Failed') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (status === 'Retry') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'Fired') return 'border-violet-200 bg-violet-50 text-violet-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

export function mobileEventDateKey(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-CA');
}

export function mobileEventDateLabel(timestamp: string): string {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const prefix = mobileEventDateKey(timestamp) === mobileEventDateKey(today.toISOString())
    ? 'Today'
    : mobileEventDateKey(timestamp) === mobileEventDateKey(yesterday.toISOString())
      ? 'Yesterday'
      : date.toLocaleDateString([], { weekday: 'short' });
  return `${prefix} · ${date.toLocaleDateString([], { day: '2-digit', month: 'short' })}`.toUpperCase();
}

export function eventCustomData(group: GroupedEvent): Record<string, unknown> {
  const firstPayload = group.events[0]?.payload || {};
  const customData = firstPayload.custom_data;
  return customData && typeof customData === 'object' && !Array.isArray(customData)
    ? customData as Record<string, unknown>
    : firstPayload;
}

export function eventValueLabel(group: GroupedEvent): string {
  const customData = eventCustomData(group);
  const value = customData.value;
  if (value === undefined || value === null || value === '') return '—';
  const amount = Number(value);
  const rendered = Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value);
  return `${String(customData.currency || 'BDT')} ${rendered}`;
}

export function deliverySummary(event: CAPIEvent): string {
  if (event.status === 'Success') return `Sent · ${event.httpCode || 200} OK`;
  if (event.status === 'Retry') return 'Queued · retry scheduled';
  if (event.status === 'Failed') {
    const response = event.responseBody;
    if (response && typeof response === 'object' && !Array.isArray(response)) {
      const record = response as Record<string, unknown>;
      const reason = record.message || record.error || record.error_message;
      if (reason) return `Rejected · ${String(reason)}`;
    }
    return `Rejected · ${event.httpCode || 'platform error'}`;
  }
  return `${event.status} · ${event.httpCode || 'processing'}`;
}
