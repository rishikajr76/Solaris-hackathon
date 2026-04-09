import type { Request, Response } from 'express';
import { runCopilotChat, type ChatTurn } from '../services/chatService';

function parseMessages(body: unknown): ChatTurn[] | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as Record<string, unknown>).messages;
  if (!Array.isArray(raw)) return null;
  const out: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    if (o.role !== 'user' && o.role !== 'assistant') return null;
    if (typeof o.content !== 'string' || !o.content.trim()) return null;
    out.push({ role: o.role, content: o.content.trim() });
  }
  return out.length > 0 ? out : null;
}

export async function postChat(req: Request, res: Response): Promise<void> {
  try {
    const messages = parseMessages(req.body);
    if (!messages) {
      res.status(400).json({
        error: 'Invalid body: expect { messages: [{ role: "user"|"assistant", content: string }], pageContext?: string }',
      });
      return;
    }

    const pageContext =
      typeof req.body?.pageContext === 'string' ? req.body.pageContext : undefined;

    if (messages.length > 24) {
      res.status(400).json({ error: 'Too many messages (max 24)' });
      return;
    }

    const content = await runCopilotChat(messages, pageContext);
    res.status(200).json({ role: 'assistant', content });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat failed';
    const status =
      message.includes('GOOGLE_API_KEY') || message.includes('GEMINI_API_KEY') || message.includes('not set')
        ? 503
        : 500;
    console.error('POST /api/chat:', message);
    res.status(status).json({ error: message });
  }
}
