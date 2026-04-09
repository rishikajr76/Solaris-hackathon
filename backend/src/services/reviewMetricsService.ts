import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env';

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
      pr_number: prNumber, 
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
