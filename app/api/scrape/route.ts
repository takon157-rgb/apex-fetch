import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const storagePath = path.join(process.cwd(), 'leads_storage.json');

interface Job {
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
  reason: string;
  proposal: string;
  status: 'active' | 'deleted' | 'archived';
  deleted: boolean;
}

declare global {
  interface GlobalThis {
    globalStorage?: {
      jobs: Job[];
    };
  }
}

function loadJobs(): Job[] {
  try {
    if (fs.existsSync(storagePath)) {
      const raw = fs.readFileSync(storagePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('[Storage] Failed to load jobs file:', e);
  }
  return [];
}

function saveJobs(jobs: Job[]) {
  try {
    fs.writeFileSync(storagePath, JSON.stringify(jobs, null, 2), 'utf8');
  } catch (e) {
    console.error('[Storage] Failed to save jobs file:', e);
  }
}

const initialStorage = {
  jobs: loadJobs()
};

const storage = globalThis.globalStorage ?? initialStorage;
if (!globalThis.globalStorage) {
  globalThis.globalStorage = storage;
}

// Ensure memory is in sync with file on every request
function syncFromFile() {
  const fileJobs = loadJobs();
  storage.jobs = fileJobs;
}

// Helper to extract tag data safely from raw RSS strings without extra dependencies
function extractTag(xmlItem: string, tag: string): string {
  const match = xmlItem.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  if (!match) return '';
  let content = match[1];
  // Remove CDATA enclosures if present
  content = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
  return content.trim();
}

function cleanIngestedHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function generateLeadFingerprint(title: string, source: string): string {
  const normalized = `${title.toLowerCase().replace(/[^a-z0-9]/g, "")}_${source.toLowerCase()}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function generateSummary(title: string, description: string, budget: string, targetedIndustry: string): string {
  const desc = description?.trim() || '';
  if (desc.length > 20) {
    const sentences = desc.split(/\.\s+/).filter(Boolean);
    const firstSentences = sentences.slice(0, 3).join('. ');
    return firstSentences.length > 30 ? firstSentences + '.' : `${title} — ${budget}. ${targetedIndustry !== 'All' ? `Industry match: ${targetedIndustry}.` : ''}`;
  }
  return `${title} — ${budget}. Opening matched for ${targetedIndustry !== 'All' ? targetedIndustry : 'general'} freelancing.`;
}

function generateProposal(title: string, description: string, budget: string): string {
  const budgetLine = budget && budget !== 'Open Terms' ? `\n\nBudget noted: ${budget}.` : '';
  return `Hi there,\n\nI came across your posting for "${title}" and I'm confident I can deliver great results. I have relevant experience in this exact area and would love to discuss how I can help bring your project to life.${budgetLine}\n\nLet me know when you're available for a quick chat.`;
}

function evaluateJobContent(title: string, description: string, targetedIndustry: string) {
  const unifiedText = `${title} ${description}`.toLowerCase();
  
  let structuralScore = 5;
  if (unifiedText.includes('expert') || unifiedText.includes('senior') || unifiedText.includes('long-term')) structuralScore += 2;
  if (unifiedText.includes('budget') || unifiedText.includes('$') || unifiedText.includes('retainer')) structuralScore += 2;
  if (unifiedText.includes('urgent') || unifiedText.includes('immediate') || unifiedText.includes('asap')) structuralScore += 1;
  if (unifiedText.includes('remote') || unifiedText.includes('flexible')) structuralScore += 1;
  if (structuralScore > 10) structuralScore = 10;

  const profitability = structuralScore >= 8 ? 'High' : structuralScore >= 5 ? 'Medium' : 'Low';
  const difficulty = unifiedText.includes('complex') || unifiedText.includes('ai') || unifiedText.includes('backend') || unifiedText.includes('senior') ? 'Hard' : unifiedText.includes('entry') || unifiedText.includes('junior') || unifiedText.includes('beginner') ? 'Easy' : 'Medium';
  
  const summary = generateSummary(title, description, '', targetedIndustry);
  const reason = `Scored at ${structuralScore}/10 based on content analysis.`;
  const proposal = generateProposal(title, description, '');

  return { score: structuralScore, profitability, difficulty, summary, reason, proposal };
}

export async function GET() {
  syncFromFile();
  return NextResponse.json({ jobs: storage.jobs }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    syncFromFile();
    const payload = await req.json().catch(() => ({}));

    // 1. HANDLE INCOMING STATE MUTATIONS
    if (payload && payload.action === 'update_status') {
      storage.jobs = storage.jobs.map((job: Job) => {
        if (job.id === payload.id) {
          return {
            ...job,
            status: payload.status,
            deleted: payload.status === 'deleted'
          };
        }
        return job;
      });
      saveJobs(storage.jobs);
      return GET();
    }

    if (payload && payload.action === 'purge') {
      storage.jobs = storage.jobs.filter((job: Job) => job.id !== payload.id);
      saveJobs(storage.jobs);
      return GET();
    }

    // 2. FIX: INTERCEPT MANUAL DISCORD MANIFESTATION CLICKS
    if (payload && payload.action === 'discord_dispatch') {
      const targetJob = storage.jobs.find((j: Job) => j.id === payload.id);
      
      if (!targetJob) {
        return NextResponse.json({ error: 'Selected lead not found in local background memory context' }, { status: 404 });
      }

      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
        console.error('[Configuration Error] Missing DISCORD_WEBHOOK_URL inside environment definitions.');
        return NextResponse.json({ error: 'Discord connection parameters missing on local server env files' }, { status: 500 });
      }

      // Format a high-fidelity rich embed card for your dispatch channel
      const discordPayload = {
        embeds: [{
          title: `🎯 Manual Lead Dispatched: ${targetJob.title}`,
          url: targetJob.url || 'https://google.com',
          description: targetJob.description ? targetJob.description.substring(0, 800) : 'No description provided.',
          color: 3447003, // Modern Clean Hex Blue Value
          fields: [
            { name: 'Platform Source', value: targetJob.source || 'Unknown', inline: true },
            { name: 'Est. Pay/Budget', value: targetJob.budget || 'Not Specified', inline: true },
            { name: 'AI Priority Score', value: `⭐ ${targetJob.score || 'N/A'}/10`, inline: true },
            { name: '📝 Context Matrix Summary', value: targetJob.summary || 'No summary structural generated context.' },
            { name: '💼 Synthetic Cold Proposal Draft', value: targetJob.proposal || 'No template code calculated.' }
          ],
          footer: { text: 'AI Opportunity Assistant • Manual Curation Dashboard Override' },
          timestamp: new Date().toISOString()
        }]
      };

      const discordRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discordPayload)
      });

      if (!discordRes.ok) {
        throw new Error(`Discord endpoint execution pipeline rejected layout stream with code ${discordRes.status}`);
      }

      return NextResponse.json({ success: true, dispatchedId: payload.id });
    }

    // 3. BEGIN DEFAULT RUN: ACTIVE LIVE RSS SCRAPING PIPELINES
    console.log('[Pipeline Action] Initializing live parallel multi-feed extraction layers...');
    const selectedIndustry = payload.industry || 'All';
    const nicheQuery = typeof payload.query === 'string' ? payload.query.trim().toLowerCase() : '';

    const industryKeywords: Record<string, string[]> = {
      'Entry Level': ['entry level', 'junior', 'graduate', 'new grad', 'associate', 'early career', 'no experience', 'beginner'],
      'AI Automation': ['automation', 'ai', 'machine learning', 'llm', 'chatgpt', 'gpt', 'genai'],
      'Video Editing': ['video', 'editor', 'editing', 'thumbnail', 'premiere', 'davinci', 'after effects', 'shorts', 'youtube'],
      'Appointment Setter': ['setter', 'appointment', 'cold call', 'outreach', 'lead generation', 'sales development'],
      'Social Media': ['social', 'media', 'marketing', 'instagram', 'tiktok', 'content creator', 'community'],
      'Virtual Assistant': ['assistant', 'virtual assistant', 'va', 'admin support', 'administrative']
    };

    const TargetFeeds = [
      { source: 'Reddit', url: 'https://www.reddit.com/r/forhire/.rss' },
      { source: 'RemoteOK', url: 'https://remoteok.com/remote-jobs.rss' },
      { source: 'Remotive', url: 'https://remotive.com/feed' },
      { source: 'WeWorkRemotely', url: 'https://weworkremotely.com/remote-jobs.rss' },
      { source: 'Himalayas', url: 'https://himalayas.app/jobs/rss' },
      { source: 'AuthenticJobs', url: 'https://authenticjobs.com/?feed=job_feed&job_types=freelance,full-time,internship,part-time&search_location=remote' },
      { source: 'StackOverflow', url: 'https://stackoverflow.com/jobs/feed?r=True' },
      { source: 'CryptoJobsList', url: 'https://cryptojobslist.com/jobs.rss?jobLocation=Remote' },
      { source: 'LandingJobs', url: 'https://landing.jobs/feed?remote=true' },
      { source: 'WorkingNomads', url: 'https://www.workingnomads.co/api/exposed_jobs/' },
      { source: 'CareerNest', url: 'https://careernest.cloud/api/feed.xml?limit=100' },
      { source: 'Jobicy', url: 'https://jobicy.com/?feed=job_feed' },
      { source: 'Workbeam', url: 'https://workbeamhq.com/feeds/all' },
      { source: 'YayRemote', url: 'https://www.yayremote.com/api/remote-jobs/feeds/jobs.xml' },
    ];

    const scrapedItems: Array<{ title: string; description: string; url: string; source: string; budget: string }> = [];

    // Parallel Feed Isolation Execution Loop
    const feedRequests = TargetFeeds.map(async (feed) => {
      try {
        const cacheBuster = `_cb=${Date.now()}`;
        const url = feed.url.includes('?') ? `${feed.url}&${cacheBuster}` : `${feed.url}?${cacheBuster}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 OpportunityEngine/1.0' },
          next: { revalidate: 0 },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) return;
        
        const textData = await response.text();
        // Split text via item boundaries for standard XML RSS feeds
        const items = textData.split(/<item>|<entry>/i).slice(1);

        for (const item of items) {
          let rawTitle = extractTag(item, 'title');
          let rawLink = extractTag(item, 'link');
          if (!rawLink && item.includes('href="')) {
            const linkMatch = item.match(/href=["']([^"']+)["']/i);
            if (linkMatch) rawLink = linkMatch[1];
          }
          let rawDesc = extractTag(item, 'description') || extractTag(item, 'content') || extractTag(item, 'summary');
          
          if (rawTitle && rawLink) {
            const mergedText = `${rawTitle} ${rawDesc}`.toLowerCase();
            if (nicheQuery && !mergedText.includes(nicheQuery)) {
              continue;
            }

            if (selectedIndustry !== 'All') {
              const keywords = industryKeywords[selectedIndustry] || [selectedIndustry.toLowerCase()];
              const matchedIndustry = keywords.some((keyword) => mergedText.includes(keyword));
              if (!matchedIndustry) {
                continue;
              }
            }

            const budgetMatch = rawDesc.match(/(\$[0-9,]+)/);
            const budgetStr = budgetMatch ? `${budgetMatch[1]}` : 'Open Terms';

            scrapedItems.push({
              title: cleanIngestedHtml(rawTitle),
              description: cleanIngestedHtml(rawDesc).slice(0, 600),
              url: rawLink.trim(),
              source: feed.source,
              budget: budgetStr
            });
          }
        }
      } catch (feedErr) {
        console.error(`[Feed Stream Isolation Fault] ${feed.source} skipped:`, feedErr);
      }
    });

    await Promise.allSettled(feedRequests);

    let itemsInjected = 0;
    const existingUrls = new Set(storage.jobs.map((j: Job) => j.url.toLowerCase().trim()));
    const existingFingerprints = new Set(storage.jobs.map((j: Job) => generateLeadFingerprint(j.title, j.source)));

    for (const item of scrapedItems) {
      // --- CRITICAL FILTER STAGE: BLOCK JOB-SEEKERS AND ADS ---
      const checkingText = `${item.title} ${item.description}`.toLowerCase();
      const blockKeywords = [
        'for hire', '[for hire]', 'hire me', 'looking for work', 'seeking employment',
        'portfolio', 'freelancer available', 'looking for a job',
        'post a job', 'post a remote job', 'hire remotely', 'top 100 remote',
        'best remote', 'remote companies', 'remote work', 'how to',
        'sign up', 'subscribe', 'newsletter', 'get started',
        'upload your resume', 'build your resume', 'create account',
        'we are the leading', 'leading remote', 'join our team of',
        'browse jobs', 'search jobs', 'find a job', 'apply now',
        'start your free trial', 'hire developers', 'hire designers'
      ];
      
      const isBlocked = blockKeywords.some(keyword => checkingText.includes(keyword));
      if (isBlocked) {
        continue;
      }

      const fingerprint = generateLeadFingerprint(item.title, item.source);
      const uniqueUrl = item.url.toLowerCase().trim();

      if (existingUrls.has(uniqueUrl) || existingFingerprints.has(fingerprint)) {
        continue; // Precise structural deduplication match hit
      }

      // Compute calculations matching real scraped content dimensions
      const evaluations = evaluateJobContent(item.title, item.description, selectedIndustry);

      const highQualityLead: Job = {
        id: `live_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: item.title,
        description: item.description,
        budget: item.budget,
        source: item.source,
        url: item.url,
        postedTime: 'Just fetched',
        ...evaluations,
        status: 'active',
        deleted: false
      };

      storage.jobs.unshift(highQualityLead);
      existingUrls.add(uniqueUrl);
      existingFingerprints.add(fingerprint);
      itemsInjected++;

      // Dispatch tracking automatically to active Discord Webhooks (only high priority items)
      if (highQualityLead.score >= 7 && process.env.DISCORD_WEBHOOK_URL) {
        try {
          await fetch(process.env.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: `🚨 Live Pipeline Hit: ${highQualityLead.title}`,
                url: highQualityLead.url,
                color: 5763719,
                fields: [
                  { name: '🎯 Score Rating', value: `${highQualityLead.score}/10`, inline: true },
                  { name: '💰 Found Budget', value: highQualityLead.budget, inline: true },
                  { name: '🌐 Source', value: highQualityLead.source, inline: true },
                  { name: '📝 Context Matrix', value: highQualityLead.summary }
                ]
              }]
            })
          });
        } catch (err) {
          console.error('[Discord Webhook Exception Tracking]', err);
        }
      }
    }

    saveJobs(storage.jobs);
    console.log(`[Pipeline Completed] Injected ${itemsInjected} fresh computational real leads.`);
    return GET();

  } catch (err: unknown) {
    console.error('[Fatal Pipeline Structural Crash]', err);
    return NextResponse.json({ error: true, message: err instanceof Error ? err.message : 'Internal Server Issue' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) { return POST(req); }
export async function DELETE(req: NextRequest) { return POST(req); }