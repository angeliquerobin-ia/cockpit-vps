ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.ideas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.competitors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS posts_deleted_at_idx ON public.posts (user_id, deleted_at);
CREATE INDEX IF NOT EXISTS ideas_deleted_at_idx ON public.ideas (user_id, deleted_at);
CREATE INDEX IF NOT EXISTS reels_deleted_at_idx ON public.reels (user_id, deleted_at);
CREATE INDEX IF NOT EXISTS competitors_deleted_at_idx ON public.competitors (user_id, deleted_at);