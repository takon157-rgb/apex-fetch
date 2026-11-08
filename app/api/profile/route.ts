import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Strip the stored resume binary before sending the profile to the browser.
 *
 * The base64 PDF can be megabytes, and it is the user's most sensitive piece
 * of data on the platform. The client only needs to know whether a resume
 * exists; the server-side tailoring routes read it straight from the DB.
 */
function sanitizeProfile(profile: any) {
  if (!profile) return null;
  const { resumeBase64, ...rest } = profile;
  return {
    ...rest,
    hasResume: Boolean(resumeBase64) || Boolean(profile.resumeText),
    resumeSize: resumeBase64 ? resumeBase64.length : 0,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const payload = await req.json().catch(() => ({}));
    if (!payload) return NextResponse.json({ error: 'No payload' }, { status: 400 });

    // Only overwrite the stored resume when the client actually sent a new
    // one. Otherwise a profile save would silently wipe the uploaded resume.
    const hasNewBinary = typeof payload.resumeBase64 === 'string' && payload.resumeBase64.length > 0;
    const hasNewText = typeof payload.resumeText === 'string';
    const hasNewFileName = typeof payload.resumeFileName === 'string' && payload.resumeFileName.length > 0;

    const profile = await prisma.careerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: payload.name || payload.fullName || 'Unnamed',
        email: payload.email || '',
        resumeFileName: hasNewFileName ? payload.resumeFileName : '',
        resumeBase64: hasNewBinary ? payload.resumeBase64 : '',
        resumeText: hasNewText ? payload.resumeText : '',
      },
      update: {
        name: payload.name || payload.fullName || 'Unnamed',
        email: payload.email || '',
        ...(hasNewFileName ? { resumeFileName: payload.resumeFileName } : {}),
        ...(hasNewBinary ? { resumeBase64: payload.resumeBase64 } : {}),
        ...(hasNewText ? { resumeText: payload.resumeText } : {}),
      },
    });

    return NextResponse.json({ success: true, profile: sanitizeProfile(profile) });
  } catch (err) {
    console.error('[Profile API] Error saving profile:', err);
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ profile: null });

    const profile = await prisma.careerProfile.findUnique({ where: { userId: user.id } });
    return NextResponse.json({ profile: sanitizeProfile(profile) });
  } catch (err) {
    console.error('[Profile API] Error fetching profile:', err);
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}
