import nodemailer from 'nodemailer';

// ---------------------------------------------------------------------------
// SMTP application sender (Gmail app password or any SMTP). Env-driven:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// Fails gracefully (returns ok:false + reason) when SMTP isn't configured,
// so the pipeline can mark the application "manual-apply" instead of crashing.
// ---------------------------------------------------------------------------

export interface EmailResult {
  ok: boolean;
  error?: string;
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendApplicationEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}): Promise<EmailResult> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: 'SMTP not configured (set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env)' };
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
      attachments: opts.attachments,
    });
    return { ok: true };
  } catch (err) {
    console.error('[Email] send failed:', err instanceof Error ? err.message : err);
    return { ok: false, error: err instanceof Error ? err.message : 'Send failed' };
  }
}

// Placeholder guard: fail a draft if it contains a template placeholder or a
// mismatched company/role name.
export function validateEmailDraft(draft: string, expected: { company?: string; role?: string }): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  if (/\[[A-Za-z]+\]/.test(draft)) problems.push('Contains unresolved [placeholder] tokens');
  if (/{{[^}]+}}/.test(draft)) problems.push('Contains {{template}} tokens');
  if (expected.company && draft.toLowerCase().includes('[company]')) problems.push('Unfilled company placeholder');
  if (expected.role && draft.toLowerCase().includes('[role]')) problems.push('Unfilled role placeholder');
  return { ok: problems.length === 0, problems };
}
