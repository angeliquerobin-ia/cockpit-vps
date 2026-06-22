
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  metricool_plan text NOT NULL DEFAULT 'gratuit',
  active_channels text[] NOT NULL DEFAULT ARRAY['linkedin','instagram_coaching','instagram_chroniques_cosmiques','podcast','substack']::text[],
  webhook_publish text NOT NULL DEFAULT '',
  webhook_stats text NOT NULL DEFAULT '',
  webhook_competitors text NOT NULL DEFAULT '',
  webhook_transcription text NOT NULL DEFAULT '',
  webhook_subtitles text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_settings_plan_check CHECK (metricool_plan IN ('gratuit','starter','advanced'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own settings"
ON public.user_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
