import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import type { AiFunctionKey } from "./ai-router.shared";

export type { AiFunctionKey } from "./ai-router.shared";
export {
  AI_FUNCTION_KEYS,
  AI_FUNCTION_LABELS,
  AI_FUNCTION_DESCRIPTIONS,
} from "./ai-router.shared";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1";

function buildProvider(name: string, endpoint: string, apiKey: string) {
  return createOpenAICompatible({
    name: name || "custom",
    baseURL: endpoint.replace(/\/+$/, ""),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://lovable.dev",
      "X-Title": "Cockpit",
    },
  });
}

/**
 * Résout le modèle à utiliser pour une fonction IA donnée :
 * 1. Cherche un routage explicite dans `ai_function_routes` pour l'utilisateur.
 * 2. À défaut, retombe sur OpenRouter + `OPENROUTER_API_KEY` avec le modèle par défaut.
 */
export async function resolveAiModel(
  userId: string,
  functionKey: AiFunctionKey,
  fallbackModel = "openai/gpt-5",
): Promise<LanguageModel> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: route } = await supabaseAdmin
    .from("ai_function_routes" as any)
    .select("provider_id, model")
    .eq("user_id", userId)
    .eq("function_key", functionKey)
    .maybeSingle();

  const r = route as { provider_id: string; model: string } | null;
  if (r?.provider_id && r?.model) {
    const { data: provider } = await supabaseAdmin
      .from("ai_providers" as any)
      .select("name, endpoint, api_key")
      .eq("id", r.provider_id)
      .eq("user_id", userId)
      .maybeSingle();
    const p = provider as
      | { name: string; endpoint: string; api_key: string }
      | null;
    if (p?.endpoint && p?.api_key) {
      return buildProvider(p.name, p.endpoint, p.api_key)(r.model);
    }
  }

  const envKey = process.env.OPENROUTER_API_KEY;
  if (!envKey) {
    throw new Error(
      "Aucun modèle configuré pour cette fonction. Ajoute un fournisseur d'IA et choisis un modèle dans Réglages.",
    );
  }
  return buildProvider("openrouter", OPENROUTER_ENDPOINT, envKey)(fallbackModel);
}
