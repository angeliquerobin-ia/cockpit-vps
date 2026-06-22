import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createOpenRouterProvider } from "./openrouter-provider.server";
import { CHANNEL_LABELS } from "./channel-prompts";

export const refreshCompetitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [settingsRes, competitorsRes] = await Promise.all([
      supabase
        .from("user_settings")
        .select("webhook_competitors, active_channels")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("competitors")
        .select("id, name, channel, handle")
        .eq("user_id", userId),
    ]);

    const settings = settingsRes.data as
      | { webhook_competitors: string; active_channels: string[] }
      | null;
    const webhook = settings?.webhook_competitors?.trim();
    if (!webhook) {
      throw new Error(
        "Le webhook N8N des concurrents n'est pas configuré. Renseigne-le dans Réglages.",
      );
    }
    const competitors = (competitorsRes.data ?? []) as Array<{
      id: string;
      name: string;
      channel: string;
      handle: string;
    }>;

    const payload = {
      user_id: userId,
      channels: settings?.active_channels ?? [],
      competitors: competitors.map((c) => ({
        id: c.id,
        name: c.name,
        channel: c.channel,
        handle: c.handle,
      })),
    };

    let body: any;
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`Webhook N8N a répondu ${res.status}`);
      }
      body = await res.json();
    } catch (e: any) {
      throw new Error(`Appel au webhook N8N échoué : ${e.message ?? e}`);
    }

    const self = (body?.self ?? {}) as Record<string, any>;
    const competitorsOut = (body?.competitors ?? []) as Array<{
      id: string;
      metrics: Record<string, any>;
    }>;

    const fetched_at = new Date().toISOString();

    await supabase
      .from("user_metrics_snapshot")
      .upsert({ user_id: userId, metrics: self, fetched_at });

    if (competitorsOut.length > 0) {
      await supabase.from("competitor_metrics").upsert(
        competitorsOut
          .filter((c) => competitors.some((x) => x.id === c.id))
          .map((c) => ({
            competitor_id: c.id,
            user_id: userId,
            metrics: c.metrics ?? {},
            fetched_at,
          })),
      );
    }

    return { fetched_at };
  });

// ----- AI : analyse des chiffres -----

export const analyzeCompetitorsMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY manquant");
    const { supabase, userId } = context;

    const [competitorsRes, metricsRes, selfRes, stratRes] = await Promise.all([
      supabase
        .from("competitors")
        .select("id,name,channel,handle")
        .eq("user_id", userId),
      supabase
        .from("competitor_metrics")
        .select("competitor_id,metrics")
        .eq("user_id", userId),
      supabase
        .from("user_metrics_snapshot")
        .select("metrics")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("strategy_documents")
        .select("content")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const competitors = (competitorsRes.data ?? []) as any[];
    const metricsMap = new Map<string, any>();
    for (const r of (metricsRes.data ?? []) as any[])
      metricsMap.set(r.competitor_id, r.metrics);
    const self = ((selfRes.data as any)?.metrics ?? {}) as Record<string, any>;

    if (competitors.length === 0) {
      throw new Error("Aucun concurrent à analyser.");
    }
    if (Object.keys(self).length === 0 && metricsMap.size === 0) {
      throw new Error(
        "Aucune métrique récupérée. Clique d'abord sur « Rafraîchir ».",
      );
    }

    const block = [
      "## Mes métriques (par canal)",
      JSON.stringify(self, null, 2),
      "",
      "## Métriques des concurrents",
      ...competitors.map((c) => {
        return `- ${c.name} (${CHANNEL_LABELS[c.channel] ?? c.channel}, ${c.handle}) : ${JSON.stringify(metricsMap.get(c.id) ?? {})}`;
      }),
    ].join("\n");

    const stratText =
      typeof (stratRes.data as any)?.content === "string"
        ? (stratRes.data as any).content
        : "";

    const openrouter = createOpenRouterProvider(apiKey);
    const { text } = await generateText({
      model: openrouter("openai/gpt-5"),
      system:
        "Tu es l'analyste de la coach. Tu écris en français, en prose claire et incarnée (Markdown autorisé : titres ##, gras, listes). Pas de chiffres inventés : appuie-toi uniquement sur les données fournies.",
      prompt: `Voici les métriques comparatives :\n\n${block}\n\n${stratText ? `## Ligne éditoriale\n${stratText}\n\n` : ""}## Tâche\nRédige une analyse synthétique :\n1. Où je me situe globalement.\n2. Sur quels indicateurs un concurrent me devance (et lequel).\n3. Sur quels indicateurs je devance.\n4. Ce que ça suggère concrètement (2-4 pistes d'action).\nReste concis (250-400 mots).`,
    });

    return { analysis: text.trim() };
  });

// ----- AI : analyse du contenu via N8N + Firecrawl -----

const ContentInput = z.object({
  competitorIds: z.array(z.string()).min(1),
});

export const analyzeCompetitorsContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ContentInput.parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY manquant");
    const { supabase, userId } = context;

    const [settingsRes, competitorsRes, stratRes] = await Promise.all([
      supabase
        .from("user_settings")
        .select("webhook_competitors_content")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("competitors")
        .select("id,name,channel,handle")
        .eq("user_id", userId)
        .in("id", data.competitorIds),
      supabase
        .from("strategy_documents")
        .select("content")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const webhook = (settingsRes.data as any)?.webhook_competitors_content?.trim();
    if (!webhook) {
      throw new Error(
        "Le webhook N8N « analyse contenu concurrents » n'est pas configuré. Renseigne-le dans Réglages.",
      );
    }
    const competitors = (competitorsRes.data ?? []) as any[];
    if (competitors.length === 0) {
      throw new Error("Aucun concurrent sélectionné.");
    }

    // Call N8N to fetch recent posts via Firecrawl
    let posts: any[] = [];
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          competitors: competitors.map((c) => ({
            id: c.id,
            name: c.name,
            channel: c.channel,
            handle: c.handle,
          })),
        }),
      });
      if (!res.ok) throw new Error(`Webhook N8N a répondu ${res.status}`);
      const body = await res.json();
      posts = (body?.posts ?? body?.competitors ?? []) as any[];
    } catch (e: any) {
      throw new Error(`Appel au webhook N8N échoué : ${e.message ?? e}`);
    }

    const stratText =
      typeof (stratRes.data as any)?.content === "string"
        ? (stratRes.data as any).content
        : "";

    const corpus = competitors
      .map((c) => {
        const own = posts.filter(
          (p: any) => p.competitor_id === c.id || p.id === c.id,
        );
        const flat = own.length
          ? own
              .flatMap((p: any) => p.posts ?? [p])
              .slice(0, 20)
              .map(
                (p: any, i: number) =>
                  `  ${i + 1}. ${(p.text ?? p.caption ?? p.content ?? "").toString().slice(0, 500)}`,
              )
              .join("\n")
          : "  (aucun post récupéré)";
        return `### ${c.name} — ${CHANNEL_LABELS[c.channel] ?? c.channel}\n${flat}`;
      })
      .join("\n\n");

    const openrouter = createOpenRouterProvider(apiKey);
    const { text } = await generateText({
      model: openrouter("openai/gpt-5"),
      system:
        "Tu es l'analyste éditoriale de la coach. Français, ton incarné, Markdown autorisé. Reste fidèle aux posts fournis, n'invente rien.",
      prompt: `## Posts récents des concurrents\n${corpus}\n\n${stratText ? `## Ma ligne éditoriale\n${stratText}\n\n` : ""}## Tâche\nProduis une analyse structurée en Markdown :\n\n## Thèmes récurrents\n(liste à puces)\n\n## Accroches qui reviennent\n(2-4 patterns observés, avec exemple court)\n\n## Formats qui semblent fonctionner\n(liste à puces)\n\n## Rythme de publication\n(estimation par concurrent)\n\n## Pistes pour moi\nTermine par exactement 4 à 6 pistes concrètes, chacune sur sa propre ligne, formatées ainsi (sans rien d'autre sur la ligne) :\n- PISTE: <titre court> — <pourquoi c'est intéressant pour moi en une phrase>\n\nLes lignes "- PISTE:" doivent être parfaitement reconnaissables pour être extraites par l'app.`,
    });

    return { analysis: text.trim() };
  });

// ----- Transformer une piste en idée -----

const IdeaInput = z.object({
  title: z.string().min(1),
  note: z.string().optional().default(""),
});

export const createIdeaFromSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdeaInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ideas")
      .insert({
        user_id: userId,
        title: data.title.slice(0, 200),
        note: data.note ?? "",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });
