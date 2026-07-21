-- Couleur par colonne du tableau Studio de Création.
-- La couleur des pastilles (board + calendrier) est portée par la colonne,
-- indépendamment des piliers éditoriaux.
ALTER TABLE public.board_columns
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#8a8276';
