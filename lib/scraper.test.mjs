import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanHtml,
  fingerprint,
  parseSalary,
  inferJobType,
  inferTags,
  isBlocked,
  scoreLead,
  extractCompanyDomains,
} from './scraper-utils.ts';

test('cleanHtml strips tags and decodes entities', () => {
  assert.equal(cleanHtml('<p>Hello <b>world</b> &amp; friends</p>'), 'Hello world & friends');
  assert.equal(cleanHtml(''), '');
});

test('fingerprint is deterministic and case/symbol-insensitive', () => {
  const a = fingerprint('Senior React Developer', 'RemoteOK');
  const b = fingerprint('senior react developer!', 'remoteok');
  assert.equal(a, b);
});

test('parseSalary handles ranges', () => {
  const r = parseSalary('$70k - $90k plus benefits');
  assert.equal(r.min, 70000);
  assert.equal(r.max, 90000);
  assert.equal(r.currency, 'USD');
});

test('parseSalary handles single amount', () => {
  const r = parseSalary('Salary: $120,000/year');
  assert.equal(r.min, 120000);
  assert.equal(r.currency, 'USD');
});

test('inferJobType detects full-time/contract', () => {
  assert.equal(inferJobType('Full-time role'), 'full-time');
  assert.equal(inferJobType('Freelance contract'), 'contract');
  assert.equal(inferJobType('Something else'), undefined);
});

test('inferTags extracts known tech stack', () => {
  const tags = inferTags('React developer with Python and AWS experience');
  assert.ok(tags.includes('react'));
  assert.ok(tags.includes('python'));
  assert.ok(tags.includes('aws'));
});

test('isBlocked flags "for hire" noise and user blacklist', () => {
  assert.equal(isBlocked('[For Hire] I am a freelancer', '', []), true);
  assert.equal(isBlocked('Senior React Engineer', 'remote role', ['blockchain']), false);
  assert.equal(isBlocked('Blockchain Engineer', 'remote', ['blockchain']), true);
});

test('scoreLead produces honest score and match reason', () => {
  const item = {
    title: 'Remote Senior React Engineer',
    description: 'We are hiring a remote React engineer. $80k salary. Company listed. Location: NYC.',
    source: 'RemoteOK',
    url: 'https://remoteok.com/x',
    company: 'Acme',
    location: 'NYC',
    salaryMin: 80000,
    postedAt: new Date().toISOString(),
    tags: ['react'],
  };
  const { aiScore, matchReason } = scoreLead(item, { targetRoles: ['react engineer'], coreSkills: ['react'] });
  assert.ok(aiScore >= 6 && aiScore <= 10, `score in range, got ${aiScore}`);
  assert.ok(matchReason.length > 0);
});

test('extractCompanyDomains filters known boards and CDNs', () => {
  const domains = extractCompanyDomains([
    'https://remoteok.com/remote-jobs/123',
    'https://acme.com/careers/engineer',
    'https://js.stripe.com/v3/',
  ]);
  assert.ok(!domains.includes('remoteok.com'));
  assert.ok(domains.includes('acme.com'));
});
