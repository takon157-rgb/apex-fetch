import { generateJson } from './llm';
import { verifyNoFabrication } from './verify';

export interface MasterResume {
  name?: string;
  summary?: string | null;
  skills: string[];
  roles: string[];
}

export interface TailorResult {
  tailoredResume: string;
  coverEmail: string;
  clean: boolean;
  flags: string[];
}

export function composeMasterResume(master: MasterResume): string {
  return [
    `Name: ${master.name || 'Candidate'}`,
    `Summary: ${master.summary || 'N/A'}`,
    `Target roles: ${master.roles.join(', ') || 'N/A'}`,
    `Skills: ${master.skills.join(', ') || 'N/A'}`,
  ].join('\n');
}

function buildDraftPrompt(master: MasterResume, job: { title: string; company?: string; description: string }): string {
  return `You are an expert job-application writer. Produce a tailored resume and a short cover email for one job.

MASTER RESUME (the ONLY source of truth):
${composeMasterResume(master)}

TARGET JOB:
Title: ${job.title}
Company: ${job.company || 'Unknown'}
Description: ${job.description.slice(0, 3000)}

HARD RULE — NO FABRICATION:
You may ONLY reorder, reword, and emphasize facts already present in the master resume. You must NEVER invent a skill, employer, job title, date, metric, credential, or technology. If the master resume does not contain something, you cannot add it.

For the cover email: 3-4 short sentences, personalized with the company name (${job.company || 'the team'}) and the role title (${job.title}), closing with a call to review the attached resume.

Return ONLY valid JSON matching exactly:
{
  "resume": "the tailored resume text (Summary, Skills, Experience, Education)",
  "email": "the cover email text"
}`;
}

export async function tailorApplication(
  master: MasterResume,
  job: { title: string; company?: string; description: string },
): Promise<TailorResult> {
  let tailoredResume = '';
  let coverEmail = '';

  try {
    const draft = await generateJson<{ resume?: string; email?: string }>(buildDraftPrompt(master, job), { temperature: 0.6, maxTokens: 3072 });
    if (draft && (draft.resume || draft.email)) {
      tailoredResume = draft.resume || '';
      coverEmail = draft.email || '';
    }
  } catch (err) {
    console.error('[Tailor] draft failed:', err instanceof Error ? err.message : err);
  }

  if (!tailoredResume && !coverEmail) {
    return { tailoredResume: '', coverEmail: '', clean: false, flags: ['Tailoring failed — LLM returned no content.'] };
  }

  const masterText = composeMasterResume(master);
  const verification = await verifyNoFabrication(masterText, `${tailoredResume}\n${coverEmail}`);

  return {
    tailoredResume,
    coverEmail,
    clean: verification.clean,
    flags: verification.fabrications,
  };
}
