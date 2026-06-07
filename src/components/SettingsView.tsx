import React, { useState, useEffect } from 'react';
import { Check, Copy, Globe2, Plus, Save, Trash2 } from 'lucide-react';
import { Platform, PlatformConfig, EventRule, ClientConnection, PluginReleaseInfo } from '../types';

interface SettingsViewProps {
  credentials: Record<Platform, PlatformConfig>;
  connection: ClientConnection;
  rules: EventRule[];
  handleUpdatePlatform: (platform: Platform, fields: Partial<PlatformConfig>) => Promise<void>;
  handleToggleRule: (index: number, channel: 'metaEnabled' | 'tiktokEnabled' | 'ga4Enabled') => Promise<void>;
  handleAddRule: (eventName: string) => Promise<void>;
  handleRemoveRule: (index: number) => Promise<void>;
  refreshWPHeartbeat: () => Promise<void>;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  showToast: (msg: string, isErr?: boolean) => void;
  orderManagementEnabled: boolean;
  growthFeaturesEnabled?: boolean;
  pluginReleaseInfo?: PluginReleaseInfo | null;
  storeDomain?: string;
  onSaveStoreDomain?: (domain: string) => Promise<void>;
}

export function SettingsView({
  credentials,
  connection,
  rules,
  handleUpdatePlatform,
  handleToggleRule,
  handleAddRule,
  handleRemoveRule,
  refreshWPHeartbeat,
  copiedStates,
  handleCopy,
  showToast,
  orderManagementEnabled,
  growthFeaturesEnabled = false,
  pluginReleaseInfo,
  storeDomain = '',
  onSaveStoreDomain
}: SettingsViewProps) {
  // Local state for inputs to prevent key-stroke POST spamming
  const [localPixelIds, setLocalPixelIds] = useState<Record<Platform, string>>({
    'Meta CAPI': '',
    'TikTok Events API': '',
    'GA4': ''
  });
  const [localTokens, setLocalTokens] = useState<Record<Platform, string>>({
    'Meta CAPI': '',
    'TikTok Events API': '',
    'GA4': ''
  });
  const [localTestCodes, setLocalTestCodes] = useState<Record<Platform, string>>({
    'Meta CAPI': '',
    'TikTok Events API': '',
    'GA4': ''
  });
  const [selectedEventRoute, setSelectedEventRoute] = useState<string>('');
  const [customEventRoute, setCustomEventRoute] = useState<string>('');
  const [localStoreDomain, setLocalStoreDomain] = useState<string>(storeDomain || '');
  const [savingStoreDomain, setSavingStoreDomain] = useState<boolean>(false);

  const presetEventRoutes = [
    { value: 'ViewContent', label: 'ViewContent - product/details viewed' },
    { value: 'Search', label: 'Search - site search used' },
    { value: 'Lead', label: 'Lead - lead/contact intent' },
    { value: 'Contact', label: 'Contact - contact form or call intent' },
    { value: 'CompleteRegistration', label: 'CompleteRegistration - signup completed' },
    { value: 'AddPaymentInfo', label: 'AddPaymentInfo - payment step reached' },
    { value: 'ViewCart', label: 'ViewCart - cart page viewed' },
    { value: 'RemoveFromCart', label: 'RemoveFromCart - cart item removed' },
    { value: 'Refund', label: 'Refund - order refunded/returned' },
    { value: 'Subscribe', label: 'Subscribe - newsletter or membership signup' },
  ];
  const coreEventRoutes = new Set(['PageView', 'AddToCart', 'InitiateCheckout', 'Purchase']);
  const normalizeVersion = (version?: string) => (version || '').replace(/^v/i, '').trim();
  const installedVersion = normalizeVersion(connection.wpVersion);
  const latestVersion = normalizeVersion(pluginReleaseInfo?.version);
  const updateAvailable = Boolean(installedVersion && latestVersion && installedVersion !== latestVersion);
  const packageSizeKb = pluginReleaseInfo?.package_size ? Math.round(pluginReleaseInfo.package_size / 1024) : 0;
  const availablePresetRoutes = presetEventRoutes.filter(
    preset => !rules.some(rule => rule.eventName.toLowerCase() === preset.value.toLowerCase())
  );
  const isCustomRoute = selectedEventRoute === '__custom__';
  const routeToAdd = isCustomRoute ? customEventRoute : selectedEventRoute;

  const submitEventRoute = async () => {
    await handleAddRule(routeToAdd);
    setSelectedEventRoute('');
    setCustomEventRoute('');
  };

  useEffect(() => {
    setLocalStoreDomain(storeDomain || '');
  }, [storeDomain]);

  const saveStoreDomain = async () => {
    if (!onSaveStoreDomain) return;
    setSavingStoreDomain(true);
    try {
      await onSaveStoreDomain(localStoreDomain);
    } finally {
      setSavingStoreDomain(false);
    }
  };

  // Sync with credentials prop when it loads/updates
  useEffect(() => {
    if (credentials) {
      setLocalPixelIds({
        'Meta CAPI': credentials['Meta CAPI']?.pixelIdOrMeasurementId || '',
        'TikTok Events API': credentials['TikTok Events API']?.pixelIdOrMeasurementId || '',
        'GA4': credentials['GA4']?.pixelIdOrMeasurementId || ''
      });
      setLocalTokens({
        'Meta CAPI': credentials['Meta CAPI']?.accessToken || '',
        'TikTok Events API': credentials['TikTok Events API']?.accessToken || '',
        'GA4': credentials['GA4']?.accessToken || ''
      });
      setLocalTestCodes({
        'Meta CAPI': credentials['Meta CAPI']?.testEventCode || '',
        'TikTok Events API': credentials['TikTok Events API']?.testEventCode || '',
        'GA4': credentials['GA4']?.testEventCode || ''
      });
    }
  }, [credentials]);

  // Courier Settings States
  const [courierSettings, setCourierSettings] = useState<any>({
    pathao_api_key: '',
    pathao_secret_key: '',
    pathao_client_id: '',
    pathao_email: '',
    pathao_client_secret: '',
    pathao_password: '',
    pathao_store_id: '',
    pathao_environment: 'live',
    pathao_webhook_secret: '',
    pathao_webhook_secret_configured: false,
    pathao_webhook_verified_at: '',
    steadfast_api_key: '',
    steadfast_secret_key: '',
    steadfast_webhook_token_configured: false,
    redx_access_token: '',
    redx_webhook_secret_configured: false,
    redx_pickup_store_id: '',
    redx_delivery_area_id: '',
    redx_delivery_area_name: '',
    courier_auto_send: false,
    default_courier: 'steadfast'
  });
  const [loadingCourier, setLoadingCourier] = useState<boolean>(false);
  const [savingCourier, setSavingCourier] = useState<boolean>(false);
  const [copyingPathaoSecret, setCopyingPathaoSecret] = useState<boolean>(false);
  const [copyingCourierSecret, setCopyingCourierSecret] = useState<string>('');

  useEffect(() => {
    setLoadingCourier(true);
    const fetchCourierSettings = async () => {
      try {
        const res = await fetch('/api/courier/settings');
        if (res.ok) {
          const data = await res.json();
          const [fallbackClientId = '', fallbackEmail = ''] = String(data.pathao_api_key || '').split('|');
          setCourierSettings({
            ...data,
            pathao_client_id: data.pathao_client_id || fallbackClientId,
            pathao_email: data.pathao_email || fallbackEmail,
            pathao_client_secret: data.pathao_client_secret || '',
            pathao_password: data.pathao_password || ''
          });
        }
      } catch (err) {
        console.error("Failed to load courier settings", err);
      } finally {
        setLoadingCourier(false);
      }
    };
    fetchCourierSettings();
  }, []);

  const handleSaveCourierSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCourier(true);
    const payload = {
      ...courierSettings,
      pathao_api_key: undefined,
      pathao_secret_key: undefined,
      pathao_webhook_secret: undefined
    };
    try {
      const res = await fetch('/api/courier/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast("Courier settings updated successfully.", false);
      } else {
        const errData = await res.json();
        showToast(errData.detail || "Failed to update courier settings.", true);
      }
    } catch (err) {
      showToast("Error updating courier settings.", true);
    } finally {
      setSavingCourier(false);
    }
  };

  const handleCopyPathaoWebhookSecret = async () => {
    setCopyingPathaoSecret(true);
    try {
      const res = await fetch('/api/courier/pathao/webhook-secret', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || 'Failed to generate Pathao webhook secret.', true);
        return;
      }
      await navigator.clipboard.writeText(data.secret);
      setCourierSettings((prev: any) => ({
        ...prev,
        pathao_webhook_secret: '',
        pathao_webhook_secret_configured: true,
        pathao_webhook_verified_at: data.verified_at || ''
      }));
      showToast('Pathao setup secret copied. Paste it into the Pathao Webhook Integration Secret field.', false);
    } catch (err) {
      showToast('Failed to copy Pathao webhook secret.', true);
    } finally {
      setCopyingPathaoSecret(false);
    }
  };

  const handleCopyCourierWebhookSetup = async (provider: 'steadfast' | 'redx') => {
    setCopyingCourierSecret(provider);
    try {
      const res = await fetch(`/api/courier/${provider}/webhook-secret`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || `Failed to generate ${provider} webhook secret.`, true);
        return;
      }
      const value = provider === 'redx'
        ? data.callback_url
        : `Callback URL: ${data.callback_url}\nAuth Token: ${data.secret}`;
      await navigator.clipboard.writeText(value);
      setCourierSettings((prev: any) => ({
        ...prev,
        [`${provider === 'steadfast' ? 'steadfast_webhook_token' : 'redx_webhook_secret'}_configured`]: true
      }));
      showToast(`${provider === 'steadfast' ? 'SteadFast' : 'RedX'} webhook setup copied.`, false);
    } catch (err) {
      showToast(`Failed to copy ${provider} webhook setup.`, true);
    } finally {
      setCopyingCourierSecret('');
    }
  };



  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Fixed controls sidebar settings tabs */}
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center dark:bg-indigo-950/40 dark:text-indigo-300">
                <Globe2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Website Domain</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Used for custom website tracking, domain lock, and setup checks.</p>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              storeDomain
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50'
                : 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50'
            }`}>
              {storeDomain ? 'Configured' : 'Missing'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Store Domain</label>
              <input
                type="text"
                value={localStoreDomain}
                placeholder="example.com"
                onChange={(e) => setLocalStoreDomain(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveStoreDomain(); }}
                className="w-full p-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-950 dark:border-slate-800 dark:text-white"
              />
            </div>
            <button
              type="button"
              disabled={savingStoreDomain || localStoreDomain.trim() === (storeDomain || '').trim()}
              onClick={saveStoreDomain}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:self-end dark:bg-white dark:text-slate-950"
            >
              <Save className="h-3.5 w-3.5" />
              {savingStoreDomain ? 'Saving' : 'Save Domain'}
            </button>
          </div>
        </div>
        
        {/* Pipeline credentials card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Platform Credential Keys</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Manage API keys, pixel IDs, and tracking tokens for each platform.</p>
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
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Pixel ID / Measurement ID</label>
                    <input 
                      type="text"
                      value={localPixelIds[plat]}
                      placeholder="e.g. 782049182390"
                      onChange={(e) => setLocalPixelIds(prev => ({ ...prev, [plat]: e.target.value }))}
                      onBlur={() => handleUpdatePlatform(plat, { pixelIdOrMeasurementId: localPixelIds[plat] })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Access Token</label>
                    <input 
                      type="password"
                      value={localTokens[plat]}
                      placeholder="************************"
                      onChange={(e) => setLocalTokens(prev => ({ ...prev, [plat]: e.target.value }))}
                      onBlur={() => handleUpdatePlatform(plat, { accessToken: localTokens[plat] })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                    />
                  </div>

                  {plat !== 'GA4' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Test Event Code (Optional)</label>
                      <input 
                        type="text"
                        value={localTestCodes[plat]}
                        placeholder="e.g. TEST12345"
                        onChange={(e) => setLocalTestCodes(prev => ({ ...prev, [plat]: e.target.value }))}
                        onBlur={() => handleUpdatePlatform(plat, { testEventCode: localTestCodes[plat] })}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Courier Settings Panel */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Courier Integration Credentials</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Configure courier API settings for Pathao, SteadFast, and RedX.</p>
            </div>
            
            {/* Auto send toggle */}
            <div className="flex items-center gap-4">
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={courierSettings.courier_auto_send}
                  disabled={!growthFeaturesEnabled}
                  onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, courier_auto_send: e.target.checked }))} 
                  className="sr-only peer disabled:cursor-not-allowed"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                <span className="ml-2 text-[10px] font-semibold text-slate-500 uppercase dark:text-slate-400">
                  Auto-Book Courier: {courierSettings.courier_auto_send ? 'On' : 'Off'}
                </span>
              </label>
            </div>
          </div>
          {!growthFeaturesEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              Free plan includes manual courier booking. Auto-booking and automatic delivery Purchase sync require an active Growth trial or paid plan.
            </p>
          )}

          {loadingCourier ? (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
              <span>Loading configurations...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveCourierSettings} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SteadFast section */}
                <div className="p-4 rounded-lg border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-4">
                  <h4 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                    SteadFast Courier API
                  </h4>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">SteadFast API Key</label>
                    <input 
                      type="text"
                      value={courierSettings.steadfast_api_key || ''}
                      onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, steadfast_api_key: e.target.value }))}
                      placeholder="Enter SteadFast Api-Key"
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">SteadFast Secret Key</label>
                    <input 
                      type="password"
                      value={courierSettings.steadfast_secret_key || ''}
                      onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, steadfast_secret_key: e.target.value }))}
                      placeholder="************************"
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                    />
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                    <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">SteadFast Webhook Setup</p>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Copy callback URL and bearer auth token for the SteadFast panel.</p>
                    <button type="button" onClick={() => handleCopyCourierWebhookSetup('steadfast')} disabled={copyingCourierSecret === 'steadfast'} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                      <Copy className="h-3.5 w-3.5" />
                      {copyingCourierSecret === 'steadfast' ? 'Preparing...' : courierSettings.steadfast_webhook_token_configured ? 'Copy Setup Again' : 'Copy Setup Secret'}
                    </button>
                  </div>
                </div>

                {/* Pathao section */}
                <div className="p-4 rounded-lg border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-4">
                  <h4 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                    Pathao Courier API
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Pathao Client ID
                      </label>
                      <input
                        type="text"
                        value={courierSettings.pathao_client_id || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_client_id: e.target.value }))}
                        placeholder="Client ID"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Store Owner Email
                      </label>
                      <input
                        type="email"
                        value={courierSettings.pathao_email || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_email: e.target.value }))}
                        placeholder="owner@example.com"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Pathao Client Secret
                      </label>
                      <input
                        type="password"
                        value={courierSettings.pathao_client_secret || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_client_secret: e.target.value }))}
                        placeholder="************************"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">
                        Store Password
                      </label>
                      <input
                        type="password"
                        value={courierSettings.pathao_password || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_password: e.target.value }))}
                        placeholder="************************"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Pathao Environment</label>
                      <select
                        value={courierSettings.pathao_environment || 'live'}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_environment: e.target.value }))}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      >
                        <option value="live">Live</option>
                        <option value="sandbox">Sandbox / Test</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Pathao Store ID</label>
                      <input
                        type="text"
                        value={courierSettings.pathao_store_id || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_store_id: e.target.value }))}
                        placeholder="Store ID"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">Pathao Webhook Setup Secret</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                          Copy this generated secret and paste it into Pathao Merchant Panel Webhook Integration.
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase ${
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
                      className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copyingPathaoSecret ? 'Preparing secret...' : 'Copy Setup Secret'}
                    </button>
                  </div>
                </div>

                {/* RedX section */}
                <div className="p-4 rounded-lg border border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-4 md:col-span-2">
                  <h4 className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                    RedX Courier API
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">RedX Access Token</label>
                      <input
                        type="password"
                        value={courierSettings.redx_access_token || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, redx_access_token: e.target.value }))}
                        placeholder="Paste RedX OpenAPI token"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Default Pickup Store ID (Optional)</label>
                      <input
                        type="text"
                        value={courierSettings.redx_pickup_store_id || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, redx_pickup_store_id: e.target.value }))}
                        placeholder="e.g. 1"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Default Delivery Area ID</label>
                      <input
                        type="text"
                        value={courierSettings.redx_delivery_area_id || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, redx_delivery_area_id: e.target.value }))}
                        placeholder="e.g. 12"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Default Delivery Area Name</label>
                      <input
                        type="text"
                        value={courierSettings.redx_delivery_area_name || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, redx_delivery_area_name: e.target.value }))}
                        placeholder="e.g. Mirpur DOHS"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                    <p className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">RedX Webhook Setup</p>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Copy the callback URL with its dedicated token and paste it into RedX.</p>
                    <button type="button" onClick={() => handleCopyCourierWebhookSetup('redx')} disabled={copyingCourierSecret === 'redx'} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                      <Copy className="h-3.5 w-3.5" />
                      {copyingCourierSecret === 'redx' ? 'Preparing...' : courierSettings.redx_webhook_secret_configured ? 'Copy Callback URL Again' : 'Copy Callback URL'}
                    </button>
                  </div>
                </div>
              </div>

              {/* General courier choices */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Default Courier Provider</label>
                  <select 
                    value={courierSettings.default_courier || 'steadfast'}
                    onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, default_courier: e.target.value }))}
                    className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="steadfast">SteadFast Courier</option>
                  <option value="pathao">Pathao Courier</option>
                  <option value="redx">RedX Courier</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={savingCourier}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-md transition-all cursor-pointer text-center"
                  >
                    {savingCourier ? 'Updating settings...' : 'Save Courier Settings'}
                  </button>
                </div>
              </div>

            </form>
          )}
        </div>

        {/* WordPress Custom tracking rules */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">WordPress event routing rules</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Keep active routes short. Add WooCommerce presets or a custom event from the dropdown.</p>
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-slate-150 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/30 xl:w-[520px]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <select
                  value={selectedEventRoute}
                  onChange={(e) => setSelectedEventRoute(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
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
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
              )}
              <p className="text-[10px] leading-normal text-slate-400 dark:text-slate-500">
                Custom names can use letters, numbers, and underscores. WordPress must fire the same event name.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-slate-600 text-left min-w-[760px] dark:text-slate-300">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Active event route</th>
                  <th className="px-4 py-3 text-center">Meta CAPI</th>
                  <th className="px-4 py-3 text-center">TikTok tracking</th>
                  <th className="px-4 py-3 text-center">GA4 Measurement</th>
                  <th className="px-4 py-3 text-right">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-white">{rule.eventName}</span>
                        {!coreEventRoutes.has(rule.eventName) && (
                          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">Custom / optional route</span>
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
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 dark:hover:text-rose-400"
                          title={`Remove ${rule.eventName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-350 dark:text-slate-600">Core</span>
                      )}
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
            <p className="text-xs text-slate-400 dark:text-slate-500">Connection used by your WooCommerce tracking plugin.</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-150 dark:bg-slate-950 dark:border-slate-800 space-y-3 font-mono text-xs text-slate-700 dark:text-slate-305">
            <div>
              <span className="block text-[9px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">API Access Key</span>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-800">
                <span className="truncate select-all">{connection.api_key || connection.token}</span>
                <button 
                  onClick={() => handleCopy(connection.api_key || connection.token, 'sett_wp_tok')}
                  className="text-slate-400 hover:text-slate-655 ml-auto shrink-0 cursor-pointer"
                  title="Copy Access token"
                >
                  {copiedStates['sett_wp_tok'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="block text-[9px] text-slate-400 dark:text-slate-500 uppercase mb-0.5">Plugin detected version</span>
                <span className="font-semibold text-slate-800 dark:text-white">v{connection.wpVersion}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 dark:text-slate-500 uppercase mb-0.5">Last query heartbeat</span>
                <span className="font-semibold text-slate-800 dark:text-white">{new Date(connection.lastHeartbeat).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Latest plugin package</p>
                <p className="mt-1 font-semibold text-slate-800 dark:text-white">
                  {pluginReleaseInfo ? `v${pluginReleaseInfo.version}` : 'Checking release...'}
                </p>
                {pluginReleaseInfo && (
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    WordPress {pluginReleaseInfo.requires}+ / PHP {pluginReleaseInfo.requires_php}+ / {packageSizeKb} KB
                  </p>
                )}
              </div>
              <span className={
                updateAvailable
                  ? 'shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-400'
                  : pluginReleaseInfo?.package_available
                    ? 'shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-400'
                    : 'shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
              }>
                {updateAvailable ? 'Update available' : pluginReleaseInfo?.package_available ? 'Up to date' : 'Unavailable'}
              </span>
            </div>
          </div>

          <button 
            onClick={() => {
              showToast("Pinging WordPress plugin...", false);
              refreshWPHeartbeat()
                .then(() => showToast("WordPress connection is active.", false))
                .catch(() => showToast("Failed to ping WordPress plugin.", true));
            }}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors border border-indigo-700/20 cursor-pointer dark:bg-indigo-600 dark:hover:bg-indigo-700"
          >
            Test WordPress Connection
          </button>
        </div>

        {/* Threshold trigger alerts setting */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4 dark:bg-slate-900 dark:border-slate-800">
          <div>
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide dark:text-white">Threshold warnings</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 leading-normal">Send email alerts when your monthly tracking usage gets high.</p>
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
                  <span>Alert me on tracking errors</span>
                </label>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
