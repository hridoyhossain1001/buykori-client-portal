import { Globe2, Save } from 'lucide-react';

interface StoreDomainSectionProps {
  /** Saved domain from the server; used for the status pill and dirty check. */
  storeDomain: string;
  /** Draft value bound to the input. */
  localStoreDomain: string;
  setLocalStoreDomain: (value: string) => void;
  saveStoreDomain: () => void;
  savingStoreDomain: boolean;
}

/**
 * "Website domain" card for the Store Connection tab.
 *
 * Rendered unconditionally by SettingsView; visibility is controlled by the
 * injected `.settings-tab-view` stylesheet, so the `id` must stay
 * `settings-domain` for both tab switching and deep links to keep working.
 */
export function StoreDomainSection({
  storeDomain,
  localStoreDomain,
  setLocalStoreDomain,
  saveStoreDomain,
  savingStoreDomain,
}: StoreDomainSectionProps) {
  return (
    <section id="settings-domain" aria-labelledby="settings-domain-title" className="scroll-mt-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center  ">
            <Globe2 className="h-4 w-4" />
          </div>
          <div>
            <h2 id="settings-domain-title" className="text-sm font-bold text-slate-900">Website domain</h2>
            <p className="mt-1 text-xs text-slate-500">The store address your plugin reports events from.</p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
          storeDomain
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100   '
            : 'bg-amber-50 text-amber-700 border border-amber-100   '
        }`}>
          {storeDomain ? 'Ready' : 'Not added'}
        </span>
      </div>

      <div className="px-5 py-5">
        <div>
          <label htmlFor="store-domain" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Store domain</label>
          <input
            id="store-domain"
            type="text"
            value={localStoreDomain}
            placeholder="example.com"
            onChange={(e) => setLocalStoreDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveStoreDomain(); }}
            className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-2 text-xs text-slate-400">Use the bare domain, without https:// or a trailing slash.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500">Changing the domain pauses tracking until the plugin reconnects.</p>
        <button
          type="button"
          disabled={savingStoreDomain || localStoreDomain.trim() === (storeDomain || '').trim()}
          onClick={saveStoreDomain}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {savingStoreDomain ? 'Saving' : 'Save domain'}
        </button>
      </div>
    </section>
  );
}

export default StoreDomainSection;
