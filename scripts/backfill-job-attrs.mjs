// Backfills canonical jobType + remote onto existing leads.
//
// The old scrape stored whatever label the board sent ("FullTime",
// "Unbefristeter arbeitsvertrag", …) and left remote null for ~900 leads, so
// the dashboard's job-type and remote filters matched almost nothing.
//
// Raw SQL can't run the JS canonicaliser, so this reads the rows that need
// fixing and writes them back with an updateMany keyed on id.
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
process.env.DATABASE_URL = env.DATABASE_URL;

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const { resolveJobType, resolveRemote, JOB_TYPES } = await import('../lib/job-attrs-core.ts');

const rows = await prisma.lead.findMany({
  select: { id: true, title: true, description: true, location: true, jobType: true, remote: true },
});

console.log(`leads to normalise: ${rows.length}`);

const typeUpdates = [];
const remoteUpdates = [];

for (const r of rows) {
  const canonicalType = resolveJobType(r.jobType, r.title, r.description);
  // Clear anything that isn't in the canonical vocabulary. The previous
  // version only wrote when it found a match, which left stray labels like
  // "Bénévolat" and "Senior manager" in the database — invisible to the
  // dashboard's dropdown but still counted in facet totals.
  const currentIsCanonical = r.jobType && JOB_TYPES.includes(r.jobType);
  if (canonicalType !== r.jobType && (canonicalType || !currentIsCanonical)) {
    typeUpdates.push({ id: r.id, jobType: canonicalType });
  }
  const canonicalRemote = r.remote ?? resolveRemote(r.title, r.location, r.description);
  if (canonicalRemote !== null && canonicalRemote !== r.remote) {
    remoteUpdates.push({ id: r.id, remote: canonicalRemote });
  }
}

// Batch in chunks so we don't build one enormous statement.
const CHUNK = 200;
let typeDone = 0;
for (let i = 0; i < typeUpdates.length; i += CHUNK) {
  const chunk = typeUpdates.slice(i, i + CHUNK);
  await prisma.$transaction(
    chunk.map(c => prisma.lead.update({ where: { id: c.id }, data: { jobType: c.jobType } }))
  );
  typeDone += chunk.length;
  process.stdout.write(`\r  jobType: ${typeDone}/${typeUpdates.length}`);
}
console.log(`\njobType updated: ${typeDone}`);

let remoteDone = 0;
for (let i = 0; i < remoteUpdates.length; i += CHUNK) {
  const chunk = remoteUpdates.slice(i, i + CHUNK);
  await prisma.$transaction(
    chunk.map(c => prisma.lead.update({ where: { id: c.id }, data: { remote: c.remote } }))
  );
  remoteDone += chunk.length;
  process.stdout.write(`\r  remote:  ${remoteDone}/${remoteUpdates.length}`);
}
console.log(`\nremote updated: ${remoteDone}`);

console.log('\n=== resulting distribution ===');
for (const t of ['full-time', 'part-time', 'contract', 'internship', 'freelance']) {
  const n = await prisma.lead.count({ where: { jobType: t, deleted: false } });
  console.log(`  jobType ${String(t).padEnd(12)} ${n}`);
}
const noType = await prisma.lead.count({ where: { jobType: null, deleted: false } });
const remoteTrue = await prisma.lead.count({ where: { remote: true, deleted: false } });
const remoteFalse = await prisma.lead.count({ where: { remote: false, deleted: false } });
const remoteNull = await prisma.lead.count({ where: { remote: null, deleted: false } });
console.log(`  jobType (unset)     ${noType}`);
console.log(`  remote true         ${remoteTrue}`);
console.log(`  remote false        ${remoteFalse}`);
console.log(`  remote unknown      ${remoteNull}`);

await prisma.$disconnect();
