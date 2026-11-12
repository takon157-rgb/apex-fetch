// Screenshots the public pages so the signup wall, sign-in wall and pricing
// page can be eyeballed without a browser session.
// Run: node scripts/screenshot-pages.mjs
import { mkdirSync } from 'node:fs';

const OUT = process.env.SHOT_DIR || 'C:\\Users\\user\\AppData\\Local\\Temp\\opencode\\shots';
const BASE = process.env.BASE_URL || 'http://localhost:3210';
mkdirSync(OUT, { recursive: true });

const pages = [
  { path: '/sign-up', name: 'sign-up' },
  { path: '/sign-in', name: 'sign-in' },
  { path: '/pricing', name: 'pricing' },
];

// Playwright's bundled Chromium may not be downloadable on this machine, so
// fall back to a system browser (Edge ships with Windows, Chrome on Mac).
async function launchBrowser() {
  const chromiumModule = await import('playwright');
  const attempts = [undefined, 'msedge', 'chrome'];
  let lastError;
  for (const channel of attempts) {
    try {
      return await chromiumModule.chromium.launch(channel ? { channel } : {});
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

for (const p of pages) {
  const res = await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Clerk's widgets load lazily and keep sockets open, so "networkidle" never
  // fires - wait for the visible content instead.
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}\\${p.name}.png`, fullPage: true });
  console.log(`${p.path.padEnd(12)} ${res?.status()}  -> ${p.name}.png`);
}

// Mobile view of the signup wall.
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await mobile.newPage();
await mp.goto(`${BASE}/sign-up`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await mp.waitForTimeout(3000);
await mp.screenshot({ path: `${OUT}\\sign-up-mobile.png`, fullPage: true });
console.log('/sign-up    mobile -> sign-up-mobile.png');

console.log(errors.length ? `\nCONSOLE ERRORS:\n${errors.slice(0, 8).join('\n')}` : '\nNo console errors.');
await browser.close();
