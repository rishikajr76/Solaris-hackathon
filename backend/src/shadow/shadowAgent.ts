import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';
import type { ScoredDiffFile } from './saccadicFocus';

export type ShadowFindingRaw = {
  category: 'sqli' | 'auth_bypass' | 'other';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  title: string;
  description: string;
  evidence?: string;
};

const SYSTEM = `You are a security-focused code reviewer for a pull request diff.
Only flag issues related to:
1) SQL injection (SQLi) — unsafe string concatenation into SQL, raw queries with user input, missing parameterization.
2) Authentication / authorization bypass — missing checks, insecure session handling, IDOR, privilege escalation in routes/handlers.

Ignore style, performance, and general bugs unless they directly enable SQLi or auth bypass.
Output MUST be a single JSON array (no markdown fences) with objects shaped as:
{"category":"sqli"|"auth_bypass"|"other","severity":"critical"|"high"|"medium"|"low"|"info","file_path":"string","line_start":number|null,"line_end":number|null,"title":"string","description":"string","evidence":"short snippet if any"}
If no issues, return [].`;

function extractJsonArray(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start >= 0 && end > start) return t.slice(start, end + 1);
  return t;
}

function parseFindingsJson(text: string): ShadowFindingRaw[] {
  const raw = extractJsonArray(text);
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x) => x && typeof x === 'object') as ShadowFindingRaw[];
}

export async function analyzeShadowSecurity(
  files: ScoredDiffFile[],
  modelId: string
): Promise<{ findings: ShadowFindingRaw[]; model: string; error?: string }> {
  const key = config.googleApiKey?.trim();
  if (!key) {
    return { findings: [], model: modelId, error: 'GOOGLE_API_KEY / GEMINI_API_KEY is not set' };
  }
  if (!files.length) {
    return { findings: [], model: modelId };
  }

  const client = new GoogleGenerativeAI(key);
  const model = client.getGenerativeModel({ model: modelId });

  const blocks = files.map(
    (f) => `### File: ${f.path}\n(score=${f.score.toFixed(2)})\n\n${f.patchText.slice(0, 120000)}`
  );
  const user = `${SYSTEM}\n\n--- DIFF (prioritized) ---\n\n${blocks.join('\n\n')}`;

  async function run(prompt: string): Promise<string> {
    const result = await model.generateContent(prompt);
    const t = result.response.text();
    if (!t?.trim()) throw new Error('Gemini returned empty content');
    return t;
  }

  let text: string;
  try {
    text = await run(user);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { findings: [], model: modelId, error: msg };
  }

  try {
    const findings = parseFindingsJson(text);
    return { findings, model: modelId };
  } catch {
    try {
      text = await run(`${user}\n\nReturn ONLY valid JSON array, no prose.`);
      const findings = parseFindingsJson(text);
      return { findings, model: modelId };
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2);
      return { findings: [], model: modelId, error: `JSON parse failed after retry: ${msg}` };
    }
  }
}
