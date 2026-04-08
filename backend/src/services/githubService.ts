import { Octokit } from '@octokit/rest';
import { config } from '../config/env';

const octokit = new Octokit({
  auth: config.githubToken,
});

export class GitHubService {
  /**
   * Fetches the raw diff of a Pull Request.
   * This is passed to the AST Analyzer and AI Agents.
   */
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

      // Octokit type casting for raw diff strings
      return response.data as unknown as string;
    } catch (error: any) {
      console.error('❌ GitHub SDK Error (Diff):', error.message);
      throw new Error(`Failed to fetch diff for PR #${pullNumber}`);
    }
  }

  /**
   * Fetches PR metadata. 
   * Useful for the "Perceive" phase to understand the PR's intent from the title/description.
   */
  static async getPullRequestInfo(owner: string, repo: string, pullNumber: number) {
    try {
      const { data } = await octokit.pulls.get({
        owner,
        repo,
        pull_number: pullNumber,
      });
      return {
        title: data.title,
        description: data.body,
        baseBranch: data.base.ref,
        author: data.user.login
      };
    } catch (error: any) {
      console.error('❌ GitHub SDK Error (Info):', error.message);
      return null;
    }
  }
}