import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { resolveAiModel } from "./ai-router.server";
import { DEFAULT_CHANNEL_PROMPTS, CHANNEL_LABELS } from "./channel-prompts";

const InputSchema = z.object({
  mode: z.enum([
    "generate",
    "shorten",
    "rewrite_hook",
    "more_embodied",
    "add_cta",
    "hashtags",
    "spellcheck",
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
  spellcheck:
    "Corrige UNIQUEMENT les fautes d'orthographe, de grammaire, de conjugaison, d'accord et de ponctuation dans le texte fourni. Tu dois absolument GARDER les phrases telles qu'elles sont : ne reformule rien, ne change pas le ton, ne déplace pas les mots, ne remplace pas de vocabulaire, ne raccourcis ni n'allonges aucune phrase. Conserve à l'identique la mise en forme, les sauts de ligne, les emojis, les hashtags et la ponctuation stylistique voulue. Renvoie uniquement le texte corrigé, sans commentaire, sans préambule, sans guillemets.",
};

export const aiWrite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
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

    const model = await resolveAiModel(userId, "writer");

    // Mode "spellcheck" : on court-circuite tout le contexte canal/pilier/stratégie
    // pour ne pas tenter de reformuler. On corrige uniquement la matière fournie.
    if (data.mode === "spellcheck") {
      const source = data.currentContent?.trim();
      if (!source) return { text: "" };
      const result = await generateText({
        model,
        system:
          "Tu es un correcteur orthographique et grammatical en français. Tu ne reformules JAMAIS. Tu ne changes JAMAIS la tournure ni le vocabulaire. Tu corriges uniquement les fautes (orthographe, grammaire, conjugaison, accords, ponctuation manifestement fautive). Tu renvoies uniquement le texte corrigé, à l'identique pour tout le reste (mise en forme, sauts de ligne, emojis, hashtags).",
        prompt: `${action}\n\n---\n\nTexte à corriger :\n\n${source}`,
      });
      return { text: result.text.trim() };
    }

    const result = await generateText({
      model,
      system:
        "Tu es l'agent de rédaction d'une coach. Tu écris en français, en respectant strictement la consigne du canal et la voix de l'autrice. Ne commente jamais ton travail, renvoie uniquement le texte du post (sans titre, sans guillemets, sans préambule).",
      prompt: `${contextBlock}\n\n---\n\n## Tâche\n${action}`,
    });

    return { text: result.text.trim() };
  });

const SuggestInputSchema = z.object({
  count: z.number().int().min(1).max(20).optional().default(8),
  hint: z.string().optional().default(""),
});

export const aiSuggestIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SuggestInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [stratRes, pillarsRes] = await Promise.all([
      supabase
        .from("strategy_documents")
        .select("content")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("content_pillars")
        .select("id,name,description,channel")
        .eq("user_id", userId),
    ]);

    const strategyText = plainText((stratRes.data as any)?.content).trim();
    const pillars = (pillarsRes.data ?? []) as Array<{
      id: string;
      name: string;
      description: string | null;
      channel: string | null;
    }>;

    const pillarsBlock = pillars.length
      ? pillars
          .map(
            (p) =>
              `- **${p.name}**${p.channel ? ` (canal habituel : ${CHANNEL_LABELS[p.channel] ?? p.channel})` : ""} — ${p.description ?? ""}`,
          )
          .join("\n")
      : "_Aucun pilier défini._";

    const contextBlock = [
      strategyText
        ? `## Ligne éditoriale & stratégie\n${strategyText}`
        : "",
      `## Piliers de contenu\n${pillarsBlock}`,
      data.hint?.trim() ? `## Orientation demandée\n${data.hint.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const model = await resolveAiModel(userId, "ideas");

    const result = await generateText({
      model,
      system:
        "Tu es une directrice éditoriale qui aide une coach à générer des idées de contenu. Tu réponds STRICTEMENT en JSON valide, sans texte hors JSON, sans bloc de code markdown.",
      prompt: `${contextBlock}\n\n---\n\n## Tâche\nPropose ${data.count} idées de contenu originales, fidèles à la ligne éditoriale et ancrées dans les piliers ci-dessus. Pour chaque idée : un titre court et incarné, un angle (1 à 2 phrases qui précisent la promesse/le point de vue), et le nom du pilier le plus pertinent parmi ceux listés (champ "pillar_name", exactement comme écrit ci-dessus, ou null si aucun ne colle).\n\nRenvoie uniquement un JSON de la forme :\n{"ideas":[{"title":"...","angle":"...","pillar_name":"..."}]}`,
    });

    let parsed: { ideas: Array<{ title: string; angle: string; pillar_name: string | null }> } = { ideas: [] };
    try {
      const raw = result.text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      parsed = JSON.parse(raw);
    } catch {
      parsed = { ideas: [] };
    }

    const ideas = (parsed.ideas ?? [])
      .filter((i) => i && typeof i.title === "string" && i.title.trim())
      .map((i) => {
        const match = pillars.find(
          (p) => p.name.toLowerCase() === (i.pillar_name ?? "").toLowerCase(),
        );
        return {
          title: i.title.trim(),
          angle: (i.angle ?? "").trim(),
          pillar_id: match?.id ?? null,
          channel: (match?.channel ?? null) as string | null,
        };
      });

    return { ideas };
  });

// ----- Scinder un texte libre en plusieurs idées distinctes -----

const SplitSchema = z.object({
  text: z.string().min(1),
});

export const aiSplitIdeas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SplitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: pillarsData } = await supabase
      .from("content_pillars")
      .select("id,name,description,channel")
      .eq("user_id", userId);
    const pillars = (pillarsData ?? []) as Array<{
      id: string;
      name: string;
      description: string | null;
      channel: string | null;
    }>;

    const pillarsBlock = pillars.length
      ? pillars
          .map((p) => `- **${p.name}** — ${p.description ?? ""}`)
          .join("\n")
      : "_Aucun pilier défini._";

    const model = await resolveAiModel(userId, "ideas");
    const result = await generateText({
      model,
      system:
        "Tu es une assistante éditoriale. Tu lis un texte libre contenant potentiellement plusieurs idées de contenu mélangées, et tu les scindes en idées distinctes. Tu réponds STRICTEMENT en JSON valide, sans texte hors JSON, sans bloc de code markdown.",
      prompt: `## Piliers de contenu disponibles\n${pillarsBlock}\n\n## Texte à scinder\n${data.text.trim()}\n\n---\n\n## Tâche\nIdentifie chaque idée distincte présente dans ce texte. Pour chacune, propose un titre court et incarné (max 90 caractères) et, si pertinent, un angle court (1 phrase qui précise la promesse, fidèle au texte original — n'invente rien si ce n'est pas dans le texte). Associe le nom du pilier le plus pertinent parmi ceux listés (champ "pillar_name", exactement comme écrit, ou null). Ne fusionne pas, ne reformule pas l'intention, garde la voix d'origine.\n\nRenvoie uniquement un JSON de la forme :\n{"ideas":[{"title":"...","angle":"...","pillar_name":"..."}]}`,
    });

    let parsed: {
      ideas: Array<{ title: string; angle: string; pillar_name: string | null }>;
    } = { ideas: [] };
    try {
      const raw = result.text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
      parsed = JSON.parse(raw);
    } catch {
      parsed = { ideas: [] };
    }

    const ideas = (parsed.ideas ?? [])
      .filter((i) => i && typeof i.title === "string" && i.title.trim())
      .map((i) => {
        const match = pillars.find(
          (p) => p.name.toLowerCase() === (i.pillar_name ?? "").toLowerCase(),
        );
        return {
          title: i.title.trim().slice(0, 200),
          angle: (i.angle ?? "").trim(),
          pillar_id: match?.id ?? null,
          channel: (match?.channel ?? null) as string | null,
        };
      });

    return { ideas };
  });

// ----- Décliner un post sur un autre canal -----

const DeriveSchema = z.object({
  sourcePostId: z.string().min(1),
  targetChannel: z.string().min(1),
});

export const aiDeriveForChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeriveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: source, error: srcErr } = await supabase
      .from("posts")
      .select("id,title,content,channel,pillar_id,idea_id")
      .eq("id", data.sourcePostId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (srcErr) throw new Error(srcErr.message);
    if (!source) throw new Error("Post d'origine introuvable.");

    const sourceChannelLabel = source.channel
      ? CHANNEL_LABELS[source.channel] ?? source.channel
      : "—";
    const targetChannelLabel =
      CHANNEL_LABELS[data.targetChannel] ?? data.targetChannel;

    const [stratRes, pillarRes, promptRes] = await Promise.all([
      supabase
        .from("strategy_documents")
        .select("content")
        .eq("user_id", userId)
        .maybeSingle(),
      source.pillar_id
        ? supabase
            .from("content_pillars")
            .select("name,description")
            .eq("id", source.pillar_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("channel_prompts")
        .select("prompt")
        .eq("user_id", userId)
        .eq("channel", data.targetChannel as any)
        .maybeSingle(),
    ]);

    const channelPrompt =
      (promptRes.data as any)?.prompt?.trim() ||
      DEFAULT_CHANNEL_PROMPTS[data.targetChannel] ||
      "Adopte un ton juste, incarné, élevant.";
    const strategyText = plainText((stratRes.data as any)?.content).trim();
    const pillar = pillarRes.data as
      | { name: string; description: string | null }
      | null;

    const contextBlock = [
      `# Canal cible : ${targetChannelLabel}`,
      ``,
      `## Consigne de rédaction du canal cible`,
      channelPrompt,
      ``,
      strategyText
        ? `## Ligne éditoriale & stratégie de l'autrice\n${strategyText}`
        : "",
      pillar
        ? `## Pilier de contenu\n**${pillar.name}**\n${pillar.description ?? ""}`
        : "",
      `## Post d'origine (canal : ${sourceChannelLabel})\n${(source.content ?? "").trim() || "(post vide)"}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const openrouter = createOpenRouterProvider(apiKey);
    const { text } = await generateText({
      model: openrouter("openai/gpt-5"),
      system:
        "Tu es l'agent de rédaction d'une coach. Tu écris en français. Tu adaptes un post à un autre canal en respectant strictement la consigne du canal cible (longueur, ton, format, structure). Ne traduis pas mot à mot : repense l'angle, l'accroche, le rythme et la chute pour qu'ils soient natifs au canal cible. Ne commente jamais ton travail, renvoie uniquement le texte du nouveau post (sans titre, sans guillemets, sans préambule).",
      prompt: `${contextBlock}\n\n---\n\n## Tâche\nDécline ce post pour le canal cible. Garde l'intention et le pilier. Adapte le format, la longueur, le ton et la structure aux usages du canal cible et à sa consigne de rédaction.`,
    });

    const newContent = text.trim();
    const newTitle = source.title
      ? `${source.title} — ${targetChannelLabel}`
      : `Décliné pour ${targetChannelLabel}`;

    const { data: inserted, error: insErr } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        title: newTitle.slice(0, 200),
        content: newContent,
        channel: data.targetChannel as any,
        pillar_id: source.pillar_id,
        idea_id: source.idea_id,
        source_post_id: source.id,
        status: "en_redaction",
      } as any)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { postId: (inserted as any).id };
  });

// ----- OCR : retranscrire une (ou plusieurs) photo(s) de texte -----

const OcrSchema = z.object({
  images: z
    .array(
      z.object({
        dataUrl: z.string().min(1),
      }),
    )
    .min(1)
    .max(8),
});

export const aiOcrImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OcrSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY manquant");

    const openrouter = createOpenRouterProvider(apiKey);
    const model = openrouter("google/gemini-2.5-flash");

    const result = await generateText({
      model,
      system:
        "Tu es un OCR fidèle. Tu reçois une ou plusieurs photos contenant du texte (notes manuscrites, captures, pages). Tu retranscris UNIQUEMENT le texte visible, dans l'ordre de lecture naturel. N'ajoute aucun commentaire, aucune mise en forme inventée, aucun titre. Conserve les sauts de ligne quand ils structurent le texte. Si plusieurs images sont fournies, sépare la retranscription de chaque image par une ligne vide. Si une image ne contient pas de texte lisible, ignore-la.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Retranscris fidèlement le texte présent dans ces images.",
            },
            ...data.images.map(
              (img) =>
                ({ type: "image", image: img.dataUrl }) as const,
            ),
          ],
        },
      ],
    });

    return { text: result.text.trim() };
  });
