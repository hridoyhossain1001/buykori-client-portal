import React from 'react';
import Tooltip from '../common/Tooltip';
import { PlatformBadge } from '../common/PlatformLogo';
import { Platform, PlatformConfig } from '../../types';

interface AdPlatformsSectionProps {
  credentials: Record<Platform, PlatformConfig>;
  configuredPlatformCount: number;
  platformCount: number;
  localPixelIds: Record<Platform, string>;
  setLocalPixelIds: React.Dispatch<React.SetStateAction<Record<Platform, string>>>;
  localTokens: Record<Platform, string>;
  setLocalTokens: React.Dispatch<React.SetStateAction<Record<Platform, string>>>;
  localTestCodes: Record<Platform, string>;
  setLocalTestCodes: React.Dispatch<React.SetStateAction<Record<Platform, string>>>;
  handleUpdatePlatform: (platform: Platform, updates: Partial<PlatformConfig>) => void;
  platformDestinationLabel: (platform: Platform) => string;
  platformTokenLabel: (platform: Platform) => string;
  platformCredentialHelp: (platform: Platform) => { destination: string; token: string };
  platformMissingCredentials: (platform: Platform, config: PlatformConfig) => string[];
}

const AdPlatformsSection: React.FC<AdPlatformsSectionProps> = ({
  credentials,
  configuredPlatformCount,
  platformCount,
  localPixelIds,
  setLocalPixelIds,
  localTokens,
  setLocalTokens,
  localTestCodes,
  setLocalTestCodes,
  handleUpdatePlatform,
  platformDestinationLabel,
  platformTokenLabel,
  platformCredentialHelp,
  platformMissingCredentials,
}) => {
  return (
        <section id="settings-platforms" aria-labelledby="settings-platforms-title" className="scroll-mt-28 space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 id="settings-platforms-title" className="text-sm font-bold text-slate-900">Ad platforms</h2>
              <p className="mt-1 text-xs text-slate-500">Add the ID and secret key for each platform. Leave a platform off until both fields are ready.</p>
            </div>
            <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              {configuredPlatformCount} of {platformCount} connected
            </span>
          </div>

          {Object.keys(credentials).map(platKey => {
            const plat = platKey as Platform;
            const config = credentials[plat];
            const credentialHelp = platformCredentialHelp(plat);
            const missingCredentials = platformMissingCredentials(plat, config);
            const enabledButMissingCredentials = Boolean(config.enabled && missingCredentials.length);
            return (
              <div key={plat} className="bk-brand-panel space-y-4 rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlatformBadge platform={plat} label={plat} active={config.enabled} />
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      config.status === 'Valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200   ' : 
                      config.status === 'Invalid' ? 'bg-rose-50 text-rose-700 border border-rose-200   ' : 
                      'bg-slate-100 text-slate-600  '
                    }`}>
                      {config.status}
                    </span>
                  </div>

                  {/* Enable platform toggle switch */}
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={config.enabled}
                      onChange={(e) => handleUpdatePlatform(plat, { enabled: e.target.checked })} 
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#285ac7]" />
                    <span className="ml-2 text-xs font-semibold text-slate-500 uppercase ">
                      {config.enabled ? 'On' : 'Off'}
                    </span>
                  </label>
                </div>

                {enabledButMissingCredentials && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    <p className="font-bold">{plat} is on, but setup details are missing.</p>
                    <p className="mt-0.5">
                      Add {missingCredentials.join(' and ')} before events can be sent.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">{platformDestinationLabel(plat)}</label>
                    <input 
                      type="text"
                      value={localPixelIds[plat]}
                      placeholder="e.g. 782049182390"
                      onChange={(e) => setLocalPixelIds(prev => ({ ...prev, [plat]: e.target.value }))}
                      onBlur={() => handleUpdatePlatform(plat, { pixelIdOrMeasurementId: localPixelIds[plat] })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                    />
                    <p className="mt-1 text-xs leading-4 text-slate-500">{credentialHelp.destination}</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">{platformTokenLabel(plat)}</label>
                    <input
                      type="password"
                      name={`platform-${plat.toLowerCase().replace(/\s+/g, '-')}-access-token`}
                      autoComplete="new-password"
                      value={localTokens[plat]}
                      placeholder="Paste access token"
                      onChange={(e) => setLocalTokens(prev => ({ ...prev, [plat]: e.target.value }))}
                      onBlur={() => handleUpdatePlatform(plat, { accessToken: localTokens[plat] })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                    />
                    <p className="mt-1 text-xs leading-4 text-slate-500">{credentialHelp.token}</p>
                  </div>

                  <div>
                    <label className="mb-1 flex items-center text-xs font-semibold uppercase text-slate-400">
                      Test Event Code (Optional)
                      <Tooltip content="Use this optional code only while validating tracking setup." />
                    </label>
                    <input
                      type="text"
                      value={localTestCodes[plat]}
                      placeholder="e.g. TEST12345"
                      onChange={(e) => setLocalTestCodes(prev => ({ ...prev, [plat]: e.target.value }))}
                      onBlur={() => handleUpdatePlatform(plat, { testEventCode: localTestCodes[plat] })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="w-full rounded border border-slate-200 bg-white p-2 font-mono text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="mt-1 text-xs leading-4 text-slate-500">Only for verifying events in test mode.</p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
  );
};

export default AdPlatformsSection;
