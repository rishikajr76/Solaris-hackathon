import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

const SYSTEM = `You are **Sentinel-AG Copilot**, the in-product assistant for an AI code governance platform.

You help with:
- How Sentinel-AG works (GitHub webhooks → multi-agent review → Supabase + dashboard)
- PR review concepts: security, performance, architecture, cognitive / complexity scores
- Hackathon / demo setup: env vars, Supabase tables, realtime feeds

Rules: Be concise and practical. Use markdown (headings, bullets, code fences) when it helps. If you do not know project-specific secrets or URLs, say so and suggest where in the dashboard they live. Do not fabricate API keys.`;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

/**
 * Multi-turn chat using Gemini (same API key as PR review agents).
 */
export async function runCopilotChat(
  messages: ChatTurn[],
  pageContext?: string
): Promise<string> {
  const key = config.googleApiKey?.trim();
  if (!key) {
    throw new Error(
      'GOOGLE_API_KEY or GEMINI_API_KEY is not set — Copilot is unavailable until configured in backend/.env'
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('At least one message is required');
  }

  const copy = [...messages];
  const last = copy.pop();
  if (!last || last.role !== 'user') {
    throw new Error('The last message must be from the user');
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM,
  });

  const history = copy.map((m) => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
    },
  });

  const ctx =
    pageContext && pageContext.trim()
      ? `[User current path: ${pageContext.trim()}]\n\n`
      : '';
  const result = await chat.sendMessage(ctx + last.content);
  return result.response.text();
}
