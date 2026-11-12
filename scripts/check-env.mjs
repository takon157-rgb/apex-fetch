// Structural integrity check for the env files: confirms every value is
// well-formed without printing any secret.
//
// Run: node scripts/check-env.mjs
import { readFileSync } from 'node:fs';

function parse(file) {
  const out = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i === -1) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const RULES = {
  DATABASE_URL: (v) => {
    try {
      const u = new URL(v);
      const q = u.searchParams;
      return `ok host=${u.hostname} db=${u.pathname.slice(1)} sslmode=${q.get('sslmode')} connection_limit=${q.get('connection_limit')} pool_timeout=${q.get('pool_timeout')}`;
    } catch { return 'FAIL not a url'; }
  },
  DIRECT_URL: (v) => {
    try {
      const u = new URL(v);
      return `ok host=${u.hostname} db=${u.pathname.slice(1)}`;
    } catch { return 'FAIL not a url'; }
  },
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: (v) =>
    /^pk_(test|live)_[A-Za-z0-9_-]+$/.test(v) ? `ok ${v.slice(0, 8)}... len=${v.length}` : `FAIL looks wrong (len=${v.length})`,
  CLERK_SECRET_KEY: (v) =>
    /^sk_(test|live)_[A-Za-z0-9_-]+$/.test(v) ? `ok ${v.slice(0, 8)}... len=${v.length}` : `FAIL looks wrong (len=${v.length})`,
  ADMIN_CLERK_ID: (v) =>
    /^user_[A-Za-z0-9]+$/.test(v) ? `ok user_... len=${v.length}` : `FAIL looks wrong (len=${v.length})`,
  NEXT_PUBLIC_ADMIN_CLERK_ID: (v) =>
    /^user_[A-Za-z0-9]+$/.test(v) ? `ok user_... len=${v.length}` : `FAIL looks wrong (len=${v.length})`,
  CLERK_WEBHOOK_SECRET: (v) =>
    v === '' ? 'ok (empty)' : v.startsWith('whsec_') ? `ok whsec_... len=${v.length}` : `FAIL unexpected prefix (len=${v.length})`,
  SUPABASE_SERVICE_ROLE_KEY: (v) =>
    v.split('.').length === 3 ? `ok jwt len=${v.length}` : `FAIL not a jwt (len=${v.length})`,
  NEXT_PUBLIC_SUPABASE_URL: (v) =>
    /^https:\/\/[a-z]+\.supabase\.co$/.test(v) ? 'ok' : `FAIL looks wrong (len=${v.length})`,
  NEXT_PUBLIC_STRIPE_LINK: (v) => v.startsWith('http') ? 'ok' : `FAIL looks wrong (len=${v.length})`,
  CRON_SECRET: (v) => v.length >= 16 ? `ok len=${v.length}` : `FAIL too short (len=${v.length})`,
  GEMINI_API_KEY: (v) => v.length > 10 ? `ok len=${v.length}` : `FAIL too short (len=${v.length})`,
  DISCORD_WEBHOOK_URL: (v) =>
    /^https:\/\/discord\.com\/api\/webhooks\/\d+\//.test(v) ? 'ok' : `FAIL looks wrong (len=${v.length})`,
};

let problems = 0;
for (const file of ['.env.local', '.env.vercel', '.env']) {
  const vars = parse(file);
  console.log(`\n=== ${file} (${Object.keys(vars).length} vars) ===`);
  for (const [key, value] of Object.entries(vars)) {
    const rule = RULES[key];
    if (!rule) {
      console.log(`  ${key.padEnd(36)} (no rule) len=${value.length}`);
      continue;
    }
    const result = rule(value);
    if (result.startsWith('FAIL')) problems++;
    console.log(`  ${key.padEnd(36)} ${result}`);
  }
}

console.log(`\n${problems === 0 ? 'PASS' : `FAIL (${problems} problem${problems === 1 ? '' : 's'})`}: env files are structurally sound`);
if (problems > 0) process.exitCode = 1;
