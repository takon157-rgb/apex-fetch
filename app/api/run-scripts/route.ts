import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

function runScript(scriptPath: string, timeout = 120000): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], { cwd: process.cwd(), windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill(); } catch (e) {}
      resolve({ stdout, stderr: stderr + '\n[timeout]', code: null });
    }, timeout);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const base = process.cwd();
    const ser = path.join(base, 'scripts', 'ser.js');
    const side = path.join(base, 'scripts', 'sidescraper.js');

    const [serRes, sideRes] = await Promise.all([
      runScript(ser).catch(e => ({ stdout: '', stderr: String(e), code: null })),
      runScript(side).catch(e => ({ stdout: '', stderr: String(e), code: null }))
    ]);

    return NextResponse.json({ success: true, ser: serRes, sidescraper: sideRes });
  } catch (err) {
    return NextResponse.json({ error: true, message: (err as Error).message }, { status: 500 });
  }
}
