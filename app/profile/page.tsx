'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

interface CareerProfile {
  name: string;
  email: string;
  resumeFileName: string;
  resumeBase64: string;
  resumeText: string;
}

interface ReviewedJob {
  id: string;
  title: string;
  description: string;
  reviewedAt: string;
  tailoredResume?: string;
}

export default function ProfilePage() {
  const { user } = useUser();
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [reviewedJobs, setReviewedJobs] = useState<ReviewedJob[]>([]);
  const [reworkingId, setReworkingId] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [targetUrls, setTargetUrls] = useState<string[]>([]);
  const [newTargetUrl, setNewTargetUrl] = useState('');
  const [savingTargets, setSavingTargets] = useState(false);

  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [savingDiscord, setSavingDiscord] = useState(false);
  const [discordSaved, setDiscordSaved] = useState(false);
  const [discordError, setDiscordError] = useState('');
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    fetchProfile();
    fetchReviewedJobs();
    fetchTargetUrls();
    fetchDiscordWebhook();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      setProfile(data.profile || null);
    } catch {}
  };

  const fetchReviewedJobs = async () => {
    try {
      const res = await fetch('/api/review-job');
      const data = await res.json();
      if (data.success) setReviewedJobs(data.jobs);
    } catch {}
  };

  const fetchTargetUrls = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data && Array.isArray(data.targetUrls)) {
        setTargetUrls(data.targetUrls);
      }
    } catch {}
  };

  const fetchDiscordWebhook = async () => {
    try {
      const res = await fetch('/api/profile/discord');
      const data = await res.json();
      if (data.success) setDiscordWebhookUrl(data.discordWebhookUrl || '');
    } catch {}
  };

  const isValidDiscordWebhook = (url: string) => {
    return /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url);
  };

  const saveDiscordWebhook = async () => {
    setDiscordError('');
    setDiscordSaved(false);

    if (discordWebhookUrl && !isValidDiscordWebhook(discordWebhookUrl)) {
      setDiscordError('Invalid Discord webhook URL format. It should look like: https://discord.com/api/webhooks/...');
      return;
    }

    setSavingDiscord(true);
    try {
      const res = await fetch('/api/profile/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordWebhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscordSaved(true);
        setDiscordTestResult('idle');
        setTimeout(() => setDiscordSaved(false), 3000);
      } else {
        setDiscordError(data.error || 'Failed to save webhook');
      }
    } catch {
      setDiscordError('Network error saving webhook');
    }
    setSavingDiscord(false);
  };

  const testDiscordWebhook = async () => {
    if (!discordWebhookUrl) return;
    setTestingDiscord(true);
    setDiscordTestResult('idle');
    setDiscordError('');
    try {
      const res = await fetch('/api/profile/discord/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordWebhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscordTestResult('success');
      } else {
        setDiscordTestResult('error');
        setDiscordError(data.error || 'Test failed');
      }
    } catch {
      setDiscordTestResult('error');
      setDiscordError('Network error testing webhook');
    }
    setTestingDiscord(false);
  };

  const addTargetUrl = async () => {
    const url = newTargetUrl.trim();
    if (!url || targetUrls.includes(url)) return;
    const updated = [...targetUrls, url];
    setTargetUrls(updated);
    setNewTargetUrl('');
    setSavingTargets(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrls: updated }),
      });
    } catch {}
    setSavingTargets(false);
  };

  const removeTargetUrl = async (url: string) => {
    const updated = targetUrls.filter(u => u !== url);
    setTargetUrls(updated);
    setSavingTargets(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrls: updated }),
      });
    } catch {}
    setSavingTargets(false);
  };

  const uploadFile = async () => {
    if (!file) return;
    const b64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.readAsDataURL(file);
    });
    await saveProfile({ resumeFileName: file.name, resumeBase64: b64 });
  };

  const saveProfile = async (payload: Partial<CareerProfile>) => {
    setSaving(true);
    try {
      const body = {
        name: payload.name || profile?.name || 'Unnamed',
        email: payload.email || profile?.email || '',
        resumeFileName: payload.resumeFileName || profile?.resumeFileName || '',
        resumeBase64: payload.resumeBase64 || profile?.resumeBase64 || '',
        resumeText: payload.resumeText ?? profile?.resumeText ?? '',
      };
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data?.profile) {
        setProfile(data.profile);
        setPasteText('');
      }
    } catch (e) {
      console.error('Failed to save profile', e);
    } finally {
      setSaving(false);
    }
  };

  const handlePasteSave = async () => {
    await saveProfile({ resumeText: pasteText });
  };

  const reworkResume = async (job: ReviewedJob) => {
    setReworkingId(job.id);
    try {
      const res = await fetch('/api/rework-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          jobTitle: job.title,
          jobDescription: job.description,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setReviewedJobs(prev => prev.map(j => j.id === job.id ? { ...j, tailoredResume: data.tailoredResume } : j));
        setExpandedJob(job.id);
      } else {
        alert(data.error || 'Failed to rework resume');
      }
    } catch (e) {
      console.error('Rework failed', e);
    } finally {
      setReworkingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Career Profile Workspace</p>
            <h1 className="mt-2 text-3xl font-bold text-white">Profile & Resume Hub</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Store your career profile centrally, then use AI to tailor your resume for specific job opportunities.</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mt-6">
            <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6">
              <h2 className="text-lg font-semibold text-white">Upload Resume</h2>
              <p className="mt-1 text-sm text-slate-400">PDF or DOC file.</p>
              <div className="mt-4 flex flex-col gap-3">
                <input type="file" accept="application/pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-slate-200" />
                <button onClick={uploadFile} disabled={!file || saving} className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60">
                  {saving ? 'Saving...' : 'Upload Resume'}
                </button>
                {profile?.resumeFileName && <p className="text-sm text-slate-400">Stored: {profile.resumeFileName}</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6">
              <h2 className="text-lg font-semibold text-white">Paste Resume Text</h2>
              <p className="mt-1 text-sm text-slate-400">Copy-paste your resume for AI tailoring.</p>
              <textarea rows={8} value={pasteText} onChange={(e) => setPasteText(e.target.value)} className="mt-4 w-full rounded-xl border border-slate-800/50 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" />
              <button onClick={handlePasteSave} disabled={!pasteText || saving} className="mt-4 inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition disabled:opacity-60">
                Save Resume Text
              </button>
            </section>
          </div>

          <section className="mt-6 rounded-2xl border border-slate-800/60 bg-slate-950/40 p-6">
            <h2 className="text-lg font-semibold text-white">Current Profile</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Name</p>
                <p className="mt-1 text-lg font-semibold text-white">{profile?.name || 'No name set'}</p>
              </div>
              <div className="rounded-xl border border-slate-800/70 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">Email</p>
                <p className="mt-1 text-lg font-semibold text-white">{profile?.email || 'No email set'}</p>
              </div>
            </div>
            {profile?.resumeText && (
              <div className="mt-4 rounded-xl border border-slate-800/70 bg-slate-900/80 p-4 text-sm text-slate-300">
                <p className="font-semibold text-slate-200 mb-2">Saved Resume Text</p>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap">{profile.resumeText}</div>
              </div>
            )}
          </section>
        </div>

        {/* Discord Webhook Settings */}
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 p-6 sm:p-8 shadow-xl backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-400">Notifications</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Discord Alert Webhook</h2>
            <p className="mt-1 text-sm text-slate-400">
              Connect a Discord webhook to receive real-time alerts for high-scoring leads. Create one in your Discord server settings under <strong className="text-slate-300">Integrations &gt; Webhooks</strong>.
            </p>
          </div>
          <div className="mt-6 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={discordWebhookUrl}
                onChange={(e) => { setDiscordWebhookUrl(e.target.value); setDiscordError(''); setDiscordTestResult('idle'); }}
                placeholder="https://discord.com/api/webhooks/..."
                className="flex-1 rounded-xl border border-slate-800/50 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 placeholder:text-slate-600"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveDiscordWebhook}
                  disabled={savingDiscord}
                  className="rounded-xl bg-gradient-to-r from-purple-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                >
                  {savingDiscord ? 'Saving...' : 'Save'}
                </button>
                {discordWebhookUrl && (
                  <button
                    onClick={testDiscordWebhook}
                    disabled={testingDiscord || !discordWebhookUrl}
                    className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2 text-sm font-semibold text-slate-200 transition disabled:opacity-50 hover:bg-slate-700"
                  >
                    {testingDiscord ? 'Testing...' : 'Test'}
                  </button>
                )}
              </div>
            </div>
            {discordError && (
              <p className="text-xs text-rose-400">{discordError}</p>
            )}
            {discordSaved && (
              <p className="text-xs text-emerald-400">Webhook URL saved successfully!</p>
            )}
            {discordTestResult === 'success' && (
              <p className="text-xs text-emerald-400">✅ Test message sent! Check your Discord channel.</p>
            )}
            {!discordWebhookUrl && !discordSaved && !discordError && (
              <p className="text-xs text-amber-400">
                No webhook set — high-scoring leads will appear as dashboard alerts instead of Discord notifications.
              </p>
            )}
          </div>
        </div>

        {/* Target Sites Manager */}
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Target Sites</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Scraping Targets</h2>
            <p className="mt-1 text-sm text-slate-400">Add company career pages or job board URLs to target during scraping.</p>
          </div>

          <div className="mt-6 flex gap-2">
            <input
              type="url"
              value={newTargetUrl}
              onChange={(e) => setNewTargetUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTargetUrl()}
              placeholder="https://company.com/careers"
              className="flex-1 rounded-xl border border-slate-800/50 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 placeholder:text-slate-600"
            />
            <button
              onClick={addTargetUrl}
              disabled={!newTargetUrl.trim() || savingTargets}
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {targetUrls.length === 0 ? (
            <div className="mt-4 text-center py-8 bg-slate-950/30 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
              No target sites added yet. Add career pages to scrape.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {targetUrls.map((url) => (
                <div key={url} className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-950/40 p-3">
                  <span className="text-sm text-slate-300 truncate max-w-[80%]">{url}</span>
                  <button
                    onClick={() => removeTargetUrl(url)}
                    className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            These URLs are used when you click "Pull Live Leads" — the Playwright worker will visit each page and extract job listings.
          </p>
        </div>

        {/* AI Resume Refinement Engine */}
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/70 p-8 shadow-xl backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">AI Resume Refinement Engine</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Jobs Sent for Review</h2>
            <p className="mt-1 text-sm text-slate-400">Click "Review" on any job in the Live Feed to send it here. Then use AI to tailor your resume.</p>
          </div>

          {reviewedJobs.length === 0 ? (
            <div className="mt-6 text-center py-12 bg-slate-950/30 border border-dashed border-slate-800 rounded-2xl text-slate-500 text-sm">
              No jobs reviewed yet. Go to the <Link href="/" className="text-indigo-400 hover:underline">Live Feed</Link> and click "Review" on a job listing.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {reviewedJobs.map((job) => {
                const isExpanded = expandedJob === job.id;
                const isReworking = reworkingId === job.id;
                return (
                  <div key={job.id} className="rounded-2xl border border-slate-800/60 bg-slate-950/40 overflow-hidden">
                    <div className="p-5 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-200 truncate">{job.title}</h3>
                        <p className="text-xs text-slate-500 mt-1">Reviewed {new Date(job.reviewedAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        {job.tailoredResume && (
                          <button onClick={() => setExpandedJob(isExpanded ? null : job.id)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition">
                            {isExpanded ? 'Hide' : 'View'}
                          </button>
                        )}
                        <button onClick={() => reworkResume(job)} disabled={isReworking || !profile?.resumeText && !profile?.resumeBase64}
                          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white transition disabled:opacity-50">
                          {isReworking ? 'Reworking...' : 'Rework Resume'}
                        </button>
                      </div>
                    </div>
                    {isExpanded && job.tailoredResume && (
                      <div className="border-t border-slate-800 p-5">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tailored Resume</p>
                          <button onClick={() => copyToClipboard(job.tailoredResume!)} className="text-xs text-indigo-400 hover:underline">Copy to Clipboard</button>
                        </div>
                        <pre className="whitespace-pre-wrap text-sm text-slate-300 bg-slate-900/60 rounded-xl p-4 max-h-96 overflow-y-auto font-sans leading-relaxed">{job.tailoredResume}</pre>
                      </div>
                    )}
                    {!job.tailoredResume && isExpanded && (
                      <div className="border-t border-slate-800 p-5 text-sm text-slate-500">Click "Rework Resume" to generate a tailored version.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
