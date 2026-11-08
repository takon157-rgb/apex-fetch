import { generateJson } from './llm';
import { VerificationResult, heuristicVerify } from './verify-core';

export { heuristicVerify };
export type { VerificationResult };

function buildVerifyPrompt(masterResume: string, draft: string): string {
  return `You are a strict fact-checker. Your job is to catch fabricated content in a job application.

MASTER RESUME (the ONLY source of truth):
${masterResume.slice(0, 6000)}

TAILORED DRAFT (what the candidate wants to send):
${draft.slice(0, 6000)}

Find every skill, employer, job title, date, metric, credential, or technology mentioned in the DRAFT that is NOT present in (or NOT reasonably supported by) the MASTER RESUME.

Return ONLY valid JSON matching exactly:
{
  "clean": boolean,
  "fabrications": ["list of the specific fabricated or unsupported claims"]
}

If everything in the draft is supported by the master resume, return "clean": true and an empty array. Be strict but fair: reworded versions of a real fact are NOT fabrication — only things that cannot be traced back to the master resume are.`;
}

export async function verifyNoFabrication(masterResume: string, draft: string): Promise<VerificationResult> {
  const fallback = heuristicVerify(masterResume, draft);
  try {
    const parsed = await generateJson<Record<string, unknown>>(buildVerifyPrompt(masterResume, draft), { temperature: 0, maxTokens: 1024 });
    if (parsed && typeof parsed.clean === 'boolean') {
      return {
        clean: parsed.clean === true,
        fabrications: Array.isArray(parsed.fabrications) ? parsed.fabrications.map(String) : fallback.fabrications,
      };
    }
  } catch (err) {
    console.error('[Verify] LLM verification failed, using heuristic:', err instanceof Error ? err.message : err);
  }
  return fallback;
}
