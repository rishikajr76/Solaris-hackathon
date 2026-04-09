import type { Request, Response } from 'express';

/** Normalize :repoId from the URL (encoding, stray slashes). */
export function repoIdFromParams(req: Request): string {
  const raw = req.params.repoId;
  if (raw == null || typeof raw !== 'string') return '';
  try {
    return decodeURIComponent(raw).trim().replace(/^\/+|\/+$/g, '');
  } catch {
    return String(raw).trim().replace(/^\/+|\/+$/g, '');
  }
}
import {
  listRepositories,
  upsertRepository,
  supabase,
  getRepositoryById,
  listReviewsByRepoId,
  touchRepositorySync,
  type RepositoryRow,
} from '../services/reviewMetricsService';

export async function getRepositories(_req: Request, res: Response): Promise<void> {
  try {
    const data = await listRepositories();
    res.status(200).json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('GET /api/repositories:', message);
    res.status(500).json({ error: message });
  }
}

function parseBody(body: unknown): { owner: string; repo_name: string } | null {
  if (!body || typeof body !== 'object') return null;
  const o = body as Record<string, unknown>;
  const owner = typeof o.owner === 'string' ? o.owner.trim() : '';
  const repo_name = typeof o.repo_name === 'string' ? o.repo_name.trim() : '';
  if (!owner || !repo_name) return null;
  return { owner, repo_name };
}

export async function postRepository(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseBody(req.body);
    if (!parsed) {
      res.status(400).json({ error: 'JSON body must include non-empty owner and repo_name strings.' });
      return;
    }

    const id = await upsertRepository(parsed.owner, parsed.repo_name);

    const { data, error } = await supabase
      .from('repositories')
      .select('id, owner, repo_name, last_synced_at')
      .eq('id', id)
      .single();

    if (error) throw new Error(error.message);

    res.status(201).json({ data: data as RepositoryRow });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('POST /api/repositories:', message);
    res.status(500).json({ error: message });
  }
}

export async function getRepositoryByIdRoute(req: Request, res: Response): Promise<void> {
  try {
    const repoId = repoIdFromParams(req);
    if (!repoId) {
      res.status(400).json({ error: 'Missing repository id' });
      return;
    }
    const data = await getRepositoryById(repoId);
    if (!data) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }
    res.status(200).json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('GET /api/repositories/:repoId:', message);
    res.status(500).json({ error: message });
  }
}

export async function getRepositoryReviews(req: Request, res: Response): Promise<void> {
  try {
    const repoId = repoIdFromParams(req);
    if (!repoId) {
      res.status(400).json({ error: 'Missing repository id' });
      return;
    }
    const repo = await getRepositoryById(repoId);
    if (!repo) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }
    const data = await listReviewsByRepoId(repoId);
    res.status(200).json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('GET /api/repositories/:repoId/reviews:', message);
    res.status(500).json({ error: message });
  }
}

export async function postRepositorySync(req: Request, res: Response): Promise<void> {
  try {
    const repoId = repoIdFromParams(req);
    if (!repoId) {
      res.status(400).json({ error: 'Missing repository id' });
      return;
    }
    const data = await touchRepositorySync(repoId);
    res.status(200).json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
      return;
    }
    console.error('POST /api/repositories/:repoId/sync:', message);
    res.status(500).json({ error: message });
  }
}
