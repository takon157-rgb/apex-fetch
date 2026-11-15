import test from 'node:test';
import assert from 'node:assert/strict';
import { repairMojibake } from './encoding-repair.ts';

test('repairMojibake converts broken dashboard emoji and punctuation', () => {
  assert.equal(repairMojibake('≡ƒÅó Company ΓÇö none'), '🏢 Company — none');
  assert.equal(repairMojibake('Γ£¿ Tailor Γåù'), '✍️ Tailor ↗');
  assert.equal(repairMojibake('LoadingΓÇª'), 'Loading…');
});

test('repairMojibake leaves normal text and correctly encoded emoji unchanged', () => {
  const text = 'Apply for Software Engineer 🚀';
  assert.equal(repairMojibake(text), text);
});
