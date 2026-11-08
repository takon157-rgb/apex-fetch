// Pure no-fabrication heuristics. No I/O and no imports so it is unit testable
// with `node --test` and safe to call from request paths.

export interface VerificationResult {
  clean: boolean;
  fabrications: string[];
}

const SKIP_WORDS = /^(the|a|an|i|we|our|my|to|in|on|for|and|of|at|with|this|that|summary|skills|experience|education|projects|about|contact|hello|dear|thank|best|regards|sincerely|hi|hey)$/i;

// Words that are routinely capitalised only because they start a sentence.
// Flagging these would make the heuristic reject perfectly honest drafts.
const COMMON_WORDS = new Set([
  'built', 'worked', 'developed', 'designed', 'managed', 'led', 'created', 'implemented',
  'improved', 'delivered', 'maintained', 'collaborated', 'communicated', 'organized',
  'organised', 'coordinated', 'analyzed', 'analysed', 'researched', 'presented',
  'achieved', 'reduced', 'increased', 'responsible', 'experienced', 'proficient',
  'skilled', 'familiar', 'working', 'looking', 'seeking', 'applying', 'currently',
  'recently', 'previously', 'expert', 'specialist', 'professional', 'engineer',
  'developer', 'designer', 'manager', 'specialist', 'available', 'able', 'strong',
  'solid', 'proven', 'hands-on', 'results-driven', 'detail-oriented', 'self-starter',
  'team-player', 'quick', 'fast', 'good', 'great', 'excellent', 'new', 'one', 'two',
  'three', 'first', 'second', 'next', 'also', 'then', 'after', 'before', 'during',
  'while', 'when', 'where', 'what', 'which', 'who', 'why', 'how', 'why', 'because',
]);

function isCommonWord(phrase: string): boolean {
  if (!phrase.includes(' ')) return COMMON_WORDS.has(phrase.toLowerCase());
  return false;
}

export function heuristicVerify(masterResume: string, draft: string): VerificationResult {
  const master = (masterResume || '').toLowerCase();
  const fabrications: string[] = [];

  // Extract capitalized phrases (likely proper nouns: skills, companies, credentials).
  // Only SPACES join phrases — a newline must break the phrase, otherwise
  // "SUMMARY\nSKILLS" is captured as one bogus proper noun.
  const properNouns = (draft || '').match(/\b[A-Z][a-zA-Z0-9+#./-]{1,}(?: [A-Z][a-zA-Z0-9+#./-]{1,})*/g) || [];
  const seen = new Set<string>();
  for (const raw of properNouns) {
    const phrase = raw.replace(/[.\s]+$/, '').trim();
    if (!phrase) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (SKIP_WORDS.test(phrase)) continue;
    if (isCommonWord(phrase)) continue;
    if (!master.includes(key)) fabrications.push(phrase);
  }

  return { clean: fabrications.length === 0, fabrications: fabrications.slice(0, 20) };
}
