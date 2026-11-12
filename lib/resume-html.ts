/**
 * Renders a tailored resume (plain text) into a print-ready HTML document.
 *
 * The tailored resume is generated as plain text, but a candidate needs to
 * read it as a document and export it as a PDF or Word file before it goes to
 * a recruiter. This module turns the text into a single-column, ATS-friendly
 * page. It is deliberately pure so it can be unit tested without a browser.
 *
 * Everything the model produced is escaped - no part of the resume is ever
 * treated as markup.
 */

export interface ResumeTemplate {
  id: string;
  label: string;
  description: string;
  /** CSS font stack for the body text. */
  font: string;
  /** CSS font stack for headings. */
  headingFont: string;
  /** Base body font size. */
  fontSize: string;
  /** Vertical rhythm multiplier - compact fits more on a page. */
  density: number;
  /** Accent colour used for rules and the name. */
  accent: string;
  /** Centre the header block (classic style) instead of left-aligning it. */
  centeredHeader: boolean;
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: 'ats',
    label: 'ATS Safe',
    description: 'Plain single column, no colour. Safest for applicant tracking systems.',
    font: 'Arial, Helvetica, sans-serif',
    headingFont: 'Arial, Helvetica, sans-serif',
    fontSize: '10.5pt',
    density: 1,
    accent: '#111111',
    centeredHeader: false,
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Clean sans-serif with a coloured rule. Good for tech roles.',
    font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    headingFont: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontSize: '10.5pt',
    density: 1.05,
    accent: '#1e3a8a',
    centeredHeader: false,
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Serif headings, centred header. Reads well for senior and office roles.',
    font: 'Georgia, "Times New Roman", serif',
    headingFont: 'Georgia, "Times New Roman", serif',
    fontSize: '10.5pt',
    density: 1.1,
    accent: '#111111',
    centeredHeader: true,
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Tighter spacing and smaller type. Fits a long CV onto one page.',
    font: 'Calibri, "Segoe UI", Arial, sans-serif',
    headingFont: 'Calibri, "Segoe UI", Arial, sans-serif',
    fontSize: '9.5pt',
    density: 0.85,
    accent: '#334155',
    centeredHeader: false,
  },
];

// HTML entities are assembled from their parts so the source stays readable
// without a literal ampersand-entity sequence sitting in the file.
const ENT_AMP = '&' + 'amp;';
const ENT_LT = '&' + 'lt;';
const ENT_GT = '&' + 'gt;';
const ENT_QUOT = '&' + 'quot;';
const ENT_APOS = '&' + '#39;';

/** Escapes text so it can be safely embedded in HTML. */
export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, ENT_AMP)
    .replace(/</g, ENT_LT)
    .replace(/>/g, ENT_GT)
    .replace(/"/g, ENT_QUOT)
    .replace(/'/g, ENT_APOS);
}

export type ResumeBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'bullets'; items: string[] };

const SECTION_WORDS = [
  'summary', 'profile', 'objective', 'about', 'skills', 'technical skills', 'core skills',
  'experience', 'work experience', 'professional experience', 'employment', 'employment history',
  'education', 'academic background', 'certifications', 'certificates', 'courses',
  'projects', 'selected projects', 'awards', 'honors', 'honours', 'languages', 'interests',
  'volunteering', 'publications', 'references', 'contact', 'achievements', 'training',
];

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** True when a line looks like a section heading rather than body copy. */
export function isSectionHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  // Strip trailing colons and markdown emphasis before judging.
  const bare = trimmed.replace(/[:*#]+$/, '').trim();
  if (!bare || bare.length > 42) return false;
  if (/^[-*•‣▪]\s+/.test(trimmed)) return false;

  const lower = bare.toLowerCase();
  if (SECTION_WORDS.includes(lower)) return true;
  // ALL CAPS on its own line is the usual way a resume marks a section.
  if (bare === bare.toUpperCase() && /[A-Z]/.test(bare) && bare.length <= 42) return true;
  // "Title Case:" with a colon also reads as a heading.
  if (trimmed.endsWith(':') && bare.split(/\s+/).length <= 5) return true;
  return false;
}

function isBullet(line: string): boolean {
  return /^[-*•‣▪]\s+/.test(line.trim());
}

function bulletText(line: string): string {
  return line.trim().replace(/^[-*•‣▪]\s+/, '').trim();
}

/**
 * Splits plain resume text into headings, paragraphs and bullet lists.
 * Consecutive bullet lines are grouped into a single list.
 */
export function parseResumeBlocks(text: string): ResumeBlock[] {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ResumeBlock[] = [];
  let pendingBullets: string[] = [];

  const flushBullets = () => {
    if (pendingBullets.length === 0) return;
    blocks.push({ kind: 'bullets', items: pendingBullets });
    pendingBullets = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      continue;
    }
    if (isBullet(line)) {
      pendingBullets.push(bulletText(line));
      continue;
    }
    if (isSectionHeading(line)) {
      flushBullets();
      blocks.push({ kind: 'heading', text: normalise(line.replace(/[:*#]+$/, '')) });
      continue;
    }
    flushBullets();
    blocks.push({ kind: 'paragraph', text: normalise(line) });
  }

  flushBullets();
  return blocks;
}

export interface ResumeDocumentOptions {
  name?: string | null;
  contact?: string | null;
  /** Target role, shown under the name. */
  targetRole?: string | null;
  templateId?: string;
  resumeText: string;
}

export function getTemplate(templateId?: string): ResumeTemplate {
  return RESUME_TEMPLATES.find((t) => t.id === templateId) ?? RESUME_TEMPLATES[0];
}

/** Builds the full standalone HTML document used for preview, printing and Word export. */
export function buildResumeDocument(options: ResumeDocumentOptions): string {
  const template = getTemplate(options.templateId);
  const blocks = parseResumeBlocks(options.resumeText);
  const name = (options.name || 'Your Name').trim();
  const contact = (options.contact || '').trim();
  const targetRole = (options.targetRole || '').trim();

  const body = blocks
    .map((block) => {
      if (block.kind === 'heading') {
        return `<h2>${escapeHtml(block.text)}</h2>`;
      }
      if (block.kind === 'bullets') {
        const items = block.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${escapeHtml(block.text)}</p>`;
    })
    .join('\n');

  const headerExtra = targetRole
    ? `<div class="target">${escapeHtml(targetRole)}</div>`
    : '';
  const contactHtml = contact
    ? `<div class="contact">${escapeHtml(contact)}</div>`
    : '';

  const gap = (14 * template.density).toFixed(1);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(name)} - Resume</title>
<style>
  @page { size: A4; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${template.font};
    font-size: ${template.fontSize};
    line-height: ${(1.45 * template.density).toFixed(2)};
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc { padding: 16mm 18mm; max-width: 210mm; margin: 0 auto; }
  header { margin-bottom: ${gap}px; padding-bottom: 8px; border-bottom: 2px solid ${template.accent}; }
  header.centered { text-align: center; border-bottom-width: 1px; }
  h1 { font-family: ${template.headingFont}; font-size: 21pt; line-height: 1.15; margin: 0 0 3px; color: ${template.accent}; letter-spacing: -0.01em; }
  .target { font-size: 10pt; color: #444; margin-bottom: 2px; }
  .contact { font-size: 9pt; color: #555; }
  h2 {
    font-family: ${template.headingFont};
    font-size: 10.5pt;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    margin: ${gap}px 0 5px;
    padding-bottom: 2px;
    border-bottom: 1px solid #d8d8d8;
    color: ${template.accent};
  }
  p { margin: 0 0 ${(5 * template.density).toFixed(1)}px; }
  ul { margin: 0 0 ${(5 * template.density).toFixed(1)}px; padding-left: 17px; }
  li { margin-bottom: ${(2.5 * template.density).toFixed(1)}px; }
  li::marker { color: ${template.accent}; }
</style>
</head>
<body>
  <div class="doc">
    <header class="${template.centeredHeader ? 'centered' : ''}">
      <h1>${escapeHtml(name)}</h1>
      ${headerExtra}
      ${contactHtml}
    </header>
${body}
  </div>
</body>
</html>`;
}

/**
 * Wraps the document in a Word-compatible HTML envelope so it can be saved as
 * an editable .doc file from the browser.
 */
export function buildWordDocument(htmlDocument: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Resume</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
</head>
<body>${htmlDocument}</body>
</html>`;
}
