ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT 'creation'
    CHECK (location IN ('creation','archive','recyclage'));

CREATE INDEX IF NOT EXISTS posts_user_location_idx
  ON public.posts(user_id, location)
  WHERE deleted_at IS NULL;