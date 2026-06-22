'use client';

import React, { useEffect, useState } from 'react';

interface StoredLead {
  id: string;
  businessName: string;
  phoneNumber: string;
  strategy: string;
  niche: string;
  city: string;
  savedAt: string;
}

export default function StoredLeadsPage() {
  const [leads, setLeads] = useState<StoredLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stored-leads');
      const data = await res.json();
      if (data.success) setLeads(data.leads);
    } catch (err) {
      console.error('Failed to fetch stored leads', err);
    }
    setLoading(false);
  };

  const removeLead = async (id: string) => {
    try {
      const res = await fetch(`/api/stored-leads?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) setLeads(data.leads);
    } catch (err) {
      console.error('Failed to remove lead', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Lead Storage</p>
          <h1 className="text-3xl font-bold text-white mt-2">Stored Leads</h1>
          <p className="text-sm text-slate-400 mt-1">Saved bookmarks from your local prospecting engine.</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 animate-pulse">Loading stored leads...</div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20 bg-slate-900/30 border border-dashed border-slate-800 rounded-2xl text-slate-400 text-sm">
            No stored leads yet. Save leads from the Local Prospecting feed.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800/60 bg-slate-900/40">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4 font-semibold">Business Name</th>
                  <th className="px-5 py-4 font-semibold">Phone</th>
                  <th className="px-5 py-4 font-semibold">Niche</th>
                  <th className="px-5 py-4 font-semibold">City</th>
                  <th className="px-5 py-4 font-semibold">What We Need To Do For Them</th>
                  <th className="px-5 py-4 font-semibold">Saved</th>
                  <th className="px-5 py-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4 font-medium text-slate-200">{lead.businessName}</td>
                    <td className="px-5 py-4 text-slate-300">{lead.phoneNumber || '—'}</td>
                    <td className="px-5 py-4 text-slate-300">{lead.niche || '—'}</td>
                    <td className="px-5 py-4 text-slate-300">{lead.city || '—'}</td>
                    <td className="px-5 py-4 text-slate-300 max-w-xs truncate">{lead.strategy || '—'}</td>
                    <td className="px-5 py-4 text-slate-500 text-xs">{new Date(lead.savedAt).toLocaleDateString()}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => removeLead(lead.id)}
                        className="text-xs text-rose-400 hover:text-rose-300 transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
