/**
 * Setup guide — the prototype's `SetupGuide()` screen, rebuilt on the live
 * `GET /api/setup/readiness` payload. Presentation only: the fetch stays in
 * `SetupGuideView.tsx`, so this file imports no API helper and fires no request.
 *
 * The prototype's two good ideas are kept, and made true:
 *
 *  - **A step is complete because a check says so, not because a counter says
 *    so.** The previous live view ticked row N when `index < completedRequired`,
 *    so passing any two required checks marked "Install the WordPress plugin"
 *    done even with no plugin heartbeat at all. Every row here reads the one
 *    readiness step that actually proves it, by key.
 *  - **Show the evidence.** A verified row prints the backend's own `detail` for
 *    that step — the heartbeat timestamp, the ready destination names, the
 *    successful-delivery count — instead of the prototype's invented
 *    "Open since …" line.
 *
 * Two rows carry no check, because the backend has no signal for them: choosing
 * which events to send, and the plugin's own health-check button. They read
 * "You confirm this" rather than borrow a neighbouring step's tick.
 *
 * `GET /setup/readiness` also returns a required `domain` step the old guide
 * never mentioned, so the score could sit at 75% with nothing on the page
 * explaining why. It is the first row now.
 */
import React from 'react';
import {
  ArrowUpRight, BookOpen, Check, ChevronDown, ChevronRight, Clock3, Download,
  KeyRound, MessageCircle, RefreshCw, Send, ShieldCheck, ShoppingCart, Truck, UserRound,
} from 'lucide-react';
import { Badge, Button, Card, PageHeader, SectionTitle, TabPanel, Tabs } from '../common';
import type { BadgeTone, TabItem } from '../common';

/** One entry of `GET /setup/readiness` → `steps`. */
export interface ReadinessStep {
  key: string;
  label: string;
  ready: boolean;
  required: boolean;
  actionPage: string;
  actionLabel: string;
  detail?: string;
}

/** The whole `GET /setup/readiness` body. */
export interface SetupReadiness {
  ready: boolean;
  score: number;
  completedRequired: number;
  requiredCount: number;
  steps: ReadinessStep[];
}

export type SetupTabId = 'wordpress' | 'shopify' | 'custom';

export interface SetupGuideWorkspaceProps {
  readiness: SetupReadiness | null;
  readinessLoading: boolean;
  reloadReadiness: () => void;
  activeTab: SetupTabId;
  setActiveTab: (tab: SetupTabId) => void;
  pluginDownloadUrl: string;
  /** Version · tested-up-to · size, already formatted; "" when unknown. */
  pluginVersionLine: string;
  faqs: readonly { q: string; a: string }[];
  faqExpanded: number | null;
  setFaqExpanded: (index: number | null) => void;
  goToPage: (page: string) => void;
  openPortalSection: (pageId: string, sectionId?: string) => void;
}

/**
 * The checklist. `proof` names the readiness step whose `ready` flag settles the
 * row — null means the backend cannot see it and the merchant confirms it in
 * WordPress. Order is the order a store actually completes them in, which is why
 * the numbers are real information here rather than decoration.
 */
const CHECKLIST: {
  id: string;
  title: string;
  body: React.ReactNode;
  proof: 'domain' | 'plugin' | 'destination' | 'delivery' | null;
  action?: 'domain' | 'download' | 'platforms' | 'events' | 'recheck' | 'logs';
}[] = [
  {
    id: 'domain',
    title: 'Add your store domain',
    body: <>Every event is stamped with the store it came from. Save the domain your shop runs on before you connect anything else.</>,
    proof: 'domain',
    action: 'domain',
  },
  {
    id: 'install',
    title: 'Install the WordPress plugin',
    body: <>Download Buykori AdSync, then in WordPress open <b>Plugins → Add New → Upload Plugin</b>. Upload the ZIP and activate it.</>,
    proof: 'plugin',
    action: 'download',
  },
  {
    id: 'connect',
    title: 'Connect your Buykori account',
    body: <>Open Buykori AdSync inside WordPress and click <b>Connect Buykori Account</b>. Log in, approve the website, and the plugin links itself.</>,
    proof: 'plugin',
  },
  {
    id: 'destination',
    title: 'Connect one tracking destination',
    body: <>In <b>Settings → Conversions API</b>, add the ID and access token for Meta, TikTok or GA4. One platform is enough to start.</>,
    proof: 'destination',
    action: 'platforms',
  },
  {
    id: 'events',
    title: 'Choose which events to send',
    body: <>Turn on only the events you need. A good starting list: <b>PageView, ViewContent, AddToCart, InitiateCheckout, Purchase</b>.</>,
    proof: null,
    action: 'events',
  },
  {
    id: 'health',
    title: 'Run the WordPress connection test',
    body: <>In Buykori AdSync click <b>Run Health Check</b>. A pass means WordPress and Buykori are talking to each other.</>,
    proof: null,
    action: 'recheck',
  },
  {
    id: 'verify',
    title: 'Send and verify a test event',
    body: <>Send one test event, then find it in Delivery logs. If it fails, re-check the ID and token from step 4.</>,
    proof: 'delivery',
    action: 'logs',
  },
];

/** Ids of the rows that print the evidence line. "Install the plugin" and "Connect
 *  your account" are both proved by the one heartbeat, so the heartbeat sentence
 *  belongs to the first of them rather than being repeated on both. */
const EVIDENCE_ROWS = new Set(
  CHECKLIST
    .filter((row, index) => row.proof !== null && CHECKLIST.findIndex(other => other.proof === row.proof) === index)
    .map(row => row.id),
);

const NEXT_STEPS = [
  { title: 'Courier logistics', text: 'Book shipments in one click and read delivery updates back into your orders.', icon: Truck, page: 'orders', proof: 'courier' },
  { title: 'COD review', text: 'Hold the Purchase event until you confirm each cash-on-delivery order.', icon: ShieldCheck, page: 'pending-purchases', proof: null },
  { title: 'WhatsApp confirmations', text: 'Ask each cash-on-delivery customer to confirm their order on WhatsApp before you ship it.', icon: MessageCircle, page: 'settings', proof: null },
];

const BEFORE_YOU_START = [
  { icon: UserRound, text: 'Admin access to your WordPress store' },
  { icon: KeyRound, text: 'ID and access token for one ad platform' },
  { icon: ShoppingCart, text: 'One product, or a test order' },
  { icon: Clock3, text: 'About 5–10 minutes' },
];

/** Row state, derived only from what the backend can actually prove. */
type RowState = { tone: BadgeTone; label: string; done: boolean; evidence: string | null };

const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The `plugin` step's `detail` is a raw `heartbeat.isoformat()` — "2026-05-24T13:10:12"
 * means nothing to a merchant, and on a failed step it looks like a passing timestamp.
 * Anything else the backend sends ("33 successful in 7 days", "Meta, TikTok") is already
 * a sentence and is printed untouched.
 */
function readableEvidence(detail: string | null, done: boolean): string | null {
  if (!detail) return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(detail.trim())) return detail;
  const at = new Date(detail);
  if (Number.isNaN(at.getTime())) return detail;
  const when = at.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  return done ? `WordPress last checked in ${when}` : `Last heard from WordPress ${when} — nothing since`;
}

export function SetupGuideWorkspace({
  readiness,
  readinessLoading,
  reloadReadiness,
  activeTab,
  setActiveTab,
  pluginDownloadUrl,
  pluginVersionLine,
  faqs,
  faqExpanded,
  setFaqExpanded,
  goToPage,
  openPortalSection,
}: SetupGuideWorkspaceProps) {
  const [beforeStartOpen, setBeforeStartOpen] = React.useState(false);

  const stepByKey = React.useMemo(() => {
    const map = new Map<string, ReadinessStep>();
    (readiness?.steps ?? []).forEach(step => map.set(step.key, step));
    return map;
  }, [readiness]);

  const score = Math.max(0, Math.min(100, readiness?.score ?? 0));
  const completed = readiness?.completedRequired ?? 0;
  const requiredCount = readiness?.requiredCount ?? 0;
  const allReady = readiness?.ready ?? false;
  const remaining = Math.max(0, requiredCount - completed);
  const firstOpenStep = (readiness?.steps ?? []).find(step => step.required && !step.ready) ?? null;
  const courierStep = stepByKey.get('courier') ?? null;

  const rowState = (proof: (typeof CHECKLIST)[number]['proof']): RowState => {
    if (proof === null) return { tone: 'neutral', label: 'You confirm this', done: false, evidence: null };
    if (!readiness) return { tone: 'neutral', label: readinessLoading ? 'Checking…' : 'Not checked', done: false, evidence: null };
    const step = stepByKey.get(proof);
    if (!step) return { tone: 'neutral', label: 'Not checked', done: false, evidence: null };
    return {
      tone: step.ready ? 'success' : 'warning',
      label: step.ready ? 'Done' : 'To do',
      done: step.ready,
      evidence: readableEvidence(step.detail ?? null, step.ready),
    };
  };

  const doneCount = CHECKLIST.filter(row => rowState(row.proof).done).length;
  const rowAction = (action: (typeof CHECKLIST)[number]['action']) => {
    switch (action) {
      case 'domain':
        return { label: 'Open domain settings', run: () => openPortalSection('settings', 'settings-domain') };
      case 'platforms':
        return { label: 'Open Conversions API settings', run: () => openPortalSection('settings', 'settings-platforms') };
      case 'events':
        return { label: 'Choose events', run: () => openPortalSection('settings', 'settings-routing') };
      case 'recheck':
        return { label: 'Run the checks again', run: reloadReadiness };
      case 'logs':
        return { label: 'Open Delivery logs', run: () => goToPage('event-logs') };
      default:
        return null;
    }
  };

  const tabs: readonly TabItem<SetupTabId>[] = [
    { id: 'wordpress', label: 'WordPress' },
    { id: 'shopify', label: 'Shopify' },
    { id: 'custom', label: 'Custom site' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="ADMINISTRATION"
        title="Setup guide"
        description="Connect your store once. Each step below is ticked by a check on your live settings, not by a counter."
        action={
          <Button variant="secondary" onClick={reloadReadiness} disabled={readinessLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${readinessLoading ? 'animate-spin' : ''}`} />
            {readinessLoading ? 'Checking…' : 'Check again'}
          </Button>
        }
      />
      {/* The page's one bold element: a ring that reports the real score. The
          prototype's .progress-ring is a fixed 4px border with one tinted edge,
          so it shows the same picture at 25% and at 75%; this one cannot. */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`relative shrink-0 ${allReady ? 'text-emerald-600' : 'text-[var(--bk-console-blue)]'}`}
              role="img"
              aria-label={`${score}% of required checks pass`}
            >
              <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
                <circle cx="36" cy="36" r={RING_RADIUS} fill="none" strokeWidth="5" stroke="var(--bk-console-border)" />
                <circle
                  cx="36"
                  cy="36"
                  r={RING_RADIUS}
                  fill="none"
                  strokeWidth="5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeDasharray={RING_LENGTH}
                  strokeDashoffset={RING_LENGTH * (1 - score / 100)}
                  transform="rotate(-90 36 36)"
                  className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center text-caption font-extrabold">{score}%</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-subtitle font-semibold text-[var(--bk-console-text)]">
                {readinessLoading && !readiness
                  ? 'Checking your store…'
                  : allReady
                    ? 'Every required check passes'
                    : remaining === 1
                      ? 'One required check left'
                      : `${remaining} required checks left`}
              </h2>
              <p className="mt-1.5 text-caption leading-relaxed text-[var(--bk-console-text-muted)]">
                {completed} of {requiredCount || '—'} required checks pass
                {firstOpenStep ? <> · next up: {firstOpenStep.label.toLowerCase()}</> : null}
                {courierStep ? <> · courier keys {courierStep.ready ? 'saved' : 'optional'}</> : null}
              </p>
            </div>
          </div>
          {firstOpenStep && (
            <Button variant="primary" onClick={() => goToPage(firstOpenStep.actionPage)}>
              {firstOpenStep.actionLabel}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <Card flush padding="none">
          <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} label="Store platform" idPrefix="setup-platform" size="sm" className="px-2" />

          <TabPanel idPrefix="setup-platform" tabId="wordpress" activeId={activeTab}>
            <div className="px-4 pt-4 pb-3.5">
              <SectionTitle
                title="WooCommerce tracking setup"
                detail="Seven steps, in the order a store completes them."
                action={<Badge tone={doneCount === CHECKLIST.length ? 'success' : 'neutral'}>{doneCount} of {CHECKLIST.length} verified</Badge>}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--bk-console-border)] bg-[var(--bk-console-surface-muted)] px-4 py-3">
              <div className="min-w-0">
                <p className="text-caption font-semibold text-[var(--bk-console-text)]">Buykori AdSync plugin</p>
                <p className="mt-0.5 text-label text-[var(--bk-console-text-subtle)]">
                  {pluginVersionLine || 'Latest WordPress package'}
                </p>
              </div>
              {/* A real link, not the shared Button: `Button` renders a <button> and
                  cannot carry href, and the download must survive a middle-click.
                  It wears the primary button's shape by hand, so it has to be kept
                  in step with it — radius token, lift and 12px label included. */}
              <a
                href={pluginDownloadUrl}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--bk-radius-button)] border border-[var(--bk-console-blue)] bg-[var(--bk-console-blue)] px-4 text-caption font-extrabold text-white shadow-[0_1px_2px_rgba(25,39,51,.12)] transition-colors hover:border-[var(--bk-console-blue-hover)] hover:bg-[var(--bk-console-blue-hover)]"
              >
                <Download className="h-3.5 w-3.5" />
                Download ZIP
              </a>
            </div>

            <ol className="list-none">
              {CHECKLIST.map((row, index) => {
                const state = rowState(row.proof);
                const action = rowAction(row.action);
                return (
                  <li key={row.id} className="flex gap-3 border-b border-[var(--bk-console-border)] px-4 py-3.5 last:border-b-0">
                    <span
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-label font-extrabold ${
                        state.done
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-[var(--bk-control-border)] bg-[var(--bk-console-surface)] text-[var(--bk-console-text-muted)]'
                      }`}
                      aria-hidden="true"
                    >
                      {state.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-caption font-semibold leading-normal text-[var(--bk-console-text)]">{row.title}</h3>
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </div>
                      <p className="mt-1 text-label leading-relaxed text-[var(--bk-console-text-muted)]">{row.body}</p>
                      {/* The backend's own words for why this row passed or failed —
                          a heartbeat time, the ready destinations, a delivery count. */}
                      {state.evidence && EVIDENCE_ROWS.has(row.id) && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-label leading-relaxed text-[var(--bk-console-text-subtle)]">
                          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${state.done ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
                          <span className="min-w-0 break-words">{state.evidence}</span>
                        </p>
                      )}
                      {row.proof === null && (
                        <p className="mt-1.5 text-label leading-relaxed text-[var(--bk-console-text-subtle)]">
                          Buykori cannot see this one — confirm it inside WordPress.
                        </p>
                      )}
                      {(action || row.action === 'download') && (
                        <div className="mt-2.5 flex flex-wrap gap-2">
                          {/* These are the step's own doorways — "Open domain
                              settings", "Choose events" — so they are the thing to
                              press on the row. At 11px in a paragraph of 11px body
                              text they disappeared into it; 12px extra-bold on the
                              full-width padding reads as a control. */}
                          {action && (
                            <Button variant="secondary" onClick={action.run} className="whitespace-nowrap text-caption font-extrabold">
                              {action.label}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </TabPanel>

          {(['shopify', 'custom'] as const).map(tab => (
            <TabPanel key={tab} idPrefix="setup-platform" tabId={tab} activeId={activeTab}>
              <div className="px-6 py-10 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]">
                  <Clock3 className="h-5 w-5" />
                </span>
                <h3 className="mt-3.5 text-subtitle font-semibold text-[var(--bk-console-text)]">
                  {tab === 'shopify' ? 'Shopify setup' : 'Custom site setup'} is not open yet
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-caption leading-relaxed text-[var(--bk-console-text-muted)]">
                  This guide opens once the tracking flow passes production testing. WooCommerce works today.
                </p>
              </div>
            </TabPanel>
          ))}
        </Card>
        <div className="space-y-4">
          {/* Collapsed by default: it is a shopping list you read once, and it should
              not push the checklist down every time the page opens. */}
          <Card flush padding="none">
            <button
              type="button"
              onClick={() => setBeforeStartOpen(open => !open)}
              aria-expanded={beforeStartOpen}
              aria-controls="setup-before-start"
              className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="text-caption font-semibold text-[var(--bk-console-text)]">Before you start</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-[var(--bk-console-text-muted)] transition-transform ${beforeStartOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {beforeStartOpen && (
              <ul id="setup-before-start" className="list-none space-y-2.5 border-t border-[var(--bk-console-border)] px-4 py-3.5">
                {BEFORE_YOU_START.map(item => (
                  <li key={item.text} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[var(--bk-radius-control)] bg-[var(--bk-console-surface-muted)] text-[var(--bk-console-text-muted)]">
                      <item.icon className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 text-label leading-relaxed text-[var(--bk-console-text-body)]">{item.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* "What's next" — only the courier card can be verified, so only it carries
              a state line. The other two link out without claiming anything. */}
          <Card flush padding="none">
            <div className="px-4 pt-4 pb-2.5">
              <SectionTitle as="h3" title="After tracking works" detail="Three things most stores turn on next." />
            </div>
            <ul className="list-none">
              {NEXT_STEPS.map(item => {
                const step = item.proof ? stepByKey.get(item.proof) : null;
                return (
                  <li key={item.title} className="border-t border-[var(--bk-console-border)]">
                    <button
                      type="button"
                      onClick={() => goToPage(item.page)}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--bk-console-surface-muted)]"
                    >
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[var(--bk-radius-control)] bg-[var(--bk-console-blue-soft)] text-[var(--bk-console-blue)]">
                        <item.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-caption font-semibold text-[var(--bk-console-text)]">{item.title}</span>
                          {step && <Badge tone={step.ready ? 'success' : 'neutral'}>{step.ready ? 'Keys saved' : 'Not set up'}</Badge>}
                        </span>
                        <span className="mt-1 block text-label leading-relaxed text-[var(--bk-console-text-muted)]">{item.text}</span>
                      </span>
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--bk-console-text-subtle)]" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Card flush padding="none">
        <div className="px-4 pt-4 pb-2.5">
          <SectionTitle
            title="Common questions"
            detail="The four things stores ask most often during setup."
            action={
              <span className="flex items-center gap-1.5 text-label text-[var(--bk-console-text-subtle)]">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                {faqs.length} answers
              </span>
            }
          />
        </div>
        <dl className="list-none">
          {faqs.map((faq, index) => {
            const open = faqExpanded === index;
            const panelId = `setup-faq-panel-${index}`;
            return (
              <div key={faq.q} className="border-t border-[var(--bk-console-border)]">
                <dt>
                  <button
                    type="button"
                    onClick={() => setFaqExpanded(open ? null : index)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0 text-caption font-semibold text-[var(--bk-console-text)]">{faq.q}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-[var(--bk-console-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </dt>
                {open && (
                  <dd id={panelId} className="px-4 pb-3.5 text-label leading-relaxed text-[var(--bk-console-text-body)]">
                    {faq.a}
                  </dd>
                )}
              </div>
            );
          })}
        </dl>
      </Card>
    </>
  );
}

export default SetupGuideWorkspace;
