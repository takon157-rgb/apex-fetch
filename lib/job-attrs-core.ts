// Canonical job attributes.
//
// Job boards are wildly inconsistent: the same employment type arrives as
// "FullTime", "Full Time", "Full-time", "Unbefristeter arbeitsvertrag" (German)
// or "CDI" (French). The dashboard used to compare these with an exact string
// match against a fixed dropdown, so "Part-time" matched 3 of 900+ jobs.
//
// These helpers collapse every variant onto one small vocabulary, and infer a
// value when the source didn't provide one. Dependency-free so it can be unit
// tested with `node --test`.

export const JOB_TYPES = [
  'full-time',
  'part-time',
  'contract',
  'internship',
  'freelance',
] as const;

export type CanonicalJobType = (typeof JOB_TYPES)[number];

/** Collapse punctuation/case so "Full-Time", "full time" and "FullTime" match. */
function squish(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9äöüßéèêàçñ]+/gi, '');
}

// These patterns must tolerate separators, because boards write "on-site",
// "on site" and "on_site" interchangeably. Stripping separators before the
// test was destroying the word boundary and silently failing to match.
const REMOTE_RE = /\b(remote|anywhere|worldwide|wfh|work\s*from\s*home|home\s*office|home\s*based|teletravail|ortsunabhangig|distributed)\b/i;
const ONSITE_RE = /\b(on\s*site|in\s*office|in\s*offices|on\s*prem)\b/i;

/**
 * Map any employment-type string onto the canonical vocabulary.
 * Returns null when the value carries no recognisable type.
 */
export function canonicalJobType(explicit?: string | null): CanonicalJobType | null {
  if (!explicit) return null;
  const s = squish(explicit);
  if (!s) return null;

  // Freelance / independent contracting. Checked first because labels like
  // "Permanent contract & B2B" should land on freelance, not full-time.
  if (/freelanc|freiberuf|freeliberuf|selbstandig|travailleurindependant|contractor|independent|b2b|selfemployed|autonomo|autonoma/.test(s)) {
    return 'freelance';
  }
  if (/intern|praktikum|werkstudent|trainee|studentschool|studentcollege|co-op|coop|stage|stagiaire|becario/.test(s)) {
    return 'internship';
  }
  if (/parttime|partzeit|halftime|teilzeit|tempspartiel|mediotiempo/.test(s)) {
    return 'part-time';
  }
  // Indefinite / permanent roles are full-time employment. Checked before the
  // generic "contract" branch so "unbefristeter arbeitsvertrag" isn't a contract.
  if (/unbefristet|indefinite|permanent|vollzeit|fulltime|cdi|dureeindeterminee|staff/.test(s)) {
    return 'full-time';
  }
  if (/befristet|fixedterm|contract|temporary|tempjob|zeitvertrag/.test(s)) {
    return 'contract';
  }
  // Generic permanent-employee labels that carry no explicit type word.
  if (/employee|experienced|professional|executive|^mid$|^entry$/.test(s)) {
    return 'full-time';
  }
  return null;
}

/**
 * Determine a job's employment type, falling back to the posting text when
 * the source didn't label it.
 */
export function resolveJobType(
  explicit?: string | null,
  title?: string | null,
  description?: string | null,
): CanonicalJobType | null {
  const direct = canonicalJobType(explicit);
  if (direct) return direct;

  // Infer from the title first — it's the strongest signal.
  const t = squish(title || '');
  if (t) {
    if (/parttime|partzeit|tempspartiel|mediotiempo/.test(t)) return 'part-time';
    if (/intern|praktikum|werkstudent|trainee|becario|stagiaire/.test(t)) return 'internship';
    if (/freelanc|contractor|independent|b2b|autonomo|freelance/.test(t)) return 'freelance';
    if (/contract|temporary|fixedterm|befristet/.test(t)) return 'contract';
    if (/fulltime|vollzeit|tempsplein|tiempocompleto/.test(t)) return 'full-time';
  }

  // Then the description. Only unambiguous phrases count — "contract" alone
  // is too common in legal boilerplate to trust.
  const d = (description || '').toLowerCase();
  if (/\bpart[- ]?time\b|\bteilzeit\b|\btemps partiel\b|\bmedio tiempo\b|\bjobberufung im bereich teilzeit\b/.test(d)) {
    return 'part-time';
  }
  if (/\binternship\b|\bintern position\b|\bpraktikum\b|\bwerkstudent\b|\bbecario\b|\bstagiaire\b/.test(d)) {
    return 'internship';
  }
  if (/\bfreelance\b|\bcontract work\b|\bself[- ]employed\b|\baut[oô]nom[eo]?\b|\bfreiberufler\b|\bcontractor role\b/.test(d)) {
    return 'freelance';
  }
  // Permanent full-time beats a passing mention of "contract".
  if (/\bfull[- ]?time\b|\bfulltime\b|\bvollzeit\b|\btemps plein\b|\btiempo completo\b|\bfestanstellung\b|\bpermanent (employment|contract|position|role)\b|\bunbefristet\w*\b|\b40 ?h(ours|rs)? (a|per) (week|day)\b|\b40 hours (a|per) week\b/.test(d)) {
    return 'full-time';
  }
  if (/\bfixed[- ]?term\b|\bbefristet\w*\b|\btemporary (contract|role|position)\b|\bcontract (role|position|job)\b|\btime[- ]limited\b/.test(d)) {
    return 'contract';
  }
  return null;
}

/**
 * Determine whether a job is remote.
 *
 * Location is the most trustworthy signal, then the title, and only then the
 * description (where "remote" often appears in a benefits list for jobs that
 * are actually on-site). Returns null when there's genuinely no signal, so
 * "Remote only" can distinguish "remote" from "unknown".
 */
export function resolveRemote(
  title?: string | null,
  location?: string | null,
  description?: string | null,
): boolean | null {
  const loc = (location || '').toLowerCase().trim();
  const titleText = (title || '').toLowerCase();
  const desc = (description || '').toLowerCase();

  // Normalise separators to spaces rather than deleting them: "on-site" has to
  // stay two words or the word boundary in ONSITE_RE never matches.
  const locNorm = loc.replace(/[-_/]/g, ' ');
  const titleNorm = titleText.replace(/[-_/]/g, ' ');

  // Explicitly on-site in the location beats everything else.
  if (locNorm && ONSITE_RE.test(locNorm)) return false;
  if (locNorm && /\bhybrid\b/.test(locNorm)) return true;

  // Location says remote.
  if (locNorm && REMOTE_RE.test(locNorm)) return true;

  // Title says remote.
  if (REMOTE_RE.test(titleNorm)) return true;

  // A concrete place in the location means you're expected to be there.
  if (loc && loc.length > 2 && !/^(n\/?a|unspecified|unknown|no location|worldwide|anywhere|global|international)$/i.test(loc)) {
    return false;
  }

  // Last resort: the description. Only strong phrases count.
  if (/\b(fully remote|100% remote|remote[- ]first|remote position|remote role|work from home|distributed team|anywhere in the world)\b/.test(desc)) {
    return true;
  }
  if (/\b(on[- ]site role|in office|onsite only|relocation required)\b/.test(desc)) {
    return false;
  }

  return null;
}
