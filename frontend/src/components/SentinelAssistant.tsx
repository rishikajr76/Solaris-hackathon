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
} from "lucide-react";
import { sendCopilotMessage, type ChatMessage } from "../lib/api";

const QUICK_PROMPTS = [
  "What does Sentinel-AG do in one paragraph?",
  "How do I wire the GitHub webhook?",
  "Explain cognitive load / complexity score on PRs.",
  "What env vars does the backend need?",
];

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
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-cyan-500/15 text-cyan-50 border border-cyan-500/25"
            : "bg-slate-800/90 text-slate-200 border border-slate-600/40"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{content}</div>
      </div>
    </motion.div>
  );
}

/**
 * Global Sentinel Copilot — floating panel, routed context, backed by backend Gemini.
 */
export function SentinelAssistant() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi — I’m **Sentinel Copilot**. Ask about PR governance, webhooks, Supabase, or your hackathon demo. I use the same Gemini stack as your review agents.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, busy]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    const nextMsgs: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMsgs);
    setInput("");
    setBusy(true);

    try {
      const reply = await sendCopilotMessage(nextMsgs, location.pathname);
      setMessages([...nextMsgs, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setMessages((m) => m.slice(0, -1));
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
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Close copilot"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-4 px-4 py-4 min-h-[220px]"
            >
              {messages.map((m, i) => (
                <Bubble key={`${i}-${m.role}-${m.content.slice(0, 12)}`} role={m.role} content={m.content} />
              ))}
              {busy ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm px-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                  Thinking…
                </div>
              ) : null}
              {error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                  <p className="mt-1 text-red-300/80">
                    Ensure the backend is running and <code className="text-red-100">GOOGLE_API_KEY</code>{" "}
                    is set in <code className="text-red-100">backend/.env</code>.
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
                  className="text-[10px] px-2 py-1 rounded-full border border-slate-600/60 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-40"
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
                className="flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none disabled:opacity-50"
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
