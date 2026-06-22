import { JobAnalysis } from './types';

/** Default model — gemini-1.5-flash was removed from the API (returns 404). */
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

type GeminiAnalysisPayload = Record<string, unknown> & {
  score?: number;
  summary?: string;
  profitability?: string;
  difficulty?: string;
  proposal?: string;
  isJob?: boolean;
  reason?: string;
};

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

const ANALYSIS_SYSTEM_INSTRUCTION = `You are an elite freelance opportunity analyst.

ABSOLUTE FIRST TASK — INTENT FILTRATION (Anti-Freelancer Shield):
Before scoring, determine if this posting is:
- BUYER/CLIENT (someone looking to PAY for work): e.g. "[Hiring]", "Looking for a video editor", "Need a VA", "We are seeking".
- SELLER/FREELANCER (someone selling their own services): e.g. "[For Hire]", "Hire me", "LFH", portfolio showcases, "Looking for work", "Available for hire".

If the post is a freelancer selling services (NOT a client job), you MUST:
- Set "score" to 0
- Set "isJob" to false
- Set summary to a brief note that this is not a client opportunity
- Set proposal to ""

If it IS a genuine client job, set "isJob" to true and score 1-10 based on clarity, legitimacy, budget health, and winnability.

OUTPUT RULES:
- Return ONLY valid JSON. No markdown, no code fences, no commentary.
- Match this schema exactly:
{
  "score": number,
  "summary": "string",
  "profitability": "High" | "Medium" | "Low",
  "difficulty": "High" | "Medium" | "Low",
  "proposal": "string",
  "isJob": boolean
}`;

export function parseGeminiJson<T extends Record<string, unknown>>(rawText: string): T | null {
  if (!rawText?.trim()) return null;

  let cleaned = rawText.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const tryParse = (text: string): T | null => {
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  };

  let parsed = tryParse(cleaned);
  if (parsed) return parsed;

  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    parsed = tryParse(objectMatch[0]);
    if (parsed) return parsed;
  }

  return null;
}

export function extractScoreFromRaw(rawText: string): number | null {
  const match = rawText.match(/"score"\s*:\s*(\d+(?:\.\d+)?)/i);
  return match ? Math.round(Number(match[1])) : null;
}

function normalizeProfitability(value: unknown): JobAnalysis['profitability'] {
  const v = String(value ?? 'Medium').toLowerCase();
  if (v.includes('high')) return 'High';
  if (v.includes('low')) return 'Low';
  return 'Medium';
}

function normalizeDifficulty(value: unknown): JobAnalysis['difficulty'] {
  const v = String(value ?? 'Medium').toLowerCase();
  if (v.includes('high')) return 'High';
  if (v.includes('low')) return 'Low';
  return 'Medium';
}

function buildAnalysisFromPayload(payload: GeminiAnalysisPayload, rawText: string): JobAnalysis {
  const explicitNotJob = payload.isJob === false;
  const rawScore = explicitNotJob
    ? 0
    : Math.round(Number(payload.score) || extractScoreFromRaw(rawText) || 5);
  const isJob = !explicitNotJob && rawScore > 0;
  const score = isJob ? Math.min(10, Math.max(1, rawScore)) : 0;

  return {
    score,
    summary: String(
      payload.summary ?? (isJob ? 'Client opportunity identified.' : 'Not a client hiring post.')
    ),
    profitability: normalizeProfitability(payload.profitability),
    difficulty: normalizeDifficulty(payload.difficulty),
    proposal: isJob ? String(payload.proposal ?? '') : '',
    isJob,
    reason: String(
      payload.reason ?? (isJob ? 'Qualified client posting.' : 'Freelancer self-promotion filtered.')
    ),
  };
}

function heuristicAnalysis(title: string, description: string): JobAnalysis {
  const text = `${title} ${description}`.toLowerCase();
  const freelancerSignals = ['[for hire]', 'for hire', 'hire me', 'looking for work', 'lfh', 'my portfolio'];
  const hiringSignals = ['[hiring]', 'hiring', 'looking for a', 'looking for an', 'need a', 'we need'];

  const isFreelancer = freelancerSignals.some((s) => text.includes(s));
  const isHiring = hiringSignals.some((s) => text.includes(s));

  if (isFreelancer && !isHiring) {
    return {
      score: 0,
      summary: 'Heuristic filter: freelancer self-promotion detected.',
      profitability: 'Low',
      difficulty: 'Low',
      proposal: '',
      isJob: false,
      reason: 'Gemini unavailable — local intent filter applied.',
    };
  }

  return {
    score: isHiring ? 7 : 6,
    summary: 'Heuristic analysis (Gemini API unavailable).',
    profitability: 'Medium',
    difficulty: 'Medium',
    proposal: `Hi — I saw your post about "${title}" and would love to help. Happy to share relevant work samples and next steps.`,
    isJob: true,
    reason: 'Gemini API unavailable — fallback scoring used.',
  };
}

async function callGemini(prompt: string, apiKey: string): Promise<{ rawText: string; error?: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  });

  const data = (await response.json()) as GeminiApiResponse;

  if (!response.ok || data.error) {
    const message = data.error?.message || `HTTP ${response.status}`;
    return { rawText: '', error: message };
  }

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!rawText) {
    return { rawText: '', error: 'Gemini returned an empty response (possible safety block).' };
  }

  return { rawText };
}

export async function analyzeOpportunity(
  title: string,
  description: string,
  budget: string
): Promise<JobAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      score: 6,
      summary: '[Demo Mode] Set GEMINI_API_KEY in .env.local at the project root.',
      profitability: 'Medium',
      difficulty: 'Medium',
      proposal: '[Demo Mode] Add your Gemini API key to generate outreach drafts.',
      isJob: true,
      reason: 'Missing GEMINI_API_KEY.',
    };
  }

  const userPrompt = `${ANALYSIS_SYSTEM_INSTRUCTION}

Evaluate this posting:
Title: ${title}
Description: ${description}
Budget/Pay: ${budget}`;

  try {
    const { rawText, error } = await callGemini(userPrompt, apiKey);

    if (error) {
      console.error(`[Gemini] ${GEMINI_MODEL} error:`, error);
      return heuristicAnalysis(title, description);
    }

    const parsed = parseGeminiJson<GeminiAnalysisPayload>(rawText);
    if (parsed) {
      return buildAnalysisFromPayload(parsed, rawText);
    }

    const fallbackScore = extractScoreFromRaw(rawText);
    if (fallbackScore !== null) {
      return buildAnalysisFromPayload(
        {
          score: fallbackScore,
          summary: 'Parsed from partial AI response.',
          profitability: 'Medium',
          difficulty: 'Medium',
          proposal: '',
          isJob: fallbackScore > 0,
        },
        rawText
      );
    }

    console.error('[Gemini] Could not parse response:', rawText.slice(0, 300));
    return heuristicAnalysis(title, description);
  } catch (error) {
    console.error('[Gemini] Request failed:', error);
    return heuristicAnalysis(title, description);
  }
}
