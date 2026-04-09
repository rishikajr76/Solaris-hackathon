import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerativeModel } from '@google/generative-ai';
import { config } from '../config/env';

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  const key = config.googleApiKey?.trim();
  if (!key) {
    throw new Error(
      'GOOGLE_API_KEY is not set in backend/.env. Required for AI review (webhook pipeline).'
    );
  }
  if (!genAI) genAI = new GoogleGenerativeAI(key);
  return genAI;
}

function getProModel(): GenerativeModel {
  return getGenAI().getGenerativeModel({ model: 'gemini-1.5-pro' });
}

function getFlashModel(): GenerativeModel {
  return getGenAI().getGenerativeModel({ model: 'gemini-1.5-flash' });
}

const prompts: Record<string, string> = {
  security: `You are a Security Auditor. Focus: SQLi, Secrets, XSS, and Auth. Context: {context}. Diff: {diff}`,
  performance: `You are a Performance Expert. Focus: Complexity, Memory, and Async bottlenecks. Context: {context}. Diff: {diff}`,
  architecture: `You are a Lead Architect. Focus: DRY, Design Patterns, and Project Rules. Context: {context}. Diff: {diff}`
};

export class AIAgentService {
  /**
   * Called by AgentBoard to run a specific specialized agent
   */
  static async reviewCode(diff: string, context: string, role: 'security' | 'performance' | 'architecture'): Promise<string> {
    const promptTemplate = prompts[role];
    const fullPrompt = promptTemplate
      .replace('{context}', context)
      .replace('{diff}', diff);

    const result = await getProModel().generateContent(fullPrompt);
    return result.response.text();
  }

  /**
   * The "Intelligence Layer" that interprets all reports and complexity
   */
  static async summarizeFindings(fullReport: string, complexityScore: number): Promise<{ text: string, severity: string }> {
    const summaryPrompt = `
      You are the Sentinel-AG Orchestrator. 
      Analyze this code review report and a Cognitive Load score of ${complexityScore}/10.
      
      Tasks:
      1. Provide a 2-sentence executive summary.
      2. Determine Severity: 'High' (if security issues exist or complexity > 8), 'Medium', or 'Low'.
      3. Return strictly in JSON format: {"text": "...", "severity": "..."}

      Report:
      ${fullReport}
    `;

    const result = await getFlashModel().generateContent(summaryPrompt);
    const text = result.response.text();
    
    // Clean JSON from Markdown blocks if present
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  }
}