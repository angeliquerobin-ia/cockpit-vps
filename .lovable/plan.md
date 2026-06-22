
# Bascule de l'agent IA sur l'API OpenAI (GPT-5)

## Objectif

Remplacer l'appel à Lovable AI Gateway par un appel direct à l'**API OpenAI** avec ton compte personnel et ta clé API. Le modèle utilisé sera **GPT-5** pour la meilleure qualité rédactionnelle française.

Aucun changement visible côté interface : tous les boutons de génération du Studio (génération, raccourcir, réécrire l'accroche, plus incarné, ajouter un CTA, hashtags) continuent à fonctionner exactement comme avant.

## Ce que tu dois préparer de ton côté

Avant que je touche au code, il te faut une clé API OpenAI :

1. Va sur **platform.openai.com** (différent de chat.openai.com — c'est le portail développeur d'OpenAI).
2. Connecte-toi (tu peux utiliser le même compte que ton ChatGPT Plus, ou en créer un nouveau).
3. Menu **Settings → Billing** → ajoute un moyen de paiement et un crédit initial (10 € suffisent pour démarrer largement).
4. Menu **API keys → Create new secret key** → donne-lui un nom (ex. *Cockpit*) → copie la clé qui commence par `sk-...`.
5. **Garde cette clé ouverte dans un onglet** — OpenAI ne te la remontrera plus après.

Quand tu seras prêt, je te demanderai cette clé via un formulaire sécurisé Lovable (jamais en clair dans le chat).

## Ce que je vais faire côté code

### Modifications

1. **Stocker `OPENAI_API_KEY` comme secret** côté serveur Cockpit (via le formulaire sécurisé).

2. **Créer `src/lib/openai-provider.server.ts`** : un petit helper équivalent à l'actuel `ai-gateway.server.ts`, qui configure le SDK AI sur l'endpoint OpenAI officiel (`https://api.openai.com/v1`) avec l'authentification standard `Authorization: Bearer sk-...`.

3. **Modifier `src/lib/ai-writer.functions.ts`** :
   - Remplacer la lecture de `LOVABLE_API_KEY` par `OPENAI_API_KEY`.
   - Remplacer l'appel à `createLovableAiGatewayProvider` par le nouveau provider OpenAI.
   - Remplacer le modèle `google/gemini-3-flash-preview` par `gpt-5`.
   - Conserver à l'identique : la chaîne de contexte (stratégie + pilier + consigne canal + sujet), le prompt système français, la logique d'actions (générer / raccourcir / réécrire l'accroche / etc.).

4. **Supprimer la dépendance à Lovable AI** pour la partie rédactionnelle. Le helper `ai-gateway.server.ts` peut rester en place pour un éventuel usage futur, mais il ne sera plus appelé.

### Détails techniques

- Le SDK AI utilisé reste le même (`ai` + `@ai-sdk/openai-compatible`), donc aucune nouvelle dépendance npm à installer.
- L'appel passe par le serveur (server function TanStack Start déjà en place), ta clé OpenAI **ne sort jamais vers le navigateur**.
- La fonction `aiWrite` est protégée par `requireSupabaseAuth` : seuls les utilisateurs connectés peuvent déclencher des appels OpenAI.

## Ce qui ne change pas dans cette étape

- **Lovable Cloud** reste actif pour la base de données, l'auth et le storage (on s'occupera de la migration vers ton VPS souverain dans une étape dédiée, plus tard).
- **N8N** reste le seul interlocuteur de Metricool pour la publication.
- **Cloudinary** reste utilisé pour les Réels.
- L'interface du Studio, du Calendrier, des Réglages : **inchangée**.

## Coût attendu

Avec GPT-5 sur des posts LinkedIn / Instagram (quelques centaines de tokens en entrée, quelques centaines en sortie) :

- **Génération d'un post complet** : ~5 à 10 centimes
- **Raccourcir / réécrire l'accroche** : ~3 à 5 centimes
- **Hashtags** : ~1 à 2 centimes

Pour un usage type « 1 à 2 posts par jour » : compte **3 à 10 € / mois** d'API OpenAI.

## Prochaines étapes après cette bascule

Une fois GPT-5 branché et testé, on pourra enchaîner sur :

- **Étape 11 et suivantes** : les fonctionnalités qui restent (stats, concurrents, etc.) — elles utiliseront automatiquement OpenAI dès qu'elles passeront par l'agent.
- **Migration self-host** (chantier dédié, quand l'app sera fonctionnellement complète) : export du code, mise en place d'un Supabase auto-hébergé sur ton VPS, déploiement du frontend.

Quand tu as ta clé `sk-...` sous la main, dis-moi simplement *« j'ai la clé »* et je lance le formulaire sécurisé + les modifications dans la foulée.
