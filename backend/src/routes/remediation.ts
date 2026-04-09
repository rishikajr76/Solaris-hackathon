import type { Request, Response } from 'express';
import { upsertRepository } from '../services/reviewMetricsService';
import { runRemediationAgent } from '../services/remediationAgent';
import { postSelfHealingFixComment } from '../services/githubRemediationPublisher';
import { embedTextForTribalSearch } from '../services/embeddingService';
import { insertTribalMemoryRow } from '../services/tribalMemoryService';
import type { RemediationViolation } from '../types/remediation';

function parseViolation(body: unknown): RemediationViolation | null {
  if (!body || typeof body !== 'object') return null;
  const root = body as Record<string, unknown>;
  const o =
    root.violation && typeof root.violation === 'object'
      ? (root.violation as Record<string, unknown>)
      : root;
  const filePath = typeof o.filePath === 'string' ? o.filePath.trim() : '';
  const errorType = typeof o.errorType === 'string' ? o.errorType.trim() : '';
  if (!filePath || !errorType) return null;
  const lineRaw = o.lineNumber;
  const lineNumber =
    typeof lineRaw === 'number' && Number.isFinite(lineRaw)
      ? lineRaw
      : typeof lineRaw === 'string' && lineRaw.trim()
        ? parseInt(lineRaw, 10)
        : null;
  const message = typeof o.message === 'string' ? o.message : undefined;
  return {
    filePath,
    lineNumber: lineNumber != null && !Number.isNaN(lineNumber) ? lineNumber : null,
    errorType,
    message,
  };
}

function parseCommonPrContext(body: Record<string, unknown>): {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
} | null {
  const owner = typeof body.owner === 'string' ? body.owner.trim() : '';
  const repo = typeof body.repo === 'string' ? body.repo.trim() : '';
  const pr = body.pullNumber;
  const headSha = typeof body.headSha === 'string' ? body.headSha.trim() : '';
  const pullNumber = typeof pr === 'number' ? pr : typeof pr === 'string' ? parseInt(pr, 10) : NaN;
  if (!owner || !repo || !Number.isFinite(pullNumber) || !headSha) return null;
  return { owner, repo, pullNumber, headSha };
}

/**
 * POST /api/remediation/heal
 * Body: { violation, owner, repo, pullNumber, headSha, repositoryId? }
 * Returns unified diff + explanation + tribal hits (no GitHub write).
 */
export async function postHeal(req: Request, res: Response): Promise<void> {
  try {
    const v = parseViolation(req.body);
    const ctx = req.body && typeof req.body === 'object' ? parseCommonPrContext(req.body as Record<string, unknown>) : null;
    if (!v || !ctx) {
      res.status(400).json({
        error: 'Invalid body',
        message:
          'Expected { violation: { filePath, errorType, lineNumber?, message? }, owner, repo, pullNumber, headSha, repositoryId? }',
      });
      return;
    }

    let repositoryId: string | null =
      typeof (req.body as Record<string, unknown>).repositoryId === 'string'
        ? String((req.body as Record<string, unknown>).repositoryId).trim() || null
        : null;
    if (!repositoryId) {
      try {
        repositoryId = await upsertRepository(ctx.owner, ctx.repo);
      } catch {
        repositoryId = null;
      }
    }

    const result = await runRemediationAgent({
      owner: ctx.owner,
      repo: ctx.repo,
      pullNumber: ctx.pullNumber,
      headSha: ctx.headSha,
      repositoryId,
      violation: v,
    });

    res.status(200).json({
      unifiedDiff: result.unifiedDiff,
      explanation: result.explanation,
      tribalHits: result.tribalHits,
      model: result.model,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('postHeal:', msg);
    res.status(500).json({ error: 'Remediation failed', message: msg });
  }
}

/**
 * POST /api/remediation/post-comment
 * Body: same as /heal — runs agent then posts inline GitHub comment with Apply Fix metadata.
 */
export async function postRemediationComment(req: Request, res: Response): Promise<void> {
  try {
    const v = parseViolation(req.body);
    const ctx = req.body && typeof req.body === 'object' ? parseCommonPrContext(req.body as Record<string, unknown>) : null;
    if (!v || !ctx) {
      res.status(400).json({
        error: 'Invalid body',
        message:
          'Expected { violation: { filePath, errorType, lineNumber?, message? }, owner, repo, pullNumber, headSha, repositoryId? }',
      });
      return;
    }
    if (v.lineNumber == null || v.lineNumber < 1) {
      res.status(400).json({
        error: 'lineNumber required',
        message: 'GitHub inline comments require a positive line number on the right-hand diff.',
      });
      return;
    }

    let repositoryId: string | null =
      typeof (req.body as Record<string, unknown>).repositoryId === 'string'
        ? String((req.body as Record<string, unknown>).repositoryId).trim() || null
        : null;
    if (!repositoryId) {
      try {
        repositoryId = await upsertRepository(ctx.owner, ctx.repo);
      } catch {
        repositoryId = null;
      }
    }

    const result = await runRemediationAgent({
      owner: ctx.owner,
      repo: ctx.repo,
      pullNumber: ctx.pullNumber,
      headSha: ctx.headSha,
      repositoryId,
      violation: v,
    });

    const tribalIds = result.tribalHits.map((h) => h.id).filter(Boolean);

    const gh = await postSelfHealingFixComment({
      owner: ctx.owner,
      repo: ctx.repo,
      pullNumber: ctx.pullNumber,
      headSha: ctx.headSha,
      violationFilePath: v.filePath,
      line: v.lineNumber,
      explanationMarkdown: result.explanation,
      unifiedDiff: result.unifiedDiff,
      tribalMemoryIds: tribalIds,
      violationType: v.errorType,
    });

    res.status(200).json({
      commentId: gh.id,
      commentUrl: gh.url,
      unifiedDiff: result.unifiedDiff,
      explanation: result.explanation,
      tribalHits: result.tribalHits,
      model: result.model,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('postRemediationComment:', msg);
    res.status(500).json({ error: 'Post comment failed', message: msg });
  }
}

/**
 * POST /api/remediation/tribal-memory
 * Ingest one tribal-memory row (for tests or admin). Requires repositoryId or owner+repo.
 */
export async function postTribalMemoryIngest(req: Request, res: Response): Promise<void> {
  try {
    const o = req.body as Record<string, unknown>;
    const owner = typeof o.owner === 'string' ? o.owner.trim() : '';
    const repo = typeof o.repo === 'string' ? o.repo.trim() : '';
    let repositoryId = typeof o.repositoryId === 'string' ? o.repositoryId.trim() : '';
    if (!repositoryId && owner && repo) {
      repositoryId = await upsertRepository(owner, repo);
    }
    if (!repositoryId) {
      res.status(400).json({ error: 'repositoryId or owner+repo required' });
      return;
    }

    const violationType = typeof o.violationType === 'string' ? o.violationType : '';
    const filePath = typeof o.filePath === 'string' ? o.filePath : '';
    const problemSummary = typeof o.problemSummary === 'string' ? o.problemSummary : '';
    const fixUnifiedDiff = typeof o.fixUnifiedDiff === 'string' ? o.fixUnifiedDiff : '';
    if (!violationType || !problemSummary || !fixUnifiedDiff) {
      res.status(400).json({
        error: 'violationType, problemSummary, fixUnifiedDiff required',
      });
      return;
    }

    const lineNumber =
      typeof o.lineNumber === 'number' ? o.lineNumber : o.lineNumber != null ? parseInt(String(o.lineNumber), 10) : null;
    const fixExplanation = typeof o.fixExplanation === 'string' ? o.fixExplanation : null;
    const sourcePrNumber =
      typeof o.sourcePrNumber === 'number' ? o.sourcePrNumber : o.sourcePrNumber != null ? parseInt(String(o.sourcePrNumber), 10) : null;

    const embedSource =
      typeof o.embedText === 'string' && o.embedText.trim()
        ? o.embedText
        : `${violationType} ${problemSummary} ${filePath}`;
    const embedding = await embedTextForTribalSearch(embedSource);

    await insertTribalMemoryRow({
      repositoryId,
      violationType,
      filePath,
      lineNumber: lineNumber != null && !Number.isNaN(lineNumber) ? lineNumber : null,
      problemSummary,
      fixUnifiedDiff,
      fixExplanation,
      sourcePrNumber: sourcePrNumber != null && !Number.isNaN(sourcePrNumber) ? sourcePrNumber : null,
      embedding,
    });

    res.status(201).json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: 'Ingest failed', message: msg });
  }
}
