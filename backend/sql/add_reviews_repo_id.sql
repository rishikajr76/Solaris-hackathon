-- Run once: Supabase Dashboard → SQL Editor → New query → paste → Run

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS repo_id text;

CREATE INDEX IF NOT EXISTS idx_reviews_repo_id ON public.reviews (repo_id);
