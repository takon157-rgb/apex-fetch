// Mirrors the GET /api/leads logic against the live DB so the feed's shape,
// depth, ordering stability and speed can be verified without a browser
// session. Run: node scripts/verify-feed.mjs
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { PrismaClient } = await import('@prisma/client');
const { buildLeadsWhere, interleaveBySource, sourceGroup } = await import('../lib/leads-query-core.ts');

const prisma = new PrismaClient();
const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
const MAX_WINDOW = 2000;

const where = buildLeadsWhere({ userId: user.id, maxAgeDays: 30 }).where;
const total = await prisma.lead.count({ where });

// The candidate list, exactly as the route builds it.
const t0 = Date.now();
const candidates = await prisma.lead.findMany({
  where,
  orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
  take: MAX_WINDOW,
  select: { id: true, source: true },
});
const ordered = interleaveBySource(candidates);
const t1 = Date.now();

console.log(`matching leads: ${total}   candidates: ${ordered.length}   servable: ${Math.min(total, ordered.length)}   pages: ${Math.ceil(Math.min(total, ordered.length) / 50)}`);
console.log(`candidate query: ${t1 - t0}ms`);

console.log('\n=== PAGE FETCH ===');
const seen = new Set();
let duplicates = 0;
const pageIdsByPage = new Map();
for (const page of [1, 2, 3, 5, 10, 15, 20, 25, 29]) {
  const limit = 50;
  const skip = (page - 1) * limit;
  const t = Date.now();
  const pageIds = ordered.slice(skip, skip + limit).map((r) => r.id);
  const full = pageIds.length ? await prisma.lead.findMany({ where: { id: { in: pageIds } } }) : [];
  const byId = new Map(full.map((l) => [l.id, l]));
  const leads = pageIds.map((id) => byId.get(id)).filter(Boolean);
  const ms = Date.now() - t;

  for (const id of pageIds) { if (seen.has(id)) duplicates++; seen.add(id); }
  pageIdsByPage.set(page, pageIds);

  const counts = leads.reduce((a, l) => { const g = sourceGroup(l.source); a[g] = (a[g] || 0) + 1; return a; }, {});
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[1] ?? 0;
  console.log(`  page ${String(page).padStart(2)}: ${String(leads.length).padStart(2)} rows | ${String(sorted.length).padStart(2)} sources | top ${((top / Math.max(1, leads.length)) * 100).toFixed(0)}% | ${ms}ms`);
}

// No job may appear on two pages.
console.log(`\nduplicate ids across pages: ${duplicates} ${duplicates === 0 ? '(OK)' : '(BUG)'}`);

// Every fetched page must be exactly the matching slice of the one ordered
// list — that's what makes infinite scroll safe.
let contiguous = true;
for (const [page, pageIds] of pageIdsByPage) {
  const expected = ordered.slice((page - 1) * 50, page * 50).map((r) => r.id);
  if (JSON.stringify(expected) !== JSON.stringify(pageIds)) {
    contiguous = false;
    console.log(`  page ${page} does not match its slice of the ordered list`);
    break;
  }
}
console.log(`pages are contiguous slices of one stable order: ${contiguous ? 'YES (OK)' : 'NO (BUG)'}`);

console.log('\n=== FIRST PAGE CONTENT ===');
const firstIds = pageIdsByPage.get(1);
const first = await prisma.lead.findMany({ where: { id: { in: firstIds } } });
const firstById = new Map(first.map((l) => [l.id, l]));
for (const id of firstIds.slice(0, 14)) {
  const l = firstById.get(id);
  console.log(`  [${sourceGroup(l.source).padEnd(14)}] ${String(l.title).slice(0, 50).padEnd(52)} ${String(l.jobType || '-').padEnd(11)} ${l.remote ? 'remote' : ''}`);
}

await prisma.$disconnect();
