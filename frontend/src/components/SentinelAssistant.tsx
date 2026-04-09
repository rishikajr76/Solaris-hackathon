import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Loader2,
  Bot,
  User,
  Trash2,
  BookOpen,
} from "lucide-react";
import {
  streamCopilotMessage,
  type ChatMessage,
  type CopilotStreamMeta,
} from "../lib/api";

const COPILOT_STORAGE_KEY = "sentinel-ag-copilot-messages-v1";
const MAX_STORED_MESSAGES = 100;

function parseStoredMessages(raw: string | null): ChatMessage[] {
  if (raw == null || raw === "") return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    const out: ChatMessage[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (o.role !== "user" && o.role !== "assistant") continue;
      if (typeof o.content !== "string") continue;
      out.push({ role: o.role, content: o.content });
    }
    return out.slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

function persistMessages(messages: ChatMessage[]) {
  try {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(COPILOT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota, private mode, or disabled storage — ignore
  }
}

const QUICK_PROMPTS = [
  "What does Sentinel-AG do in one paragraph?",
  "How does the PR review pipeline run end-to-end?",
  "Explain cognitive load / complexity score on PRs.",
  "What env vars does the backend need?",
];

/** Shown in UI only — not sent to the API so the first turn is always `user` (required by Gemini-style APIs). */
const COPILOT_GREETING =
  "Hi — I’m **Sentinel Copilot**. Ask about PR governance, the review pipeline, Supabase, or demo setup. I run on the same **Google Gemini** stack as your PR review agents.";

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
          isUser
            ? "border-cyan-500/40 bg-cyan-950/60 text-cyan-300"
            : "border-purple-500/40 bg-purple-950/50 text-purple-300"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3.5 ${
          isUser
            ? "bg-cyan-500/15 text-cyan-50 border border-cyan-500/25"
            : "bg-slate-800/90 text-slate-200 border border-slate-600/40"
        }`}
      >
        <div className="readable-prose whitespace-pre-wrap">{content}</div>
      </div>
    </motion.div>
  );
}

function StreamingAnswerPanel({
  streamMeta,
  streamVisible,
  connecting,
}: {
  streamMeta: CopilotStreamMeta | null;
  streamVisible: string;
  connecting: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-purple-500/40 bg-purple-950/50 text-purple-300">
        <Bot className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-3 rounded-2xl border border-slate-600/50 bg-slate-800/90 px-4 py-3.5 text-[15px] leading-relaxed">
        {connecting && !streamMeta ? (
          <div className="flex items-center gap-2 text-sm text-slate-400 readable-prose-muted">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-purple-400" />
            <span>Connecting to Copilot — wiring Gemini stream and citation graph…</span>
          </div>
        ) : null}

        {streamMeta ? (
          <>
            <p className="text-xs leading-snug text-slate-400 sm:text-sm">
              <span className="font-semibold tabular-nums text-cyan-400">{streamMeta.signalCount}</span>
              <span> contextual signals merged</span>
              <span className="text-slate-600"> · </span>
              <span className="text-slate-300">{streamMeta.sourceCount}</span>
              <span> knowledge anchors cited</span>
              {streamMeta.routePath ? (
                <>
                  <span className="text-slate-600"> · </span>
                  <span className="font-mono text-[10px] text-slate-500">{streamMeta.routePath}</span>
                </>
              ) : null}
            </p>

            <details open className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-medium text-slate-300 select-none sm:text-sm">
                Application thinking trace
              </summary>
              <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs text-slate-400 leading-relaxed sm:text-[13px]">
                {streamMeta.thinkingTrace.map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
              </ol>
            </details>

            <details className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2.5">
              <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-300 select-none sm:text-sm">
                <BookOpen className="h-3.5 w-3.5 text-cyan-500/80" />
                Sources consulted
              </summary>
              <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs leading-snug sm:text-[13px]">
                {streamMeta.sources.map((s) => (
                  <li key={s.id} className="leading-relaxed">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400/90 hover:text-cyan-300 hover:underline"
                    >
                      {s.title}
                    </a>
                    <span className="ml-1.5 rounded border border-slate-600/50 px-1 text-[10px] uppercase tracking-wide text-slate-500">
                      {s.category}
                    </span>
                  </li>
                ))}
              </ul>
            </details>

            <div className="border-t border-slate-700/50 pt-3 text-slate-100">
              <div className="readable-prose whitespace-pre-wrap">
                {streamVisible}
                <span
                  className="ml-0.5 inline-block min-h-[1em] w-2 translate-y-0.5 animate-pulse bg-cyan-400/70 align-text-bottom"
                  aria-hidden
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 leading-relaxed">
                Shown word-by-word for easier reading; the model still streams in larger chunks underneath.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Global Sentinel Copilot — SSE stream with citations, thinking trace, and typed reveal.
 */
export function SentinelAssistant() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    typeof window !== "undefined"
      ? parseStoredMessages(localStorage.getItem(COPILOT_STORAGE_KEY))
      : []
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamMeta, setStreamMeta] = useState<CopilotStreamMeta | null>(null);
  const [streamVisible, setStreamVisible] = useState("");
  const [bufferTick, setBufferTick] = useState(0);
  const streamBufferRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, busy, streamMeta, streamVisible, bufferTick]);

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => {
      setStreamVisible((prev) => {
        const full = streamBufferRef.current;
        if (prev === full) return prev;
        if (!full.startsWith(prev)) return full;
        const rest = full.slice(prev.length);
        const m = rest.match(/^(\S+\s*)/);
        if (m) return prev + m[1];
        return rest.length ? prev + rest[0] : prev;
      });
    }, 22);
    return () => window.clearInterval(id);
  }, [busy, bufferTick]);

  const clearHistory = () => {
    setError(null);
    setMessages([]);
    setStreamMeta(null);
    streamBufferRef.current = "";
    setStreamVisible("");
    setBufferTick(0);
    try {
      localStorage.removeItem(COPILOT_STORAGE_KEY);
    } catch {
      /* noop */
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    const nextMsgs: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMsgs);
    setInput("");
    setBusy(true);
    setStreamMeta(null);
    streamBufferRef.current = "";
    setStreamVisible("");
    setBufferTick(0);

    try {
      await streamCopilotMessage(nextMsgs, location.pathname, {
        onMeta: (m) => setStreamMeta(m),
        onDelta: (t) => {
          streamBufferRef.current += t;
          setBufferTick((n) => n + 1);
        },
        onDone: () => {
          const final = streamBufferRef.current;
          setMessages((prev) => [...prev, { role: "assistant", content: final }]);
          streamBufferRef.current = "";
          setStreamVisible("");
          setStreamMeta(null);
        },
        onError: (err) => {
          setError(err.message);
          setMessages((m) => m.slice(0, -1));
          streamBufferRef.current = "";
          setStreamVisible("");
          setStreamMeta(null);
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setMessages((m) => m.slice(0, -1));
      streamBufferRef.current = "";
      setStreamVisible("");
      setStreamMeta(null);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.div
            key="copilot-panel"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="fixed bottom-6 right-6 z-[200] flex w-[min(100vw-2rem,420px)] flex-col overflow-hidden rounded-2xl border border-slate-600/50 bg-slate-950/95 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl"
            style={{ maxHeight: "min(640px, calc(100vh - 5rem))" }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-gradient-to-r from-purple-950/40 to-cyan-950/40 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="h-5 w-5 text-cyan-400 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm truncate">Sentinel Copilot</p>
                  <p className="text-[10px] text-slate-500 truncate font-mono">{location.pathname}</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={clearHistory}
                  disabled={busy || messages.length === 0}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                  title="Clear chat history"
                  aria-label="Clear chat history"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                  aria-label="Close copilot"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-4 px-4 py-4 min-h-[220px]"
            >
              {messages.length === 0 ? (
                <Bubble role="assistant" content={COPILOT_GREETING} />
              ) : null}
              {messages.map((m, i) => (
                <Bubble key={`${i}-${m.role}-${m.content.slice(0, 12)}`} role={m.role} content={m.content} />
              ))}
              {busy ? (
                <StreamingAnswerPanel
                  streamMeta={streamMeta}
                  streamVisible={streamVisible}
                  connecting={!streamMeta}
                />
              ) : null}
              {error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-100 leading-relaxed">
                  {error}
                  <p className="mt-2 text-red-200/90 text-[13px]">
                    Ensure the backend is running and <code className="readable-inline-code border-red-500/40">GOOGLE_API_KEY</code> or{" "}
                    <code className="readable-inline-code border-red-500/40">GEMINI_API_KEY</code> is set in{" "}
                    <code className="readable-inline-code border-red-500/40">backend/.env</code>.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/10 px-3 py-2 flex flex-wrap gap-1.5 bg-slate-900/80">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => void send(q)}
                  className="text-[11px] leading-snug px-2.5 py-1.5 rounded-full border border-slate-600/60 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-40 max-w-[200px] text-left"
                >
                  {q.length > 42 ? `${q.slice(0, 40)}…` : q}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="border-t border-white/10 p-3 flex gap-2 bg-slate-950/90">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={busy}
                placeholder="Ask Copilot…"
                rows={2}
                className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-[15px] leading-relaxed text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="btn-primary self-end px-4 py-2 rounded-xl disabled:opacity-40 flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!open ? (
        <motion.button
          type="button"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[199] flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-purple-600/90 to-cyan-600/90 text-white shadow-lg shadow-cyan-500/15 backdrop-blur-md"
          aria-label="Open Sentinel Copilot"
        >
          <MessageCircle className="h-6 w-6" />
        </motion.button>
      ) : null}
    </>
  );
}
