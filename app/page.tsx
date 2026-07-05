'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

interface JobOpportunity {
  id: string;
  title: string;
  description: string;
  budget: string;
  source: string;
  url: string;
  postedTime: string;
  score: number;
  summary: string;
  profitability: string;
  difficulty: string;
  proposal: string;
  status: string;
  applied: boolean;
  tracked: boolean;
  deleted: boolean;
  createdAt: string;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scraping, setScraping] = useState<boolean>(false);
  const [scrapeDone, setScrapeDone] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('score');
  const [selectedSource, setSelectedSource] = useState<string>('All');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');
  const [nicheQuery, setNicheQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [applyingMap, setApplyingMap] = useState<Record<string, boolean>>({});
  const [discordLoadingMap, setDiscordLoadingMap] = useState<Record<string, boolean>>({});
  const [lastScrapeStats, setLastScrapeStats] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blacklistInput, setBlacklistInput] = useState('');
  const [showBlacklist, setShowBlacklist] = useState(false);

  const industries = ['All', 'Entry Level', 'AI Automation', 'Video Editing', 'Appointment Setter', 'Social Media', 'Virtual Assistant'];

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.push('/sign-in'); return; }

    async function checkOnboarding() {
      try {
        const res = await fetch('/api/user-preferences');
        if (res.ok) {
          const data = await res.json();
          if (!data.preferences?.setupComplete) { router.push('/onboarding'); return; }
        }
      } catch {}
      setOnboardingChecked(true);
    }
    checkOnboarding();
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (!onboardingChecked) return;
    fetchOpportunities();
    fetchBlacklist();
  }, [onboardingChecked]);

  useEffect(() => {
    if (!sessionId || !scraping) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scrape/progress?sessionId=${sessionId}`);
        if (!res.ok) { clearInterval(interval); return; }
        const data = await res.json();
        setProgress(Math.min(data.progress, 95));
        setProgressStatus(data.currentSource ? `Scraping ${data.currentSource}...` : 'Processing...');
        if (data.status === 'completed' || data.status === 'error') {
          clearInterval(interval);
          setProgress(100);
          setScrapeDone(true);
          if (data.status === 'completed') {
            setProgressStatus('Done! ✅');
            const leadsRes = await fetch('/api/leads');
            if (leadsRes.ok) {
              const leadsData = await leadsRes.json();
              const dbLeads = leadsData?.leads || [];
              setJobs(dbLeads.map(mapDbLeadToJob));
            }
            setTimeout(() => { setProgress(0); setScrapeDone(false); }, 2500);
          }
          setScraping(false);
          setSessionId(null);
          if (data.status === 'error') { setProgressStatus(`Error: ${data.error}`); setTimeout(() => { setProgress(0); setScrapeDone(false); }, 4000); }
        }
      } catch { clearInterval(interval); setScraping(false); setSessionId(null); }
    }, 1500);
    return () => clearInterval(interval);
  }, [sessionId, scraping]);

  const mapDbLeadToJob = (lead: any): JobOpportunity => ({
    id: lead.id,
    title: lead.title,
    description: lead.description,
    budget: lead.budget || 'Open Terms',
    source: lead.source,
    url: lead.url,
    postedTime: lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : 'Just fetched',
    score: lead.aiScore || 0,
    summary: lead.description?.substring(0, 200) || '',
    profitability: (lead.aiScore || 0) >= 7 ? 'High' : (lead.aiScore || 0) >= 4 ? 'Medium' : 'Low',
    difficulty: 'Medium',
    proposal: lead.proposalDraft || '',
    status: lead.status || 'active',
    applied: lead.applied || false,
    tracked: lead.tracked || false,
    deleted: lead.deleted || false,
    createdAt: lead.createdAt,
  });

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/leads');
      if (response.ok) {
        const data = await response.json();
        const dbLeads = data?.leads || [];
        setJobs(dbLeads.map(mapDbLeadToJob));
      }
    } catch (err) { console.error('Failed reading records:', err); }
    setLoading(false);
  };

  const fetchBlacklist = async () => {
    try {
      const res = await fetch('/api/blacklist');
      const data = await res.json();
      if (data?.keywords) setBlacklist(data.keywords);
    } catch {}
  };

  const addBlacklistKeyword = async () => {
    if (!blacklistInput.trim()) return;
    try {
      await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: blacklistInput.trim() }),
      });
      setBlacklist(prev => [...prev, blacklistInput.trim().toLowerCase()]);
      setBlacklistInput('');
    } catch {}
  };

  const removeBlacklistKeyword = async (keyword: string) => {
    try {
      await fetch('/api/blacklist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      });
      setBlacklist(prev => prev.filter(k => k !== keyword));
    } catch {}
  };

  const handleRunScraperPipeline = async () => {
    setScraping(true);
    setProgress(5);
    setProgressStatus('Initializing scraper...');
    setLastScrapeStats(null);
    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scrape', industry: selectedIndustry, query: nicheQuery }),
      });
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
        setLastScrapeStats(data.stats);
      } else {
        setScraping(false);
      }
    } catch (err) {
      console.error('Pipeline Error:', err);
      setScraping(false);
      setProgress(0);
    }
  };

  const toggleTrack = async (id: string, current: boolean) => {
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracked: !current }),
      });
      setJobs(prev => prev.map(j => j.id === id ? { ...j, tracked: !current } : j));
    } catch {}
  };

  const toggleApplied = async (id: string, current: boolean) => {
    setApplyingMap(prev => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applied: !current }),
      });
      setJobs(prev => prev.map(j => j.id === id ? { ...j, applied: !current } : j));
    } catch {}
    setApplyingMap(prev => ({ ...prev, [id]: false }));
  };

  const handleSendToDiscord = async (job: JobOpportunity) => {
    setDiscordLoadingMap(prev => ({ ...prev, [job.id]: true }));
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discord_dispatch', id: job.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error('Discord dispatch failed:', data.error);
      }
    } catch (e) { console.error('Discord dispatch failed', e); }
    setDiscordLoadingMap(prev => ({ ...prev, [job.id]: false }));
  };

  const reviewJob = async (job: JobOpportunity) => {
    try {
      await fetch('/api/review-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id, title: job.title, description: job.description }),
      });
    } catch (e) { console.error('Review failed', e); }
  };

  const moveToTrash = async (id: string) => {
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted: true, status: 'deleted' }),
      });
      setJobs(prev => prev.map(j => j.id === id ? { ...j, deleted: true, status: 'deleted' } : j));
    } catch (err) { console.error(err); }
  };

  const restoreFromTrash = async (id: string) => {
    try {
      await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted: false, status: 'active' }),
      });
      setJobs(prev => prev.map(j => j.id === id ? { ...j, deleted: false, status: 'active' } : j));
    } catch (err) { console.error(err); }
  };

  const purgePermanently = async (id: string) => {
    try {
      await fetch(`/api/leads/${id}`, { method: 'DELETE' });
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) { console.error(err); }
  };

  const clearTrashBin = async () => {
    const trashIds = jobs.filter(j => j.deleted).map(j => j.id);
    if (trashIds.length === 0) return;
    for (const id of trashIds) {
      try { await fetch(`/api/leads/${id}`, { method: 'DELETE' }); } catch {}
    }
    setJobs(prev => prev.filter(j => !j.deleted));
  };

  const filterByIndustry = (job: JobOpportunity) => {
    if (selectedIndustry === 'All') return true;
    const dataBody = `${job.title} ${job.description} ${job.summary}`.toLowerCase();
    if (selectedIndustry === 'AI Automation') return dataBody.includes('automation') || dataBody.includes('ai');
    if (selectedIndustry === 'Video Editing') return dataBody.includes('video') || dataBody.includes('editor') || dataBody.includes('thumbnail');
    if (selectedIndustry === 'Appointment Setter') return dataBody.includes('setter') || dataBody.includes('appointment');
    if (selectedIndustry === 'Social Media') return dataBody.includes('social') || dataBody.includes('media') || dataBody.includes('marketing');
    if (selectedIndustry === 'Virtual Assistant') return dataBody.includes('assistant') || dataBody.includes('va');
    return dataBody.includes(selectedIndustry.toLowerCase());
  };

  const parseInlineStyles = (text: string) => {
    const tokens = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return tokens.map((token, i) => {
      if (token.startsWith('**') && token.endsWith('**')) return <strong key={i} className="font-bold text-slate-100">{token.slice(2, -2)}</strong>;
      if (token.startsWith('`') && token.endsWith('`')) return <code key={i} className="bg-slate-900 border border-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-[11px] font-mono">{token.slice(1, -1)}</code>;
      return token;
    });
  };

  const renderFormattedContent = (rawText: string) => {
    if (!rawText) return null;
    let cleanText = rawText.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<\/li>/gi, '\n').replace(/<li>/gi, '• ').replace(/<[^>]*>/g, '');
    const lines = cleanText.split('\n');
    return lines.map((line, index) => {
      const cleanLine = line.trim();
      if (cleanLine === '') return <div key={index} className="h-2" />;
      if (cleanLine.startsWith('- ') || cleanLine.startsWith('* ') || cleanLine.startsWith('• ')) {
        return <div key={index} className="flex items-start space-x-2 my-1 pl-1"><span className="text-indigo-500 mt-1 shrink-0 text-xs">•</span><span className="text-slate-300 flex-1 leading-relaxed">{parseInlineStyles(cleanLine.replace(/^([\-\*•])\s*/, ''))}</span></div>;
      }
      return <p key={index} className="text-slate-300 leading-relaxed my-0.5">{parseInlineStyles(line)}</p>;
    });
  };

  const totalActiveLeadsCount = jobs.filter(j => !j.deleted).length;
  const totalTrashCount = jobs.filter(j => j.deleted).length;

  const sourceCounts = jobs.reduce((acc, j) => {
    const source = j.source || 'Unknown';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  const displayedOpportunities = jobs
    .filter(job => viewMode === 'active' ? !job.deleted : job.deleted)
    .filter(job => selectedSource === 'All' || job.source === selectedSource)
    .filter(filterByIndustry)
    .filter(job => {
      if (!nicheQuery) return true;
      const lookup = `${job.title} ${job.description} ${job.summary}`.toLowerCase();
      return lookup.includes(nicheQuery.toLowerCase());
    })
    .sort((a, b) => sortBy === 'score' ? (b.score || 0) - (a.score || 0) : b.id.localeCompare(a.id));

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 font-sans antialiased">
      <aside className="w-64 border-r border-slate-800 bg-slate-950/40 hidden md:flex flex-col justify-between shrink-0 sticky top-0 h-screen p-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">AF</div>
            <div><h1 className="font-bold text-sm tracking-wide text-white">Apex Fetch</h1></div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Lead Repositories</span>
            <button onClick={() => setViewMode('active')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition ${viewMode === 'active' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
              <span>📥 Live Leads Feed</span>
              <span className="font-bold bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">{totalActiveLeadsCount}</span>
            </button>
            <button onClick={() => setViewMode('trash')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition ${viewMode === 'trash' ? 'bg-rose-600/10 text-rose-400 border border-rose-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
              <span>🗑 Trash Bin History</span>
              <span className="font-bold bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-400">{totalTrashCount}</span>
            </button>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Workspace</span>
            <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl text-slate-400 hover:bg-slate-900 transition">Profile & Resume</Link>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Moderation</span>
            <button onClick={() => setShowBlacklist(!showBlacklist)} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-xl transition ${showBlacklist ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900'}`}>
              🚫 Blocklist {blacklist.length > 0 && <span className="ml-1 text-rose-400">({blacklist.length})</span>}
            </button>
          </div>

          {showBlacklist && (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-2">
              <div className="flex gap-1">
                <input value={blacklistInput} onChange={e => setBlacklistInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBlacklistKeyword()} placeholder="e.g. blockchain" className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500" />
                <button onClick={addBlacklistKeyword} className="px-2 py-1 text-xs font-semibold rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30">Add</button>
              </div>
              {blacklist.map(k => (
                <div key={k} className="flex items-center justify-between px-2 py-1 rounded bg-slate-800/50">
                  <span className="text-xs text-slate-300">{k}</span>
                  <button onClick={() => removeBlacklistKeyword(k)} className="text-rose-400 hover:text-rose-300 text-xs">✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-gradient-to-br from-indigo-600/10 to-violet-600/10 border border-indigo-500/20 p-4 space-y-3">
            <div><p className="text-[11px] font-bold text-indigo-300">Unlock Full Access</p><p className="text-[10px] text-slate-400 mt-1">Get unlimited leads, priority AI analysis, and Discord alerts.</p></div>
            <a href="https://buy.stripe.com/test_28oaHLeUDeti9nacMM" target="_blank" rel="noopener noreferrer" className="block w-full text-center text-xs font-bold py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/20">Upgrade Plan</a>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Filter Platforms</span>
            <button onClick={() => setSelectedSource('All')} className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition ${selectedSource === 'All' ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>Universal Feed</button>
            {sortedSources.slice(0, 5).map(([src]) => (
              <button key={src} onClick={() => setSelectedSource(src)} className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition ${selectedSource === src ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>{src}</button>
            ))}
            {sortedSources.length > 5 && (
              <details className="group">
                <summary className="w-full text-left px-3 py-1.5 text-xs rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-900 cursor-pointer list-none flex items-center gap-1">
                  <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  More sources ({sortedSources.length - 5})
                </summary>
                <div className="pt-1 space-y-0.5">
                  {sortedSources.slice(5).map(([src]) => (
                    <button key={src} onClick={() => setSelectedSource(src)} className={`w-full text-left px-3 py-1 text-xs rounded-xl transition ${selectedSource === src ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>{src}</button>
                  ))}
                </div>
              </details>
            )}
          </div>

          {sortedSources.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-800/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Sources Breakdown</span>
              <div className="space-y-1">
                {sortedSources.slice(0, 10).map(([source, count]) => (
                  <div key={source} className="flex items-center justify-between px-3 py-1">
                    <span className="text-[11px] text-slate-400 truncate max-w-[140px]">{source}</span>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-800 bg-slate-950/60 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between sticky top-0 z-40 gap-2">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setMobileFilterOpen(true)} className="md:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700">
                <svg className="w-4 h-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              </button>
              <h2 className="font-bold text-slate-200 text-sm md:text-base truncate">{viewMode === 'active' ? 'Live Leads Feed' : 'Trash Bin'}</h2>
            </div>
            <a href="/local-leads" className="text-xs sm:text-sm text-indigo-300 hover:underline shrink-0">Local</a>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <button onClick={fetchOpportunities} disabled={loading} className="px-3 py-2 text-xs font-bold rounded-xl tracking-wide transition shadow-sm bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0">{loading ? 'Refreshing...' : '🔄'}</button>
            <button onClick={handleRunScraperPipeline} disabled={scraping} className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl tracking-wide transition shadow-sm shrink-0 ${scraping ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
              {scraping ? 'Scraping...' : '🔍 Pull'}
            </button>
          </div>
        </header>

        {progress > 0 && (
          <div className="border-b border-slate-800 bg-slate-950/40">
            <div className="px-6 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs ${scrapeDone ? 'text-emerald-400 font-semibold' : 'text-indigo-300'}`}>{progressStatus || `Scraping... ${progress}%`}</span>
                <span className={`text-xs ${scrapeDone ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>{progress}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden relative">
                <div className={`h-2.5 rounded-full transition-all duration-700 ease-out ${scrapeDone ? 'bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]' : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                {scrapeDone && <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-pulse" />}
              </div>
            </div>
          </div>
        )}

        {lastScrapeStats && progress === 0 && (
          <div className="px-6 py-2 bg-indigo-500/10 border-b border-indigo-500/20 text-xs text-indigo-300">{lastScrapeStats}</div>
        )}

        <main className="flex-1 p-3 sm:p-6 max-w-5xl w-full mx-auto space-y-5">
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">Target Industry / Niche Selection</span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {industries.map(ind => (
                <button key={ind} onClick={() => setSelectedIndustry(ind)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${selectedIndustry === ind ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>{ind}</button>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-2">Niche search</label>
              <div className="flex gap-2">
                <input type="text" value={nicheQuery} onChange={e => setNicheQuery(e.target.value)} placeholder="e.g. 'data entry', 'copywriter'..." className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-950/20 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 gap-2">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 truncate">Found <strong className="text-slate-200">{displayedOpportunities.length}</strong> entries</span>
            <div className="flex items-center gap-2">
              {viewMode === 'trash' && totalTrashCount > 0 && (
                <button onClick={clearTrashBin} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 transition shrink-0">
                  🗑 Clear All
                </button>
              )}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1">
                <option value="score">⭐️ AI Score First</option>
                <option value="newest">🕒 Recency First</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-24 text-xs text-slate-400 animate-pulse">Loading your opportunities...</div>
          ) : displayedOpportunities.length === 0 ? (
            <div className="text-center py-20 bg-slate-950/10 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs">No records found. Click Pull to scrape new opportunities.</div>
          ) : (
            <div className="space-y-3.5">
              {displayedOpportunities.map(opportunity => {
                const isExpanded = expandedJobId === opportunity.id;
                const isSendingToDiscord = !!discordLoadingMap[opportunity.id];
                const isApplying = !!applyingMap[opportunity.id];

                return (
                  <div key={opportunity.id} className={`bg-slate-950/30 rounded-xl border transition-all overflow-hidden ${isExpanded ? 'border-slate-700 bg-slate-950/70 shadow-lg' : 'border-slate-800 hover:border-slate-700'}`}>
                    <div className="p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4">
                      <div className="space-y-1.5 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-800 text-indigo-300">{opportunity.source}</span>
                          <span className="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded font-mono">{opportunity.budget}</span>
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded font-bold">Score: {opportunity.score}/10</span>
                          {opportunity.tracked && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold">Tracking</span>}
                          {opportunity.applied && <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold">Applied ✓</span>}
                        </div>
                        <h3 className="font-bold text-sm text-slate-200">{opportunity.title}</h3>
                      </div>

                      <div className="flex items-center gap-1.5 w-full md:w-auto justify-end shrink-0 overflow-x-auto">
                        <button onClick={() => setExpandedJobId(isExpanded ? null : opportunity.id)} className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0">
                          {isExpanded ? 'Hide' : '📄'}
                        </button>

                        {viewMode === 'active' ? (
                          <>
                            <button onClick={() => { reviewJob(opportunity); router.push('/profile'); }} className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition shrink-0">
                              Profile
                            </button>
                            <button onClick={() => toggleTrack(opportunity.id, opportunity.tracked)} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition shrink-0 ${opportunity.tracked ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                              {opportunity.tracked ? '✓ Tracking' : 'Track'}
                            </button>
                            <button onClick={() => toggleApplied(opportunity.id, opportunity.applied)} disabled={isApplying} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition shrink-0 ${opportunity.applied ? 'bg-blue-600/10 border-blue-500 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                              {isApplying ? '...' : opportunity.applied ? 'Applied' : 'Apply'}
                            </button>
                            <button onClick={() => handleSendToDiscord(opportunity)} disabled={isSendingToDiscord} className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition shrink-0 ${isSendingToDiscord ? 'bg-slate-800 text-slate-500' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-purple-400'}`}>
                              {isSendingToDiscord ? '...' : '🚀'}
                            </button>
                            <button onClick={() => moveToTrash(opportunity.id)} className="p-1.5 text-xs rounded-lg border border-slate-800 bg-slate-900 text-slate-500 hover:text-rose-400 shrink-0">🗑</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => restoreFromTrash(opportunity.id)} className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 shrink-0">🔄</button>
                            <button onClick={() => purgePermanently(opportunity.id)} className="px-2 py-1.5 text-xs font-semibold rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500 shrink-0">❌</button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-800 bg-slate-950/40 p-3 sm:p-5 space-y-4 sm:space-y-5 text-xs">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Job Description</h4>
                            <a href={opportunity.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Launch Link Origin ↗</a>
                          </div>
                          <div className="rounded-xl p-4 border border-slate-800 text-slate-300 bg-slate-900/40 max-h-72 overflow-y-auto">{renderFormattedContent(opportunity.description)}</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-2">AI Summary</span>
                            <p className="text-slate-300 leading-relaxed">{opportunity.summary}</p>
                          </div>
                          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-2">Profitability</span>
                            <span className="inline-block text-[11px] px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-bold">{opportunity.profitability}</span>
                          </div>
                          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mb-2">Difficulty</span>
                            <span className="inline-block text-[11px] px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-bold">{opportunity.difficulty}</span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Proposal Draft</h4>
                          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 text-slate-300 whitespace-pre-wrap font-mono bg-slate-900/50">
                            {opportunity.proposal}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileFilterOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-slate-950 border-r border-slate-800 shadow-2xl animate-slide-down p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filters</span>
              <button onClick={() => setMobileFilterOpen(false)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Lead Repositories</span>
                <button onClick={() => { setViewMode('active'); setMobileFilterOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition ${viewMode === 'active' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-900'}`}><span>📥 Live Leads Feed</span><span className="font-bold bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">{totalActiveLeadsCount}</span></button>
                <button onClick={() => { setViewMode('trash'); setMobileFilterOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition ${viewMode === 'trash' ? 'bg-rose-600/10 text-rose-400 border border-rose-500/20' : 'text-slate-400 hover:bg-slate-900'}`}><span>🗑 Trash</span><span className="font-bold bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-400">{totalTrashCount}</span></button>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Workspace</span>
                <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl text-slate-400 hover:bg-slate-900 transition" onClick={() => setMobileFilterOpen(false)}>Profile & Resume</Link>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Filter Platforms</span>
                <button onClick={() => { setSelectedSource('All'); setMobileFilterOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition ${selectedSource === 'All' ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>Universal Feed</button>
                {sortedSources.slice(0, 5).map(([src]) => (
                  <button key={src} onClick={() => { setSelectedSource(src); setMobileFilterOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition ${selectedSource === src ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>{src}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
