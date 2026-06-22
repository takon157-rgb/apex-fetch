import crypto from 'crypto';

export interface RawScrapedOpportunity {
  id: string;
  title: string;
  description: string;
  budget: string;
  source: string;
  url: string;
  postedTime: string;
}

export async function executeMultiSourceScrape(): Promise<RawScrapedOpportunity[]> {
  const aggregatedResults: RawScrapedOpportunity[] = [];

  // --- SOURCE 1: REDDIT RSS ---
  try {
    console.log('[Scraper] Fetching unified Reddit hiring feeds...');
    const res = await fetch('https://www.reddit.com/r/DesignJobs+Hiring+forhire/.rss', {
      headers: { 'User-Agent': 'Mozilla/5.0 ApexFetch/1.0' }
    });
    const xml = await res.text();
    
    // Bulletproof matching loop
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match: RegExpExecArray | null;
    
    while ((match = entryRegex.exec(xml)) !== null) {
      const content = match[1];
      const title = content.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      const url = content.match(/<link href="([\s\S]*?)"/)?.[1] || '';
      let description = content.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] || '';
      
      description = description
        .replace(/<[^>]*>/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

      if (title && url) {
        aggregatedResults.push({
          id: 'reddit-' + crypto.createHash('md5').update(url).digest('hex').substring(0, 12),
          title: title,
          description: description.substring(0, 1200).trim(),
          budget: 'Negotiable / Milestones',
          source: 'Reddit',
          url: url,
          postedTime: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('[Scraper Error] Reddit RSS cycle skipped:', error);
  }

  // --- SOURCE 2: WE WORK REMOTELY ---
  try {
    console.log('[Scraper] Fetching WeWorkRemotely global software feeds...');
    const res = await fetch('https://weworkremotely.com/categories/remote-programming-jobs.rss');
    const xml = await res.text();
    
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      const title = content.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] || content.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      const url = content.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      let description = content.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] || '';

      description = description.replace(/<[^>]*>/g, ' ');

      if (title && url) {
        aggregatedResults.push({
          id: 'wwr-' + crypto.createHash('md5').update(url).digest('hex').substring(0, 12),
          title: title.trim(),
          description: description.substring(0, 1200).trim(),
          budget: 'Contract / Full-time',
          source: 'RemoteBoards',
          url: url,
          postedTime: new Date().toISOString()
        });
      }
    }
  } catch (error) {
    console.error('[Scraper Error] WeWorkRemotely RSS cycle skipped:', error);
  }

  // --- ANTI-SPAM FILTER ---
  return aggregatedResults.filter(job => {
    const baselineText = job.title.toLowerCase();
    if (
      baselineText.includes('[for hire]') || 
      baselineText.includes('forhire') || 
      baselineText.includes('hire me') || 
      baselineText.includes('portfolio') ||
      baselineText.includes('looking for work')
    ) {
      return false;
    }
    return true;
  });
}