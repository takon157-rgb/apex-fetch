import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLeadsWhere,
  buildFacetWhere,
  buildWhereWithoutAge,
  interleaveBySource,
  sourceGroup,
  sourceGroupLabel,
  INDUSTRY_KEYWORDS,
} from './leads-query-core.ts';

const NOW = Date.UTC(2026, 10, 8);
const base = { userId: 'user-1', now: NOW };

// ---------------------------------------------------------------------------
// buildLeadsWhere
// ---------------------------------------------------------------------------

test('leads where: scopes to the user and excludes deleted by default', () => {
  const { where } = buildLeadsWhere(base);
  assert.equal(where.userId, 'user-1');
  assert.equal(where.deleted, false);
});

test('leads where: includeDeleted drops the deleted clause', () => {
  const { where } = buildLeadsWhere({ ...base, includeDeleted: true });
  assert.equal('deleted' in where, false);
});

test('leads where: source and jobType are exact matches', () => {
  const { where } = buildLeadsWhere({ ...base, source: 'Jobicy', jobType: 'part-time' });
  assert.equal(where.source, 'Jobicy');
  assert.equal(where.jobType, 'part-time');
});

test('leads where: "All" is treated as no filter', () => {
  const { where } = buildLeadsWhere({ ...base, source: 'All', jobType: 'All' });
  assert.equal('source' in where, false);
  assert.equal('jobType' in where, false);
});

test('leads where: remote accepts true and false but ignores other values', () => {
  assert.equal(buildLeadsWhere({ ...base, remote: 'true' }).where.remote, true);
  assert.equal(buildLeadsWhere({ ...base, remote: 'false' }).where.remote, false);
  assert.equal('remote' in buildLeadsWhere({ ...base, remote: 'maybe' }).where, false);
  assert.equal('remote' in buildLeadsWhere({ ...base, remote: null }).where, false);
});

test('leads where: minSalary matches either bound', () => {
  const { where } = buildLeadsWhere({ ...base, minSalary: '60000' });
  assert.deepEqual(where.OR, [
    { salaryMax: { gte: 60000 } },
    { salaryMin: { gte: 60000 } },
  ]);
});

test('leads where: a junk minSalary is ignored rather than filtering everything out', () => {
  const { where } = buildLeadsWhere({ ...base, minSalary: 'abc' });
  assert.equal('OR' in where, false);
  const { where: zero } = buildLeadsWhere({ ...base, minSalary: '0' });
  assert.equal('OR' in zero, false);
});

test('leads where: every independent filter is ANDed, never ORed', () => {
  const { where, filters } = buildLeadsWhere({
    ...base,
    q: 'engineer',
    maxAgeDays: 30,
    industry: 'AI Automation',
    niche: 'typescript',
  });

  assert.equal(where.AND.length, 4, 'search + age + industry + niche');
  assert.equal(filters.length, 4);
  // The only top-level OR is the salary clause.
  assert.ok(Array.isArray(where.OR) === false || where.OR.length === 2);
});

test('leads where: the age filter keeps jobs with no postedAt', () => {
  const { ageFilter } = buildLeadsWhere({ ...base, maxAgeDays: 30 });
  assert.ok(ageFilter, 'age filter is built');
  assert.deepEqual(ageFilter.OR, [
    { postedAt: { gte: new Date(NOW - 30 * 86_400_000) } },
    { postedAt: null },
  ]);
});

test('leads where: no age filter when maxAgeDays is 0', () => {
  const { ageFilter, where } = buildLeadsWhere({ ...base, maxAgeDays: 0 });
  assert.equal(ageFilter, null);
  assert.equal('AND' in where, false);
});

test('leads where: search covers title, description and company', () => {
  const { filters } = buildLeadsWhere({ ...base, q: 'react' });
  assert.deepEqual(filters[0].OR, [
    { title: { contains: 'react', mode: 'insensitive' } },
    { description: { contains: 'react', mode: 'insensitive' } },
    { company: { contains: 'react', mode: 'insensitive' } },
  ]);
});

test('leads where: an unknown industry adds no clause instead of matching nothing', () => {
  const { filters } = buildLeadsWhere({ ...base, industry: 'Nonexistent Niche' });
  assert.equal(filters.length, 0);
});

test('leads where: a known industry searches title and description', () => {
  const { filters } = buildLeadsWhere({ ...base, industry: 'Video Editing' });
  assert.equal(filters.length, 1);
  const clauses = filters[0].OR;
  assert.equal(clauses.length, INDUSTRY_KEYWORDS['Video Editing'].length * 2);
});

// ---------------------------------------------------------------------------
// buildFacetWhere / buildWhereWithoutAge
// ---------------------------------------------------------------------------

test('facet where: removes jobType and remote but keeps the rest', () => {
  const facetWhere = buildFacetWhere({
    ...base,
    jobType: 'part-time',
    remote: 'true',
    source: 'Jobicy',
    q: 'engineer',
  });

  assert.equal('jobType' in facetWhere, false);
  assert.equal('remote' in facetWhere, false);
  assert.equal(facetWhere.source, 'Jobicy');
  assert.ok(facetWhere.AND, 'the search filter survives');
});

test('where without age: removes only the age clause', () => {
  const input = { ...base, q: 'engineer', maxAgeDays: 30 };
  const { where } = buildLeadsWhere(input);
  const withoutAge = buildWhereWithoutAge(input);

  assert.equal(where.AND.length, 2, 'search + age');
  assert.equal(withoutAge.AND.length, 1, 'search only');
  assert.ok(
    withoutAge.AND[0].OR.some((c) => c.title),
    'the remaining clause is the search clause',
  );
});

test('where without age: returns the original query when there is no age filter', () => {
  const input = { ...base, q: 'engineer' };
  const { where } = buildLeadsWhere(input);
  const withoutAge = buildWhereWithoutAge(input);
  assert.deepEqual(withoutAge, where);
});

test('where without age: leaves no empty AND array behind', () => {
  const withoutAge = buildWhereWithoutAge({ ...base, maxAgeDays: 30 });
  assert.equal('AND' in withoutAge, false);
});

// ---------------------------------------------------------------------------
// interleaveBySource
// ---------------------------------------------------------------------------

test('interleave: spreads sources so one board cannot take over the page', () => {
  const leads = [
    ...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, source: 'Arbeitnow' })),
    ...Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, source: 'Jobicy' })),
    ...Array.from({ length: 2 }, (_, i) => ({ id: `c${i}`, source: 'Stripe' })),
  ];

  const out = interleaveBySource(leads);
  assert.equal(out.length, leads.length, 'no leads are lost');

  // Every lead appears exactly once.
  assert.equal(new Set(out.map((l) => l.id)).size, leads.length);

  // The first pass contains one lead from every source, so the top of the
  // feed is never dominated by a single board.
  const firstPass = new Set(out.slice(0, 3).map((l) => l.source));
  assert.equal(firstPass.size, 3, `got ${JSON.stringify(out.slice(0, 3).map((l) => l.source))}`);

  // Over two full rounds no source may appear more than twice. (Once the
  // smaller sources run out the remaining leads legitimately all come from
  // the larger one, so the invariant only holds while several are active.)
  const firstSix = out.slice(0, 6).map((l) => l.source);
  const counts = firstSix.reduce((acc, s) => { acc[s] = (acc[s] || 0) + 1; return acc; }, {});
  for (const [src, n] of Object.entries(counts)) {
    assert.ok(n <= 2, `${src} appeared ${n} times in the first 6 positions`);
  }
});

test('interleave: one lead from every source appears in the first pass', () => {
  const sources = ['A', 'B', 'C', 'D', 'E'];
  const leads = sources.flatMap((s) => [
    { id: `${s}1`, source: s },
    { id: `${s}2`, source: s },
  ]);
  const out = interleaveBySource(leads);
  assert.equal(new Set(out.slice(0, 5).map((l) => l.source)).size, 5);
});

test('interleave: handles a single source without hanging', () => {
  const leads = Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, source: 'Only' }));
  const out = interleaveBySource(leads);
  assert.equal(out.length, 5);
});

test('interleave: handles an empty list', () => {
  assert.deepEqual(interleaveBySource([]), []);
});

test('interleave: treats a missing source as "Other"', () => {
  const out = interleaveBySource([{ id: 'x', source: null }, { id: 'y', source: 'Real' }]);
  assert.equal(out.length, 2);
  assert.ok(out.some((l) => l.source === 'Other' || l.source === null));
});

// ---------------------------------------------------------------------------
// source grouping
// ---------------------------------------------------------------------------

test('sourceGroup: collapses the same company onto one key', () => {
  assert.equal(sourceGroup('Direct: Stripe'), 'stripe');
  assert.equal(sourceGroup('Direct: stripe.com'), 'stripe');
  assert.equal(sourceGroup('Direct: https://stripe.com/jobs'), 'stripe');
  assert.equal(sourceGroup('Direct: stripe.com/jobs/123'), 'stripe');
  assert.equal(sourceGroup('Direct: arbeitnow.com'), 'arbeitnow');
  assert.equal(sourceGroup('Direct: arbeitnow.fr'), 'arbeitnow');
  assert.equal(sourceGroup('Direct: arbeitnow.co.uk'), 'arbeitnow');
  assert.equal(sourceGroup('Arbeitnow'), 'arbeitnow');
});

test('sourceGroup: collapses tagged feeds of the same board', () => {
  assert.equal(sourceGroup('Jobicy'), 'jobicy');
  assert.equal(sourceGroup('Jobicy: Part-time'), 'jobicy');
  assert.equal(sourceGroup('Jobicy: Contract'), 'jobicy');
  assert.equal(sourceGroup('Himalayas'), 'himalayas');
  assert.equal(sourceGroup('Himalayas (2)'), 'himalayas');
});

test('sourceGroup: keeps genuinely different boards apart', () => {
  assert.notEqual(sourceGroup('Jobicy'), sourceGroup('Himalayas'));
  assert.notEqual(sourceGroup('Direct: Stripe'), sourceGroup('Direct: OpenAI'));
});

test('sourceGroup: handles missing and blank sources', () => {
  assert.equal(sourceGroup(null), 'other');
  assert.equal(sourceGroup(undefined), 'other');
  assert.equal(sourceGroup(''), 'other');
  assert.equal(sourceGroup('   '), 'other');
});

test('sourceGroupLabel: produces a readable label', () => {
  assert.equal(sourceGroupLabel('arbeitnow'), 'Arbeitnow');
  assert.equal(sourceGroupLabel('jobicy'), 'Jobicy');
  assert.equal(sourceGroupLabel('other'), 'Other');
  assert.equal(sourceGroupLabel(''), 'Other');
});

test('interleave: one company filling many URL variants still gets one turn', () => {
  const leads = [
    { id: 'a1', source: 'Direct: arbeitnow.com' },
    { id: 'a2', source: 'Direct: arbeitnow.fr' },
    { id: 'a3', source: 'Direct: arbeitnow.co.uk' },
    { id: 'a4', source: 'Arbeitnow' },
    { id: 'b1', source: 'Jobicy' },
    { id: 'b2', source: 'Jobicy: Contract' },
    { id: 'c1', source: 'Direct: Stripe' },
  ];
  const out = interleaveBySource(leads);
  assert.equal(out.length, leads.length);

  // With only three real companies, the first three slots must be one each.
  const firstThreeGroups = out.slice(0, 3).map((l) => sourceGroup(l.source));
  assert.equal(new Set(firstThreeGroups).size, 3, `got ${JSON.stringify(firstThreeGroups)}`);
});

test('leads where: a source group matches every member source', () => {
  const { where } = buildLeadsWhere({
    ...base,
    source: 'Arbeitnow',
    sourceMembers: ['Arbeitnow', 'Direct: arbeitnow.com', 'Direct: arbeitnow.fr'],
  });
  assert.equal(where.source, undefined, 'not a single-source match');
  assert.deepEqual(where.AND[0], {
    source: { in: ['Arbeitnow', 'Direct: arbeitnow.com', 'Direct: arbeitnow.fr'] },
  });
});

test('leads where: without group members it falls back to an exact source match', () => {
  const { where } = buildLeadsWhere({ ...base, source: 'Jobicy' });
  assert.equal(where.source, 'Jobicy');
  assert.equal('AND' in where, false);
});
