'use client';

import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

interface UserRecord {
  id: string;
  clerkId: string;
  email: string | null;
  name: string | null;
  isSubscribed: boolean;
  creditsRemaining: number;
  _count: {
    localLeads: number;
  };
}

interface AdminStats {
  totalUsers: number;
  totalScrapes: number;
  users: UserRecord[];
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [creditInputs, setCreditInputs] = useState<Record<string, string>>({});

  const isAdmin =
    isLoaded &&
    user?.id === (process.env.NEXT_PUBLIC_ADMIN_CLERK_ID || '');

  useEffect(() => {
    if (isLoaded && !isAdmin) {
      router.push('/');
      return;
    }
    if (isAdmin) {
      fetchStats();
    }
  }, [isLoaded, isAdmin]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (data.success) setStats(data);
    } catch (err) {
      console.error('Failed to fetch admin stats', err);
    }
    setLoading(false);
  };

  const toggleSubscription = async (userId: string, current: boolean) => {
    setTogglingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isSubscribed: !current }),
      });
      const data = await res.json();
      if (data.success) {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                users: prev.users.map((u) =>
                  u.id === userId ? { ...u, isSubscribed: !current } : u
                ),
              }
            : prev
        );
      }
    } catch (err) {
      console.error('Failed to toggle subscription', err);
    }
    setTogglingId(null);
  };

  const setCredits = async (userId: string, credits: number) => {
    setTogglingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, credits }),
      });
      const data = await res.json();
      if (data.success) {
        setStats((prev) =>
          prev
            ? {
                ...prev,
                users: prev.users.map((u) =>
                  u.id === userId ? { ...u, creditsRemaining: credits } : u
                ),
              }
            : prev
        );
        setCreditInputs((prev) => ({ ...prev, [userId]: '' }));
      }
    } catch (err) {
      console.error('Failed to set credits', err);
    }
    setTogglingId(null);
  };

  if (!isLoaded || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-pulse text-slate-400 text-sm">Verifying access...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">Administration</p>
          <h1 className="text-3xl font-bold text-white mt-2">Platform Admin Dashboard</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-6 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Registered Users</p>
            <p className="text-4xl font-bold text-white mt-2">{stats?.totalUsers ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-6 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Scrapes Executed</p>
            <p className="text-4xl font-bold text-white mt-2">{stats?.totalScrapes ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-6 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subscribed Users</p>
            <p className="text-4xl font-bold text-white mt-2">
              {stats?.users.filter((u) => u.isSubscribed).length ?? 0}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
          <div className="p-6 border-b border-slate-800/60">
            <h2 className="text-lg font-semibold text-white">User Management</h2>
            <p className="text-sm text-slate-400 mt-1">Toggle subscription status for each user.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4 font-semibold">User</th>
                  <th className="px-5 py-4 font-semibold">Email</th>
                  <th className="px-5 py-4 font-semibold">Leads</th>
                  <th className="px-5 py-4 font-semibold">Credits</th>
                  <th className="px-5 py-4 font-semibold">Plan</th>
                  <th className="px-5 py-4 font-semibold">Actions</th>
                  <th className="px-5 py-4 font-semibold">Set Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {stats?.users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4 font-medium text-slate-200">{u.name || 'N/A'}</td>
                    <td className="px-5 py-4 text-slate-300">{u.email || '—'}</td>
                    <td className="px-5 py-4 text-slate-300">{u._count.localLeads}</td>
                    <td className="px-5 py-4 text-slate-300">{u.creditsRemaining}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        u.isSubscribed ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {u.isSubscribed ? 'Active' : 'Free'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSubscription(u.id, true)}
                          disabled={togglingId === u.id || u.isSubscribed}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            u.isSubscribed
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                          }`}
                        >
                          Upgrade
                        </button>
                        <button
                          onClick={() => toggleSubscription(u.id, false)}
                          disabled={togglingId === u.id || !u.isSubscribed}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                            !u.isSubscribed
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30'
                          }`}
                        >
                          Demote
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          value={creditInputs[u.id] ?? ''}
                          onChange={(e) => setCreditInputs((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          placeholder="Credits"
                          className="w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                        />
                        <button
                          onClick={() => setCredits(u.id, Number(creditInputs[u.id]))}
                          disabled={togglingId === u.id || !creditInputs[u.id] || isNaN(Number(creditInputs[u.id]))}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 transition disabled:opacity-50"
                        >
                          Set
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
