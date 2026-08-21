import { apiFetch, describeResponseError } from '../lib/http';

export type AiAdsSection = 'overview' | 'accounts' | 'campaigns' | 'analytics' | 'chat';

export interface AiAdsConnection {
  id: number;
  provider: 'meta' | 'tiktok';
  status: string;
  permission_status: string;
  token_status: string;
  scopes: string[];
  accounts: Array<{
    external_account_id: string;
    account_name?: string;
    status?: string | number;
    currency?: string;
    timezone?: string;
  }>;
}

export interface AiAdsProposal {
  id: number;
  account_id: number;
  operation: string;
  risk: string;
  requested_state: Record<string, unknown>;
  exact_changes: Record<string, unknown>;
  policy_decision: { allowed?: boolean; reasons?: string[] };
  proposal_hash: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface PerformanceSnapshot {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  cpa: number;
  revenue: number;
  roas: number;
  conversion_rate: number;
  aov: number;
  attribution_quality: number;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  structured?: Record<string, unknown> | null;
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = describeResponseError(response);
    try {
      const body = await response.json() as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {}
    throw new Error(detail);
  }
  return await response.json() as T;
}

export const fetchAiAdsOverview = () => apiFetch('/api/ai-ads/overview').then(response => json<{
  performance: PerformanceSnapshot;
  proposals: AiAdsProposal[];
  actions: Array<{ id: number; operation: string; provider: string; status: string; created_at: string }>;
  writes_enabled: boolean;
}>(response));

export const fetchAiAdsConnections = () => apiFetch('/api/v1/ai-ads/connections').then(response => json<AiAdsConnection[]>(response));

export const beginAiAdsOAuth = (provider: 'meta' | 'tiktok') => apiFetch(`/api/v1/ai-ads/oauth/${provider}/start`, { method: 'POST' }).then(response => json<{ authorization_url: string }>(response));

export const selectAiAdsAccount = (connectionId: number, externalAccountId: string) => apiFetch('/api/v1/ai-ads/connections/select-account', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ connection_id: connectionId, external_account_id: externalAccountId }),
}).then(response => json(response));

export const disconnectAiAdsConnection = (connectionId: number) => apiFetch(`/api/v1/ai-ads/connections/${connectionId}`, { method: 'DELETE' }).then(response => json(response));

export const fetchAiAdsCampaigns = () => apiFetch('/api/v1/ad-campaigns').then(response => json<Array<{ id: number; platform: string; external_campaign_id: string; name: string; status?: string; account_name?: string }>>(response));

export const fetchAiAdsPerformance = (days = 7) => apiFetch(`/api/ai-ads/performance?days=${days}`).then(response => json<PerformanceSnapshot>(response));

export const sendAiAdsChat = (message: string, conversationId?: number) => apiFetch('/api/ai-ads/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, conversation_id: conversationId }),
  timeoutMs: 60_000,
}).then(response => json<{ conversation_id: number; message: string; structured?: Record<string, unknown> | null }>(response));

export type CreativeAnalysisStatus = 'ANALYZING' | 'ANALYSIS_READY' | 'NEEDS_REVIEW' | 'ANALYSIS_LIMITED' | 'FAILED';

export const analyzeAiAdsCreative = (assetId: number, context: Record<string, unknown> = {}) => apiFetch(`/api/ai-ads/creatives/assets/${assetId}/analyze-semantic`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ context }),
}).then(response => json<{ id: number; asset_id: number; status: string; analysis: Record<string, unknown>; recommendations: string[] }>(response));

export const generateAiAdsCreativePrompt = (kind: 'image' | 'video', context: Record<string, unknown> = {}) => apiFetch(`/api/ai-ads/creatives/prompt/${kind}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ context }),
}).then(response => json<Record<string, unknown>>(response));

export type ComposedAiAdsProposal = {
  proposal_id: string;
  version: number;
  state: string;
  summary: string;
  business: Record<string, unknown>;
  objective: Record<string, unknown>;
  platform: Record<string, unknown>;
  audience: Record<string, unknown>;
  budget: Record<string, unknown>;
  creative: Record<string, unknown>;
  copy: Record<string, unknown>;
  risks_unknowns: Record<string, unknown>;
  proposal_hash: string;
  read_only: boolean;
  provider_write: boolean;
};

export const composeAiAdsProposal = (conversationId: number, facts: Record<string, unknown> = {}, confirmed: string[] = []) => apiFetch('/api/ai-ads/composed-proposals', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ conversation_id: conversationId, facts, confirmed }),
}).then(response => json<ComposedAiAdsProposal>(response));

export const confirmAiAdsPlan = (proposal: ComposedAiAdsProposal) => apiFetch('/api/ai-ads/composed-proposals/confirm', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposal }),
}).then(response => json<ComposedAiAdsProposal>(response));

export const confirmPersistedAiAdsPlan = (proposalId: string) => apiFetch(`/api/ai-ads/composed-proposals/${proposalId}/confirm`, {
  method: 'POST',
}).then(response => json<ComposedAiAdsProposal>(response));

export const approveAiAdsProposal = (proposal: AiAdsProposal) => apiFetch(`/api/ai-ads/proposals/${proposal.id}/approve`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ proposal_hash: proposal.proposal_hash }),
}).then(response => json<{ approval_id: number }>(response));

export const queueAiAdsProposal = (proposalId: number, approvalId: number) => apiFetch(`/api/ai-ads/proposals/${proposalId}/queue`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ approval_id: approvalId }),
}).then(response => json<{ action_id: number; status: string }>(response));
