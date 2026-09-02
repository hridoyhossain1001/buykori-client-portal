import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, MessageCircle, MessageSquareWarning, XCircle } from 'lucide-react';
import type { WhatsAppConfirmation } from '../../services/whatsappApi';

/**
 * The "WhatsApp" cell for one pending COD order.
 *
 * The merchant presses the button, the customer gets one "reply 1 to confirm /
 * 2 to cancel" message, and the badge here shows where that request got to. A
 * store that turned automatic sending on in Settings sees the same badges filled
 * in by the sweep instead of by a click. Renders nothing at all when the server
 * has the feature switched off, so the Orders table looks unchanged without it.
 */

interface WhatsAppConfirmCellProps {
  confirmation?: WhatsAppConfirmation | null;
  /** Server flag + gateway configured. */
  available: boolean;
  /** True once this store has linked a number in Settings. */
  connected: boolean;
  busy?: boolean;
  compact?: boolean;
  onSend: () => void;
}

type Tone = 'waiting' | 'confirmed' | 'cancelled' | 'neutral' | 'warning';

const TONE_CLASSES: Record<Tone, string> = {
  waiting: 'border-blue-200 bg-blue-50 text-blue-700',
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-500',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
};

interface Presentation {
  tone: Tone;
  label: string;
  /**
   * The same state in as few words as fit a table column. The Orders table gives
   * this cell 124px, and "No WhatsApp — call customer" simply spills out of it;
   * the full sentence still shows in the drawer and on hover.
   */
  shortLabel: string;
  icon: React.ReactNode;
  /** Statuses a merchant can usefully retry. "sent" is refused by the server. */
  resendable: boolean;
}

const describe = (confirmation: WhatsAppConfirmation, iconClass: string): Presentation => {
  switch (confirmation.status) {
    case 'confirmed':
      return { tone: 'confirmed', label: 'Confirmed by customer', shortLabel: 'Confirmed', icon: <CheckCircle2 className={iconClass} aria-hidden="true" />, resendable: false };
    case 'cancelled':
      return { tone: 'cancelled', label: 'Cancelled by customer', shortLabel: 'Cancelled', icon: <XCircle className={iconClass} aria-hidden="true" />, resendable: false };
    case 'sent':
      // The customer replied, just not with a usable 1 or 2 — "Waiting for reply"
      // would tell the merchant nothing happened, which is the opposite of true.
      return {
        tone: 'waiting',
        label: confirmation.customerNote ? 'Replied — no clear 1 or 2' : 'Waiting for reply',
        shortLabel: confirmation.customerNote ? 'Replied' : 'Awaiting reply',
        icon: <Clock3 className={iconClass} aria-hidden="true" />,
        resendable: false,
      };
    case 'pending':
      return { tone: 'waiting', label: 'Sending…', shortLabel: 'Sending…', icon: <Loader2 className={`${iconClass} animate-spin`} aria-hidden="true" />, resendable: false };
    case 'expired':
      return { tone: 'neutral', label: 'No reply', shortLabel: 'No reply', icon: <Clock3 className={iconClass} aria-hidden="true" />, resendable: true };
    case 'no_whatsapp':
      // Not a failure to retry blindly: this number has no WhatsApp account, so
      // the merchant has to phone the customer. Re-asking only helps after the
      // number itself is corrected in the store.
      return { tone: 'neutral', label: 'No WhatsApp — call customer', shortLabel: 'No WhatsApp', icon: <AlertTriangle className={iconClass} aria-hidden="true" />, resendable: true };
    default:
      return { tone: 'warning', label: 'Send failed', shortLabel: 'Failed', icon: <AlertTriangle className={iconClass} aria-hidden="true" />, resendable: true };
  }
};

const formatMoment = (value: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleString();
};

/** Everything the merchant needs on hover: what happened, when, and any error. */
const buildTitle = (confirmation: WhatsAppConfirmation): string => {
  const lines: string[] = [];
  const sentAt = formatMoment(confirmation.sentAt);
  if (sentAt) lines.push(`Asked at ${sentAt}`);
  const respondedAt = formatMoment(confirmation.respondedAt);
  if (respondedAt) lines.push(`Replied at ${respondedAt}`);
  if (confirmation.responseText) lines.push(`Customer said: "${confirmation.responseText}"`);
  if (confirmation.status === 'sent') {
    const expiresAt = formatMoment(confirmation.expiresAt);
    if (expiresAt) lines.push(`Reply window closes ${expiresAt}`);
  }
  if (confirmation.status === 'no_whatsapp') {
    lines.push('This number has no WhatsApp account. Call the customer, or fix the number in your store and ask again.');
  }
  if (confirmation.applyError) lines.push(`Order status could not be updated: ${confirmation.applyError}`);
  if (confirmation.errorMessage) lines.push(confirmation.errorMessage);
  return lines.join('\n');
};

export function WhatsAppConfirmCell({
  confirmation,
  available,
  connected,
  busy = false,
  compact = false,
  onSend,
}: WhatsAppConfirmCellProps) {
  // Dark feature: show nothing rather than a button that can only fail.
  if (!available) return null;

  const iconClass = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const pillSize = compact ? 'gap-1 px-2 py-0.5 text-[9px]' : 'gap-1.5 px-2.5 py-1 text-xs';

  const sendButton = (label: string) => (
    // Disabled goes flat grey rather than a faded green, and for a reason specific
    // to this pill: it is disabled whenever WhatsApp is not linked, so for a
    // merchant who never links it this is the *only* state they ever see. A 60%
    // fade measured 2.51:1 there — under the 4.5:1 floor for the label — and a
    // pale green pill still reads as an offer. Grey reads as "not yet available",
    // which is what the title attribute then explains.
    <button
      type="button"
      onClick={onSend}
      disabled={busy || !connected}
      title={connected ? 'Ask this customer to reply 1 to confirm or 2 to cancel' : 'Link your WhatsApp number in Settings first'}
      className={`inline-flex items-center whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-[var(--bk-control-disabled-border)] disabled:bg-[var(--bk-control-disabled-bg)] disabled:text-[var(--bk-control-disabled-text)] disabled:hover:bg-[var(--bk-control-disabled-bg)] ${pillSize}`}
    >
      {busy
        ? <Loader2 className={`${iconClass} animate-spin`} aria-hidden="true" />
        : <MessageCircle className={iconClass} aria-hidden="true" />}
      {busy ? 'Sending…' : label}
    </button>
  );

  if (!confirmation) return sendButton('WhatsApp');

  const { tone, label, shortLabel, icon, resendable } = describe(confirmation, iconClass);
  const title = buildTitle(confirmation);

  return (
    <span className={compact ? 'flex flex-wrap items-center gap-1' : 'flex flex-wrap items-center gap-1.5'}>
      <span
        title={title || label}
        className={`inline-flex items-center whitespace-nowrap rounded-full border font-bold ${TONE_CLASSES[tone]} ${pillSize}`}
      >
        {icon}
        {compact ? shortLabel : label}
      </span>
      {resendable && sendButton('Ask again')}
      {/* The customer wrote more than "1"/"2" — an address change, a question, a
          delivery date. This cannot live in the tooltip: there is no hover on a
          phone, and a confirmation that also changes the address is the one thing
          the merchant must read before shipping. */}
      {confirmation.customerNote && (
        <span className="flex w-full min-w-0 flex-col gap-0.5">
          <span className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full border font-bold ${TONE_CLASSES.warning} ${pillSize}`}>
            <MessageSquareWarning className={iconClass} aria-hidden="true" />
            Customer wrote a note
          </span>
          <span
            className={`min-w-0 break-words italic text-[var(--bk-console-text-muted)] ${compact ? 'text-[9px]' : 'text-xs'}`}
            title={confirmation.customerNote}
          >
            “{confirmation.customerNote}”
          </span>
        </span>
      )}
      {/* A reply landed but the order status could not be moved — the merchant
          has to change it by hand, so it cannot be hidden in a tooltip only. */}
      {confirmation.applyError && (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full border font-bold ${TONE_CLASSES.warning} ${pillSize}`} title={confirmation.applyError}>
          <AlertTriangle className={iconClass} aria-hidden="true" />
          Update failed
        </span>
      )}
    </span>
  );
}

export default WhatsAppConfirmCell;
