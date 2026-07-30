import React from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { CustomEventAutomation, CustomEventTrigger } from '../../types';

interface AutomationRouteState {
  label: string;
  className: string;
}

interface CustomAutomationsSectionProps {
  automationDrafts: CustomEventAutomation[];
  savingAutomations: boolean;
  addAutomationDraft: () => void;
  saveAutomationDrafts: () => void;
  updateAutomationDraft: (index: number, patch: Partial<CustomEventAutomation>) => void;
  removeAutomationDraft: (index: number) => void;
  automationTriggerHelp: (automation: CustomEventAutomation) => string;
  automationRouteState: (automation: CustomEventAutomation) => AutomationRouteState;
}

const CustomAutomationsSection: React.FC<CustomAutomationsSectionProps> = ({
  automationDrafts,
  savingAutomations,
  addAutomationDraft,
  saveAutomationDrafts,
  updateAutomationDraft,
  removeAutomationDraft,
  automationTriggerHelp,
  automationRouteState,
}) => {
  return (
        <section id="settings-custom-automations" aria-labelledby="settings-custom-automations-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 id="settings-custom-automations-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide">Create custom events</h2>
              <p className="text-xs text-slate-400">Create an event for a timer, button click, form, page URL, scroll, or visible section. No coding is needed.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addAutomationDraft}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Add custom event
              </button>
              <button
                type="button"
                onClick={saveAutomationDrafts}
                disabled={savingAutomations}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingAutomations ? 'Saving...' : 'Save custom events'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            Example: <b>Stay15Seconds</b> + Timer 15 sec, or <b>WhatsAppClick</b> + Click selector <code className="font-mono">.whatsapp-btn</code>. Saving also adds the event route if it is missing.
          </div>

          {automationDrafts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              No custom events yet. Add one when you want to track a timer, click, form, page, scroll, or visible section.
            </div>
          ) : (
            <div className="space-y-3">
              {automationDrafts.map((automation, index) => (
                <div key={automation.id || index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-500">{automationTriggerHelp(automation)}</p>
                    <span className={`inline-flex w-fit items-center rounded-full border px-2 py-1 text-xs font-bold uppercase tracking-wide ${automationRouteState(automation).className}`}>
                      {automationRouteState(automation).label}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_150px_1fr_auto]">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Event name
                      <input
                        type="text"
                        value={automation.name}
                        onChange={(e) => updateAutomationDraft(index, { name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
                        placeholder="Stay15Seconds"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Trigger
                      <select
                        value={automation.trigger}
                        onChange={(e) => updateAutomationDraft(index, { trigger: e.target.value as CustomEventTrigger })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="timer">Timer</option>
                        <option value="click">Click</option>
                        <option value="url">URL match</option>
                        <option value="form">Form submit</option>
                        <option value="scroll">Scroll depth</option>
                        <option value="visible">Element visible</option>
                      </select>
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {automation.trigger === 'timer' ? 'Seconds' : automation.trigger === 'scroll' ? 'Scroll percent' : automation.trigger === 'url' ? 'URL contains' : 'CSS selector'}
                      <input
                        type={automation.trigger === 'timer' || automation.trigger === 'scroll' ? 'number' : 'text'}
                        min={1}
                        max={automation.trigger === 'scroll' ? 100 : 3600}
                        value={automation.trigger === 'url' ? automation.url_pattern : automation.trigger === 'timer' ? (automation.seconds || automation.selector || 15) : automation.trigger === 'scroll' ? (automation.scroll_depth || automation.selector || 50) : automation.selector}
                        onChange={(e) => {
                          if (automation.trigger === 'url') {
                            updateAutomationDraft(index, { url_pattern: e.target.value });
                          } else if (automation.trigger === 'timer') {
                            const seconds = Number.parseInt(e.target.value, 10) || 15;
                            updateAutomationDraft(index, { seconds, selector: String(seconds) });
                          } else if (automation.trigger === 'scroll') {
                            const scrollDepth = Number.parseInt(e.target.value, 10) || 50;
                            updateAutomationDraft(index, { scroll_depth: scrollDepth, selector: String(scrollDepth) });
                          } else {
                            updateAutomationDraft(index, { selector: e.target.value });
                          }
                        }}
                        placeholder={automation.trigger === 'url' ? '/thank-you' : automation.trigger === 'timer' ? '15' : automation.trigger === 'scroll' ? '50' : '.button-class'}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                    <div className="flex items-end justify-end gap-2">
                      <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={automation.enabled}
                          onChange={(e) => updateAutomationDraft(index, { enabled: e.target.checked })}
                          className="h-4 w-4 rounded accent-indigo-600"
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        onClick={() => removeAutomationDraft(index)}
                        className="rounded-lg border border-rose-100 bg-white p-2 text-rose-500 hover:bg-rose-50"
                        title="Remove custom event"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Value
                      <input
                        type="number"
                        value={automation.value || 0}
                        onChange={(e) => updateAutomationDraft(index, { value: Number.parseFloat(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Currency
                      <input
                        type="text"
                        value={automation.currency || 'BDT'}
                        onChange={(e) => updateAutomationDraft(index, { currency: e.target.value.toUpperCase() })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Custom parameter label
                      <input
                        type="text"
                        value={automation.custom_param || ''}
                        onChange={(e) => updateAutomationDraft(index, { custom_param: e.target.value })}
                        placeholder="e.g. landing_timer"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
  );
};

export default CustomAutomationsSection;
