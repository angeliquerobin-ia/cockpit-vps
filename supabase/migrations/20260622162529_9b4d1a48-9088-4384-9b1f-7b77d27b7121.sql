ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS source_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_source_post_id ON public.posts(source_post_id);