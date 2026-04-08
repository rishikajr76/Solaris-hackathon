import { analyzeComplexity } from '../analysis/astAnalyzer';
import { AgentBoard } from '../agents/agentBoard';
import { retrieveProjectContext } from '../rag/contextRetriever';
import { GitHubPublisher } from './githubPublisher';
import { upsertRepository, saveReviewRecord, saveViolations } from './reviewMetricsService';

export class ReviewOrchestrator {
  static async processDiff(diff: string, owner: string, repo: string, prId: number): Promise<string> {
    try {
      // 1. PERCEIVE: Get Context and Calculate Cognitive Load first
      const [context, complexity] = await Promise.all([
        retrieveProjectContext(diff),
        analyzeComplexity(diff)
      ]);

      // 2. REASON: Multi-Agent Review (Now aware of Complexity)
      const { reviewReport, summary, severity } = await AgentBoard.review(diff, context);

      // 3. PERSIST: Save to Supabase for the Dashboard
      const repoId = await upsertRepository(owner, repo);
      const reviewId = await saveReviewRecord(
      repoId, 
      prId, 
      complexity.complexityScore, 
      'completed',    // status
      summary,        // NEW: AI summary for Home Feed
      severity,       // NEW: 'High' | 'Medium' | 'Low' for UI color
      reviewReport    // NEW: Full markdown report for Dashboard
    );

      // Save real metrics instead of placeholders
      await saveViolations(reviewId, [
        { type: 'Complexity', severity: severity, line_number: null, message: `Cognitive Load Score: ${complexity.complexityScore}/10` },
        { type: 'General', severity: severity, line_number: null, message: summary }
      ]);

      // 4. ACT: Publish back to GitHub with Branding
      await GitHubPublisher.postReviewComment(
        owner, 
        repo, 
        prId, 
        reviewReport, 
        severity, 
        complexity.complexityScore
      );

      return reviewReport;
    } catch (error) {
      console.error(`❌ Orchestration failed for ${owner}/${repo}#${prId}:`, error);
      throw error;
    }
  }
}