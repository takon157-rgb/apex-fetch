import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import ApprovalActions from '../components/ApprovalActions';
import ResumeDocument from '../components/ResumeDocument';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  drafted: 'Draft ready — needs approval',
  approved: 'Approved — ready to send',
};

export default async function ApprovalQueuePage() {
  const { userId } = await auth();

  const user = userId
    ? await prisma.user.findUnique({ where: { clerkId: userId } })
    : null;

  const drafts = user
    ? await prisma.lead.findMany({
        where: {
          userId: user.id,
          deleted: false,
          applicationStatus: { in: ['drafted', 'approved'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      })
    : [];

  // Shown in the header of the generated resume document.
  const candidateContact = [user?.email, user?.name].filter(Boolean).join(' · ') || null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/40 to-slate-950 text-white p-4 sm:p-8 md:p-12">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-violet-300 to-emerald-300">
            Approval Queue
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {drafts.length === 0
              ? 'No drafts waiting. Open a job in the dashboard and click ✨ Tailor to create one.'
              : `${drafts.length} application${drafts.length === 1 ? '' : 's'} waiting for your review.`}
          </p>
        </header>

        {drafts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-12 text-center">
            <div className="text-4xl mb-3" aria-hidden="true">📭</div>
            <p className="text-slate-300 font-semibold">Queue is empty</p>
            <p className="text-slate-500 text-sm mt-1 mb-5">
              Tailored applications appear here before anything is sent.
            </p>
            <a
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              Browse jobs →
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((lead) => {
              const cover = lead.coverEmail || '';
              return (
                <article
                  key={lead.id}
                  className="rounded-2xl bg-slate-900/60 border border-slate-700/50 shadow-xl backdrop-blur overflow-hidden"
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                            {lead.source}
                          </span>
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              lead.applicationStatus === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/25'
                            }`}
                          >
                            {STATUS_LABEL[lead.applicationStatus] || lead.applicationStatus}
                          </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-white break-words">
                          <a
                            href={lead.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-indigo-300 transition"
                          >
                            {lead.title}
                          </a>
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                          {lead.company || 'Company not listed'}
                          {lead.location ? ` · ${lead.location}` : ''}
                          {lead.salaryMin ? ` · $${lead.salaryMin.toLocaleString()}${lead.salaryMax ? `–$${lead.salaryMax.toLocaleString()}` : ''}` : ''}
                        </p>
                      </div>

                      {lead.fitScore != null && (
                        <div className="text-center shrink-0 rounded-2xl bg-slate-950/60 border border-slate-700 px-4 py-3">
                          <div className="text-2xl font-extrabold text-emerald-400">{lead.fitScore}%</div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">fit</div>
                        </div>
                      )}
                    </div>

                    {lead.fitReason && (
                      <p className="mt-3 text-xs text-slate-400">
                        <span className="text-slate-500 font-semibold">Why:</span> {lead.fitReason}
                      </p>
                    )}

                    {lead.fitMatched?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {lead.fitMatched.slice(0, 8).map((s) => (
                          <span key={s} className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {cover ? (
                      <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-950/50 p-4">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Cover email draft
                        </h3>
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">
                          {cover}
                        </pre>
                      </div>
                    ) : (
                      <p className="mt-4 text-xs text-amber-300/90">
                        No cover email drafted for this job yet.
                      </p>
                    )}

                    <ResumeDocument
                      resumeText={lead.tailoredResume || ''}
                      name={user?.name || null}
                      contact={candidateContact}
                      targetRole={lead.title}
                    />

                    <ApprovalActions
                      leadId={lead.id}
                      status={lead.applicationStatus}
                      hasCoverEmail={!!cover}
                      coverEmail={cover}
                      jobTitle={lead.title}
                      company={lead.company || undefined}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
