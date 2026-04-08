import { AIAgentService } from './aiAgentService';
import { calculateCognitiveComplexity } from '../utils/complexityAnalyzer';
import { saveReviewComplexity } from './databaseService';

export class ReviewOrchestrator {
  static async processDiff(diff: string, prId: number): Promise<string> {
    const context = 'Project rules: Use async/await, avoid global variables, follow REST API conventions.'; // Placeholder

    const reviewReport = await AIAgentService.reviewCode(diff, context);
    const complexityScore = calculateCognitiveComplexity(diff);

    console.log(`AI Review Report for PR ${prId}:`, reviewReport);
    console.log(`Calculated complexity score for PR ${prId}:`, complexityScore);

    await saveReviewComplexity(prId, complexityScore);

    return reviewReport;
  }
}