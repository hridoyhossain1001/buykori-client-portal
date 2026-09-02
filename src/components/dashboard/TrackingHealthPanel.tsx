import { AlertTriangle, CheckCircle2, ChevronRight, Clock, XCircle } from 'lucide-react';
import { Button, Card, SectionTitle, Status } from '../common';
import { PlatformLogo } from '../common/PlatformLogo';
import {
  PLATFORM_HEALTH_ICON,
  PLATFORM_HEALTH_TEXT,
  platformHealth,
  type PlatformHealthTone,
} from './dashboardUtils';
import type { PlatformRow } from './useDashboardMetrics';

// A check mark next to "Failing" reads as success no matter what colour it is.
const HEALTH_ICON: Record<PlatformHealthTone, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  degraded: AlertTriangle,
  failing: XCircle,
  idle: Clock,
};

/**
 * The endpoint each destination is actually delivered to, shown under the
 * platform name the way the prototype's `.platform-rows` does.
 *
 * These are not decoration: they are the hosts the backend posts to —
 * `app/services/capi_service.py` (graph.facebook.com),
 * `app/services/tiktok_service.py` (business-api.tiktok.com) and
 * `app/services/ga4_service.py` (www.google-analytics.com). A platform with no
 * entry simply renders without the line rather than with a guess.
 */
const PLATFORM_HOST: Record<string, string> = {
  'Meta CAPI': 'graph.facebook.com',
  'TikTok Events API': 'business-api.tiktok.com',
  GA4: 'www.google-analytics.com',
};

/** The prototype's 7-column platform row, at its own measurements. */
const ROW = 'grid w-full min-h-[61px] grid-cols-[35px_minmax(0,1fr)_80px_100px_90px_16px] items-center gap-2.5 px-2.5 py-[7px] text-left transition-colors hover:bg-row-hover lg:grid-cols-[35px_minmax(0,1fr)_80px_100px_100px_90px_16px]';

interface TrackingHealthPanelProps {
  platformRows: PlatformRow[];
  setActivePage: (page: string) => void;
}

export function TrackingHealthPanel({ platformRows, setActivePage }: TrackingHealthPanelProps) {
  return (
    <Card padding="none" flush className="min-w-0">
      <div className="p-5">
        <SectionTitle
          title="Tracking health"
          detail="Platform delivery at a glance"
          action={(
            <Button variant="ghost" size="sm" onClick={() => setActivePage('settings')}>
              Manage connections <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        />
      </div>
      <div className="px-[15px] pb-[15px]">
        {platformRows.map((row, index) => {
          const health = platformHealth(row.total, row.rate);
          const HealthIcon = HEALTH_ICON[health.tone];
          const host = PLATFORM_HOST[row.platform];
          return (
            <button
              key={row.label}
              onClick={() => setActivePage('event-logs')}
              className={`${ROW} ${index < platformRows.length - 1 ? 'border-b border-[var(--bk-console-border)]' : ''}`}
            >
              {/* The prototype uses a lettered .platform-mark; the live portal
                  already has real platform logos, which say the same thing
                  faster. The 30px tinted square around it is the prototype's. */}
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-[var(--bk-console-blue-soft)]">
                <PlatformLogo platform={row.platform} className="h-4 w-4" />
              </span>
              <strong className="min-w-0 text-caption font-semibold text-[var(--bk-console-text)]">
                <span className="block truncate" title={row.label}>{row.label}</span>
                {host && (
                  // `truncate` declares the intent to clip, so the full string has
                  // to stay recoverable: at 768px the content column narrows and
                  // all three hosts clip mid-word with nothing to hover.
                  <code
                    className="block truncate font-mono text-[11px] font-normal text-[var(--bk-console-text-subtle)]"
                    title={host}
                  >
                    {host}
                  </code>
                )}
              </strong>
              <span>
                <strong className={`block text-caption ${PLATFORM_HEALTH_TEXT[health.tone]}`}>{health.display}</strong>
                <small className="text-[10px] text-[var(--bk-console-text-subtle)]">accepted</small>
              </span>
              <span className="text-[11px] text-[var(--bk-console-text-muted)]">
                {row.total.toLocaleString()} events today
              </span>
              <span className="hidden text-[11px] text-[var(--bk-console-text-muted)] lg:block">
                Last sync
                <br />
                <small className="font-mono text-[10px] text-[var(--bk-console-text-subtle)]">{row.lastTime || 'Waiting'}</small>
              </span>
              <Status value={health.label} />
              <HealthIcon className={`h-4 w-4 ${PLATFORM_HEALTH_ICON[health.tone]}`} />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
