import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Force load from the current working directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// DEBUG: Let's see what keys actually exist
console.log("--- ENV DEBUG ---");
console.log("Keys found in process.env:", Object.keys(process.env).filter(k => k.includes('SUPABASE')));
console.log("------------------");

const supabaseUrl = process.env.SUPABASE_URL;
// Try every possible variation just in case
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    `❌ Supabase initialization failed. 
    URL: ${supabaseUrl ? "Defined" : "UNDEFINED"}
    Key: ${supabaseKey ? "Defined" : "UNDEFINED"}`
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Violation {
  type: string;
  severity: string;
  line_number: number | null;
  message: string;
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