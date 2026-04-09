import type { Request, Response } from 'express';
import {
  listRepositories,
  upsertRepository,
  supabase,
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
