
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS metricool_id text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
