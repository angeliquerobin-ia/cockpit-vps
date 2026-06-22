CREATE TABLE public.channel_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel public.pillar_channel NOT NULL,
  prompt text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_prompts TO authenticated;
GRANT ALL ON public.channel_prompts TO service_role;

ALTER TABLE public.channel_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own channel prompts"
  ON public.channel_prompts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER channel_prompts_updated_at
  BEFORE UPDATE ON public.channel_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();