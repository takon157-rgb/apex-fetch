// Simulates the exact GET /api/leads "recent" feed so we can see what the
// user's first page actually looks like, including the source interleaving.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function sourceGroup(source) {
  if (!source) return 'other';
  const s = String(source).trim();
  if (!s) return 'other';
  const direct = /^direct:\s*(.+)$/i.exec(s);
  if (direct) {
    let name = direct[1].trim().replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
    name = name.replace(/\.(co\.uk|com|fr|de|uk|us|ca|eu|com\.fr|co|net|org|io|ai)$/i, '');
    name = name.replace(/[._-]+$/, '');
    return (name || 'other').toLowerCase();
  }
  return s.split(':')[0].replace(/\s*\(\d+\)\s*$/, '').trim().toLowerCase() || 'other';
}

function interleaveBySource(leads) {
  const buckets = new Map();
  for (const lead of leads) {
    const key = sourceGroup(lead.source);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(lead);
    else buckets.set(key, [lead]);
  }
  const lists = Array.from(buckets.values());
  lists.sort((a, b) => a.length - b.length);
  const out = [];
  for (let i = 0; out.length < leads.length; i++) {
    let added = false;
    for (const list of lists) {
      if (i < list.length) { out.push(list[i]); added = true; }
    }
    if (!added) break;
  }
  return out;
}

const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : 'null');

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, clerkId: true, email: true },
  });

  for (const u of users) {
    const n = await prisma.lead.count({ where: { userId: u.id, deleted: false } });
    if (!n) { console.log(`\n=== ${u.email}: no leads ===`); continue; }

    console.log(`\n================ ${u.email || u.clerkId} (${n} leads) ================`);

    // --- CURRENT feed order: postedAt DESC, createdAt DESC ---
    const candidates = await prisma.lead.findMany({
      where: { userId: u.id, deleted: false },
      orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: 2000,
      select: { id: true, title: true, source: true, postedAt: true, createdAt: true },
    });
    const ordered = interleaveBySource(candidates);

    console.log(`\n--- CURRENT ORDER: first 30 of ${ordered.length} ---`);
    for (const [i, l] of ordered.slice(0, 30).entries()) {
      const ageH = ((Date.now() - new Date(l.postedAt).getTime()) / 3600000).toFixed(1);
      console.log(`${String(i + 1).padStart(2)}. grp=${sourceGroup(l.source).padEnd(14)} posted=${fmt(l.postedAt)} (${ageH}h ago) created=${fmt(l.createdAt)} | ${String(l.title).slice(0, 48)}`);
    }

    // How many of the first 50 were discovered in the last 24h?
    const day = Date.now() - 86400000;
    const first50 = ordered.slice(0, 50);
    const fresh50 = first50.filter((l) => new Date(l.createdAt).getTime() > day).length;
    const first100 = ordered.slice(0, 100);
    const fresh100 = first100.filter((l) => new Date(l.createdAt).getTime() > day).length;
    console.log(`\n  discovered <24h ago: in first 50 => ${fresh50}/50 | in first 100 => ${fresh100}/100`);

    // --- PROPOSED order: createdAt DESC (discovery first) ---
    const byDiscovery = await prisma.lead.findMany({
      where: { userId: u.id, deleted: false },
      orderBy: [{ createdAt: 'desc' }, { postedAt: 'desc' }, { id: 'asc' }],
      take: 2000,
      select: { id: true, title: true, source: true, postedAt: true, createdAt: true },
    });
    const ordered2 = interleaveBySource(byDiscovery);
    console.log(`\n--- PROPOSED ORDER (discovery first): first 30 ---`);
    for (const [i, l] of ordered2.slice(0, 30).entries()) {
      console.log(`${String(i + 1).padStart(2)}. grp=${sourceGroup(l.source).padEnd(14)} posted=${fmt(l.postedAt)} created=${fmt(l.createdAt)} | ${String(l.title).slice(0, 48)}`);
    }
    const p50 = ordered2.slice(0, 50);
    console.log(`\n  discovered <24h ago: in first 50 => ${p50.filter((l) => new Date(l.createdAt).getTime() > day).length}/50`);

    // What actually landed in the DB in the last scrape burst (last 2 hours)?
    const burst = await prisma.lead.findMany({
      where: { userId: u.id, deleted: false, createdAt: { gte: new Date(Date.now() - 2 * 3600000) } },
      orderBy: { createdAt: 'desc' },
      select: { title: true, source: true, postedAt: true, createdAt: true },
    });
    console.log(`\n--- rows discovered in the LAST 2 HOURS: ${burst.length} ---`);
    const bySrc = {};
    for (const b of burst) {
      const g = sourceGroup(b.source);
      bySrc[g] = (bySrc[g] || 0) + 1;
    }
    console.log('  by group:', JSON.stringify(bySrc));
    const stale = burst.filter((b) => b.postedAt && (Date.now() - new Date(b.postedAt).getTime()) > 14 * 86400000);
    console.log(`  of those, ${stale.length} have a postedAt older than 14 days (real old postings discovered late)`);
    for (const s of stale.slice(0, 8)) {
      console.log(`    stale: ${sourceGroup(s.source).padEnd(12)} posted=${fmt(s.postedAt)} | ${String(s.title).slice(0, 50)}`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
