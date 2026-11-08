import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { heuristicFit, ResumeProfile } from '@/lib/fit-core';
import {
  buildLeadsWhere,
  buildFacetWhere,
  buildWhereWithoutAge,
  interleaveBySource,
  mapWithConcurrency,
} from '@/lib/leads-query-core';
import { JOB_TYPES as CANONICAL_JOB_TYPES } from '@/lib/job-attrs-core';
import { sourceGroup, sourceGroupLabel } from '@/lib/leads-query-core';

export const dynamic = 'force-dynamic';

/**
 * GET /api/leads
 * Query params:
 *   page           1-based page number
 *   limit          page size (max 100, default 50)
 *   sort           'recent' (default) | 'fit' (resume-match ranking)
 *   maxAgeDays     hide jobs older than N days (0 = keep all)
 *   source         filter by source name
 *   jobType        filter by canonical job type (full-time|part-time|contract|internship|freelance)
 *   remote         'true' = remote only, 'false' = on-site only
 *   q              free-text search over title/description/company
 *   minSalary      filter by minimum salary
 *   industry       filter by niche keyword group (Entry Level, AI Automation, ...)
 *   niche          second free-text constraint, ANDed with `q`
 *   includeDeleted=true -> include trashed leads
 */

// How many leads to pull from each source board into the candidate window.
//
// The feed used to take a single window ordered by date. Because aggregators
// publish far more often than company boards, a 500-row date-ordered window
// contained only five different boards — the feed looked like it had one
// source. Interleaving the window by board keeps every board represented.
const PER_GROUP_FIT = 25;

/**
 * Hard ceiling on how deep the feed can be scrolled. The candidate list is
 * fetched once (ids and sources only — a few tens of kilobytes) and reused
 * for every page, so the interleaved order is stable as the user scrolls.
 */
const MAX_WINDOW = 2000;

/**
 * How many board queries may run at once. Supabase's connection pooler allows
 * only 15 sessions; firing one query per board in parallel exhausts the pool
 * and fails the whole request.
 */
const DB_QUERY_CONCURRENCY = 10;

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ leads: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const skip = (page - 1) * limit;
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
  const sort = url.searchParams.get('sort') === 'fit' ? 'fit' : 'recent';
  const maxAgeDays = Math.max(0, parseInt(url.searchParams.get('maxAgeDays') || '0', 10) || 0);

  const requestedSource = url.searchParams.get('source')?.trim();

  // Resolve the requested source into the set of raw sources that belong to
  // it. "Arbeitnow" covers the aggregator feed and its per-country career
  // pages, so filtering by company works the way a user expects.
  let sourceMembers: string[] | null = null;
  let distinctSources: { source: string | null }[] = [];
  if (requestedSource && requestedSource !== 'All') {
    distinctSources = await prisma.lead.findMany({
      where: { userId: user.id },
      distinct: ['source'],
      select: { source: true },
    });
    const wanted = sourceGroup(requestedSource);
    sourceMembers = distinctSources
      .map((s) => s.source)
      .filter((s): s is string => Boolean(s) && sourceGroup(s) === wanted);
    if (!sourceMembers.length) sourceMembers = [requestedSource];
  }

  const filterInput = {
    userId: user.id,
    includeDeleted,
    source: requestedSource,
    sourceMembers,
    jobType: url.searchParams.get('jobType')?.trim(),
    remote: url.searchParams.get('remote')?.trim(),
    minSalary: url.searchParams.get('minSalary')?.trim(),
    q: url.searchParams.get('q')?.trim(),
    niche: url.searchParams.get('niche')?.trim(),
    industry: url.searchParams.get('industry')?.trim(),
    maxAgeDays,
  };

  const { where } = buildLeadsWhere(filterInput);
  const total = await prisma.lead.count({ where });

  // How many leads the freshness filter is currently hiding. Computed against
  // the same filters minus the age cutoff, so the dashboard can say
  // "N expired hidden" without making a second request.
  let hiddenExpired = 0;
  if (maxAgeDays > 0) {
    const withoutAge = buildWhereWithoutAge(filterInput);
    hiddenExpired = Math.max(0, (await prisma.lead.count({ where: withoutAge })) - total);
  }

  // Facet counts, computed against the same filters EXCEPT jobType/remote.
  // The dashboard shows these next to each filter option so a user can see
  // "Part-time (14)" before clicking and know it won't come up empty.
  const facetWhere = buildFacetWhere(filterInput);
  const [typeRows, remoteRows, sourceRows] = await Promise.all([
    prisma.lead.groupBy({ by: ['jobType'], where: facetWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['remote'], where: facetWhere, _count: { _all: true } }),
    prisma.lead.groupBy({ by: ['source'], where: facetWhere, _count: { _all: true } }),
  ]);

  // Sources are reported as groups so "Arbeitnow" and its per-country career
  // pages show up as one entry rather than five near-identical ones.
  const sourceTotals = new Map<string, number>();
  for (const row of sourceRows) {
    const key = sourceGroup(row.source);
    sourceTotals.set(key, (sourceTotals.get(key) || 0) + row._count._all);
  }

  const facets = {
    // Anything outside the canonical vocabulary is bucketed as "unspecified"
    // so the dropdown totals always add up to the number of results.
    jobTypes: typeRows.reduce((acc: Record<string, number>, r: any) => {
      const key = r.jobType && CANONICAL_JOB_TYPES.includes(r.jobType) ? r.jobType : 'unspecified';
      acc[key] = (acc[key] || 0) + r._count._all;
      return acc;
    }, {}),
    remote: {
      true: remoteRows.find((r: any) => r.remote === true)?._count._all ?? 0,
      false: remoteRows.find((r: any) => r.remote === false)?._count._all ?? 0,
      unknown: remoteRows.find((r: any) => r.remote === null)?._count._all ?? 0,
    },
    sources: Array.from(sourceTotals.entries())
      .map(([group, count]) => ({ source: sourceGroupLabel(group), count }))
      .sort((a: any, b: any) => b.count - a.count),
  };

  let leads: any[];
  let servableTotal = total;

  // Which boards actually have leads matching the current filters. The feed is
  // stratified across these so a high-volume board can't crowd the others out.
  const feedSourceRows = await prisma.lead.groupBy({
    by: ['source'],
    where,
    _count: { _all: true },
  });
  const groupMembers = new Map<string, string[]>();
  for (const row of feedSourceRows) {
    if (!row.source) continue;
    const group = sourceGroup(row.source);
    const members = groupMembers.get(group);
    if (members) members.push(row.source);
    else groupMembers.set(group, [row.source]);
  }
  const groups = Array.from(groupMembers.entries());

  if (sort === 'fit') {
    // Resume-match ranking: fit is computed against the candidate's saved profile,
    // so it can't be expressed in SQL. Pull a bounded candidate window, score it,
    // sort, then slice the requested page.
    const [prefs, profile] = await Promise.all([
      prisma.userPreference.findUnique({ where: { userId: user.id } }),
      prisma.careerProfile.findUnique({ where: { userId: user.id } }),
    ]);
    const resume: ResumeProfile = {
      summary: prefs?.parsedResumeSummary || profile?.resumeText || '',
      skills: prefs?.coreSkills || [],
      roles: prefs?.targetRoles || [],
    };

    // Balanced candidates from every board, so a great match at a small
    // company isn't buried under a thousand aggregator postings. The quota is
    // fixed so the ranking is identical on every page.
    const take = Math.min(PER_GROUP_FIT, Math.max(1, Math.floor(MAX_WINDOW / Math.max(1, groups.length))));
    const candidateLists = await mapWithConcurrency(
      groups,
      DB_QUERY_CONCURRENCY,
      ([, members]) =>
        prisma.lead.findMany({
          where: { ...where, source: { in: members } },
          orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
          take,
        }),
    );
    const candidates = candidateLists.flat();
    servableTotal = Math.min(total, candidates.length);

    const scored = candidates
      .map((lead) => {
        const fit = heuristicFit(resume, { title: lead.title, description: lead.description || '' });
        return { lead, fit };
      })
      .sort((a, b) => {
        if (b.fit.score !== a.fit.score) return b.fit.score - a.fit.score;
        return new Date(b.lead.createdAt).getTime() - new Date(a.lead.createdAt).getTime();
      });

    leads = scored.slice(skip, skip + limit).map(({ lead, fit }) => ({
      ...lead,
      fitScore: lead.fitScore ?? fit.score,
      fitMatched: lead.fitMatched?.length ? lead.fitMatched : fit.matched,
      fitMissing: lead.fitMissing?.length ? lead.fitMissing : fit.missing,
      fitReason: lead.fitReason || fit.reason,
    }));
  } else {
    // Recent feed: one lightweight query (ids and sources only) builds the
    // whole candidate list, which is interleaved by board to keep every source
    // represented. Only the rows on this page are then fetched in full.
    //
    // The candidate list is identical for every page, so scrolling can't
    // repeat or skip a job. The `id` tiebreaker makes the ordering total —
    // without it, rows with the same timestamp could come back in a different
    // order between requests.
    const candidates = await prisma.lead.findMany({
      where,
      orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: MAX_WINDOW,
      select: { id: true, source: true },
    });

    const ordered = interleaveBySource(candidates);
    servableTotal = Math.min(total, ordered.length);

    const pageIds = ordered.slice(skip, skip + limit).map((r) => r.id);
    if (!pageIds.length) {
      leads = [];
    } else {
      const full = await prisma.lead.findMany({ where: { id: { in: pageIds } } });
      const byId = new Map(full.map((l) => [l.id, l]));
      leads = pageIds.map((id) => byId.get(id)).filter(Boolean);
    }
  }

  return NextResponse.json({
    leads,
    facets,
    hiddenExpired,
    pagination: { page, limit, total: servableTotal, totalPages: Math.ceil(servableTotal / limit) },
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
