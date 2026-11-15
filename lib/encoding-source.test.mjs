import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dashboardPath = new URL('../app/components/Dashboard.tsx', import.meta.url);
const source = await readFile(dashboardPath, 'utf8');
const mojibakePattern = /(?:≡ƒ|Γ(?:£|Ç|å|¥|Ü|¡|ë)|├ù|�)/u;

test('dashboard source contains no corrupted UTF-8/emoji sequences', () => {
  assert.equal(mojibakePattern.test(source), false, 'Replace garbled UI literals with valid Unicode text or icons.');
});
