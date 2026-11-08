// Source registry — the list of every place the scraper pulls jobs from.
//
// This module is intentionally dependency-free so it can be imported directly
// by `node --test` style scripts (Node's ESM resolver can't follow the
// extensionless imports used inside the Next.js bundle).
//
// Every entry below was verified to return HTTP 200 with a non-empty payload.
// Sources that require auth, block scrapers, or 404 are deliberately excluded.

export type SourceParser =
  | 'rss' | 'remoteok' | 'remotive' | 'workingnomads' | 'arbeitnow'
  | 'greenhouse' | 'ashby' | 'jobicy' | 'himalayas';

export type SourceDef = {
  name: string;
  url: string;
  type: 'rss' | 'json' | 'api';
  parser: SourceParser;
};

// Cap per company board so one huge company (Stripe has 700+) can't monopolise the feed.
export const MAX_JOBS_PER_BOARD = 40;

function greenhouse(token: string, label: string): SourceDef {
  return {
    name: `Direct: ${label}`,
    url: `https://boards-api.greenhouse.io/v1/boards/${token}/jobs?content=true`,
    type: 'api',
    parser: 'greenhouse',
  };
}

function ashby(token: string, label: string): SourceDef {
  return {
    name: `Direct: ${label}`,
    url: `https://api.ashbyhq.com/posting-api/job-board/${token}`,
    type: 'api',
    parser: 'ashby',
  };
}

// --- Aggregator APIs / RSS ---
const AGGREGATOR_SOURCES: SourceDef[] = [
  { name: 'RemoteOK',       url: 'https://remoteok.com/api', type: 'api',  parser: 'remoteok' },
  { name: 'Remotive',       url: 'https://remotive.com/api/remote-jobs', type: 'api', parser: 'remotive' },
  { name: 'WeWorkRemotely', url: 'https://weworkremotely.com/remote-jobs.rss', type: 'rss', parser: 'rss' },
  // JSON APIs rather than RSS: they carry a real employmentType field, which
  // is what makes the dashboard's job-type filter actually work.
  { name: 'Himalayas',      url: 'https://himalayas.app/jobs/api?limit=20&offset=0', type: 'api', parser: 'himalayas' },
  { name: 'Himalayas (2)',  url: 'https://himalayas.app/jobs/api?limit=20&offset=20', type: 'api', parser: 'himalayas' },
  { name: 'WorkingNomads',  url: 'https://www.workingnomads.co/api/exposed_jobs/', type: 'api', parser: 'workingnomads' },
  { name: 'AuthenticJobs',  url: 'https://authenticjobs.com/?feed=job_feed&job_types=freelance,full-time,internship,part-time&search_location=remote', type: 'rss', parser: 'rss' },
  { name: 'Jobicy',         url: 'https://jobicy.com/api/v2/remote-jobs?count=50', type: 'api', parser: 'jobicy' },
  { name: 'Jobicy: Part-time', url: 'https://jobicy.com/api/v2/remote-jobs?count=50&tag=part-time', type: 'api', parser: 'jobicy' },
  { name: 'Jobicy: Contract',  url: 'https://jobicy.com/api/v2/remote-jobs?count=50&tag=contract', type: 'api', parser: 'jobicy' },
  { name: 'Jobicy: Internship', url: 'https://jobicy.com/api/v2/remote-jobs?count=50&tag=internship', type: 'api', parser: 'jobicy' },
  { name: 'LandingJobs',    url: 'https://landing.jobs/feed?remote=true', type: 'rss', parser: 'rss' },
  { name: 'Arbeitnow',      url: 'https://www.arbeitnow.com/api/job-board-api', type: 'api', parser: 'arbeitnow' },
];

// --- Direct company career boards ---
const COMPANY_BOARD_SOURCES: SourceDef[] = [
  // Greenhouse
  greenhouse('stripe', 'Stripe'),
  greenhouse('elastic', 'Elastic'),
  greenhouse('mongodb', 'MongoDB'),
  greenhouse('gitlab', 'GitLab'),
  greenhouse('reddit', 'Reddit'),
  greenhouse('robinhood', 'Robinhood'),
  greenhouse('figma', 'Figma'),
  greenhouse('instacart', 'Instacart'),
  greenhouse('gusto', 'Gusto'),
  greenhouse('discord', 'Discord'),
  // Ashby
  ashby('openai', 'OpenAI'),
  ashby('cursor', 'Cursor'),
  ashby('ramp', 'Ramp'),
  ashby('notion', 'Notion'),
  ashby('perplexity', 'Perplexity'),
  ashby('vanta', 'Vanta'),
  ashby('sentry', 'Sentry'),
  ashby('linear', 'Linear'),
  ashby('openrouter', 'OpenRouter'),
  ashby('replit', 'Replit'),
  ashby('resend', 'Resend'),
];

export const SOURCES: SourceDef[] = [...AGGREGATOR_SOURCES, ...COMPANY_BOARD_SOURCES];

export const AGGREGATOR_COUNT = AGGREGATOR_SOURCES.length;
export const BOARD_COUNT = COMPANY_BOARD_SOURCES.length;
