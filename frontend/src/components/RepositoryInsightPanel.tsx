import { useMemo, useState } from "react";
import { FolderTree, Search, BookOpen, Gauge, Sparkles, AlertTriangle, ListTodo } from "lucide-react";
import type { RepositoryInsight } from "../lib/api";

type Props = {
  insight: RepositoryInsight | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export function RepositoryInsightPanel({ insight, loading, error, onRefresh }: Props) {
  const [fileQuery, setFileQuery] = useState("");

  const filteredFiles = useMemo(() => {
    if (!insight?.files?.length) return [];
    const q = fileQuery.trim().toLowerCase();
    if (!q) return insight.files;
    return insight.files.filter((f) => f.path.toLowerCase().includes(q));
  }, [insight?.files, fileQuery]);

  if (loading && !insight) {
    return (
      <div className="glass-neon rounded-xl p-8 mb-10 animate-pulse">
        <div className="h-6 w-48 bg-slate-800 rounded mb-4" />
        <div className="h-32 bg-slate-800/60 rounded-lg" />
      </div>
    );
  }

  if (error && !insight) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm mb-10 readable-prose-muted">
        <p className="font-medium text-amber-200">Repository insight unavailable</p>
        <p className="mt-1">{error}</p>
        <button type="button" onClick={onRefresh} className="mt-2 text-cyan-400 hover:underline text-sm font-semibold">
          Try again
        </button>
      </div>
    );
  }

  const insightBanner = error && insight ? (
    <p className="text-xs text-amber-200/90 border border-amber-500/20 rounded-lg px-3 py-2 bg-amber-500/5">
      Latest refresh failed ({error}). Showing previous data.{" "}
      <button type="button" onClick={onRefresh} className="text-cyan-400 hover:underline font-semibold">
        Retry
      </button>
    </p>
  ) : null;

  if (!insight) return null;

  const q = insight.quality;

  return (
    <section className="mb-12 space-y-6">
      {insightBanner}

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-cyan-400" />
            Repository insight
          </h2>
          <p className="readable-prose-muted text-sm mt-1">
            Default branch <code className="readable-inline-code">{insight.defaultBranch}</code>
            · {insight.totalBlobFiles.toLocaleString()} files
            {insight.truncated ? " · tree truncated by GitHub API" : ""}
          </p>
        </div>
        <button type="button" onClick={onRefresh} className="btn-secondary text-sm self-start">
          Refresh insight
        </button>
      </div>

      {insight.githubError ? (
        <p className="text-sm text-amber-200/90 border border-amber-500/25 rounded-lg px-3 py-2 bg-amber-500/5">
          GitHub: {insight.githubError}
        </p>
      ) : null}

      {q ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-5 flex flex-col items-center justify-center text-center">
            <Gauge className="h-8 w-8 text-purple-400 mb-3" />
            <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">Quality snapshot</p>
            <p className="text-5xl font-bold text-gradient tabular-nums">{q.score}</p>
            <p className="text-slate-500 text-sm mt-1">/ 10 (heuristic from tree + README)</p>
          </div>
          <div className="rounded-xl border border-slate-700/80 bg-slate-950/40 p-5 space-y-4">
            <p className="readable-prose text-slate-200 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400 shrink-0 mt-1" />
              <span>{q.narrative}</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold text-emerald-400/90 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Strengths
                </p>
                <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-4">
                  {q.strengths.map((s, i) => (
                    <li key={i} className="leading-snug">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-400/90 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Risks
                </p>
                <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-4">
                  {q.risks.map((s, i) => (
                    <li key={i} className="leading-snug">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-cyan-400/90 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <ListTodo className="h-3 w-3" /> Recommendations
                </p>
                <ul className="space-y-1.5 text-sm text-slate-300 list-disc pl-4">
                  {q.recommendations.map((s, i) => (
                    <li key={i} className="leading-snug">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Quality snapshot could not be generated (check LLM config and logs).</p>
      )}

      <div className="rounded-xl border border-slate-700/80 bg-slate-950/30 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Files on default branch</h3>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="search"
              value={fileQuery}
              onChange={(e) => setFileQuery(e.target.value)}
              placeholder="Filter paths…"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            Showing {filteredFiles.length} of {insight.files.length}
          </span>
        </div>
        <ul className="max-h-72 overflow-y-auto text-xs font-mono divide-y divide-slate-800/80">
          {filteredFiles.length === 0 ? (
            <li className="px-4 py-6 text-slate-500 text-center">
              {insight.files.length === 0
                ? insight.githubError
                  ? "GitHub did not return a file list. Fix the error above and refresh."
                  : "No files were returned for the default branch. Try Refresh — if this persists, check GITHUB_TOKEN repo access."
                : "No files match your filter."}
            </li>
          ) : (
            filteredFiles.map((f) => (
              <li key={f.path} className="px-4 py-2 text-slate-400 hover:bg-slate-900/50 flex justify-between gap-3">
                <span className="break-all text-cyan-200/80">{f.path}</span>
                {f.size != null ? (
                  <span className="text-slate-600 shrink-0 tabular-nums">{f.size.toLocaleString()} B</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>

      {insight.readmePreview ? (
        <details className="rounded-xl border border-slate-700/80 bg-slate-950/30 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-300 flex items-center gap-2 select-none">
            <BookOpen className="h-4 w-4 text-cyan-500/80" />
            README preview
          </summary>
          <pre className="readable-pre mt-3 max-h-64 text-[12px] whitespace-pre-wrap">{insight.readmePreview}</pre>
        </details>
      ) : null}
    </section>
  );
}
