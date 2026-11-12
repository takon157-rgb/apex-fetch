import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 19).replace('T', ' ') : 'null');

async function main() {
  const total = await prisma.lead.count();
  const nonDeleted = await prisma.lead.count({ where: { deleted: false } });

  console.log(`Lead rows total=${total} nonDeleted=${nonDeleted}`);

  // How many leads have a NULL postedAt? A NULL sorts FIRST in Postgres DESC,
  // which would put undated jobs at the very top of the feed.
  const nullPosted = await prisma.lead.count({ where: { postedAt: null } });
  console.log(`postedAt NULL: ${nullPosted}`);

  // Distribution of postedAt across the whole table.
  const buckets = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*) FILTER (WHERE "postedAt" IS NULL)::int AS null_at,
      COUNT(*) FILTER (WHERE "postedAt" > now() - interval '1 day')::int AS posted_24h,
      COUNT(*) FILTER (WHERE "postedAt" > now() - interval '7 days')::int AS posted_7d,
      COUNT(*) FILTER (WHERE "postedAt" > now() - interval '30 days')::int AS posted_30d,
      COUNT(*) FILTER (WHERE "postedAt" <= now() - interval '30 days')::int AS posted_old,
      MIN("postedAt") AS min_posted,
      MAX("postedAt") AS max_posted
    FROM "Lead"
  `);
  console.log('postedAt buckets:', buckets[0]);

  const createdBuckets = await prisma.$queryRawUnsafe(`
    SELECT
      COUNT(*) FILTER (WHERE "createdAt" > now() - interval '1 hour')::int AS c_1h,
      COUNT(*) FILTER (WHERE "createdAt" > now() - interval '24 hours')::int AS c_24h,
      COUNT(*) FILTER (WHERE "createdAt" > now() - interval '7 days')::int AS c_7d,
      MIN("createdAt") AS min_created,
      MAX("createdAt") AS max_created
    FROM "Lead"
  `);
  console.log('createdAt buckets:', createdBuckets[0]);

  // The actual feed order: postedAt DESC, createdAt DESC, id ASC.
  const feed = await prisma.lead.findMany({
    where: { deleted: false },
    orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    take: 12,
    select: { id: true, title: true, source: true, postedAt: true, createdAt: true },
  });
  console.log('\n--- TOP 12 AS THE FEED SHOWS THEM ---');
  for (const [i, l] of feed.entries()) {
    console.log(`${String(i + 1).padStart(2)}. posted=${fmt(l.postedAt)} created=${fmt(l.createdAt)} [${l.source}] ${String(l.title).slice(0, 60)}`);
  }

  // Where do the 20 most-recently-CREATED leads actually land in that order?
  const recent = await prisma.lead.findMany({
    where: { deleted: false },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, title: true, source: true, postedAt: true, createdAt: true },
  });
  console.log('\n--- 20 MOST RECENTLY DISCOVERED (by createdAt) ---');
  for (const [i, l] of recent.entries()) {
    const rank = feed.findIndex((f) => f.id === l.id);
    console.log(`${String(i + 1).padStart(2)}. posted=${fmt(l.postedAt)} created=${fmt(l.createdAt)} [${l.source}] ${String(l.title).slice(0, 55)}`);
  }

  // Same list ranked by the feed order to see the real spread.
  const ranked = await prisma.$queryRawUnsafe(`
    SELECT title, source, "postedAt", "createdAt",
           ROW_NUMBER() OVER (ORDER BY "postedAt" DESC NULLS LAST, "createdAt" DESC, id ASC) AS rank
    FROM "Lead" WHERE deleted = false
    ORDER BY rank LIMIT 2000
  `);
  const createdIdx = ranked.map((r) => new Date(r.createdAt).getTime());
  const newest = Math.max(...createdIdx);
  console.log(`\nFeed candidate window size: ${ranked.length}`);
  console.log(`Newest createdAt inside window: ${fmt(newest)}`);
  const top200Newest = createdIdx.slice(0, 200).filter((t) => t === newest).length;
  console.log(`Rows in window sharing the newest createdAt: ${top200Newest}`);

  // Per-source view of the last 24h of discoveries.
  const perSource = await prisma.$queryRawUnsafe(`
    SELECT COALESCE(source,'(null)') AS source, COUNT(*)::int AS n,
           MAX("createdAt") AS latest, MAX("postedAt") AS latest_posted
    FROM "Lead"
    WHERE "createdAt" > now() - interval '7 days'
    GROUP BY source ORDER BY n DESC
  `);
  console.log('\n--- discoveries in last 7 days, by source ---');
  for (const r of perSource) {
    console.log(`  ${String(r.source).padEnd(28)} n=${String(r.n).padStart(4)} latestCreated=${fmt(r.latest)} latestPosted=${fmt(r.latest_posted)}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
