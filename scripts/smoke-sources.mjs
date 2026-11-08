// Runs the real scrape pipeline against the live sources and reports per-source results.
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
process.env.DATABASE_URL = env.DATABASE_URL;

const { SOURCES } = await import('../lib/source-registry.ts');
const prisma = new PrismaClient();

console.log(`Sources registered: ${SOURCES.length}\n`);

// Exercise each source's parser through the pipeline's own logic by calling
// runScrapePipeline is heavy (writes DB), so instead we time each URL fetch
// and report HTTP status + item count as a smoke test.
const results = [];
for (const s of SOURCES) {
  const t0 = Date.now();
  try {
    const res = await fetch(s.url, { headers: { 'User-Agent': 'Mozilla/5.0 ApexFetch/2.0' }, signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    let count = 0;
    if (s.parser === 'rss') count = (text.match(/<item[\s>]/g) || []).length || (text.match(/<entry[\s>]/g) || []).length;
    else {
      try {
        const j = JSON.parse(text);
        const arr = Array.isArray(j) ? j : (j.jobs || j.data || []);
        count = arr.length;
      } catch { count = 0; }
    }
    results.push({ name: s.name, status: res.status, count, ms: Date.now() - t0 });
  } catch (e) {
    results.push({ name: s.name, status: 'ERR', count: 0, ms: Date.now() - t0, error: String(e.message).slice(0, 40) });
  }
}

console.log('SOURCE                            HTTP   ITEMS   ms');
console.log('-'.repeat(58));
let ok = 0;
for (const r of results) {
  const flag = r.status === 200 && r.count > 0 ? ' ' : '!';
  if (flag === ' ') ok++;
  console.log(`${flag} ${r.name.padEnd(30)} ${String(r.status).padStart(4)}  ${String(r.count).padStart(6)}  ${String(r.ms).padStart(5)}`);
}
console.log('-'.repeat(58));
console.log(`working: ${ok}/${results.length}   raw items: ${results.reduce((a, b) => a + b.count, 0)}`);
await prisma.$disconnect();

