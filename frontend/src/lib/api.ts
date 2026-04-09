import type { Repository } from './supabaseClient'

/**
 * Base URL for the Sentinel-AG backend (Express).
 * - If `VITE_API_URL` is set, it wins (required for most production deploys).
 * - In dev, if unset, returns '' so `/api/*` hits the Vite dev server, which proxies to Express on port 3000.
 * - Production build without `VITE_API_URL` falls back to `http://localhost:3000` (set the env for real hosting).
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  const trimmed = raw?.trim()
  if (trimmed) return trimmed.replace(/\/$/, '')
  if (import.meta.env.DEV) return ''
  return 'http://localhost:3000'
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export type CopilotStreamSource = {
  id: string
  title: string
  url: string
  category: string
}

export type CopilotStreamMeta = {
  signalCount: number
  sourceCount: number
  sources: CopilotStreamSource[]
  thinkingTrace: string[]
  routePath: string | null
}

/**
 * Sentinel Copilot — non-streaming fallback: `POST /api/chat`.
 */
export async function sendCopilotMessage(
  messages: ChatMessage[],
  pageContext?: string
): Promise<string> {
  const res = await fetch(`${getApiBaseUrl()}/api/chat`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, pageContext }),
  })

  const payload = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: string }).error)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }

  const content = (payload as { content?: string }).content
  if (typeof content !== 'string') {
    throw new Error('Invalid chat response')
  }

  return content
}

export type CopilotStreamHandlers = {
  onMeta: (meta: CopilotStreamMeta) => void
  onDelta: (text: string) => void
  onDone: () => void
  onError: (err: Error) => void
}

/**
 * Sentinel Copilot — SSE stream: citations + thinking trace, then token chunks (`POST /api/chat/stream`).
 */
export async function streamCopilotMessage(
  messages: ChatMessage[],
  pageContext: string | undefined,
  handlers: CopilotStreamHandlers
): Promise<void> {
  let aborted = false

  const res = await fetch(`${getApiBaseUrl()}/api/chat/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, pageContext }),
  })

  if (!res.ok) {
    const raw = await res.text()
    let msg = `HTTP ${res.status}`
    try {
      const j = JSON.parse(raw) as { error?: string }
      if (typeof j.error === 'string') msg = j.error
    } catch {
      if (raw.trim()) msg = raw.slice(0, 300)
    }
    aborted = true
    handlers.onError(new Error(msg))
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    aborted = true
    handlers.onError(new Error('No response body'))
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let sawDone = false
  let sawError = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      for (;;) {
        const sep = buffer.indexOf('\n\n')
        if (sep === -1) break
        const block = buffer.slice(0, sep)
        buffer = buffer.slice(sep + 2)

        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue
          const rawLine = line.slice(5).trimStart()
          if (!rawLine) continue
          let ev: Record<string, unknown>
          try {
            ev = JSON.parse(rawLine) as Record<string, unknown>
          } catch {
            continue
          }
          const t = ev.type
          if (t === 'meta') {
            const meta: CopilotStreamMeta = {
              signalCount: Number(ev.signalCount) || 0,
              sourceCount: Number(ev.sourceCount) || 0,
              sources: Array.isArray(ev.sources) ? (ev.sources as CopilotStreamSource[]) : [],
              thinkingTrace: Array.isArray(ev.thinkingTrace)
                ? (ev.thinkingTrace as string[])
                : [],
              routePath: typeof ev.routePath === 'string' ? ev.routePath : null,
            }
            handlers.onMeta(meta)
          } else if (t === 'delta' && typeof ev.text === 'string') {
            handlers.onDelta(ev.text)
          } else if (t === 'done') {
            sawDone = true
            handlers.onDone()
          } else if (t === 'error') {
            sawError = true
            handlers.onError(new Error(typeof ev.message === 'string' ? ev.message : 'Stream error'))
            return
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (!aborted && !sawDone && !sawError) {
    handlers.onDone()
  }
}

/**
 * Fetches tracked repositories from the backend (`GET /api/repositories`).
 */
export async function fetchRepositoriesFromApi(): Promise<Repository[]> {
  const res = await fetch(`${getApiBaseUrl()}/api/repositories`, {
    headers: { Accept: 'application/json' },
  })

  const payload = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: string }).error)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }

  const data = (payload as { data?: Repository[] }).data
  if (!Array.isArray(data)) {
    throw new Error('Invalid response from /api/repositories')
  }

  return data
}

/**
 * Registers or updates a tracked repository (`POST /api/repositories`).
 */
export async function createRepositoryViaApi(
  owner: string,
  repoName: string
): Promise<Repository> {
  const res = await fetch(`${getApiBaseUrl()}/api/repositories`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ owner: owner.trim(), repo_name: repoName.trim() }),
  })

  const payload = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: string }).error)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }

  const data = (payload as { data?: Repository }).data
  if (!data || typeof data.id !== 'string') {
    throw new Error('Invalid response from POST /api/repositories')
  }

  return data
}

export type RepoReview = {
  id: string
  repo_id: string
  pr_number: number
  complexity_score: number
  status: string
  summary: string
  severity: string
  report: string
  created_at: string | null
}

export async function fetchRepositoryById(repoId: string): Promise<Repository> {
  const res = await fetch(`${getApiBaseUrl()}/api/repositories/${encodeURIComponent(repoId)}`, {
    headers: { Accept: 'application/json' },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: string }).error)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }
  const data = (payload as { data?: Repository }).data
  if (!data?.id) throw new Error('Invalid repository response')
  return data
}

export async function fetchRepositoryReviews(repoId: string): Promise<RepoReview[]> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/repositories/${encodeURIComponent(repoId)}/reviews`,
    { headers: { Accept: 'application/json' } }
  )
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: string }).error)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }
  const data = (payload as { data?: RepoReview[] }).data
  if (!Array.isArray(data)) throw new Error('Invalid reviews response')
  return data
}

/**
 * Refreshes `last_synced_at` for a tracked repository.
 */
export type RepoQualitySnapshot = {
  score: number
  strengths: string[]
  risks: string[]
  recommendations: string[]
  narrative: string
}

export type RepositoryInsight = {
  defaultBranch: string
  truncated: boolean
  totalBlobFiles: number
  files: { path: string; size?: number }[]
  readmePreview: string | null
  quality: RepoQualitySnapshot | null
  githubError?: string
}

export async function fetchRepositoryInsight(repoId: string): Promise<RepositoryInsight> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/repositories/${encodeURIComponent(repoId)}/insight`,
    { headers: { Accept: 'application/json' } }
  )
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: string }).error)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }
  const data = (payload as { data?: RepositoryInsight }).data
  if (!data || typeof data.defaultBranch !== 'string') {
    throw new Error('Invalid insight response')
  }
  return data
}

export async function syncRepositoryViaApi(repoId: string): Promise<Repository> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/repositories/${encodeURIComponent(repoId)}/sync`,
    {
      method: 'POST',
      headers: { Accept: 'application/json' },
    }
  )
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: string }).error)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }
  const data = (payload as { data?: Repository }).data
  if (!data?.id) throw new Error('Invalid sync response')
  return data
}

// --- Backend health & remediation (Express routes not under Supabase) ---

export type BackendHealth = {
  status: string
  timestamp: string
}

/** GET `/health` on the Express server (proxied in dev when `VITE_API_URL` is unset). */
export async function fetchBackendHealth(): Promise<BackendHealth> {
  const res = await fetch(`${getApiBaseUrl()}/health`, {
    headers: { Accept: 'application/json' },
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error: string }).error)
        : `HTTP ${res.status}`
    throw new Error(msg)
  }
  const status = (payload as { status?: string }).status
  const timestamp = (payload as { timestamp?: string }).timestamp
  if (typeof status !== 'string' || typeof timestamp !== 'string') {
    throw new Error('Invalid health response')
  }
  return { status, timestamp }
}

export type RemediationViolationPayload = {
  filePath: string
  errorType: string
  lineNumber?: number | null
  message?: string
}

export type RemediationPrContext = {
  violation: RemediationViolationPayload
  owner: string
  repo: string
  pullNumber: number
  headSha: string
  repositoryId?: string | null
}

export type TribalMemoryHitRow = {
  id: string
  similarity: number
  violation_type: string
  file_path: string
  line_number: number | null
  problem_summary: string
  fix_unified_diff: string
  fix_explanation: string | null
  source_pr_number: number | null
  repository_id: string | null
}

export type RemediationHealResult = {
  unifiedDiff: string
  explanation: string
  tribalHits: TribalMemoryHitRow[]
  model: string
}

export async function postRemediationHeal(
  body: RemediationPrContext
): Promise<RemediationHealResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/remediation/heal`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message: string }).message)
        : typeof payload === 'object' && payload && 'error' in payload
          ? String((payload as { error: string }).error)
          : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return payload as RemediationHealResult
}

export type RemediationCommentResult = RemediationHealResult & {
  commentId: number
  commentUrl: string
}

export async function postRemediationCommentApi(
  body: RemediationPrContext
): Promise<RemediationCommentResult> {
  const res = await fetch(`${getApiBaseUrl()}/api/remediation/post-comment`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message: string }).message)
        : typeof payload === 'object' && payload && 'error' in payload
          ? String((payload as { error: string }).error)
          : `HTTP ${res.status}`
    throw new Error(msg)
  }
  return payload as RemediationCommentResult
}

export type TribalMemoryIngestBody = {
  repositoryId?: string
  owner?: string
  repo?: string
  violationType: string
  filePath: string
  problemSummary: string
  fixUnifiedDiff: string
  lineNumber?: number | null
  fixExplanation?: string | null
  sourcePrNumber?: number | null
  embedText?: string
}

export async function postTribalMemoryIngestApi(body: TribalMemoryIngestBody): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/remediation/tribal-memory`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof payload === 'object' && payload && 'message' in payload
        ? String((payload as { message: string }).message)
        : typeof payload === 'object' && payload && 'error' in payload
          ? String((payload as { error: string }).error)
          : `HTTP ${res.status}`
    throw new Error(msg)
  }
}
