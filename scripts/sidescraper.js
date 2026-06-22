const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const storagePath = path.join(process.cwd(), 'leads_storage.json');

function readJson(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) || defaultValue;
    }
  } catch (err) {
    console.error('[SideScraper] Failed to read JSON', err);
  }
  return defaultValue;
}

function writeJson(filePath, payload) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('[SideScraper] Failed to write JSON', err);
  }
}

function generateId() {
  return `sidescraper_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

async function runSideScraper() {
  console.log('Launching SideScraper Worker...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const targets = [
    { source: 'WeWorkRemotely', url: 'https://weworkremotely.com/' },
    { source: 'RemoteOK', url: 'https://remoteok.com/' },
  ];

  const allListings = [];

  for (const target of targets) {
    try {
      console.log(`Navigating to ${target.source}...`);
      await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      const bodyText = await page.textContent('body').catch(() => '');

      const listings = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="remote"], a[href*="jobs"], a[href*="position"]'));
        return links.map(el => ({
          title: el.innerText?.trim() || el.title?.trim() || '',
          url: el.href || '',
        })).filter(item => item.title.length > 5 && item.title.length < 200);
      });

      const pagePreview = bodyText.replace(/\s+/g, ' ').substring(0, 300);

      listings.slice(0, 15).forEach(item => {
        if (item.title && item.url) {
          allListings.push({
            source: target.source,
            title: item.title,
            url: item.url,
            pagePreview,
          });
        }
      });

      console.log(`Found ${listings.length} items from ${target.source}`);
    } catch (err) {
      console.error(`SideScraper error for ${target.source}:`, err);
    }
  }

  await browser.close();

  if (allListings.length === 0) {
    console.log('No listings found, skipping save.');
    return;
  }

  const existing = readJson(storagePath, []);
  const existingUrls = new Set(existing.map(item => item.url?.toLowerCase().trim()));
  const newLeads = [];

  for (const item of allListings) {
    const url = item.url.toLowerCase().trim();
    if (existingUrls.has(url)) continue;

    const lowerTitle = item.title.toLowerCase();
    let score = 7;
    if (lowerTitle.includes('senior') || lowerTitle.includes('expert') || lowerTitle.includes('engineer') || lowerTitle.includes('developer') || lowerTitle.includes('ai')) {
      score = 8;
    } else if (lowerTitle.includes('junior') || lowerTitle.includes('associate') || lowerTitle.includes('intern')) {
      score = 6;
    }

    const description = item.pagePreview
      ? `Position: ${item.title}. Context: ${item.pagePreview}`
      : `Job listing discovered on ${item.source}. Review at ${item.url}`;

    const lead = {
      id: generateId(),
      title: item.title,
      description: description.substring(0, 500),
      budget: 'Open Terms',
      source: item.source,
      url: item.url,
      postedTime: new Date().toISOString(),
      score,
      summary: `${item.title} — Open Terms. Sourced from ${item.source}.`,
      profitability: score >= 8 ? 'High' : 'Medium',
      difficulty: 'Medium',
      reason: `Scored at ${score}/10 based on title analysis.`,
      proposal: `Hi! I saw your posting for "${item.title}" and I'm interested in discussing this opportunity. I have relevant experience and would love to connect.`,
      status: 'active',
      deleted: false,
      applied: false,
    };

    newLeads.push(lead);
    existingUrls.add(url);
  }

  const merged = [...newLeads, ...existing].slice(0, 300);
  writeJson(storagePath, merged);
  console.log(`SideScraper complete. Added ${newLeads.length} new leads.`);
}

runSideScraper().catch(err => {
  console.error('SideScraper fatal error:', err);
  process.exit(1);
});
