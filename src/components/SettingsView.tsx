import React, { useState, useEffect } from 'react';
import { Globe2, Send, Truck, Zap } from 'lucide-react';
import { AdAccount, Platform, PlatformConfig, EventRule, ClientConnection, PluginReleaseInfo, CustomEventAutomation, CourierSettings } from '../types';
import StoreDomainSection from './settings/StoreDomainSection';
import AdPlatformsSection from './settings/AdPlatformsSection';
import AdAccountsSection from './settings/AdAccountsSection';
import CourierSection from './settings/CourierSection';
import CodTimingSection from './settings/CodTimingSection';
import EventRoutingSection from './settings/EventRoutingSection';
import CustomAutomationsSection from './settings/CustomAutomationsSection';
import WordPressSection from './settings/WordPressSection';
import TelegramAlertsSection, { TelegramLinkCode, TelegramNotificationStatus } from './settings/TelegramAlertsSection';

interface SettingsViewProps {
  initialSectionId?: string | null;
  credentials: Record<Platform, PlatformConfig>;
  connection: ClientConnection;
  rules: EventRule[];
  customEventAutomations: CustomEventAutomation[];
  handleUpdatePlatform: (platform: Platform, fields: Partial<PlatformConfig>) => Promise<void>;
  handleToggleRule: (index: number, channel: 'metaEnabled' | 'tiktokEnabled' | 'ga4Enabled') => Promise<void>;
  handleAddRule: (eventName: string) => Promise<void>;
  handleRemoveRule: (index: number) => Promise<void>;
  handleApplyEventPreset: (preset: string) => Promise<boolean>;
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
}

export function SettingsView({
  initialSectionId,
  credentials,
  connection,
  rules,
  customEventAutomations,
  handleUpdatePlatform,
  handleToggleRule,
  handleAddRule,
  handleRemoveRule,
  handleApplyEventPreset,
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
  onOpenPage
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
  const [eventPresets, setEventPresets] = useState<Array<{ id: string; name: string; description: string; events: string[] }>>([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<TelegramNotificationStatus | null>(null);
  const [telegramLinkCode, setTelegramLinkCode] = useState<TelegramLinkCode | null>(null);
  const [telegramBusy, setTelegramBusy] = useState(false);

  const loadTelegramStatus = async (quiet = false) => {
    try {
      const response = await fetch('/api/client/telegram-notifications');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not load Telegram notification status.');
      setTelegramStatus(data);
      if (data.connected) setTelegramLinkCode(null);
      return Boolean(data.connected);
    } catch (error) {
      if (!quiet) showToast(error instanceof Error ? error.message : 'Could not load Telegram status.', true);
      return false;
    }
  };

  const generateTelegramLinkCode = async () => {
    setTelegramBusy(true);
    try {
      const response = await fetch('/api/client/telegram-notifications/link-code', { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not generate Telegram security code.');
      setTelegramLinkCode(data);
      showToast('Secure Telegram code generated.', false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not generate Telegram code.', true);
    } finally {
      setTelegramBusy(false);
    }
  };

  const disconnectTelegram = async () => {
    if (!window.confirm('Disconnect Telegram alerts for this store?')) return;
    setTelegramBusy(true);
    try {
      const response = await fetch('/api/client/telegram-notifications', { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not disconnect Telegram.');
      await loadTelegramStatus(true);
      showToast('Telegram notifications disconnected.', false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not disconnect Telegram.', true);
    } finally {
      setTelegramBusy(false);
    }
  };

  useEffect(() => {
    loadTelegramStatus(true);
  }, []);

  useEffect(() => {
    if (!telegramLinkCode || telegramStatus?.connected) return undefined;
    const timer = window.setInterval(() => loadTelegramStatus(true), 3000);
    return () => window.clearInterval(timer);
  }, [telegramLinkCode, telegramStatus?.connected]);

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
        { id: 'settings-domain', label: 'Website address' },
        { id: 'settings-wordpress', label: 'WordPress connection' },
      ],
    },
    {
      id: 'conversions',
      label: 'Conversions API',
      sections: [
        { id: 'settings-platforms', label: 'Ad platforms' },
        { id: 'settings-cod', label: 'COD timing' },
        { id: 'settings-routing', label: 'Events to send' },
        { id: 'settings-custom-automations', label: 'Custom events' },
      ],
    },
    {
      id: 'ads',
      label: 'Ad Accounts',
      sections: [
        { id: 'settings-ad-accounts', label: 'Connected accounts' },
      ],
    },
    {
      id: 'courier',
      label: 'Courier & Alerts',
      sections: [
        { id: 'settings-courier', label: 'Courier accounts' },
        { id: 'settings-whatsapp', label: 'Telegram alerts' },
      ],
    },
  ];
  const tabIdForSection = (sectionId?: string | null) => (
    settingsTabs.find(tab => tab.sections.some(section => section.id === sectionId))?.id || 'store'
  );
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>(() => tabIdForSection(initialSectionId));
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
      : 'Waiting for WordPress to connect';
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

  const openSettingsTab = (tabId: string) => {
    setActiveSettingsTab(tabId);
    const sectionId = settingsTabs.find(tab => tab.id === tabId)?.sections[0]?.id;
    if (!sectionId) return;
    window.dispatchEvent(new CustomEvent('buykori:page-section', {
      detail: { pageId: 'settings', sectionId }
    }));
  };

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

  useEffect(() => {
    fetch('/api/event-presets')
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setEventPresets(Array.isArray(data.presets) ? data.presets : []))
      .catch(() => setEventPresets([]));
  }, []);

  useEffect(() => {
    if (!initialSectionId) return;
    setActiveSettingsTab(tabIdForSection(initialSectionId));
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        document.getElementById(initialSectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    });
  }, [initialSectionId]);

  const applySelectedPreset = async () => {
    if (!selectedPreset) return;
    setApplyingPreset(true);
    try {
      const applied = await handleApplyEventPreset(selectedPreset);
      if (applied) setSelectedPreset('');
    } finally {
      setApplyingPreset(false);
    }
  };

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
  const [courierSettings, setCourierSettings] = useState<CourierSettings>({
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
  const [enabledCouriers, setEnabledCouriers] = useState({
    steadfast: true,
    pathao: false,
    redx: false,
  });
  const [loadingCourier, setLoadingCourier] = useState<boolean>(false);
  const [savingCourier, setSavingCourier] = useState<boolean>(false);
  const [copyingPathaoSecret, setCopyingPathaoSecret] = useState<boolean>(false);
  const [copyingCourierSecret, setCopyingCourierSecret] = useState<string>('');
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loadingAdAccounts, setLoadingAdAccounts] = useState<boolean>(false);
  const [savingAdAccount, setSavingAdAccount] = useState<boolean>(false);
  const [deletingAdAccountId, setDeletingAdAccountId] = useState<number | null>(null);
  const [syncingAdAccountId, setSyncingAdAccountId] = useState<number | null>(null);

  // Form states for ad accounts
  const [adPlatform, setAdPlatform] = useState<'meta' | 'tiktok'>('meta');
  const [adAccountId, setAdAccountId] = useState<string>('');
  const [adAccountName, setAdAccountName] = useState<string>('');
  const [adAccessToken, setAdAccessToken] = useState<string>('');
  const [adCurrency, setAdCurrency] = useState<string>('USD');
  const [adTimezone, setAdTimezone] = useState<string>('Asia/Dhaka');
  const [discoveredMetaAccounts, setDiscoveredMetaAccounts] = useState<Array<{
    external_account_id: string;
    account_name: string;
    account_status: number | null;
    account_currency: string;
    account_timezone: string;
  }>>([]);
  const [discoveringMetaAccounts, setDiscoveringMetaAccounts] = useState<boolean>(false);

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
          account_currency: adCurrency,
          account_timezone: adTimezone
        })
      });
      if (res.ok) {
        showToast("Ad account verified and connected successfully.", false);
        setAdAccountId('');
        setAdAccountName('');
        setAdAccessToken('');
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
      courier_auto_send: false,
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
      setCourierSettings((prev) => ({
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
      setCourierSettings((prev) => ({
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
  const platformCredentialHelp = (platform: Platform) => {
    if (platform === 'Meta CAPI') {
      return {
        destination: 'Meta Events Manager -> Data Sources -> select your Pixel -> copy the numeric Pixel ID.',
        token: 'In the same Pixel -> Settings -> Conversions API, generate an access token. This is the event-delivery token, not the advertising-report token.'
      };
    }
    if (platform === 'TikTok Events API') {
      return {
        destination: 'TikTok Events Manager -> Web Events -> select your Pixel -> copy the Pixel ID.',
        token: 'Open that Pixel\'s Events API settings and create/copy its Events API access token. This is different from a TikTok Ads reporting token.'
      };
    }
    return {
      destination: 'Google Analytics -> Admin -> Data streams -> select your web stream -> copy the Measurement ID (starts with G-).',
      token: 'Google Analytics -> Admin -> Data streams -> select the same stream -> Measurement Protocol API secrets -> Create. Paste the API secret here.'
    };
  };
  const platformMissingCredentials = (platform: Platform, config?: PlatformConfig) => {
    const destination = String(config?.pixelIdOrMeasurementId || '').trim();
    const token = String(config?.accessToken || '').trim();
    const missing = [];
    if (!destination || destination === '0') missing.push(platformDestinationLabel(platform));
    if (!token) missing.push(platformTokenLabel(platform));
    return missing;
  };

  const handleDiscoverMetaAccounts = async () => {
    if (!adAccessToken.trim()) {
      showToast("Paste your Meta reporting token first, then choose the ad account from the list.", true);
      return;
    }
    setDiscoveringMetaAccounts(true);
    try {
      const res = await fetch('/api/v1/ad-accounts/discover/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: adAccessToken.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(typeof data.detail === 'string' ? data.detail : "Could not list Meta ad accounts.", true);
        return;
      }
      setDiscoveredMetaAccounts(Array.isArray(data) ? data : []);
      if (!data.length) {
        showToast("This token cannot access any Meta ad accounts yet.", true);
      }
    } catch (err) {
      showToast("Could not list Meta ad accounts. Please try again.", true);
    } finally {
      setDiscoveringMetaAccounts(false);
    }
  };

  const handleSelectDiscoveredMetaAccount = (externalAccountId: string) => {
    const selected = discoveredMetaAccounts.find((account) => account.external_account_id === externalAccountId);
    if (!selected) return;
    setAdAccountId(selected.external_account_id);
    setAdAccountName(selected.account_name);
    setAdCurrency(selected.account_currency || 'USD');
    setAdTimezone(selected.account_timezone || 'UTC');
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

  const handleSyncAdAccount = async (id: number) => {
    setSyncingAdAccountId(id);
    try {
      const res = await fetch(`/api/v1/ad-accounts/${id}/sync`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(typeof data.detail === 'string' ? data.detail : "Ad account sync failed.", true);
        return;
      }
      const count = Number(data.synced_rows || 0);
      showToast(
        count > 0
          ? `Synced ${count} campaign insight rows.`
          : "Sync completed. No campaign data was available for the last 7 days.",
        false,
      );
      await fetchAdAccounts();
    } catch (err) {
      showToast("Could not reach the ad account sync service.", true);
    } finally {
      setSyncingAdAccountId(null);
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
  const disabledRouteCount = Math.max(0, rules.length - enabledRouteCount);
  const routeStateByName = new Map(
    rules.map(rule => [
      rule.eventName.toLowerCase(),
      {
        exists: true,
        enabled: Boolean(rule.metaEnabled || rule.tiktokEnabled || rule.ga4Enabled),
      }
    ])
  );
  const automationRouteState = (automation: CustomEventAutomation) => {
    const eventName = String(automation.name || '').trim().toLowerCase();
    if (!eventName) return { label: 'Add an event name', className: 'border-amber-200 bg-amber-50 text-amber-700' };
    const state = routeStateByName.get(eventName);
    if (!state) return { label: 'Will be added when you save', className: 'border-blue-200 bg-blue-50 text-blue-700' };
    if (!state.enabled) return { label: 'Off - this event will not run', className: 'border-rose-200 bg-rose-50 text-rose-700' };
    return { label: 'On and ready', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  };
  const automationTriggerHelp = (automation: CustomEventAutomation) => {
    if (automation.trigger === 'timer') return 'Runs once after a visitor stays for this many seconds.';
    if (automation.trigger === 'click') return 'Runs when a visitor clicks the chosen button or link.';
    if (automation.trigger === 'form') return 'Runs when a visitor sends the chosen form.';
    if (automation.trigger === 'scroll') return 'Runs once when a visitor scrolls this far down the page.';
    if (automation.trigger === 'visible') return 'Runs once when the chosen part of the page appears on screen.';
    return 'Runs when the page address contains this text.';
  };
  const selectedCourierProvider = String(courierSettings.default_courier || 'steadfast').toLowerCase();
  const courierProviderConfigured =
    selectedCourierProvider === 'pathao'
      ? Boolean(courierSettings.pathao_client_id && courierSettings.pathao_client_secret && courierSettings.pathao_password && courierSettings.pathao_store_id)
      : selectedCourierProvider === 'redx'
        ? Boolean(courierSettings.redx_access_token)
        : Boolean(courierSettings.steadfast_api_key && courierSettings.steadfast_secret_key);
  const telegramStatusLabel = telegramStatus?.connected
    ? 'Connected'
    : telegramStatus?.available === false
      ? 'Unavailable'
      : 'Needs setup';
  const autoConfirmLabel = autoConfirmDays > 0
    ? `${autoConfirmDays} day${autoConfirmDays === 1 ? '' : 's'} after order hold`
    : 'Manual confirmation only';
  const formattedConfirmStatus = autoConfirmStatus
    ? autoConfirmStatus.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    : 'Completed';

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Configure tracking, integrations and alerts for {storeDomain || 'your store'}.</p>
      </header>

      <section className="w-fit max-w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <div className="flex gap-1 overflow-x-auto">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => openSettingsTab(tab.id)}
              className={`min-h-10 min-w-fit rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
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
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => openSettingsTab('conversions')}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-200"
            >
              <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                Events routing <Zap className="h-4 w-4 text-emerald-500" />
              </span>
              <p className="mt-4 text-base font-bold text-slate-900">{configuredPlatformCount} / {platformStatusRows.length} ready</p>
              <p className="mt-1 text-xs text-slate-500">{enabledPlatformCount} platforms · {enabledRouteCount} events on</p>
            </button>
            <button
              type="button"
              onClick={() => openSettingsTab('courier')}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-200"
            >
              <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                Courier setup <Truck className="h-4 w-4 text-amber-500" />
              </span>
              <p className="mt-4 text-base font-bold text-slate-900">{courierProviderConfigured ? 'Ready' : 'Setup needed'}</p>
              <p className="mt-1 text-xs capitalize text-slate-500">{selectedCourierProvider} default · manual booking</p>
            </button>
            <button
              type="button"
              onClick={() => openSettingsTab('courier')}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-200"
            >
              <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                Telegram alerts <Send className="h-4 w-4 text-emerald-500" />
              </span>
              <p className="mt-4 text-base font-bold text-slate-900">{telegramStatusLabel}</p>
              <p className="mt-1 text-xs text-slate-500">Private order and recovery alerts</p>
            </button>
            <button
              type="button"
              onClick={() => openSettingsTab('store')}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-indigo-200"
            >
              <span className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                WordPress plugin <Globe2 className="h-4 w-4 text-emerald-500" />
              </span>
              <p className="mt-4 text-base font-bold text-slate-900">{pluginVersionStatus}</p>
              <p className="mt-1 text-xs text-slate-500">{updateAvailable ? 'Plugin update available' : pluginVersionHelp}</p>
            </button>
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
        <StoreDomainSection
          storeDomain={storeDomain}
          localStoreDomain={localStoreDomain}
          setLocalStoreDomain={setLocalStoreDomain}
          saveStoreDomain={saveStoreDomain}
          savingStoreDomain={savingStoreDomain}
        />

        <AdPlatformsSection
          credentials={credentials}
          configuredPlatformCount={configuredPlatformCount}
          platformCount={platformStatusRows.length}
          localPixelIds={localPixelIds}
          setLocalPixelIds={setLocalPixelIds}
          localTokens={localTokens}
          setLocalTokens={setLocalTokens}
          localTestCodes={localTestCodes}
          setLocalTestCodes={setLocalTestCodes}
          handleUpdatePlatform={handleUpdatePlatform}
          platformDestinationLabel={platformDestinationLabel}
          platformTokenLabel={platformTokenLabel}
          platformCredentialHelp={platformCredentialHelp}
          platformMissingCredentials={platformMissingCredentials}
        />

        {/* Ad Sync Integration Settings Card */}
        <AdAccountsSection
          adPlatform={adPlatform}
          setAdPlatform={setAdPlatform}
          adAccountId={adAccountId}
          setAdAccountId={setAdAccountId}
          adAccountName={adAccountName}
          setAdAccountName={setAdAccountName}
          adAccessToken={adAccessToken}
          setAdAccessToken={setAdAccessToken}
          adCurrency={adCurrency}
          setAdCurrency={setAdCurrency}
          adTimezone={adTimezone}
          setAdTimezone={setAdTimezone}
          savingAdAccount={savingAdAccount}
          handleConnectAdAccount={handleConnectAdAccount}
          discoveringMetaAccounts={discoveringMetaAccounts}
          discoveredMetaAccounts={discoveredMetaAccounts}
          handleDiscoverMetaAccounts={handleDiscoverMetaAccounts}
          handleSelectDiscoveredMetaAccount={handleSelectDiscoveredMetaAccount}
          loadingAdAccounts={loadingAdAccounts}
          adAccounts={adAccounts}
          syncingAdAccountId={syncingAdAccountId}
          deletingAdAccountId={deletingAdAccountId}
          handleSyncAdAccount={handleSyncAdAccount}
          handleDisconnectAdAccount={handleDisconnectAdAccount}
        />

        {/* Masterwork Courier & Logistics Settings Panel */}
        <CourierSection
          enabledCouriers={enabledCouriers}
          setEnabledCouriers={setEnabledCouriers}
          courierSettings={courierSettings}
          setCourierSettings={setCourierSettings}
          loadingCourier={loadingCourier}
          savingCourier={savingCourier}
          handleSaveCourierSettings={handleSaveCourierSettings}
          copyingCourierSecret={copyingCourierSecret}
          handleCopyCourierWebhookSetup={handleCopyCourierWebhookSetup}
          copyingPathaoSecret={copyingPathaoSecret}
          handleCopyPathaoWebhookSecret={handleCopyPathaoWebhookSecret}
        />

        {/* WordPress Custom tracking rules */}
        <CodTimingSection
          deferredEnabled={deferredEnabled}
          autoConfirmLabel={autoConfirmLabel}
          formattedConfirmStatus={formattedConfirmStatus}
          onOpenPage={onOpenPage}
        />

        <EventRoutingSection
          rules={rules}
          handleToggleRule={handleToggleRule}
          handleRemoveRule={handleRemoveRule}
          coreEventRoutes={coreEventRoutes}
          enabledRouteCount={enabledRouteCount}
          disabledRouteCount={disabledRouteCount}
          selectedEventRoute={selectedEventRoute}
          setSelectedEventRoute={setSelectedEventRoute}
          customEventRoute={customEventRoute}
          setCustomEventRoute={setCustomEventRoute}
          isCustomRoute={isCustomRoute}
          routeToAdd={routeToAdd}
          submitEventRoute={submitEventRoute}
          availablePresetRoutes={availablePresetRoutes}
          eventPresets={eventPresets}
          selectedPreset={selectedPreset}
          setSelectedPreset={setSelectedPreset}
          applyingPreset={applyingPreset}
          applySelectedPreset={applySelectedPreset}
        />

        <CustomAutomationsSection
          automationDrafts={automationDrafts}
          savingAutomations={savingAutomations}
          addAutomationDraft={addAutomationDraft}
          saveAutomationDrafts={saveAutomationDrafts}
          updateAutomationDraft={updateAutomationDraft}
          removeAutomationDraft={removeAutomationDraft}
          automationTriggerHelp={automationTriggerHelp}
          automationRouteState={automationRouteState}
        />
      </div>

      {/* Left side parameters / WordPress connection */}
      <div className="space-y-6">
        
        {/* WordPress token health status */}
        <WordPressSection
          connection={connection}
          pluginReleaseInfo={pluginReleaseInfo}
          installedVersionReported={installedVersionReported}
          versionComparison={versionComparison}
          updateAvailable={updateAvailable}
          pluginVersionStatus={pluginVersionStatus}
          pluginVersionHelp={pluginVersionHelp}
          apiAccessKey={apiAccessKey}
          maskedApiAccessKey={maskedApiAccessKey}
          packageSizeKb={packageSizeKb}
          copiedStates={copiedStates}
          handleCopy={handleCopy}
          showToast={showToast}
          refreshWPHeartbeat={refreshWPHeartbeat}
        />

        {/* Telegram Notification Settings Card */}
        <TelegramAlertsSection
          telegramStatus={telegramStatus}
          telegramLinkCode={telegramLinkCode}
          telegramBusy={telegramBusy}
          handleCopy={handleCopy}
          loadTelegramStatus={loadTelegramStatus}
          generateTelegramLinkCode={generateTelegramLinkCode}
          disconnectTelegram={disconnectTelegram}
        />

      </div>
      </div>

    </div>
  );
}
