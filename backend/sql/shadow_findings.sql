-- Sentinel-AG Shadow Queue: non-blocking security findings (SQLi, auth bypass, etc.)
-- Run in Supabase SQL Editor after `repositories` exists.

create table if not exists public.shadow_findings (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid references public.repositories (id) on delete set null,
  owner text not null,
  repo text not null,
  pr_number int not null,
  head_sha text not null default '',
  run_id uuid not null,
  github_delivery_id text,

  category text not null,
  severity text not null default 'info',
  file_path text not null default '',
  line_start int,
  line_end int,
  title text not null,
  description text,
  evidence text,

  model text,
  status text not null default 'queued',
  error text,

  dedupe_hash text not null,
  created_at timestamptz not null default now(),

  constraint shadow_findings_dedupe unique (dedupe_hash)
);

create index if not exists shadow_findings_repo_created_idx
  on public.shadow_findings (repository_id, created_at desc);

create index if not exists shadow_findings_pr_head_idx
  on public.shadow_findings (pr_number, head_sha);

create index if not exists shadow_findings_status_idx
  on public.shadow_findings (status);

create index if not exists shadow_findings_run_idx
  on public.shadow_findings (run_id);

comment on table public.shadow_findings is 'Shadow Execution Agent queue: Gemini security findings; does not gate CI.';

-- Optional RLS (uncomment if exposing to anon/authenticated clients from the dashboard):
-- alter table public.shadow_findings enable row level security;
-- Service role bypasses RLS by default for backend inserts.
