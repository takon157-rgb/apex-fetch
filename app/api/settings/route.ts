import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { sanitizeTargetUrls } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/**
 * Per-account scrape targets.
 *
 * These used to live in a global `settings.json` file, which meant one
 * account's targets applied to every account - and writes failed outright on
 * the serverless host, where the filesystem is read-only. They now live on the
 * account's own preference row.
 */
async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId || null;
}

export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const prefs = await prisma.userPreference.findUnique({
      where: { userId: user.id },
      select: { targetUrls: true },
    });

    return NextResponse.json(
      { targetUrls: prefs?.targetUrls ?? [] },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } },
    );
  } catch (err) {
    console.error('[Settings] read error:', err);
    return NextResponse.json({ error: 'Unable to read settings.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const payload = await req.json().catch(() => ({}));
    if (!Array.isArray(payload.targetUrls)) {
      return NextResponse.json({ error: 'Missing settings payload.' }, { status: 400 });
    }

    // Only public http(s) URLs are kept - the server fetches these.
    const targetUrls = sanitizeTargetUrls(payload.targetUrls);

    const prefs = await prisma.userPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, targetRoles: [], coreSkills: [], targetUrls },
      update: { targetUrls },
      select: { targetUrls: true },
    });

    return NextResponse.json({ targetUrls: prefs.targetUrls });
  } catch (err) {
    console.error('[Settings] write error:', err);
    return NextResponse.json({ error: 'Failed saving settings.' }, { status: 500 });
  }
}
