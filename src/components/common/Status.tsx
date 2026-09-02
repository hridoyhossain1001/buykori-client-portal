import { Badge, type BadgeTone } from './Badge';

/**
 * Turns a status string into a coloured Badge, so a courier state, a payment
 * state and a delivery state all pick the same colour for the same meaning.
 * Ports the prototype's Status.
 *
 * Two deliberate departures from the prototype version:
 *
 *  - Matching is case- and separator-insensitive. The prototype only ever saw
 *    capitalised fixtures ("Delivered"), but the live API returns a mix —
 *    'Delivered' and 'failed' and 'PROPOSAL_READY' and 'action_required' all
 *    appear in the codebase. Matching the prototype's literal capitalisation
 *    would quietly render most real statuses grey.
 *  - `tone` can be passed explicitly, for a caller that knows the meaning and
 *    should not depend on keyword guessing.
 */

/**
 * Keyword groups, most severe first. **The order is the logic**: a value is
 * given the tone of the first group it matches, which is what keeps substrings
 * from winning over the words that contain them — 'invalid' is checked (danger)
 * before 'valid' (success), 'underpaid'/'overpaid' (warning) before 'paid'
 * (success), and 'unhealthy' (danger) before 'healthy' (success). Reordering
 * these rows changes behaviour; Status.test.tsx pins the cases that depend on it.
 */
const TONE_KEYWORDS: ReadonlyArray<readonly [BadgeTone, readonly string[]]> = [
  ['danger', [
    'high', 'critical', 'failed', 'failure', 'error', 'invalid', 'cancelled',
    'canceled', 'rejected', 'expired', 'dead', 'unhealthy', 'blocked', 'declined',
  ]],
  ['warning', [
    'medium', 'pending', 'warning', 'retry', 'retrying', 'review', 'needs',
    'action required', 'ambiguous', 'incomplete', 'underpaid', 'overpaid',
    'partial', 'paused', 'stale', 'queued',
  ]],
  ['success', [
    'delivered', 'ready', 'low', 'connected', 'healthy', 'paid', 'active',
    'valid', 'approved', 'resolved', 'recovered', 'confirmed', 'matched',
    'accepted', 'success', 'complete', 'live', 'enabled', 'passed',
  ]],
  ['info', ['transit', 'in progress', 'open', 'contacted', 'processing', 'sent', '200']],
];

/** Normalised so 'PROPOSAL_READY' and 'proposal-ready' match 'proposal ready'. */
const normalise = (value: string) => value.toLowerCase().replace(/[_-]+/g, ' ');

/**
 * The tone a status string maps to, or 'neutral' when nothing matches. Pure and
 * exported so the mapping is testable without rendering.
 */
export function statusTone(value: string): BadgeTone {
  const text = normalise(value);
  for (const [tone, keywords] of TONE_KEYWORDS) {
    if (keywords.some(keyword => text.includes(keyword))) return tone;
  }
  return 'neutral';
}

interface StatusProps {
  value: string;
  /** Overrides the keyword mapping when the caller already knows the meaning. */
  tone?: BadgeTone;
  /** Shows the Badge's leading dot. */
  dot?: boolean;
  className?: string;
}

export function Status({ value, tone, dot, className }: StatusProps) {
  return (
    <Badge tone={tone ?? statusTone(value)} dot={dot} className={className}>
      {value}
    </Badge>
  );
}

export default Status;
