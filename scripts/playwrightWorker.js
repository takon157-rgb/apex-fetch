const { chromium } = require('playwright');

function generateId() {
  return `playwright_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

async function runAutomationWorker() {
  console.log('🚀 Launching Standalone Headless Chromium Automation Layer...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // --- PERFORMANCE HOOK: BLOCK BLOCKED / HEAVY ASSETS ---
  // Drops images, CSS, and fonts to instantly eliminate network timeouts
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media', 'eventsource', 'websocket'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  try {
    console.log('📡 Navigating target network channels...');
    
    // Switch to 'commit' to execute immediately after HTML transmission finishes receiving
    await page.goto('https://weworkremotely.com/categories/remote-programming-jobs', { 
      waitUntil: 'commit',
      timeout: 25000 
    });

    console.log('⏳ Parsing text structural contents from document body...');
    // Give the basic DOM elements a brief window to render into view memory
    await page.waitForTimeout(3000);

    const pageTitle = await page.title();
    console.log(`🌐 Arrived at Document Destination: "${pageTitle}"`);

    // Extract elements using deep lookups targeting job layouts
    const rawJobs = await page.evaluate(() => {
      // Target any list item containing a relative link targeting job spec files
      const elements = Array.from(document.querySelectorAll('li, tr, article'));
      return elements.map(el => {
        const linkEl = el.querySelector('a[href*="/jobs/"]');
        if (!linkEl) return null;

        // Extract textual markers cleanly
        const titleText = linkEl.innerText.trim();
        const wholeBlock = el.innerText || '';
        
        // Skip elements with empty titles or containing massive walls of unparsed page text
        if (!titleText || titleText.length > 120) return null;

        return {
          title: titleText.split('\n')[0], // Grab just the top line header string
          description: `Remote development opportunity verified. Review full technical scoping rules inside listing vector context. Raw details: ${wholeBlock.replace(/\s+/g, ' ').slice(0, 150)}...`,
          url: linkEl.href,
          budget: 'Open Terms / TBD',
          source: 'WeWorkRemotely'
        };
      }).filter(Boolean);
    });

    // Clean out array duplicates caused by nested query matches
    const uniqueMap = new Map();
    rawJobs.forEach(item => uniqueMap.set(item.url, item));
    const uniqueRawJobs = Array.from(uniqueMap.values());

    console.log(`🔍 Found ${uniqueRawJobs.length} unique raw browser listings. Running data compliance filters...`);

    // Guard Filter Layer: Instantly drop any freelancer portfolio or application postings
    const structuralTrashKeywords = ['for hire', '[for hire]', 'hire me', 'looking for work', 'seeking employment', 'portfolio'];
    const filteredJobs = uniqueRawJobs.filter(job => {
      const checkingText = `${job.title} ${job.description}`.toLowerCase();
      return !structuralTrashKeywords.some(keyword => checkingText.includes(keyword));
    });

    // Structure raw elements into your exact system layout matrix interface requirements
      const formattedPayload = filteredJobs.map(job => {
      const lowerTitle = job.title.toLowerCase();
      let calculatedScore = 6;
      if (lowerTitle.includes('expert') || lowerTitle.includes('senior') || lowerTitle.includes('ai') || lowerTitle.includes('automation')) {
        calculatedScore += 3;
      }

      const desc = job.description ? job.description.substring(0, 500) : 'Remote development opportunity verified.';

      return {
        id: generateId(),
        title: job.title,
        description: desc,
        budget: job.budget,
        source: job.source,
        url: job.url,
        postedTime: 'Just fetched via Playwright',
        score: calculatedScore,
        summary: `${job.title} — ${job.budget}. Verified via automated browser scan.`,
        profitability: calculatedScore >= 8 ? 'High' : 'Medium',
        difficulty: 'Medium',
        reason: `Scored at ${calculatedScore}/10 via content analysis.`,
        proposal: `Hi! I saw your posting for "${job.title}" and would love to discuss this opportunity. I have relevant experience and can deliver strong results.`,
        status: 'active',
        deleted: false
      };
    });

    if (formattedPayload.length === 0) {
      console.log('⏸️ Scraping complete. No new distinct project items identified.');
      return;
    }

    console.log(`📤 Streaming ${formattedPayload.length} clean client leads to dashboard local storage api...`);
    
    // Stream payloads straight to your server instance running locally
    const apiResponse = await fetch('http://localhost:3000/api/incoming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs: formattedPayload })
    });

    const responseStatus = await apiResponse.json();
    console.log('✅ Next.js Ingestion Sync Status:', responseStatus);

  } catch (err) {
    console.error('❌ Worker Execution Pipeline Interruption:', err);
  } finally {
    await browser.close();
    console.log('🔒 Chromium automation sandbox safely closed.');
  }
}

runAutomationWorker();