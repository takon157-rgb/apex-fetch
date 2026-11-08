import { parseGeminiJson } from './openai';

// ---------------------------------------------------------------------------
// Unified LLM layer — one interface, provider + model set in .env.
// Supports Google Gemini and any OpenAI-compatible endpoint (incl. local proxy).
// ---------------------------------------------------------------------------

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

export type LlmProvider = 'gemini' | 'openai';

export function getLlmProvider(): LlmProvider {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit === 'openai') return 'openai';
  if (explicit === 'gemini') return 'gemini';
  return process.env.GEMINI_API_KEY ? 'gemini' : 'openai';
}

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
}

export async function generateText(prompt: string, opts: GenerateOptions = {}): Promise<string> {
  const provider = getLlmProvider();
  if (provider === 'openai') return generateOpenAI(prompt, opts);
  return generateGemini(prompt, opts);
}

export async function generateJson<T extends Record<string, unknown>>(prompt: string, opts: GenerateOptions = {}): Promise<T | null> {
  const raw = await generateText(prompt, opts);
  return parseGeminiJson<T>(raw);
}

async function generateGemini(prompt: string, { temperature = 0.4, maxTokens = 2048 }: GenerateOptions): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function generateOpenAI(prompt: string, { temperature = 0.4, maxTokens = 2048 }: GenerateOptions): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || `OpenAI HTTP ${res.status}`);
  return data?.choices?.[0]?.message?.content ?? '';
}
