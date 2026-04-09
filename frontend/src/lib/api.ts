import type { Repository } from './supabaseClient'

/**
 * Base URL for the Sentinel-AG backend (Express). Override with VITE_API_URL in production.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  const base = (raw?.trim() || 'http://localhost:3000').replace(/\/$/, '')
  return base
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
