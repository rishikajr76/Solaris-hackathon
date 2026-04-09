import { supabase } from './reviewMetricsService';

export type TribalMemoryHit = {
  id: string;
  similarity: number;
  violation_type: string;
  file_path: string;
  line_number: number | null;
  problem_summary: string;
  fix_unified_diff: string;
  fix_explanation: string | null;
  source_pr_number: number | null;
  repository_id: string | null;
};

/**
 * Semantic search over tribal_memory using pgvector RPC `match_tribal_memory`.
 */
export async function searchSimilarFixes(params: {
  queryEmbedding: number[];
  repositoryId: string | null;
  matchCount?: number;
  matchThreshold?: number;
}): Promise<TribalMemoryHit[]> {
  const { queryEmbedding, repositoryId, matchCount = 8, matchThreshold = 0.35 } = params;

  const { data, error } = await supabase.rpc('match_tribal_memory', {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter_repository_id: repositoryId,
  });

  if (error) {
    console.warn('[TribalMemory] match_tribal_memory failed (table or RPC missing?):', error.message);
    return [];
  }

  if (!Array.isArray(data)) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: String(row.id ?? ''),
    similarity: Number(row.similarity ?? 0),
    violation_type: String(row.violation_type ?? ''),
    file_path: String(row.file_path ?? ''),
    line_number: row.line_number != null ? Number(row.line_number) : null,
    problem_summary: String(row.problem_summary ?? ''),
    fix_unified_diff: String(row.fix_unified_diff ?? ''),
    fix_explanation: row.fix_explanation != null ? String(row.fix_explanation) : null,
    source_pr_number: row.source_pr_number != null ? Number(row.source_pr_number) : null,
    repository_id: row.repository_id != null ? String(row.repository_id) : null,
  }));
}

/**
 * Optional: record a resolved fix to grow tribal knowledge (call after merge or human confirmation).
 */
export async function insertTribalMemoryRow(params: {
  repositoryId: string;
  violationType: string;
  filePath: string;
  lineNumber: number | null;
  problemSummary: string;
  fixUnifiedDiff: string;
  fixExplanation: string | null;
  sourcePrNumber: number | null;
  embedding: number[];
}): Promise<void> {
  const { error } = await supabase.from('tribal_memory').insert({
    repository_id: params.repositoryId,
    violation_type: params.violationType,
    file_path: params.filePath,
    line_number: params.lineNumber,
    problem_summary: params.problemSummary,
    fix_unified_diff: params.fixUnifiedDiff,
    fix_explanation: params.fixExplanation,
    source_pr_number: params.sourcePrNumber,
    embedding: params.embedding,
  } as never);

  if (error) throw new Error(`tribal_memory insert failed: ${error.message}`);
}
