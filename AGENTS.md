# Cockpit de création de contenu

Application souveraine de gestion de contenu (stratégie, idées, calendrier,
studio de rédaction IA, réels, statistiques, veille) pour une utilisatrice.

- **Stack** : TanStack Start (React 19 + Bun + Nitro), Tailwind 4, Supabase
  auto-hébergé (auth, Postgres, storage), OpenRouter pour l'IA, N8N pour les
  intégrations Metricool.
- **Déploiement** : Coolify sur VPS, via le Dockerfile (preset Nitro `bun`).
- **Secrets** : uniquement en variables d'environnement côté serveur
  (`OPENROUTER_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — jamais dans le code ni
  exposés au navigateur. Le `.env` local n'est pas versionné.
- **Design** : palette lin/terracotta (fond `#F7F3ED`, cartes `#FAEEE0`,
  titres Cormorant Garamond `#5A3B2A`, corps Poppins Light, accents `#A7421B`),
  jamais de blanc pur ni de mode sombre.
- **Langue** : toute l'interface et les messages d'erreur sont en français.
