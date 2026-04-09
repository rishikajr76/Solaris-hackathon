import type { Repository } from './supabaseClient'

/**
 * Base URL for the Sentinel-AG backend (Express). Override with VITE_API_URL in production.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  const base = (raw?.trim() || 'http://localhost:3000').replace(/\/$/, '')
  return base
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

/**
 * Sentinel Copilot — Gemini via backend `POST /api/chat`.
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
