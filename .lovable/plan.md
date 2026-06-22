Ajouter un bloc d'aide dans la page Réglages, sous le champ « Webhook Statistiques », qui explique à l'utilisateur :

1. Quand l'app appelle ce webhook et avec quel payload (`user_id` + tableau de canaux actifs).
2. Le format JSON attendu en retour : un objet avec une clé par canal, chacune contenant `followers`, `engagement`, `reach`, `top_posts` (tableau d'objets avec `title`, `engagement`, `date`).
3. Une mention que le workflow N8N doit appeler l'API Metricool, puis retourner ce JSON.

Technique :
- Lire `stats.functions.ts` et `reglages.tsx` pour extraire le payload exact et le format.
- Ajouter un composant d'aide collapsible ou un simple bloc texte sous le champ `webhook_stats` dans `reglages.tsx`.
- Utiliser les tokens de couleur et la typographie du projet (Cormorant Garamond pour les titres, Poppins pour le corps).

Pas de changement de schéma DB ni de logique serveur — seulement de la documentation UI.