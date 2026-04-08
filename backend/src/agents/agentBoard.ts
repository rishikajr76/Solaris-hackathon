import { AIAgentService } from '../services/aiAgentService';
import { calculateCognitiveComplexity } from '../utils/complexityAnalyzer';

export interface AgentReviewResult {
  reviewReport: string;
  summary: string;
  severity: 'Low' | 'Medium' | 'High';
  cognitiveLoad: number; 
}

export class AgentBoard {
  static async review(diff: string, repoContext: string): Promise<AgentReviewResult> {
    // 1. Calculate Cognitive Load (returns a number, e.g., 7)
    const complexity = calculateCognitiveComplexity(diff);

    // 2. Multi-Agent Orchestration (Parallel)
    const [securityRes, perfRes, archRes] = await Promise.all([
      AIAgentService.reviewCode(diff, repoContext, "security"),
      AIAgentService.reviewCode(diff, repoContext, "performance"),
      AIAgentService.reviewCode(diff, repoContext, "architecture")
    ]);

    const fullReport = `
### 🛡️ Security Analysis
${securityRes}

### ⚡ Performance Audit
${perfRes}

### 🏗️ Architectural Review
${archRes}
    `.trim();

    // 3. Summarization (Pass 'complexity' directly as it is already a number)
    const summaryData = await AIAgentService.summarizeFindings(fullReport, complexity);

    return {
      reviewReport: fullReport,
      summary: summaryData.text,
      severity: summaryData.severity as 'Low' | 'Medium' | 'High',
      cognitiveLoad: complexity // Use the number here too
    };
  }
}