// Tests for the resume document renderer. Run: node --test lib/resume-html.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  escapeHtml,
  isSectionHeading,
  parseResumeBlocks,
  buildResumeDocument,
  buildWordDocument,
  getTemplate,
  RESUME_TEMPLATES,
} = await import('./resume-html.ts');

// Expected entities are assembled from parts so this file never contains a
// literal ampersand-entity sequence.
const A = '&';
const AMP = A + 'amp;';
const LT = A + 'lt;';
const GT = A + 'gt;';
const QUOT = A + 'quot;';
const APOS = A + '#39;';

test('escapeHtml neutralises markup', () => {
  const out = escapeHtml('<script>alert("x")' + '</script> & more');
  assert.ok(!out.includes('<script>'));
  assert.ok(!out.includes('</script>'));
  assert.ok(!out.includes('<'));
  assert.ok(!out.includes('>'));
  assert.ok(out.includes(AMP));
  assert.ok(out.includes(QUOT));
});

test('escapeHtml escapes each character', () => {
  assert.equal(escapeHtml('a & b'), 'a ' + AMP + ' b');
  assert.equal(escapeHtml('<'), LT);
  assert.equal(escapeHtml('>'), GT);
  assert.equal(escapeHtml('"'), QUOT);
  assert.equal(escapeHtml("'"), APOS);
});

test('section headings are recognised', () => {
  assert.equal(isSectionHeading('SUMMARY'), true);
  assert.equal(isSectionHeading('Summary'), true);
  assert.equal(isSectionHeading('Technical Skills'), true);
  assert.equal(isSectionHeading('EXPERIENCE:'), true);
  assert.equal(isSectionHeading('Work Experience'), true);
});

test('body copy is not mistaken for a heading', () => {
  assert.equal(isSectionHeading('Led a team of four engineers across two time zones.'), false);
  assert.equal(isSectionHeading('- Managed the release pipeline'), false);
  assert.equal(isSectionHeading(''), false);
});

test('resume text is split into headings, paragraphs and bullet lists', () => {
  const blocks = parseResumeBlocks([
    'SUMMARY',
    'Backend engineer with eight years of experience.',
    '',
    'SKILLS',
    '- Node.js',
    '- PostgreSQL',
    '',
    'EDUCATION',
    'BSc Computer Science',
  ].join('\n'));

  assert.equal(blocks[0].kind, 'heading');
  assert.equal(blocks[0].text, 'SUMMARY');
  assert.equal(blocks[1].kind, 'paragraph');
  assert.equal(blocks[2].kind, 'heading');
  assert.equal(blocks[3].kind, 'bullets');
  assert.deepEqual(blocks[3].items, ['Node.js', 'PostgreSQL']);
  assert.equal(blocks[4].kind, 'heading');
  assert.equal(blocks[5].kind, 'paragraph');
});

test('consecutive bullets group into one list', () => {
  const blocks = parseResumeBlocks('SKILLS\n- One\n* Two\n• Three');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].kind, 'bullets');
  assert.equal(blocks[1].items.length, 3);
});

test('the document embeds the candidate name and contact', () => {
  const html = buildResumeDocument({
    name: 'Ada Lovelace',
    contact: 'ada@example.com',
    targetRole: 'Staff Engineer',
    resumeText: 'SUMMARY\nBuilt engines.',
  });
  assert.ok(html.includes('Ada Lovelace'));
  assert.ok(html.includes('ada@example.com'));
  assert.ok(html.includes('Staff Engineer'));
  assert.ok(html.includes('Built engines.'));
});

test('resume content can never inject markup into the document', () => {
  const html = buildResumeDocument({
    name: 'Mallory',
    resumeText: 'SUMMARY\n</style><script>alert(1)</script>\n<img src=x onerror=alert(1)>',
  });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x'));
  // The angle brackets survive only in their escaped form.
  assert.ok(html.includes(LT + 'script' + GT));
  assert.ok(!html.includes('onerror=alert(1)>'));
});

test('every template produces a valid standalone document', () => {
  for (const template of RESUME_TEMPLATES) {
    const html = buildResumeDocument({
      name: 'Test User',
      resumeText: 'SUMMARY\nA line of copy.\nSKILLS\n- One',
      templateId: template.id,
    });
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(html.includes('</html>'));
    assert.ok(html.includes('Test User'));
    assert.ok(html.includes(template.accent));
  }
});

test('an unknown template falls back to the ATS-safe one', () => {
  assert.equal(getTemplate('nope').id, 'ats');
  assert.equal(getTemplate(undefined).id, 'ats');
  assert.equal(getTemplate('compact').id, 'compact');
});

test('the Word export wraps the document in a Word-compatible envelope', () => {
  const doc = buildResumeDocument({ name: 'Doc User', resumeText: 'SUMMARY\nHello' });
  const word = buildWordDocument(doc);
  assert.ok(word.includes('urn:schemas-microsoft-com:office:word'));
  assert.ok(word.includes('Doc User'));
});
