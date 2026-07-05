import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

function runScript(scriptPath: string, timeout = 180000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], { cwd: process.cwd(), windowsHide: true, env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { try { child.kill(); } catch {} resolve({ stdout, stderr: stderr + '\n[timeout]', code: null }); }, timeout);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ stdout, stderr, code }); });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const base = process.cwd();
    const ser = path.join(base, 'scripts', 'ser.js');
    const side = path.join(base, 'scripts', 'sidescraper.js');

    const [serRes, sideRes] = await Promise.allSettled([
      runScript(ser),
      runScript(side),
    ]);

    return NextResponse.json({
      success: true,
      ser: serRes.status === 'fulfilled' ? serRes.value : { stdout: '', stderr: String(serRes.reason), code: null },
      sidescraper: sideRes.status === 'fulfilled' ? sideRes.value : { stdout: '', stderr: String(sideRes.reason), code: null },
    });
  } catch (err) {
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}
