// Tests for the URL validator that guards server-side scraping targets.
// Run: node --test lib/validate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { isPublicHttpUrl, sanitizeTargetUrls } = await import('./validate.ts');

test('accepts ordinary public https URLs', () => {
  assert.equal(isPublicHttpUrl('https://company.com/careers'), true);
  assert.equal(isPublicHttpUrl('http://jobs.example.co.uk/apply'), true);
  assert.equal(isPublicHttpUrl('https://boards.greenhouse.io/acmejobs'), true);
  assert.equal(isPublicHttpUrl('https://sub.domain.example.org/path?q=1'), true);
});

test('rejects non-http schemes', () => {
  assert.equal(isPublicHttpUrl('file:///etc/passwd'), false);
  assert.equal(isPublicHttpUrl('ftp://example.com/file'), false);
  assert.equal(isPublicHttpUrl('javascript:alert(1)'), false);
  assert.equal(isPublicHttpUrl('data:text/html,<script>'), false);
});

test('rejects malformed URLs', () => {
  assert.equal(isPublicHttpUrl(''), false);
  assert.equal(isPublicHttpUrl('not a url'), false);
  assert.equal(isPublicHttpUrl('example.com'), false);
  assert.equal(isPublicHttpUrl('https://'), false);
});

test('rejects loopback and localhost', () => {
  assert.equal(isPublicHttpUrl('http://127.0.0.1/'), false);
  assert.equal(isPublicHttpUrl('http://127.0.0.1:3000/admin'), false);
  assert.equal(isPublicHttpUrl('http://localhost/'), false);
  assert.equal(isPublicHttpUrl('http://app.localhost/'), false);
});

test('rejects private IPv4 ranges', () => {
  assert.equal(isPublicHttpUrl('http://10.0.0.5/'), false);
  assert.equal(isPublicHttpUrl('http://192.168.1.1/'), false);
  assert.equal(isPublicHttpUrl('http://172.16.0.1/'), false);
  assert.equal(isPublicHttpUrl('http://172.31.255.255/'), false);
  assert.equal(isPublicHttpUrl('http://100.64.0.1/'), false);
  assert.equal(isPublicHttpUrl('http://0.0.0.0/'), false);
});

test('rejects the cloud metadata endpoint', () => {
  assert.equal(isPublicHttpUrl('http://169.254.169.254/latest/meta-data/'), false);
  assert.equal(isPublicHttpUrl('http://[::ffff:169.254.169.254]/'), false);
});

test('accepts public IPv4', () => {
  assert.equal(isPublicHttpUrl('http://8.8.8.8/'), true);
  assert.equal(isPublicHttpUrl('http://172.32.0.1/'), true);
  assert.equal(isPublicHttpUrl('http://172.15.0.1/'), true);
  assert.equal(isPublicHttpUrl('http://11.0.0.1/'), true);
});

test('rejects private and link-local IPv6', () => {
  assert.equal(isPublicHttpUrl('http://[::1]/'), false);
  assert.equal(isPublicHttpUrl('http://[fd00::1]/'), false);
  assert.equal(isPublicHttpUrl('http://[fe80::1]/'), false);
});

test('rejects embedded credentials', () => {
  assert.equal(isPublicHttpUrl('https://user:pass@example.com/'), false);
});

test('sanitizeTargetUrls keeps valid entries, drops the rest and de-duplicates', () => {
  const out = sanitizeTargetUrls([
    'https://company.com/careers',
    '  https://company.com/careers  ',
    'http://127.0.0.1/secret',
    'not-a-url',
    42,
    null,
    'https://other.com/jobs',
  ]);
  assert.deepEqual(out, ['https://company.com/careers', 'https://other.com/jobs']);
});

test('sanitizeTargetUrls caps the number of entries', () => {
  const many = Array.from({ length: 50 }, (_, i) => `https://site${i}.example.com/careers`);
  const out = sanitizeTargetUrls(many, 25);
  assert.equal(out.length, 25);
});

test('sanitizeTargetUrls returns an empty list for junk input', () => {
  assert.deepEqual(sanitizeTargetUrls(['nope', 'http://localhost/']), []);
  assert.deepEqual(sanitizeTargetUrls([]), []);
});
