import { Octokit } from '@octokit/rest';
import { config } from '../config/env';
import type { ApplyFixMetadataV1 } from '../types/remediation';
import { buildRemediationCommentBody } from './applyFixMetadata';

const octokit = new Octokit({ auth: config.githubToken });

export type PostRemediationCommentParams = {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  path: string;
  line: number;
  /** Markdown + hidden Apply Fix metadata */
  body: string;
};

/**
 * Posts a single inline review comment on the PR diff (right side) using Octokit.
 * The body should be built with `buildRemediationCommentBody` so the frontend can detect Apply Fix metadata.
 */
export async function postRemediationInlineComment(p: PostRemediationCommentParams): Promise<{ id: number; url: string }> {
  if (!config.githubToken?.trim()) {
    throw new Error('GITHUB_TOKEN is not set');
  }
  if (!p.headSha?.trim()) {
    throw new Error('headSha is required for inline review comments');
  }

  try {
    const { data } = await octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
      owner: p.owner,
      repo: p.repo,
      pull_number: p.pullNumber,
      body: p.body,
      commit_id: p.headSha.trim(),
      path: p.path,
      line: p.line,
      side: 'RIGHT',
    });

    const id = typeof data.id === 'number' ? data.id : Number(data.id);
    const url = typeof data.html_url === 'string' ? data.html_url : '';
    return { id, url };
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : String(e);
    console.error('❌ postRemediationInlineComment failed:', msg);
    throw new Error(`GitHub inline comment failed: ${msg}`);
  }
}

/**
 * Convenience: builds markdown explanation + Apply Fix metadata and posts the inline comment.
 */
export async function postSelfHealingFixComment(params: {
  owner: string;
  repo: string;
  pullNumber: number;
  headSha: string;
  violationFilePath: string;
  line: number;
  explanationMarkdown: string;
  unifiedDiff: string;
  tribalMemoryIds: string[];
  violationType: string;
}): Promise<{ id: number; url: string }> {
  const meta: ApplyFixMetadataV1 = {
    sentinelAg: {
      kind: 'apply_fix',
      version: 1,
      patch: params.unifiedDiff,
      filePath: params.violationFilePath,
      line: params.line,
      violationType: params.violationType,
      tribalMemoryIds: params.tribalMemoryIds,
      owner: params.owner,
      repo: params.repo,
      pullNumber: params.pullNumber,
      headSha: params.headSha,
    },
  };

  const md = [
    '### Sentinel-AG — Self-healing suggestion',
    '',
    params.explanationMarkdown.trim(),
    '',
    '**Suggested patch (unified diff)**',
    '',
    '```diff',
    params.unifiedDiff.trim() || '(empty)',
    '```',
    '',
    '*This comment includes machine-readable metadata for the **Apply fix** action in Sentinel-AG.*',
  ].join('\n');

  const body = buildRemediationCommentBody(md, meta);

  return postRemediationInlineComment({
    owner: params.owner,
    repo: params.repo,
    pullNumber: params.pullNumber,
    headSha: params.headSha,
    path: params.violationFilePath,
    line: params.line,
    body,
  });
}
