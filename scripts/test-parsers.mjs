// Exercises the REAL board parsers against live company APIs and asserts the
// output is usable (title, url, real description text, tags).
import { parseGreenhouseBoard, parseAshbyBoard, parseArbeitNowBoard } from '../lib/board-parsers.ts';
import { SOURCES } from '../lib/source-registry.ts';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ApexFetch/2.0';

const boards = SOURCES.filter(s => s.parser === 'greenhouse' || s.parser === 'ashby' || s.parser === 'arbeitnow');
console.log(`Testing ${boards.length} board parsers against live APIs\n`);
console.log('SOURCE                     PARSED  WITH_DESC  AVG_DESC  TAGS');
console.log('-'.repeat(68));

let failures = 0;
let totalParsed = 0;
let totalWithDesc = 0;

for (const s of boards) {
  try {
    const res = await fetch(s.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
    if (!res.ok) { console.log(`! ${s.name.padEnd(24)} HTTP ${res.status}`); failures++; continue; }
    const payload = await res.json();

    const items = s.parser === 'greenhouse' ? parseGreenhouseBoard(payload, s.name)
      : s.parser === 'ashby' ? parseAshbyBoard(payload, s.name)
      : parseArbeitNowBoard(payload, s.name);

    const withDesc = items.filter(i => i.description && i.description.length > 80).length;
    const avgDesc = items.length ? Math.round(items.reduce((a, i) => a + (i.description?.length || 0), 0) / items.length) : 0;
    const withTags = items.filter(i => (i.tags?.length || 0) > 0).length;

    totalParsed += items.length;
    totalWithDesc += withDesc;

    const bad = items.filter(i => !i.title || !i.url || /undefined|NaN|\[object/.test(`${i.title}${i.url}${i.description}`));
    if (bad.length) { console.log(`   !! ${bad.length} malformed items in ${s.name}`); failures += bad.length; }

    console.log(`${s.name.padEnd(26)} ${String(items.length).padStart(5)}  ${String(withDesc).padStart(9)}  ${String(avgDesc).padStart(8)}  ${withTags}/${items.length}`);
  } catch (e) {
    console.log(`! ${s.name.padEnd(24)} ERROR ${String(e.message).slice(0, 40)}`);
    failures++;
  }
}

console.log('-'.repeat(68));
console.log(`total parsed: ${totalParsed} | with description: ${totalWithDesc} | failures: ${failures}`);

// Sample one real parsed item so we can eyeball the quality.
const sample = await fetch(SOURCES.find(s => s.parser === 'greenhouse').url, { headers: { 'User-Agent': UA } });
const sampleItems = parseGreenhouseBoard(await sample.json(), 'Direct: Stripe');
console.log('\n--- SAMPLE (Greenhouse) ---');
for (const i of sampleItems.slice(0, 3)) {
  console.log(`title:    ${i.title}`);
  console.log(`company: ${i.company}`);
  console.log(`location: ${i.location}`);
  console.log(`url:      ${i.url}`);
  console.log(`tags:     ${(i.tags || []).join(', ')}`);
  console.log(`desc:     ${(i.description || '').slice(0, 180).replace(/\n/g, ' ')}...`);
  console.log('---');
}
process.exit(failures > 0 ? 1 : 0);
