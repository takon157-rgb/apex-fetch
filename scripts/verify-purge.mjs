// Exercises the bulk-delete queries the /api/leads/purge route runs, against
// the real database, with a throwaway account.
//
// It proves two things that are easy to get wrong:
//   - "Empty trash" really does remove every trashed row in one query,
//     rather than only the rows that happened to be on screen.
//   - Leads the user already applied to are kept, so emptying the trash
//     cannot destroy the record of an application they sent.
//
// Run: node scripts/verify-purge.mjs
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register('./ts-resolve-hook.mjs', import.meta.url);

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

const clerkId = `purge-verify-${Date.now()}`;
const user = await prisma.user.create({ data: { clerkId, email: 'purge-verify@local.test' } });

try {
  const base = { userId: user.id, title: 'Test role', description: 'x', source: 'test' };
  const urlFor = (n) => `https://jobs.example.com/listing/${n}`;

  // 5 in the trash (not applied), 2 in the trash that were applied to,
  // 3 still live in the feed.
  await prisma.lead.createMany({
    data: [
      ...Array.from({ length: 5 }, (_, i) => ({ ...base, url: urlFor(`trash-${i}`), title: `Trash ${i}`, deleted: true, applied: false })),
      ...Array.from({ length: 2 }, (_, i) => ({ ...base, url: urlFor(`trash-applied-${i}`), title: `Trash applied ${i}`, deleted: true, applied: true })),
      ...Array.from({ length: 3 }, (_, i) => ({ ...base, url: urlFor(`live-${i}`), title: `Live ${i}`, deleted: false, applied: false })),
    ],
  });

  const before = await prisma.lead.count({ where: { userId: user.id } });

  // --- scope: trash ---------------------------------------------------
  const { count: deleted } = await prisma.lead.deleteMany({
    where: { userId: user.id, deleted: true, applied: false },
  });
  const kept = await prisma.lead.count({
    where: { userId: user.id, deleted: true, applied: true },
  });

  const afterTrash = await prisma.lead.count({ where: { userId: user.id } });
  const liveStillThere = await prisma.lead.count({ where: { userId: user.id, deleted: false } });

  console.log('=== scope: trash ===');
  console.log(`  rows before:         ${before}`);
  console.log(`  deleted:             ${deleted}`);
  console.log(`  kept (applied):      ${kept}`);
  console.log(`  rows after:          ${afterTrash}`);
  console.log(`  live rows untouched: ${liveStillThere}`);

  // --- scope: older ---------------------------------------------------
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { count: oldDeleted } = await prisma.lead.deleteMany({
    where: {
      userId: user.id,
      deleted: false,
      applied: false,
      OR: [{ postedAt: { lt: cutoff } }, { postedAt: null, createdAt: { lt: cutoff } }],
    },
  });

  const afterOlder = await prisma.lead.count({ where: { userId: user.id } });

  console.log('\n=== scope: older ===');
  console.log(`  old deleted:         ${oldDeleted}`);
  console.log(`  rows after:          ${afterOlder}`);

  const ok =
    deleted === 5 &&
    kept === 2 &&
    liveStillThere === 3 &&
    afterTrash === 5 &&
    oldDeleted === 0 &&
    afterOlder === 5;

  console.log(`\n  ${ok ? 'PASS' : 'FAIL'}: trash scope deleted 5 and kept 2 applied leads; the "older" scope left fresh leads alone`);
  if (!ok) process.exitCode = 1;
} finally {
  await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  await prisma.$disconnect();
}

process.exit(process.exitCode ?? 0);
