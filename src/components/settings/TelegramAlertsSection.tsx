import React from 'react';
import { Copy, MessageCircle, RefreshCw } from 'lucide-react';

export interface TelegramNotificationStatus {
  available: boolean;
  connected: boolean;
  botUsername?: string | null;
  telegramUsername?: string | null;
  telegramFirstName?: string | null;
  linkedAt?: string | null;
}

export interface TelegramLinkCode {
  code: string;
  expiresAt: string;
  expiresInMinutes: number;
  botUsername?: string | null;
  botUrl?: string | null;
  deepLinkUrl?: string | null;
}

interface TelegramAlertsSectionProps {
  telegramStatus: TelegramNotificationStatus | null;
  telegramLinkCode: TelegramLinkCode | null;
  telegramBusy: boolean;
  handleCopy: (text: string, labelId: string) => void;
  loadTelegramStatus: () => void;
  generateTelegramLinkCode: () => void;
  disconnectTelegram: () => void;
}

const SECURE_PROTOCOL = 'https:';
const TELEGRAM_HOST = 't.me';

const TelegramAlertsSection: React.FC<TelegramAlertsSectionProps> = ({
  telegramStatus,
  telegramLinkCode,
  telegramBusy,
  handleCopy,
  loadTelegramStatus,
  generateTelegramLinkCode,
  disconnectTelegram,
}) => {
  const telegramBotUrl = `${SECURE_PROTOCOL}//${TELEGRAM_HOST}/${telegramStatus?.botUsername ?? ''}`;

  return (
        <section id="settings-whatsapp" aria-labelledby="settings-telegram-title" className="scroll-mt-28 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 id="settings-telegram-title" className="text-sm font-bold text-slate-900">Telegram alerts</h2>
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
                  href={telegramBotUrl}
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
                  href={telegramBotUrl}
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
  );
};

export default TelegramAlertsSection;
