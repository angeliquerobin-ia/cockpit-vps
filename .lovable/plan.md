## Objectif

Construire la page **Concurrents** : suivre des comptes concurrents, rafraîchir leurs métriques via le webhook N8N (`webhook_competitors` déjà dans `user_settings`), et afficher une comparaison côte à côte avec mes propres performances. Identité visuelle et navigation conservées.

## Modèle de données (migration)

Deux tables côté `public` :

1. **`competitors`** — comptes suivis (CRUD utilisateur)
   - `id uuid pk`, `user_id uuid` (FK `auth.users`)
   - `name text not null`
   - `channel text not null` (un des `active_channels`)
   - `handle text not null` (identifiant / URL du compte)
   - `notes text default ''` (observations libres)
   - `created_at`, `updated_at` (trigger existant)
   - RLS `auth.uid() = user_id`, GRANT authenticated + service_role

2. **`competitor_metrics`** — dernier snapshot renvoyé par N8N
   - `competitor_id uuid pk` (FK `competitors` on delete cascade)
   - `user_id uuid` (pour RLS)
   - `metrics jsonb not null` (engagement, rythme de publication, croissance audience, etc. — schéma souple, on lit ce que renvoie Metricool)
   - `fetched_at timestamptz default now()`
   - RLS + GRANT idem

3. **`user_metrics_snapshot`** (1 ligne par utilisateur) — pour stocker mes propres chiffres renvoyés par N8N afin de les comparer
   - `user_id uuid pk`, `metrics jsonb`, `fetched_at timestamptz`
   - RLS + GRANT idem

## Server function

`src/lib/competitors.functions.ts` — `refreshCompetitors` (authentifié) :
1. Lit `webhook_competitors` dans `user_settings`. Erreur claire s'il est vide.
2. Lit la liste des `competitors` de l'utilisateur + ses `active_channels`.
3. POST sur le webhook : `{ user_id, channels, competitors: [{id, channel, handle}] }`.
4. Attend une réponse `{ self: {channel: metrics}, competitors: [{id, metrics}] }`.
5. Upsert dans `competitor_metrics` (un row par concurrent) et `user_metrics_snapshot`.
6. Retourne `{ fetched_at }`.

Le CRUD des concurrents se fait directement avec `supabase` côté client (cohérent avec `idees.tsx`, `reels.tsx`).

## UI — `src/routes/_authenticated/concurrents.tsx`

Remplace le placeholder. Structure :

- **En-tête** type Idées (kicker + h1 Cormorant + sous-titre italique).
- **Barre d'action** : bouton « Rafraîchir » (icône `RefreshCw`) → appelle `refreshCompetitors`. État `loading` (spinner + texte « Connexion à Metricool… »). À droite : « Dernier rafraîchissement : il y a X min ».
- **Section « Mes comptes suivis »** : grille de cartes (1 par concurrent) avec nom, badge canal, handle, extrait des notes ; actions hover Modifier / Supprimer (même pattern que `idees.tsx`).
- **Bouton « Ajouter un concurrent »** ouvre une carte d'édition inline (nom, select canal parmi `active_channels`, handle, textarea notes).
- **Section « Comparaison côte à côte »** : un tableau par canal présent.
  - Colonnes : Indicateur | Moi | Concurrent 1 | Concurrent 2 | …
  - Lignes : Engagement (%), Rythme de publication (/semaine), Croissance audience (30j, %).
  - Mise en valeur des écarts : la meilleure valeur de la ligne en `text-primary` + flèche `ArrowUp`, les valeurs en deçà de la mienne avec opacité réduite + flèche `ArrowDown` terracotta. Différence numérique (`+12 pts`) en petit à côté.
  - Si aucune métrique : encart doux invitant à cliquer sur Rafraîchir.

Aucune autre page ni la navigation n'est modifiée. Toutes les données métriques viennent du webhook N8N — l'app n'appelle jamais Metricool.

## Détails techniques

- Pas de nouveau secret : on lit `webhook_competitors` en base.
- Le fetch HTTP du webhook se fait côté serveur (server function) pour éviter CORS et exposer l'URL.
- Types souples côté metrics (`Record<string, number>`) ; on calcule la "meilleure valeur" en triant numériquement par ligne.
- Confirmer la suppression avec `confirm()` comme dans `idees.tsx`.
