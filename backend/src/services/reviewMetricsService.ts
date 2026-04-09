import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env';
import { ensureReviewsRepoIdColumn } from '../db/ensureReviewsSchema';

const supabaseUrl = config.supabase.url as string;
const supabaseKey =
  config.supabase.serviceRoleKey || (config.supabase.anonKey as string);

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Violation {
  type: string;
  severity: string;
  line_number: number | null;
  message: string;
}

export interface RepositoryRow {
  id: string;
  owner: string;
  repo_name: string;
  last_synced_at: string | null;
}

/**
 * Lists all tracked repositories (newest activity first).
 */
export async function listRepositories(): Promise<RepositoryRow[]> {
  const { data, error } = await supabase
    .from('repositories')
    .select('id, owner, repo_name, last_synced_at')
    .order('last_synced_at', { ascending: false });

  if (error) throw new Error(`List repositories failed: ${error.message}`);
  return (data as RepositoryRow[]) ?? [];
}

export async function getRepositoryById(id: string): Promise<RepositoryRow | null> {
  const { data, error } = await supabase
    .from('repositories')
    .select('id, owner, repo_name, last_synced_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Get repository failed: ${error.message}`);
  return (data as RepositoryRow | null) ?? null;
}

export interface ReviewSummaryRow {
  id: string;
  repo_id: string | null;
  pr_number: number;
  complexity_score: number;
  status: string;
  summary: string;
  severity: string;
  report: string;
  created_at: string | null;
}

/** Raw row from DB (legacy column is `pr_id`, not `pr_number`). */
type ReviewDbRow = {
  id: string;
  repo_id?: string | null;
  pr_id?: number | null;
  pr_number?: number | null;
  complexity_score: number;
  status?: string | null;
  summary: string;
  severity: string;
  report: string;
  created_at: string | null;
};

function mapReviewRow(row: ReviewDbRow): ReviewSummaryRow {
  const pr =
    row.pr_id != null
      ? Number(row.pr_id)
      : row.pr_number != null
        ? Number(row.pr_number)
        : 0;
  return {
    id: row.id,
    repo_id: row.repo_id ?? null,
    pr_number: pr,
    complexity_score: row.complexity_score,
    status: row.status ?? '',
    summary: row.summary,
    severity: row.severity,
    report: row.report,
    created_at: row.created_at,
  };
}

/**
 * PR reviews stored for a repository (newest first).
 * Expects column `repo_id` (add via backend/sql/add_reviews_repo_id.sql) and `pr_id` in `reviews`.
 */
export async function listReviewsByRepoId(repoId: string, limit = 100): Promise<ReviewSummaryRow[]> {
  const fetchList = () =>
    supabase
      .from('reviews')
      .select('*')
      .eq('repo_id', repoId)
      .order('created_at', { ascending: false })
      .limit(limit);

  let { data, error } = await fetchList();

  if (error?.message.includes('repo_id')) {
    await ensureReviewsRepoIdColumn();
    ({ data, error } = await fetchList());
  }

  // DB migration via pg often fails (wrong DB password) while Supabase REST still works.
  // Avoid breaking the whole UI: return no rows until repo_id exists (run sql/add_reviews_repo_id.sql).
  if (error?.message.includes('repo_id')) {
    console.warn(
      '[Sentinel-AG] reviews.repo_id is missing. Open Supabase → SQL → run backend/sql/add_reviews_repo_id.sql (no app password required). Until then, project reviews list is empty.'
    );
    return [];
  }

  if (error) {
    throw new Error(`List reviews failed: ${error.message}`);
  }

  return ((data as ReviewDbRow[]) ?? []).map(mapReviewRow);
}

/**
 * Updates `last_synced_at` for a tracked repo (re-upsert by owner/name).
 */
export async function touchRepositorySync(id: string): Promise<RepositoryRow> {
  const repo = await getRepositoryById(id);
  if (!repo) throw new Error('Repository not found');

  await upsertRepository(repo.owner, repo.repo_name);
  const updated = await getRepositoryById(id);
  if (!updated) throw new Error('Repository not found after sync');
  return updated;
}

/**
 * Registers or updates a repository in the tracking system.
 */
export async function upsertRepository(owner: string, repoName: string): Promise<string> {
  const { data, error } = await supabase
    .from('repositories')
    .upsert({ 
      owner, 
      repo_name: repoName, 
      last_synced_at: new Date().toISOString() 
    }, { onConflict: 'owner,repo_name' })
    .select('id')
    .single();

  if (error) throw new Error(`Upsert Repo Error: ${error.message}`);
  return data.id;
}

/**
 * Saves a high-level review record.
 */
export async function saveReviewRecord(
  repoId: string,
  prNumber: number,
  complexityScore: number,
  status: string,
  summary: string,
  severity: string,
  report: string
): Promise<string> {
  const { data, error } = await supabase
    .from('reviews')
    .insert([{ 
      repo_id: repoId, 
      pr_id: prNumber, 
      complexity_score: complexityScore, 
      status,
      summary,
      severity,
      report 
    }])
    .select('id')
    .single();

  if (error) throw new Error(`Save Review Error: ${error.message}`);
  return data.id;
}

/**
 * Saves specific violations linked to a review.
 */
export async function saveViolations(reviewId: string, violations: Violation[]): Promise<void> {
  const payload = violations.map(v => ({
    review_id: reviewId,
    type: v.type,
    severity: v.severity,
    line_number: v.line_number,
    message: v.message
  }));

  const { error } = await supabase.from('violations').insert(payload);
  if (error) throw new Error(`Save Violations Error: ${error.message}`);
}
