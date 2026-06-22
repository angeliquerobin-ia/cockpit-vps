import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { DEFAULT_CHANNEL_PROMPTS, CHANNEL_LABELS } from "./channel-prompts";

const InputSchema = z.object({
  mode: z.enum([
    "generate",
    "shorten",
    "rewrite_hook",
    "more_embodied",
    "add_cta",
    "hashtags",
  ]),
  channel: z.string().nullable().optional(),
  pillarId: z.string().nullable().optional(),
  subject: z.string().optional().default(""),
  currentContent: z.string().optional().default(""),
});

function plainText(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  // TipTap JSON: walk and join text nodes
  try {
    const walk = (node: any): string => {
      if (!node) return "";
      if (typeof node.text === "string") return node.text;
      if (Array.isArray(node.content))
        return node.content.map(walk).join("\n");
      return "";
    };
    return walk(v);
  } catch {
    return "";
  }
}

const ACTION_INSTRUCTIONS: Record<string, string> = {
  generate:
    "Rédige un post complet, prêt à publier, qui respecte scrupuleusement la consigne du canal ci-dessus.",
  shorten:
    "Raccourcis significativement le post fourni tout en gardant son essence, son ton et son appel à l'action. Reste fidèle à la consigne du canal.",
  rewrite_hook:
    "Réécris uniquement l'accroche (la ou les premières lignes) du post fourni pour qu'elle arrête mieux le scroll. Garde le reste du texte intact et renvoie le post complet.",
  more_embodied:
    "Réécris le post fourni pour qu'il soit plus incarné, plus sensoriel, plus vivant. Ajoute un exemple concret ou une image parlante si pertinent. Garde la même intention.",
  add_cta:
    "Ajoute (ou remplace) un appel à l'action clair, doux et adapté à la fin du post fourni. Renvoie le post complet.",
  hashtags:
    "Propose une sélection de 10 à 15 hashtags pertinents, en français, mélangeant volumes large et niche. Renvoie uniquement la liste, séparée par des espaces.",
};

export const aiWrite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY manquant");

    const { supabase, userId } = context;

    // Fetch context in parallel
    const [stratRes, pillarRes, promptRes] = await Promise.all([
      supabase
        .from("strategy_documents")
        .select("content")
        .eq("user_id", userId)
        .maybeSingle(),
      data.pillarId
        ? supabase
            .from("content_pillars")
            .select("name,description,channel")
            .eq("id", data.pillarId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      data.channel
        ? supabase
            .from("channel_prompts")
            .select("prompt")
            .eq("user_id", userId)
            .eq("channel", data.channel as any)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const channel = data.channel ?? "";
    const channelLabel = channel ? CHANNEL_LABELS[channel] ?? channel : "—";
    const channelPrompt =
      (promptRes.data as any)?.prompt?.trim() ||
      DEFAULT_CHANNEL_PROMPTS[channel] ||
      "Adopte un ton juste, incarné, élevant.";
    const strategyText = plainText((stratRes.data as any)?.content).trim();
    const pillar = pillarRes.data as
      | { name: string; description: string | null }
      | null;

    const contextBlock = [
      `# Canal : ${channelLabel}`,
      ``,
      `## Consigne de rédaction du canal`,
      channelPrompt,
      ``,
      strategyText
        ? `## Ligne éditoriale & stratégie de l'autrice\n${strategyText}`
        : "",
      pillar
        ? `## Pilier de contenu\n**${pillar.name}**\n${pillar.description ?? ""}`
        : "",
      data.subject?.trim()
        ? `## Sujet / angle demandé\n${data.subject.trim()}`
        : "",
      data.currentContent?.trim()
        ? `## Contenu actuel du post\n${data.currentContent.trim()}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const action =
      ACTION_INSTRUCTIONS[data.mode] ?? ACTION_INSTRUCTIONS.generate;

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const result = await generateText({
      model,
      system:
        "Tu es l'agent de rédaction d'une coach. Tu écris en français, en respectant strictement la consigne du canal et la voix de l'autrice. Ne commente jamais ton travail, renvoie uniquement le texte du post (sans titre, sans guillemets, sans préambule).",
      prompt: `${contextBlock}\n\n---\n\n## Tâche\n${action}`,
    });

    return { text: result.text.trim() };
  });
