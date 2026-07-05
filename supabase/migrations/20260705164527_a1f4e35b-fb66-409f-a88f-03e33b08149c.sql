-- Enum for business moment kinds
CREATE TYPE public.business_moment_kind AS ENUM ('lancement','cohorte','vente','evenement','autre');

-- Business moments (temps forts)
CREATE TABLE public.business_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind public.business_moment_kind NOT NULL DEFAULT 'lancement',
  start_date date NOT NULL,
  end_date date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_moments TO authenticated;
GRANT ALL ON public.business_moments TO service_role;
ALTER TABLE public.business_moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own moments" ON public.business_moments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_business_moments_updated_at
  BEFORE UPDATE ON public.business_moments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Content arcs (modèles réutilisables)
CREATE TABLE public.content_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  moment_kind public.business_moment_kind NOT NULL DEFAULT 'lancement',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_arcs TO authenticated;
GRANT ALL ON public.content_arcs TO service_role;
ALTER TABLE public.content_arcs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own arcs" ON public.content_arcs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_content_arcs_updated_at
  BEFORE UPDATE ON public.content_arcs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Phases per arc
CREATE TABLE public.arc_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arc_id uuid NOT NULL REFERENCES public.content_arcs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  anchor text NOT NULL DEFAULT 'start', -- 'start' or 'end'
  offset_days integer NOT NULL DEFAULT 0, -- negative = before anchor, positive = after
  post_count integer NOT NULL DEFAULT 1,
  intent text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arc_phases TO authenticated;
GRANT ALL ON public.arc_phases TO service_role;
ALTER TABLE public.arc_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own phases" ON public.arc_phases FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX arc_phases_arc_idx ON public.arc_phases(arc_id, position);

-- Link posts to business moments + phase label
ALTER TABLE public.posts
  ADD COLUMN moment_id uuid REFERENCES public.business_moments(id) ON DELETE SET NULL,
  ADD COLUMN phase_name text;
CREATE INDEX posts_moment_idx ON public.posts(moment_id);