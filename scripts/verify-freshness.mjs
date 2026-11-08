// Verifies the expired-job filtering logic against the live DB, exactly as
// the /api/leads route applies it.
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
const base = { userId: user.id, deleted: false };

const total = await prisma.lead.count({ where: base });

for (const days of [0, 7, 14, 30, 45, 90]) {
  const where = days === 0
    ? base
    : { ...base, AND: [{ OR: [{ postedAt: { gte: new Date(Date.now() - days * 86400000) } }, { postedAt: null }] }] };
  const n = await prisma.lead.count({ where });
  console.log(`maxAgeDays=${String(days).padStart(3)}  ->  ${String(n).padStart(5)} leads visible  (${total - n} hidden)`);
}

const noPostedAt = await prisma.lead.count({ where: { ...base, postedAt: null } });
console.log(`\nleads with no postedAt (always kept): ${noPostedAt}`);

const cutoff30 = new Date(Date.now() - 30 * 86400000);
const stale = await prisma.lead.count({ where: { ...base, postedAt: { lt: cutoff30 } } });
console.log(`leads genuinely older than 30d:      ${stale}`);

const oldButNull = noPostedAt;
console.log(`=> of the ${total - (total - stale - oldButNull)} hidden, ${oldButNull} have no date at all`);

console.log('\n--- visibility per source at 30d ---');
const sources = await prisma.lead.groupBy({ by: ['source'], where: base, _count: { _all: true } });
for (const s of sources.sort((a, b) => b._count._all - a._count._all)) {
  const vis = await prisma.lead.count({
    where: { ...base, source: s.source, AND: [{ OR: [{ postedAt: { gte: cutoff30 } }, { postedAt: null }] }] },
  });
  const bar = '#'.repeat(Math.round((vis / s._count._all) * 24));
  console.log(`${String(s._count._all).padStart(5)} total  ${String(vis).padStart(5)} fresh  ${bar}  ${s.source}`);
}

await prisma.$disconnect();
