import { AIAgentService } from '../services/aiAgentService';

export interface AgentReviewResult {
  reviewReport: string;
  summary: string;
}

export class AgentBoard {
  static async review(diff: string, context: string): Promise<AgentReviewResult> {
    const reviewReport = await AIAgentService.reviewCode(diff, context);
    const summary = AgentBoard.createSummary(reviewReport);
    return { reviewReport, summary };
  }

  private static createSummary(report: string): string {
    const lines = report.split('\n');
    const summaryLines = lines.slice(0, 5).filter((line) => line.trim().length > 0);
    return summaryLines.join('\n');
  }
}
