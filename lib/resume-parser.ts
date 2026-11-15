export interface ParsedResume {
  targetRoles: string[];
  coreSkills: string[];
  summary: string;
  /** Full, faithful, normalized resume text used as the source for tailoring. */
  resumeText: string;
}

const RESUME_PROMPT = `You are a careful resume parser. Read the attached PDF and extract only facts explicitly present in it. Do not invent, infer credentials, or add skills that are not stated.
Return ONLY JSON with this schema:
{
  "targetRoles": ["2-5 relevant role names"],
  "coreSkills": ["5-15 specific skills explicitly in the resume"],
  "summary": "A concise 2-3 sentence professional summary grounded in the resume",
  "resumeText": "The complete readable resume content, preserving names, dates, employers, titles, achievements, education, certifications, and contact details. Normalize layout to clear text with section headings and bullets. Do not omit material or add information."
}
If a field is unavailable, return an empty string or empty array. Ensure resumeText is a faithful transcription/normalization, not a summary.`;

function cleanStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export async function parseResumePdf(pdfBase64: string): Promise<ParsedResume> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('Resume parsing is not configured (missing GEMINI_API_KEY).');

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(50_000),
    body: JSON.stringify({
      contents: [{ parts: [{ inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }, { text: RESUME_PROMPT }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: 'application/json' },
    }),
  });

  const data = await response.json().catch(() => ({} as any));
  if (!response.ok || data?.error) {
    throw new Error(`Resume AI parsing failed: ${data?.error?.message || `HTTP ${response.status}`}`);
  }
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim();
  if (!rawText) throw new Error('Resume parser returned an empty result. Please try a text-based PDF.');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Resume parser returned invalid structured data. Please try again.');
    try {
      parsed = JSON.parse(rawText.slice(start, end + 1));
    } catch {
      throw new Error('Resume parser returned invalid structured data. Please try again.');
    }
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const resumeText = typeof parsed.resumeText === 'string' ? parsed.resumeText.trim() : '';
  if (!resumeText || resumeText.length < 40) {
    throw new Error('We could not read enough text from this PDF. Try a text-based PDF or paste your resume text instead.');
  }
  return {
    targetRoles: cleanStringArray(parsed.targetRoles, 10),
    coreSkills: cleanStringArray(parsed.coreSkills, 30),
    summary: summary || resumeText.slice(0, 1000),
    resumeText,
  };
}

export function validatePdfBytes(bytes: Buffer): string | null {
  if (bytes.length === 0) return 'The uploaded file is empty.';
  if (bytes.length > 4 * 1024 * 1024) return 'Resume PDF must be 4 MB or smaller. Please compress it or use a text-based PDF.';
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') return 'The uploaded file is not a valid PDF. Please upload a PDF resume.';
  return null;
}
