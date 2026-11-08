import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGreenhouseBoard,
  parseAshbyBoard,
  parseArbeitNowBoard,
  parseJobicyApi,
  parseHimalayasApi,
} from './board-parsers.ts';

test('greenhouse: maps a job posting with escaped HTML description', () => {
  const payload = {
    jobs: [{
      id: 1,
      title: 'Senior Backend Engineer',
      updated_at: '2026-11-01T10:00:00Z',
      location: { name: 'Remote - Europe' },
      absolute_url: 'https://stripe.com/jobs/1',
      content: '<h2>About us</h2><p>We use TypeScript and Node.js</p>',
      departments: [{ name: 'Engineering' }],
    }],
  };
  const [item] = parseGreenhouseBoard(payload, 'Direct: Stripe');

  assert.equal(item.title, 'Senior Backend Engineer');
  assert.equal(item.url, 'https://stripe.com/jobs/1');
  assert.equal(item.company, 'Stripe');
  assert.equal(item.source, 'Direct: Stripe');
  assert.equal(item.location, 'Remote - Europe');
  assert.equal(item.postedAt, '2026-11-01T10:00:00.000Z');
  // HTML must be gone — raw tags pollute resume-match token scoring.
  assert.ok(!item.description.includes('<'), `description still has markup: ${item.description}`);
  assert.ok(!/&(amp|lt|gt|quot|apos|nbsp);/i.test(item.description), `entities still encoded: ${item.description}`);
  assert.ok(item.description.includes('About us'));
  assert.ok(item.description.includes('TypeScript'));
  assert.ok(item.tags.includes('typescript'));
  assert.equal(item.remote, true);
});

test('greenhouse: sorts newest first and caps the board', () => {
  const jobs = Array.from({ length: 60 }, (_, i) => ({
    title: `Engineer ${i}`,
    updated_at: `2026-10-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    absolute_url: `https://x.test/${i}`,
    content: 'desc',
  }));
  const items = parseGreenhouseBoard({ jobs }, 'Direct: Test');

  assert.equal(items.length, 40, 'should cap at 40 jobs per board');
  const dates = items.map(i => new Date(i.postedAt).getTime());
  const sorted = [...dates].sort((a, b) => b - a);
  assert.deepEqual(dates, sorted, 'should be newest first');
});

test('greenhouse: drops entries with no title or url', () => {
  const items = parseGreenhouseBoard({
    jobs: [
      { title: 'Good Job', absolute_url: 'https://x.test/1', content: 'd' },
      { title: '', absolute_url: 'https://x.test/2', content: 'd' },
      { title: 'No URL', content: 'd' },
    ],
  }, 'Direct: Test');

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Good Job');
});

test('ashby: maps job posting with plain-text description', () => {
  const payload = {
    jobs: [{
      id: 'abc',
      title: 'Frontend Engineer',
      location: 'New York, NY',
      secondaryLocations: [{ location: 'Remote' }],
      employmentType: 'FULL_TIME',
      jobUrl: 'https://jobs.ashbyhq.com/openai/abc',
      applyUrl: 'https://jobs.ashbyhq.com/openai/abc/apply',
      descriptionPlain: 'Build React frontends.',
      publishedAt: '2026-10-15T00:00:00Z',
      tags: ['React', 'TypeScript'],
    }],
  };
  const [item] = parseAshbyBoard(payload, 'Direct: OpenAI');

  assert.equal(item.title, 'Frontend Engineer');
  assert.equal(item.url, 'https://jobs.ashbyhq.com/openai/abc');
  assert.equal(item.company, 'OpenAI');
  assert.equal(item.location, 'New York, NY · Remote');
  assert.equal(item.jobType, 'FULL_TIME');
  assert.equal(item.postedAt, '2026-10-15T00:00:00.000Z');
  assert.ok(item.tags.includes('react'));
  assert.ok(item.tags.includes('typescript'));
  assert.ok(item.description.includes('React'));
});

test('ashby: falls back to descriptionHtml and applyUrl', () => {
  const payload = {
    jobs: [{
      title: 'Data Engineer',
      descriptionHtml: '<p>Python & SQL pipelines</p>',
      applyUrl: 'https://jobs.ashbyhq.com/x/apply',
    }],
  };
  const [item] = parseAshbyBoard(payload, 'Direct: OpenAI');

  assert.equal(item.url, 'https://jobs.ashbyhq.com/x/apply');
  assert.ok(item.description.includes('Python & SQL'), `got: ${item.description}`);
  // No HTML entities should survive decoding.
  assert.ok(!/&(amp|lt|gt|quot|apos|nbsp);/i.test(item.description), `entities left: ${item.description}`);
  assert.ok(!item.description.includes('<'), `markup left: ${item.description}`);
});

test('arbeitnow: maps a posting and detects remote', () => {
  const payload = [{
    slug: 'job-1',
    title: 'Python Developer',
    company_name: 'Acme',
    description: 'Django and Postgres.',
    remote: true,
    url: 'https://www.arbeitnow.com/view/job-1',
    tags: ['python'],
    job_types: ['full-time'],
    created_at: 1767225600,
  }];
  const [item] = parseArbeitNowBoard(payload, 'Arbeitnow');

  assert.equal(item.title, 'Python Developer');
  assert.equal(item.company, 'Acme');
  assert.equal(item.url, 'https://www.arbeitnow.com/view/job-1');
  assert.equal(item.remote, true);
  assert.equal(item.jobType, 'full-time');
  assert.ok(item.tags.includes('python'));
});

test('arbeitnow: synthesises a url from the slug when missing', () => {
  const [item] = parseArbeitNowBoard([{
    slug: 'abc',
    title: 'Rust Engineer',
    company_name: 'Acme',
    description: 'Systems work.',
  }], 'Arbeitnow');

  assert.equal(item.url, 'https://www.arbeitnow.com/view/abc');
});

test('all parsers return [] for malformed payloads instead of throwing', () => {
  assert.deepEqual(parseGreenhouseBoard(null, 's'), []);
  assert.deepEqual(parseGreenhouseBoard({ jobs: 'nope' }, 's'), []);
  assert.deepEqual(parseAshbyBoard(undefined, 's'), []);
  assert.deepEqual(parseArbeitNowBoard({ nope: true }, 's'), []);
  assert.deepEqual(parseJobicyApi(null, 's'), []);
  assert.deepEqual(parseJobicyApi({ jobs: 'nope' }, 's'), []);
  assert.deepEqual(parseHimalayasApi(null, 's'), []);
  assert.deepEqual(parseHimalayasApi({ jobs: 42 }, 's'), []);
});

// ---------------------------------------------------------------------------
// Jobicy JSON API
// ---------------------------------------------------------------------------

test('jobicy: maps a posting including its explicit job type', () => {
  const payload = [{
    id: 1,
    url: 'https://jobicy.com/jobs/159646-tutor',
    jobTitle: '1-on-1 Math Tutor (U.S. Online)',
    companyName: 'Think Academy US',
    jobType: ['Part-Time'],
    jobGeo: 'USA',
    jobIndustry: ['Education & E-learning'],
    jobLevel: 'Any',
    jobDescription: '<p>Teach <strong>algebra</strong> to students.</p>',
    pubDate: '2026-11-07T16:33:24+00:00',
    salaryMin: 25,
    salaryMax: 25,
    salaryCurrency: 'USD',
  }];
  const [item] = parseJobicyApi(payload, 'Jobicy: Part-time');

  assert.equal(item.title, '1-on-1 Math Tutor (U.S. Online)');
  assert.equal(item.company, 'Think Academy US');
  assert.equal(item.url, 'https://jobicy.com/jobs/159646-tutor');
  assert.equal(item.source, 'Jobicy: Part-time');
  assert.equal(item.location, 'USA');
  // The whole point of the JSON API: a real employment-type label.
  assert.equal(item.jobType, 'Part-Time');
  assert.equal(item.remote, true);
  assert.equal(item.salaryMin, 25);
  assert.equal(item.salaryCurrency, 'USD');
  assert.equal(item.postedAt, '2026-11-07T16:33:24.000Z');
  assert.ok(item.description.includes('algebra'), `got: ${item.description}`);
  assert.ok(!item.description.includes('<'), `markup left: ${item.description}`);
});

test('jobicy: accepts a string jobType as well as an array', () => {
  const [item] = parseJobicyApi([{
    url: 'https://jobicy.com/jobs/1',
    jobTitle: 'Engineer',
    jobType: 'Full-Time',
  }], 'Jobicy');
  assert.equal(item.jobType, 'Full-Time');
});

test('jobicy: drops postings with no title or url', () => {
  const items = parseJobicyApi([
    { jobTitle: 'Good', url: 'https://jobicy.com/jobs/1' },
    { jobTitle: '', url: 'https://jobicy.com/jobs/2' },
    { jobTitle: 'No URL' },
  ], 'Jobicy');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Good');
});

test('jobicy: accepts a { jobs: [...] } wrapper', () => {
  const items = parseJobicyApi({ jobs: [{ jobTitle: 'A', url: 'https://jobicy.com/jobs/a' }] }, 'Jobicy');
  assert.equal(items.length, 1);
});

// ---------------------------------------------------------------------------
// Himalayas JSON API
// ---------------------------------------------------------------------------

test('himalayas: maps a posting including employment type and salary', () => {
  const now = Math.floor(Date.now() / 1000);
  const payload = [{
    title: 'Data Engineer',
    companyName: 'Acme',
    employmentType: 'Full Time',
    locationRestrictions: ['Worldwide'],
    description: 'Build Python pipelines with SQL.',
    pubDate: now - 3600,
    expiryDate: now + 86400,
    minSalary: 90000,
    maxSalary: 120000,
    currency: 'USD',
    categories: ['Engineering'],
    applicationLink: 'https://himalayas.app/jobs/acme/data-engineer',
  }];
  const [item] = parseHimalayasApi(payload, 'Himalayas');

  assert.equal(item.title, 'Data Engineer');
  assert.equal(item.company, 'Acme');
  assert.equal(item.url, 'https://himalayas.app/jobs/acme/data-engineer');
  assert.equal(item.jobType, 'Full Time');
  assert.equal(item.location, 'Worldwide');
  assert.equal(item.remote, true);
  assert.equal(item.salaryMin, 90000);
  assert.equal(item.salaryMax, 120000);
  assert.equal(item.salaryCurrency, 'USD');
  assert.ok(item.tags.includes('engineering'));
});

test('himalayas: drops postings whose own expiry date has passed', () => {
  const now = Math.floor(Date.now() / 1000);
  const items = parseHimalayasApi([
    {
      title: 'Dead Role',
      applicationLink: 'https://himalayas.app/jobs/dead',
      expiryDate: now - 60,
    },
    {
      title: 'Live Role',
      applicationLink: 'https://himalayas.app/jobs/live',
      expiryDate: now + 86400,
    },
  ], 'Himalayas');

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Live Role');
});

test('himalayas: keeps postings with no expiry date at all', () => {
  const items = parseHimalayasApi([{
    title: 'No Expiry',
    applicationLink: 'https://himalayas.app/jobs/no-expiry',
  }], 'Himalayas');
  assert.equal(items.length, 1);
});
