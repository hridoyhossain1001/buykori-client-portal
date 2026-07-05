import React, { useState, useEffect } from 'react';
import { Check, Copy, Globe2, Plus, Save, Trash2 } from 'lucide-react';
import { Tooltip } from './common/Tooltip';
import { Platform, PlatformConfig, EventRule, ClientConnection, PluginReleaseInfo, CustomEventAutomation, CustomEventTrigger } from '../types';

interface SettingsViewProps {
  credentials: Record<Platform, PlatformConfig>;
  connection: ClientConnection;
  rules: EventRule[];
  customEventAutomations: CustomEventAutomation[];
  handleUpdatePlatform: (platform: Platform, fields: Partial<PlatformConfig>) => Promise<void>;
  handleToggleRule: (index: number, channel: 'metaEnabled' | 'tiktokEnabled' | 'ga4Enabled') => Promise<void>;
  handleAddRule: (eventName: string) => Promise<void>;
  handleRemoveRule: (index: number) => Promise<void>;
  handleSaveCustomEventAutomations: (automations: CustomEventAutomation[]) => Promise<boolean>;
  refreshWPHeartbeat: () => Promise<void>;
  copiedStates: Record<string, boolean>;
  handleCopy: (text: string, labelId: string) => void;
  showToast: (msg: string, isErr?: boolean) => void;
  growthFeaturesEnabled?: boolean;
  deferredEnabled?: boolean;
  autoConfirmDays?: number;
  autoConfirmStatus?: string;
  pluginReleaseInfo?: PluginReleaseInfo | null;
  storeDomain?: string;
  onSaveStoreDomain?: (domain: string) => Promise<void>;
  onOpenPage?: (pageId: string) => void;
  profNotifyWhatsapp: boolean;
  setProfNotifyWhatsapp: (v: boolean) => void;
  profWhatsappNumber: string;
  setProfWhatsappNumber: (v: string) => void;
  profUpdating: boolean;
  submitProfileSave: (e: React.FormEvent) => Promise<void>;
}

export function SettingsView({
  credentials,
  connection,
  rules,
  customEventAutomations,
  handleUpdatePlatform,
  handleToggleRule,
  handleAddRule,
  handleRemoveRule,
  handleSaveCustomEventAutomations,
  refreshWPHeartbeat,
  copiedStates,
  handleCopy,
  showToast,
  growthFeaturesEnabled = false,
  deferredEnabled = false,
  autoConfirmDays = 0,
  autoConfirmStatus = 'completed',
  pluginReleaseInfo,
  storeDomain = '',
  onSaveStoreDomain,
  onOpenPage,
  profNotifyWhatsapp,
  setProfNotifyWhatsapp,
  profWhatsappNumber,
  setProfWhatsappNumber,
  profUpdating,
  submitProfileSave
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
  const [automationDrafts, setAutomationDrafts] = useState<CustomEventAutomation[]>(customEventAutomations || []);
  const [savingAutomations, setSavingAutomations] = useState<boolean>(false);

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
  const settingsTabs = [
    {
      id: 'store',
      label: 'Store Connection',
      sections: [
        { id: 'settings-domain', label: 'Domain lock' },
        { id: 'settings-wordpress', label: 'WooCommerce Sync API' },
      ],
    },
    {
      id: 'conversions',
      label: 'Conversions API',
      sections: [
        { id: 'settings-platforms', label: 'Tracking destinations' },
        { id: 'settings-cod', label: 'COD timing' },
        { id: 'settings-routing', label: 'Event routing' },
        { id: 'settings-custom-automations', label: 'Custom automations' },
      ],
    },
    {
      id: 'ads',
      label: 'Ad Accounts',
      sections: [
        { id: 'settings-ad-accounts', label: 'Account sync' },
      ],
    },
    {
      id: 'courier',
      label: 'Courier Logistics',
      sections: [
        { id: 'settings-courier', label: 'Fulfillment APIs' },
      ],
    },
    {
      id: 'alerts',
      label: 'Alerts & Notifications',
      sections: [
        { id: 'settings-whatsapp', label: 'WhatsApp alerts' },
      ],
    },
  ];
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>('store');
  const normalizeVersion = (version?: string) => (version || '').replace(/^v/i, '').trim();
  const compareVersions = (left: string, right: string) => {
    const leftParts = left.split('.').map(part => Number.parseInt(part, 10) || 0);
    const rightParts = right.split('.').map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (difference !== 0) return difference;
    }
    return 0;
  };
  const installedVersion = normalizeVersion(connection.pluginVersion);
  const latestVersion = normalizeVersion(pluginReleaseInfo?.version);
  const installedVersionReported = Boolean(installedVersion);
  const versionComparison = installedVersionReported && latestVersion
    ? compareVersions(installedVersion, latestVersion)
    : null;
  const updateAvailable = versionComparison !== null && versionComparison < 0;
  const pluginVersionStatus = installedVersionReported
    ? `v${installedVersion}`
    : 'Plugin version not reported yet';
  const pluginVersionHelp = installedVersionReported
    ? 'Plugin reported version'
    : connection.wpVersion
      ? `WordPress core v${connection.wpVersion} reported`
      : 'Waiting for plugin heartbeat';
  const apiAccessKey = connection.api_key || connection.token || '';
  const maskedApiAccessKey = apiAccessKey
    ? `${'*'.repeat(Math.min(Math.max(apiAccessKey.length - 6, 8), 24))}${apiAccessKey.slice(-6)}`
    : 'Not available';
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
  const activeSectionIds = settingsTabs.find(tab => tab.id === activeSettingsTab)?.sections.map(section => section.id) || [];

  useEffect(() => {
    const handleSectionJump = (event: Event) => {
      const detail = (event as CustomEvent<{ pageId: string; sectionId: string }>).detail;
      if (detail?.pageId !== 'settings') return;
      const sectionId = detail.sectionId;
      if (!sectionId) return;
      const targetTab = settingsTabs.find(tab => tab.sections.some(section => section.id === sectionId));
      if (targetTab) setActiveSettingsTab(targetTab.id);
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      });
    };

    window.addEventListener('buykori:page-section', handleSectionJump);
    return () => window.removeEventListener('buykori:page-section', handleSectionJump);
  }, []);

  useEffect(() => {
    setLocalStoreDomain(storeDomain || '');
  }, [storeDomain]);

  useEffect(() => {
    setAutomationDrafts(customEventAutomations || []);
  }, [customEventAutomations]);

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

  // Connected ad accounts states
  const [adAccounts, setAdAccounts] = useState<any[]>([]);
  const [loadingAdAccounts, setLoadingAdAccounts] = useState<boolean>(false);
  const [savingAdAccount, setSavingAdAccount] = useState<boolean>(false);
  const [deletingAdAccountId, setDeletingAdAccountId] = useState<number | null>(null);

  // Form states for ad accounts
  const [adPlatform, setAdPlatform] = useState<'meta' | 'tiktok'>('meta');
  const [adAccountId, setAdAccountId] = useState<string>('');
  const [adAccountName, setAdAccountName] = useState<string>('');
  const [adAccessToken, setAdAccessToken] = useState<string>('');
  const [adRefreshToken, setAdRefreshToken] = useState<string>('');
  const [adCurrency, setAdCurrency] = useState<string>('USD');
  const [adTimezone, setAdTimezone] = useState<string>('Asia/Dhaka');

  const fetchAdAccounts = async () => {
    setLoadingAdAccounts(true);
    try {
      const res = await fetch('/api/v1/ad-accounts');
      if (res.ok) {
        const data = await res.json();
        setAdAccounts(data);
      }
    } catch (err) {
      console.error("Failed to load ad accounts", err);
    } finally {
      setLoadingAdAccounts(false);
    }
  };

  useEffect(() => {
    fetchAdAccounts();
  }, []);

  const handleConnectAdAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adAccountId.trim() || !adAccessToken.trim()) {
      showToast("Please enter both Ad Account ID and Access Token.", true);
      return;
    }
    setSavingAdAccount(true);
    try {
      const res = await fetch('/api/v1/ad-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: adPlatform,
          external_account_id: adAccountId.trim(),
          account_name: adAccountName.trim() || null,
          access_token: adAccessToken.trim(),
          refresh_token: adRefreshToken.trim() || null,
          account_currency: adCurrency,
          account_timezone: adTimezone
        })
      });
      if (res.ok) {
        showToast("Ad account connected successfully.", false);
        setAdAccountId('');
        setAdAccountName('');
        setAdAccessToken('');
        setAdRefreshToken('');
        fetchAdAccounts();
      } else {
        const errData = await res.json();
        showToast(errData.detail || "Failed to connect ad account.", true);
      }
    } catch (err) {
      showToast("Error connecting ad account.", true);
    } finally {
      setSavingAdAccount(false);
    }
  };

  const handleDisconnectAdAccount = async (id: number) => {
    if (!window.confirm("Are you sure you want to disconnect this ad account? Daily syncing for this account will stop.")) {
      return;
    }
    setDeletingAdAccountId(id);
    try {
      const res = await fetch(`/api/v1/ad-accounts/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast("Ad account disconnected successfully.", false);
        fetchAdAccounts();
      } else {
        const errData = await res.json();
        showToast(errData.detail || "Failed to disconnect ad account.", true);
      }
    } catch (err) {
      showToast("Error disconnecting ad account.", true);
    } finally {
      setDeletingAdAccountId(null);
    }
  };


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

  const platformOrder: Platform[] = ['Meta CAPI', 'TikTok Events API', 'GA4'];
  const platformDestinationLabel = (platform: Platform) => (
    platform === 'GA4' ? 'Measurement ID' : platform === 'TikTok Events API' ? 'TikTok Pixel ID' : 'Meta Pixel ID'
  );
  const platformTokenLabel = (platform: Platform) => (
    platform === 'GA4' ? 'API Secret' : 'Access Token'
  );
  const platformMissingCredentials = (platform: Platform, config?: PlatformConfig) => {
    const destination = String(config?.pixelIdOrMeasurementId || '').trim();
    const token = String(config?.accessToken || '').trim();
    const missing = [];
    if (!destination || destination === '0') missing.push(platformDestinationLabel(platform));
    if (!token) missing.push(platformTokenLabel(platform));
    return missing;
  };

  const updateAutomationDraft = (index: number, fields: Partial<CustomEventAutomation>) => {
    setAutomationDrafts(prev => prev.map((item, itemIndex) => itemIndex === index ? { ...item, ...fields } : item));
  };

  const addAutomationDraft = () => {
    setAutomationDrafts(prev => [
      ...prev,
      {
        id: `draft_${Date.now()}`,
        name: '',
        trigger: 'timer',
        selector: '15',
        url_pattern: '',
        seconds: 15,
        value: 0,
        currency: 'BDT',
        custom_param: '',
        customData: {},
        enabled: true,
      }
    ]);
  };

  const removeAutomationDraft = (index: number) => {
    setAutomationDrafts(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveAutomationDrafts = async () => {
    setSavingAutomations(true);
    try {
      await handleSaveCustomEventAutomations(automationDrafts);
    } finally {
      setSavingAutomations(false);
    }
  };
  const platformStatusRows = platformOrder.map((platform) => {
    const config = credentials[platform];
    const destination = String(config?.pixelIdOrMeasurementId || '').trim();
    const hasDestinationId = Boolean(destination) && destination !== '0';
    const hasAccessSecret = Boolean(String(config?.accessToken || '').trim());
    const configured = hasDestinationId && hasAccessSecret;
    return {
      platform,
      enabled: Boolean(config?.enabled),
      configured
    };
  });
  const configuredPlatformCount = platformStatusRows.filter(row => row.configured).length;
  const enabledPlatformCount = platformStatusRows.filter(row => row.enabled).length;
  const enabledRouteCount = rules.filter(rule => rule.metaEnabled || rule.tiktokEnabled || rule.ga4Enabled).length;
  const selectedCourierProvider = String(courierSettings.default_courier || 'steadfast').toLowerCase();
  const courierProviderLabel =
    selectedCourierProvider === 'pathao'
      ? 'Pathao'
      : selectedCourierProvider === 'redx'
        ? 'RedX'
        : 'SteadFast';
  const courierMissingCredentials =
    selectedCourierProvider === 'pathao'
      ? [
          !courierSettings.pathao_client_id ? 'Client ID' : '',
          !courierSettings.pathao_client_secret ? 'Client secret' : '',
          !courierSettings.pathao_password ? 'Store password' : '',
          !courierSettings.pathao_store_id ? 'Store ID' : ''
        ].filter(Boolean)
      : selectedCourierProvider === 'redx'
        ? [
            !courierSettings.redx_access_token ? 'Access token' : ''
          ].filter(Boolean)
        : [
            !courierSettings.steadfast_api_key ? 'API key' : '',
            !courierSettings.steadfast_secret_key ? 'Secret key' : ''
          ].filter(Boolean);
  const courierProviderConfigured =
    selectedCourierProvider === 'pathao'
      ? Boolean(courierSettings.pathao_client_id && courierSettings.pathao_client_secret && courierSettings.pathao_password && courierSettings.pathao_store_id)
      : selectedCourierProvider === 'redx'
        ? Boolean(courierSettings.redx_access_token)
        : Boolean(courierSettings.steadfast_api_key && courierSettings.steadfast_secret_key);
  const whatsappStatus = profNotifyWhatsapp
    ? profWhatsappNumber.trim()
      ? 'Ready'
      : 'Needs number'
    : 'Off';
  const wordpressConnectionStatus = connection.api_key || connection.token ? 'Connected' : 'Needs key';
  const autoConfirmLabel = autoConfirmDays > 0
    ? `${autoConfirmDays} day${autoConfirmDays === 1 ? '' : 's'} after order hold`
    : 'Manual confirmation only';
  const formattedConfirmStatus = autoConfirmStatus
    ? autoConfirmStatus.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    : 'Completed';

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex gap-1 overflow-x-auto">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSettingsTab(tab.id)}
              className={`min-w-fit rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                activeSettingsTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>
      {activeSettingsTab === 'store' && (
        <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">Portal-managed setup</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                These settings are the source of truth for the WordPress plugin. The plugin sends store events, while delivery rules, platform keys, courier credentials, and alert preferences are managed here.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-indigo-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
              Plugin UI stays lightweight
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setActiveSettingsTab('conversions')}
              className="rounded-lg border border-white bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tracking destinations</span>
              <p className="mt-1 text-lg font-black text-slate-900">{configuredPlatformCount}/{platformStatusRows.length} ready</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{enabledPlatformCount} enabled, {enabledRouteCount} routed events</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab('courier')}
              className="rounded-lg border border-white bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Courier workflow</span>
              <p className="mt-1 text-lg font-black text-slate-900">{courierProviderConfigured ? 'Ready' : 'Needs keys'}</p>
              <p className="mt-0.5 text-[11px] font-semibold capitalize text-slate-500">{selectedCourierProvider} default, auto-book {courierSettings.courier_auto_send ? 'on' : 'off'}</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab('alerts')}
              className="rounded-lg border border-white bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">WhatsApp alerts</span>
              <p className="mt-1 text-lg font-black text-slate-900">{whatsappStatus}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">Admin sender, client receiver number</p>
            </button>
            <button
              type="button"
              onClick={() => setActiveSettingsTab('store')}
              className="rounded-lg border border-white bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plugin connection</span>
              <p className="mt-1 text-lg font-black text-slate-900">{wordpressConnectionStatus}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{updateAvailable ? 'Plugin update available' : pluginVersionHelp}</p>
            </button>
          </div>
        </section>
      )}
      <div
        className="settings-tab-view grid grid-cols-1 gap-5 lg:gap-6"
        data-visible-sections={activeSectionIds.join(' ')}
      >
      <style>{`
        .settings-tab-view section[id^="settings-"] { display: none; }
        ${activeSectionIds.map(id => `.settings-tab-view #${id} { display: block; }`).join('\n')}
        .settings-tab-view > div { display: contents; }
      `}</style>
      
      {/* Fixed controls sidebar settings tabs */}
      <div className="space-y-5 lg:col-span-2 lg:space-y-6">
        <section id="settings-domain" aria-labelledby="settings-domain-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center  ">
                <Globe2 className="h-4 w-4" />
              </div>
              <div>
                <h2 id="settings-domain-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Website Domain</h2>
                <p className="text-xs text-slate-400 ">Used for custom website tracking, domain lock, and setup checks.</p>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              storeDomain
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100   '
                : 'bg-amber-50 text-amber-700 border border-amber-100   '
            }`}>
              {storeDomain ? 'Configured' : 'Missing'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div>
              <label htmlFor="store-domain" className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Store Domain</label>
              <input
                id="store-domain"
                type="text"
                value={localStoreDomain}
                placeholder="example.com"
                onChange={(e) => setLocalStoreDomain(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveStoreDomain(); }}
                className="w-full p-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
              />
            </div>
            <button
              type="button"
              disabled={savingStoreDomain || localStoreDomain.trim() === (storeDomain || '').trim()}
              onClick={saveStoreDomain}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:self-end  "
            >
              <Save className="h-3.5 w-3.5" />
              {savingStoreDomain ? 'Saving' : 'Save Domain'}
            </button>
          </div>
        </section>
        
        {/* Pipeline credentials card */}
        <section id="settings-platforms" aria-labelledby="settings-platforms-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6  ">
          <div>
            <h2 id="settings-platforms-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Platform Credential Keys</h2>
            <p className="text-xs text-slate-400 ">Portal-managed API keys and destination IDs. The WordPress plugin reads these rules instead of storing business settings locally.</p>
          </div>

          {Object.keys(credentials).map(platKey => {
            const plat = platKey as Platform;
            const config = credentials[plat];
            const missingCredentials = platformMissingCredentials(plat, config);
            const enabledButMissingCredentials = Boolean(config.enabled && missingCredentials.length);
            return (
              <div key={plat} className="p-4 rounded-lg border border-slate-200  bg-slate-50/50  space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-800  uppercase tracking-wider">{plat} Route</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
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
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
                    <span className="ml-2 text-[10px] font-semibold text-slate-500 uppercase ">
                      {config.enabled ? 'On' : 'Off'}
                    </span>
                  </label>
                </div>

                {enabledButMissingCredentials && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    <p className="font-bold">{plat} is on, but credentials are missing.</p>
                    <p className="mt-0.5">
                      Events will not be sent until you add {missingCredentials.join(' and ')}.
                    </p>
                  </div>
                )}

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
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                    />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Access Token</label>
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
                  </div>

                  {plat !== 'GA4' && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase mb-1 flex items-center">
                        Test Event Code (Optional)
                        <Tooltip content="Use this optional Meta or TikTok test event code only while validating tracking setup." />
                      </label>
                      <input 
                        type="text"
                        value={localTestCodes[plat]}
                        placeholder="e.g. TEST12345"
                        onChange={(e) => setLocalTestCodes(prev => ({ ...prev, [plat]: e.target.value }))}
                        onBlur={() => handleUpdatePlatform(plat, { testEventCode: localTestCodes[plat] })}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Ad Sync Integration Settings Card */}
        <section id="settings-ad-accounts" aria-labelledby="settings-ad-accounts-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 id="settings-ad-accounts-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide">Marketing Ad Account Insights</h2>
              <p className="text-xs text-slate-400">Connect your Facebook (Meta) and TikTok Advertiser ad accounts to sync daily campaign spend, clicks, and impressions.</p>
            </div>
          </div>

          <form onSubmit={handleConnectAdAccount} autoComplete="off" className="space-y-4 p-4 rounded-lg border border-slate-200 bg-slate-50/50">
            <h4 className="font-bold text-xs text-indigo-600 uppercase tracking-wider pb-2 border-b border-slate-100">
              Connect Ad Account
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Platform</label>
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
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                  {adPlatform === 'meta' ? 'Meta Act ID (e.g. act_123456)' : 'TikTok Advertiser ID'}
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
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Account Display Name</label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Access Token</label>
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

              {adPlatform === 'tiktok' ? (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Refresh Token (Optional)</label>
                  <input
                    type="password"
                    placeholder="TikTok OAuth Refresh Token"
                    value={adRefreshToken}
                    onChange={(e) => setAdRefreshToken(e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <div className="flex items-end text-[10px] text-slate-400 pb-2">
                  Meta Graph API uses a permanent system user access token.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Account Currency</label>
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
                <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Account Timezone</label>
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
                  {savingAdAccount ? 'Connecting...' : 'Connect Account'}
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
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
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
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            account.platform === 'meta' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-900 text-white border border-slate-900'
                          }`}>
                            {account.platform}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{account.account_name || 'Unnamed Account'}</span>
                            <span className="font-mono text-[10px] text-slate-400">{account.external_account_id}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="text-[10px] font-medium text-slate-500">
                            {account.account_currency} · {account.account_timezone}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="text-[10px] text-slate-500">
                            {account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'Never'}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle text-right">
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

        {/* Courier Settings Panel */}
        <section id="settings-courier" aria-labelledby="settings-courier-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6  ">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 id="settings-courier-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Courier Integration Credentials</h2>
              <p className="text-xs text-slate-400 ">Configure courier API settings for Pathao, SteadFast, and RedX.</p>
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
                <span className="ml-2 text-[10px] font-semibold text-slate-500 uppercase ">
                  Auto-Book Courier: {courierSettings.courier_auto_send ? 'On' : 'Off'}
                </span>
              </label>
            </div>
          </div>
          {!growthFeaturesEnabled && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700   ">
              Free plan includes manual courier booking. Auto-booking and automatic delivery Purchase sync require an active Growth trial or paid plan.
            </p>
          )}
          {courierSettings.courier_auto_send && courierMissingCredentials.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
              <p className="font-bold">{courierProviderLabel} credentials missing</p>
              <p className="mt-1 leading-relaxed">
                {courierProviderLabel} is selected, but {courierMissingCredentials.join(', ')} {courierMissingCredentials.length === 1 ? 'is' : 'are'} missing.
                {' '}Auto-booking will be skipped until the missing keys are added.
              </p>
            </div>
          )}

          {loadingCourier ? (
            <div className="flex items-center justify-center py-6 text-slate-400 gap-2">
              <span className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
              <span>Loading configurations...</span>
            </div>
          ) : (
            <form onSubmit={handleSaveCourierSettings} autoComplete="off" className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* SteadFast section */}
                <div className="p-4 rounded-lg border border-slate-200  bg-slate-50/50  space-y-4">
                  <h4 className="font-bold text-xs text-indigo-600  uppercase tracking-wider pb-2 border-b border-slate-100 ">
                    SteadFast Courier API
                  </h4>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">SteadFast API Key</label>
                    <input 
                      type="text"
                      name="buykori-steadfast-api-key"
                      autoComplete="off"
                      value={courierSettings.steadfast_api_key || ''}
                      onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, steadfast_api_key: e.target.value }))}
                      placeholder="Enter SteadFast Api-Key"
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">SteadFast Secret Key</label>
                    <input 
                      type="password"
                      name="buykori-steadfast-secret-key"
                      autoComplete="new-password"
                      value={courierSettings.steadfast_secret_key || ''}
                      onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, steadfast_secret_key: e.target.value }))}
                      placeholder="Paste SteadFast Secret Key"
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                    />
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3  ">
                    <p className="text-[10px] font-semibold uppercase text-slate-500 ">SteadFast Webhook Setup</p>
                    <p className="mt-1 text-[10px] text-slate-500 ">Copy callback URL and bearer auth token for the SteadFast panel.</p>
                    <button type="button" onClick={() => handleCopyCourierWebhookSetup('steadfast')} disabled={copyingCourierSecret === 'steadfast'} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                      <Copy className="h-3.5 w-3.5" />
                      {copyingCourierSecret === 'steadfast' ? 'Preparing...' : courierSettings.steadfast_webhook_token_configured ? 'Copy Setup Again' : 'Copy Setup Secret'}
                    </button>
                  </div>
                </div>

                {/* Pathao section */}
                <div className="p-4 rounded-lg border border-slate-200  bg-slate-50/50  space-y-4">
                  <h4 className="font-bold text-xs text-indigo-600  uppercase tracking-wider pb-2 border-b border-slate-100 ">
                    Pathao Courier API
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">
                        Pathao Client ID
                      </label>
                      <input
                        type="text"
                        name="buykori-pathao-client-id"
                        autoComplete="off"
                        value={courierSettings.pathao_client_id || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_client_id: e.target.value }))}
                        placeholder="Client ID"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">
                        Store Owner Email
                      </label>
                      <input
                        type="email"
                        name="buykori-pathao-owner-email"
                        autoComplete="off"
                        value={courierSettings.pathao_email || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_email: e.target.value }))}
                        placeholder="owner@example.com"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">
                        Pathao Client Secret
                      </label>
                      <input
                        type="password"
                        name="buykori-pathao-client-secret"
                        autoComplete="new-password"
                        value={courierSettings.pathao_client_secret || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_client_secret: e.target.value }))}
                        placeholder="Paste Pathao Client Secret"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">
                        Store Password
                      </label>
                      <input
                        type="password"
                        name="buykori-pathao-store-password"
                        autoComplete="new-password"
                        value={courierSettings.pathao_password || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_password: e.target.value }))}
                        placeholder="Paste Pathao Store Password"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="pathao-environment" className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Pathao Environment</label>
                      <select
                        id="pathao-environment"
                        value={courierSettings.pathao_environment || 'live'}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_environment: e.target.value }))}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      >
                        <option value="live">Live</option>
                        <option value="sandbox">Sandbox / Test</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Pathao Store ID</label>
                      <input
                        type="text"
                        value={courierSettings.pathao_store_id || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, pathao_store_id: e.target.value }))}
                        placeholder="Store ID"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3  ">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold uppercase text-slate-500 ">Pathao Webhook Setup Secret</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500 ">
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
                <div className="p-4 rounded-lg border border-slate-200  bg-slate-50/50  space-y-4 md:col-span-2">
                  <h4 className="font-bold text-xs text-indigo-600  uppercase tracking-wider pb-2 border-b border-slate-100 ">
                    RedX Courier API
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">RedX Access Token</label>
                      <input
                        type="password"
                        name="buykori-redx-access-token"
                        autoComplete="new-password"
                        value={courierSettings.redx_access_token || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, redx_access_token: e.target.value }))}
                        placeholder="Paste RedX OpenAPI token"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Default Pickup Store ID (Optional)</label>
                      <input
                        type="text"
                        value={courierSettings.redx_pickup_store_id || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, redx_pickup_store_id: e.target.value }))}
                        placeholder="e.g. 1"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Default Delivery Area ID</label>
                      <input
                        type="text"
                        value={courierSettings.redx_delivery_area_id || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, redx_delivery_area_id: e.target.value }))}
                        placeholder="e.g. 12"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500  uppercase mb-1">Default Delivery Area Name</label>
                      <input
                        type="text"
                        value={courierSettings.redx_delivery_area_name || ''}
                        onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, redx_delivery_area_name: e.target.value }))}
                        placeholder="e.g. Mirpur DOHS"
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3  ">
                    <p className="text-[10px] font-semibold uppercase text-slate-500 ">RedX Webhook Setup</p>
                    <p className="mt-1 text-[10px] text-slate-500 ">Copy the callback URL with its dedicated token and paste it into RedX.</p>
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
                  <label htmlFor="default-courier-provider" className="block text-[10px] font-bold text-slate-500  uppercase tracking-wider mb-1.5">Default Courier Provider</label>
                  <select 
                    id="default-courier-provider"
                    value={courierSettings.default_courier || 'steadfast'}
                    onChange={(e) => setCourierSettings((prev: any) => ({ ...prev, default_courier: e.target.value }))}
                    className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500    cursor-pointer"
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
        </section>

        {/* WordPress Custom tracking rules */}
        <section id="settings-cod" aria-labelledby="settings-cod-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 id="settings-cod-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">COD Purchase Timing</h2>
              <p className="text-xs text-slate-400 ">
                Portal-managed source of truth for deferred Purchase events. The WordPress plugin sends the order signal, then this portal decides whether COD orders wait for verification.
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              deferredEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}>
              {deferredEnabled ? 'Protection on' : 'Protection off'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Purchase timing</p>
              <p className="mt-1 text-sm font-black text-slate-900">{deferredEnabled ? 'Hold for verification' : 'Immediate send'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Auto-confirm</p>
              <p className="mt-1 text-sm font-black text-slate-900">{autoConfirmLabel}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm status</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formattedConfirmStatus}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-relaxed">
              Need to change COD verification, auto-confirm timing, or manually confirm held orders? Use the dedicated COD Protection workflow.
            </p>
            <button
              type="button"
              onClick={() => onOpenPage?.('pending-purchases')}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!onOpenPage}
            >
              Open COD Protection
            </button>
          </div>
        </section>

        <section id="settings-routing" aria-labelledby="settings-routing-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 id="settings-routing-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">WordPress event routing rules</h2>
              <p className="text-xs text-slate-400 ">This is the source of truth for plugin event delivery. Keep active routes short, then choose which platforms receive each event.</p>
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
              <p className="text-[10px] leading-normal text-slate-400 ">
                Custom names can use letters, numbers, and underscores. WordPress must fire the same event name.
              </p>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {rules.map((rule, idx) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4  ">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-slate-900 ">{rule.eventName}</p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <label className="rounded-lg bg-slate-50 p-2 ">
                    <span className="block">Meta</span>
                    <input type="checkbox" checked={rule.metaEnabled} onChange={() => handleToggleRule(idx, 'metaEnabled')} className="mt-2 h-4 w-4 rounded accent-indigo-600" />
                  </label>
                  <label className="rounded-lg bg-slate-50 p-2 ">
                    <span className="block">TikTok</span>
                    <input type="checkbox" checked={rule.tiktokEnabled} onChange={() => handleToggleRule(idx, 'tiktokEnabled')} className="mt-2 h-4 w-4 rounded accent-indigo-600" />
                  </label>
                  <label className="rounded-lg bg-slate-50 p-2 ">
                    <span className="block">GA4</span>
                    <input type="checkbox" checked={rule.ga4Enabled} onChange={() => handleToggleRule(idx, 'ga4Enabled')} className="mt-2 h-4 w-4 rounded accent-indigo-600" />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-xs text-slate-600 text-left min-w-[760px] ">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100   ">
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
                          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-500 ">Custom / optional route</span>
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
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-350 ">Core</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="settings-custom-automations" aria-labelledby="settings-custom-automations-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 id="settings-custom-automations-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide">Custom event automations</h2>
              <p className="text-xs text-slate-400">Create no-code browser triggers from the portal. WordPress will sync these rules and fire matching event routes.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addAutomationDraft}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Add automation
              </button>
              <button
                type="button"
                onClick={saveAutomationDrafts}
                disabled={savingAutomations}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingAutomations ? 'Saving...' : 'Save automations'}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            Example: <b>Stay15Seconds</b> + Timer 15 sec, or <b>WhatsAppClick</b> + Click selector <code className="font-mono">.whatsapp-btn</code>. Saving also adds the event route if it is missing.
          </div>

          {automationDrafts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              No custom automations yet. Add one when you need timer, click, URL, or form-based custom events.
            </div>
          ) : (
            <div className="space-y-3">
              {automationDrafts.map((automation, index) => (
                <div key={automation.id || index} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_150px_1fr_auto]">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Event name
                      <input
                        type="text"
                        value={automation.name}
                        onChange={(e) => updateAutomationDraft(index, { name: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
                        placeholder="Stay15Seconds"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
                      </select>
                    </label>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {automation.trigger === 'timer' ? 'Seconds' : automation.trigger === 'url' ? 'URL contains' : 'CSS selector'}
                      <input
                        type={automation.trigger === 'timer' ? 'number' : 'text'}
                        min={1}
                        max={3600}
                        value={automation.trigger === 'url' ? automation.url_pattern : automation.trigger === 'timer' ? (automation.seconds || automation.selector || 15) : automation.selector}
                        onChange={(e) => {
                          if (automation.trigger === 'url') {
                            updateAutomationDraft(index, { url_pattern: e.target.value });
                          } else if (automation.trigger === 'timer') {
                            const seconds = Number.parseInt(e.target.value, 10) || 15;
                            updateAutomationDraft(index, { seconds, selector: String(seconds) });
                          } else {
                            updateAutomationDraft(index, { selector: e.target.value });
                          }
                        }}
                        placeholder={automation.trigger === 'url' ? '/thank-you' : automation.trigger === 'timer' ? '15' : '.button-class'}
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
                        title="Remove automation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Value
                      <input
                        type="number"
                        value={automation.value || 0}
                        onChange={(e) => updateAutomationDraft(index, { value: Number.parseFloat(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Currency
                      <input
                        type="text"
                        value={automation.currency || 'BDT'}
                        onChange={(e) => updateAutomationDraft(index, { currency: e.target.value.toUpperCase() })}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </label>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
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
      </div>

      {/* Left side parameters / WordPress connection */}
      <div className="space-y-6">
        
        {/* WordPress token health status */}
        <section id="settings-wordpress" aria-labelledby="settings-wordpress-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div>
            <h2 id="settings-wordpress-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">WordPress Plugin Connection</h2>
            <p className="text-xs text-slate-400 ">Your WooCommerce plugin sends tracking data through this connection. Platform credentials and delivery rules stay managed in the portal.</p>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200   space-y-3 font-mono text-xs text-slate-700 ">
            <div>
              <span className="block text-[9px] font-semibold text-slate-400  uppercase tracking-wider mb-0.5">API Access Key</span>
              <div className="flex items-center gap-2 bg-white  px-2 py-1.5 rounded border border-slate-200 ">
                <span className="truncate" aria-label="Masked API access key">{maskedApiAccessKey}</span>
                <button 
                  type="button"
                  onClick={() => handleCopy(apiAccessKey, 'sett_wp_tok')}
                  disabled={!apiAccessKey}
                  className="text-slate-400 hover:text-slate-600 ml-auto shrink-0 cursor-pointer"
                  title="Copy API access key"
                >
                  {copiedStates['sett_wp_tok'] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="block text-[9px] text-slate-400  uppercase mb-0.5">Plugin detected version</span>
                <span className="font-semibold text-slate-800 ">{pluginVersionStatus}</span>
                {!installedVersionReported && connection.wpVersion ? (
                  <span className="mt-0.5 block text-[9px] text-slate-400">{pluginVersionHelp}</span>
                ) : null}
              </div>
              <div>
                <span className="block text-[9px] text-slate-400  uppercase mb-0.5">Last query heartbeat</span>
                <span className="font-semibold text-slate-800 ">{new Date(connection.lastHeartbeat).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs  ">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 ">Latest plugin package</p>
                <p className="mt-1 font-semibold text-slate-800 ">
                  {pluginReleaseInfo ? `v${pluginReleaseInfo.version}` : 'Checking release...'}
                </p>
                {pluginReleaseInfo && (
                  <p className="mt-0.5 text-[10px] text-slate-500 ">
                    WordPress {pluginReleaseInfo.requires}+ / PHP {pluginReleaseInfo.requires_php}+ / {packageSizeKb} KB
                  </p>
                )}
              </div>
              <span className={
                !installedVersionReported
                  ? 'shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500   '
                  : updateAvailable
                  ? 'shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700   '
                  : pluginReleaseInfo?.package_available
                    ? 'shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700   '
                    : 'shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500   '
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
              showToast("Pinging WordPress plugin...", false);
              refreshWPHeartbeat()
                .then(() => showToast("WordPress connection is active.", false))
                .catch(() => showToast("Failed to ping WordPress plugin.", true));
            }}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors border border-indigo-700/20 cursor-pointer  "
          >
            Test WordPress Connection
          </button>
        </section>

        {/* WhatsApp Notification Settings Card */}
        <section id="settings-whatsapp" aria-labelledby="settings-whatsapp-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div>
            <h2 id="settings-whatsapp-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">WhatsApp Notifications</h2>
            <p className="text-xs text-slate-400  leading-normal">Receive purchase alerts and incomplete checkout recovery details on your WhatsApp number. Sender accounts are managed by Buykori admin.</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-slate-700">Enable WhatsApp Alerts</span>
                <span className="block text-[11px] text-slate-400">Send automatic alerts to WhatsApp number.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={profNotifyWhatsapp}
                  onChange={(e) => setProfNotifyWhatsapp(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
              <p className="font-bold">For smooth WhatsApp notifications</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-sky-900">
                <li>Save the Buykori WhatsApp number that sends your notifications to your contacts using any name.</li>
                <li>Open that contact in WhatsApp and send one message such as "Hi", "Hello", or "Start".</li>
              </ol>
              <p className="mt-2 text-[10px] leading-relaxed text-sky-700">
                These steps help WhatsApp recognize the conversation and improve reliable notification delivery.
              </p>
            </div>

            {profNotifyWhatsapp && (
              <div className="animate-fadeIn transition-all space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">WhatsApp Number (with Country Code)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 88017XXXXXXXX"
                    value={profWhatsappNumber}
                    onChange={(e) => setProfWhatsappNumber(e.target.value)}
                    className="w-full p-2 text-xs bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div className="hidden rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950">
                  <p className="font-bold">For smooth WhatsApp notifications</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] leading-relaxed text-sky-900">
                    <li>Save the Buykori WhatsApp number that sends your notifications to your contacts using any name.</li>
                    <li>Open that contact in WhatsApp and send one message such as “Hi”, “Hello”, or “Start”.</li>
                  </ol>
                  <p className="mt-2 text-[10px] leading-relaxed text-sky-700">
                    These steps help WhatsApp recognize the conversation and improve reliable notification delivery.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 text-right">
              <button 
                type="button"
                onClick={submitProfileSave}
                disabled={profUpdating}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                {profUpdating ? 'Saving...' : 'Save WhatsApp Settings'}
              </button>
            </div>
          </div>
        </section>

      </div>
      </div>
    </div>
  );
}
