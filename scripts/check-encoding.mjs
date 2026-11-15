import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const roots = ['app'];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const mojibakePattern = /(?:≡ƒ|Γ(?:£|Ç|å|¥|Ü|¡|ë)|├ù|�)/u;
const failures = [];

async function checkDirectory(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    failures.push(`${directory}: cannot scan (${error instanceof Error ? error.message : String(error)})`);
    return;
  }

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await checkDirectory(filePath);
      continue;
    }
    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) continue;

    const contents = await readFile(filePath, 'utf8');
    const lines = contents.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (mojibakePattern.test(line)) failures.push(`${filePath}:${index + 1}: ${line.trim().slice(0, 140)}`);
    });
  }
}

for (const root of roots) await checkDirectory(root);

if (failures.length) {
  console.error('Encoding check failed: suspicious mojibake/replacement characters found in app source:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Encoding check passed: app source contains no known mojibake markers.');
}
