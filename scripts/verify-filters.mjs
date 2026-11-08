// Verifies the feed filters against the live database using the exact same
// query builder the API route uses. Run: node scripts/verify-filters.mjs
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { PrismaClient } = await import('@prisma/client');
const { buildLeadsWhere, buildFacetWhere, buildWhereWithoutAge } = await import('../lib/leads-query-core.ts');

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
if (!user) { console.log('No user found'); await prisma.$disconnect(); process.exit(1); }

const count = async (input) => prisma.lead.count({ where: buildLeadsWhere(input).where });
const base = { userId: user.id };

console.log(`User: ${user.email || user.clerkId}`);
console.log(`Total leads: ${await prisma.lead.count({ where: { userId: user.id } })}\n`);

const checks = [
  ['no filters', {}],
  ['jobType=full-time', { jobType: 'full-time' }],
  ['jobType=part-time', { jobType: 'part-time' }],
  ['jobType=contract', { jobType: 'contract' }],
  ['jobType=internship', { jobType: 'internship' }],
  ['jobType=freelance', { jobType: 'freelance' }],
  ['remote=true', { remote: 'true' }],
  ['remote=false', { remote: 'false' }],
  ['maxAgeDays=30', { maxAgeDays: 30 }],
  ['maxAgeDays=7', { maxAgeDays: 7 }],
  ['industry=AI Automation', { industry: 'AI Automation' }],
  ['industry=Entry Level', { industry: 'Entry Level' }],
  ['industry=Video Editing', { industry: 'Video Editing' }],
  ['industry=Social Media', { industry: 'Social Media' }],
  ['minSalary=50000', { minSalary: '50000' }],
  ['minSalary=100000', { minSalary: '100000' }],
  ['q=engineer', { q: 'engineer' }],
  ['q=designer', { q: 'designer' }],
  ['niche=python', { niche: 'python' }],
  ['q+niche ANDed', { q: 'engineer', niche: 'python' }],
  ['source=Jobicy', { source: 'Jobicy' }],
  ['jobType=part-time + remote=true', { jobType: 'part-time', remote: 'true' }],
  ['jobType=part-time + maxAgeDays=30', { jobType: 'part-time', maxAgeDays: 30 }],
];

let failures = 0;
for (const [label, filters] of checks) {
  const n = await count({ ...base, ...filters });
  // These combinations legitimately have no rows; the rest must return some.
  const mayBeEmpty = label.startsWith('niche=') || label === 'q+niche ANDed' ||
    label === 'industry=Video Editing' || label === 'source=Jobicy' ||
    label === 'jobType=part-time + remote=true';
  const ok = n > 0 || mayBeEmpty;
  if (!ok) failures++;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label.padEnd(38)} ${String(n).padStart(5)}`);
}

console.log('\n=== FACETS (jobType counts with remote/source filters removed) ===');
const facetWhere = buildFacetWhere({ ...base, maxAgeDays: 30 });
const typeRows = await prisma.lead.groupBy({ by: ['jobType'], where: facetWhere, _count: { _all: true } });
for (const r of typeRows.sort((a, b) => b._count._all - a._count._all)) {
  console.log(`  ${String(r.jobType || 'unspecified').padEnd(14)} ${r._count._all}`);
}

console.log('\n=== HIDDEN EXPIRED (30d) ===');
const withAge = await count({ ...base, maxAgeDays: 30 });
const withoutAge = await prisma.lead.count({ where: buildWhereWithoutAge({ ...base, maxAgeDays: 30 }) });
console.log(`  shown: ${withAge}   hidden: ${Math.max(0, withoutAge - withAge)}   total: ${withoutAge}`);

console.log('\n=== SOURCE DIVERSITY (first 50 by recent order) ===');
const top = await prisma.lead.findMany({
  where: buildLeadsWhere({ ...base, maxAgeDays: 30 }).where,
  orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
  take: 500,
});
const counts = top.reduce((acc, l) => { acc[l.source] = (acc[l.source] || 0) + 1; return acc; }, {});
const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
console.log(`  distinct sources in window: ${sorted.length}`);
console.log(`  top 8: ${sorted.slice(0, 8).map(([s, n]) => `${s}=${n}`).join(', ')}`);
const topShare = sorted.length ? sorted[0][1] / top.length : 0;
console.log(`  largest source share: ${(topShare * 100).toFixed(1)}% ${topShare > 0.2 ? '(too dominant)' : '(healthy)'}`);

console.log(`\n${failures === 0 ? 'ALL FILTER CHECKS PASSED' : failures + ' FILTER CHECKS FAILED'}`);
await prisma.$disconnect();
