import React, { useState, useEffect } from 'react';
import { Check, Copy, Download, Globe2, MessageCircle, Plus, RefreshCw, Save, Trash2, Truck, X } from 'lucide-react';
import { Tooltip } from './common/Tooltip';
import { AdAccount, Platform, PlatformConfig, EventRule, ClientConnection, PluginReleaseInfo, CustomEventAutomation, CustomEventTrigger, CourierSettings } from '../types';

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
  profNotifyWhatsapp: boolean;
  setProfNotifyWhatsapp: (v: boolean) => void;
  profWhatsappNumber: string;
  setProfWhatsappNumber: (v: string) => void;
  profUpdating: boolean;
  submitProfileSave: (e: React.FormEvent) => Promise<boolean>;
}

interface WhatsAppSenderRecommendation {
  instanceId: number;
  instanceName: string;
  phoneNumber: string;
  assignedClients: number;
  capacity: number;
  availableSlots: number;
  currentAssignment: boolean;
}

interface TelegramNotificationStatus {
  available: boolean;
  connected: boolean;
  botUsername?: string | null;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  linkedAt?: string | null;
}

interface TelegramLinkCode {
  code: string;
  expiresAt: string;
  expiresInMinutes: number;
  botUsername?: string | null;
  botUrl?: string | null;
  deepLinkUrl?: string | null;
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
  const [eventPresets, setEventPresets] = useState<Array<{ id: string; name: string; description: string; events: string[] }>>([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [applyingPreset, setApplyingPreset] = useState(false);
  const [whatsappRecommendation, setWhatsappRecommendation] = useState<WhatsAppSenderRecommendation | null>(null);
  const [loadingWhatsappRecommendation, setLoadingWhatsappRecommendation] = useState(false);
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

  const submitEvent = () => ({ preventDefault: () => undefined } as React.FormEvent);

  const requestWhatsappSettingsSave = async () => {
    if (!profNotifyWhatsapp) {
      await submitProfileSave(submitEvent());
      return;
    }
    if (!profWhatsappNumber.trim()) {
      showToast('Enter the WhatsApp number that will receive your alerts.', true);
      return;
    }

    setLoadingWhatsappRecommendation(true);
    try {
      const response = await fetch('/api/client/notification-settings/recommendation');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not find an available WhatsApp sender.');
      if (!data.available || !data.sender) {
        throw new Error(data.message || 'No WhatsApp sender currently has an available slot.');
      }
      setWhatsappRecommendation(data.sender);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not prepare WhatsApp alerts.', true);
    } finally {
      setLoadingWhatsappRecommendation(false);
    }
  };

  const downloadWhatsappContact = () => {
    if (!whatsappRecommendation) return;
    const cleanPhone = whatsappRecommendation.phoneNumber.replace(/[^0-9+]/g, '');
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Buykori Order Alerts',
      'ORG:Buykori AdSync',
      `TEL;TYPE=CELL:+${cleanPhone.replace(/^\+/, '')}`,
      'END:VCARD',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([vcard], { type: 'text/vcard;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Buykori-Order-Alerts.vcf';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openWhatsappGreeting = () => {
    if (!whatsappRecommendation) return;
    const phone = whatsappRecommendation.phoneNumber.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent('Hi Buykori')}`, '_blank', 'noopener,noreferrer');
  };

  const confirmWhatsappSettingsSave = async () => {
    const saved = await submitProfileSave(submitEvent());
    if (saved) setWhatsappRecommendation(null);
  };
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
      label: 'Courier Logistics',
      sections: [
        { id: 'settings-courier', label: 'Courier accounts' },
      ],
    },
    {
      id: 'alerts',
      label: 'Alerts & Notifications',
      sections: [
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
  const wordpressConnectionStatus = connection.status === 'Active' && connection.bindingVerified
    ? 'Connected'
    : connection.reconnectRequired
      ? 'Reconnect required'
      : connection.status;
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
              onClick={() => openSettingsTab(tab.id)}
              className={`min-h-10 min-w-fit rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
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
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">Manage your store here</h2>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
                Change your tracking, courier, and alert settings here. The WordPress plugin will follow the choices you save on this page.
              </p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              WordPress stays simple
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => openSettingsTab('conversions')}
              className="rounded-lg border border-white bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Where events go</span>
              <p className="mt-1 text-lg font-black text-slate-900">{configuredPlatformCount}/{platformStatusRows.length} ready</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{enabledPlatformCount} platforms on, {enabledRouteCount} events ready</p>
            </button>
            <button
              type="button"
              onClick={() => openSettingsTab('courier')}
              className="rounded-lg border border-white bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Courier setup</span>
              <p className="mt-1 text-lg font-black text-slate-900">{courierProviderConfigured ? 'Ready' : 'Setup needed'}</p>
              <p className="mt-0.5 text-xs font-semibold capitalize text-slate-500">{selectedCourierProvider} default, manual booking</p>
            </button>
            <button
              type="button"
              onClick={() => openSettingsTab('alerts')}
              className="rounded-lg border border-white bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Telegram alerts</span>
              <p className="mt-1 text-lg font-black text-slate-900">{telegramStatusLabel}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">Get order alerts in Telegram</p>
            </button>
            <button
              type="button"
              onClick={() => openSettingsTab('store')}
              className="rounded-lg border border-white bg-white/90 p-3 text-left shadow-sm transition-colors hover:border-indigo-200 hover:bg-white"
            >
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Plugin connection</span>
              <p className="mt-1 text-lg font-black text-slate-900">{wordpressConnectionStatus}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{updateAvailable ? 'Plugin update available' : pluginVersionHelp}</p>
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
                <p className="text-xs text-slate-400 ">Enter the website address connected to this store.</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div>
              <label htmlFor="store-domain" className="block text-xs font-semibold text-slate-400 uppercase mb-1">Store Domain</label>
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
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:self-end  "
            >
              <Save className="h-3.5 w-3.5" />
              {savingStoreDomain ? 'Saving' : 'Save Domain'}
            </button>
          </div>
        </section>
        
        {/* Pipeline credentials card */}
        <section id="settings-platforms" aria-labelledby="settings-platforms-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6  ">
          <div>
            <h2 id="settings-platforms-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">Connect Meta, TikTok, and GA4</h2>
            <p className="text-xs text-slate-400 ">Add the ID and secret key for each platform you want to use. Leave a platform off until both fields are ready.</p>
          </div>

          {Object.keys(credentials).map(platKey => {
            const plat = platKey as Platform;
            const config = credentials[plat];
            const credentialHelp = platformCredentialHelp(plat);
            const missingCredentials = platformMissingCredentials(plat, config);
            const enabledButMissingCredentials = Boolean(config.enabled && missingCredentials.length);
            return (
              <div key={plat} className="p-4 rounded-lg border border-slate-200  bg-slate-50/50  space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-800  uppercase tracking-wider">{plat}</span>
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
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
                    <span className="ml-2 text-xs font-semibold text-slate-500 uppercase ">
                      {config.enabled ? 'On' : 'Off'}
                    </span>
                  </label>
                </div>

                {enabledButMissingCredentials && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    <p className="font-bold">{plat} is on, but setup details are missing.</p>
                    <p className="mt-0.5">
                      Add {missingCredentials.join(' and ')} before events can be sent.
                    </p>
                  </div>
                )}

                <div className={`grid grid-cols-1 ${plat === 'GA4' ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4`}>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">{platformDestinationLabel(plat)}</label>
                    <input 
                      type="text"
                      value={localPixelIds[plat]}
                      placeholder="e.g. 782049182390"
                      onChange={(e) => setLocalPixelIds(prev => ({ ...prev, [plat]: e.target.value }))}
                      onBlur={() => handleUpdatePlatform(plat, { pixelIdOrMeasurementId: localPixelIds[plat] })}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                      className="w-full p-2 text-xs bg-white border border-slate-200 rounded font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500   "
                    />
                    <p className="mt-1 text-xs leading-4 text-slate-500">{credentialHelp.destination}</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">{platformTokenLabel(plat)}</label>
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
                    <p className="mt-1 text-xs leading-4 text-slate-500">{credentialHelp.token}</p>
                  </div>

                  {plat !== 'GA4' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-400 uppercase mb-1 flex items-center">
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
              <p className="text-xs text-slate-400">Connect a Meta or TikTok Advertiser account, then sync campaign spend, clicks, impressions, and ROAS data on demand.</p>
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

        {/* Masterwork Courier & Logistics Settings Panel */}
        <section id="settings-courier" aria-labelledby="settings-courier-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 id="settings-courier-title" className="font-black text-slate-900 text-base tracking-tight">কুরিয়ার ও লজিস্টিকস কনফিগারেশন (Courier & Logistics Config)</h2>
              <p className="mt-1 text-xs text-slate-500">আপনার প্রয়োজনীয় কুরিয়ার অন করুন এবং নিচে এপিআই সংক্রান্ত তথ্য বসান।</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                ● Live API Sync Active
              </span>
            </div>
          </div>

          {/* Integrated Courier Partners Selection Grid */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">ইন্টিগ্রেটেড কুরিয়ার পার্টনার্স (Integrated Courier Partners)</h3>
            <p className="text-xs text-slate-500 mb-4">যে কুরিয়ারগুলো ব্যবহার করতে চান সেগুলোর টগল সুইচ অন করুন। টগল অন করলে নিচে এপিআই ফরম উন্মুক্ত হবে।</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* SteadFast Toggle Box */}
              <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${enabledCouriers.steadfast ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 font-bold text-white shadow-xs">
                    <Truck className="h-5 w-5" />
                  </div>
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-600 font-bold text-white shadow-xs">
                    <Truck className="h-5 w-5" />
                  </div>
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 font-bold text-white shadow-xs">
                    <Truck className="h-5 w-5" />
                  </div>
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
                  <div className="p-4 sm:p-5 rounded-xl border border-indigo-200 bg-slate-50/70 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">S</span>
                        <h4 className="font-bold text-xs text-indigo-700 uppercase tracking-wider">
                          SteadFast Courier API Integration
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Active Form</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">SteadFast মার্চেন্ট প্যানেলের <strong>API Settings</strong> থেকে API Key এবং Secret Key সংগ্রহ করে নিচের ফিল্ডগুলোতে বসান।</p>
                    
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
                      <p className="mt-1 text-xs text-slate-600">SteadFast প্যানেলে রিয়েলটাইম স্ট্যাটাস আপডেটের জন্য Webhook Callback URL কপি করুন।</p>
                      <button type="button" onClick={() => handleCopyCourierWebhookSetup('steadfast')} disabled={copyingCourierSecret === 'steadfast'} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs">
                        <Copy className="h-3.5 w-3.5" />
                        {copyingCourierSecret === 'steadfast' ? 'Preparing...' : courierSettings.steadfast_webhook_token_configured ? 'Copy Setup Again' : 'Copy Setup Secret'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Pathao API Card */}
                {enabledCouriers.pathao && (
                  <div className="p-4 sm:p-5 rounded-xl border border-indigo-200 bg-slate-50/70 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-rose-600 text-xs font-bold text-white">P</span>
                        <h4 className="font-bold text-xs text-indigo-700 uppercase tracking-wider">
                          Pathao Courier API Integration
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Active Form</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">Pathao ডেভলপার/মার্চেন্ট প্যানেল থেকে Client ID, Client Secret, Store ID এবং রেজিস্টার্ড অ্যাকাউন্ট ক্ৰেডেনশিয়াল বসান।</p>
                    
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
                          <p className="mt-1 text-xs leading-relaxed text-slate-600">Generated secret টি কপি করে Pathao Merchant Panel Webhook Integration এ পেস্ট করুন।</p>
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
                  <div className="p-4 sm:p-5 rounded-xl border border-indigo-200 bg-slate-50/70 space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600 text-xs font-bold text-white">R</span>
                        <h4 className="font-bold text-xs text-indigo-700 uppercase tracking-wider">
                          RedX Logistics API Integration
                        </h4>
                      </div>
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">Active Form</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">RedX মার্চেন্ট প্যানেলের <strong>API Settings</strong> থেকে OpenAPI Access Token সংগ্রহ করে বসান।</p>
                    
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
                      <p className="mt-1 text-xs text-slate-600">RedX প্যানেলে বসাতে Dedicated Token সহ Callback URL টি কপি করুন।</p>
                      <button type="button" onClick={() => handleCopyCourierWebhookSetup('redx')} disabled={copyingCourierSecret === 'redx'} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-xs">
                        <Copy className="h-3.5 w-3.5" />
                        {copyingCourierSecret === 'redx' ? 'Preparing...' : courierSettings.redx_webhook_secret_configured ? 'Copy Callback URL Again' : 'Copy Callback URL'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Preferred Courier Provider Selection */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                <label htmlFor="default-courier-provider" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  প্রাথমিক পছন্দের কুরিয়ার (Primary Preferred Courier)
                </label>
                <p className="text-xs text-slate-500 mb-3">১-ক্লিকে কুরিয়ার বুকিং করার সময় কোন কুরিয়ার পার্টনারকে প্রথম অগ্রাধিকার হিসেবে সিলেক্ট রাখা হবে তা নির্বাচন করুন।</p>
                <select 
                  id="default-courier-provider"
                  value={courierSettings.default_courier || 'steadfast'}
                  onChange={(e) => setCourierSettings((prev) => ({ ...prev, default_courier: e.target.value }))}
                  className="w-full sm:w-80 p-2.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer font-semibold text-slate-800"
                >
                  <option value="steadfast">SteadFast Courier (Priority 1)</option>
                  <option value="pathao">Pathao Courier (Priority 1)</option>
                  <option value="redx">RedX Courier (Priority 1)</option>
                </select>
              </div>

              {/* Weight-Based Shipping Rates Card (From Left Design) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">ওজন ভিত্তিক ডেলিভারি চার্জ (Weight-Based Shipping Rates)</h3>
                  <p className="text-xs text-slate-500">পার্সেলের ওজন অনুযায়ী বেস রেট এবং অতিরিক্ত ওজনের চার্জ সেট করুন।</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Base Rate (up to 1kg)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                      <input type="text" defaultValue="60.00" className="w-full p-2 pl-7 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Additional Rate per kg</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">৳</span>
                      <input type="text" defaultValue="15.00" className="w-full p-2 pl-7 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Max Weight Limit</label>
                    <input type="text" defaultValue="10 KG" className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg font-mono text-slate-800" />
                  </div>
                </div>
                <button type="button" className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
                  + Add Weight Tier
                </button>
              </div>

              {/* Zone-Wise Delivery Settings Card (From Left Design) */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">জোন ভিত্তিক ডেলিভারি চার্জ (Zone-Wise Delivery Settings)</h3>
                  <p className="text-xs text-slate-500">ঢাকার ভেতরে, সাব-ঢাকা এবং ঢাকার বাইরের জন্য আলাদা ডেলিভারি ফি নির্ধারণ করুন।</p>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-slate-700 text-left min-w-[500px]">
                    <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="px-3.5 py-2.5">Zone Name</th>
                        <th className="px-3.5 py-2.5">Delivery Time (Days)</th>
                        <th className="px-3.5 py-2.5">Standard Cost</th>
                        <th className="px-3.5 py-2.5">Express Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">Dhaka City (ঢাকার ভিতরে)</td>
                        <td className="px-3.5 py-2.5">1-2 Days</td>
                        <td className="px-3.5 py-2.5 font-mono text-indigo-700 font-bold">৳60.00</td>
                        <td className="px-3.5 py-2.5 font-mono text-indigo-700 font-bold">৳100.00</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">Sub-Dhaka (সাভার, গাজীপুর, কেরানীগঞ্জ)</td>
                        <td className="px-3.5 py-2.5">2-3 Days</td>
                        <td className="px-3.5 py-2.5 font-mono text-indigo-700 font-bold">৳100.00</td>
                        <td className="px-3.5 py-2.5 font-mono text-indigo-700 font-bold">৳150.00</td>
                      </tr>
                      <tr>
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">Outside Dhaka (ঢাকার বাইরে জেলা সদর)</td>
                        <td className="px-3.5 py-2.5">3-5 Days</td>
                        <td className="px-3.5 py-2.5 font-mono text-indigo-700 font-bold">৳130.00</td>
                        <td className="px-3.5 py-2.5 font-mono text-indigo-700 font-bold">৳200.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <button type="button" className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">
                  + Add New Zone
                </button>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingCourier}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer text-center"
                >
                  {savingCourier ? 'Updating settings...' : 'Save All Courier Configurations / সেটিংস সেভ করুন'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* WordPress Custom tracking rules */}
        <section id="settings-cod" aria-labelledby="settings-cod-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 id="settings-cod-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">COD Purchase Timing</h2>
              <p className="text-xs text-slate-400 ">
                Choose when a COD Purchase event is sent. You can send it at once, or wait until you confirm the order.
              </p>
            </div>
            <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
              deferredEnabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}>
              {deferredEnabled ? 'Protection on' : 'Protection off'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Purchase timing</p>
              <p className="mt-1 text-sm font-black text-slate-900">{deferredEnabled ? 'Wait for your confirmation' : 'Send right away'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Auto-confirm</p>
              <p className="mt-1 text-sm font-black text-slate-900">{autoConfirmLabel}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Confirm status</p>
              <p className="mt-1 text-sm font-black text-slate-900">{formattedConfirmStatus}</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-950 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-relaxed">
              To confirm a COD order or change its waiting time, open COD Protection.
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
      </div>

      {/* Left side parameters / WordPress connection */}
      <div className="space-y-6">
        
        {/* WordPress token health status */}
        <section id="settings-wordpress" aria-labelledby="settings-wordpress-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div>
            <h2 id="settings-wordpress-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">WordPress Plugin Connection</h2>
            <p className="text-xs text-slate-400 ">This connects your WordPress store to Buykori. Manage all tracking choices from this portal.</p>
          </div>

          {(connection.reconnectRequired || connection.status !== 'Active') && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
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

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200   space-y-3 font-mono text-xs text-slate-700 ">
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

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs  ">
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
            className="min-h-10 w-full rounded-lg border border-indigo-700/20 bg-indigo-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 cursor-pointer"
          >
            Test WordPress Connection
          </button>
        </section>

        {/* Telegram Notification Settings Card */}
        <section id="settings-whatsapp" aria-labelledby="settings-telegram-title" className="scroll-mt-28 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="settings-telegram-title" className="text-sm font-bold uppercase tracking-wide text-slate-800">Telegram Notifications</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">Connect Telegram privately to receive purchase and incomplete checkout alerts for this store. No phone number or recurring QR pairing is required.</p>
            </div>
            <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${telegramStatus?.connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
              {telegramStatus?.connected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          {telegramStatus?.botUsername ? (
            <div className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-sky-700">Official Buykori order-alert bot</p>
                <a
                  href={`https://t.me/${telegramStatus.botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex text-sm font-black text-sky-950 underline decoration-sky-300 underline-offset-2"
                >
                  Buykori Order Alert
                </a>
                <p className="mt-0.5 max-w-full truncate font-mono text-xs text-sky-700 sm:max-w-[360px]">@{telegramStatus.botUsername}</p>
                <p className="mt-1 text-xs text-sky-800">Use only this bot for purchase and incomplete-checkout notifications.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(`@${telegramStatus.botUsername}`, 'telegram-bot-username')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100"
                >
                  <Copy className="h-4 w-4" /> Copy bot name
                </button>
                <a
                  href={`https://t.me/${telegramStatus.botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600"
                >
                  <MessageCircle className="h-4 w-4" /> Open Telegram bot
                </a>
              </div>
            </div>
          ) : telegramStatus?.available !== false ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              The official Telegram bot link is not configured yet. Please contact Buykori support.
            </div>
          ) : null}

          {telegramStatus?.connected ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black text-emerald-950">Telegram alerts are active</p>
                  <p className="mt-1 text-xs text-emerald-800">Connected as {telegramStatus.telegramUsername ? `@${telegramStatus.telegramUsername}` : telegramStatus.telegramFirstName || 'Telegram user'}.</p>
                  <p className="mt-1 text-xs text-emerald-700">Only notifications for this store will be sent to the verified chat.</p>
                </div>
                <button type="button" onClick={disconnectTelegram} disabled={telegramBusy} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60">Disconnect</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <p className="text-xs font-black text-indigo-950">Connect in three simple steps</p>
                <ol className="mt-3 grid gap-3 text-xs leading-relaxed text-indigo-900 md:grid-cols-3">
                  <li className="rounded-lg bg-white p-3"><b className="block text-indigo-600">1. Generate code</b>Create a private, one-time security code here.</li>
                  <li className="rounded-lg bg-white p-3"><b className="block text-indigo-600">2. Open the official bot</b>Use the blue button above, press Start, and send the security code.</li>
                  <li className="rounded-lg bg-white p-3"><b className="block text-indigo-600">3. Verified</b>The bot confirms this store and alerts begin automatically.</li>
                </ol>
              </div>

              {telegramStatus?.available === false ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Telegram notifications are temporarily unavailable. Please contact Buykori support.</div>
              ) : telegramLinkCode ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">One-time security code</p>
                      <p className="mt-1 font-mono text-3xl font-black tracking-[0.16em] text-slate-950">{telegramLinkCode.code}</p>
                      <p className="mt-1 text-xs text-slate-500">Expires in {telegramLinkCode.expiresInMinutes} minutes and works once.</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <button type="button" onClick={() => handleCopy(telegramLinkCode.code, 'telegram-link-code')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"><Copy className="h-4 w-4" /> Copy code</button>
                      {(telegramLinkCode.deepLinkUrl || telegramLinkCode.botUrl) && <a href={telegramLinkCode.deepLinkUrl || telegramLinkCode.botUrl || '#'} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white hover:bg-sky-600"><MessageCircle className="h-4 w-4" /> Open bot with code</a>}
                      <button type="button" onClick={() => loadTelegramStatus()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50"><RefreshCw className="h-4 w-4" /> Check</button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-600">Recommended: click <b>Open bot with code</b> and press <b>Start</b> in Telegram. If the code is not sent automatically, paste <b>{telegramLinkCode.code}</b>. This page checks the connection automatically.</p>
                </div>
              ) : (
                <button type="button" onClick={generateTelegramLinkCode} disabled={telegramBusy} className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60">
                  {telegramBusy ? 'Generating secure code...' : 'Connect Telegram'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Legacy WhatsApp settings are retained for a future official Cloud API migration. */}
        {false && (
        <section id="settings-whatsapp" aria-labelledby="settings-whatsapp-title" className="scroll-mt-28 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4  ">
          <div>
            <h2 id="settings-whatsapp-title" className="font-bold text-slate-800 text-sm uppercase tracking-wide ">WhatsApp Notifications</h2>
            <p className="text-xs text-slate-400  leading-normal">Receive purchase alerts and incomplete checkout recovery details on your WhatsApp number. Sender accounts are managed by Buykori admin.</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-slate-700">Enable WhatsApp Alerts</span>
                <span className="block text-xs text-slate-400">Send automatic alerts to WhatsApp number.</span>
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
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-sky-900">
                <li>Save the Buykori WhatsApp number that sends your notifications to your contacts using any name.</li>
                <li>Open that contact in WhatsApp and send one message such as "Hi", "Hello", or "Start".</li>
              </ol>
              <p className="mt-2 text-xs leading-relaxed text-sky-700">
                These steps help WhatsApp recognize the conversation and improve reliable notification delivery.
              </p>
            </div>

            {profNotifyWhatsapp && (
              <div className="animate-fadeIn transition-all space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">WhatsApp Number (with Country Code)</label>
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
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-sky-900">
                    <li>Save the Buykori WhatsApp number that sends your notifications to your contacts using any name.</li>
                    <li>Open that contact in WhatsApp and send one message such as “Hi”, “Hello”, or “Start”.</li>
                  </ol>
                  <p className="mt-2 text-xs leading-relaxed text-sky-700">
                    These steps help WhatsApp recognize the conversation and improve reliable notification delivery.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-2 text-right">
              <button 
                type="button"
                onClick={requestWhatsappSettingsSave}
                disabled={profUpdating || loadingWhatsappRecommendation}
                className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                {profUpdating
                  ? 'Saving...'
                  : loadingWhatsappRecommendation
                    ? 'Finding an available sender...'
                    : 'Save WhatsApp Settings'}
              </button>
            </div>
          </div>
        </section>
        )}

      </div>
      </div>

      {false && whatsappRecommendation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="whatsapp-sender-dialog-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <div>
                  <h2 id="whatsapp-sender-dialog-title" className="text-base font-black text-slate-900">
                    Save your Buykori alert number
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    We selected an available sender for fast order and incomplete checkout alerts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappRecommendation(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close sender setup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Buykori WhatsApp sender</p>
                <p className="mt-2 font-mono text-2xl font-black tracking-wide text-slate-950">
                  +{whatsappRecommendation.phoneNumber.replace(/^\+/, '')}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">
                  {whatsappRecommendation.currentAssignment
                    ? 'Your existing sender remains assigned.'
                    : `${whatsappRecommendation.availableSlots} client slot${whatsappRecommendation.availableSlots === 1 ? '' : 's'} available.`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <ol className="space-y-3 text-xs leading-relaxed text-slate-700">
                  <li className="flex gap-3"><b className="text-indigo-600">1.</b><span>Save this number as <b>Buykori Order Alerts</b>.</span></li>
                  <li className="flex gap-3"><b className="text-indigo-600">2.</b><span>Open WhatsApp and send <b>Hi</b> or <b>Hello</b> once.</span></li>
                  <li className="flex gap-3"><b className="text-indigo-600">3.</b><span>Return here and enable the alerts. This helps reduce first-message delays.</span></li>
                </ol>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={downloadWhatsappContact}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" /> Save contact
                </button>
                <button
                  type="button"
                  onClick={openWhatsappGreeting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-600 bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="h-4 w-4" /> Send Hi on WhatsApp
                </button>
              </div>

              <button
                type="button"
                onClick={confirmWhatsappSettingsSave}
                disabled={profUpdating}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {profUpdating ? 'Enabling alerts...' : 'I saved it - Enable WhatsApp alerts'}
              </button>
              <p className="text-center text-xs leading-relaxed text-slate-400">
                Buykori will re-check sender availability when you confirm.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
