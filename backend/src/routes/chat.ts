import type { Request, Response } from 'express';
import { runCopilotChat, runCopilotChatStream, type ChatTurn } from '../services/chatService';
import { buildCopilotStreamMeta } from '../services/copilotMeta';

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

/** Gemini (and some APIs) require history to start with `user`, not `assistant`. */
function stripLeadingAssistants(messages: ChatTurn[]): ChatTurn[] {
  let i = 0;
  while (i < messages.length && messages[i].role === 'assistant') i++;
  return messages.slice(i);
}

export async function postChat(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseMessages(req.body);
    if (!parsed) {
      res.status(400).json({
        error: 'Invalid body: expect { messages: [{ role: "user"|"assistant", content: string }], pageContext?: string }',
      });
      return;
    }

    const messages = stripLeadingAssistants(parsed);
    if (messages.length === 0) {
      res.status(400).json({
        error: 'After removing leading assistant messages, no turns remain — send at least one user message.',
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
      message.includes('GOOGLE_API_KEY') ||
      message.includes('GEMINI_API_KEY') ||
      message.includes('Copilot is unavailable') ||
      message.includes('not set')
        ? 503
        : 500;
    console.error('POST /api/chat:', message);
    res.status(status).json({ error: message });
  }
}

function writeSse(res: Response, payload: object): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Server-Sent Events: `meta` (citations + thinking trace), `delta` (text chunks), `done`.
 */
export async function postChatStream(req: Request, res: Response): Promise<void> {
  const parsed = parseMessages(req.body);
  if (!parsed) {
    res.status(400).json({
      error: 'Invalid body: expect { messages: [{ role: "user"|"assistant", content: string }], pageContext?: string }',
    });
    return;
  }

  const messages = stripLeadingAssistants(parsed);
  if (messages.length === 0) {
    res.status(400).json({
      error:
        'After removing leading assistant messages, no turns remain — send at least one user message.',
    });
    return;
  }

  if (messages.length > 24) {
    res.status(400).json({ error: 'Too many messages (max 24)' });
    return;
  }

  const pageContext =
    typeof req.body?.pageContext === 'string' ? req.body.pageContext : undefined;

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  const maybeFlush = (res as Response & { flush?: () => void }).flush;
  if (typeof maybeFlush === 'function') {
    maybeFlush.call(res);
  }

  try {
    const meta = buildCopilotStreamMeta(pageContext);
    writeSse(res, { type: 'meta', ...meta });

    await runCopilotChatStream(messages, pageContext, (text) => {
      writeSse(res, { type: 'delta', text });
    });
    writeSse(res, { type: 'done' });
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Chat stream failed';
    console.error('POST /api/chat/stream:', message);
    try {
      writeSse(res, { type: 'error', message });
      res.end();
    } catch {
      /* connection closed */
    }
  }
}
