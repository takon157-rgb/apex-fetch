import { NextRequest, NextResponse } from 'next/server';
import { getCareerProfile, updateReviewedJob } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, jobTitle, jobDescription } = body;
    if (!jobId || !jobDescription) return NextResponse.json({ success: false, error: 'Missing jobId or jobDescription' }, { status: 400 });

    const profile = getCareerProfile();
    if (!profile?.resumeText && !profile?.resumeBase64) {
      return NextResponse.json({ success: false, error: 'No resume found in profile. Upload a resume first.' }, { status: 400 });
    }

    const resumeText = profile.resumeText || '[Resume file uploaded - binary content]';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const prompt = `You are an elite resume tailoring expert. Your task is to rework and optimize a candidate's resume to perfectly match a specific job description.

ORIGINAL RESUME:
${resumeText}

TARGET JOB:
Title: ${jobTitle}
Description: ${jobDescription}

INSTRUCTIONS:
1. Analyze the job description deeply and identify key skills, qualifications, and experience required.
2. Rewrite the candidate's resume to maximize alignment with this specific job.
3. Use the candidate's real experience but rephrase and re-prioritize to highlight what matters most for this role.
4. Add relevant keywords from the job description naturally.
5. Keep the same factual experience - do not fabricate qualifications.
6. Format as a clean, professional resume with sections: Summary, Skills, Experience, Education.

Return ONLY the tailored resume text, no commentary.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    });

    const data = await response.json();
    const tailoredResume = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!tailoredResume) {
      return NextResponse.json({ success: false, error: 'AI returned empty response' }, { status: 500 });
    }

    updateReviewedJob(jobId, { tailoredResume });

    return NextResponse.json({ success: true, tailoredResume });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
