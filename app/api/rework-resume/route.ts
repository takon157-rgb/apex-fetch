import { NextRequest, NextResponse } from 'next/server';
import { getCareerProfile, updateReviewedJob } from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, jobTitle, jobDescription, mode } = body;
    if (!jobId || !jobDescription) {
      return NextResponse.json({ success: false, error: 'Missing jobId or jobDescription' }, { status: 400 });
    }

    const profile = getCareerProfile();
    if (!profile) {
      return NextResponse.json({ success: false, error: 'No career profile found. Create one first.' }, { status: 400 });
    }
    if (!profile.resumeText && !profile.resumeBase64) {
      return NextResponse.json({ success: false, error: 'No resume found in profile. Upload a resume first.' }, { status: 400 });
    }

    const resumeText = profile.resumeText || '[Resume file uploaded - binary content]';
    const profileName = profile.name || '';
    const profileEmail = profile.email || '';

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const outputMode = mode || 'resume';

    function buildPrompt(): string {
      if (outputMode === 'both') {
        return `You are an elite career application assistant. Generate BOTH a tailored resume AND a cover letter for a job application.

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
1. Resume: Tailor the candidate's resume to highlight experience and skills matching this job. Use sections: Summary, Skills, Experience, Education. Do not fabricate.
2. Cover Letter: Write a 3-4 paragraph professional cover letter referencing the candidate's relevant experience.
3. Use [Name], [Email], [Phone] as placeholders in the cover letter.
4. Keep factual - only use real experience from the resume.`;
      }

      if (outputMode === 'cover-letter') {
        return `You are an expert cover letter writer. Write a compelling, tailored cover letter for a job application.

CANDIDATE PROFILE:
${profileName ? `Name: ${profileName}` : ''}
${profileEmail ? `Email: ${profileEmail}` : ''}

RESUME:
${resumeText}

TARGET JOB:
Title: ${jobTitle}
Description: ${jobDescription}

INSTRUCTIONS:
1. Write a professional cover letter that highlights the candidate's relevant experience for this specific role.
2. Reference specific skills and achievements from the resume that match the job requirements.
3. Keep it concise (3-4 paragraphs), professional, and enthusiastic.
4. Do NOT fabricate experience or qualifications.
5. Use placeholders [Name], [Email], [Phone] for contact details.
6. Format with proper paragraph breaks.

Return ONLY the cover letter text, no commentary.`;
      }

      return `You are an elite resume tailoring expert. Rework a candidate's resume to match a specific job description.

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

    if (!output) {
      return NextResponse.json({ success: false, error: 'AI returned empty response' }, { status: 500 });
    }

    if (outputMode === 'both') {
      const resumeMatch = output.match(/=== RESUME ===\n([\s\S]*?)(?:\n=== COVER LETTER ===|$)/);
      const letterMatch = output.match(/=== COVER LETTER ===\n([\s\S]*)/);
      const tailoredResume = resumeMatch?.[1]?.trim() || output;
      const coverLetter = letterMatch?.[1]?.trim() || '';

      updateReviewedJob(jobId, { tailoredResume, coverLetter });

      return NextResponse.json({ success: true, tailoredResume, coverLetter });
    }

    if (outputMode === 'cover-letter') {
      updateReviewedJob(jobId, { coverLetter: output });
      return NextResponse.json({ success: true, coverLetter: output });
    }

    updateReviewedJob(jobId, { tailoredResume: output });
    return NextResponse.json({ success: true, tailoredResume: output });
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
