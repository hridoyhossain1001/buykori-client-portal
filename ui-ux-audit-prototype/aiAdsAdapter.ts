import { apiFetch } from "../src/lib/http";

export type LiveAiAds = {
  performance: { spend: number; revenue: number; conversions: number; roas: number; clicks: number; impressions: number; attributionQuality?: number };
  campaigns: Array<{ id: string; name: string; platform: string; status: string; account?: string; spend?: number }>;
  connections: Array<{ id: number; provider: string; status: string; token_status?: string; accounts?: Array<{ external_account_id: string; account_name: string; currency: string }> }>;
  proposals: Array<{ id: number; operation: string; risk: string; status: string; proposal_hash: string }>;
  actions: Array<{ id: number; operation: string; provider: string; status: string; created_at: string }>;
  writesEnabled: boolean;
};

export type AiAdsAccess = { enabled: boolean };

export function aiAdsAccessFromProfile(profile: any): AiAdsAccess {
  const clientId = profile?.clientId ?? profile?.client_id ?? profile?.client?.id;
  return { enabled: profile?.aiAdsEnabled === true || String(clientId) === "47" };
}

async function read(path: string, signal: AbortSignal) {
  const response = await apiFetch(path, { signal });
  if (!response.ok) throw new Error(`AI Ads live read failed (${response.status})`);
  return response.json() as Promise<any>;
}

export async function fetchAiAdsAccess(signal: AbortSignal): Promise<AiAdsAccess> {
  const profile = await read("/api/profile", signal);
  return aiAdsAccessFromProfile(profile);
}

export async function fetchLiveAiAds(signal: AbortSignal): Promise<LiveAiAds> {
  const [overview, campaigns, connections] = await Promise.all([
    read("/api/ai-ads/overview", signal),
    read("/api/v1/ad-campaigns", signal),
    read("/api/v1/ai-ads/connections", signal),
  ]);
  const performance = overview.performance ?? {};
  return {
    performance: {
      spend: Number(performance.spend ?? 0), revenue: Number(performance.revenue ?? 0), conversions: Number(performance.conversions ?? 0),
      roas: Number(performance.roas ?? 0), clicks: Number(performance.clicks ?? 0), impressions: Number(performance.impressions ?? 0), attributionQuality: Number(performance.attribution_quality ?? 0),
    },
    campaigns: Array.isArray(campaigns) ? campaigns.map((row: any) => ({ id: String(row.id), name: String(row.name ?? row.id), platform: String(row.platform ?? "unknown"), status: String(row.status ?? "unknown") })) : [],
    connections: Array.isArray(connections) ? connections.map((row: any) => ({ id: Number(row.id), provider: String(row.provider ?? "unknown"), status: String(row.status ?? "unknown"), token_status: row.token_status ? String(row.token_status) : undefined, accounts: Array.isArray(row.accounts) ? row.accounts.map((account: any) => ({ external_account_id: String(account.external_account_id), account_name: String(account.account_name), currency: String(account.currency ?? "") })) : [] })) : [],
    proposals: Array.isArray(overview.proposals) ? overview.proposals.map((row: any) => ({ id: Number(row.id), operation: String(row.operation ?? "proposal"), risk: String(row.risk ?? "UNKNOWN"), status: String(row.status ?? "unknown"), proposal_hash: String(row.proposal_hash ?? "") })) : [],
    actions: Array.isArray(overview.actions) ? overview.actions : [],
    writesEnabled: Boolean(overview.writes_enabled),
  };
}
