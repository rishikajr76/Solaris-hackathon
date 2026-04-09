import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Activity,
  Zap,
  Shield,
  GitBranch,
  Radio,
  Cpu,
  Sparkles,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

type ReviewRow = {
  id: string;
  summary?: string | null;
  severity?: string | null;
  complexity_score?: number | null;
  created_at?: string | null;
  pr_id?: number | null;
  pr_number?: number | null;
  status?: string | null;
  title?: string | null;
};

type Severity = "High" | "Medium" | "Low";

function normalizeSeverity(s: string | null | undefined): Severity {
  const x = (s || "").toLowerCase();
  if (x === "high") return "High";
  if (x === "medium") return "Medium";
  return "Low";
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "just now";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "just now";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function prFromRow(r: ReviewRow): number | null {
  if (r.pr_id != null && !Number.isNaN(Number(r.pr_id))) return Number(r.pr_id);
  if (r.pr_number != null && !Number.isNaN(Number(r.pr_number))) return Number(r.pr_number);
  return null;
}

const SEVERITY_STYLES: Record<
  Severity,
  { border: string; glow: string; pill: string; icon: string }
> = {
  High: {
    border: "border-red-500/50",
    glow: "shadow-[0_0_32px_rgba(239,68,68,0.15)]",
    pill: "bg-red-500/20 text-red-300 border-red-500/40",
    icon: "text-red-400",
  },
  Medium: {
    border: "border-amber-500/45",
    glow: "shadow-[0_0_28px_rgba(245,158,11,0.12)]",
    pill: "bg-amber-500/15 text-amber-200 border-amber-500/35",
    icon: "text-amber-400",
  },
  Low: {
    border: "border-cyan-500/40",
    glow: "shadow-[0_0_28px_rgba(34,211,238,0.1)]",
    pill: "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
    icon: "text-cyan-400",
  },
};

const AGENT_PILLS = ["Security", "Performance", "Architecture"] as const;

export function LiveEngineFeed() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const markFresh = useCallback((id: string) => {
    setFreshIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 3200);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [{ data, error }, countRes] = await Promise.all([
        supabase
          .from("reviews")
          .select(
            "id, summary, severity, complexity_score, created_at, pr_id, pr_number, status, title"
          )
          .order("created_at", { ascending: false })
          .limit(9),
        supabase.from("reviews").select("*", { count: "exact", head: true }),
      ]);

      if (cancelled) return;
      if (error) console.error("Live feed fetch:", error);
      else setReviews((data as ReviewRow[]) || []);
      if (!countRes.error && countRes.count != null) setTotalCount(countRes.count);
      setLoading(false);
    };

    void load();

    const channel = supabase
      .channel("live_engine_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reviews" },
        (payload) => {
          const row = payload.new as ReviewRow;
          markFresh(row.id);
          setReviews((prev) => [row, ...prev].slice(0, 9));
          setTotalCount((c) => (c != null ? c + 1 : c));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [markFresh]);

  const stats = useMemo(() => {
    const highs = reviews.filter(
      (r) => normalizeSeverity(r.severity) === "High"
    ).length;
    const scores = reviews
      .map((r) => Number(r.complexity_score))
      .filter((n) => !Number.isNaN(n));
    const avg =
      scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : "—";
    return { highs, avg };
  }, [reviews]);

  return (
    <div className="relative mt-20 md:mt-24">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34,211,238,0.2), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(168,85,247,0.12), transparent 50%)",
        }}
      />

      <div className="flex flex-col items-center gap-4 mb-10">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <motion.div
            className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5"
            animate={{ boxShadow: ["0 0 0 0 rgba(34,211,238,0)", "0 0 0 6px rgba(34,211,238,0.08)", "0 0 0 0 rgba(34,211,238,0)"] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <Radio className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">
              Live
            </span>
          </motion.div>
          <div className="flex items-center gap-2 text-slate-500">
            <Activity className="h-4 w-4 text-purple-400" />
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">
              Engine feed
            </h2>
          </div>
        </div>
        <p className="text-center text-sm text-slate-400 max-w-2xl px-4">
          Multi-agent PR reviews as they land in your org — same pipeline that powers
          GitHub comments and your dashboard. Sub-second realtime via Supabase. Ask{" "}
          <span className="text-cyan-400/90">Sentinel Copilot</span> (floating button) for setup help.
        </p>
      </div>

      {!isSupabaseConfigured ? (
        <div className="max-w-3xl mx-auto rounded-2xl border border-amber-500/30 bg-amber-950/20 p-8 text-center">
          <Sparkles className="h-10 w-10 text-amber-400 mx-auto mb-4" />
          <p className="text-amber-100 font-medium mb-2">Demo needs Supabase env</p>
          <p className="text-sm text-slate-400">
            Add <code className="text-cyan-300">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-cyan-300">VITE_SUPABASE_ANON_KEY</code> to{" "}
            <code className="text-cyan-300">frontend/.env</code>, enable Realtime on table{" "}
            <code className="text-slate-500">reviews</code>, then refresh — webhook events will
            stream in here.
          </p>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs uppercase tracking-widest text-slate-500">
            Syncing governance stream…
          </p>
        </div>
      ) : (
        <>
          <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 mb-10 px-1">
            {[
              {
                label: "Indexed reviews",
                value: totalCount != null ? String(totalCount) : "—",
                sub: "database",
                Icon: Cpu,
              },
              {
                label: "High risk (sample)",
                value: String(stats.highs),
                sub: "in latest 9",
                Icon: Shield,
              },
              {
                label: "Avg cognitive load",
                value: stats.avg === "—" ? "—" : `${stats.avg}/10`,
                sub: "sample window",
                Icon: Zap,
              },
              {
                label: "Stream",
                value: "Realtime",
                sub: "postgres_changes",
                Icon: Radio,
              },
            ].map(({ label, value, sub, Icon }) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 backdrop-blur-sm"
              >
                <Icon className="h-4 w-4 text-purple-400 mb-2 opacity-80" />
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  {label}
                </p>
                <p className="text-lg font-bold text-white tabular-nums">{value}</p>
                <p className="text-[10px] text-slate-600">{sub}</p>
              </div>
            ))}
          </div>

          {reviews.length === 0 ? (
            <div className="max-w-xl mx-auto text-center py-16 px-6 rounded-2xl border border-dashed border-slate-700 bg-slate-950/30">
              <GitBranch className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-300 font-medium mb-2">Waiting for the first review</p>
              <p className="text-sm text-slate-500">
                Point a GitHub webhook at your Sentinel{" "}
                <code className="text-cyan-500/90">/api/webhook</code> and open or update a
                PR — new rows appear here instantly when Realtime is enabled.
              </p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout">
                {reviews.map((review, index) => {
                  const sev = normalizeSeverity(review.severity);
                  const st = SEVERITY_STYLES[sev];
                  const pr = prFromRow(review);
                  const isFresh = freshIds.has(review.id);
                  const load = Math.min(10, Math.max(0, Number(review.complexity_score) || 0));

                  return (
                    <motion.article
                      key={review.id}
                      layout
                      initial={{ opacity: 0, y: 24, scale: 0.96 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: isFresh ? 1.02 : 1,
                      }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 28,
                        delay: isFresh ? 0 : index * 0.04,
                      }}
                      className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl bg-slate-950/40 p-5 md:p-6 transition-shadow duration-500 ${st.border} ${st.glow} ${
                        isFresh ? "ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-slate-900" : ""
                      }`}
                    >
                      {isFresh ? (
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent pointer-events-none"
                          initial={{ opacity: 1 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 1.8 }}
                        />
                      ) : null}

                      <div className="relative flex justify-between items-start gap-3 mb-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <Shield className={`w-6 h-6 shrink-0 ${st.icon}`} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              {pr != null ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/80 px-2 py-0.5 text-xs font-mono text-cyan-300 border border-slate-600/50">
                                  <GitBranch className="h-3 w-3" />
                                  PR #{pr}
                                </span>
                              ) : null}
                              {review.status ? (
                                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                                  {review.status}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase border ${st.pill}`}
                          >
                            {sev}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-1 tabular-nums">
                            {formatRelative(review.created_at)}
                          </p>
                        </div>
                      </div>

                      <h3 className="text-base font-semibold text-white mb-2 line-clamp-1">
                        {review.title?.trim() || "Multi-agent review"}
                      </h3>
                      <p className="text-sm text-slate-400 mb-4 line-clamp-3 leading-relaxed">
                        {review.summary?.trim() || "—"}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {AGENT_PILLS.map((p) => (
                          <span
                            key={p}
                            className="text-[9px] uppercase tracking-wider text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/50"
                          >
                            {p}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                        <div className="flex-1">
                          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                            <span>Cognitive load</span>
                            <span className="tabular-nums text-slate-400">{load}/10</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                              initial={{ width: 0 }}
                              animate={{ width: `${load * 10}%` }}
                              transition={{ duration: 0.7, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </div>
  );
}
