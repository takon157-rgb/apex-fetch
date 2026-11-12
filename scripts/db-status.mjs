// Reports the live database state: users, per-user lead counts, job-type and
// remote distributions, and how fresh the postings are.
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  orderBy: { createdAt: 'asc' },
  select: {
    id: true,
    email: true,
    createdAt: true,
    _count: { select: { leads: true } },
  },
});

console.log('=== USERS ===');
for (const u of users) {
  console.log(
    `  ${u.email.padEnd(28)} leads=${String(u._count.leads).padStart(5)}  joined=${u.createdAt.toISOString().slice(0, 10)}`,
  );
}
console.log(`  total users: ${users.length}`);

const total = await prisma.lead.count();
console.log(`\n=== LEADS ===\n  total rows: ${total}`);

const types = await prisma.lead.groupBy({ by: ['jobType'], _count: { _all: true } });
console.log('\n  by job type:');
for (const t of types.sort((a, b) => b._count._all - a._count._all)) {
  console.log(`    ${String(t.jobType ?? '(unset)').padEnd(14)} ${t._count._all}`);
}

const remotes = await prisma.lead.groupBy({ by: ['remote'], _count: { _all: true } });
console.log('\n  by remote:');
for (const r of remotes) {
  console.log(`    ${String(r.remote ?? '(unknown)').padEnd(14)} ${r._count._all}`);
}

const sources = await prisma.lead.groupBy({ by: ['source'], _count: { _all: true } });
console.log(`\n  distinct sources: ${sources.length}`);

const cutoff = new Date(Date.now() - 30 * 86400000);
const fresh = await prisma.lead.count({
  where: { OR: [{ postedAt: { gte: cutoff } }, { postedAt: null }] },
});
const stale = total - fresh;
console.log(`  within 30 days (or undated): ${fresh}`);
console.log(`  older than 30 days:            ${stale}`);

const dated = await prisma.lead.count({ where: { postedAt: { not: null } } });
console.log(`  rows with a posted date:       ${dated}`);

await prisma.$disconnect();
