// Checks that every internal link in the app points at a route that actually
// exists. A dead nav link or a 404 after a click is the kind of thing nobody
// notices until a user hits it, so this walks the source and cross-references
// the routes.
//
// Run: node scripts/check-links.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const APP = join(ROOT, 'app');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Turn app/page.tsx paths into the URL they serve. */
function routeFor(file) {
  const rel = relative(APP, file).split(/[\\/]/).join('/');
  if (rel === 'page.tsx' || rel === 'page.jsx' || rel === 'page.ts' || rel === 'page.js') return '/';
  const route = rel.replace(/\/page\.(tsx?|jsx?)$/, '').replace(/\.(tsx?|jsx?)$/, '');
  if (route === '') return '/';
  return '/' + route.replace(/\/\[\[\.\.\.rest\]\]$/, '').replace(/\/\[([^\]]+)\]/g, '/:param');
}

const pageFiles = walk(APP).filter((f) => /(^|[\\/])page\.(tsx?|jsx?)$/.test(f));
const routes = new Set(pageFiles.map(routeFor));

// Catch-all routes also serve their base path.
for (const r of [...routes]) {
  if (r.includes('/:param')) routes.add(r.replace('/:param', ''));
}

// API routes answer at their own path.
for (const f of walk(APP).filter((f) => /(^|[\\/])route\.(tsx?|jsx?)$/.test(f))) {
  const rel = relative(APP, f).split(/[\\/]/).join('/');
  routes.add('/' + rel.replace(/\/route\.(tsx?|jsx?)$/, ''));
}

// External links and dynamic paths are resolved at runtime.
const IGNORE = new Set([
  'http://', 'https://', 'mailto:', 'tel:', '#', '/api/', '/_next',
]);

const LINK_PATTERNS = [
  /\bhref=\{?["'`]([^"'`]+)["'`]\}?/g,
  /\brouter\.(?:push|replace)\(["'`]([^"'`]+)["'`]\)/g,
];

const broken = [];
const checked = new Set();
let scanned = 0;

for (const file of walk(APP)) {
  const src = readFileSync(file, 'utf8');
  scanned++;
  for (const pattern of LINK_PATTERNS) {
    for (const match of src.matchAll(pattern)) {
      const target = match[1].trim();
      if (!target.startsWith('/')) continue;
      if ([...IGNORE].some((prefix) => target.startsWith(prefix))) continue;
      // Dynamic segments and query strings cannot be checked statically.
      if (target.includes('${') || target.includes('[') || target.includes(':')) continue;
      const path = target.split('?')[0].split('#')[0];
      if (path.endsWith('/') && path !== '/') continue;
      const key = `${relative(ROOT, file)} -> ${target}`;
      if (checked.has(key)) continue;
      checked.add(key);
      if (!routes.has(path)) broken.push({ file: relative(ROOT, file), target, path });
    }
  }
}

console.log(`files scanned:   ${scanned}`);
console.log(`routes found:    ${routes.size}`);
console.log(`links checked:   ${checked.size}`);
console.log(`broken links:    ${broken.length}`);
for (const b of broken) console.log(`   ${b.file} -> ${b.target}`);

console.log(`\n  ${broken.length === 0 ? 'PASS' : 'FAIL'}: every internal link resolves to a real route`);
if (broken.length > 0) process.exitCode = 1;
