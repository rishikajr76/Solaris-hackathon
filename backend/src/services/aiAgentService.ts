import { reviewLlmComplete, reviewLlmSummarize } from './llmReviewClient';

const CATEGORY_LABEL: Record<string, string> = {
  security: '🔒 Security',
  performance: '⚡ Performance',
  architecture: '🏗️ Architecture',
  suggestion: '💡 Suggestion',
};

export type ExtractedInlineComment = {
  path: string;
  line: number;
  category: string;
  body: string;
};

const prompts: Record<string, string> = {
  security: `You are a Security Auditor. Focus: SQLi, Secrets, XSS, and Auth. Context: {context}. Diff: {diff}`,
  performance: `You are a Performance Expert. Focus: Complexity, Memory, and Async bottlenecks. Context: {context}. Diff: {diff}`,
  architecture: `You are a Lead Architect. Focus: DRY, Design Patterns, and Project Rules. Context: {context}. Diff: {diff}`
};

export class AIAgentService {
  /**
   * Called by AgentBoard to run a specific specialized agent
   */
  static async reviewCode(diff: string, context: string, role: 'security' | 'performance' | 'architecture'): Promise<string> {
    const promptTemplate = prompts[role];
    const fullPrompt = promptTemplate
      .replace('{context}', context)
      .replace('{diff}', diff);

    return reviewLlmComplete(fullPrompt, true);
  }

  /**
   * The "Intelligence Layer" that interprets all reports and complexity
   */
  static async summarizeFindings(fullReport: string, complexityScore: number): Promise<{ text: string, severity: string }> {
    const summaryPrompt = `
      You are the Sentinel-AG Orchestrator. 
      Analyze this code review report and a Cognitive Load score of ${complexityScore}/10.
      
      Tasks:
      1. Provide a 2-sentence executive summary.
      2. Determine Severity: 'High' (if security issues exist or complexity > 8), 'Medium', or 'Low'.
      3. Return strictly in JSON format: {"text": "...", "severity": "..."}

      Report:
      ${fullReport}
    `;

    const text = await reviewLlmSummarize(summaryPrompt);

    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  }

  /**
   * Compact markdown for a standalone GitHub comment (suggestions only).
   */
  static async buildSuggestionsComment(fullReport: string): Promise<string> {
    const clipped = fullReport.length > 12000 ? fullReport.slice(0, 12000) + '\n\n…(truncated)' : fullReport;
    const prompt = `From this multi-agent PR review, output **ONLY** valid Markdown for GitHub (no JSON fence).

Use exactly these sections:

### Priority suggestions
- Up to 6 bullets: imperative, concrete, actionable for the author.

### Follow-ups
- Up to 4 bullets: tests, docs, or refactors to consider later.

Keep bullets short. Do not repeat the entire review.

Review:
${clipped}`;

    return reviewLlmComplete(prompt, false);
  }

  /**
   * Maps narrative review text to concrete paths/lines from the LINE CATALOG for GitHub inline comments.
   */
  static async extractInlineReviewComments(
    diffExcerpt: string,
    lineCatalogText: string,
    agentNarrative: string
  ): Promise<ExtractedInlineComment[]> {
    const clippedDiff =
      diffExcerpt.length > 14000 ? diffExcerpt.slice(0, 14000) + '\n\n…(diff truncated)' : diffExcerpt;
    const clippedNarrative =
      agentNarrative.length > 16000 ? agentNarrative.slice(0, 16000) + '\n\n…(truncated)' : agentNarrative;

    const prompt = `You place pull-request review findings as GitHub **inline** comments (path + line on the NEW/right side).

LINE CATALOG — you may ONLY use these paths, and each line MUST be one of the integers listed for that path:
${lineCatalogText}

UNIFIED DIFF (excerpt):
${clippedDiff}

FINDINGS (turn into concise inline comments; no more than 120 words per comment body; GitHub-flavored markdown OK):
${clippedNarrative}

Return ONLY a JSON object: {"comments":[{"path":"exact/path/from/catalog","line":42,"category":"security|performance|architecture|suggestion","body":"..."}]}

Rules:
- At most 18 comments. Priority: security > performance > architecture > suggestion.
- Every path must match the LINE CATALOG exactly (character for character).
- Every line must appear in the comma-separated list for that path in the LINE CATALOG.
- Skip vague or duplicate points. No code fences inside body.
- If nothing can be anchored safely, return {"comments":[]}.`;

    const text = await reviewLlmSummarize(prompt);
    const cleanJson = text.replace(/```json|```/g, '').trim();
    let parsed: { comments?: unknown };
    try {
      parsed = JSON.parse(cleanJson) as { comments?: unknown };
    } catch {
      return [];
    }
    const raw = parsed.comments;
    if (!Array.isArray(raw)) return [];

    const out: ExtractedInlineComment[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const path = typeof rec.path === 'string' ? rec.path.trim() : '';
      const line = typeof rec.line === 'number' ? rec.line : Number.NaN;
      const catRaw = typeof rec.category === 'string' ? rec.category.toLowerCase().trim() : 'suggestion';
      const bodyRaw = typeof rec.body === 'string' ? rec.body.trim() : '';
      if (!path || !Number.isFinite(line) || !bodyRaw) continue;
      const category = ['security', 'performance', 'architecture', 'suggestion'].includes(catRaw) ? catRaw : 'suggestion';
      const label = CATEGORY_LABEL[category] ?? '💡 Note';
      const body = `**${label}**\n\n${bodyRaw}`;
      out.push({ path, line, category, body });
    }
    return out;
  }
}