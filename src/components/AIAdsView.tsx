import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  CircleDollarSign,
  Link2,
  Loader2,
  MessageSquare,
  PauseCircle,
  Plug,
  RefreshCw,
  Send,
  ShieldCheck,
  Target,
  Unplug,
} from 'lucide-react';
import { Button } from './common/Button';
import {
  approveAiAdsProposal,
  beginAiAdsOAuth,
  disconnectAiAdsConnection,
  fetchAiAdsCampaigns,
  fetchAiAdsConnections,
  fetchAiAdsOverview,
  fetchAiAdsPerformance,
  queueAiAdsProposal,
  selectAiAdsAccount,
  sendAiAdsChat,
  confirmPersistedAiAdsPlan,
  type AiAdsConnection,
  type AiAdsProposal,
  type AiAdsSection,
  type ChatMessage,
  type PerformanceSnapshot,
} from '../services/aiAdsApi';
import type { ComposedAiAdsProposal } from '../services/aiAdsApi';

export type CreativeAnalysisView = {
  status: 'ANALYZING' | 'ANALYSIS_READY' | 'NEEDS_REVIEW' | 'ANALYSIS_LIMITED' | 'FAILED';
  observed?: string[];
  recommendations?: string[];
  limitations?: string[];
  readiness?: string;
};

export function CreativeAnalysisPanel({ analysis }: { analysis: CreativeAnalysisView }) {
  return <section className="space-y-3 border-t border-slate-200 pt-4" aria-live="polite">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-950">Creative analysis</h3><Status value={analysis.status} /></div>
    {analysis.observed?.length ? <div><p className="text-xs font-semibold uppercase text-slate-500">Observed</p><ul className="mt-1 space-y-1 text-sm text-slate-700">{analysis.observed.map(item => <li key={item}>{item}</li>)}</ul></div> : null}
    {analysis.recommendations?.length ? <div><p className="text-xs font-semibold uppercase text-slate-500">Recommendations</p><ul className="mt-1 space-y-1 text-sm text-slate-700">{analysis.recommendations.map(item => <li key={item}>{item}</li>)}</ul></div> : null}
    {analysis.limitations?.length ? <p className="text-sm text-amber-700">{analysis.limitations.join(' ')}</p> : null}
    {analysis.readiness ? <p className="text-sm font-medium text-slate-800">Readiness: {analysis.readiness.replaceAll('_', ' ')}</p> : null}
  </section>;
}

export function ProposalComposerPanel({ proposal, onConfirm }: { proposal: ComposedAiAdsProposal; onConfirm?: () => void }) {
  const unknowns = Array.isArray(proposal.risks_unknowns?.missing) ? proposal.risks_unknowns.missing as string[] : [];
  return <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4" aria-label="AI Ads proposal">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-950">What we recommend</h3><p className="text-xs text-slate-500">Proposal v{proposal.version} · review only</p></div><Status value={proposal.state} /></div>
    <p className="text-sm leading-6 text-slate-700">{proposal.summary}</p>
    <div className="grid gap-3 text-sm sm:grid-cols-2"><div><p className="font-semibold text-slate-900">Audience</p><p className="text-slate-600">{String((proposal.audience.geography as { value?: unknown })?.value ?? 'Unknown')}</p></div><div><p className="font-semibold text-slate-900">Budget</p><p className="text-slate-600">{String((proposal.budget.recommended_daily as { value?: unknown })?.value ?? 'Needs review')}</p></div><div><p className="font-semibold text-slate-900">Creative</p><p className="text-slate-600">{String(proposal.creative.source ?? 'NONE')}</p></div><div><p className="font-semibold text-slate-900">CTA</p><p className="text-slate-600">{String((proposal.copy.cta as unknown) ?? 'Recommended')}</p></div></div>
    {unknowns.length ? <div className="rounded bg-amber-50 p-3 text-sm text-amber-800">Still needed: {unknowns.join(', ')}</div> : null}
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">No campaign, ad, budget, or provider change will happen.</span>{onConfirm && proposal.state === 'PROPOSAL_READY' ? <Button onClick={onConfirm}>Approve plan for review</Button> : null}</div>
  </section>;
}

const tabs: Array<{ id: AiAdsSection; label: string; icon: typeof Bot }> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'accounts', label: 'Connected Accounts', icon: Link2 },
  { id: 'campaigns', label: 'Campaigns', icon: Target },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'chat', label: 'Chat Now', icon: MessageSquare },
];

const sectionFromRoute = (value?: string | null): AiAdsSection => {
  const section = value?.replace('ai-ads-', '') as AiAdsSection;
  return tabs.some(tab => tab.id === section) ? section : 'overview';
};

const money = (value = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const number = (value = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value);

export function AIAdsView({ initialSectionId, showToast }: { initialSectionId?: string | null; showToast: (message: string, isError?: boolean) => void }) {
  const [section, setSection] = useState<AiAdsSection>(() => sectionFromRoute(initialSectionId));
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof fetchAiAdsOverview>> | null>(null);
  const [connections, setConnections] = useState<AiAdsConnection[]>([]);
  const [campaigns, setCampaigns] = useState<Awaited<ReturnType<typeof fetchAiAdsCampaigns>>>([]);
  const [performance, setPerformance] = useState<PerformanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [conversationId, setConversationId] = useState<number>();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'What would you like to review or plan for your ads?' },
  ]);

  useEffect(() => setSection(sectionFromRoute(initialSectionId)), [initialSectionId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewData, connectionData, campaignData, performanceData] = await Promise.all([
        fetchAiAdsOverview(), fetchAiAdsConnections(), fetchAiAdsCampaigns(), fetchAiAdsPerformance(),
      ]);
      setOverview(overviewData);
      setConnections(connectionData);
      setCampaigns(campaignData);
      setPerformance(performanceData);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not load AI Ads.', true);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void load(); }, [load]);

  const navigate = (next: AiAdsSection) => {
    setSection(next);
    const path = next === 'overview' ? '/ai-ads' : `/ai-ads/${next}`;
    window.history.replaceState({ buykoriPage: 'ai-ads', buykoriSection: `ai-ads-${next}` }, '', path);
  };

  const connect = async (provider: 'meta' | 'tiktok') => {
    setBusy(`connect-${provider}`);
    try {
      const response = await beginAiAdsOAuth(provider);
      window.location.assign(response.authorization_url);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Connection could not start.', true);
      setBusy('');
    }
  };

  const selectAccount = async (connection: AiAdsConnection, externalId: string) => {
    setBusy(`select-${connection.id}-${externalId}`);
    try {
      await selectAiAdsAccount(connection.id, externalId);
      showToast('Ad account connected.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Account could not be connected.', true);
    } finally {
      setBusy('');
    }
  };

  const disconnect = async (connectionId: number) => {
    setBusy(`disconnect-${connectionId}`);
    try {
      await disconnectAiAdsConnection(connectionId);
      showToast('Connection disconnected.');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Connection could not be disconnected.', true);
    } finally {
      setBusy('');
    }
  };

  const confirmProposal = async (proposal: AiAdsProposal) => {
    if (overview?.writes_enabled !== true) {
      showToast('AI Ads is currently read-only.', true);
      return;
    }
    setBusy(`proposal-${proposal.id}`);
    try {
      const approval = await approveAiAdsProposal(proposal);
      const action = await queueAiAdsProposal(proposal.id, approval.approval_id);
      showToast(`Your request ${action.action_id} was submitted for final review.`);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Proposal could not be approved.', true);
    } finally {
      setBusy('');
    }
  };

  const sendMessage = async () => {
    const message = chatInput.trim();
    if (!message || busy === 'chat') return;
    setChatInput('');
    setMessages(current => [...current, { role: 'user', content: message }]);
    setBusy('chat');
    try {
      const response = await sendAiAdsChat(message, conversationId);
      setConversationId(response.conversation_id);
      setMessages(current => [...current, { role: 'assistant', content: response.message, structured: response.structured }]);
      if (response.structured && 'proposal' in response.structured) await load();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'The assistant could not respond.';
      setMessages(current => [...current, { role: 'assistant', content: text }]);
    } finally {
      setBusy('');
    }
  };

  const confirmPlan = async (proposalId: string) => {
    setBusy(`plan-${proposalId}`);
    try {
      const confirmed = await confirmPersistedAiAdsPlan(proposalId);
      setMessages(current => current.map(message => {
        const composed = message.structured?.composed_proposal as Record<string, unknown> | undefined;
        return composed?.proposal_id === proposalId ? { ...message, structured: { ...message.structured, composed_proposal: confirmed } } : message;
      }));
      showToast('Plan confirmed for review. No advertising account was changed.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Plan could not be confirmed.', true);
    } finally {
      setBusy('');
    }
  };

  if (loading && !overview) {
    return <div className="flex min-h-[420px] items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading AI Ads</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">AI Ads</h2>
          <p className="mt-1 text-sm text-slate-500">Planning, approvals, account health, and performance.</p>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="AI Ads views">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" role="tab" aria-selected={section === tab.id} onClick={() => navigate(tab.id)} className={`flex min-h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium ${section === tab.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
            <Icon className="h-4 w-4" />{tab.label}
          </button>;
        })}
      </div>

      {section === 'overview' && <OverviewPanel overview={overview} onOpen={navigate} onConfirm={confirmProposal} busy={busy} />}
      {section === 'accounts' && <AccountsPanel connections={connections} busy={busy} onConnect={connect} onSelect={selectAccount} onDisconnect={disconnect} />}
      {section === 'campaigns' && <CampaignsPanel campaigns={campaigns} />}
      {section === 'analytics' && <AnalyticsPanel snapshot={performance} />}
      {section === 'chat' && <ChatPanel messages={messages} value={chatInput} setValue={setChatInput} busy={busy === 'chat'} onSend={sendMessage} onConfirmPlan={confirmPlan} planBusy={busy} />}
    </div>
  );
}

function OverviewPanel({ overview, onOpen, onConfirm, busy }: { overview: Awaited<ReturnType<typeof fetchAiAdsOverview>> | null; onOpen: (section: AiAdsSection) => void; onConfirm: (proposal: AiAdsProposal) => void; busy: string }) {
  const metrics = [
    ['Spend', money(overview?.performance.spend), CircleDollarSign],
    ['Revenue', money(overview?.performance.revenue), BarChart3],
    ['ROAS', number(overview?.performance.roas), Activity],
    ['Attribution', `${number(overview?.performance.attribution_quality)}%`, ShieldCheck],
  ] as const;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value, Icon]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-500">{label}</span><Icon className="h-4 w-4 text-slate-400" /></div><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p></div>)}
    </div>
    <section>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-950">Pending proposals</h3><button className="text-sm font-medium text-emerald-700" onClick={() => onOpen('chat')}>Open Chat Now</button></div>
      <ProposalList proposals={overview?.proposals || []} writesEnabled={overview?.writes_enabled === true} busy={busy} onConfirm={onConfirm} />
    </section>
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-950">Recent actions</h3>
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        {(overview?.actions || []).length ? overview?.actions.map(action => <div key={action.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0"><div><p className="text-sm font-medium text-slate-900">{action.operation.replaceAll('_', ' ')}</p><p className="text-xs text-slate-500">{action.provider} · Action {action.id}</p></div><Status value={action.status} /></div>) : <Empty label="No action history yet." />}
      </div>
    </section>
  </div>;
}

export function proposalCanBeConfirmed(proposal: AiAdsProposal, writesEnabled: boolean): boolean {
  return writesEnabled && proposal.status === 'pending' && proposal.policy_decision.allowed !== false;
}

function ProposalList({ proposals, writesEnabled, busy, onConfirm }: { proposals: AiAdsProposal[]; writesEnabled: boolean; busy: string; onConfirm: (proposal: AiAdsProposal) => void }) {
  if (!proposals.length) return <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">No proposals awaiting review.</div>;
  return <div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200 bg-white">{proposals.map(proposal => <div key={proposal.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-950">{proposal.operation.replaceAll('_', ' ')}</p><Status value={proposal.risk} /></div>{proposal.policy_decision.reasons?.length ? <p className="mt-1 text-xs text-rose-600">This plan needs additional review before it can continue.</p> : null}</div>{proposalCanBeConfirmed(proposal, writesEnabled) ? <Button onClick={() => onConfirm(proposal)} disabled={busy === `proposal-${proposal.id}`}><Check className="h-4 w-4" />Confirm plan</Button> : <Status value={!writesEnabled && proposal.status === 'pending' ? 'read only' : proposal.status} />}</div>)}</div>;
}

function AccountsPanel({ connections, busy, onConnect, onSelect, onDisconnect }: { connections: AiAdsConnection[]; busy: string; onConnect: (provider: 'meta' | 'tiktok') => void; onSelect: (connection: AiAdsConnection, id: string) => void; onDisconnect: (id: number) => void }) {
  return <div className="space-y-5">
    <div className="grid gap-3 md:grid-cols-2">
      {(['meta', 'tiktok'] as const).map(provider => <div key={provider} className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-4"><div><p className="font-semibold capitalize text-slate-950">{provider} Ads</p><p className="text-sm text-slate-500">Official OAuth connection</p></div><Button onClick={() => onConnect(provider)} disabled={busy === `connect-${provider}`}><Plug className="h-4 w-4" />Connect</Button></div>)}
    </div>
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-950">Connections</h3>
      <div className="space-y-3">{connections.length ? connections.map(connection => <div key={connection.id} className="rounded-md border border-slate-200 bg-white"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold capitalize text-slate-950">{connection.provider} Ads</p><Status value={connection.status} /></div><p className="mt-1 text-xs text-slate-500">Permissions {connection.permission_status} · Token {connection.token_status}</p></div><Button variant="secondary" onClick={() => onDisconnect(connection.id)} disabled={busy === `disconnect-${connection.id}`}><Unplug className="h-4 w-4" />Disconnect</Button></div><div className="divide-y divide-slate-100">{connection.accounts.map(account => <div key={account.external_account_id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{account.account_name || 'Ad account'}</p><p className="text-xs text-slate-500">***{account.external_account_id.slice(-4)} · {account.currency || 'Currency unavailable'}</p></div><Button variant="secondary" onClick={() => onSelect(connection, account.external_account_id)} disabled={busy === `select-${connection.id}-${account.external_account_id}`}>Select<ChevronRight className="h-4 w-4" /></Button></div>)}</div></div>) : <Empty label="No OAuth connections yet." />}</div>
    </section>
  </div>;
}

function CampaignsPanel({ campaigns }: { campaigns: Awaited<ReturnType<typeof fetchAiAdsCampaigns>> }) {
  return <div className="overflow-hidden rounded-md border border-slate-200 bg-white"><div className="grid grid-cols-[1fr_100px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 sm:grid-cols-[1fr_140px_140px]"> <span>Campaign</span><span className="hidden sm:block">Account</span><span>Status</span></div>{campaigns.length ? campaigns.map(campaign => <div key={`${campaign.platform}-${campaign.external_campaign_id}`} className="grid grid-cols-[1fr_100px] gap-3 border-b border-slate-100 px-4 py-3 last:border-0 sm:grid-cols-[1fr_140px_140px]"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900">{campaign.name}</p><p className="text-xs capitalize text-slate-500">{campaign.platform} · ***{campaign.external_campaign_id.slice(-4)}</p></div><span className="hidden truncate text-sm text-slate-500 sm:block">{campaign.account_name || 'Account'}</span><Status value={campaign.status || 'unknown'} /></div>) : <Empty label="No synced campaigns." />}</div>;
}

function AnalyticsPanel({ snapshot }: { snapshot: PerformanceSnapshot | null }) {
  const rows = [
    ['Spend', money(snapshot?.spend)], ['Impressions', money(snapshot?.impressions)], ['Clicks', money(snapshot?.clicks)],
    ['CTR', `${number(snapshot?.ctr)}%`], ['CPC', money(snapshot?.cpc)], ['CPM', money(snapshot?.cpm)],
    ['Purchases', money(snapshot?.conversions)], ['CPA', money(snapshot?.cpa)], ['Revenue', money(snapshot?.revenue)],
    ['ROAS', number(snapshot?.roas)], ['Conversion rate', `${number(snapshot?.conversion_rate)}%`], ['AOV', money(snapshot?.aov)],
  ];
  return <div className="grid gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">{rows.map(([label, value]) => <div key={label} className="bg-white p-4"><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-950">{value}</p></div>)}</div>;
}

function ChatPanel({ messages, value, setValue, busy, onSend, onConfirmPlan, planBusy }: { messages: ChatMessage[]; value: string; setValue: (value: string) => void; busy: boolean; onSend: () => void; onConfirmPlan: (id: string) => void; planBusy: string }) {
  return <div className="flex min-h-[560px] flex-col overflow-hidden rounded-md border border-slate-200 bg-white"><div className="border-b border-slate-200 bg-emerald-50 px-4 py-3"><h3 className="font-semibold text-slate-950">AI Ads Assistant</h3><p className="mt-1 text-sm text-slate-600">Tell me what you're selling and what you want to achieve.</p></div><div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] rounded-md px-4 py-3 text-sm leading-6 sm:max-w-[72%] ${message.role === 'user' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-slate-50 text-slate-800'}`}>{message.content}{message.structured && 'proposal' in message.structured ? <div className="mt-3 border-t border-slate-200 pt-3 text-xs font-medium text-emerald-700">Your proposed plan is ready to review.</div> : null}{message.structured && 'composed_proposal' in message.structured ? <div className="mt-3 border-t border-slate-200 pt-3"><ProposalSummaryCard proposal={message.structured.composed_proposal as Record<string, unknown>} onConfirm={onConfirmPlan} busy={planBusy} /></div> : null}</div></div>)}{busy && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Preparing a helpful response</div>}</div><div className="border-t border-slate-200 p-3"><div className="flex items-end gap-2"><textarea value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void onSend(); } }} rows={2} aria-label="Message the AI Ads Assistant" placeholder="Tell me about your business, product, goal, or budget" className="min-h-12 flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /><button type="button" onClick={() => void onSend()} disabled={busy || !value.trim()} title="Send message" aria-label="Send message" className="flex h-11 w-11 items-center justify-center rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /></button></div></div></div>;
}

function ProposalSummaryCard({ proposal, onConfirm, busy }: { proposal: Record<string, unknown>; onConfirm: (id: string) => void; busy: string }) {
  const audience = proposal.audience as Record<string, any> | undefined;
  const geography = audience?.geography as Record<string, unknown> | undefined;
  const budget = proposal.budget as Record<string, any> | undefined;
  const daily = budget?.recommended_daily as Record<string, unknown> | undefined;
  const alternatives = Array.isArray(proposal.alternatives) ? proposal.alternatives as Array<Record<string, unknown>> : [];
  const id = String(proposal.proposal_id ?? '');
  return <div className="space-y-2 text-xs"><p className="font-semibold text-slate-900">Plan {String(proposal.version ?? '')} · {String(proposal.state ?? 'REVIEW')}</p><p>{String(proposal.summary ?? 'Review the recommended plan below.')}</p><p><span className="font-medium">Audience:</span> {String(geography?.value ?? 'Needs review')}</p><p><span className="font-medium">Budget:</span> {String(daily?.value ?? 'Needs review')}</p><p><span className="font-medium">Creative:</span> {String((proposal.creative as Record<string, unknown> | undefined)?.source ?? 'NONE')}</p>{alternatives.map(plan => <p key={String(plan.name)}><span className="font-medium">{String(plan.name)}:</span> {String(plan.style)} · {String(plan.risk)}</p>)}<p className="text-slate-500">Confirming this plan records your review only. No advertising account is changed.</p>{proposal.state === 'PROPOSAL_READY' && id ? <Button onClick={() => onConfirm(id)} disabled={busy === `plan-${id}`}><Check className="h-4 w-4" />Confirm plan</Button> : null}</div>;
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = normalized.includes('success') || normalized.includes('connected') || normalized === 'low' || normalized === 'active' ? 'bg-emerald-50 text-emerald-700' : normalized.includes('fail') || normalized.includes('block') || normalized === 'critical' ? 'bg-rose-50 text-rose-700' : normalized === 'high' || normalized.includes('pending') || normalized.includes('queue') ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex w-fit rounded px-2 py-1 text-xs font-semibold capitalize ${tone}`}>{value.replaceAll('_', ' ')}</span>;
}

function Empty({ label }: { label: string }) {
  return <div className="flex items-center justify-center px-4 py-10 text-sm text-slate-500"><PauseCircle className="mr-2 h-4 w-4" />{label}</div>;
}
