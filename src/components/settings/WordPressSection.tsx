import React from 'react';
import { Check, Copy } from 'lucide-react';
import { ClientConnection, PluginReleaseInfo } from '../../types';

interface WordPressSectionProps {
  connection: ClientConnection;
  pluginReleaseInfo?: PluginReleaseInfo | null;
  installedVersionReported: boolean;
  versionComparison: number | null;
  updateAvailable: boolean;
  pluginVersionStatus: string;
  pluginVersionHelp: string;
  apiAccessKey: string;
  maskedApiAccessKey: string;
  packageSizeKb: number;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  showToast: (msg: string, isErr?: boolean) => void;
  refreshWPHeartbeat: () => Promise<void>;
}

const WordPressSection: React.FC<WordPressSectionProps> = ({
  connection,
  pluginReleaseInfo,
  installedVersionReported,
  versionComparison,
  updateAvailable,
  pluginVersionStatus,
  pluginVersionHelp,
  apiAccessKey,
  maskedApiAccessKey,
  packageSizeKb,
  copiedStates,
  handleCopy,
  showToast,
  refreshWPHeartbeat,
}) => {
  return (
        <section id="settings-wordpress" aria-labelledby="settings-wordpress-title" className="scroll-mt-28 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
            <h2 id="settings-wordpress-title" className="text-sm font-bold text-slate-900">WordPress plugin connection</h2>
            <p className="mt-1 text-xs text-slate-500">Connects your WordPress store to Buykori — all tracking choices are managed from this portal.</p>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold ${connection.status === 'Active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              {connection.status === 'Active' ? 'Connected' : 'Reconnect'}
            </span>
          </div>

          {(connection.reconnectRequired || connection.status !== 'Active') && (
            <div className="mx-5 mt-5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <p className="font-bold">WordPress reconnection required</p>
              <p className="mt-1">
                {connection.connectionIssue || 'Open Buykori AdSync in WordPress and reconnect this site to restore event delivery.'}
              </p>
              {connection.siteHost && (
                <a
                  className="mt-2 inline-flex font-semibold text-rose-700 underline"
                  href={`https://${connection.siteHost}/wp-admin/admin.php?page=buykori-adsync`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open WordPress connection settings
                </a>
              )}
            </div>
          )}

          <div className="mx-5 mt-5 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-700">
            <div>
              <span className="block text-xs font-semibold text-slate-400  uppercase tracking-wider mb-0.5">Plugin connection key</span>
              <div className="flex items-center gap-2 bg-white  px-2 py-1.5 rounded border border-slate-200 ">
                <span className="truncate" aria-label="Masked API access key">{maskedApiAccessKey}</span>
                <button 
                  type="button"
                  onClick={() => handleCopy(apiAccessKey, 'sett_wp_tok')}
                  disabled={!apiAccessKey}
                  className="ml-auto inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Copy API access key"
                  title="Copy API access key"
                >
                  {copiedStates['sett_wp_tok'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="block text-xs text-slate-400  uppercase mb-0.5">Plugin detected version</span>
                <span className="font-semibold text-slate-800 ">{pluginVersionStatus}</span>
                {!installedVersionReported && connection.wpVersion ? (
                  <span className="mt-0.5 block text-xs text-slate-400">{pluginVersionHelp}</span>
                ) : null}
              </div>
              <div>
                <span className="block text-xs text-slate-400  uppercase mb-0.5">Last plugin check-in</span>
                <span className="font-semibold text-slate-800 ">{connection.lastHeartbeat ? new Date(connection.lastHeartbeat).toLocaleString() : 'Not reported yet'}</span>
              </div>
            </div>
          </div>

          <div className="mx-5 my-4 rounded-lg border border-slate-200 bg-white p-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 ">Latest plugin package</p>
                <p className="mt-1 font-semibold text-slate-800 ">
                  {pluginReleaseInfo ? `v${pluginReleaseInfo.version}` : 'Checking release...'}
                </p>
                {pluginReleaseInfo && (
                  <p className="mt-0.5 text-xs text-slate-500 ">
                    WordPress {pluginReleaseInfo.requires}+ / PHP {pluginReleaseInfo.requires_php}+ / {packageSizeKb} KB
                  </p>
                )}
              </div>
              <span className={
                !installedVersionReported
                  ? 'shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500   '
                  : updateAvailable
                  ? 'shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700   '
                  : pluginReleaseInfo?.package_available
                    ? 'shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700   '
                    : 'shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500   '
              }>
                {!installedVersionReported
                  ? 'Version unknown'
                  : updateAvailable
                    ? 'Update available'
                    : versionComparison !== null && versionComparison > 0
                      ? 'Newer version installed'
                      : pluginReleaseInfo?.package_available
                      ? 'Up to date'
                      : 'Unavailable'}
              </span>
            </div>
          </div>

          <button 
            onClick={() => {
              showToast("Verifying WordPress site binding...", false);
              refreshWPHeartbeat()
                .then(() => showToast("WordPress site binding is active.", false))
                .catch((error) => showToast(error?.message || "WordPress reconnection is required.", true));
            }}
            className="mb-4 ml-auto mr-5 block min-h-10 rounded-lg border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Test WordPress Connection
          </button>
        </section>
  );
};

export default WordPressSection;
