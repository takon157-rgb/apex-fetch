import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { rateLimitByUser } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Bulk deletion for the trash bin and for ageing leads.
 *
 * The dashboard used to empty the trash by issuing one DELETE per loaded row,
 * which meant only the rows that happened to be on screen were removed - the
 * rest sat in the database forever. This endpoint deletes in a single query,
 * scoped to the signed-in user.
 *
 * Scopes:
 *   trash  - permanently delete everything currently in the trash
 *   older  - permanently delete leads older than `days` (never removes leads
 *            the user has already applied to)
 */
export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = rateLimitByUser(clerkId, 12, 60000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const payload = await req.json().catch(() => ({}));
    const scope = typeof payload.scope === 'string' ? payload.scope : 'trash';
    const days = Math.min(Math.max(Number(payload.days) || 30, 1), 365);

    if (scope === 'trash') {
      const { count } = await prisma.lead.deleteMany({
        where: { userId: user.id, deleted: true },
      });
      return NextResponse.json({ success: true, scope, deleted: count });
    }

    if (scope === 'older') {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const { count } = await prisma.lead.deleteMany({
        where: {
          userId: user.id,
          deleted: false,
          // Never throw away something the user already acted on.
          applied: false,
          OR: [
            { postedAt: { lt: cutoff } },
            { postedAt: null, createdAt: { lt: cutoff } },
          ],
        },
      });
      return NextResponse.json({ success: true, scope, deleted: count, days });
    }

    return NextResponse.json({ error: 'Unknown scope' }, { status: 400 });
  } catch (err) {
    console.error('[Leads Purge] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 },
    );
  }
}
