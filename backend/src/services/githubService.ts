import { Octokit } from '@octokit/rest';
import { config } from '../config/env';

const octokit = new Octokit({
  auth: config.githubToken,
});

export class GitHubService {
  static async getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    try {
      const response = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner,
        repo,
        pull_number: pullNumber,
        headers: {
          accept: 'application/vnd.github.v3.diff',
        },
      });

      return response.data as unknown as string;
    } catch (error) {
      console.error('Error fetching PR diff:', error);
      throw new Error('Failed to fetch pull request diff');
    }
  }
}