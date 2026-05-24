import React from 'react';
import { Copy, Check } from 'lucide-react';
import { Platform, PlatformConfig, EventRule, ClientConnection } from '../types';

interface SettingsViewProps {
  credentials: Record<Platform, PlatformConfig>;
  connection: ClientConnection;
  rules: EventRule[];
  handleUpdatePlatform: (platform: Platform, fields: Partial<PlatformConfig>) => Promise<void>;
  handleToggleRule: (index: number, channel: 'metaEnabled' | 'tiktokEnabled' | 'ga4Enabled') => Promise<void>;
  refreshWPHeartbeat: () => Promise<void>;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  showToast: (msg: string, isErr?: boolean) => void;
}

export function SettingsView({
  credentials,
  connection,
  rules,
  handleUpdatePlatform,
  handleToggleRule,
  refreshWPHeartbeat,
  copiedStates,
  handleCopy,
  showToast
}: SettingsViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Fixed controls sidebar settings tabs */}
      <div className="space-y-6 lg:col-span-2">
        
        {/* Pipeline credentials card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Platform Credential Keys</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Manage API keys, tracking pixel ids and webhook tokens per target platform router</p>
          </div>

          {Object.keys(credentials).map(platKey => {
            const plat = platKey as Platform;
            const config = credentials[plat];
            return (
              <div key={plat} className="p-4 rounded-lg border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-800 dark:text-white uppercase tracking-wider">{plat} Route</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      config.status === 'Valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/60' : 
                      config.status === 'Invalid' ? 'bg-rose-50 text-rose-700 border border-rose-150 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/60' : 
                      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
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
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                    <span className="ml-2 text-[10px] font-semibold text-slate-500 uppercase dark:text-slate-400">
                      {config.enabled ? 'On' : 'Off'}
                    </span>
                  </label>
                </div>

                <div className={`grid grid-cols-1 ${plat === 'GA4' ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-450 uppercase mb-1">Pixel ID / Measurement ID</label>
                    <input 
                      type="text"
                      value={config.pixelIdOrMeasurementId}
                      placeholder="e.g. 782049182390"
                      onChange={(e) => handleUpdatePlatform(plat, { pixelIdOrMeasurementId: e.target.value })}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-455 uppercase mb-1">CAPI Access secret Token</label>
                    <input 
                      type="password"
                      value={config.accessToken}
                      placeholder="************************"
                      onChange={(e) => handleUpdatePlatform(plat, { accessToken: e.target.value })}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                    />
                  </div>

                  {plat !== 'GA4' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-455 uppercase mb-1">Test Event Code (Optional)</label>
                      <input 
                        type="text"
                        value={config.testEventCode || ''}
                        placeholder="e.g. TEST12345"
                        onChange={(e) => handleUpdatePlatform(plat, { testEventCode: e.target.value })}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* WordPress Custom tracking rules */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">WordPress event routing rules</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Select which native WooCommerce triggers relay to each marketing platform database</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-600 text-left min-w-[650px] dark:text-slate-300">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-555 border-b border-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">WooCommerce Trigger Name</th>
                  <th className="px-4 py-3 text-center">Meta CAPI</th>
                  <th className="px-4 py-3 text-center">TikTok tracking</th>
                  <th className="px-4 py-3 text-center">GA4 Measurement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3.5 font-semibold text-slate-850 dark:text-white font-mono text-xs">{rule.eventName}</td>
                    
                    <td className="px-4 py-3.5 text-center">
                      <input 
                        type="checkbox" 
                        checked={rule.metaEnabled}
                        onChange={() => handleToggleRule(idx, 'metaEnabled')}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                      />
                    </td>
                    
                    <td className="px-4 py-3.5 text-center">
                      <input 
                        type="checkbox" 
                        checked={rule.tiktokEnabled}
                        onChange={() => handleToggleRule(idx, 'tiktokEnabled')}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                      />
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      <input 
                        type="checkbox" 
                        checked={rule.ga4Enabled}
                        onChange={() => handleToggleRule(idx, 'ga4Enabled')}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Left side parameters / WordPress connection */}
      <div className="space-y-6">
        
        {/* WordPress token health status */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">WordPress plugin bridge</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Credentials bridge utilized by WooCommerce server webhook plugins</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-150 dark:bg-slate-950 dark:border-slate-850 space-y-3 font-mono text-xs text-slate-700 dark:text-slate-305">
            <div>
              <span className="block text-[9px] font-semibold text-slate-450 dark:text-slate-500 uppercase tracking-wider mb-0.5">REST API Access key token</span>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-800">
                <span className="truncate select-all">{connection.token}</span>
                <button 
                  onClick={() => handleCopy(connection.token, 'sett_wp_tok')}
                  className="text-slate-400 hover:text-slate-650 ml-auto shrink-0 cursor-pointer"
                  title="Copy Access token"
                >
                  {copiedStates['sett_wp_tok'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="block text-[9px] text-slate-400 dark:text-slate-500 uppercase mb-0.5">Plugin detected version</span>
                <span className="font-semibold text-slate-850 dark:text-white">v{connection.wpVersion}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 dark:text-slate-500 uppercase mb-0.5">Last query heartbeat</span>
                <span className="font-semibold text-slate-850 dark:text-white">{new Date(connection.lastHeartbeat).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              showToast("Pinging WordPress plugin...", false);
              refreshWPHeartbeat()
                .then(() => showToast("WordPress synchronization active.", false))
                .catch(() => showToast("Failed payload ping parameters.", true));
            }}
            className="w-full py-2 bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors border border-indigo-700/20 cursor-pointer dark:bg-indigo-600 dark:hover:bg-indigo-750"
          >
            Test Connection Heartbeat
          </button>
        </div>

        {/* Threshold trigger alerts setting */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Threshold warnings</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-normal">Transmit alert metrics emails when account telemetry consumption levels peak</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Threshold Limits Alert</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-indigo-600 cursor-pointer" />
                  <span>Notify at 80% quota consumed</span>
                </label>
                <label className="flex items-center gap-2 text-xs dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-indigo-600 cursor-pointer" />
                  <span>Notify at 95% quota consumed</span>
                </label>
                <label className="flex items-center gap-2 text-xs dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-indigo-600 cursor-pointer" />
                  <span>Notify immediately on REST stream errors</span>
                </label>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
