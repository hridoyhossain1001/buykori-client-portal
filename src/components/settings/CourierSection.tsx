import React from 'react';
import { Copy } from 'lucide-react';
import { CourierSettings } from '../../types';

export interface EnabledCouriers {
  steadfast: boolean;
  pathao: boolean;
  redx: boolean;
}

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
}

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
}) => {
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* SteadFast Toggle Box */}
              <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${enabledCouriers.steadfast ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-3">
                  {/* Real SteadFast Brand Logo */}
                  <img src="/couriers/steadfast.svg" alt="SteadFast Courier" className="h-10 w-auto object-contain shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">SteadFast</h4>
                    <span className="text-[10px] font-semibold text-slate-500">Express Courier</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabledCouriers(prev => ({ ...prev, steadfast: !prev.steadfast }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabledCouriers.steadfast ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabledCouriers.steadfast ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Pathao Toggle Box */}
              <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${enabledCouriers.pathao ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-3">
                  {/* Real Pathao Brand Logo */}
                  <img src="/couriers/pathao.svg" alt="Pathao Courier" className="h-10 w-auto object-contain shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Pathao Courier</h4>
                    <span className="text-[10px] font-semibold text-slate-500">Nationwide Shipping</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabledCouriers(prev => ({ ...prev, pathao: !prev.pathao }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabledCouriers.pathao ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabledCouriers.pathao ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* RedX Toggle Box */}
              <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${enabledCouriers.redx ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-3">
                  {/* Real RedX Brand Logo */}
                  <img src="/couriers/redx.svg" alt="RedX Logistics" className="h-10 w-auto object-contain shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">RedX Logistics</h4>
                    <span className="text-[10px] font-semibold text-slate-500">Doorstep Delivery</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEnabledCouriers(prev => ({ ...prev, redx: !prev.redx }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${enabledCouriers.redx ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enabledCouriers.redx ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
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
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">S</span>
                        <h4 className="font-bold text-xs text-indigo-700 uppercase tracking-wider">
                          SteadFast Courier API Integration
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Active Form</span>
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
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">SteadFast Webhook Setup</p>
                      <p className="mt-1 text-xs text-slate-600">Copy the Webhook Callback URL to receive realtime shipment status updates from SteadFast.</p>
                      <button type="button" onClick={() => handleCopyCourierWebhookSetup('steadfast')} disabled={copyingCourierSecret === 'steadfast'} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs">
                        <Copy className="h-3.5 w-3.5" />
                        {copyingCourierSecret === 'steadfast' ? 'Preparing...' : courierSettings.steadfast_webhook_token_configured ? 'Copy Setup Again' : 'Copy Setup Secret'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Pathao API Card */}
                {enabledCouriers.pathao && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-600 text-xs font-bold text-white">P</span>
                        <h4 className="font-bold text-xs text-indigo-700 uppercase tracking-wider">
                          Pathao Courier API Integration
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Active Form</span>
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

                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">Pathao Webhook Setup Secret</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">Copy the generated secret and paste it into your Pathao Merchant Panel Webhook Integration.</p>
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
                      <button
                        type="button"
                        onClick={handleCopyPathaoWebhookSecret}
                        disabled={copyingPathaoSecret}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {copyingPathaoSecret ? 'Preparing secret...' : 'Copy Setup Secret'}
                      </button>
                    </div>
                  </div>
                )}

                {/* RedX API Card */}
                {enabledCouriers.redx && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600 text-xs font-bold text-white">R</span>
                        <h4 className="font-bold text-xs text-indigo-700 uppercase tracking-wider">
                          RedX Logistics API Integration
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Active Form</span>
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
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">RedX Webhook Setup</p>
                      <p className="mt-1 text-xs text-slate-600">Copy the Callback URL with dedicated token to paste into your RedX merchant portal.</p>
                      <button type="button" onClick={() => handleCopyCourierWebhookSetup('redx')} disabled={copyingCourierSecret === 'redx'} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs">
                        <Copy className="h-3.5 w-3.5" />
                        {copyingCourierSecret === 'redx' ? 'Preparing...' : courierSettings.redx_webhook_secret_configured ? 'Copy Callback URL Again' : 'Copy Callback URL'}
                      </button>
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
              <div className="flex justify-end rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <button
                  type="submit"
                  disabled={savingCourier}
                  className="min-h-10 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
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
