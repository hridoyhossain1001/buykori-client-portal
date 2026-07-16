import React from 'react';
import { FileText, Loader2, MessageCircle, Paperclip, RefreshCw, Send, X } from 'lucide-react';

type Ticket = {
  id: number;
  subject: string;
  status: string;
  createdAt: string | null;
  adminNote?: string;
};

const csrfToken = () => document.cookie
  .split(';')
  .map(part => part.trim())
  .find(part => part.startsWith('buykori_client_csrf='))
  ?.split('=', 2)[1] || '';

export function SupportWidget({ showToast }: { showToast: (message: string, isError?: boolean) => void }) {
  const [open, setOpen] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [priority, setPriority] = React.useState('normal');
  const [files, setFiles] = React.useState<File[]>([]);
  const [tickets, setTickets] = React.useState<Ticket[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const loadTickets = React.useCallback(async () => {
    const response = await fetch('/api/support/tickets');
    if (response.ok) {
      const data = await response.json();
      setTickets(data.tickets || []);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    loadTickets().catch(() => {});
    const timer = window.setInterval(() => loadTickets().catch(() => {}), 20_000);
    return () => window.clearInterval(timer);
  }, [open, loadTickets]);

  const selectFiles = (selected: File[]) => {
    if (selected.length > 3) {
      showToast('Attach at most 3 files.', true);
      return;
    }
    if (selected.some(file => file.size > 2 * 1024 * 1024)) {
      showToast('Each attachment must be 2 MB or smaller.', true);
      return;
    }
    if (selected.reduce((total, file) => total + file.size, 0) > 4 * 1024 * 1024) {
      showToast('Total attachments must be 4 MB or smaller.', true);
      return;
    }
    setFiles(selected);
  };

  const refreshTickets = async () => {
    setRefreshing(true);
    try {
      await loadTickets();
    } finally {
      setRefreshing(false);
    }
  };

  const statusClass = (status: string) => {
    if (status === 'resolved' || status === 'closed') return 'bg-emerald-50 text-emerald-700';
    if (status === 'in_progress') return 'bg-amber-50 text-amber-700';
    return 'bg-indigo-50 text-indigo-700';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('subject', subject);
      form.append('message', message);
      form.append('priority', priority);
      files.forEach(file => form.append('attachments', file));
      const token = csrfToken();
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: token ? { 'X-Client-CSRF-Token': token } : {},
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || 'Could not submit support request.');
      setSubject('');
      setMessage('');
      setPriority('normal');
      setFiles([]);
      await loadTickets();
      showToast(`Support ticket #${data.ticket.id} submitted.`, false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Support request failed.', true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Buykori support"
        className="fixed bottom-5 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-xl transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-end bg-slate-900/30 p-0 backdrop-blur-sm sm:p-5">
          <div className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h2 className="text-sm font-bold text-slate-900">Buykori Support</h2><p className="text-[11px] text-slate-500">Share the problem with screenshots or documents.</p></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto p-5">
              <form onSubmit={submit} className="space-y-3">
                <input required maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} placeholder="What do you need help with?" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                <textarea required minLength={10} maxLength={5000} rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe what happened, what you expected, and any error shown." className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-xs" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={priority} onChange={e => setPriority(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs"><option value="normal">Normal priority</option><option value="high">High priority</option></select>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Paperclip className="h-3.5 w-3.5" /> Attach files<input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" className="hidden" onChange={e => selectFiles(Array.from(e.target.files || []))} /></label>
                </div>
                <p className="text-[10px] text-slate-400">Up to 3 files, 2 MB each and 4 MB total.</p>
                {files.length > 0 && <p className="text-[10px] text-slate-500">{files.map(file => file.name).join(', ')} &middot; {files.length} selected</p>}
                <button disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit request</button>
              </form>
              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent requests</h3>
                  <button type="button" onClick={refreshTickets} disabled={refreshing} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-60"><RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh</button>
                </div>
                <div className="mt-3 space-y-2">
                  {tickets.slice(0, 5).map(ticket => <div key={ticket.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-bold text-slate-800"><FileText className="mr-1 inline h-3.5 w-3.5" />#{ticket.id} {ticket.subject}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusClass(ticket.status)}`}>{ticket.status.replace('_', ' ')}</span></div>{ticket.adminNote && <div className="mt-2 rounded-md bg-emerald-50 px-2.5 py-2 text-[10px] leading-4 text-emerald-800"><span className="font-bold">Buykori Support:</span> {ticket.adminNote}</div>}</div>)}
                  {!tickets.length && <p className="text-[11px] text-slate-400">No support requests yet.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
