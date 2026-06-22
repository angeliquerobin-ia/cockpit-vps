
CREATE TYPE public.post_status AS ENUM ('idee', 'en_redaction', 'pret', 'programme', 'publie');

CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  channel public.pillar_channel,
  pillar_id uuid REFERENCES public.content_pillars(id) ON DELETE SET NULL,
  status public.post_status NOT NULL DEFAULT 'en_redaction',
  scheduled_at timestamptz,
  idea_id uuid REFERENCES public.ideas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own posts"
  ON public.posts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX posts_user_created_idx ON public.posts(user_id, created_at DESC);
