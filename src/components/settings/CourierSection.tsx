import React from 'react';
import { AlertTriangle, Check, CircleCheck, Copy, ShieldCheck } from 'lucide-react';
import { CourierSettings } from '../../types';

export interface EnabledCouriers {
  steadfast: boolean;
  pathao: boolean;
  redx: boolean;
}

const courierPartners: Array<{
  id: keyof EnabledCouriers;
  name: string;
  description: string;
  logo: string;
  logoAlt: string;
}> = [
  { id: 'steadfast', name: 'SteadFast', description: 'Express courier', logo: '/couriers/steadfast.svg', logoAlt: 'SteadFast Courier' },
  { id: 'pathao', name: 'Pathao Courier', description: 'Nationwide shipping', logo: '/couriers/pathao.svg', logoAlt: 'Pathao Courier' },
  { id: 'redx', name: 'RedX Logistics', description: 'Doorstep delivery', logo: '/couriers/redx.svg', logoAlt: 'RedX Logistics' },
];

const providerLabels: Record<keyof EnabledCouriers, string> = {
  steadfast: 'SteadFast Express',
  pathao: 'Pathao Courier',
  redx: 'RedX Logistics',
};

interface CourierSectionProps {
  enabledCouriers: EnabledCouriers;
  setEnabledCouriers: React.Dispatch<React.SetStateAction<EnabledCouriers>>;
  courierSettings: CourierSettings;
  setCourierSettings: React.Dispatch<React.SetStateAction<CourierSettings>>;
  loadingCourier: boolean;
  savingCourier: boolean;
  handleSaveCourierSettings: (event: React.FormEvent) => void;
  copyingCourierSecret: string | null;
  handleCopyCourierWebhookSetup: (provider: 'steadfast' | 'redx') => void;
  copyingPathaoSecret: boolean;
  handleCopyPathaoWebhookSecret: () => void;
  pathaoWebhookCallbackUrl: string;
  pathaoCallbackCopied: boolean;
  handleCopyPathaoCallbackUrl: () => void;
  steadfastWebhookCallbackUrl: string;
  steadfastCallbackCopied: boolean;
  handleCopySteadfastCallbackUrl: () => void;
  redxWebhookCallbackUrl: string;
}

const WebhookStatusBadge: React.FC<{ configured?: boolean; verifiedAt?: string }> = ({ configured, verifiedAt }) => {
  const status = verifiedAt ? 'verified' : configured ? 'waiting' : 'not-configured';
  const styles = {
    verified: 'bg-emerald-100 text-emerald-700',
    waiting: 'bg-amber-100 text-amber-700',
    'not-configured': 'bg-slate-200 text-slate-600',
  };
  const labels = {
    verified: 'Verified',
    waiting: 'Waiting for callback',
    'not-configured': 'Not configured',
  };

  return <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${styles[status]}`}>{labels[status]}</span>;
};

const CallbackUrlField: React.FC<{
  id: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  ariaLabel: string;
}> = ({ id, value, copied, onCopy, ariaLabel }) => (
  <div className="flex min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
    <input
      id={id}
      type="text"
      readOnly
      value={value}
      onFocus={(event) => event.currentTarget.select()}
      className="h-10 min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-slate-700 outline-none"
    />
    <button
      type="button"
      onClick={onCopy}
      aria-label={ariaLabel}
      title="Copy callback URL"
      className={`flex h-11 w-11 shrink-0 items-center justify-center border-l transition-colors ${copied ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  </div>
);

const CourierSection: React.FC<CourierSectionProps> = ({
  enabledCouriers,
  setEnabledCouriers,
  courierSettings,
  setCourierSettings,
  loadingCourier,
  savingCourier,
  handleSaveCourierSettings,
  copyingCourierSecret,
  handleCopyCourierWebhookSetup,
  copyingPathaoSecret,
  handleCopyPathaoWebhookSecret,
  pathaoWebhookCallbackUrl,
  pathaoCallbackCopied,
  handleCopyPathaoCallbackUrl,
  steadfastWebhookCallbackUrl,
  steadfastCallbackCopied,
  handleCopySteadfastCallbackUrl,
  redxWebhookCallbackUrl,
}) => {
  const configured = {
    steadfast: Boolean(courierSettings.steadfast_api_key && courierSettings.steadfast_secret_key),
    pathao: Boolean(
      courierSettings.pathao_client_id &&
      courierSettings.pathao_client_secret &&
      courierSettings.pathao_email &&
      courierSettings.pathao_password &&
      courierSettings.pathao_store_id,
    ),
    redx: Boolean(courierSettings.redx_access_token),
  };
  const enabledProviderIds = (Object.keys(enabledCouriers) as Array<keyof EnabledCouriers>)
    .filter((provider) => enabledCouriers[provider]);
  const connectedProviderIds = enabledProviderIds.filter((provider) => configured[provider]);
  const setupNeeded = enabledProviderIds.filter((provider) => !configured[provider]);

  return (
        <section id="settings-courier" aria-labelledby="settings-courier-title" className="scroll-mt-28 space-y-5">
          <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            <div>
              <h2 id="settings-courier-title" className="text-sm font-bold text-slate-900">Courier partners</h2>
              <p className="mt-1 text-xs text-slate-500">Toggle on the partners you ship with — active couriers show their credential form below.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                ● Live API Sync Active
              </span>
            </div>
          </div>

          {/* Integrated Courier Partners Selection Grid */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700">Available courier services</h3>
            <p className="mb-4 text-xs text-slate-500">Your existing courier logos and saved integrations stay unchanged.</p>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {courierPartners.map(partner => {
                const enabled = enabledCouriers[partner.id];
                return (
                  <div
                    key={partner.id}
                    className={`grid min-h-[72px] grid-cols-[48px_minmax(0,1fr)_44px] items-center gap-3 rounded-xl border p-3 transition-all ${enabled ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' : 'border-slate-200 bg-white'}`}
                  >
                      <span className="flex h-10 w-12 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5">
                      <img src={partner.logo} alt={partner.logoAlt} className="h-full w-full object-contain" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                    </span>
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-bold text-slate-900">{partner.name}</h4>
                      <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500">{partner.description}</span>
                      <span className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold ${configured[partner.id] ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {configured[partner.id] ? <CircleCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {configured[partner.id] ? 'Credentials saved' : 'Setup needed'}
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${enabled ? 'Disable' : 'Enable'} ${partner.name}`}
                      onClick={() => setEnabledCouriers(prev => ({ ...prev, [partner.id]: !prev[partner.id] }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${enabled ? 'bg-indigo-600' : 'bg-slate-300'}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Connection health</h3>
                  <p className="mt-1 text-xs text-slate-500">Credentials, webhook verification, and the latest delivery callback are tracked separately.</p>
                </div>
              </div>
              <span className={`w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${setupNeeded.length ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {setupNeeded.length ? `${setupNeeded.length} setup needed` : 'All enabled connected'}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {(['steadfast', 'pathao', 'redx'] as Array<keyof EnabledCouriers>).map((provider) => {
                const isEnabled = enabledCouriers[provider];
                const isConfigured = configured[provider];
                const verifiedAt = provider === 'pathao'
                  ? courierSettings.pathao_webhook_verified_at
                  : provider === 'steadfast'
                    ? courierSettings.steadfast_webhook_verified_at
                    : courierSettings.redx_webhook_verified_at;
                const webhookConfigured = provider === 'pathao'
                  ? courierSettings.pathao_webhook_secret_configured
                  : provider === 'steadfast'
                    ? courierSettings.steadfast_webhook_token_configured
                    : courierSettings.redx_webhook_secret_configured;
                return (
                  <div key={provider} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800">{providerLabels[provider]}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${!isEnabled ? 'bg-slate-200 text-slate-600' : isConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {!isEnabled ? 'Disabled' : isConfigured ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      {!isEnabled ? 'Enable this provider to configure it.' : !isConfigured ? 'Add the required credentials below.' : webhookConfigured ? (verifiedAt ? `Webhook verified ${new Date(verifiedAt).toLocaleString()}` : 'Webhook configured; waiting for callback') : 'Webhook not configured'}
                    </p>
                  </div>
                );
              })}
            </div>
            {connectedProviderIds.length === 0 && enabledProviderIds.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Connect at least one enabled courier before booking shipments. Save credentials first, then configure its webhook callback.</p>
              </div>
            )}
          </div>

          {loadingCourier ? (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
              <span>Loading courier settings...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveCourierSettings} autoComplete="off" className="space-y-6">
              
              {/* Dynamic Accordion Forms for Enabled Couriers */}
              <div className="space-y-5">
                {/* SteadFast API Card */}
                {enabledCouriers.steadfast && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-indigo-100 pb-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">S</span>
                        <h4 className="min-w-0 text-sm font-bold text-slate-900">SteadFast integration</h4>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Enabled</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">Copy the API Key and Secret Key from your SteadFast Merchant Panel &gt; API Settings.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">SteadFast API Key</label>
                        <input 
                          type="text"
                          name="buykori-steadfast-api-key"
                          autoComplete="off"
                          value={courierSettings.steadfast_api_key || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, steadfast_api_key: e.target.value }))}
                          placeholder="Enter SteadFast Api-Key"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">SteadFast Secret Key</label>
                        <input 
                          type="password"
                          name="buykori-steadfast-secret-key"
                          autoComplete="new-password"
                          value={courierSettings.steadfast_secret_key || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, steadfast_secret_key: e.target.value }))}
                          placeholder="Paste SteadFast Secret Key"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-800">SteadFast webhook setup</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">Set the callback URL and Authorization header in your SteadFast webhook configuration.</p>
                        </div>
                        <WebhookStatusBadge
                          configured={courierSettings.steadfast_webhook_token_configured}
                          verifiedAt={courierSettings.steadfast_webhook_verified_at}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="min-w-0">
                          <label htmlFor="steadfast-webhook-callback-url" className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">1</span>
                            Callback URL
                          </label>
                          <CallbackUrlField
                            id="steadfast-webhook-callback-url"
                            value={steadfastWebhookCallbackUrl}
                            copied={steadfastCallbackCopied}
                            onCopy={handleCopySteadfastCallbackUrl}
                            ariaLabel="Copy SteadFast callback URL"
                          />
                          <p className="mt-1.5 text-xs text-slate-500">Paste this URL into SteadFast's callback URL field.</p>
                        </div>
                        <div className="min-w-0">
                          <p className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">2</span>
                            Authorization token
                          </p>
                          <button type="button" onClick={() => handleCopyCourierWebhookSetup('steadfast')} disabled={copyingCourierSecret === 'steadfast'} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                            <Copy className="h-3.5 w-3.5" />
                            {copyingCourierSecret === 'steadfast'
                              ? 'Preparing token...'
                              : courierSettings.steadfast_webhook_token_configured
                                ? 'Copy token again'
                                : 'Generate & copy token'}
                          </button>
                          <p className="mt-1.5 text-xs text-slate-500">Use it as <span className="font-mono">Authorization: Bearer &lt;token&gt;</span>.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pathao API Card */}
                {enabledCouriers.pathao && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-indigo-100 pb-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-600 text-xs font-bold text-white">P</span>
                        <h4 className="min-w-0 text-sm font-bold text-slate-900">Pathao integration</h4>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Enabled</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">Enter your Client ID, Client Secret, Store ID, and registered account credentials from Pathao Merchant Panel.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Pathao Client ID</label>
                        <input
                          type="text"
                          name="buykori-pathao-client-id"
                          autoComplete="off"
                          value={courierSettings.pathao_client_id || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, pathao_client_id: e.target.value }))}
                          placeholder="Client ID"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Store Owner Email</label>
                        <input
                          type="email"
                          name="buykori-pathao-owner-email"
                          autoComplete="off"
                          value={courierSettings.pathao_email || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, pathao_email: e.target.value }))}
                          placeholder="owner@example.com"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Pathao Client Secret</label>
                        <input
                          type="password"
                          name="buykori-pathao-client-secret"
                          autoComplete="new-password"
                          value={courierSettings.pathao_client_secret || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, pathao_client_secret: e.target.value }))}
                          placeholder="Paste Pathao Client Secret"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Store Password</label>
                        <input
                          type="password"
                          name="buykori-pathao-store-password"
                          autoComplete="new-password"
                          value={courierSettings.pathao_password || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, pathao_password: e.target.value }))}
                          placeholder="Paste Pathao Store Password"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="pathao-environment" className="block text-xs font-semibold text-slate-600 uppercase mb-1">Pathao Environment</label>
                        <select
                          id="pathao-environment"
                          value={courierSettings.pathao_environment || 'live'}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, pathao_environment: e.target.value as 'live' | 'sandbox' }))}
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="live">Live Environment</option>
                          <option value="sandbox">Sandbox / Test</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Pathao Store ID</label>
                        <input
                          type="text"
                          value={courierSettings.pathao_store_id || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, pathao_store_id: e.target.value }))}
                          placeholder="Store ID"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-800">Pathao webhook setup</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">Pathao Merchant Panel &gt; Developer API &gt; Webhook Integration</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${
                          courierSettings.pathao_webhook_verified_at
                            ? 'bg-emerald-100 text-emerald-700'
                            : courierSettings.pathao_webhook_secret_configured
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-600'
                        }`}>
                          {courierSettings.pathao_webhook_verified_at
                            ? 'Verified'
                            : courierSettings.pathao_webhook_secret_configured
                              ? 'Waiting for callback'
                              : 'Not configured'}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="min-w-0">
                          <label htmlFor="pathao-webhook-callback-url" className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">1</span>
                            Callback URL
                          </label>
                          <div className="flex min-w-0 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                            <input
                              id="pathao-webhook-callback-url"
                              type="text"
                              readOnly
                              value={pathaoWebhookCallbackUrl}
                              onFocus={(event) => event.currentTarget.select()}
                              className="h-10 min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-slate-700 outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleCopyPathaoCallbackUrl}
                              aria-label="Copy Pathao callback URL"
                              title="Copy callback URL"
                              className={`flex h-11 w-11 shrink-0 items-center justify-center border-l transition-colors ${pathaoCallbackCopied ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
                            >
                              {pathaoCallbackCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-500">Paste this into Pathao's Callback URL field.</p>
                        </div>

                        <div className="min-w-0">
                          <p className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">2</span>
                            Webhook secret
                          </p>
                          <button
                            type="button"
                            onClick={handleCopyPathaoWebhookSecret}
                            disabled={copyingPathaoSecret}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copyingPathaoSecret
                              ? 'Preparing secret...'
                              : courierSettings.pathao_webhook_secret_configured
                                ? 'Copy secret again'
                                : 'Generate & copy secret'}
                          </button>
                          <p className="mt-1.5 text-xs text-slate-500">Paste it into Pathao's Secret field, select the events, then click Update.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* RedX API Card */}
                {enabledCouriers.redx && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-indigo-100 pb-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-600 text-xs font-bold text-white">R</span>
                        <h4 className="min-w-0 text-sm font-bold text-slate-900">RedX integration</h4>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Enabled</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">Copy your OpenAPI Access Token from your RedX Merchant Panel &gt; API Settings.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">RedX Access Token</label>
                        <input
                          type="password"
                          name="buykori-redx-access-token"
                          autoComplete="new-password"
                          value={courierSettings.redx_access_token || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, redx_access_token: e.target.value }))}
                          placeholder="Paste RedX OpenAPI token"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Default Pickup Store ID (Optional)</label>
                        <input
                          type="text"
                          value={courierSettings.redx_pickup_store_id || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, redx_pickup_store_id: e.target.value }))}
                          placeholder="e.g. 1"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Default Delivery Area ID</label>
                        <input
                          type="text"
                          value={courierSettings.redx_delivery_area_id || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, redx_delivery_area_id: e.target.value }))}
                          placeholder="e.g. 12"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Default Delivery Area Name</label>
                        <input
                          type="text"
                          value={courierSettings.redx_delivery_area_name || ''}
                          onChange={(e) => setCourierSettings((prev) => ({ ...prev, redx_delivery_area_name: e.target.value }))}
                          placeholder="e.g. Mirpur DOHS"
                          className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="border-t border-slate-200 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-800">RedX callback setup</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">RedX uses one secure callback URL. Generate it below and paste the complete URL into the RedX callback field.</p>
                        </div>
                        <WebhookStatusBadge
                          configured={courierSettings.redx_webhook_secret_configured}
                          verifiedAt={courierSettings.redx_webhook_verified_at}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="min-w-0">
                          <label htmlFor="redx-webhook-callback-url" className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">1</span>
                            Callback endpoint
                          </label>
                          <input
                            id="redx-webhook-callback-url"
                            type="text"
                            readOnly
                            value={redxWebhookCallbackUrl}
                            onFocus={(event) => event.currentTarget.select()}
                            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          />
                          <p className="mt-1.5 text-xs text-slate-500">Reference endpoint only. Use the generated secure URL in the next step.</p>
                        </div>
                        <div className="min-w-0">
                          <p className="mb-1.5 flex items-center gap-2 text-xs font-bold text-slate-700">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] text-white">2</span>
                            Secure callback URL
                          </p>
                          <button type="button" onClick={() => handleCopyCourierWebhookSetup('redx')} disabled={copyingCourierSecret === 'redx'} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
                            <Copy className="h-3.5 w-3.5" />
                            {copyingCourierSecret === 'redx'
                              ? 'Preparing secure URL...'
                              : courierSettings.redx_webhook_secret_configured
                                ? 'Copy secure URL again'
                                : 'Generate & copy secure URL'}
                          </button>
                          <p className="mt-1.5 text-xs text-slate-500">The secure token is included in the copied URL and is not displayed on screen.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Preferred Courier Provider Selection */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <label htmlFor="default-courier-provider" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Preferred Courier
                </label>
                <p className="text-xs text-slate-500 mb-3">Select which courier partner will be pre-selected by default when booking shipments in 1-click.</p>
                <select 
                  id="default-courier-provider"
                  value={courierSettings.default_courier || 'steadfast'}
                  onChange={(e) => setCourierSettings((prev) => ({ ...prev, default_courier: e.target.value }))}
                  className="w-full sm:w-80 p-2.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer font-semibold text-slate-800"
                >
                  <option value="steadfast">SteadFast Courier</option>
                  <option value="pathao">Pathao Courier</option>
                  <option value="redx">RedX Courier</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="flex justify-stretch rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:justify-end">
                <button
                  type="submit"
                  disabled={savingCourier}
                  className="min-h-11 w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
                >
                  {savingCourier ? 'Updating settings...' : 'Save courier settings'}
                </button>
              </div>
            </form>
          )}
        </section>
  );
};

export default CourierSection;
