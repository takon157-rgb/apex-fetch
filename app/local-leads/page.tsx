'use client';

import React, { useEffect, useState } from 'react';
import { Phone, Mail, MapPin, Star, ChevronDown, Copy, Check } from 'lucide-react';

interface LocalBusinessLead {
  id: string;
  businessName: string;
  niche: string;
  city: string;
  address: string;
  phoneNumber: string;
  rating: number;
  reviewCount: number;
  googleMapsUrl: string;
  opportunityScore: number;
  aiAnalysis: string;
  coldCallScript: string;
  emailPitch: string;
  status: 'New' | 'Contacted' | 'Interested' | 'Closed';
  createdAt: string;
}

export default function LocalLeadsPage() {
  const [leads, setLeads] = useState<LocalBusinessLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LocalBusinessLead | null>(null);
  const [niches, setNiches] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [filterNiche, setFilterNiche] = useState('All');
  const [filterCity, setFilterCity] = useState('All');
  const [filterScore, setFilterScore] = useState('0');
  const [scrapeForm, setScrapeForm] = useState({ niche: 'Plumbing', city: 'New York', limit: 10 });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch leads on mount
  useEffect(() => {
    fetchLeads();
  }, []);

  async function fetchLeads() {
    setLoading(true);
    try {
      const response = await fetch('/api/scrape-local');
      const data = await response.json();
      if (data.success && Array.isArray(data.leads)) {
        setLeads(data.leads);
        
        // Extract unique niches and cities
        const uniqueNiches = Array.from(new Set(data.leads.map((l: LocalBusinessLead) => l.niche)));
        const uniqueCities = Array.from(new Set(data.leads.map((l: LocalBusinessLead) => l.city)));
        setNiches(uniqueNiches as string[]);
        setCities(uniqueCities as string[]);
      }
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    }
    setLoading(false);
  }

  async function handleScrape() {
    setScraping(true);
    try {
      const response = await fetch('/api/scrape-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scrapeForm),
      });
      const data = await response.json();
      if (data.success) {
        await fetchLeads();
      }
    } catch (error) {
      console.error('Scrape failed:', error);
    }
    setScraping(false);
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function updateLeadStatus(id: string, status: 'New' | 'Contacted' | 'Interested' | 'Closed') {
    const updated = leads.map((l) => (l.id === id ? { ...l, status } : l));
    setLeads(updated);
    
    // Optional: Persist to backend
    try {
      await fetch(`/api/scrape-local/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  const filteredLeads = leads.filter((lead) => {
    if (filterNiche !== 'All' && lead.niche !== filterNiche) return false;
    if (filterCity !== 'All' && lead.city !== filterCity) return false;
    if (parseFloat(filterScore) > 0 && lead.opportunityScore < parseFloat(filterScore)) return false;
    return true;
  });

  const statusColors = {
    'New': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Contacted': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'Interested': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    'Closed': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  };

  const scoreColor = (score: number) => {
    if (score >= 9) return 'text-emerald-400 bg-emerald-500/20';
    if (score >= 8) return 'text-amber-400 bg-amber-500/20';
    return 'text-slate-400 bg-slate-500/20';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Grid Background */}
      <div className="fixed inset-0 -z-10 opacity-30 bg-[linear-gradient(45deg,transparent_25%,rgba(99,102,241,0.08)_25%,rgba(99,102,241,0.08)_50%,transparent_50%,transparent_75%,rgba(99,102,241,0.08)_75%,rgba(99,102,241,0.08))] bg-[size:40px_40px]" />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600 text-xl font-bold text-white shadow-lg shadow-teal-500/30">
              📍
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">Local Lead Generator</p>
              <h1 className="text-3xl font-bold text-white">B2B Business Prospecting</h1>
            </div>
          </div>
          <p className="text-sm text-slate-400">AI-powered local business discovery with opportunity scoring and automated outreach scripts.</p>
        </div>

        {/* Scrape Form */}
        <div className="mb-8 grid gap-4 rounded-2xl border border-slate-800/50 bg-slate-900/30 p-6 backdrop-blur md:grid-cols-5 md:items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Niche</label>
            <input
              type="text"
              value={scrapeForm.niche}
              onChange={(e) => setScrapeForm({ ...scrapeForm, niche: e.target.value })}
              placeholder="e.g., Plumbing"
              className="w-full rounded-lg border border-slate-800/50 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">City</label>
            <input
              type="text"
              value={scrapeForm.city}
              onChange={(e) => setScrapeForm({ ...scrapeForm, city: e.target.value })}
              placeholder="e.g., New York"
              className="w-full rounded-lg border border-slate-800/50 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Limit</label>
            <input
              type="number"
              value={scrapeForm.limit}
              onChange={(e) => setScrapeForm({ ...scrapeForm, limit: parseInt(e.target.value) })}
              min="1"
              max="50"
              className="w-full rounded-lg border border-slate-800/50 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
            />
          </div>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition disabled:opacity-50"
          >
            {scraping ? 'Scraping...' : 'Scrape'}
          </button>
          <button
            onClick={fetchLeads}
            className="rounded-lg border border-slate-800/50 bg-slate-950/30 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white hover:border-slate-700/50"
          >
            Reload
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Niche</label>
            <select
              value={filterNiche}
              onChange={(e) => setFilterNiche(e.target.value)}
              className="w-full rounded-lg border border-slate-800/50 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
            >
              <option value="All">All Niches</option>
              {niches.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">City</label>
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="w-full rounded-lg border border-slate-800/50 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
            >
              <option value="All">All Cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">Min Score</label>
            <select
              value={filterScore}
              onChange={(e) => setFilterScore(e.target.value)}
              className="w-full rounded-lg border border-slate-800/50 bg-slate-950/50 px-3 py-2 text-sm text-slate-100 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
            >
              <option value="0">All Scores</option>
              <option value="5">5+</option>
              <option value="7">7+</option>
              <option value="8">8+</option>
              <option value="9">9+</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-sm text-slate-400">
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Leads Grid */}
        {loading ? (
          <div className="rounded-2xl border border-slate-800/50 bg-slate-900/30 p-12 text-center text-slate-400 backdrop-blur">
            <div className="mb-3 inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-teal-400" />
            <p>Loading leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-800/50 bg-slate-900/20 p-12 text-center text-slate-500 backdrop-blur">
            <p className="text-sm">No leads found. Try scraping new data.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className="group overflow-hidden rounded-xl border border-slate-800/50 bg-gradient-to-br from-slate-800/20 to-slate-900/30 transition duration-300 hover:border-teal-500/30 hover:shadow-xl hover:shadow-teal-500/10 backdrop-blur cursor-pointer"
                onClick={() => setSelectedLead(lead)}
              >
                <div className="space-y-4 p-6">
                  {/* Header */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold border ${statusColors[lead.status]}`}>
                          {lead.status}
                        </span>
                        <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${scoreColor(lead.opportunityScore)}`}>
                          {lead.opportunityScore}/10
                        </span>
                      </div>
                    </div>
                    <h3 className="text-lg font-bold text-white transition group-hover:text-teal-300">{lead.businessName}</h3>
                    <p className="mt-1 text-xs text-slate-500">{lead.niche}</p>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 px-3 py-2 backdrop-blur">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Rating</p>
                      <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-300">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {lead.rating.toFixed(1)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 px-3 py-2 backdrop-blur">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Reviews</p>
                      <p className="mt-1 text-sm font-semibold text-slate-300">{lead.reviewCount}</p>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 border-t border-slate-800/30 pt-4">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span className="line-clamp-1">{lead.city}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Phone className="h-3 w-3 flex-shrink-0" />
                      <span className="font-mono">{lead.phoneNumber}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(lead.coldCallScript, `call-${lead.id}`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-800/50 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-slate-100 hover:border-slate-700/50"
                    >
                      {copiedId === `call-${lead.id}` ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Phone className="h-3 w-3" />
                          Script
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(lead.emailPitch, `email-${lead.id}`);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-800/50 bg-slate-950/30 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:text-slate-100 hover:border-slate-700/50"
                    >
                      {copiedId === `email-${lead.id}` ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Mail className="h-3 w-3" />
                          Email
                        </>
                      )}
                    </button>
                    <a
                      href={lead.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center rounded-lg border border-slate-800/50 bg-slate-950/30 px-3 py-2 text-slate-300 transition hover:text-slate-100 hover:border-slate-700/50"
                    >
                      <MapPin className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={lead.status}
                    onChange={(e) => updateLeadStatus(lead.id, e.target.value as any)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full rounded-lg border border-slate-800/50 bg-slate-950/30 px-3 py-2 text-xs text-slate-300 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/20"
                  >
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Interested">Interested</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="max-h-screen w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800/50 bg-slate-900 shadow-2xl shadow-teal-500/20">
              <div className="sticky top-0 flex items-center justify-between border-b border-slate-800/50 bg-slate-900/95 p-6 backdrop-blur">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">Details</p>
                  <h2 className="mt-1 text-xl font-bold text-white">{selectedLead.businessName}</h2>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="rounded-lg border border-slate-800/50 bg-slate-950/30 px-4 py-2 text-sm text-slate-400 transition hover:text-white hover:border-slate-700/50"
                >
                  Close
                </button>
              </div>

              <div className="space-y-6 p-6">
                {/* Key Info */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-4 backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Location</p>
                    <p className="text-sm text-slate-300">{selectedLead.address}</p>
                    <p className="text-sm text-slate-400">{selectedLead.city}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-4 backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Contact</p>
                    <p className="font-mono text-sm text-slate-300">{selectedLead.phoneNumber}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-4 backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Rating</p>
                    <p className="text-sm text-slate-300">{selectedLead.rating}/5 ({selectedLead.reviewCount} reviews)</p>
                  </div>
                  <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-4 backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">Opportunity</p>
                    <p className={`text-sm font-bold ${scoreColor(selectedLead.opportunityScore)}`}>{selectedLead.opportunityScore}/10</p>
                  </div>
                </div>

                {/* Analysis */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider">AI Analysis</p>
                  <div className="rounded-lg border border-slate-800/50 bg-slate-950/30 p-4 text-sm text-slate-300 leading-relaxed backdrop-blur">
                    {selectedLead.aiAnalysis}
                  </div>
                </div>

                {/* Cold Call Script */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Cold Call Script</p>
                    <button
                      onClick={() => copyToClipboard(selectedLead.coldCallScript, `call-detail-${selectedLead.id}`)}
                      className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
                    >
                      {copiedId === `call-detail-${selectedLead.id}` ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-800/50 bg-slate-950/30 p-4 text-xs text-slate-300 font-mono backdrop-blur">
                    {selectedLead.coldCallScript}
                  </pre>
                </div>

                {/* Email Pitch */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Email Pitch</p>
                    <button
                      onClick={() => copyToClipboard(selectedLead.emailPitch, `email-detail-${selectedLead.id}`)}
                      className="text-xs text-slate-400 hover:text-slate-200 transition flex items-center gap-1"
                    >
                      {copiedId === `email-detail-${selectedLead.id}` ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-800/50 bg-slate-950/30 p-4 text-xs text-slate-300 font-mono backdrop-blur">
                    {selectedLead.emailPitch}
                  </pre>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-800/30 pt-4 text-xs text-slate-500">
                  <p>Created: {new Date(selectedLead.createdAt).toLocaleDateString()}</p>
                  <a href={selectedLead.googleMapsUrl} target="_blank" rel="noreferrer" className="text-teal-400 hover:text-teal-300 mt-2 inline-block">
                    View on Google Maps →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
