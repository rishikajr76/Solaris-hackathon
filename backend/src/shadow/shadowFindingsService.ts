import crypto from 'crypto';
import { supabase, upsertRepository } from '../services/reviewMetricsService';
import type { ShadowFindingRaw } from './shadowAgent';

export type ShadowFindingInsert = {
  repository_id: string | null;
  owner: string;
  repo: string;
  pr_number: number;
  head_sha: string;
  run_id: string;
  github_delivery_id: string | null;
  category: string;
  severity: string;
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  title: string;
  description: string | null;
  evidence: string | null;
  model: string | null;
  status: string;
  error: string | null;
  dedupe_hash: string;
};

function hashDedupe(parts: (string | number | null | undefined)[]): string {
  const s = parts.map((p) => (p == null ? '' : String(p))).join('|');
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

export function buildShadowRows(params: {
  owner: string;
  repo: string;
  repositoryId: string | null;
  prNumber: number;
  headSha: string;
  runId: string;
  githubDeliveryId: string | null;
  model: string;
  findings: ShadowFindingRaw[];
}): ShadowFindingInsert[] {
  const { owner, repo, repositoryId, prNumber, headSha, runId, githubDeliveryId, model, findings } =
    params;

  return findings.map((f) => {
    const title = f.title?.trim() || 'Finding';
    const cat = f.category;
    const category =
      cat === 'sqli' || cat === 'auth_bypass' || cat === 'other' ? cat : 'other';
    const filePath = f.file_path?.trim() || '';
    const lineStart = f.line_start ?? null;
    const dedupe_hash = hashDedupe([
      repositoryId ?? '',
      prNumber,
      headSha,
      filePath,
      lineStart,
      category,
      title,
    ]);

    const sev = f.severity;
    const severity =
      sev === 'critical' ||
      sev === 'high' ||
      sev === 'medium' ||
      sev === 'low' ||
      sev === 'info'
        ? sev
        : 'info';

    return {
      repository_id: repositoryId,
      owner,
      repo,
      pr_number: prNumber,
      head_sha: headSha,
      run_id: runId,
      github_delivery_id: githubDeliveryId,
      category,
      severity,
      file_path: filePath,
      line_start: lineStart,
      line_end: f.line_end ?? null,
      title,
      description: f.description?.trim() ?? null,
      evidence: f.evidence?.trim() ?? null,
      model,
      status: 'ingested',
      error: null,
      dedupe_hash,
    };
  });
}

export async function insertShadowFindings(rows: ShadowFindingInsert[]): Promise<number> {
  if (!rows.length) return 0;
  const { error } = await supabase.from('shadow_findings').upsert(rows, {
    onConflict: 'dedupe_hash',
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`Shadow findings upsert failed: ${error.message}`);
  return rows.length;
}

export async function insertShadowRunFailure(params: {
  owner: string;
  repo: string;
  repositoryId: string | null;
  prNumber: number;
  headSha: string;
  runId: string;
  githubDeliveryId: string | null;
  model: string | null;
  error: string;
}): Promise<void> {
  const dedupe_hash = hashDedupe([
    params.repositoryId ?? '',
    params.prNumber,
    params.headSha,
    params.runId,
    'system_failure',
  ]);

  const row: ShadowFindingInsert = {
    repository_id: params.repositoryId,
    owner: params.owner,
    repo: params.repo,
    pr_number: params.prNumber,
    head_sha: params.headSha,
    run_id: params.runId,
    github_delivery_id: params.githubDeliveryId,
    category: 'system',
    severity: 'info',
    file_path: '',
    line_start: null,
    line_end: null,
    title: 'Shadow run failed',
    description: null,
    evidence: null,
    model: params.model,
    status: 'failed',
    error: params.error.slice(0, 8000),
    dedupe_hash,
  };

  const { error } = await supabase.from('shadow_findings').upsert([row], {
    onConflict: 'dedupe_hash',
  });
  if (error) throw new Error(`Shadow failure row failed: ${error.message}`);
}

export async function ensureRepositoryForShadow(owner: string, repo: string): Promise<string | null> {
  try {
    return await upsertRepository(owner, repo);
  } catch {
    return null;
  }
}
