import React from 'react';
import { FileText, Loader2, MessageCircle, Paperclip, Send, X } from 'lucide-react';

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

  const loadTickets = React.useCallback(async () => {
    const response = await fetch('/api/support/tickets');
    if (response.ok) {
      const data = await response.json();
      setTickets(data.tickets || []);
    }
  }, []);

  React.useEffect(() => {
    if (open) loadTickets().catch(() => {});
  }, [open, loadTickets]);

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
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><Paperclip className="h-3.5 w-3.5" /> Attach files<input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" className="hidden" onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 3))} /></label>
                </div>
                {files.length > 0 && <p className="text-[10px] text-slate-500">{files.map(file => file.name).join(', ')} · max 2 MB each</p>}
                <button disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit request</button>
              </form>
              <div className="mt-6 border-t border-slate-100 pt-4">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent requests</h3>
                <div className="mt-3 space-y-2">
                  {tickets.slice(0, 5).map(ticket => <div key={ticket.id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-bold text-slate-800"><FileText className="mr-1 inline h-3.5 w-3.5" />#{ticket.id} {ticket.subject}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600">{ticket.status.replace('_', ' ')}</span></div>{ticket.adminNote && <p className="mt-2 text-[10px] text-emerald-700">Support: {ticket.adminNote}</p>}</div>)}
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
