// Reads the Supabase project status through the Management API, using the
// token stored in Windows Credential Manager.
//
// Answers the questions that matter before launch: is the database paused by
// the free tier, what plan is it on, and how many connections do we get?
//
// Run: powershell -ExecutionPolicy Bypass -File scripts/supabase-status.ps1
import { execFileSync } from 'node:child_process';

const token = execFileSync(
  'powershell',
  ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/read-supabase-token.ps1'],
  { encoding: 'utf8', cwd: process.cwd() },
).trim();

if (!token) {
  console.log('No Supabase token available.');
  process.exit(0);
}

const headers = { Authorization: `Bearer ${token}`, apikey: token };

const list = await fetch('https://api.supabase.com/v1/projects', { headers });
if (!list.ok) {
  console.error(`Management API returned ${list.status}: ${await list.text()}`);
  process.exit(1);
}
const projects = await list.json();

console.log(`=== SUPABASE PROJECTS (${projects.length}) ===\n`);
for (const p of projects) {
  console.log(`  ${p.name}`);
  console.log(`    ref:        ${p.ref}`);
  console.log(`    status:     ${p.status}`);
  console.log(`    region:     ${p.region}`);
  console.log(`    plan:       ${p.plan ?? '(unknown)'}`);
  console.log(`    created:    ${p.created_at}`);
  console.log(`    db host:    ${p.database?.host ?? '(unknown)'}`);
  console.log(`    db version: ${p.database?.version ?? '(unknown)'}`);
  console.log(`    pooler:     ${p.database?.pooler?.connection_string ? 'configured' : 'none'}`);
  console.log('');

  // The pooler configuration tells us the connection ceiling.
  try {
    const cfg = await fetch(`https://api.supabase.com/v1/projects/${p.ref}/config/auth`, { headers });
    if (cfg.ok) {
      const c = await cfg.json();
      console.log(`    auth external providers: ${Object.keys(c?.external?.providers ?? {}).join(', ') || 'none'}`);
    }
  } catch {}
}

// Database roles / limits for the first project.
if (projects.length > 0) {
  const ref = projects[0].ref;
  try {
    const orgs = await fetch('https://api.supabase.com/v1/organizations', { headers });
    if (orgs.ok) {
      const o = await orgs.json();
      console.log('\n=== ORGANIZATIONS ===');
      for (const org of o) {
        console.log(`  ${org.name}  (${org.id})`);
      }
    }
  } catch {}
}
