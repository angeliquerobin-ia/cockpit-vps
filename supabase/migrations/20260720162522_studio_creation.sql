-- ============================================================
-- Studio de Création : fusion Idées + Studio de rédaction
-- - colonnes de kanban libres, indépendantes des piliers
-- - le tableau opère désormais sur `posts` (location='creation')
-- - migration idempotente des idées existantes vers des posts
-- ============================================================

-- ============ board_columns (colonnes du kanban, indépendantes des piliers) ============
CREATE TABLE IF NOT EXISTS public.board_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_columns_user ON public.board_columns(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_columns TO authenticated;
GRANT ALL ON public.board_columns TO service_role;

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own board columns" ON public.board_columns;
CREATE POLICY "Users manage their own board columns"
  ON public.board_columns
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_board_columns_updated_at ON public.board_columns;
CREATE TRIGGER trg_board_columns_updated_at
  BEFORE UPDATE ON public.board_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ posts : rattachement au tableau + ordre vertical ============
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS board_column_id UUID REFERENCES public.board_columns(id) ON DELETE SET NULL;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS board_position DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_board_column ON public.posts(user_id, board_column_id);

-- ============ Fusion des idées existantes vers des posts (idempotent) ============
-- Chaque idée non supprimée qui n'a pas encore de post associé devient une carte
-- du tableau (À ranger). Le texte de l'idée (note) est conservé dans content.
INSERT INTO public.posts (user_id, title, content, pillar_id, channel, status, location, idea_id, created_at)
SELECT
  i.user_id,
  i.title,
  i.note,
  i.pillar_id,
  i.channel,
  (CASE i.status
     WHEN 'brouillon'    THEN 'idee'
     WHEN 'a_developper' THEN 'en_redaction'
     WHEN 'prete'        THEN 'pret'
     ELSE 'en_redaction'
   END)::public.post_status,
  'creation',
  i.id,
  i.created_at
FROM public.ideas i
WHERE i.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.idea_id = i.id);

-- Les idées désormais représentées par un post sont mises en corbeille douce
-- (le texte reste intact dans le post : opération réversible).
UPDATE public.ideas
SET deleted_at = now()
WHERE deleted_at IS NULL
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.idea_id = public.ideas.id);
