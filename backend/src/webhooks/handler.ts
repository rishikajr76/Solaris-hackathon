import { Request, Response } from 'express';
import { PullRequestEvent } from '../types/github';
import { GitHubService } from '../services/githubService';
import { ReviewOrchestrator } from '../services/ReviewOrchestrator';

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const event = req.body as PullRequestEvent;
    const eventType = req.get('X-GitHub-Event');

    // 1. Structural Filter
    if (eventType !== 'pull_request') {
      res.status(200).send('Ignoring non-PR event');
      return;
    }

    // 2. Action Filter (Only process new code or updates)
    if (!['opened', 'synchronize', 'reopened'].includes(event.action)) {
      res.status(200).send(`Action ${event.action} ignored`);
      return;
    }

    const owner = event.repository.owner.login;
    const repo = event.repository.name;
    const pullNumber = event.number;

    console.log(`🚀 Sentinel-AG: Triggering analysis for ${owner}/${repo}#${pullNumber}`);

    // 3. The "Hackathon Speed" Trick: 
    // We send 202 (Accepted) immediately so GitHub is happy.
    // The heavy AI work happens in the background.
    res.status(202).send('Sentinel-AG has started the review process.');

    // Fire-and-forget background execution
    (async () => {
      try {
        const diff = await GitHubService.getPullRequestDiff(owner, repo, pullNumber);
        let headSha = event.pull_request?.head?.sha?.trim() ?? '';
        if (!headSha) {
          headSha = (await GitHubService.getPullRequestHeadSha(owner, repo, pullNumber)) ?? '';
        }
        await ReviewOrchestrator.processDiff(diff, owner, repo, pullNumber, headSha);
        console.log(`✅ Sentinel-AG: Successfully completed review for PR #${pullNumber}`);
      } catch (innerError) {
        console.error(`❌ Sentinel-AG: Background process failed for PR #${pullNumber}:`, innerError);
      }
    })();

  } catch (error) {
    console.error('💥 Webhook Error:', error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
}