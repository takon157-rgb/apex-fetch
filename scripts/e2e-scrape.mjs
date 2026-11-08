// End-to-end test of the REAL scrape pipeline against the live database.
// Exercises every source, the real parsers, dedupe, scoring and lead creation.
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// The pipeline lives in lib/scraper.ts, which imports './prisma' extensionless
// (Next.js style) that Node's ESM resolver can't follow. A resolve hook maps
// those to .ts so the REAL app code runs unmodified.
import { register } from 'node:module';
register('./ts-resolve-hook.mjs', import.meta.url);

const { runScrapePipeline } = await import('../lib/scraper.ts');

const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
if (!user) { console.log('NO USER IN DB'); await prisma.$disconnect(); process.exit(1); }

console.log(`user: ${user.email || user.id}`);
const before = await prisma.lead.count({ where: { userId: user.id } });
console.log(`leads before: ${before}\n`);

const t0 = Date.now();
let last = '';
const result = await runScrapePipeline(
  user.id,
  { targetRoles: ['software engineer', 'frontend engineer', 'fullstack developer'], coreSkills: ['typescript', 'react', 'node', 'python', 'aws'], parsedResumeSummary: null },
  [],
  'All',
  '',
  async (completed, total, current, leadsFound) => {
    if (current !== last) {
      last = current;
      console.log(`  [${String(completed).padStart(2)}/${total}] ${current.padEnd(28)} running=${leadsFound}`);
    }
  },
);
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

console.log(`\n=== pipeline finished in ${elapsed}s ===`);
console.log(`leads created: ${result.leadsCreated}`);
console.log(`leads healed:  ${result.leadsHealed}`);
console.log(`leads pruned:  ${result.leadsPruned}`);
console.log(`\nPER-SOURCE RESULTS`);
console.log('-'.repeat(60));
let failed = 0;
for (const s of result.sourceResults) {
  if (!s.success) failed++;
  console.log(`${s.success ? ' ' : '!'} ${s.source.padEnd(30)} ${String(s.count).padStart(5)}${s.error ? '  ' + String(s.error).slice(0, 40) : ''}`);
}
console.log('-'.repeat(60));
console.log(`sources ok: ${result.sourceResults.length - failed}/${result.sourceResults.length}`);

const after = await prisma.lead.count({ where: { userId: user.id } });
console.log(`\nleads after: ${after} (delta ${after - before})`);

// Sanity: did the newest leads carry real descriptions + urls + company?
const fresh = await prisma.lead.findMany({
  where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  orderBy: { createdAt: 'desc' },
  take: 500,
});
const withDesc = fresh.filter(l => (l.description || '').length > 80).length;
const withUrl = fresh.filter(l => !!l.url).length;
const direct = fresh.filter(l => l.source?.startsWith('Direct:')).length;
const bySource = {};
for (const l of fresh) bySource[l.source] = (bySource[l.source] || 0) + 1;
console.log(`fresh leads: ${fresh.length} | with description: ${withDesc} | with url: ${withUrl} | direct company: ${direct}`);
console.log('\nBY SOURCE:');
for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);

await prisma.$disconnect();
