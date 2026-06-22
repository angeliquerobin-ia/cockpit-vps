CREATE TYPE public.reel_status AS ENUM ('a_sous_titrer', 'sous_titre', 'publie');

CREATE TABLE public.reels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  pillar_id uuid REFERENCES public.content_pillars(id) ON DELETE SET NULL,
  channel public.pillar_channel,
  status public.reel_status NOT NULL DEFAULT 'a_sous_titrer',
  video_path text NOT NULL,
  transcription text NOT NULL DEFAULT '',
  subtitles text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reels TO authenticated;
GRANT ALL ON public.reels TO service_role;

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own reels"
  ON public.reels FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER reels_updated_at
  BEFORE UPDATE ON public.reels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies: each user can only touch files in their own folder (first path segment = user_id)
CREATE POLICY "Users read their own reel files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload their own reel files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update their own reel files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete their own reel files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'reels' AND auth.uid()::text = (storage.foldername(name))[1]);