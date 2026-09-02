import React from 'react';
import { AlertTriangle, CheckCircle2, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import type { WhatsAppStatus } from '../../services/whatsappApi';

interface WhatsAppConnectSectionProps {
  status: WhatsAppStatus | null;
  /** True while connect/disconnect is in flight. */
  busy: boolean;
  /** True while the automatic-sending switch is being saved. */
  autoSendBusy?: boolean;
  connectWhatsApp: () => void;
  disconnectWhatsApp: () => void;
  refreshWhatsApp: () => void;
  setAutoSend?: (autoSend: boolean) => void;
}

const formatMoment = (value: string | null): string => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
};

/** 22 -> "10 PM", 9 -> "9 AM" — merchants do not read a 24-hour clock. */
const formatHour = (hour: number): string => {
  const normalized = ((Math.trunc(hour) % 24) + 24) % 24;
  const suffix = normalized < 12 ? 'AM' : 'PM';
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display} ${suffix}`;
};

/** "8801712345678" reads better as "+880 1712 345678". */
const formatPhone = (value: string | null): string => {
  if (!value) return 'Number not reported yet';
  const digits = value.replace(/[^\d]/g, '');
  if (digits.length === 13 && digits.startsWith('880')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
  }
  return value.startsWith('+') ? value : `+${digits || value}`;
};

const WhatsAppConnectSection: React.FC<WhatsAppConnectSectionProps> = ({
  status,
  busy,
  autoSendBusy = false,
  connectWhatsApp,
  disconnectWhatsApp,
  refreshWhatsApp,
  setAutoSend,
}) => {
  const session = status?.session;
  const connected = Boolean(status?.connected);
  const pairing = session?.status === 'qr_pending' || session?.status === 'connecting';
  const dailyLimit = session?.dailyLimit || 0;
  const dailySent = session?.dailySentCount || 0;
  const dailyPercent = dailyLimit > 0 ? Math.min(100, Math.round((dailySent / dailyLimit) * 100)) : 0;
  const quotaSpent = dailyLimit > 0 && dailySent >= dailyLimit;
  const autoSend = Boolean(status?.autoSend);
  const quietHours = status?.autoSendQuietHours;
  const canChangeAutoSend = Boolean(
    setAutoSend && status?.available && status.hasPlanAccess && !autoSendBusy,
  );

  return (
    <section id="settings-whatsapp" aria-labelledby="settings-whatsapp-title" className="scroll-mt-28 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="settings-whatsapp-title" className="text-sm font-bold text-slate-900">WhatsApp order confirmations</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Link this store&apos;s own WhatsApp number once by scanning a QR code. You can then ask a COD
            customer to reply <b>1</b> to confirm or <b>2</b> to cancel, and the order moves on its own —
            no phone call needed.
          </p>
        </div>
        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : pairing ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
          {connected ? 'Connected' : pairing ? 'Scan QR' : 'Not connected'}
        </span>
      </div>
      {status && !status.available && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            WhatsApp order confirmations are not switched on for this server yet. Nothing is sent and no
            number can be linked until Buykori enables it.
          </p>
        </div>
      )}

      {status?.available && !status.hasPlanAccess && (
        <div className="flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            WhatsApp order confirmations are part of the Growth plan. Upgrade your plan to link a number
            and send confirmation requests.
          </p>
        </div>
      )}

      {/* Ban risk, stated before the merchant links anything. Pressing Connect is
          the consent, so the terms have to be on screen next to it — not hidden
          in a help page. Deliberately blunt: a banned number cannot be appealed. */}
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs leading-relaxed text-rose-900">
        <p className="flex items-center gap-1.5 font-black">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Read this before you link a number
        </p>
        <ul className="mt-2 list-disc space-y-1.5 pl-4">
          <li>
            We send a confirmation message for <b>every order</b>. A busy store can mean hundreds of
            messages a day going out from this one number.
          </li>
          <li>
            WhatsApp can block or ban a normal number that sends that many messages. That is WhatsApp&apos;s
            own decision and it cannot be appealed, so <b>Buykori takes no responsibility for a number that
            gets banned</b> — including the chats, contacts and groups on it.
          </li>
          <li>
            <b>We strongly recommend linking a separate number</b> that you keep only for order
            confirmations — a new WhatsApp Business number is ideal. Please do not link your personal
            number, or the one number your whole business depends on.
          </li>
          <li>
            It is your number and your decision. Nothing is ever sent until you link one, and you can
            disconnect at any time.
          </li>
        </ul>
      </div>

      {status?.gatewayError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            The WhatsApp service could not be reached: {status.gatewayError} Your linked number is not lost —
            try again in a moment.
          </p>
        </div>
      )}

      {connected ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                <CheckCircle2 className="h-4 w-4" /> WhatsApp is linked
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-mono text-sm font-black text-emerald-900">
                <Smartphone className="h-4 w-4 shrink-0" /> {formatPhone(session?.phoneNumber ?? null)}
              </p>
              <p className="mt-1 text-xs text-emerald-800">
                {session?.deviceLabel ? `${session.deviceLabel} · ` : ''}Linked on {formatMoment(session?.connectedAt ?? null)}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Keep the phone that scanned this QR online and open WhatsApp on it at least once every 14 days,
                or WhatsApp itself will unlink this device.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={refreshWhatsApp}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
              >
                <RefreshCw className="h-4 w-4" /> Check
              </button>
              <button
                type="button"
                onClick={disconnectWhatsApp}
                disabled={busy}
                className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                Disconnect
              </button>
            </div>
          </div>

          {dailyLimit > 0 && (
            <div className="mt-4 rounded-lg bg-white p-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Today&apos;s confirmation messages</span>
                <span className={quotaSpent ? 'text-rose-600' : 'text-slate-500'}>{dailySent} / {dailyLimit}</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${quotaSpent ? 'bg-rose-500' : dailyPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${dailyPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {quotaSpent
                  ? 'Today’s limit is used up. Sending resumes automatically tomorrow.'
                  : 'A daily ceiling keeps your own number safe — a normal number that suddenly sends hundreds of messages gets reported and banned.'}
              </p>
            </div>
          )}

          {/* Manual vs automatic. Off by default: automating a personal number
              carries a suspension risk the merchant must opt into knowingly. */}
          <div className="mt-4 rounded-lg bg-white p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800">Send confirmations automatically</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {autoSend
                    ? 'New orders get the confirmation request by themselves, a few minutes after the order arrives. You can still send any order by hand from Order Management.'
                    : 'Off — you press the WhatsApp button in Order Management for each order. Turn this on if you get too many orders to click one by one.'}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Each order is asked once only, the daily ceiling above still applies, and
                  {quietHours
                    ? ` nothing is sent between ${formatHour(quietHours.start)} and ${formatHour(quietHours.end)}`
                    : ' nothing is sent at night'} so a late-night message never gets your number reported.
                </p>
                {/* The reply acknowledgement costs a second slot, so the counter
                    above moves by two on an answered order. Saying so here stops
                    it reading like a miscount. */}
                <p className="mt-2 text-xs text-slate-500">
                  A customer who replies 1 or 2 gets one short confirmation back, so an answered
                  order uses two of today&apos;s messages.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoSend}
                aria-label="Send WhatsApp confirmations automatically"
                onClick={() => { if (canChangeAutoSend) setAutoSend?.(!autoSend); }}
                disabled={!canChangeAutoSend}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-60 ${autoSend ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-slate-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${autoSend ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <p className="text-xs font-black text-indigo-950">Connect in three simple steps</p>
            <ol className="mt-3 grid gap-3 text-xs leading-relaxed text-indigo-900 md:grid-cols-3">
              <li className="rounded-lg bg-white p-3"><b className="block text-indigo-600">1. Press Connect</b>A QR code appears here.</li>
              <li className="rounded-lg bg-white p-3"><b className="block text-indigo-600">2. Open WhatsApp on your phone</b>Settings → Linked devices → Link a device.</li>
              <li className="rounded-lg bg-white p-3"><b className="block text-indigo-600">3. Scan the code</b>The status turns green and stays linked across restarts.</li>
            </ol>
          </div>

          {session?.lastError && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p><b>Last WhatsApp message:</b> {session.lastError}</p>
            </div>
          )}

          {status?.qr ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <img
                  src={status.qr}
                  alt="WhatsApp linking QR code"
                  className="h-48 w-48 shrink-0 rounded-lg border border-slate-200 bg-white p-2"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Scan within 20 seconds</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    On the phone that owns this store&apos;s WhatsApp number, open <b>WhatsApp → Settings →
                    Linked devices → Link a device</b> and point the camera at this code. A fresh code appears
                    here automatically if this one expires.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Use the number your customers already know. Once linked it stays linked — a server restart
                    does not ask you to scan again.
                  </p>
                  <button
                    type="button"
                    onClick={refreshWhatsApp}
                    className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                  >
                    <RefreshCw className="h-4 w-4" /> New code
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={connectWhatsApp}
              disabled={busy || !status?.available || !status?.hasPlanAccess}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <QrCode className="h-4 w-4" />
              {busy ? 'Preparing QR code…' : pairing ? 'Waiting for the QR code…' : 'Connect WhatsApp'}
            </button>
          )}
        </div>
      )}

    </section>
  );
};

export default WhatsAppConnectSection;
