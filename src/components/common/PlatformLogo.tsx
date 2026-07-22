import React from 'react';

type PlatformLogoProps = {
  platform: string;
  className?: string;
  title?: string;
};

type PlatformBadgeProps = PlatformLogoProps & {
  label?: string;
  active?: boolean;
};

type LogoKind = 'meta' | 'facebook' | 'tiktok' | 'ga4' | 'google-ads' | 'x' | 'generic';

function platformKind(platform: string): LogoKind {
  const value = String(platform || '').trim().toLowerCase();
  if (value.includes('facebook')) return 'facebook';
  if (value.includes('meta')) return 'meta';
  if (value.includes('tiktok')) return 'tiktok';
  if (value === 'ga4' || value.includes('analytics')) return 'ga4';
  if (value.includes('google') || value.includes('cpc')) return 'google-ads';
  if (value === 'x' || value.includes('twitter')) return 'x';
  return 'generic';
}

export function platformDisplayName(platform: string) {
  const kind = platformKind(platform);
  if (kind === 'meta') return 'Meta';
  if (kind === 'facebook') return 'Facebook';
  if (kind === 'tiktok') return 'TikTok';
  if (kind === 'ga4') return 'GA4';
  if (kind === 'google-ads') return 'Google Ads';
  if (kind === 'x') return 'X';
  return platform;
}

export function PlatformLogo({ platform, className = 'h-5 w-5', title }: PlatformLogoProps) {
  const kind = platformKind(platform);
  const name = title || `${platformDisplayName(platform)} logo`;
  const common = { className, role: 'img' as const, 'aria-label': name, viewBox: '0 0 24 24' };

  if (kind === 'meta') {
    return (
      <svg {...common} fill="none">
        <path d="M2.7 15.2c0-5.1 2.5-9.2 5.5-9.2 2.1 0 3.8 2.1 5.1 4.2l1.4 2.4c1 1.7 1.8 2.8 2.8 2.8 1.3 0 2.1-1.8 2.1-4.6 0-3.1-1.4-4.8-3.6-4.8-1.5 0-2.8.8-4 2.1" stroke="#0866ff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21.3 15.2c0-5.1-2.5-9.2-5.5-9.2-2.1 0-3.8 2.1-5.1 4.2l-1.4 2.4c-1 1.7-1.8 2.8-2.8 2.8-1.3 0-2.1-1.8-2.1-4.6 0-3.1 1.4-4.8 3.6-4.8 1.5 0 2.8.8 4 2.1" stroke="#0866ff" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  if (kind === 'facebook') {
    return (
      <svg {...common} fill="none">
        <circle cx="12" cy="12" r="10.5" fill="#0866ff"/>
        <path d="M13.7 21v-7h2.35l.35-2.74h-2.7V9.5c0-.79.22-1.33 1.36-1.33h1.45V5.72a19.5 19.5 0 0 0-2.11-.11c-2.09 0-3.52 1.27-3.52 3.62v2.03H8.52V14h2.36v7h2.82Z" fill="#fff"/>
      </svg>
    );
  }

  if (kind === 'tiktok') {
    return (
      <svg {...common} fill="none">
        <path d="M14.4 4.2c.55 2.18 1.84 3.47 4.05 3.95v3.02a8.2 8.2 0 0 1-3.98-1.18v5.45a5.45 5.45 0 1 1-4.7-5.4v3.12a2.43 2.43 0 1 0 1.7 2.32V4.2h2.93Z" stroke="#25f4ee" strokeWidth="1.7" strokeLinejoin="round" transform="translate(-.65 .5)"/>
        <path d="M14.4 4.2c.55 2.18 1.84 3.47 4.05 3.95v3.02a8.2 8.2 0 0 1-3.98-1.18v5.45a5.45 5.45 0 1 1-4.7-5.4v3.12a2.43 2.43 0 1 0 1.7 2.32V4.2h2.93Z" stroke="#fe2c55" strokeWidth="1.7" strokeLinejoin="round" transform="translate(.65 -.3)"/>
        <path d="M14.4 4.2c.55 2.18 1.84 3.47 4.05 3.95v3.02a8.2 8.2 0 0 1-3.98-1.18v5.45a5.45 5.45 0 1 1-4.7-5.4v3.12a2.43 2.43 0 1 0 1.7 2.32V4.2h2.93Z" stroke="#111827" strokeWidth="1.7" strokeLinejoin="round"/>
      </svg>
    );
  }

  if (kind === 'ga4') {
    return (
      <svg {...common} fill="none">
        <rect x="3" y="12.5" width="4.5" height="8" rx="2.25" fill="#f9ab00"/>
        <rect x="9.75" y="7" width="4.5" height="13.5" rx="2.25" fill="#f9ab00"/>
        <rect x="16.5" y="2.5" width="4.5" height="18" rx="2.25" fill="#e37400"/>
      </svg>
    );
  }

  if (kind === 'google-ads') {
    return (
      <svg {...common} fill="none">
        <path d="M9.2 4.1 2.8 15.2a3.55 3.55 0 0 0 1.3 4.85 3.55 3.55 0 0 0 4.85-1.3l6.4-11.1A3.55 3.55 0 0 0 14.05 2.8 3.55 3.55 0 0 0 9.2 4.1Z" fill="#34a853"/>
        <path d="M14.75 4.1 21.2 15.2a3.55 3.55 0 0 1-1.3 4.85 3.55 3.55 0 0 1-4.85-1.3L8.65 7.65A3.55 3.55 0 0 1 9.95 2.8a3.55 3.55 0 0 1 4.8 1.3Z" fill="#4285f4"/>
        <circle cx="5.9" cy="17.9" r="3.55" fill="#fbbc04"/>
      </svg>
    );
  }

  if (kind === 'x') {
    return (
      <svg {...common} fill="none">
        <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="#0f172a"/>
        <path d="m7 6.5 7.65 11H17L9.35 6.5H7Zm1.2 0L17 17.5M7 17.5 11.2 13" stroke="#fff" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  return (
    <svg {...common} fill="none">
      <circle cx="12" cy="12" r="9.5" fill="#eaf1ff" stroke="#285ac7"/>
      <path d="M7.5 12h9M12 7.5v9" stroke="#285ac7" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export function PlatformBadge({ platform, label, active = false, className = '' }: PlatformBadgeProps) {
  return (
    <span className={`platform-badge ${active ? 'is-active' : ''} ${className}`.trim()}>
      <PlatformLogo platform={platform} className="h-4 w-4 shrink-0" />
      <span>{label || platformDisplayName(platform)}</span>
    </span>
  );
}
