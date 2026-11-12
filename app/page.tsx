'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

interface JobOpportunity {
  id: string;
  title: string;
  company: string | null;
  description: string;
  budget: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  location: string | null;
  jobType: string | null;
  remote: boolean | null;
  postedAt: string | null;
  tags: string[];
  matchReason: string | null;
  source: string;
  url: string;
  postedTime: string;
  score: number;
  fitScore: number | null;
  fitMatched: string[];
  fitReason: string | null;
  applicationStatus: string;
  summary: string;
  proposal: string;
  status: string;
  applied: boolean;
  tracked: boolean;
  deleted: boolean;
  createdAt: string;
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/25 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
    >
      {label}
      <span aria-hidden="true" className="text-indigo-400 font-bold">×</span>
    </button>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [jobs, setJobs] = useState<JobOpportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [scraping, setScraping] = useState<boolean>(false);
  const [scrapeDone, setScrapeDone] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<string>('latest');
  const [selectedSource, setSelectedSource] = useState<string>('All');
  const [resumeFilter, setResumeFilter] = useState<boolean>(false);
  const [hideExpired, setHideExpired] = useState<boolean>(true);
  const [expiredCount, setExpiredCount] = useState<number>(0);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('All');
  const [nicheQuery, setNicheQuery] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [minSalary, setMinSalary] = useState<string>('');
  const [remoteOnly, setRemoteOnly] = useState<boolean>(false);
  const [jobTypeFilter, setJobTypeFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [applyingMap, setApplyingMap] = useState<Record<string, boolean>>({});
  const [discordLoadingMap, setDiscordLoadingMap] = useState<Record<string, boolean>>({});
  const [lastScrapeStats, setLastScrapeStats] = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [purgeMessage, setPurgeMessage] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [blacklistInput, setBlacklistInput] = useState('');
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [facets, setFacets] = useState<{
    jobTypes: Record<string, number>;
    remote: { true: number; false: number; unknown: number };
    sources: { source: string; count: number }[];
  } | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const industries = ['All', 'Entry Level', 'AI Automation', 'Video Editing', 'Appointment Setter', 'Social Media', 'Virtual Assistant'];

  // Canonical employment types the API stores. Keep in sync with
  // lib/job-attrs-core.ts `canonicalJobType`.
  const JOB_TYPE_OPTIONS = [
    { value: 'full-time', label: 'Full-time' },
    { value: 'part-time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'internship', label: 'Internship' },
    { value: 'freelance', label: 'Freelance' },
  ];

  const typeFacetTotal = facets
    ? JOB_TYPE_OPTIONS.reduce((sum, o) => sum + (facets.jobTypes?.[o.value] || 0), 0) + (facets.jobTypes?.unspecified || 0)
    : 0;

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { router.push('/sign-in'); return; }

    async function checkOnboarding() {
      try {
        const res = await fetch('/api/user-preferences');
        if (res.ok) {
          const data = await res.json();
          if (!data?.preferences?.setupComplete) {
            // Don't hijack the page with a redirect — the welcome modal in the
            // layout explains the product and lets the user choose. We only
            // surface a persistent banner so they can finish setup later.
            setNeedsSetup(true);
          }
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
    fetch('/api/me').then(r => r.ok && r.json()).then(d => { if (d?.user) setIsSubscribed(d.user.isSubscribed); }).catch(() => {});
  }, [onboardingChecked]);

  // Re-fetch the first page whenever a filter changes. These filters are
  // applied server-side, so they narrow the whole feed rather than just the
  // rows already loaded in the browser.
  // Niche query is excluded here because it is debounced with the free-text
  // search below — putting it in this key would fire a request per keystroke.
  const filtersKey = `${selectedSource}|${jobTypeFilter}|${remoteOnly ? 'r' : '-'}|${minSalary}|${hideExpired ? 'e' : '-'}|${resumeFilter ? 'f' : '-'}|${selectedIndustry}|${viewMode}`;
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (!onboardingChecked) return;
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    fetchOpportunities({ page: 1, append: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, onboardingChecked]);

  // Debounced free-text search (and niche search).
  useEffect(() => {
    if (!onboardingChecked) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      fetchOpportunities({ page: 1, append: false });
    }, 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, nicheQuery, onboardingChecked]);

  // Infinite scroll: load the next page as the user reaches the bottom.
  const loadMoreRef = useCallback(() => {
    if (loading || loadingMore) return;
    if (currentPage >= totalPages) return;
    fetchOpportunities({ page: currentPage + 1, append: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, totalPages, loading, loadingMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMoreRef(); },
      { rootMargin: '900px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMoreRef]);

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
              await fetchOpportunities({ page: 1, append: false });
              setTimeout(() => { setProgress(0); setScrapeDone(false); }, 2500);
            }
            setScraping(false);
            setSessionId(null);
            if (data.status === 'error') {
              const errMsg = data.error || 'Scrape failed';
              setScrapeError(errMsg);
              setProgressStatus(`Error: ${errMsg}`);
              setTimeout(() => { setProgress(0); setScrapeDone(false); }, 4000);
            }
          }
      } catch { clearInterval(interval); setScraping(false); setSessionId(null); }
    }, 1500);
    return () => clearInterval(interval);
  }, [sessionId, scraping]);

  const mapDbLeadToJob = (lead: any): JobOpportunity => {
    const salary = lead.salaryMin != null
      ? `$${lead.salaryMin.toLocaleString()}${lead.salaryMax != null ? ` – $${lead.salaryMax.toLocaleString()}` : ''}`
      : (lead.budget || 'Open Terms');
    return {
      id: lead.id,
      title: lead.title,
      company: lead.company || null,
      description: lead.description,
      budget: salary,
      salaryMin: lead.salaryMin ?? null,
      salaryMax: lead.salaryMax ?? null,
      salaryCurrency: lead.salaryCurrency || null,
      location: lead.location || null,
      jobType: lead.jobType || null,
      remote: lead.remote ?? null,
      postedAt: lead.postedAt || null,
      tags: lead.tags || [],
      matchReason: lead.matchReason || null,
      source: lead.source,
      url: lead.url,
      postedTime: lead.postedAt ? new Date(lead.postedAt).toLocaleDateString() : (lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : 'Just fetched'),
      score: lead.aiScore || 0,
      fitScore: lead.fitScore ?? null,
      fitMatched: lead.fitMatched || [],
      fitReason: lead.fitReason || null,
      applicationStatus: lead.applicationStatus || 'found',
      summary: lead.description?.substring(0, 200) || '',
      proposal: lead.proposalDraft || '',
      status: lead.status || 'active',
      applied: lead.applied || false,
      tracked: lead.tracked || false,
      deleted: lead.deleted || false,
      createdAt: lead.createdAt,
    };
  };

  const fetchOpportunities = async (opts?: { page?: number; append?: boolean; resumeMatch?: boolean }) => {
    const page = opts?.page ?? 1;
    const append = opts?.append ?? false;
    const useResumeMatch = opts?.resumeMatch ?? resumeFilter;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (useResumeMatch) params.set('sort', 'fit');
      if (hideExpired) params.set('maxAgeDays', '30');
      // Filters run server-side so they apply to the whole feed, not just the
      // pages that happen to be loaded in the browser.
      if (selectedSource !== 'All') params.set('source', selectedSource);
      if (jobTypeFilter !== 'All') params.set('jobType', jobTypeFilter);
      if (remoteOnly) params.set('remote', 'true');
      if (minSalary.trim() !== '' && !Number.isNaN(Number(minSalary))) params.set('minSalary', minSalary.trim());
      if (selectedIndustry !== 'All') params.set('industry', selectedIndustry);
      // The trash bin needs the soft-deleted rows the default query excludes.
      if (viewMode === 'trash') params.set('includeDeleted', 'true');
      const q = searchQuery.trim();
      if (q) params.set('q', q);
      // The niche query is a second free-text constraint. When the main search
      // is empty it becomes the primary query; otherwise both must match.
      const niche = nicheQuery.trim();
      if (niche) {
        if (q) params.set('niche', niche);
        else params.set('q', niche);
      }

      const response = await fetch(`/api/leads?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const dbLeads = data?.leads || [];
        const mapped = dbLeads.map(mapDbLeadToJob);
        setJobs(prev => (append ? [...prev, ...mapped] : mapped));
        setCurrentPage(data?.pagination?.page ?? page);
        setTotalPages(data?.pagination?.totalPages ?? 1);
        setTotalCount(data?.pagination?.total ?? mapped.length);
        if (!append && data?.facets) setFacets(data.facets);
        if (!append) setExpiredCount(data?.hiddenExpired ?? 0);
      }
    } catch (err) { console.error('Failed reading records:', err); }
    setLoading(false);
    setLoadingMore(false);
  };

  const handleJobPilot = async (opportunity: JobOpportunity, action: 'score' | 'tailor') => {
    setApplyingMap(prev => ({ ...prev, [opportunity.id]: true }));
    setScrapeError(null);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, leadId: opportunity.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScrapeError(data?.error || `JobPilot ${action} failed`);
        return;
      }
      setJobs(prev => prev.map(j => j.id === opportunity.id
        ? {
            ...j,
            fitScore: data?.fit?.score ?? j.fitScore,
            fitMatched: data?.fit?.matched ?? j.fitMatched,
            fitReason: data?.fit?.reason ?? j.fitReason,
            applicationStatus: action === 'tailor' ? 'drafted' : j.applicationStatus,
          }
        : j));
      if (action === 'tailor') {
        setScrapeError(null);
        setProgressStatus('Draft ready — review it in the Approval Queue');
      }
    } catch (err) {
      console.error('JobPilot failed:', err);
      setScrapeError('JobPilot request failed. Check your connection.');
    } finally {
      setApplyingMap(prev => ({ ...prev, [opportunity.id]: false }));
    }
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
    setScrapeError(null);
    setProgress(5);
    setProgressStatus('Starting scraper...');
    setLastScrapeStats(null);

    // The server runs a bounded slice per request (a serverless function
    // cannot walk all 34 boards in one go - it gets killed partway and the
    // session is left stuck at "running, 0 sources"). The client therefore
    // drives the slices until the server reports the run is finished.
    let currentSessionId: string | null = null;
    let batch = 0;
    const MAX_BATCHES = 40;

    try {
      while (batch < MAX_BATCHES) {
        batch++;

        const response: Response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'scrape',
            industry: selectedIndustry,
            query: nicheQuery,
            ...(currentSessionId ? { sessionId: currentSessionId } : {}),
          }),
        });

        const data: {
          error?: string;
          message?: string;
          sessionId?: string;
          done?: boolean;
          totalSources?: number;
          completedSources?: number;
          leadsCreated?: number;
        } = await response.json().catch(() => ({}));

        if (!response.ok) {
          const msg = data?.error || data?.message || `Scrape failed (HTTP ${response.status})`;
          setScrapeError(msg);
          setProgressStatus(`Error: ${msg}`);
          setScraping(false);
          setSessionId(null);
          return;
        }

        if (data.sessionId) {
          currentSessionId = data.sessionId;
          setSessionId(currentSessionId);
        }

        const total = data.totalSources || 35;
        const doneCount = data.completedSources || 0;
        setProgress(Math.min(95, Math.round((doneCount / total) * 100)));

        if (data.done) {
          setProgress(100);
          setProgressStatus('Done! ✅');
          setScrapeDone(true);
          await fetchOpportunities({ page: 1, append: false });
          setTimeout(() => { setProgress(0); setScrapeDone(false); }, 2500);
          setScraping(false);
          setSessionId(null);
          return;
        }

        setProgressStatus(`Scraping sources ${doneCount}/${total}...`);
        // Give the server a moment between slices and let the progress bar breathe.
        await new Promise(r => setTimeout(r, 200));
      }

      setScrapeError('Scrape stopped after too many batches. Try pulling again.');
      setScraping(false);
      setSessionId(null);
    } catch (err) {
      setScrapeError('Network error — check your connection');
      setScraping(false);
      setProgress(0);
      setSessionId(null);
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

  /**
   * Permanently delete leads in bulk.
   *
   * The old version emptied the trash with one DELETE request per row that
   * happened to be loaded on screen, so most of the trash survived. This hits
   * the server-side bulk endpoint instead, which removes every matching row.
   */
  const purgeLeads = async (scope: 'trash' | 'older', days?: number) => {
    const label = scope === 'trash'
      ? 'Permanently delete everything in the Trash Bin? Leads you already applied to are kept.'
      : `Permanently delete leads older than ${days ?? 30} days? Applied leads are kept.`;
    if (!window.confirm(label)) return;

    setPurging(true);
    setPurgeMessage(null);
    try {
      const res = await fetch('/api/leads/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scope === 'trash' ? { scope } : { scope, days }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPurgeMessage(data?.error || 'Could not delete the selected leads.');
        return;
      }
      const keptNote = data.kept > 0
        ? ` ${data.kept} applied lead${data.kept === 1 ? '' : 's'} kept.`
        : '';
      setPurgeMessage(
        scope === 'trash'
          ? `Deleted ${data.deleted ?? 0} lead${data.deleted === 1 ? '' : 's'} from the trash.${keptNote}`
          : `Deleted ${data.deleted ?? 0} old lead${data.deleted === 1 ? '' : 's'}.`,
      );
      await fetchOpportunities({ page: 1, append: false });
      setTimeout(() => setPurgeMessage(null), 6000);
    } catch {
      setPurgeMessage('Network error — could not delete the selected leads.');
    } finally {
      setPurging(false);
    }
  };

  const clearTrashBin = async () => {
    await purgeLeads('trash');
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

  const formatRelativeTime = (postedAt: string | null, createdAt: string): string => {
    const raw = postedAt || createdAt;
    if (!raw) return 'Just fetched';
    const date = new Date(raw);
    if (isNaN(date.getTime())) return 'Just fetched';
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return 'just now';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return date.toLocaleDateString();
  };

  const displaySalary = (job: JobOpportunity): string => {
    if (job.salaryMin != null || job.salaryMax != null) return job.budget;
    if (job.budget && job.budget !== 'Open Terms') return job.budget;
    return 'Salary not listed';
  };

  const capitalize = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    minSalary !== '' ||
    remoteOnly ||
    jobTypeFilter !== 'All' ||
    nicheQuery.trim() !== '' ||
    selectedSource !== 'All' ||
    selectedIndustry !== 'All';

  const clearFilters = () => {
    setSearchQuery('');
    setMinSalary('');
    setRemoteOnly(false);
    setJobTypeFilter('All');
    setNicheQuery('');
    setSelectedSource('All');
    setSelectedIndustry('All');
  };

  const totalActiveLeadsCount = jobs.filter(j => !j.deleted).length;
  const totalTrashCount = jobs.filter(j => j.deleted).length;

  const sourceCounts = jobs.reduce((acc, j) => {
    const source = j.source || 'Unknown';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Prefer the server-side facet counts: the loaded page only contains the
  // sources that happened to appear in it, so deriving the list from loaded
  // jobs would hide sources that still have plenty of results.
  const sortedSources: [string, number][] = facets?.sources?.length
    ? facets.sources.map(s => [s.source, s.count] as [string, number])
    : Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);

  // Source, industry, niche, search, salary, remote and job-type filtering all
  // happen server-side, so the API has already narrowed the feed. Re-applying
  // them here would drop rows the server legitimately returned (the client
  // used to search tags while the API searched title/description/company) and
  // make the "Found N" counter disagree with the API total.
  const displayedOpportunities = jobs
    .filter(job => viewMode === 'active' ? !job.deleted : job.deleted)
    .sort((a, b) => {
      if (sortBy === 'highest-paid') {
        const aMax = a.salaryMax ?? a.salaryMin ?? -1;
        const bMax = b.salaryMax ?? b.salaryMin ?? -1;
        return bMax - aMax;
      }
      if (sortBy === 'score') return (b.score || 0) - (a.score || 0);
      return new Date(b.postedAt || b.createdAt).getTime() - new Date(a.postedAt || a.createdAt).getTime();
    });

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
            <button onClick={() => setViewMode('active')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${viewMode === 'active' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
              <span>📥 Live Leads Feed</span>
              <span className="font-bold bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">{totalActiveLeadsCount}</span>
            </button>
            <button onClick={() => setViewMode('trash')} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${viewMode === 'trash' ? 'bg-rose-600/10 text-rose-400 border border-rose-500/20' : 'text-slate-400 hover:bg-slate-900'}`}>
              <span>🗑 Trash Bin History</span>
              <span className="font-bold bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-400">{totalTrashCount}</span>
            </button>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Workspace</span>
            <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl text-slate-400 hover:bg-slate-900 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">Profile & Resume</Link>
            <Link href="/approval-queue" className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl text-amber-300/90 hover:bg-slate-900 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">✨ Approval Queue</Link>
            <Link href="/tracker" className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl text-emerald-300/90 hover:bg-slate-900 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">📊 Application Tracker</Link>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Moderation</span>
            <button onClick={() => setShowBlacklist(!showBlacklist)} className={`w-full text-left px-3 py-2 text-xs font-medium rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${showBlacklist ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900'}`}>
              🚫 Blocklist {blacklist.length > 0 && <span className="ml-1 text-rose-400">({blacklist.length})</span>}
            </button>
          </div>

          {showBlacklist && (
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-2">
              <div className="flex gap-1">
                <input value={blacklistInput} onChange={e => setBlacklistInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBlacklistKeyword()} placeholder="e.g. blockchain" className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none" />
                <button onClick={addBlacklistKeyword} className="px-2 py-1 text-xs font-semibold rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">Add</button>
              </div>
              {blacklist.map(k => (
                <div key={k} className="flex items-center justify-between px-2 py-1 rounded bg-slate-800/50">
                  <span className="text-xs text-slate-300">{k}</span>
                  <button onClick={() => removeBlacklistKeyword(k)} aria-label={`Remove ${k} from blocklist`} className="text-rose-400 hover:text-rose-300 text-xs focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">✕</button>
                </div>
              ))}
            </div>
          )}

          {!isSubscribed && (
            <div className="rounded-xl bg-gradient-to-br from-indigo-600/10 to-violet-600/10 border border-indigo-500/20 p-4 space-y-3">
              <div><p className="text-[11px] font-bold text-indigo-300">Unlock Full Access</p><p className="text-[10px] text-slate-400 mt-1">Get unlimited leads, priority AI analysis, and Discord alerts.</p></div>
              <Link href="/pricing" className="block w-full text-center text-xs font-bold py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:from-indigo-400 hover:to-violet-400 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/20 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">Upgrade Plan</Link>
            </div>
          )}

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Filter Platforms</span>
            <button onClick={() => setSelectedSource('All')} className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${selectedSource === 'All' ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>Universal Feed</button>
            {sortedSources.slice(0, 5).map(([src]) => (
              <button key={src} onClick={() => setSelectedSource(src)} className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${selectedSource === src ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>{src}</button>
            ))}
            {sortedSources.length > 5 && (
              <details className="group">
                <summary className="w-full text-left px-3 py-1.5 text-xs rounded-xl text-slate-500 hover:text-slate-300 hover:bg-slate-900 cursor-pointer list-none flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
                  <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  More sources ({sortedSources.length - 5})
                </summary>
                <div className="pt-1 space-y-0.5">
                  {sortedSources.slice(5).map(([src]) => (
                    <button key={src} onClick={() => setSelectedSource(src)} className={`w-full text-left px-3 py-1 text-xs rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${selectedSource === src ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>{src}</button>
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
              <button onClick={() => setMobileFilterOpen(true)} aria-label="Open filters" className="md:hidden p-2 rounded-lg bg-slate-800 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
                <svg className="w-4 h-4 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              </button>
              <h2 className="font-bold text-slate-200 text-sm md:text-base truncate">{viewMode === 'active' ? 'Live Leads Feed' : 'Trash Bin'}</h2>
            </div>
            <a href="/local-leads" className="text-xs sm:text-sm text-indigo-300 hover:underline shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none rounded">Local</a>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <button onClick={() => fetchOpportunities({ page: 1, append: false })} disabled={loading} aria-label="Refresh leads" title="Refresh leads" className="px-3 py-2 text-xs font-bold rounded-xl tracking-wide transition shadow-sm bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">{loading ? 'Refreshing...' : '🔄'}</button>
            <button onClick={handleRunScraperPipeline} disabled={scraping} className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-xl tracking-wide transition shadow-sm shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${scraping ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>
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

        {scrapeError && (
          <div className="px-6 py-3 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
            <span>⚠️</span> {scrapeError}
            <button onClick={() => setScrapeError(null)} aria-label="Dismiss error" className="ml-auto text-rose-400 hover:text-rose-200 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">✕</button>
          </div>
        )}

        {lastScrapeStats && progress === 0 && !scrapeError && (
          <div className="px-6 py-2 bg-indigo-500/10 border-b border-indigo-500/20 text-xs text-indigo-300">{lastScrapeStats}</div>
        )}

        {needsSetup && (
          <div className="px-4 sm:px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-200 flex flex-wrap items-center gap-3">
            <span aria-hidden="true">⚡</span>
            <span className="flex-1 min-w-[12rem]">
              Add your resume to unlock <strong>resume-match ranking</strong> and tailored applications.
            </span>
            <Link
              href="/onboarding"
              className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 transition hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none"
            >
              Set up my profile
            </Link>
            <button
              onClick={() => setNeedsSetup(false)}
              aria-label="Dismiss setup reminder"
              className="rounded-lg p-1 text-amber-300/70 hover:text-amber-200 hover:bg-amber-500/10 transition focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none"
            >
              ✕
            </button>
          </div>
        )}

        <main className="flex-1 p-3 sm:p-6 max-w-5xl w-full mx-auto space-y-5 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">Target Industry / Niche Selection</span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {industries.map(ind => (
                <button key={ind} onClick={() => setSelectedIndustry(ind)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${selectedIndustry === ind ? 'bg-indigo-600 text-white font-semibold' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>{ind}</button>
              ))}
            </div>
            <div className="mt-4">
              <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-2">Niche search</label>
              <div className="flex gap-2">
                <input type="text" value={nicheQuery} onChange={e => setNicheQuery(e.target.value)} placeholder="e.g. 'data entry', 'copywriter'..." className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none" />
              </div>
            </div>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 block">Refine Results</span>
            <div className="flex flex-wrap gap-2 mb-2">
              <button
                onClick={() => {
                  const next = !resumeFilter;
                  setResumeFilter(next);
                  fetchOpportunities({ page: 1, append: false, resumeMatch: next });
                }}
                aria-pressed={resumeFilter}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${resumeFilter ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-900/30' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-amber-500/40'}`}
              >
                {resumeFilter ? '✓ Resume Match ON' : 'Resume Match (Auto)'}
              </button>
              <button
                onClick={() => fetchOpportunities({ page: 1, append: false })}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
              >
                ↻ Refresh
              </button>
              <button
                onClick={() => {
                  const next = !hideExpired;
                  setHideExpired(next);
                  fetchOpportunities({ page: 1, append: false });
                }}
                aria-pressed={hideExpired}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${hideExpired ? 'bg-rose-600 text-white shadow-lg shadow-rose-950/30' : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-rose-500/40'}`}
              >
                {hideExpired ? '✓ Expired hidden' : 'Show expired'}
              </button>
              <span className="self-center text-[11px] text-slate-500">Ranks by how well each job matches your resume</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Search</span>
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" /></svg>
                  <input type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Title, company, tags..." className="w-full rounded-xl border border-slate-800 bg-slate-900 pl-8 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none" />
                </div>
              </label>

              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Minimum salary (USD)</span>
                <input type="number" min={0} step={1000} value={minSalary} onChange={e => setMinSalary(e.target.value)} placeholder="e.g. 60000" className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none" />
              </label>

              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">Job type</span>
                <select value={jobTypeFilter} onChange={e => setJobTypeFilter(e.target.value)} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
                  <option value="All">All types{typeFacetTotal ? ` (${typeFacetTotal})` : ''}</option>
                  {JOB_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}{facets?.jobTypes?.[opt.value] != null ? ` (${facets.jobTypes[opt.value]})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 min-h-[38px]">
                <input type="checkbox" checked={remoteOnly} onChange={e => setRemoteOnly(e.target.checked)} className="h-4 w-4 rounded accent-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none" />
                <span className="text-sm text-slate-200">Remote only</span>
                {facets?.remote?.true != null && (
                  <span className="ml-auto text-[11px] tabular-nums text-slate-500">{facets.remote.true}</span>
                )}
              </label>
            </div>

            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-500 font-medium">Active filters:</span>
                {searchQuery.trim() !== '' && <FilterChip label={`"${searchQuery.trim()}"`} onClear={() => setSearchQuery('')} />}
                {minSalary !== '' && !Number.isNaN(Number(minSalary)) && <FilterChip label={`Salary ≥ $${Number(minSalary).toLocaleString()}`} onClear={() => setMinSalary('')} />}
                {remoteOnly && <FilterChip label="Remote only" onClear={() => setRemoteOnly(false)} />}
                {jobTypeFilter !== 'All' && <FilterChip label={capitalize(jobTypeFilter)} onClear={() => setJobTypeFilter('All')} />}
                {nicheQuery.trim() !== '' && <FilterChip label={`niche "${nicheQuery.trim()}"`} onClear={() => setNicheQuery('')} />}
                {selectedSource !== 'All' && <FilterChip label={selectedSource} onClear={() => setSelectedSource('All')} />}
                {selectedIndustry !== 'All' && <FilterChip label={selectedIndustry} onClear={() => setSelectedIndustry('All')} />}
                <button onClick={clearFilters} className="text-xs text-indigo-400 hover:text-indigo-300 underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none rounded">Clear all</button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between bg-slate-950/20 border border-slate-800 rounded-xl px-3 sm:px-4 py-2.5 gap-2">
            <span aria-live="polite" className="text-xs sm:text-sm font-semibold text-slate-400 truncate">Found <strong className="text-slate-200">{viewMode === 'trash' ? displayedOpportunities.length : totalCount}</strong> {viewMode === 'trash' ? (displayedOpportunities.length === 1 ? 'entry' : 'entries') : 'matching jobs'}{hideExpired && expiredCount > 0 ? <span className="text-rose-300/80"> · {expiredCount} expired hidden</span> : null}</span>
            <div className="flex items-center gap-2">
              {viewMode === 'trash' && totalTrashCount > 0 && (
                <button
                  onClick={clearTrashBin}
                  disabled={purging}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                >
                  {purging ? 'Deleting…' : '🗑 Empty trash'}
                </button>
              )}
              {viewMode === 'active' && (
                <button
                  onClick={() => purgeLeads('older', 30)}
                  disabled={purging}
                  title="Permanently delete leads older than 30 days (applied leads are kept)"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900/70 text-slate-300 border border-slate-700 hover:bg-rose-600/20 hover:text-rose-300 hover:border-rose-500/30 transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                >
                  {purging ? 'Deleting…' : '🧹 Clear old'}
                </button>
              )}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort jobs" className="bg-slate-900 border border-slate-700 text-slate-200 text-xs sm:text-sm rounded-lg px-2.5 py-1.5 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
                <option value="latest">🕒 Latest</option>
                <option value="highest-paid">💰 Highest paid</option>
                <option value="score">⭐ AI Score</option>
              </select>
            </div>
          </div>

          {purgeMessage && (
            <p role="status" className="mt-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
              {purgeMessage}
            </p>
          )}

          {loading ? (
            <div className="space-y-3.5" aria-busy="true" aria-label="Loading jobs">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="bg-slate-950/30 rounded-xl border border-slate-800 p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-3 w-16 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-14 bg-slate-800 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-2/3 bg-slate-800 rounded animate-pulse mb-2.5" />
                  <div className="h-3.5 w-1/3 bg-slate-800 rounded animate-pulse mb-3" />
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-24 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-slate-800 rounded animate-pulse" />
                    <div className="h-3 w-20 bg-slate-800 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayedOpportunities.length === 0 ? (
            <div className="text-center py-20 bg-slate-950/10 rounded-2xl border border-dashed border-slate-800">
              <div className="text-4xl mb-3" aria-hidden="true">{viewMode === 'trash' ? '🗑️' : '🔍'}</div>
              {viewMode === 'trash' ? (
                <>
                  <p className="text-slate-300 font-semibold text-sm">Trash is empty</p>
                  <p className="text-slate-500 text-xs mt-1">Deleted leads will show up here.</p>
                </>
              ) : hasActiveFilters ? (
                <>
                  <p className="text-slate-300 font-semibold text-sm">No jobs match your filters</p>
                  <p className="text-slate-500 text-xs mt-1">Try adjusting or clearing your filters.</p>
                  <button onClick={clearFilters} className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">Clear filters</button>
                </>
              ) : (
                <>
                  <p className="text-slate-300 font-semibold text-sm">No records found</p>
                  <p className="text-slate-500 text-xs mt-1">Click Pull to scrape new opportunities.</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              {displayedOpportunities.map(opportunity => {
                const isExpanded = expandedJobId === opportunity.id;
                const isSendingToDiscord = !!discordLoadingMap[opportunity.id];
                const isApplying = !!applyingMap[opportunity.id];
                const hasSalary = opportunity.salaryMin != null || opportunity.salaryMax != null;

                return (
                  <div key={opportunity.id} className={`bg-slate-950/30 rounded-xl border transition-all overflow-hidden ${isExpanded ? 'border-slate-700 bg-slate-950/70 shadow-lg' : 'border-slate-800 hover:border-slate-600 hover:bg-slate-950/50'}`}>
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 uppercase tracking-wider">{opportunity.source}</span>
                          <span className="text-xs text-slate-500">🕒 {formatRelativeTime(opportunity.postedAt, opportunity.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {opportunity.tracked && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">✓ Tracking</span>}
                          {opportunity.applied && <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">✓ Applied</span>}
                        </div>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold leading-snug mb-2">
                        <a href={opportunity.url} target="_blank" rel="noopener noreferrer" className="text-slate-100 hover:text-indigo-300 hover:underline transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none rounded">
                          {opportunity.title}
                        </a>
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3 text-sm text-slate-400">
                        {opportunity.company && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">🏢</span><span className="text-slate-300 font-medium">{opportunity.company}</span></span>}
                        {opportunity.location && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">📍</span>{opportunity.location}</span>}
                        <span className={`inline-flex items-center gap-1.5 font-semibold ${hasSalary ? 'text-emerald-400' : 'text-slate-500'}`}><span aria-hidden="true">💰</span>{displaySalary(opportunity)}</span>
                        {opportunity.jobType && <span className="inline-flex items-center gap-1.5"><span aria-hidden="true">💼</span>{capitalize(opportunity.jobType)}</span>}
                        {opportunity.fitScore != null && (
                          <span className={`inline-flex items-center gap-1 text-indigo-400 font-semibold ${opportunity.fitScore >= 60 ? 'text-emerald-400' : ''}`}>
                            <span aria-hidden="true">🎯</span>Fit {opportunity.fitScore}%{opportunity.fitMatched?.length ? ` (${opportunity.fitMatched.slice(0, 3).join(', ')})` : ''}
                          </span>
                        )}
                        {opportunity.score > 0 && <span className="inline-flex items-center gap-1.5 text-indigo-400 font-semibold"><span aria-hidden="true">⭐</span>Score {opportunity.score}/10</span>}
                      </div>

                      {opportunity.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {opportunity.tags.slice(0, 6).map(t => (
                            <span key={t} className="inline-block text-xs px-2 py-0.5 rounded-md bg-slate-800/70 text-slate-300 border border-slate-700">{t}</span>
                          ))}
                          {opportunity.tags.length > 6 && <span className="text-xs text-slate-500 self-center">+{opportunity.tags.length - 6}</span>}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <a href={opportunity.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/20 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
                          Apply <span aria-hidden="true">↗</span>
                        </a>
                        <button
                          onClick={() => handleJobPilot(opportunity, 'score')}
                          disabled={isApplying}
                          title="Score this job against your resume"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition shrink-0 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                        >
                          {isApplying ? '…' : '🎯 Fit'}
                        </button>
                        <button
                          onClick={() => handleJobPilot(opportunity, 'tailor')}
                          disabled={isApplying}
                          title="Tailor your resume + write a cover email, then send it to the approval queue"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition shrink-0 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                        >
                          {isApplying ? '…' : '✨ Tailor'}
                        </button>

                        {viewMode === 'active' ? (
                          <>
                            <button onClick={() => toggleTrack(opportunity.id, opportunity.tracked)} title={opportunity.tracked ? 'Stop tracking this job' : 'Track this job'} className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${opportunity.tracked ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}>
                              {opportunity.tracked ? 'Tracking' : 'Track'}
                            </button>
                            <button onClick={() => toggleApplied(opportunity.id, opportunity.applied)} disabled={isApplying} title={opportunity.applied ? 'Mark as not applied' : 'Mark as applied'} className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${opportunity.applied ? 'bg-blue-600/10 border-blue-500 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'}`}>
                              {isApplying ? '...' : opportunity.applied ? 'Applied' : 'Mark applied'}
                            </button>
                            <button onClick={() => { reviewJob(opportunity); router.push('/profile'); }} title="Review this job & update your profile" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
                              Profile
                            </button>
                            <button onClick={() => handleSendToDiscord(opportunity)} disabled={isSendingToDiscord} title="Send to Discord" aria-label={`Send ${opportunity.title} to Discord`} className={`inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border transition shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${isSendingToDiscord ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-purple-400 hover:border-slate-700'}`}>
                              {isSendingToDiscord ? '...' : '🚀'}
                            </button>
                            <button onClick={() => moveToTrash(opportunity.id)} title="Move to trash" aria-label={`Move ${opportunity.title} to trash`} className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-800 bg-slate-900 text-slate-500 hover:text-rose-400 hover:border-slate-700 transition shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">🗑</button>
                            <button onClick={() => setExpandedJobId(isExpanded ? null : opportunity.id)} aria-expanded={isExpanded} aria-label={isExpanded ? 'Hide job details' : 'Show job details'} title={isExpanded ? 'Hide details' : 'Show details'} className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
                              {isExpanded ? 'Hide' : '📄'}
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => restoreFromTrash(opportunity.id)} title="Restore this job" aria-label={`Restore ${opportunity.title}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20 transition shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">🔄 Restore</button>
                            <button onClick={() => purgePermanently(opportunity.id)} title="Delete permanently" aria-label={`Delete ${opportunity.title} permanently`} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500 hover:bg-rose-600/30 transition shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">❌ Delete</button>
                            <button onClick={() => setExpandedJobId(isExpanded ? null : opportunity.id)} aria-expanded={isExpanded} aria-label={isExpanded ? 'Hide job details' : 'Show job details'} title={isExpanded ? 'Hide details' : 'Show details'} className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
                              {isExpanded ? 'Hide' : '📄'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-800 bg-slate-950/40 p-4 sm:p-5 space-y-4 sm:space-y-5 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Job Description</h4>
                            <a href={opportunity.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none rounded">Launch Link Origin ↗</a>
                          </div>
                          <div className="rounded-xl p-4 border border-slate-800 text-slate-300 bg-slate-900/40 max-h-72 overflow-y-auto">{renderFormattedContent(opportunity.description)}</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider mb-2">Why this matches</span>
                            <p className="text-slate-300 leading-relaxed">{opportunity.matchReason || opportunity.summary || 'No match details.'}</p>
                          </div>
                          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider mb-2">Details</span>
                            <div className="space-y-1 text-xs text-slate-300">
                              <div>Company: <span className="text-slate-400">{opportunity.company || '—'}</span></div>
                              <div>Location: <span className="text-slate-400">{opportunity.location || '—'}</span></div>
                              <div>Type: <span className="text-slate-400">{opportunity.jobType ? capitalize(opportunity.jobType) : '—'}</span></div>
                              <div>Remote: <span className="text-slate-400">{opportunity.remote === false ? 'No' : opportunity.remote ? 'Yes' : '—'}</span></div>
                            </div>
                          </div>
                          <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <span className="text-xs text-slate-500 block uppercase font-bold tracking-wider mb-2">Tags</span>
                            <div className="flex flex-wrap gap-1.5">
                              {opportunity.tags.length > 0
                                ? opportunity.tags.map(t => <span key={t} className="inline-block text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">{t}</span>)
                                : <span className="text-slate-500 text-xs">No tags</span>}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Proposal Draft</h4>
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

          {/* Infinite-scroll trigger: keeps loading pages as the user scrolls. */}
          <div ref={sentinelRef} aria-hidden="true" className="h-px" />

          {!loading && viewMode === 'active' && currentPage < totalPages && (
            <div className="pt-2 flex flex-col items-center gap-2">
              <button
                onClick={loadMoreRef}
                disabled={loadingMore}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-indigo-950/40 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
              >
                {loadingMore ? 'Loading…' : `Load more jobs (${displayedOpportunities.length} of ${totalCount})`}
              </button>
              <span className="text-[11px] text-slate-500">
                {currentPage < totalPages ? 'Scroll for more — the page loads as you go' : `All ${totalCount} jobs loaded`}
              </span>
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
              <button onClick={() => setMobileFilterOpen(false)} aria-label="Close filters" className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Lead Repositories</span>
                <button onClick={() => { setViewMode('active'); setMobileFilterOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${viewMode === 'active' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:bg-slate-900'}`}><span>📥 Live Leads Feed</span><span className="font-bold bg-slate-900 px-1.5 py-0.5 rounded text-[10px]">{totalActiveLeadsCount}</span></button>
                <button onClick={() => { setViewMode('trash'); setMobileFilterOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${viewMode === 'trash' ? 'bg-rose-600/10 text-rose-400 border border-rose-500/20' : 'text-slate-400 hover:bg-slate-900'}`}><span>🗑 Trash</span><span className="font-bold bg-slate-900 px-1.5 py-0.5 rounded text-[10px] text-slate-400">{totalTrashCount}</span></button>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Workspace</span>
                <Link href="/profile" className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl text-slate-400 hover:bg-slate-900 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none" onClick={() => setMobileFilterOpen(false)}>Profile & Resume</Link>
                <Link href="/approval-queue" className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl text-amber-300/90 hover:bg-slate-900 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none" onClick={() => setMobileFilterOpen(false)}>✨ Approval Queue</Link>
                <Link href="/tracker" className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl text-emerald-300/90 hover:bg-slate-900 transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none" onClick={() => setMobileFilterOpen(false)}>📊 Application Tracker</Link>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">Filter Platforms</span>
                <button onClick={() => { setSelectedSource('All'); setMobileFilterOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${selectedSource === 'All' ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>Universal Feed</button>
                {sortedSources.slice(0, 5).map(([src]) => (
                  <button key={src} onClick={() => { setSelectedSource(src); setMobileFilterOpen(false); }} className={`w-full text-left px-3 py-1.5 text-xs rounded-xl transition focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none ${selectedSource === src ? 'bg-slate-800 text-white font-medium border border-slate-700' : 'text-slate-400 hover:bg-slate-900'}`}>{src}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
