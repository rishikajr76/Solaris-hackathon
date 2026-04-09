import { analyzeComplexity } from '../analysis/astAnalyzer';
import { AgentBoard } from '../agents/agentBoard';
import { retrieveProjectContext } from '../rag/contextRetriever';
import { formatLineCatalogForPrompt, parseDiffLineCatalog, validateInlineComments } from '../utils/diffLineCatalog';
import { GitHubPublisher } from './githubPublisher';
import { GitHubService } from './githubService';
import { upsertRepository, saveReviewRecord, saveViolations } from './reviewMetricsService';
import { AIAgentService } from './aiAgentService';

export class ReviewOrchestrator {
  static async processDiff(diff: string, owner: string, repo: string, prId: number, headSha: string): Promise<string> {
    try {
      // 1. PERCEIVE: Get Context and Calculate Cognitive Load first
      const [context, complexity] = await Promise.all([
        retrieveProjectContext(diff),
        analyzeComplexity(diff)
      ]);

      // 2. REASON: Multi-Agent Review (Now aware of Complexity)
      const agentResult = await AgentBoard.review(diff, context);
      const { reviewReport, summary, severity } = agentResult;

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

      let suggestionsMd = '';
      try {
        suggestionsMd = await AIAgentService.buildSuggestionsComment(reviewReport);
      } catch (e) {
        console.warn('⚠️ Suggestions comment skipped:', e);
        suggestionsMd = '_Suggestions could not be generated; see dashboard for full report._';
      }

      const agentNarrative = [
        '### Security',
        agentResult.securityReport,
        '### Performance',
        agentResult.performanceReport,
        '### Architecture',
        agentResult.architectureReport,
        '### Suggestions',
        suggestionsMd,
      ].join('\n\n');

      const catalog = parseDiffLineCatalog(diff);
      const lineCatalogText = formatLineCatalogForPrompt(catalog);

      let inlineComments: ReturnType<typeof validateInlineComments> = [];
      if (catalog.byPath.size > 0) {
        try {
          const extracted = await AIAgentService.extractInlineReviewComments(diff, lineCatalogText, agentNarrative);
          inlineComments = validateInlineComments(extracted, catalog, 20);
        } catch (e) {
          console.warn('⚠️ Inline review comments skipped:', e);
        }
      }

      const fallbackDetailMarkdown =
        agentNarrative.length > 50000 ? agentNarrative.slice(0, 50000) + '\n\n…(truncated)' : agentNarrative;

      let headCommit = headSha?.trim() ?? '';
      if (!headCommit) {
        headCommit = (await GitHubService.getPullRequestHeadSha(owner, repo, prId)) ?? '';
      }
      if (!headCommit) {
        console.warn('⚠️ Skipping GitHub review publish: could not resolve pull-request head SHA');
      } else {
        await GitHubPublisher.postReviewBundle(
          owner,
          repo,
          prId,
          headCommit,
          {
            summary,
            severity,
            cognitiveLoad: complexity.complexityScore,
            fallbackDetailMarkdown,
          },
          inlineComments
        );
      }

      return reviewReport;
    } catch (error) {
      console.error(`❌ Orchestration failed for ${owner}/${repo}#${prId}:`, error);
      throw error;
    }
  }
}