import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react'
import { Sidebar } from '../components/Sidebar'
import { RepositoryInsightPanel } from '../components/RepositoryInsightPanel'
import {
  fetchRepositoryById,
  fetchRepositoryReviews,
  fetchRepositoryInsight,
  syncRepositoryViaApi,
  type RepoReview,
  type RepositoryInsight,
} from '../lib/api'
import type { Repository } from '../lib/supabaseClient'

function severityStyle(sev: string) {
  const s = sev?.toLowerCase() ?? ''
  if (s === 'high') return 'text-red-400 border-red-500/40 bg-red-500/10'
  if (s === 'medium') return 'text-amber-400 border-amber-500/40 bg-amber-500/10'
  return 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
}

export function ProjectDetailPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const navigate = useNavigate()
  const [repo, setRepo] = useState<Repository | null>(null)
  const [reviews, setReviews] = useState<RepoReview[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [insight, setInsight] = useState<RepositoryInsight | null>(null)
  const [insightLoading, setInsightLoading] = useState(true)
  const [insightError, setInsightError] = useState<string | null>(null)

  const load = async () => {
    if (!repoId) return
    setLoading(true)
    setError(null)
    try {
      const [r, rev] = await Promise.all([
        fetchRepositoryById(repoId),
        fetchRepositoryReviews(repoId),
      ])
      setRepo(r)
      setReviews(rev)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project')
      setRepo(null)
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [repoId])

  const loadInsight = async () => {
    if (!repoId) return
    setInsightLoading(true)
    setInsightError(null)
    try {
      const data = await fetchRepositoryInsight(repoId)
      setInsight(data)
    } catch (e) {
      setInsightError(e instanceof Error ? e.message : 'Failed to load insight')
    } finally {
      setInsightLoading(false)
    }
  }

  useEffect(() => {
    void loadInsight()
  }, [repoId])

  const githubUrl = repo
    ? `https://github.com/${repo.owner}/${repo.repo_name}`
    : '#'

  const handleSync = async () => {
    if (!repoId || syncing) return
    setSyncing(true)
    setError(null)
    try {
      const updated = await syncRepositoryViaApi(repoId)
      setRepo(updated)
      void loadInsight()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (!repoId) {
    return <Navigate to="/projects" replace />
  }

  return (
    <div className="flex min-h-screen bg-slate-900">
      <Sidebar />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 overflow-auto pt-20 md:pt-0"
      >
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="mb-6 flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition text-sm"
          >
            <ArrowLeft size={18} />
            All projects
          </button>

          {error && (
            <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/15 px-4 py-3 text-red-200 text-sm">
              {error}
              <button
                type="button"
                onClick={() => void load()}
                className="ml-3 font-semibold text-red-100 underline"
              >
                Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="glass-neon rounded-xl p-12 text-center readable-prose-muted">
              Loading project…
            </div>
          )}

          {!loading && repo && (
            <>
              <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-1">
                    {repo.owner}/{repo.repo_name}
                  </h1>
                  <p className="text-slate-500 text-sm">
                    Last synced:{' '}
                    {repo.last_synced_at
                      ? new Date(repo.last_synced_at).toLocaleString()
                      : '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Open on GitHub
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleSync()}
                    disabled={syncing}
                    className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Syncing…' : 'Sync now'}
                  </button>
                </div>
              </div>

              <RepositoryInsightPanel
                insight={insight}
                loading={insightLoading}
                error={insightError}
                onRefresh={() => void loadInsight()}
              />

              <h2 className="text-xl font-semibold text-white mb-4">
                Sentinel PR reviews ({reviews.length})
              </h2>

              {reviews.length === 0 ? (
                <div className="glass-neon rounded-xl p-10 text-center space-y-4 max-w-2xl mx-auto">
                  <p className="readable-prose-muted">
                    No PR reviews for this repository yet. Trigger a review from your GitHub integration, or
                    check Supabase for existing rows.
                  </p>
                  <p className="readable-prose-muted text-sm text-amber-200/85">
                    If reviews exist in the <code className="readable-inline-code text-amber-100/90">reviews</code>{" "}
                    table but never show here, add a{" "}
                    <code className="readable-inline-code text-amber-100/90">repo_id</code> column — run{" "}
                    <code className="readable-inline-code text-amber-100/90">backend/sql/add_reviews_repo_id.sql</code>{" "}
                    in the Supabase SQL editor once.
                  </p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {reviews.map((rev) => (
                    <motion.li
                      key={rev.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <span className="font-mono text-cyan-400">
                          PR #{rev.pr_number}
                        </span>
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide px-2 py-1 rounded border ${severityStyle(rev.severity)}`}
                        >
                          {rev.severity}
                        </span>
                      </div>
                      <p className="readable-prose text-slate-200 mb-3">{rev.summary}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                        <span>Complexity: {rev.complexity_score}</span>
                        <span>Status: {rev.status}</span>
                        {rev.created_at && (
                          <span>{new Date(rev.created_at).toLocaleString()}</span>
                        )}
                      </div>
                      {rev.report && (
                        <details className="mt-4">
                          <summary className="cursor-pointer text-cyan-400 text-sm font-medium">
                            Full report
                          </summary>
                          <pre className="readable-pre mt-3 max-h-[28rem] whitespace-pre-wrap">
                            {rev.report}
                          </pre>
                        </details>
                      )}
                    </motion.li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </motion.main>
    </div>
  )
}
