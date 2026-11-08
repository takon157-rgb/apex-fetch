// Feed filter construction for GET /api/leads.
//
// Kept out of the route handler so the query can be unit tested without a
// database or a request. The important invariant is that every filter is an
// independent constraint and they are ANDed together — the original route
// combined them in a single OR, which let stale or mismatched jobs through.
//
// Dependency-free so `node --test` can import it directly.

export interface LeadFilterInput {
  userId: string;
  includeDeleted?: boolean;
  source?: string | null;
  /**
   * The raw source values that belong to the requested source group. The
   * caller resolves this from the database because the group membership
   * depends on which boards have produced leads.
   */
  sourceMembers?: string[] | null;
  jobType?: string | null;
  remote?: string | null;
  minSalary?: string | null;
  q?: string | null;
  niche?: string | null;
  industry?: string | null;
  maxAgeDays?: number;
  /** Injected so tests can pin the clock. */
  now?: number;
}

/**
 * Collapse a source name into the board/company it actually represents.
 *
 * The scraper creates one source per URL, so the same company shows up as
 * "Direct: Stripe", "Direct: stripe.com", "Arbeitnow", "Direct: arbeitnow.com",
 * "Direct: arbeitnow.fr" and "Direct: arbeitnow.co.uk". Treating those as six
 * different sources let one company occupy five slots on the first page.
 *
 * This maps them onto a single key so the feed interleaves and filters by
 * company rather than by URL.
 */
export function sourceGroup(source?: string | null): string {
  if (!source) return 'other';
  const s = String(source).trim();
  if (!s) return 'other';

  const direct = /^direct:\s*(.+)$/i.exec(s);
  if (direct) {
    // "Direct: stripe.com" / "Direct: https://stripe.com/jobs" -> "stripe"
    let name = direct[1].trim().replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
    name = name.replace(/\.(co\.uk|com|fr|de|uk|us|ca|eu|com\.fr|co|net|org|io|ai)$/i, '');
    name = name.replace(/[._-]+$/, '');
    return (name || 'other').toLowerCase();
  }

  // "Jobicy: Contract" -> "jobicy"; "Himalayas (2)" -> "himalayas"
  return s
    .split(':')[0]
    .replace(/\s*\(\d+\)\s*$/, '')
    .trim()
    .toLowerCase() || 'other';
}

/** A human-readable label for a source group. */
export function sourceGroupLabel(group: string): string {
  if (!group) return 'Other';
  if (group === 'other') return 'Other';
  return group.charAt(0).toUpperCase() + group.slice(1);
}

/**
 * Keyword groups for the niche filters. These mirror the scraper's own
 * industry filter so a feed filter and a scrape filter agree.
 */
export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'Entry Level': ['entry level', 'junior', 'graduate', 'new grad', 'associate', 'early career', 'no experience', 'beginner'],
  'AI Automation': ['automation', 'ai', 'machine learning', 'llm', 'chatgpt', 'gpt', 'genai'],
  'Video Editing': ['video', 'editor', 'editing', 'thumbnail', 'premiere', 'davinci', 'after effects', 'shorts', 'youtube'],
  'Appointment Setter': ['setter', 'appointment', 'cold call', 'outreach', 'lead generation', 'sales development'],
  'Social Media': ['social', 'media', 'marketing', 'instagram', 'tiktok', 'content creator', 'community'],
  'Virtual Assistant': ['assistant', 'virtual assistant', 'va', 'admin support', 'administrative'],
};

export interface BuiltWhere {
  where: any;
  /** The age clause, kept separately so it can be removed when counting hidden rows. */
  ageFilter: any | null;
  /** The remaining ANDed clauses. */
  filters: any[];
}

export function buildLeadsWhere(input: LeadFilterInput): BuiltWhere {
  const {
    userId,
    includeDeleted = false,
    source,
    sourceMembers,
    jobType,
    remote,
    minSalary,
    q,
    niche,
    industry,
    maxAgeDays = 0,
    now = Date.now(),
  } = input;

  const where: any = { userId, ...(includeDeleted ? {} : { deleted: false }) };

  if (jobType && jobType !== 'All') where.jobType = jobType;
  if (remote === 'true') where.remote = true;
  else if (remote === 'false') where.remote = false;

  if (minSalary) {
    const parsed = Number(minSalary);
    if (!Number.isNaN(parsed) && parsed > 0) {
      where.OR = [{ salaryMax: { gte: parsed } }, { salaryMin: { gte: parsed } }];
    }
  }

  // Each filter is an independent constraint, so they are ANDed together.
  const filters: any[] = [];

  if (source && source !== 'All') {
    if (sourceMembers && sourceMembers.length) {
      filters.push({ source: { in: sourceMembers } });
    } else {
      where.source = source;
    }
  }

  if (q) {
    filters.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  // The age filter is built once so it can be removed cleanly when counting
  // how many leads it hides.
  let ageFilter: any = null;
  if (maxAgeDays > 0) {
    const cutoff = new Date(now - maxAgeDays * 86_400_000);
    // Jobs with no postedAt can't be proven expired, so they're kept.
    ageFilter = { OR: [{ postedAt: { gte: cutoff } }, { postedAt: null }] };
    filters.push(ageFilter);
  }

  if (industry && industry !== 'All') {
    const keywords = INDUSTRY_KEYWORDS[industry];
    if (keywords) {
      // Match against title OR description, same as the scraper's own filter.
      filters.push({
        OR: keywords.flatMap((k) => [
          { title: { contains: k, mode: 'insensitive' } },
          { description: { contains: k, mode: 'insensitive' } },
        ]),
      });
    }
  }

  // A second free-text constraint. When both `q` and `niche` are present the
  // job has to match both — they're ANDed, not ORed.
  if (niche) {
    filters.push({
      OR: [
        { title: { contains: niche, mode: 'insensitive' } },
        { description: { contains: niche, mode: 'insensitive' } },
        { company: { contains: niche, mode: 'insensitive' } },
      ],
    });
  }

  if (filters.length) where.AND = filters;

  return { where, ageFilter, filters };
}

/**
 * The same query with the jobType and remote filters removed.
 *
 * Facet counts are computed against this so the dashboard can show how many
 * results each filter option will yield before the user clicks it.
 */
export function buildFacetWhere(input: LeadFilterInput): any {
  const { where } = buildLeadsWhere(input);
  const facetWhere: any = { ...where };
  delete facetWhere.jobType;
  delete facetWhere.remote;
  return facetWhere;
}

/**
 * The same query with the age filter removed — used to count how many rows
 * the freshness filter is currently hiding.
 */
export function buildWhereWithoutAge(input: LeadFilterInput): any {
  const { where, ageFilter } = buildLeadsWhere(input);
  if (!ageFilter) return where;
  const withoutAge: any = { ...where };
  const remaining = (where.AND || []).filter((f: any) => f !== ageFilter);
  if (remaining.length) withoutAge.AND = remaining;
  else delete withoutAge.AND;
  return withoutAge;
}

/**
 * Run an async mapper over a list with a bounded number in flight.
 *
 * The feed issues one query per source board. Supabase's connection pooler
 * allows only 15 sessions, so firing 30 queries at once fails with
 * "max clients reached in session mode". Running them in small batches keeps
 * the request inside the pool budget on both the free tier and production.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const width = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: width }, () => worker()));
  return results;
}

/**
 * Round-robin leads across their source groups.
 *
 * Sorting purely by date let one high-volume board monopolise the first page.
 * Interleaving guarantees the top of the feed shows a spread of employers and
 * boards.
 *
 * Buckets are keyed by source *group*, not the raw source name: otherwise
 * "Arbeitnow", "Direct: arbeitnow.com", "Direct: arbeitnow.fr" and
 * "Direct: arbeitnow.co.uk" each get a turn and one company still fills a
 * quarter of the first page.
 */
export function interleaveBySource<T extends { source?: string | null }>(leads: T[]): T[] {
  const buckets = new Map<string, T[]>();
  for (const lead of leads) {
    const key = sourceGroup(lead.source);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(lead);
    else buckets.set(key, [lead]);
  }

  const lists = Array.from(buckets.values());
  // Keep the highest-volume sources from crowding out the rest: order buckets
  // by size so the smaller, more specific boards surface first.
  lists.sort((a, b) => a.length - b.length);

  const out: T[] = [];
  for (let i = 0; out.length < leads.length; i++) {
    let added = false;
    for (const list of lists) {
      if (i < list.length) {
        out.push(list[i]);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}
