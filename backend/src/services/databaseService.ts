import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env';

// Safety check to prevent the 'undefined' error on the createClient call
const supabaseUrl = config.supabase.url;
const supabaseKey = config.supabase.serviceRoleKey;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase URL or Service Role Key in .env");
}

// Initialize Supabase Client
export const supabase = createClient(supabaseUrl, supabaseKey);

export interface ReviewData {
  prId: number;
  complexityScore: number;
  report: string;
  summary: string;
  severity: 'Low' | 'Medium' | 'High';
}

/**
 * Saves the full review results to Supabase.
 */
export async function saveReviewData(data: ReviewData): Promise<void> {
  const { error } = await supabase
    .from('reviews')
    .insert([
      {
        pr_id: data.prId,
        complexity_score: data.complexityScore,
        report: data.report,
        summary: data.summary,
        severity: data.severity,
        created_at: new Date().toISOString()
      }
    ]);

  if (error) {
    console.error('❌ Supabase Insertion Error:', error.message);
    throw new Error('Failed to save review data to database');
  }
}

export async function getLatestReviews(limit = 10) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
    
  return data;
}