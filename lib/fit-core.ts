// Pure resume-fit scoring. No I/O, no LLM, no imports — so it can be unit
// tested with `node --test` and reused by the API's ranking path without
// pulling the LLM SDK into the bundle.

export interface ResumeProfile {
  summary: string;
  skills: string[];
  roles: string[];
}

export interface JobText {
  title: string;
  description: string;
}

export interface FitResult {
  score: number; // 0-100
  matched: string[];
  missing: string[];
  reason: string;
}

const STOP_WORDS = new Set([
  'with', 'and', 'for', 'the', 'from', 'that', 'this', 'have', 'more', 'than',
  'your', 'our', 'you', 'are', 'will', 'been', 'they', 'their', 'about', 'into',
  'over', 'work', 'years', 'year', 'using', 'have', 'also', 'who', 'but', 'not',
  'can', 'all', 'any', 'her', 'his', 'she', 'him', 'was', 'were', 'been', 'has',
]);

// Summary tokens depend only on the resume, but the ranking path calls this
// once per candidate job. Caching them avoids re-splitting the resume text
// hundreds of times per request.
const summaryTokenCache = new Map<string, Set<string>>();

function getSummaryTokens(summary: string): Set<string> {
  const key = summary || '';
  const cached = summaryTokenCache.get(key);
  if (cached) return cached;
  const tokens = new Set(
    key
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter(t => t.length > 3 && !STOP_WORDS.has(t)),
  );
  // Bound the cache so a long-lived server can't grow it without limit.
  if (summaryTokenCache.size > 50) summaryTokenCache.clear();
  summaryTokenCache.set(key, tokens);
  return tokens;
}

// Only the first part of a description is scored. Required skills are almost
// always named near the top, and this keeps the ranking path fast enough to
// score hundreds of candidates per request.
const SCAN_CHARS = 1800;

export function heuristicFit(resume: ResumeProfile, job: JobText): FitResult {
  const title = (job.title || '').toLowerCase();
  const description = (job.description || '').slice(0, SCAN_CHARS);
  const text = `${job.title || ''} ${description}`.toLowerCase();

  const matched: string[] = [];
  const missing: string[] = [];
  for (const skill of resume.skills) {
    const s = (skill || '').toLowerCase().trim();
    if (!s) continue;
    if (text.includes(s)) matched.push(skill);
    else missing.push(skill);
  }

  // A role match in the title is a much stronger signal than one buried in the body.
  const titleRoleMatch = resume.roles.some(r => {
    const rt = (r || '').toLowerCase().trim();
    return rt.length > 1 && title.includes(rt);
  });
  const anyRoleMatch = titleRoleMatch || resume.roles.some(r => {
    const rt = (r || '').toLowerCase().trim();
    return rt.length > 1 && text.includes(rt);
  });

  const coverage = resume.skills.length > 0 ? matched.length / resume.skills.length : 0;

  // Keyword overlap with the resume summary — catches relevant experience that
  // isn't in the explicit skills list.
  const summaryTokens = getSummaryTokens(resume.summary || '');
  let overlap = 0;
  for (const t of summaryTokens) if (text.includes(t)) overlap++;
  const summaryScore = summaryTokens.size > 0 ? Math.min(1, overlap / Math.min(12, summaryTokens.size)) : 0;

  let score = Math.round(coverage * 55 + summaryScore * 25 + (anyRoleMatch ? 15 : 0) + (titleRoleMatch ? 5 : 0));
  score = Math.min(100, Math.max(0, score));

  const reasonParts: string[] = [];
  if (resume.skills.length > 0) reasonParts.push(`${matched.length}/${resume.skills.length} skills match`);
  if (titleRoleMatch) reasonParts.push('target role in title');
  else if (anyRoleMatch) reasonParts.push('target role matched');
  if (summaryScore > 0.2) reasonParts.push('strong resume overlap');
  const reason = reasonParts.length ? reasonParts.join(' · ') + '.' : 'No resume overlap detected.';
  return { score, matched, missing, reason };
}
