
-- Enum for channels
CREATE TYPE public.pillar_channel AS ENUM (
  'linkedin',
  'instagram_coaching',
  'instagram_chroniques_cosmiques',
  'podcast',
  'substack'
);

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ strategy_documents ============
CREATE TABLE public.strategy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  content JSONB NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_documents TO authenticated;
GRANT ALL ON public.strategy_documents TO service_role;

ALTER TABLE public.strategy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own strategy document"
  ON public.strategy_documents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_strategy_documents_updated_at
  BEFORE UPDATE ON public.strategy_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ content_pillars ============
CREATE TABLE public.content_pillars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#a7421b',
  channel public.pillar_channel NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_pillars_user ON public.content_pillars(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_pillars TO authenticated;
GRANT ALL ON public.content_pillars TO service_role;

ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own pillars"
  ON public.content_pillars
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_content_pillars_updated_at
  BEFORE UPDATE ON public.content_pillars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
