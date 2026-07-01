
CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  endpoint text NOT NULL,
  api_key text NOT NULL,
  models text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Column-level SELECT: hide api_key from client Data API
GRANT SELECT (id, user_id, name, endpoint, models, created_at, updated_at)
  ON public.ai_providers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai providers"
  ON public.ai_providers FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER ai_providers_updated_at
  BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ai_function_routes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_key text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.ai_providers(id) ON DELETE CASCADE,
  model text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, function_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_function_routes TO authenticated;
GRANT ALL ON public.ai_function_routes TO service_role;

ALTER TABLE public.ai_function_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ai routes"
  ON public.ai_function_routes FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER ai_function_routes_updated_at
  BEFORE UPDATE ON public.ai_function_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
