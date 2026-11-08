import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJobType,
  resolveJobType,
  resolveRemote,
  JOB_TYPES,
} from './job-attrs-core.ts';

// ---------------------------------------------------------------------------
// canonicalJobType
// ---------------------------------------------------------------------------

test('canonicalJobType: collapses punctuation and case variants', () => {
  assert.equal(canonicalJobType('Full-Time'), 'full-time');
  assert.equal(canonicalJobType('full time'), 'full-time');
  assert.equal(canonicalJobType('FullTime'), 'full-time');
  assert.equal(canonicalJobType('PART_TIME'), 'part-time');
  assert.equal(canonicalJobType('Part Time'), 'part-time');
  assert.equal(canonicalJobType('Contract'), 'contract');
  assert.equal(canonicalJobType('Internship'), 'internship');
  assert.equal(canonicalJobType('Freelance'), 'freelance');
});

test('canonicalJobType: handles non-English labels from EU boards', () => {
  // German
  assert.equal(canonicalJobType('Unbefristeter Arbeitsvertrag'), 'full-time');
  assert.equal(canonicalJobType('Vollzeit'), 'full-time');
  assert.equal(canonicalJobType('Teilzeit'), 'part-time');
  assert.equal(canonicalJobType('Befristeter Vertrag'), 'contract');
  assert.equal(canonicalJobType('Praktikum'), 'internship');
  assert.equal(canonicalJobType('Freiberuflich'), 'freelance');
  // French
  assert.equal(canonicalJobType('CDI'), 'full-time');
  assert.equal(canonicalJobType("Temps partiel"), 'part-time');
  assert.equal(canonicalJobType('Stage'), 'internship');
  // Spanish / Italian
  assert.equal(canonicalJobType('Medio tiempo'), 'part-time');
  assert.equal(canonicalJobType('Autonomo'), 'freelance');
});

test('canonicalJobType: prefers freelance over full-time for B2B labels', () => {
  // "Permanent contract & B2B" mentions permanent but is really contracting.
  assert.equal(canonicalJobType('Permanent contract & B2B'), 'freelance');
  assert.equal(canonicalJobType('Self-employed'), 'freelance');
  assert.equal(canonicalJobType('Independent Contractor'), 'freelance');
});

test('canonicalJobType: prefers full-time over contract for permanent labels', () => {
  assert.equal(canonicalJobType('Indefinite contract'), 'full-time');
  assert.equal(canonicalJobType('Permanent'), 'full-time');
});

test('canonicalJobType: returns null for unknown or empty input', () => {
  assert.equal(canonicalJobType(null), null);
  assert.equal(canonicalJobType(undefined), null);
  assert.equal(canonicalJobType(''), null);
  assert.equal(canonicalJobType('   '), null);
  assert.equal(canonicalJobType('Something Unrecognisable'), null);
});

test('canonicalJobType: only ever returns values from the canonical vocabulary', () => {
  const inputs = [
    'FullTime', 'part time', 'Contract', 'Internship', 'Freelance', 'CDI',
    'Vollzeit', 'Teilzeit', 'Stage', 'Autonomo', 'B2B', 'Permanent', 'Temp',
  ];
  for (const input of inputs) {
    const result = canonicalJobType(input);
    if (result !== null) {
      assert.ok(JOB_TYPES.includes(result), `"${input}" produced non-canonical "${result}"`);
    }
  }
});

// ---------------------------------------------------------------------------
// resolveJobType
// ---------------------------------------------------------------------------

test('resolveJobType: an explicit label always wins over the text', () => {
  assert.equal(resolveJobType('Part-Time', 'Full-time Engineer', 'Full-time role'), 'part-time');
  assert.equal(resolveJobType('Contract', 'Internship Program', 'Internship'), 'contract');
});

test('resolveJobType: infers from the title when the source omitted a label', () => {
  assert.equal(resolveJobType(null, 'Part-time Sales Associate', ''), 'part-time');
  assert.equal(resolveJobType(null, 'Marketing Internship', ''), 'internship');
  assert.equal(resolveJobType(null, 'Freelance Copywriter', ''), 'freelance');
  assert.equal(resolveJobType(null, 'Contract Ruby Developer', ''), 'contract');
  assert.equal(resolveJobType(null, 'Full-time Sales Manager', ''), 'full-time');
});

test('resolveJobType: infers from the description when title is inconclusive', () => {
  assert.equal(resolveJobType(null, 'Support Role', 'This is a part-time position.'), 'part-time');
  assert.equal(resolveJobType(null, 'Support Role', 'Paid internship for students.'), 'internship');
  assert.equal(resolveJobType(null, 'Support Role', 'Looking for a freelance designer.'), 'freelance');
  assert.equal(resolveJobType(null, 'Support Role', 'A fixed-term contract of 12 months.'), 'contract');
  assert.equal(resolveJobType(null, 'Support Role', 'Permanent employment, 40 hours a week.'), 'full-time');
});

test('resolveJobType: does not treat a passing mention of contract as a contract role', () => {
  // "contract" appears in legal boilerplate on plenty of permanent roles.
  assert.equal(resolveJobType(null, 'Account Executive', 'Full-time role. You will sign an employment contract.'), 'full-time');
});

test('resolveJobType: returns null when there is genuinely no signal', () => {
  assert.equal(resolveJobType(null, 'Software Engineer', 'Build things.'), null);
  assert.equal(resolveJobType(null, '', ''), null);
  assert.equal(resolveJobType('Unrecognisable Label', 'Software Engineer', 'Build things.'), null);
});

// ---------------------------------------------------------------------------
// resolveRemote
// ---------------------------------------------------------------------------

test('resolveRemote: location is the strongest signal', () => {
  assert.equal(resolveRemote('Engineer', 'Remote - Europe', ''), true);
  assert.equal(resolveRemote('Engineer', 'Anywhere in the world', ''), true);
  assert.equal(resolveRemote('Engineer', 'Worldwide', ''), true);
  assert.equal(resolveRemote('Engineer', 'Berlin, Germany', ''), false);
  assert.equal(resolveRemote('Engineer', 'Hybrid - London', ''), true);
});

test('resolveRemote: an explicit on-site location beats a remote title', () => {
  assert.equal(resolveRemote('Remote Engineer', 'On-site Berlin', ''), false);
  assert.equal(resolveRemote('Remote Engineer', 'In office Munich', ''), false);
});

test('resolveRemote: falls back to the title', () => {
  assert.equal(resolveRemote('Remote Backend Engineer', '', ''), true);
  assert.equal(resolveRemote('Work From Home Designer', '', ''), true);
});

test('resolveRemote: uses the description only for unambiguous phrases', () => {
  assert.equal(resolveRemote('Engineer', '', 'Fully remote position.'), true);
  assert.equal(resolveRemote('Engineer', '', 'This is a fully remote role.'), true);
  assert.equal(resolveRemote('Engineer', '', 'On-site role in Berlin.'), false);
});

test('resolveRemote: returns null when there is no signal at all', () => {
  // A vague location is treated as unknown rather than guessed.
  assert.equal(resolveRemote('Engineer', '', ''), null);
  assert.equal(resolveRemote('Engineer', 'N/A', ''), null);
  assert.equal(resolveRemote('Engineer', 'Unspecified', ''), null);
});

test('resolveRemote: a benefits-list mention of remote is not enough', () => {
  // "remote" alone in a benefits list must not flip an on-site role to remote.
  assert.equal(resolveRemote('Engineer', 'Munich, Germany', 'We offer remote wellness stipends.'), false);
});
