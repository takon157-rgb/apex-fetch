import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const TRACKED_STATUSES = ['approved', 'sent', 'replied', 'interview', 'rejected', 'manual_apply'];

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  sent: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  replied: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  interview: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  manual_apply: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
};

const STATUS_LABEL: Record<string, string> = {
  approved: 'Approved — not yet sent',
  sent: 'Sent',
  replied: 'Replied',
  interview: 'Interview',
  rejected: 'Rejected',
  manual_apply: 'Applying manually',
};

export default async function TrackerPage() {
  const { userId } = await auth();

  const user = userId
    ? await prisma.user.findUnique({ where: { clerkId: userId } })
    : null;

  const applications = user
    ? await prisma.lead.findMany({
        where: {
          userId: user.id,
          deleted: false,
          applicationStatus: { in: TRACKED_STATUSES },
        },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      })
    : [];

  const sentCount = applications.filter(a => a.applicationStatus === 'sent').length;
  const repliedCount = applications.filter(a => a.applicationStatus === 'replied').length;
  const interviewCount = applications.filter(a => a.applicationStatus === 'interview').length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-950/30 via-slate-950 to-indigo-950/30 text-white p-4 sm:p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-300 via-indigo-300 to-violet-300">
            Application Tracker
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Everything you approved, sent, or are handling manually.
          </p>

          {applications.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-3 max-w-md">
              {[
                { label: 'Sent', value: sentCount, color: 'text-blue-400' },
                { label: 'Replied', value: repliedCount, color: 'text-emerald-400' },
                { label: 'Interview', value: interviewCount, color: 'text-violet-400' },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-slate-900/60 border border-slate-700/50 px-4 py-3 text-center">
                  <div className={`text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </header>

        {applications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">📊</div>
            <p className="text-slate-300 font-semibold">Nothing tracked yet</p>
            <p className="text-slate-500 text-sm mt-1 mb-5">
              Applications you approve or send show up here with their status.
            </p>
            <a
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              Browse jobs →
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <article
                key={app.id}
                className="rounded-2xl bg-slate-900/60 border border-slate-700/50 shadow-lg backdrop-blur p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-white break-words">
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-indigo-300 transition"
                      >
                        {app.title}
                      </a>
                    </h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                      {app.company || 'Company not listed'}
                      {app.source ? ` · via ${app.source}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                      STATUS_STYLE[app.applicationStatus] || STATUS_STYLE.manual_apply
                    }`}
                  >
                    {STATUS_LABEL[app.applicationStatus] || app.applicationStatus}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {app.sentAt && <span>Sent {new Date(app.sentAt).toLocaleDateString()}</span>}
                  {app.approvedAt && !app.sentAt && <span>Approved {new Date(app.approvedAt).toLocaleDateString()}</span>}
                  {app.applicationEmail && <span>To {app.applicationEmail}</span>}
                  {app.fitScore != null && <span className="text-emerald-400 font-semibold">Fit {app.fitScore}%</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
