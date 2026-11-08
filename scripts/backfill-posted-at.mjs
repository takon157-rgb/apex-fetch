// One-time backfill: leads scraped before we captured postedAt have null there.
// createdAt is when we saw the posting, so it's an honest lower bound for
// "how old is this" and lets the expired-job filter actually work.
//
// One raw UPDATE instead of a per-row loop — the pooler makes row-by-row
// updates far too slow (3+ min for a few hundred rows).
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const before = await prisma.lead.count({ where: { postedAt: null } });
console.log(`null postedAt before: ${before}`);

const affected = await prisma.$executeRawUnsafe(
  `UPDATE "Lead" SET "postedAt" = "createdAt" WHERE "postedAt" IS NULL`
);
console.log(`rows updated: ${affected}`);

const after = await prisma.lead.count({ where: { postedAt: null } });
console.log(`null postedAt after: ${after}`);

const now = Date.now();
for (const days of [7, 30, 45]) {
  const cutoff = new Date(now - days * 86400000);
  const old = await prisma.lead.count({ where: { deleted: false, postedAt: { lt: cutoff } } });
  console.log(`  active leads older than ${days}d: ${old}`);
}

await prisma.$disconnect();
