ALTER TABLE public.content_pillars ALTER COLUMN channel DROP NOT NULL;
ALTER TABLE public.content_pillars ALTER COLUMN description DROP NOT NULL;
ALTER TABLE public.content_pillars ALTER COLUMN description SET DEFAULT '';