import { Octokit } from '@octokit/rest';
import { config } from '../config/env';

const octokit = new Octokit({
  auth: config.githubToken,
});

export type InlineReviewComment = {
  path: string;
  line: number;
  body: string;
};

export type ReviewPublishPayload = {
  summary: string;
  severity: string;
  cognitiveLoad: number;
  /**
   * Appended to the review body when no inline comments were posted (API rejects, or none validated).
   */
  fallbackDetailMarkdown: string;
};

const FOOTER = '\n\n---\n*Sentinel-AG · automated multi-agent review*';

export class GitHubPublisher {
  /**
   * One PR review with inline comments on changed lines (side: RIGHT) at head commit,
   * plus an executive summary in the review body.
   */
  static async postReviewBundle(
    owner: string,
    repo: string,
    pullNumber: number,
    headSha: string,
    p: ReviewPublishPayload,
    inlineComments: InlineReviewComment[]
  ): Promise<void> {
    const statusEmoji = p.severity === 'High' ? '🔴' : p.severity === 'Medium' ? '🟡' : '🟢';

    const inlineNote =
      inlineComments.length > 0
        ? `**Inline feedback:** ${inlineComments.length} comment(s) on the diff in **Files changed**.`
        : '';

    const detail =
      inlineComments.length > 0
        ? ''
        : `\n\n## Detailed findings\n\n${p.fallbackDetailMarkdown.trim()}${FOOTER}`;

    const mainBodyCore = [
      '## Sentinel-AG — Executive summary',
      `**Status:** ${statusEmoji} **${p.severity}** risk · **Cognitive load:** ${p.cognitiveLoad}/10`,
      '',
      p.summary.trim(),
      '',
      inlineNote,
      detail,
    ]
      .filter((s) => s.length > 0)
      .join('\n');

    const mainBody = inlineComments.length > 0 ? `${mainBodyCore}${FOOTER}` : mainBodyCore;

    if (!headSha?.trim()) {
      console.error('❌ GitHub createReview: missing head SHA');
      throw new Error('Missing pull-request head commit SHA for inline review');
    }

    try {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: headSha.trim(),
        body: mainBody,
        event: 'COMMENT',
        comments: inlineComments.map((c) => ({
          path: c.path,
          body: c.body,
          line: c.line,
          side: 'RIGHT' as const,
        })),
      });
      console.log(
        `✅ Published PR review (inline: ${inlineComments.length}) to ${owner}/${repo}#${pullNumber}`
      );
    } catch (error: unknown) {
      const msg = error && typeof error === 'object' && 'message' in error ? String((error as Error).message) : error;
      console.error('❌ GitHub createReview failed:', msg);
      throw new Error('Unable to publish GitHub PR review');
    }
  }
}
