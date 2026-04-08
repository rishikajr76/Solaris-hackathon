import { Octokit } from '@octokit/rest';
import { config } from '../config/env';

const octokit = new Octokit({
  auth: config.githubToken,
});

export class GitHubPublisher {
  static async postReviewComment(owner: string, repo: string, pullNumber: number, body: string): Promise<void> {
    try {
      await octokit.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        body,
        event: 'COMMENT',
      });
    } catch (error) {
      console.error('Failed to publish GitHub review comment:', error);
      throw new Error('Unable to publish GitHub review comment');
    }
  }
}
