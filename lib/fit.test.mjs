import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicFit } from './fit-core.ts';

const resume = {
  summary: 'Senior React and TypeScript developer building Next.js web applications with Node APIs.',
  skills: ['React', 'TypeScript', 'Next.js', 'Node'],
  roles: ['Frontend Developer', 'React Developer'],
};

test('heuristicFit scores a strong match above a weak match', () => {
  const strong = heuristicFit(resume, {
    title: 'React Developer',
    description: 'You will build UI with React, TypeScript, Next.js and Node.',
  });
  const weak = heuristicFit(resume, {
    title: 'Warehouse Picker',
    description: 'Pick and pack orders in a warehouse. No software experience needed.',
  });
  assert.ok(strong.score > weak.score, `expected ${strong.score} > ${weak.score}`);
});

test('heuristicFit reports matched and missing skills', () => {
  const result = heuristicFit(resume, {
    title: 'React Developer',
    description: 'React and TypeScript only.',
  });
  assert.deepEqual(result.matched.sort(), ['React', 'TypeScript']);
  assert.ok(result.missing.includes('Next.js'));
  assert.ok(result.missing.includes('Node'));
});

test('heuristicFit keeps the score within 0-100', () => {
  const perfect = heuristicFit(resume, {
    title: 'React Developer Next.js TypeScript Node',
    description: 'React TypeScript Next.js Node React TypeScript Next.js Node React TypeScript Next.js Node',
  });
  const empty = heuristicFit(resume, { title: '', description: '' });
  assert.ok(perfect.score >= 0 && perfect.score <= 100);
  assert.ok(empty.score >= 0 && empty.score <= 100);
});

test('heuristicFit gives a title role match more weight than a body mention', () => {
  const inTitle = heuristicFit(resume, { title: 'React Developer', description: '' });
  const inBody = heuristicFit(resume, { title: 'Software Engineer', description: 'React Developer wanted' });
  assert.ok(inTitle.score > inBody.score);
});

test('heuristicFit does not throw on empty input', () => {
  const result = heuristicFit({ summary: '', skills: [], roles: [] }, { title: '', description: '' });
  assert.equal(result.score, 0);
  assert.deepEqual(result.matched, []);
});
