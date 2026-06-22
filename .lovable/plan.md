## Objectif

Remplacer OpenAI direct par **OpenRouter** pour l'agent de rédaction, afin d'utiliser ta clé API OpenRouter (et plus de souci de quota OpenAI).

## Étapes

1. **Ajouter ta clé OpenRouter en secret** (`OPENROUTER_API_KEY`) — tu la colleras dans le formulaire sécurisé. À récupérer sur https://openrouter.ai/keys.

2. **Renommer le provider serveur** : `src/lib/openai-provider.server.ts` → `src/lib/openrouter-provider.server.ts`
   - `baseURL` : `https://openrouter.ai/api/v1`
   - Header `Authorization: Bearer ${apiKey}`
   - (optionnel) headers `HTTP-Referer` et `X-Title` recommandés par OpenRouter pour identifier l'app.

3. **Mettre à jour `src/lib/ai-writer.functions.ts`** :
   - Lire `process.env.OPENROUTER_API_KEY` au lieu d'`OPENAI_API_KEY`.
   - Importer le nouveau provider.
   - Modèle par défaut : `openai/gpt-5` (slug OpenRouter pour GPT-5).

4. **Test rapide** : tu cliques sur "Générer" dans l'éditeur depuis la preview pour valider que la réponse arrive bien.

## Détails techniques

- OpenRouter est 100 % compatible OpenAI ; on garde le même client `@ai-sdk/openai-compatible` et `generateText` du AI SDK, donc zéro changement côté UI.
- Le slug `openai/gpt-5` peut être remplacé par n'importe quel modèle dispo sur OpenRouter (Claude, Gemini, Llama, etc.) — on pourra le rendre configurable plus tard si tu veux.
- Aucune modification de la base de données ni du frontend.

## Question

Tu confirmes qu'on garde **GPT-5 via OpenRouter** comme modèle par défaut, ou tu veux qu'on passe sur un autre (ex. `anthropic/claude-sonnet-4.5`, `google/gemini-2.5-pro`) ?
