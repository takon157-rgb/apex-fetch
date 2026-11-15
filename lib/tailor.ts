import { generateJson } from './llm';
import { verifyNoFabrication } from './verify';

export interface MasterResume {
  name?: string;
  summary?: string | null;
  skills: string[];
  roles: string[];
  /** Full parsed resume is the factual source for tailoring when available. */
  resumeText?: string | null;
}

export interface TailorResult {
  tailoredResume: string;
  coverEmail: string;
  clean: boolean;
  flags: string[];
}

export function composeMasterResume(master: MasterResume): string {
  const fullText = master.resumeText?.trim();
  if (fullText) return fullText.slice(0, 18000);
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
You may ONLY reorder, reword, and emphasize facts already present in the master resume. You must NEVER invent a skill, employer, job title, date, metric, credential, or technology. If the master resume does not support a claim, omit it.

For the resume, preserve the candidate's real experience, achievements, dates, employers, education, and certifications. Prioritize relevant information and use clear sections: Summary, Skills, Experience, Education.
For the cover email: 3-4 short sentences, personalized with the company name (${job.company || 'the team'}) and the role title (${job.title}), closing with a call to review the attached resume.

Return ONLY valid JSON matching exactly:
{
  "resume": "the tailored resume text",
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
  } catch (error) {
    console.error('[Tailor] draft failed:', error instanceof Error ? error.message : error);
  }

  if (!tailoredResume && !coverEmail) {
    return { tailoredResume: '', coverEmail: '', clean: false, flags: ['Tailoring failed — LLM returned no content.'] };
  }

  const masterText = composeMasterResume(master);
  const verification = await verifyNoFabrication(masterText, `${tailoredResume}\n${coverEmail}`);
  return { tailoredResume, coverEmail, clean: verification.clean, flags: verification.fabrications };
}
