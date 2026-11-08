import { chromium } from 'playwright';

// ---------------------------------------------------------------------------
// Resume PDF generation (HTML -> PDF via Playwright/Chromium).
// NOTE: works locally (Playwright browsers installed). On serverless (Vercel)
// this needs a compatible runtime — flagged, not silently broken.
// ---------------------------------------------------------------------------

export function renderResumeHtml(resumeText: string, name = ''): string {
  const body = (resumeText || '')
    .split(/\n{2,}/)
    .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; margin: 40px; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
  .name { color: #1a1a1a; }
</style></head>
<body>
  ${name ? `<h1 class="name">${escapeHtml(name)}</h1>` : ''}
  ${body}
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' }, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function resumeToPdf(resumeText: string, name = ''): Promise<Buffer | null> {
  try {
    return await htmlToPdf(renderResumeHtml(resumeText, name));
  } catch (err) {
    console.error('[PDF] generation failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
