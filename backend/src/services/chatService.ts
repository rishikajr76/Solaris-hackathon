import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env';

const SYSTEM = `You are **Sentinel-AG Copilot**, the in-product assistant for an AI code governance platform.

You help with:
- How Sentinel-AG works (GitHub webhooks → multi-agent review → Supabase + dashboard)
- PR review concepts: security, performance, architecture, cognitive / complexity scores
- Hackathon / demo setup: env vars, Supabase tables, realtime feeds

**Webhook facts (this codebase):** GitHub should POST to \`{PUBLIC_BACKEND}/api/webhook\` with \`WEBHOOK_SECRET\` matching \`backend/.env\`. One URL serves all repositories (no per-repo id in the path). Subscribe to **pull_request** only; actions **opened**, **synchronize**, **reopened** run reviews; **push** and **issue_comment** are ignored by the server.

**GitHub feedback:** After each review, Sentinel opens one **PR review** (executive summary + severity + cognitive load) and attaches **inline review comments** on changed lines in **Files changed** (anchored to the latest head commit). If comments cannot be placed on the diff, the same findings are included in the review body.

Rules: Be concise and practical. Use markdown (headings, bullets, code fences) when it helps. If you do not know project-specific secrets or URLs, say so and point users to \`backend/.env\` and their deployment docs. Do not fabricate API keys.`;

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  const key = config.googleApiKey?.trim();
  if (!key) {
    throw new Error(
      'GOOGLE_API_KEY or GEMINI_API_KEY is not set — Copilot is unavailable until configured in backend/.env'
    );
  }
  if (!genAI) genAI = new GoogleGenerativeAI(key);
  return genAI;
}

/**
 * Multi-turn chat using Gemini. Callers must pass turns that start with `user`
 * (the HTTP layer strips leading assistant messages for Gemini's startChat rules).
 */
export async function runCopilotChat(
  messages: ChatTurn[],
  pageContext?: string
): Promise<string> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('At least one message is required');
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') {
    throw new Error('The last message must be from the user');
  }

  const first = messages[0];
  if (first.role !== 'user') {
    throw new Error('Gemini requires the first turn to be from the user');
  }

  const copy = messages.slice(0, -1);
  const model = getGenAI().getGenerativeModel({
    model: config.geminiChatModel,
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

/**
 * Stream assistant tokens via Gemini (`sendMessageStream`).
 */
export async function runCopilotChatStream(
  messages: ChatTurn[],
  pageContext: string | undefined,
  onChunk: (text: string) => void
): Promise<void> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('At least one message is required');
  }

  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') {
    throw new Error('The last message must be from the user');
  }

  const first = messages[0];
  if (first.role !== 'user') {
    throw new Error('Gemini requires the first turn to be from the user');
  }

  const copy = messages.slice(0, -1);
  const model = getGenAI().getGenerativeModel({
    model: config.geminiChatModel,
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

  const streamResult = await chat.sendMessageStream(ctx + last.content);
  for await (const chunk of streamResult.stream) {
    const t = chunk.text();
    if (t) onChunk(t);
  }
}
