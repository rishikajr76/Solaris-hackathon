import { analyzeComplexity } from '../analysis/astAnalyzer';
import { AgentBoard } from '../agents/agentBoard';
import { retrieveProjectContext } from '../rag/contextRetriever';
import { GitHubPublisher } from './githubPublisher';
import { upsertRepository, saveReviewRecord, saveViolation } from './reviewMetricsService';

export class ReviewOrchestrator {
  static async processDiff(diff: string, owner: string, repo: string, prId: number): Promise<string> {
    const context = await retrieveProjectContext(diff);
    const { reviewReport } = await AgentBoard.review(diff, context);
    const complexity = analyzeComplexity(diff);

    console.log(`AI Review Report for ${owner}/${repo}#${prId}:`, reviewReport);
    console.log(`Calculated complexity score for PR ${prId}:`, complexity.complexityScore);

    const repoId = await upsertRepository(owner, repo);
    const reviewId = await saveReviewRecord(repoId, prId, complexity.complexityScore, 'completed');

    const violationTypes = ['Security', 'Performance', 'Architecture'];
    await Promise.all(
      violationTypes.map((type) =>
        saveViolation(reviewId, type, 'medium', null, `Review generated for ${type}`)
      )
    );

    await GitHubPublisher.postReviewComment(owner, repo, prId, reviewReport);

    return reviewReport;
  }
}
