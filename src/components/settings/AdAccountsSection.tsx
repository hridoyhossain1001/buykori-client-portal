import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { AdAccount } from '../../types';

export interface DiscoveredMetaAccount {
  external_account_id: string;
  account_name: string;
  account_status?: number | null;
  account_currency?: string;
  account_timezone?: string;
}

interface AdAccountsSectionProps {
  adPlatform: 'meta' | 'tiktok';
  setAdPlatform: (platform: 'meta' | 'tiktok') => void;
  adAccountId: string;
  setAdAccountId: (value: string) => void;
  adAccountName: string;
  setAdAccountName: (value: string) => void;
  adAccessToken: string;
  setAdAccessToken: (value: string) => void;
  adCurrency: string;
  setAdCurrency: (value: string) => void;
  adTimezone: string;
  setAdTimezone: (value: string) => void;
  savingAdAccount: boolean;
  handleConnectAdAccount: (event: React.FormEvent) => void;
  discoveringMetaAccounts: boolean;
  discoveredMetaAccounts: DiscoveredMetaAccount[];
  handleDiscoverMetaAccounts: () => void;
  handleSelectDiscoveredMetaAccount: (externalAccountId: string) => void;
  loadingAdAccounts: boolean;
  adAccounts: AdAccount[];
  syncingAdAccountId: number | null;
  deletingAdAccountId: number | null;
  handleSyncAdAccount: (id: number) => void;
  handleDisconnectAdAccount: (id: number) => void;
}

const AdAccountsSection: React.FC<AdAccountsSectionProps> = ({
  adPlatform,
  setAdPlatform,
  adAccountId,
  setAdAccountId,
  adAccountName,
  setAdAccountName,
  adAccessToken,
  setAdAccessToken,
  adCurrency,
  setAdCurrency,
  adTimezone,
  setAdTimezone,
  savingAdAccount,
  handleConnectAdAccount,
  discoveringMetaAccounts,
  discoveredMetaAccounts,
  handleDiscoverMetaAccounts,
  handleSelectDiscoveredMetaAccount,
  loadingAdAccounts,
  adAccounts,
  syncingAdAccountId,
  deletingAdAccountId,
  handleSyncAdAccount,
  handleDisconnectAdAccount,
}) => {
  return (
        <section id="settings-ad-accounts" aria-labelledby="settings-ad-accounts-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 id="settings-ad-accounts-title" className="text-sm font-bold text-slate-900">Marketing insights</h2>
              <p className="mt-1 text-xs text-slate-500">Read-only access to campaign spend, clicks, impressions and ROAS — synced on demand.</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50/70">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 px-4 py-3">
              <div>
                <p className="text-xs font-bold text-slate-900">Connect your {adPlatform === 'meta' ? 'Meta' : 'TikTok'} ad account in 4 easy steps</p>
                <p className="mt-0.5 text-xs text-slate-600">Complete these steps once. Buykori will use the connection only to read advertising performance.</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700 shadow-sm">
                {adPlatform === 'meta' ? 'Meta setup' : 'TikTok setup'}
              </span>
            </div>

            {adPlatform === 'meta' ? (
              <div className="grid grid-cols-1 gap-px bg-indigo-100 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Open Meta', 'Go to Business Settings, then Users, then System users.'],
                  ['Give access', 'Select your system user and assign the ad account with View performance access.'],
                  ['Create token', 'Click Generate token and include the ads_read permission. Copy that token.'],
                  ['Connect here', 'Paste the token below, find the account, select it, then click Connect & Verify.']
                ].map(([title, description], index) => (
                  <div key={title} className="bg-white/80 px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{index + 1}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{title}</p>
                        <p className="mt-1 text-xs leading-4 text-slate-600">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-px bg-indigo-100 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Open TikTok', 'Go to TikTok Business Center, then Assets, then Advertiser accounts.'],
                  ['Choose account', 'Select the advertiser account whose campaign reports you want in Buykori.'],
                  ['Create token', 'Create a Marketing API reporting token with permission to read ad performance.'],
                  ['Connect here', 'Paste the Advertiser ID and token below, then click Connect & Verify.']
                ].map(([title, description], index) => (
                  <div key={title} className="bg-white/80 px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold text-white">{index + 1}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{title}</p>
                        <p className="mt-1 text-xs leading-4 text-slate-600">{description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs leading-4 text-amber-800">
              <strong>Important:</strong> {adPlatform === 'meta'
                ? 'Use a System User advertising token with ads_read. Do not use a Pixel or Conversions API event token.'
                : 'Use a TikTok Marketing API reporting token. Do not use a TikTok Events API token.'}
            </div>
          </div>

          {adPlatform === 'meta' && (
            <details className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="text-xs font-bold text-slate-800">Show picture guide</p>
                  <p className="mt-0.5 text-xs leading-4 text-slate-500">See exactly where to create the reporting token and give permission.</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 group-open:hidden">Open guide</span>
                <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 group-open:inline">Close guide</span>
              </summary>

              <div className="border-t border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                  <p className="font-bold">Before you start</p>
                  <p>You need a Meta Business portfolio, a Business app with Marketing API, a System User, and an Ad Account assigned to that user.</p>
                  <p>The final token must include <code className="rounded bg-white px-1 py-0.5 font-mono font-bold">ads_read</code>. Buykori only reads campaign reports; it cannot create, edit, publish, or charge for ads.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {[
                    {
                      image: '/guides/meta-reporting/system-user.png',
                      title: '1. Open or create a System User',
                      text: 'Open Meta Business Settings → Users → System users. Select an existing Admin system user, or click Add and create one. This user will securely hold the reporting permissions.',
                      alt: 'Meta Business Settings System users location',
                      position: 'object-left-top'
                    },
                    {
                      image: '/guides/meta-reporting/business-app.png',
                      title: '2. Check your Business app',
                      text: 'Open Meta for Developers and choose your Business app. Confirm Marketing API is added. The same app must also be assigned to the System User before token permissions can appear.',
                      alt: 'Meta developer Business app with Marketing API enabled',
                      position: 'object-left-top'
                    },
                    {
                      image: '/guides/meta-reporting/assigned-assets.png',
                      title: '3. Assign the app and Ad Account',
                      text: 'Return to the System User and click Add assets. Assign the Business app, then assign the Ad Account with View performance access. You do not need Full control or permission to publish ads.',
                      alt: 'Meta System User assigned business assets',
                      position: 'object-left-top'
                    },
                    {
                      image: '/guides/meta-reporting/generate-token.png',
                      title: '4. Start token generation',
                      text: 'With the same System User selected, click Generate token. Choose the Business app you assigned, select an expiration that fits your policy, and continue to permissions.',
                      alt: 'Generate token button for a Meta System User',
                      position: 'object-right-top'
                    },
                    {
                      image: '/guides/meta-reporting/permission-warning.png',
                      title: '5. Select ads_read',
                      text: 'Tick ads_read and generate the token. If "No permissions available" appears, stop: the selected app is not assigned to this System User, or Marketing API is missing. Fix that first and generate again.',
                      alt: 'Meta token screen showing a missing app permission warning',
                      position: 'object-left-top'
                    },
                    {
                      image: '/guides/meta-reporting/buykori-connect.png',
                      title: '6. Connect it in Buykori',
                      text: 'Copy the generated token once. Paste it below, click Find my Meta accounts, select the correct account, check the display name, currency and timezone, then click Connect & Verify.',
                      alt: 'Buykori Meta Ad Account connection form',
                      position: 'object-center'
                    }
                  ].map((step) => (
                    <article key={step.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="h-44 overflow-hidden border-b border-slate-100 bg-slate-100">
                        <img src={step.image} alt={step.alt} loading="lazy" className={`h-full w-full object-cover ${step.position}`} />
                      </div>
                      <div className="p-3">
                        <h3 className="text-xs font-bold text-slate-800">{step.title}</h3>
                        <p className="mt-1 text-xs leading-4 text-slate-600">{step.text}</p>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs leading-4 text-slate-700 sm:grid-cols-2">
                  <div>
                    <p className="font-bold text-slate-800">What Buykori needs</p>
                    <p>One System User token with <strong>ads_read</strong>, plus access to the Ad Account you select. The account ID is filled automatically after discovery.</p>
                  </div>
                  <div>
                    <p className="font-bold text-rose-700">Do not use these</p>
                    <p>Do not paste a Pixel ID, Conversions API token, Page token, personal password, or payment information here.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="font-bold text-amber-700">If verification fails</p>
                    <p>Check that the token has not expired, ads_read is present, the Ad Account is assigned to the same System User, and the selected account belongs to the Business portfolio connected to your app.</p>
                  </div>
                </div>
              </div>
            </details>
          )}

          <form onSubmit={handleConnectAdAccount} autoComplete="off" className="space-y-4 p-4 rounded-lg border border-slate-200 bg-slate-50/50">
            <h4 className="font-bold text-xs text-indigo-600 uppercase tracking-wider pb-2 border-b border-slate-100">
              Connect Ad Account
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Platform</label>
                <select
                  value={adPlatform}
                  onChange={(e) => setAdPlatform(e.target.value as 'meta' | 'tiktok')}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="meta">Meta (Facebook Ads)</option>
                  <option value="tiktok">TikTok Business Ads</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  {adPlatform === 'meta' ? 'Meta Ad Account ID' : 'TikTok Advertiser ID'}
                  {adPlatform === 'meta' && <span className="ml-1 normal-case text-indigo-500">(auto-filled)</span>}
                </label>
                <input
                  type="text"
                  name="buykori-ad-account-id"
                  autoComplete="off"
                  required
                  placeholder={adPlatform === 'meta' ? 'act_123456789' : '71234567890123'}
                  value={adAccountId}
                  onChange={(e) => setAdAccountId(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Account Display Name</label>
                <input
                  type="text"
                  name="buykori-ad-account-display-name"
                  autoComplete="off"
                  placeholder="e.g. Main Ad Account"
                  value={adAccountName}
                  onChange={(e) => setAdAccountName(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className={`grid grid-cols-1 gap-3 ${adPlatform === 'meta' ? 'md:grid-cols-[minmax(0,1fr)_auto]' : ''}`}>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                  {adPlatform === 'meta' ? 'Meta System User Access Token' : 'TikTok Marketing API Access Token'}
                </label>
                <input
                  type="password"
                  name="buykori-ad-api-access-token"
                  autoComplete="new-password"
                  required
                  placeholder="Paste ad API access token"
                  value={adAccessToken}
                  onChange={(e) => setAdAccessToken(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {adPlatform === 'meta' && (
                <button
                  type="button"
                  onClick={handleDiscoverMetaAccounts}
                  disabled={discoveringMetaAccounts || !adAccessToken.trim()}
                  className="self-end rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 md:whitespace-nowrap"
                >
                  {discoveringMetaAccounts ? 'Finding accounts...' : 'Find my Meta accounts'}
                </button>
              )}
            </div>

            {adPlatform === 'meta' && discoveredMetaAccounts.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Choose Meta Ad Account</label>
                <select
                  value={adAccountId}
                  onChange={(e) => handleSelectDiscoveredMetaAccount(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">Select an account from your token</option>
                  {discoveredMetaAccounts.map((account) => (
                    <option key={account.external_account_id} value={account.external_account_id}>
                      {account.account_name} ({account.external_account_id})
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-emerald-700">Selecting an account fills its ID, name, currency, and timezone automatically.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Account Currency</label>
                <select
                  value={adCurrency}
                  onChange={(e) => setAdCurrency(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="USD">USD ($)</option>
                  <option value="BDT">BDT (৳)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (د.إ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Account Timezone</label>
                <select
                  value={adTimezone}
                  onChange={(e) => setAdTimezone(e.target.value)}
                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={savingAdAccount}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded shadow-md transition-colors cursor-pointer text-center"
                >
                  {savingAdAccount ? 'Verifying...' : 'Connect & Verify'}
                </button>
              </div>
            </div>
          </form>

          {/* Connected Accounts List */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
              Connected Ad Accounts
            </h4>
            
            {loadingAdAccounts ? (
              <div className="flex items-center justify-center py-4 text-slate-400 gap-2">
                <span className="animate-spin h-3.5 w-3.5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                <span className="text-xs">Loading ad connections...</span>
              </div>
            ) : adAccounts.length === 0 ? (
              <p className="text-xs text-slate-400 bg-slate-50/50 border border-slate-200 rounded-lg p-4 text-center">
                No active ad account integrations connected. Fill the form above to add one.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-slate-600 text-left min-w-[600px]">
                  <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2.5">Platform</th>
                      <th className="px-4 py-2.5">Account Details</th>
                      <th className="px-4 py-2.5">Settings</th>
                      <th className="px-4 py-2.5">Last Synced</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adAccounts.map((account) => (
                      <tr key={account.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 align-middle">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                            account.platform === 'meta' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-900 text-white border border-slate-900'
                          }`}>
                            {account.platform}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{account.account_name || 'Unnamed Account'}</span>
                            <span className="font-mono text-xs text-slate-400">{account.external_account_id}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="text-xs font-medium text-slate-500">
                            {account.account_currency} · {account.account_timezone}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="text-xs text-slate-500">
                            {account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'Never'}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
                          <button
                            type="button"
                            disabled={syncingAdAccountId === account.id}
                            onClick={() => handleSyncAdAccount(account.id)}
                            className="mr-1 inline-flex items-center justify-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
                            title="Sync campaign insights now"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${syncingAdAccountId === account.id ? 'animate-spin' : ''}`} />
                            {syncingAdAccountId === account.id ? 'Syncing' : 'Sync now'}
                          </button>
                          <button
                            type="button"
                            disabled={deletingAdAccountId === account.id}
                            onClick={() => handleDisconnectAdAccount(account.id)}
                            className="inline-flex items-center justify-center rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            title="Disconnect Account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
  );
};

export default AdAccountsSection;
