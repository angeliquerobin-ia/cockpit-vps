ALTER TABLE public.user_settings
  ALTER COLUMN active_channels
  SET DEFAULT ARRAY['linkedin','instagram_coaching','podcast','substack']::text[];

UPDATE public.user_settings
SET active_channels = array_remove(active_channels, 'instagram_chroniques_cosmiques')
WHERE 'instagram_chroniques_cosmiques' = ANY(active_channels);