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

const logoAssets: Partial<Record<LogoKind, string>> = {
  meta: '/platforms/meta.svg',
  facebook: '/platforms/facebook.svg',
  tiktok: '/platforms/tiktok.png',
  ga4: '/platforms/ga4.svg',
  'google-ads': '/platforms/google-ads.svg',
  x: '/platforms/x.svg',
};

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
  const assetSrc = logoAssets[kind];

  if (assetSrc) {
    return (
      <img
        src={assetSrc}
        className={`${className} object-contain`}
        alt={name}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <svg className={className} role="img" aria-label={name} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" fill="#eaf1ff" stroke="#285ac7" />
      <path d="M7.5 12h9M12 7.5v9" stroke="#285ac7" strokeWidth="2" strokeLinecap="round" />
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
