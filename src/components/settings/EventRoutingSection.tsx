import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PlatformLogo } from '../common/PlatformLogo';
import { EventRule } from '../../types';

export interface EventPresetOption {
  id: string;
  name: string;
  description?: string;
  events: string[];
}

export interface PresetEventRoute {
  value: string;
  label: string;
}

interface EventRoutingSectionProps {
  rules: EventRule[];
  coreEventRoutes: Set<string>;
  enabledRouteCount: number;
  disabledRouteCount: number;
  availablePresetRoutes: PresetEventRoute[];
  selectedEventRoute: string;
  setSelectedEventRoute: (value: string) => void;
  customEventRoute: string;
  setCustomEventRoute: (value: string) => void;
  isCustomRoute: boolean;
  routeToAdd: string;
  submitEventRoute: () => void;
  eventPresets: EventPresetOption[];
  selectedPreset: string;
  setSelectedPreset: (value: string) => void;
  applyingPreset: boolean;
  applySelectedPreset: () => Promise<void> | void;
  handleToggleRule: (index: number, channel: 'metaEnabled' | 'tiktokEnabled' | 'ga4Enabled') => Promise<void>;
  handleRemoveRule: (index: number) => Promise<void>;
}

const EventRoutingSection: React.FC<EventRoutingSectionProps> = ({
  rules,
  coreEventRoutes,
  enabledRouteCount,
  disabledRouteCount,
  availablePresetRoutes,
  selectedEventRoute,
  setSelectedEventRoute,
  customEventRoute,
  setCustomEventRoute,
  isCustomRoute,
  routeToAdd,
  submitEventRoute,
  eventPresets,
  selectedPreset,
  setSelectedPreset,
  applyingPreset,
  applySelectedPreset,
  handleToggleRule,
  handleRemoveRule,
}) => {
  return (
        <section id="settings-routing" aria-labelledby="settings-routing-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 id="settings-routing-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Choose which events to send</h2>
              <p className="text-xs text-slate-400 ">Turn an event on, then choose Meta, TikTok, or GA4. Turn it off if you do not want the plugin to collect or send it.</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 xl:max-w-[360px]">
              <p className="font-bold uppercase tracking-wide text-xs text-emerald-700">WordPress is connected</p>
              <p className="mt-1 leading-relaxed">
                The plugin checks these choices every 5 minutes. Events that are off are stopped before they leave the website.
              </p>
              <p className="mt-1 font-semibold">{enabledRouteCount} events on, {disabledRouteCount} events off.</p>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3   xl:w-[520px]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  aria-label="Select event route to add"
                  value={selectedEventRoute}
                  onChange={(e) => setSelectedEventRoute(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20   "
                >
                  <option value="">Add event route...</option>
                  {availablePresetRoutes.map((preset) => (
                    <option key={preset.value} value={preset.value}>{preset.label}</option>
                  ))}
                  <option value="__custom__">Custom event name...</option>
                </select>
                <button
                  type="button"
                  onClick={submitEventRoute}
                  disabled={!routeToAdd.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </div>
              {isCustomRoute && (
                <input
                  type="text"
                  value={customEventRoute}
                  onChange={(e) => setCustomEventRoute(e.target.value)}
                  placeholder="Custom event, e.g. BookDemo or WholesaleLead"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20   "
                />
              )}
              <p className="text-xs leading-normal text-slate-400 ">
                Custom names can use letters, numbers, and underscores. WordPress must fire the same event name.
              </p>
            </div>
          </div>

          {eventPresets.length > 0 && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-indigo-800">Store-type quick start</p>
                  <p className="mt-1 text-xs text-indigo-700/80">
                    Choose a ready-made event list for your type of store. Your custom events will not be changed.
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                  <select
                    value={selectedPreset}
                    onChange={(event) => setSelectedPreset(event.target.value)}
                    className="min-w-[240px] rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Choose your store type...</option>
                    {eventPresets.map(preset => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void applySelectedPreset()}
                    disabled={!selectedPreset || applyingPreset}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {applyingPreset ? 'Applying...' : 'Use this event list'}
                  </button>
                </div>
              </div>
              {selectedPreset && (
                <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs text-slate-600">
                  {eventPresets.find(preset => preset.id === selectedPreset)?.description}
                  {' '}Routes: {eventPresets.find(preset => preset.id === selectedPreset)?.events.join(', ')}.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 md:hidden">
            {rules.map((rule, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4  ">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900 ">{rule.eventName}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {coreEventRoutes.has(rule.eventName) ? 'Core route' : 'Custom route'}
                    </p>
                  </div>
                  {!coreEventRoutes.has(rule.eventName) && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(idx)}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      title={`Remove ${rule.eventName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  <label className="rounded-lg border border-slate-100 bg-slate-50 p-2 ">
                    <span className="flex items-center justify-center gap-1"><PlatformLogo platform="Meta CAPI" className="h-4 w-4" />Meta</span>
                    <input type="checkbox" checked={rule.metaEnabled} onChange={() => handleToggleRule(idx, 'metaEnabled')} className="mt-2 h-4 w-4 rounded accent-[#285ac7]" />
                  </label>
                  <label className="rounded-lg border border-slate-100 bg-slate-50 p-2 ">
                    <span className="flex items-center justify-center gap-1"><PlatformLogo platform="TikTok Events API" className="h-4 w-4" />TikTok</span>
                    <input type="checkbox" checked={rule.tiktokEnabled} onChange={() => handleToggleRule(idx, 'tiktokEnabled')} className="mt-2 h-4 w-4 rounded accent-[#285ac7]" />
                  </label>
                  <label className="rounded-lg border border-slate-100 bg-slate-50 p-2 ">
                    <span className="flex items-center justify-center gap-1"><PlatformLogo platform="GA4" className="h-4 w-4" />GA4</span>
                    <input type="checkbox" checked={rule.ga4Enabled} onChange={() => handleToggleRule(idx, 'ga4Enabled')} className="mt-2 h-4 w-4 rounded accent-[#285ac7]" />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs text-slate-600 text-left min-w-[760px] ">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100   ">
                <tr>
                  <th className="px-4 py-3">Active event route</th>
                  <th className="px-4 py-3 text-center">Meta CAPI</th>
                  <th className="px-4 py-3 text-center">TikTok tracking</th>
                  <th className="px-4 py-3 text-center">GA4 Measurement</th>
                  <th className="px-4 py-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 ">
                {rules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 ">
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-semibold text-slate-800 ">{rule.eventName}</span>
                        {!coreEventRoutes.has(rule.eventName) && (
                          <span className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-indigo-500 ">Custom / optional route</span>
                        )}
                      </div>
                    </td>
                    
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
                    <td className="px-4 py-3.5 text-right">
                      {!coreEventRoutes.has(rule.eventName) ? (
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(idx)}
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600  "
                          title={`Remove ${rule.eventName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-350 ">Core</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
  );
};

export default EventRoutingSection;
