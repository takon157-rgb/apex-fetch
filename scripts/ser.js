const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const storagePath = path.join(process.cwd(), 'leads_storage.json');
const settingsPath = path.join(process.cwd(), 'settings.json');
const statusPath = path.join(process.cwd(), 'scraper_status.json');

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
  }
}

function readJson(filePath, defaultValue) {
  ensureFile(filePath, defaultValue);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) || defaultValue;
  } catch (err) {
    console.error('[Worker] Failed to read JSON from', filePath, err);
    return defaultValue;
  }
}

function writeJson(filePath, payload) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('[Worker] Failed to write JSON to', filePath, err);
  }
}

function writeStatus(progress, status, active = true) {
  const entry = {
    progress,
    status,
    active,
    updatedAt: new Date().toISOString(),
  };
  writeJson(statusPath, entry);
}

function generateId() {
  return `playwright_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

function formatLeadPayload(job) {
  const lowerTitle = job.title.toLowerCase();
  let score = 6;
  if (lowerTitle.includes('senior') || lowerTitle.includes('expert') || lowerTitle.includes('automation') || lowerTitle.includes('engineer') || lowerTitle.includes('developer') || lowerTitle.includes('ai')) {
    score += 3;
  }
  const descPreview = job.description ? job.description.substring(0, 200) : 'No description available.';
  return {
    id: generateId(),
    title: job.title,
    description: descPreview,
    budget: job.budget || 'Open Terms / TBD',
    source: job.source,
    url: job.url,
    postedTime: new Date().toISOString(),
    score,
    summary: `${job.title} — ${job.budget || 'Open Terms'}. Found via ApexFetch direct career scanner.`,
    profitability: score >= 8 ? 'High' : 'Medium',
    difficulty: 'Medium',
    reason: `Parsed score set at ${score}/10 for quality and relevance.`,
    proposal: `Hi! I saw your listing for "${job.title}" and I'm interested in this opportunity. I have strong experience in this area and would love to discuss how I can help.`,
    status: 'active',
    deleted: false,
    applied: false,
  };
}

function normalizeUrl(url) {
  try {
    return new URL(url).href;
  } catch {
    return url.trim();
  }
}

async function parseDirectCompanyTargets(targetUrls) {
  if (!targetUrls || !targetUrls.length) return [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });

  const page = await context.newPage();
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media', 'eventsource', 'websocket'].includes(type)) {
      return route.abort();
    }
    route.continue();
  });

  const outlines = [];
  const keywords = ['automation', 'developer', 'engineer', 'script', 'job', 'career', 'hiring', 'opportunity', 'position'];

  for (const rawUrl of targetUrls.slice(0, 12)) {
    const targetUrl = rawUrl.trim();
    if (!targetUrl) continue;
    writeStatus(35, `Parsing direct careers page: ${targetUrl}`);

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const pageText = (await page.textContent('body')) || '';
      const anchors = await page.$$eval('a', (elements) => elements.map((el) => ({ href: el.href, text: el.innerText || el.title || '' })));
      const candidates = anchors.filter((anchor) => {
        const combined = `${anchor.href} ${anchor.text}`.toLowerCase();
        return keywords.some((keyword) => combined.includes(keyword));
      }).slice(0, 10);

      if (candidates.length === 0) {
        candidates.push({ href: targetUrl, text: 'Direct careers page' });
      }

      candidates.forEach((link) => {
        const textPreview = pageText.replace(/\s+/g, ' ').substring(0, 300);
        const item = {
          title: link.text.trim() || `Opening at ${new URL(targetUrl).hostname}`,
          description: textPreview ? `Career page context: ${textPreview}` : `Direct listing from ${targetUrl}`,
          url: normalizeUrl(link.href || targetUrl),
          source: `Direct: ${new URL(targetUrl).hostname.replace('www.', '')}`,
          budget: 'Direct company discovery',
        };
        outlines.push(item);
      });
    } catch (err) {
      console.error('[Direct Parser] Failed', targetUrl, err);
    }
  }

  await browser.close();
  return outlines;
}

async function discoverTrendingTargets() {
  const sources = ['https://remoteok.com/remote-jobs', 'https://weworkremotely.com', 'https://remotive.io/remote-jobs'];
  const hosts = new Set();

  for (const url of sources) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ApexFetch/1.0' } });
      if (!res.ok) continue;
      const html = await res.text();
      const matches = Array.from(html.matchAll(/https?:\/\/([^/\"'\s]+)\//gi));
      matches.slice(0, 120).forEach((match) => {
        const hostname = match[1].replace(/^www\./, '');
        if (!hostname.includes('remoteok.com') && !hostname.includes('weworkremotely.com') && !hostname.includes('remotive.io')) {
          hosts.add(hostname);
        }
      });
      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (err) {
      console.error('[Trend Discovery] Failed to collect from', url, err);
    }
  }

  return Array.from(hosts).slice(0, 15);
}

(async function () {
  ensureFile(storagePath, []);
  ensureFile(settingsPath, { careerProfile: '', targetUrls: [], trendingTargets: [], lastTrendDiscoveryAt: '' });
  ensureFile(statusPath, { progress: 0, status: 'Idle', active: false, updatedAt: new Date().toISOString() });

  const existing = readJson(storagePath, []);
  const settings = readJson(settingsPath, { careerProfile: '', targetUrls: [], trendingTargets: [], lastTrendDiscoveryAt: '' });

  writeStatus(5, 'ApexFetch automation worker started', true);

  try {
    writeStatus(10, 'Discovering live trend domains...', true);
    const trendingTargets = await discoverTrendingTargets();
    settings.trendingTargets = trendingTargets;
    settings.lastTrendDiscoveryAt = new Date().toISOString();
    writeJson(settingsPath, settings);

    writeStatus(30, 'Parsing direct careers targets...', true);
    const directLeads = await parseDirectCompanyTargets(settings.targetUrls);
    const formattedDirects = directLeads.map(formatLeadPayload);

    writeStatus(60, 'Finalizing lead payloads...', true);
    const existingUrls = new Set(existing.map((item) => item.url.toLowerCase().trim()));
    const uniqueLeads = formattedDirects.filter((lead) => lead.url && !existingUrls.has(lead.url.toLowerCase().trim()));

    const merged = [...uniqueLeads, ...existing].slice(0, 250);
    writeJson(storagePath, merged);

    writeStatus(100, `ApexFetch worker complete. Added ${uniqueLeads.length} new leads.`, false);
    console.log('[ApexFetch Worker] Completed successfully with', uniqueLeads.length, 'new leads.');
  } catch (err) {
    writeStatus(0, 'Worker failed during execution.', false);
    console.error('[ApexFetch Worker] fatal error', err);
  }
})();
