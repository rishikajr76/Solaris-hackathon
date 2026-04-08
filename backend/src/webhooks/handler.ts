import { Request, Response } from 'express';
import { PullRequestEvent } from '../types/github';
import { GitHubService } from '../services/githubService';
import { ReviewOrchestrator } from '../services/ReviewOrchestrator';

export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const event = req.body as PullRequestEvent;
    const eventType = req.get('X-GitHub-Event');

    if (eventType !== 'pull_request') {
      console.log(`Ignoring event type: ${eventType}`);
      res.status(200).send('Event ignored');
      return;
    }

    if (event.action !== 'opened' && event.action !== 'synchronize') {
      console.log(`Ignoring PR action: ${event.action}`);
      res.status(200).send('Action ignored');
      return;
    }

    const { owner, repo, pullNumber } = {
      owner: event.repository.owner.login,
      repo: event.repository.name,
      pullNumber: event.number,
    };

    console.log(`Processing PR ${pullNumber} in ${owner}/${repo} for action: ${event.action}`);

    // Fetch the diff
    const diff = await GitHubService.getPullRequestDiff(owner, repo, pullNumber);

    // Process the diff and save review metrics
    await ReviewOrchestrator.processDiff(diff, pullNumber);

    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).send('Internal server error');
  }
}