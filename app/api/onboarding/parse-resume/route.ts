import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { uploadResume } from '@/lib/supabase-storage';
import { parseResumePdf, validatePdfBytes } from '@/lib/resume-parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function jsonArrayField(value: FormDataEntryValue | null, label: string): string[] | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
      throw new Error();
    }
    return parsed.map((item) => item.trim()).filter(Boolean).slice(0, 20);
  } catch {
    throw new Error(`Invalid ${label} value.`);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get('resume');
    const base64Data = formData.get('resumeBase64');
    const fileName = formData.get('fileName');
    const selectedRoles = jsonArrayField(formData.get('targetRoles'), 'targetRoles');

    let bytes: Buffer;
    let originalName = typeof fileName === 'string' && fileName.trim() ? fileName.trim() : 'resume.pdf';
    if (file instanceof File) {
      originalName = file.name || originalName;
      if (!originalName.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Please upload a PDF resume.' }, { status: 400 });
      }
      bytes = Buffer.from(await file.arrayBuffer());
    } else if (typeof base64Data === 'string' && base64Data.trim()) {
      const encoded = base64Data.replace(/^data:application\/pdf;base64,/i, '').trim();
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
        return NextResponse.json({ error: 'The resume upload is not valid base64 PDF data.' }, { status: 400 });
      }
      bytes = Buffer.from(encoded, 'base64');
    } else {
      return NextResponse.json({ error: 'No resume file provided.' }, { status: 400 });
    }

    const invalidPdf = validatePdfBytes(bytes);
    if (invalidPdf) return NextResponse.json({ error: invalidPdf }, { status: 400 });

    const pdfBase64 = bytes.toString('base64');
    const parsed = await parseResumePdf(pdfBase64);
    const finalRoles = selectedRoles?.length ? selectedRoles : parsed.targetRoles;

    await prisma.userPreference.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        targetRoles: finalRoles,
        coreSkills: parsed.coreSkills,
        parsedResumeSummary: parsed.summary,
        setupComplete: true,
      },
      update: {
        targetRoles: finalRoles,
        coreSkills: parsed.coreSkills,
        parsedResumeSummary: parsed.summary,
        setupComplete: true,
      },
    });

    await prisma.careerProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        name: user.name || '',
        email: user.email || '',
        resumeFileName: originalName,
        resumeBase64: pdfBase64,
        resumeText: parsed.resumeText,
      },
      update: {
        resumeFileName: originalName,
        resumeBase64: pdfBase64,
        resumeText: parsed.resumeText,
      },
    });

    try {
      await uploadResume(user.id, bytes, 'application/pdf');
    } catch (error) {
      console.warn('[Resume parser] Optional storage upload failed:', error);
    }

    return NextResponse.json({
      success: true,
      preferences: {
        targetRoles: finalRoles,
        coreSkills: parsed.coreSkills,
        parsedResumeSummary: parsed.summary,
        setupComplete: true,
      },
    });
  } catch (error) {
    console.error('[Resume parser] Failed:', error);
    const message = error instanceof Error ? error.message : 'Resume parsing failed. Please try again.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
