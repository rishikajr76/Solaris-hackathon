import { GoogleGenerativeAI } from '@google/generative-ai';
import { Octokit } from '@octokit/rest';
import { config } from '../config/env';
import type { RemediationViolation } from '../types/remediation';
import { embedTextForTribalSearch } from './embeddingService';
import { searchSimilarFixes, type TribalMemoryHit } from './tribalMemoryService';

const octokit = new Octokit({ auth: config.githubToken });

export type RemediationResult = {
  unifiedDiff: string;
  explanation: string;
  tribalHits: TribalMemoryHit[];
  model: string;
};

async function fetchFileAtRef(
  owner: string,
  repo: string,
  path: string,
  ref: string
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
    if (Array.isArray(data) || !('content' in data) || !data.content) return null;
    return Buffer.from(data.content, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function formatTribalContext(hits: TribalMemoryHit[]): string {
  if (!hits.length) return '(No similar past fixes in Tribal Memory yet — follow project TypeScript/Express/React conventions.)';
  return hits
    .map(
      (h, idx) => `
#### Prior fix ${idx + 1} (similarity ${(h.similarity * 100).toFixed(1)}%, PR #${h.source_pr_number ?? 'n/a'})
- Violation: ${h.violation_type} — ${h.problem_summary.slice(0, 400)}
- How it was solved (explanation): ${(h.fix_explanation ?? '').slice(0, 600)}
- Reference unified diff (patterns to mirror):
\`\`\`diff
${h.fix_unified_diff.slice(0, 8000)}
\`\`\`
`.trim()
    )
    .join('\n\n');
}

/**
 * Self-healing remediation: RAG over tribal_memory (pgvector), then Gemini generates a unified diff + rationale.
 */
export async function runRemediationAgent(params: {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  repositoryId: string | null;
  violation: RemediationViolation;
}): Promise<RemediationResult> {
  const { owner, repo, pullNumber, headSha, repositoryId, violation } = params;
  const v = violation;

  const queryText = [
    `type:${v.errorType}`,
    v.message ? `message:${v.message}` : '',
    `file:${v.filePath}`,
    v.lineNumber != null ? `line:${v.lineNumber}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const queryEmbedding = await embedTextForTribalSearch(queryText);
  const tribalHits = await searchSimilarFixes({
    queryEmbedding,
    repositoryId,
    matchCount: 8,
    matchThreshold: 0.25,
  });

  const fileContent = await fetchFileAtRef(owner, repo, v.filePath, headSha);
  const fileCtx =
    fileContent != null
      ? `Current file @ ${headSha.slice(0, 7)} (excerpt):\n\`\`\`\n${fileContent.slice(0, 12000)}\n\`\`\``
      : 'File content could not be fetched — generate the smallest safe patch from the violation context only.';

  const modelId = config.geminiReviewFlashModel;
  const key = config.googleApiKey?.trim();
  if (!key) {
    throw new Error('GOOGLE_API_KEY / GEMINI_API_KEY is required for remediation generation');
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: modelId });

  const prompt = `You are the Sentinel-AG Self-Healing Remediation Agent.

Task: propose ONE minimal unified diff (git apply format) for the violation below, aligned with the project's architecture (TypeScript strictness, Express patterns, React hooks where relevant) and consistent with how similar issues were fixed in Tribal Memory.

Violation:
- File: ${v.filePath}
- Line: ${v.lineNumber ?? 'unknown'}
- Type: ${v.errorType}
- Detail: ${v.message ?? '(none)'}

${fileCtx}

--- Tribal Memory (how we fixed similar issues before) ---
${formatTribalContext(tribalHits)}

Output rules:
1) Return a SINGLE JSON object ONLY, no markdown fences, with keys:
   "unifiedDiff" (string, full unified diff for this file only),
   "explanation" (string, markdown-safe paragraphs: why this fix matches our standards and prior tribal patterns).
2) The diff must use paths like a/${v.filePath} and b/${v.filePath} or --- a/ +++ b/ style and only touch the relevant lines.
3) If you cannot safely patch, set unifiedDiff to empty string and explain why in "explanation".
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text()?.trim() ?? '';
  if (!text) throw new Error('Remediation model returned empty output');

  let unifiedDiff = '';
  let explanation = '';

  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    const slice = jsonStart >= 0 && jsonEnd > jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
    const parsed = JSON.parse(slice) as { unifiedDiff?: string; explanation?: string };
    unifiedDiff = typeof parsed.unifiedDiff === 'string' ? parsed.unifiedDiff : '';
    explanation = typeof parsed.explanation === 'string' ? parsed.explanation : '';
  } catch {
    throw new Error('Remediation model returned non-JSON; retry or adjust prompt');
  }

  if (!explanation.trim()) {
    explanation = 'Remediation generated; see unified diff.';
  }

  return {
    unifiedDiff,
    explanation,
    tribalHits,
    model: modelId,
  };
}
