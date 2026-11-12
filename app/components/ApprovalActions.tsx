'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  leadId: string;
  status: string;
  hasCoverEmail: boolean;
  /** The drafted cover email, so it can be handed off to a mail app. */
  coverEmail?: string;
  jobTitle?: string;
  company?: string;
}

export default function ApprovalActions({
  leadId,
  status,
  hasCoverEmail,
  coverEmail,
  jobTitle,
  company,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, leadId, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Action "${action}" failed`);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error — check your connection.');
    } finally {
      setBusy(null);
    }
  }

  const isApproved = status === 'approved';

  /**
   * Hands the drafted email to the visitor's own mail client.
   *
   * Sending through the server needs working SMTP credentials. When they are
   * missing (or the user simply prefers their own mailbox) this opens a
   * pre-filled draft instead, so the application still leaves their hands.
   */
  const openInMailApp = () => {
    const subject = `Application${jobTitle ? ` - ${jobTitle}` : ''}${company ? ` at ${company}` : ''}`;
    const body = coverEmail || '';
    const href = `mailto:${email.trim() || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };

  return (
    <div className="mt-4 space-y-3">
      {error && (
        <p role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {!showEmail && (
        <div className="flex flex-wrap gap-2">
          {!isApproved ? (
            <button
              onClick={() => call('status', { status: 'approved' })}
              disabled={!!busy}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold shadow-lg shadow-emerald-950/40 transition focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
            >
              {busy === 'status' ? 'Working…' : '✓ Approve'}
            </button>
          ) : (
            <button
              onClick={() => setShowEmail(true)}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-950/40 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              ✉ Send application
            </button>
          )}
          <button
            onClick={() => call('status', { status: 'manual_apply' })}
            disabled={!!busy}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-bold border border-slate-700 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            Skip — I'll apply manually
          </button>
        </div>
      )}

      {showEmail && (
        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Recipient email (where to send your application)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hiring@company.com"
              className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            />
            <button
              onClick={() => call('send', { to: email })}
              disabled={!!busy || !email.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
            >
              {busy === 'send' ? 'Sending…' : 'Send'}
            </button>
            <button
              onClick={openInMailApp}
              disabled={!hasCoverEmail}
              title="Open the drafted email in your own mail app and attach the exported resume"
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-bold border border-slate-700 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              Open in mail app
            </button>
            <button
              onClick={() => setShowEmail(false)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition"
            >
              Cancel
            </button>
          </div>
          {!hasCoverEmail && (
            <p className="text-[11px] text-amber-300">
              No cover email drafted yet — generate one from the job card (✨ Tailor) first.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
