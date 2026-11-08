import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { heuristicFit } from '../lib/fit-core.ts';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
process.env.DATABASE_URL = env.DATABASE_URL;

const prisma = new PrismaClient();

// 1. updatedAt populated?
const total = await prisma.lead.count();
console.log(`Lead rows: ${total} | updatedAt is NOT NULL DEFAULT (enforced by DB)`);

// 2. Source distribution — which sites actually produce jobs?
const bySource = await prisma.lead.groupBy({ by: ['source'], _count: { _all: true } });
console.log('\n--- leads by source ---');
for (const s of bySource.sort((a, b) => b._count._all - a._count._all)) {
  console.log(`  ${String(s._count._all).padStart(5)}  ${s.source}`);
}

// 3. Dead / expired links
const now = Date.now();
const recent = await prisma.lead.findMany({
  where: { deleted: false },
  select: { url: true, postedAt: true, createdAt: true },
});
const stale = recent.filter(l => {
  const d = l.postedAt || l.createdAt;
  return d && (now - new Date(d).getTime()) > 30 * 86_400_000;
});
const noUrl = recent.filter(l => !l.url || l.url.length < 10);
console.log(`\n--- link health (of ${recent.length} active leads) ---`);
console.log(`  older than 30 days: ${stale.length}`);
console.log(`  missing/short url : ${noUrl.length}`);

// 4. Resume-match ranking sample
const prefs = await prisma.userPreference.findFirst({ where: { setupComplete: true } });
if (prefs) {
  const resume = {
    summary: prefs.parsedResumeSummary || '',
    skills: prefs.coreSkills || [],
    roles: prefs.targetRoles || [],
  };
  console.log(`\n--- resume-match ranking sample (skills: ${resume.skills.join(', ') || 'none'}) ---`);
  const sample = await prisma.lead.findMany({ where: { deleted: false }, take: 400 });
  const ranked = sample
    .map(l => ({ l, f: heuristicFit(resume, { title: l.title, description: l.description || '' }) }))
    .sort((a, b) => b.f.score - a.f.score);
  for (const { l, f } of ranked.slice(0, 5)) {
    console.log(`  ${String(f.score).padStart(3)}%  ${l.title.slice(0, 52).padEnd(52)} [${l.source}]`);
  }
  const zero = ranked.filter(r => r.f.score === 0).length;
  console.log(`  (${zero}/${ranked.length} sampled jobs scored 0 — no resume overlap)`);
} else {
  console.log('\n(no user with setupComplete=true to rank against)');
}

await prisma.$disconnect();
