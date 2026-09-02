/**
 * Pure presenters for the AI Ads proposal review surface (Phase C2).
 *
 * The whole promise of AI Ads is "the client decides". For that to be true, a merchant has to be able
 * to *read* a proposal before deciding: what operation, how risky, what exactly changes, and how long
 * the approval is still valid. Every function here is pure and unit-tested so the review card that
 * consumes them stays declarative.
 *
 * Data note (verified against the backend): `exact_changes` is NOT a before→after diff — the API sets
 * it to `{ operation, arguments }` (proposal_service.py:49). The real diff is computed here by
 * comparing `before_state` against `requested_state`. See `buildChangeRows`.
 */
import type { AiAdsProposal } from '../../services/aiAdsApi';

/** Mirrors the (unexported) tone union of `common/Badge.tsx`; assignable to its `tone` prop. */
export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

/** `pause_campaign` → "Pause campaign". Falls back to a readable placeholder for an empty value. */
export function describeOperation(operation: unknown): string {
  const text = typeof operation === 'string' ? operation.trim() : '';
  if (!text) return 'Proposed change';
  const spaced = text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Risk → Badge tone. Escalates green → amber → red; HIGH and CRITICAL both read as danger (there is
 * no darker-red tone available) and are distinguished by the badge's own text.
 */
export function riskTone(risk: unknown): BadgeTone {
  switch (String(risk ?? '').trim().toUpperCase()) {
    case 'LOW':
      return 'success';
    case 'MEDIUM':
      return 'warning';
    case 'HIGH':
    case 'CRITICAL':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * Status/health word → Badge tone, carrying the exact mapping the old inline `Status` pill used so the
 * console reads identically after the swap: success/connected/low/active → success;
 * fail/block/critical → danger; high/pending/queue → warning; everything else neutral.
 */
export function statusTone(value: unknown): BadgeTone {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized.includes('success') || normalized.includes('connected') || normalized === 'low' || normalized === 'active') return 'success';
  if (normalized.includes('fail') || normalized.includes('block') || normalized === 'critical') return 'danger';
  if (normalized === 'high' || normalized.includes('pending') || normalized.includes('queue')) return 'warning';
  return 'neutral';
}

export type ProposalChangeRow = { field: string; label: string; before: string; after: string; isNew: boolean };

/** `snake_case` → "Snake case" for a field label. */
function humanizeField(field: string): string {
  const spaced = field.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return field;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Compact, human-readable rendering of one field value. Objects/arrays become JSON; absent is `—`. */
export function formatStateValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.trim() === '' ? '—' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * The proposal diff a merchant actually reads. One row per key in `requested_state`; `before` is taken
 * from `before_state` (or `—`, with `isNew` set, when the key is not present before). This — not
 * `exact_changes` — is the authoritative diff, because `exact_changes` is `{ operation, arguments }`,
 * not a field-level before/after.
 */
export function buildChangeRows(before: unknown, requested: unknown): ProposalChangeRow[] {
  const beforeObj = before && typeof before === 'object' ? (before as Record<string, unknown>) : {};
  const requestedObj = requested && typeof requested === 'object' ? (requested as Record<string, unknown>) : {};
  return Object.keys(requestedObj).map(field => {
    const present = Object.prototype.hasOwnProperty.call(beforeObj, field) && beforeObj[field] !== undefined && beforeObj[field] !== null;
    return {
      field,
      label: humanizeField(field),
      before: present ? formatStateValue(beforeObj[field]) : '—',
      after: formatStateValue(requestedObj[field]),
      isNew: !present,
    };
  });
}

export type ExpiryState = { expired: boolean; minutesLeft: number; label: string };

/**
 * How much of the approval window is left. A proposal expires 30 minutes after creation
 * (proposal_service.py:71); once past that, queueing produces a 409, so the card must say "expired"
 * rather than offer a button that will fail. `now` is passed in (`Date.now()`) to keep this pure.
 */
export function expiryState(expiresAt: unknown, now: number): ExpiryState {
  const parsed = typeof expiresAt === 'string' || typeof expiresAt === 'number' ? new Date(expiresAt).getTime() : NaN;
  if (!Number.isFinite(parsed)) return { expired: false, minutesLeft: NaN, label: 'No expiry set' };
  const diffMs = parsed - now;
  if (diffMs <= 0) return { expired: true, minutesLeft: 0, label: 'Approval window expired' };
  const minutesLeft = Math.ceil(diffMs / 60_000);
  return { expired: false, minutesLeft, label: minutesLeft === 1 ? 'Expires in 1 minute' : `Expires in ${minutesLeft} minutes` };
}

/** First 12 hex characters of a proposal hash + ellipsis; the full hash lives under Technical details. */
export function shortHash(hash: unknown): string {
  const text = typeof hash === 'string' ? hash.trim() : '';
  if (!text) return '';
  return text.length > 12 ? `${text.slice(0, 12)}…` : text;
}

/**
 * The confirm gate, unchanged from its original inline definition: only a pending, policy-allowed
 * proposal can be confirmed, and only while live writes are enabled — which they are not in
 * production. Kept here (pure) so both the review card and `AIAdsView` share one definition;
 * `AIAdsView` re-exports it so its existing test keeps importing it from there.
 */
export function proposalCanBeConfirmed(proposal: AiAdsProposal, writesEnabled: boolean): boolean {
  return writesEnabled && proposal.status === 'pending' && proposal.policy_decision.allowed !== false;
}
