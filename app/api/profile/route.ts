import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { parseResumePdf, validatePdfBytes } from '@/lib/resume-parser';

export const dynamic = 'force-dynamic';

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

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'Invalid profile payload.' }, { status: 400 });

    const hasNewBinary = typeof payload.resumeBase64 === 'string' && payload.resumeBase64.length > 0;
    const hasNewText = typeof payload.resumeText === 'string';
    const hasNewFileName = typeof payload.resumeFileName === 'string' && payload.resumeFileName.length > 0;

    let encoded = '';
    let parsed: Awaited<ReturnType<typeof parseResumePdf>> | null = null;
    if (hasNewBinary) {
      encoded = payload.resumeBase64.replace(/^data:application\/pdf;base64,/i, '').trim();
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
        return NextResponse.json({ error: 'The resume upload is not valid base64 PDF data.' }, { status: 400 });
      }
      const bytes = Buffer.from(encoded, 'base64');
      const invalidPdf = validatePdfBytes(bytes);
      if (invalidPdf) return NextResponse.json({ error: invalidPdf }, { status: 400 });
      encoded = bytes.toString('base64');
      parsed = await parseResumePdf(encoded);
    }

    const profile = await prisma.careerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: payload.name || payload.fullName || 'Unnamed',
        email: payload.email || '',
        resumeFileName: hasNewFileName ? payload.resumeFileName : '',
        resumeBase64: hasNewBinary ? encoded : '',
        resumeText: hasNewText ? payload.resumeText : parsed?.resumeText || '',
      },
      update: {
        name: payload.name || payload.fullName || 'Unnamed',
        email: payload.email || '',
        ...(hasNewFileName ? { resumeFileName: payload.resumeFileName } : {}),
        ...(hasNewBinary ? { resumeBase64: encoded } : {}),
        ...(hasNewText ? { resumeText: payload.resumeText } : parsed ? { resumeText: parsed.resumeText } : {}),
      },
    });

    if (parsed) {
      await prisma.userPreference.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          targetRoles: parsed.targetRoles,
          coreSkills: parsed.coreSkills,
          parsedResumeSummary: parsed.summary,
          setupComplete: true,
        },
        update: {
          targetRoles: parsed.targetRoles,
          coreSkills: parsed.coreSkills,
          parsedResumeSummary: parsed.summary,
          setupComplete: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      profile: sanitizeProfile(profile),
      ...(parsed ? { parsed: { targetRoles: parsed.targetRoles, coreSkills: parsed.coreSkills, parsedResumeSummary: parsed.summary } } : {}),
    });
  } catch (error) {
    console.error('[Profile API] Error saving profile:', error);
    const message = error instanceof Error ? error.message : 'Could not save your profile.';
    return NextResponse.json({ error: message }, { status: 500 });
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
  } catch (error) {
    console.error('[Profile API] Error fetching profile:', error);
    const message = error instanceof Error ? error.message : 'Could not fetch your profile.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
