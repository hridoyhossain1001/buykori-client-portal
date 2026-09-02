import React, { useState, useEffect } from 'react';
import { Globe2, MessageCircle, Truck, Zap } from 'lucide-react';
import { Platform, PlatformConfig, EventRule, ClientConnection, PluginReleaseInfo, CustomEventAutomation, CourierSettings } from '../types';
import { copyText } from '../lib/clipboard';
import { useIsWide } from '../lib/useIsWide';
import { PageHeader } from './common';
import StoreDomainSection from './settings/StoreDomainSection';
import AdPlatformsSection from './settings/AdPlatformsSection';
import CourierSection from './settings/CourierSection';
import CodTimingSection from './settings/CodTimingSection';
import EventRoutingSection from './settings/EventRoutingSection';
import CustomAutomationsSection from './settings/CustomAutomationsSection';
import WordPressSection from './settings/WordPressSection';
import WhatsAppConnectSection from './settings/WhatsAppConnectSection';
import {
  connectWhatsApp as requestWhatsAppConnect,
  disconnectWhatsApp as requestWhatsAppDisconnect,
  fetchWhatsAppStatus,
  setWhatsAppAutoSend as requestWhatsAppAutoSend,
  type WhatsAppStatus,
} from '../services/whatsappApi';

const PATHAO_WEBHOOK_CALLBACK_URL = 'https://api.buykori.app/api/v1/webhook/pathao';
const STEADFAST_WEBHOOK_CALLBACK_URL = 'https://api.buykori.app/api/v1/webhook/steadfast';
const REDX_WEBHOOK_CALLBACK_URL = 'https://api.buykori.app/api/v1/webhook/redx';
/**
 * A WhatsApp linking QR is only valid for about twenty seconds and the gateway
 * never caches it, so while the merchant is pairing this page has to ask for a
 * fresh one every few seconds.
 */
const WHATSAPP_QR_POLL_MS = 4000;

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
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null);
  const [whatsappBusy, setWhatsappBusy] = useState(false);
  const [whatsappAutoSendBusy, setWhatsappAutoSendBusy] = useState(false);

  const loadWhatsAppStatus = async (quiet = true) => {
    try {
      const data = await fetchWhatsAppStatus();
      setWhatsappStatus(data);
      return data;
    } catch (error) {
      // The whole feature is optional, so a failed read must never shout at a
      // merchant who never asked for it — only a deliberate click reports.
      if (!quiet) showToast(error instanceof Error ? error.message : 'Could not load WhatsApp status.', true);
      return null;
    }
  };

  const startWhatsAppConnect = async () => {
    setWhatsappBusy(true);
    try {
      const result = await requestWhatsAppConnect();
      // Show the QR from this response immediately; the poll below keeps it fresh.
      setWhatsappStatus((current) => (current
        ? {
          ...current,
          qr: result.qr,
          connected: result.status === 'connected',
          session: {
            ...current.session,
            status: result.status,
            phoneNumber: result.phoneNumber || current.session.phoneNumber,
          },
        }
        : current));
      await loadWhatsAppStatus();
      if (result.status === 'connected') showToast('WhatsApp is already linked.', false);
      else showToast('Scan the QR code with the phone that owns this store’s WhatsApp number.', false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start the WhatsApp connection.', true);
    } finally {
      setWhatsappBusy(false);
    }
  };

  const stopWhatsApp = async () => {
    if (!window.confirm('Disconnect WhatsApp for this store? You will need to scan the QR code again to send confirmations.')) return;
    setWhatsappBusy(true);
    try {
      const result = await requestWhatsAppDisconnect();
      await loadWhatsAppStatus();
      if (result.gatewayError) {
        showToast(`WhatsApp service could not be reached: ${result.gatewayError}`, true);
      } else {
        showToast('WhatsApp disconnected.', false);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not disconnect WhatsApp.', true);
    } finally {
      setWhatsappBusy(false);
    }
  };

  /**
   * Turn the automatic confirmation sweep on or off for this store.
   *
   * The switch is flipped optimistically so it never feels stuck, then the real
   * status is re-read — the server can refuse an ON (plan/flag) and the merchant
   * must see the switch fall back rather than believe it saved.
   */
  const changeWhatsAppAutoSend = async (autoSend: boolean) => {
    setWhatsappAutoSendBusy(true);
    setWhatsappStatus((current) => (current ? { ...current, autoSend } : current));
    try {
      await requestWhatsAppAutoSend(autoSend);
      await loadWhatsAppStatus();
      showToast(
        autoSend
          ? 'Automatic sending is on. New orders get the confirmation request by themselves.'
          : 'Automatic sending is off. Send each order by hand from Order Management.',
        false,
      );
    } catch (error) {
      await loadWhatsAppStatus();
      showToast(
        error instanceof Error ? error.message : 'Could not save the automatic sending setting.',
        true,
      );
    } finally {
      setWhatsappAutoSendBusy(false);
    }
  };

  useEffect(() => {
    void loadWhatsAppStatus();
  }, []);

  useEffect(() => {
    const status = whatsappStatus?.session.status;
    const pairing = status === 'qr_pending' || status === 'connecting';
    if (!pairing || whatsappStatus?.connected) return undefined;
    const timer = window.setInterval(() => { void loadWhatsAppStatus(); }, WHATSAPP_QR_POLL_MS);
    return () => window.clearInterval(timer);
  }, [whatsappStatus?.session.status, whatsappStatus?.connected]);

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
      /* Three tabs in one phone row: the full labels need two lines each at
         320px, and the short forms are the same nouns the sections below use. */
      shortLabel: 'Store',
      sections: [
        { id: 'settings-domain', label: 'Website address' },
        { id: 'settings-wordpress', label: 'WordPress connection' },
      ],
    },
    {
      id: 'conversions',
      label: 'Conversions API',
      shortLabel: 'Conversions',
      sections: [
        { id: 'settings-platforms', label: 'Ad platforms' },
        { id: 'settings-cod', label: 'COD timing' },
        { id: 'settings-routing', label: 'Events to send' },
        { id: 'settings-custom-automations', label: 'Custom events' },
      ],
    },
    {
      id: 'courier',
      label: 'Courier & Alerts',
      shortLabel: 'Courier',
      sections: [
        { id: 'settings-courier', label: 'Courier accounts' },
        { id: 'settings-whatsapp', label: 'WhatsApp confirmations' },
      ],
    },
  ];
  const tabIdForSection = (sectionId?: string | null) => (
    settingsTabs.find(tab => tab.sections.some(section => section.id === sectionId))?.id || 'store'
  );
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>(() => tabIdForSection(initialSectionId));
  /* 640px is Tailwind's `sm`, the breakpoint every class in the strip above
     uses. A tab label is content, not styling, so it is decided here. */
  const isWide = useIsWide(640);
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
    steadfast_webhook_verified_at: '',
    redx_access_token: '',
    redx_webhook_secret_configured: false,
    redx_webhook_verified_at: '',
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

  /* The "Ad accounts" card that used to live here is gone, and with it the
     `/api/v1/ad-accounts` form, the Meta account discovery and the manual sync
     and disconnect buttons. Ad-account linking now belongs to AI Ads, which owns
     the OAuth return, the token health and the per-account sync it needs; two
     places to paste the same access token could only disagree. The endpoints
     themselves are untouched -- AI Ads still calls them through
     `services/aiAdsApi.ts`. */

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
          // Keep the provider cards aligned with the saved/live portal state.
          // A provider is shown as enabled when its credential set is present;
          // an entirely empty response preserves the default SteadFast card.
          const savedEnabled = {
            steadfast: Boolean(data.steadfast_api_key || data.steadfast_secret_key),
            pathao: Boolean(data.pathao_client_id || data.pathao_email || data.pathao_store_id),
            redx: Boolean(data.redx_access_token),
          };
          if (savedEnabled.steadfast || savedEnabled.pathao || savedEnabled.redx) {
            setEnabledCouriers(savedEnabled);
          }
        } else {
          showToast("Could not load your courier settings. Please refresh to try again.", true);
        }
      } catch (err) {
        console.error("Failed to load courier settings", err);
        showToast("Could not load your courier settings. Check your connection and refresh.", true);
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
      const copied = await copyText(data.secret);
      setCourierSettings((prev) => ({
        ...prev,
        pathao_webhook_secret: '',
        pathao_webhook_secret_configured: true,
        pathao_webhook_verified_at: data.verified_at || ''
      }));
      // The secret is only returned once. If the clipboard write failed we must
      // say so instead of claiming a copy the user does not actually have.
      if (copied) {
        showToast('Pathao setup secret copied. Paste it into the Pathao Webhook Integration Secret field.', false);
      } else {
        showToast('Secret generated but could not be copied. Generate it again to retry the copy.', true);
      }
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
      const value = provider === 'redx' ? data.callback_url : data.secret;
      if (typeof value !== 'string' || !value) {
        showToast(`Failed to prepare ${provider} webhook setup.`, true);
        return;
      }
      const copied = await copyText(value);
      const configuredField = provider === 'steadfast'
        ? 'steadfast_webhook_token_configured'
        : 'redx_webhook_secret_configured';
      const verifiedField = provider === 'steadfast'
        ? 'steadfast_webhook_verified_at'
        : 'redx_webhook_verified_at';
      setCourierSettings((prev) => ({
        ...prev,
        [configuredField]: true,
        [verifiedField]: data.verified_at || ''
      }));
      const providerLabel = provider === 'steadfast' ? 'SteadFast' : 'RedX';
      if (copied) {
        showToast(
          provider === 'steadfast'
            ? 'SteadFast authorization token copied. Add it as an Authorization: Bearer header in the courier webhook setup.'
            : 'RedX secure callback URL copied. Paste the complete URL into the RedX callback field.',
          false,
        );
      } else {
        showToast(`${providerLabel} webhook setup generated but could not be copied. Generate it again to retry the copy.`, true);
      }
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
  const whatsappStatusLabel = whatsappStatus?.connected
    ? 'Connected'
    : whatsappStatus?.available === false
      ? 'Unavailable'
      : 'Needs setup';
  const autoConfirmLabel = autoConfirmDays > 0
    ? `${autoConfirmDays} day${autoConfirmDays === 1 ? '' : 's'} after order hold`
    : 'Manual confirmation only';
  const formattedConfirmStatus = autoConfirmStatus
    ? autoConfirmStatus.replace(/[-_]/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
    : 'Completed';

  return (
    <div className="mx-auto max-w-6xl">
      {/* PageHeader carries its own bottom margin (12px on a phone, 24px from
          sm up), so it sits outside the space-y-5 column rather than inside it —
          otherwise the two stack and the head costs 44px of gap alone. */}
      <PageHeader
        title="Settings"
        description={`Configure tracking, integrations and alerts for ${storeDomain || 'your store'}.`}
      />
      <div className="space-y-5">
      <section className="w-full rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-fit sm:max-w-full">
        {/* Three tabs in a two-column grid left an orphan on the second row and
            spent 102px on the strip. One row of thirds with the short labels is
            44px, and the whole strip is reachable without a gesture. */}
        <div className="grid grid-cols-3 gap-1 sm:flex">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => openSettingsTab(tab.id)}
              className={`min-h-11 min-w-0 rounded-lg px-1 py-2 text-[11px] font-bold transition-colors sm:min-w-fit sm:px-4 sm:text-xs ${
                activeSettingsTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {isWide ? tab.label : tab.shortLabel}
            </button>
          ))}
        </div>
      </section>
      {activeSettingsTab === 'store' && (
        <section className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => openSettingsTab('conversions')}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-indigo-200 sm:p-4"
            >
              <span className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">
                <span>Events routing</span><Zap className="h-4 w-4 shrink-0 text-emerald-500" />
              </span>
              <p className="mt-2 text-sm font-bold text-slate-900 sm:mt-4 sm:text-base">{configuredPlatformCount} / {platformStatusRows.length} ready</p>
              {/* These four subtitles are the only line on the tile that says
                  *what* the number means, and a 2-across grid gives each one
                  134px on a 360px phone — enough for "3 platforms · 8 events on"
                  and not for "steadfast default · manual booking" (166px) or
                  "Order confirmations to your customers" (183px, and still
                  clipped at 1280 where the grid goes 4-across). `truncate` is a
                  promise to clip, so each one now carries the full sentence as a
                  `title`. */}
              <p title={`${enabledPlatformCount} platforms · ${enabledRouteCount} events on`} className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs">{enabledPlatformCount} platforms · {enabledRouteCount} events on</p>
            </button>
            <button
              type="button"
              onClick={() => openSettingsTab('courier')}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-indigo-200 sm:p-4"
            >
              <span className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">
                <span>Courier setup</span><Truck className="h-4 w-4 shrink-0 text-amber-500" />
              </span>
              <p className="mt-2 text-sm font-bold text-slate-900 sm:mt-4 sm:text-base">{courierProviderConfigured ? 'Ready' : 'Setup needed'}</p>
              <p title={`${selectedCourierProvider} default · manual booking`} className="mt-1 truncate text-[10px] capitalize text-slate-500 sm:text-xs">{selectedCourierProvider} default · manual booking</p>
            </button>
            <button
              type="button"
              onClick={() => openSettingsTab('courier')}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-indigo-200 sm:p-4"
            >
              <span className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">
                <span>WhatsApp confirmations</span><MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              </span>
              <p className="mt-2 text-sm font-bold text-slate-900 sm:mt-4 sm:text-base">{whatsappStatusLabel}</p>
              <p title="Order confirmations to your customers" className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs">Order confirmations to your customers</p>
            </button>
            <button
              type="button"
              onClick={() => openSettingsTab('store')}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors hover:border-indigo-200 sm:p-4"
            >
              <span className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">
                <span>WordPress plugin</span><Globe2 className="h-4 w-4 shrink-0 text-emerald-500" />
              </span>
              <p className="mt-2 text-sm font-bold text-slate-900 sm:mt-4 sm:text-base">{pluginVersionStatus}</p>
              <p title={updateAvailable ? 'Plugin update available' : pluginVersionHelp} className="mt-1 truncate text-[10px] text-slate-500 sm:text-xs">{updateAvailable ? 'Plugin update available' : pluginVersionHelp}</p>
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
          pathaoWebhookCallbackUrl={PATHAO_WEBHOOK_CALLBACK_URL}
          pathaoCallbackCopied={Boolean(copiedStates.pathaoWebhookCallbackUrl)}
          handleCopyPathaoCallbackUrl={() => handleCopy(PATHAO_WEBHOOK_CALLBACK_URL, 'pathaoWebhookCallbackUrl')}
          steadfastWebhookCallbackUrl={STEADFAST_WEBHOOK_CALLBACK_URL}
          steadfastCallbackCopied={Boolean(copiedStates.steadfastWebhookCallbackUrl)}
          handleCopySteadfastCallbackUrl={() => handleCopy(STEADFAST_WEBHOOK_CALLBACK_URL, 'steadfastWebhookCallbackUrl')}
          redxWebhookCallbackUrl={REDX_WEBHOOK_CALLBACK_URL}
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

        {/* Per-store WhatsApp "reply 1 to confirm" linking */}
        <WhatsAppConnectSection
          status={whatsappStatus}
          busy={whatsappBusy}
          autoSendBusy={whatsappAutoSendBusy}
          connectWhatsApp={() => { void startWhatsAppConnect(); }}
          disconnectWhatsApp={() => { void stopWhatsApp(); }}
          refreshWhatsApp={() => { void loadWhatsAppStatus(false); }}
          setAutoSend={(autoSend) => { void changeWhatsAppAutoSend(autoSend); }}
        />

      </div>
      </div>

      </div>
    </div>
  );
}
