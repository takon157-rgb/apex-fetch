'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Job {
  id: string;
  title: string;
  description: string;
  budget: string;
  source: string;
  url: string;
  aiScore: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const SOURCE_COLORS: Record<string, string> = {
  Reddit: 'bg-orange-500/20 text-orange-400',
  RemoteOK: 'bg-green-500/20 text-green-400',
  Remotive: 'bg-blue-500/20 text-blue-400',
  WeWorkRemotely: 'bg-purple-500/20 text-purple-400',
  Himalayas: 'bg-cyan-500/20 text-cyan-400',
  AuthenticJobs: 'bg-pink-500/20 text-pink-400',
  StackOverflow: 'bg-amber-500/20 text-amber-400',
};

export default function PublicJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('q', search);

    fetch(`/api/public/jobs?${params}`)
      .then(r => r.json())
      .then(data => {
        setJobs(data.jobs || []);
        setPagination(data.pagination || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">
            Remote Job Leads
          </h1>
          <p className="mt-3 text-lg text-slate-400">
            AI-scored opportunities aggregated from 14+ sources. Updated daily.
          </p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <input
              type="text"
              placeholder="Search jobs..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <Link
              href="/sign-up"
              className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Sign up for full access
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-20 text-center text-slate-500">
            No jobs found{search ? ` for "${search}"` : ''}.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {jobs.map(job => (
                <div
                  key={job.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-white truncate">
                        {job.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-slate-400 line-clamp-2">
                        {job.description || 'No description available.'}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className={SOURCE_COLORS[job.source] || 'bg-slate-700/50 text-slate-300'}>
                          {job.source}
                        </span>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-400">
                          {job.budget}
                        </span>
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-400">
                          Score: {job.aiScore}/10
                        </span>
                        <span className="text-slate-600">
                          {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
                      >
                        View
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="px-3 text-sm text-slate-500">
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}

            <div className="mt-12 text-center">
              <Link
                href="/sign-up"
                className="inline-block rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-3 text-sm font-semibold text-white transition hover:from-indigo-500 hover:to-purple-500"
              >
                Create free account — get AI-matched leads daily
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
