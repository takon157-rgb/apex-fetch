import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heuristicVerify } from './verify-core.ts';

test('heuristicVerify passes a draft fully supported by the master resume', () => {
  const master = 'Senior React and TypeScript developer at Acme Corp. Used Next.js and Node.';
  const draft = 'Senior React and TypeScript developer. Built with Next.js and Node.';
  const result = heuristicVerify(master, draft);
  assert.equal(result.clean, true);
  assert.deepEqual(result.fabrications, []);
});

test('heuristicVerify flags an unsupported proper noun', () => {
  const master = 'Senior React developer at Acme Corp.';
  const draft = 'Senior React developer at Acme Corp. Expert in Kubernetes.';
  const result = heuristicVerify(master, draft);
  assert.equal(result.clean, false);
  assert.ok(result.fabrications.some(f => /kubernetes/i.test(f)));
});

test('heuristicVerify ignores section headers and filler words', () => {
  const master = 'React developer with Node experience.';
  const draft = 'SUMMARY\nSKILLS\nReact developer with Node experience.';
  const result = heuristicVerify(master, draft);
  assert.equal(result.clean, true);
});

test('heuristicVerify returns a bounded fabrication list', () => {
  const master = 'nothing relevant here';
  const draft = Array.from({ length: 60 }, (_, i) => `Certification${i}`).join(' ');
  const result = heuristicVerify(master, draft);
  assert.equal(result.clean, false);
  assert.ok(result.fabrications.length <= 20);
});
