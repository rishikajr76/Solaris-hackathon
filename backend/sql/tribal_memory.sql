-- Tribal Memory: pgvector-backed store of how similar violations were fixed in past PRs.
-- Run in Supabase SQL Editor (requires pgvector — enable in Dashboard → Database → Extensions).

create extension if not exists vector;

create table if not exists public.tribal_memory (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.repositories (id) on delete cascade,
  violation_type text not null,
  file_path text not null default '',
  line_number int,
  problem_summary text not null,
  fix_unified_diff text not null,
  fix_explanation text,
  source_pr_number int,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);

create index if not exists tribal_memory_repo_idx on public.tribal_memory (repository_id);
create index if not exists tribal_memory_violation_type_idx on public.tribal_memory (violation_type);

-- IVFFLAT index for approximate NN search (build after you have some rows; lists tunable)
-- create index if not exists tribal_memory_embedding_ivf
--   on public.tribal_memory using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Semantic search: cosine distance (<=>); lower distance = closer.
create or replace function public.match_tribal_memory (
  query_embedding vector(768),
  match_threshold float default 0.35,
  match_count int default 8,
  filter_repository_id uuid default null
)
returns table (
  id uuid,
  similarity float,
  violation_type text,
  file_path text,
  line_number int,
  problem_summary text,
  fix_unified_diff text,
  fix_explanation text,
  source_pr_number int,
  repository_id uuid
)
language sql
stable
parallel safe
as $$
  select
    t.id,
    (1.0::float - (t.embedding <=> query_embedding))::float as similarity,
    t.violation_type,
    t.file_path,
    t.line_number,
    t.problem_summary,
    t.fix_unified_diff,
    t.fix_explanation,
    t.source_pr_number,
    t.repository_id
  from public.tribal_memory t
  where (filter_repository_id is null or t.repository_id = filter_repository_id)
    and (1.0::float - (t.embedding <=> query_embedding)) >= match_threshold
  order by t.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

comment on table public.tribal_memory is 'Self-healing RAG: embeddings of past violation→fix pairs for remediation suggestions.';
