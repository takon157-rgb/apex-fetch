import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    const { jobId, jobTitle, jobDescription, mode } = body;
    if (!jobId || !jobDescription) {
      return NextResponse.json({ success: false, error: 'Missing jobId or jobDescription' }, { status: 400 });
    }

    const careerProfile = await prisma.careerProfile.findUnique({ where: { userId: user.id } });
    if (!careerProfile || (!careerProfile.resumeText && !careerProfile.resumeBase64)) {
      return NextResponse.json({ success: false, error: 'No resume found in profile. Upload a resume first.' }, { status: 400 });
    }

    const resumeText = careerProfile.resumeText || '[Resume file uploaded - binary content]';
    const profileName = careerProfile.name || '';
    const profileEmail = careerProfile.email || '';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ success: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 });

    const outputMode = mode || 'resume';

    function buildPrompt(): string {
      if (outputMode === 'both') {
        return `You are an elite career application assistant. Generate BOTH a tailored resume AND a cover letter.

ORIGINAL RESUME:
${resumeText}

TARGET JOB:
Title: ${jobTitle}
Description: ${jobDescription}

OUTPUT FORMAT:
=== RESUME ===
[tailored resume content]

=== COVER LETTER ===
[cover letter content]

INSTRUCTIONS:
1. Resume: Tailor to highlight experience and skills matching this job. Sections: Summary, Skills, Experience, Education.
2. Cover Letter: 3-4 paragraphs referencing relevant experience.
3. Use [Name], [Email], [Phone] as placeholders.
4. Keep factual - only real experience from the resume.`;
      }
      if (outputMode === 'cover-letter') {
        return `You are an expert cover letter writer. Write a tailored cover letter.

CANDIDATE: ${profileName} (${profileEmail})
RESUME:
${resumeText}

TARGET JOB:
Title: ${jobTitle}
Description: ${jobDescription}

INSTRUCTIONS:
1. Professional cover letter, 3-4 paragraphs.
2. Highlight relevant experience for this role.
3. Do NOT fabricate. Use placeholders [Name], [Email], [Phone].
Return ONLY the cover letter text.`;
      }
      return `You are an elite resume tailoring expert.

ORIGINAL RESUME:
${resumeText}

TARGET JOB:
Title: ${jobTitle}
Description: ${jobDescription}

INSTRUCTIONS:
1. Analyze job description deeply.
2. Rewrite resume to maximize alignment with this specific job.
3. Use real experience - rephrase and re-prioritize.
4. Add relevant keywords naturally. Do not fabricate.
5. Format: Summary, Skills, Experience, Education.
Return ONLY the tailored resume text.`;
    }

    const prompt = buildPrompt();
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 3072 },
      }),
    });

    const data = await response.json();
    const output = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!output) return NextResponse.json({ success: false, error: 'AI returned empty response' }, { status: 500 });

    if (outputMode === 'both') {
      const resumeMatch = output.match(/=== RESUME ===\n([\s\S]*?)(?:\n=== COVER LETTER ===|$)/);
      const letterMatch = output.match(/=== COVER LETTER ===\n([\s\S]*)/);
      const tailoredResume = resumeMatch?.[1]?.trim() || output;
      const coverLetter = letterMatch?.[1]?.trim() || '';

      await prisma.reviewedJob.updateMany({
        where: { userId: user.id, id: jobId },
        data: { tailoredResume, coverLetter },
      });

      return NextResponse.json({ success: true, tailoredResume, coverLetter });
    }

    if (outputMode === 'cover-letter') {
      await prisma.reviewedJob.updateMany({
        where: { userId: user.id, id: jobId },
        data: { coverLetter: output },
      });
      return NextResponse.json({ success: true, coverLetter: output });
    }

    await prisma.reviewedJob.updateMany({
      where: { userId: user.id, id: jobId },
      data: { tailoredResume: output },
    });
    return NextResponse.json({ success: true, tailoredResume: output });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
