import { generateJson } from './llm';
import { ResumeProfile, JobText, FitResult, heuristicFit } from './fit-core';

export { heuristicFit };
export type { ResumeProfile, JobText, FitResult };

function normalizeFit(parsed: Record<string, unknown>, fallback: FitResult): FitResult {
  const score = Math.round(Number(parsed.score));
  const matched = Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills.map(String) : fallback.matched;
  const missing = Array.isArray(parsed.missingSkills) ? parsed.missingSkills.map(String) : fallback.missing;
  const reason = typeof parsed.reason === 'string' ? parsed.reason : fallback.reason;
  return {
    score: Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : fallback.score,
    matched,
    missing,
    reason,
  };
}

function buildFitPrompt(resume: ResumeProfile, job: JobText): string {
  return `You are a hiring-fit evaluator. Compare the candidate's profile to the job and return STRICT JSON.

CANDIDATE:
Summary: ${resume.summary || 'N/A'}
Target roles: ${resume.roles.join(', ') || 'N/A'}
Skills: ${resume.skills.join(', ') || 'N/A'}

JOB:
Title: ${job.title}
Description: ${job.description.slice(0, 2500)}

Return ONLY valid JSON matching exactly:
{
  "score": number (0-100, higher = better fit),
  "matchedSkills": ["skills the candidate has AND the job wants"],
  "missingSkills": ["skills the job wants that the candidate does NOT have"],
  "reason": "1-2 sentence plain-English explanation of the score"
}

Rules: do not invent skills. Score honestly — a weak match is a low score.`;
}

export async function scoreJobFit(resume: ResumeProfile, job: JobText): Promise<FitResult> {
  const fallback = heuristicFit(resume, job);
  try {
    const parsed = await generateJson<Record<string, unknown>>(buildFitPrompt(resume, job), { temperature: 0.2, maxTokens: 1024 });
    if (parsed && parsed.score !== undefined) return normalizeFit(parsed, fallback);
  } catch (err) {
    console.error('[Fit] LLM scoring failed, using heuristic:', err instanceof Error ? err.message : err);
  }
  return fallback;
}
