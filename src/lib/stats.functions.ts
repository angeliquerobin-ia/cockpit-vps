import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createOpenRouterProvider } from "./openrouter-provider.server";
import { CHANNEL_LABELS } from "./channel-prompts";

export const refreshStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const settingsRes = await supabase
      .from("user_settings")
      .select("webhook_stats, active_channels")
      .eq("user_id", userId)
      .maybeSingle();

    const settings = settingsRes.data as
      | { webhook_stats: string; active_channels: string[] }
      | null;
    const webhook = settings?.webhook_stats?.trim();
    if (!webhook) {
      throw new Error(
        "Le webhook N8N des statistiques n'est pas configuré. Renseigne-le dans Réglages.",
      );
    }

    let body: any;
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          channels: settings?.active_channels ?? [],
        }),
      });
      if (!res.ok) throw new Error(`Webhook N8N a répondu ${res.status}`);
      body = await res.json();
    } catch (e: any) {
      throw new Error(`Appel au webhook N8N échoué : ${e.message ?? e}`);
    }

    const fetched_at = new Date().toISOString();
    await supabase
      .from("user_metrics_snapshot")
      .upsert({ user_id: userId, metrics: body ?? {}, fetched_at });

    return { fetched_at };
  });

export const analyzePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY manquant");
    const { supabase, userId } = context;

    const [snapRes, pillarsRes, postsRes, stratRes] = await Promise.all([
      supabase
        .from("user_metrics_snapshot")
        .select("metrics, fetched_at")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("content_pillars")
        .select("id, name, description")
        .eq("user_id", userId),
      supabase
        .from("posts")
        .select("title, channel, pillar_id, status, published_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("published_at", { ascending: false })
        .limit(200),
      supabase
        .from("strategy_documents")
        .select("content")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const snap = ((snapRes.data as any)?.metrics ?? {}) as Record<string, any>;
    const pillars = (pillarsRes.data ?? []) as Array<{
      id: string;
      name: string;
      description: string;
    }>;
    const posts = (postsRes.data ?? []) as Array<{
      title: string;
      channel: string | null;
      pillar_id: string | null;
      status: string;
      published_at: string | null;
    }>;
    const stratText =
      typeof (stratRes.data as any)?.content === "string"
        ? (stratRes.data as any).content
        : "";

    if (Object.keys(snap).length === 0) {
      throw new Error(
        "Aucune statistique récupérée. Clique d'abord sur « Rafraîchir ».",
      );
    }

    const pillarById = new Map(pillars.map((p) => [p.id, p]));

    // Aggregate posts by pillar and channel
    const byPillar = new Map<string, number>();
    const byChannel = new Map<string, number>();
    const published = posts.filter((p) => p.status === "publie");
    for (const p of published) {
      const pname = p.pillar_id
        ? (pillarById.get(p.pillar_id)?.name ?? "(à ranger)")
        : "(à ranger)";
      byPillar.set(pname, (byPillar.get(pname) ?? 0) + 1);
      const cname = p.channel
        ? (CHANNEL_LABELS[p.channel] ?? p.channel)
        : "(sans canal)";
      byChannel.set(cname, (byChannel.get(cname) ?? 0) + 1);
    }

    const pillarsBlock = pillars
      .map((p) => `- ${p.name} : ${p.description || "(pas de description)"}`)
      .join("\n");

    const block = [
      "## Métriques Metricool (brut)",
      JSON.stringify(snap, null, 2),
      "",
      "## Publications publiées — répartition par pilier",
      Array.from(byPillar.entries())
        .map(([k, v]) => `- ${k} : ${v} post(s)`)
        .join("\n") || "(aucun post publié)",
      "",
      "## Publications publiées — répartition par canal",
      Array.from(byChannel.entries())
        .map(([k, v]) => `- ${k} : ${v} post(s)`)
        .join("\n") || "(aucun post publié)",
      "",
      "## Mes piliers",
      pillarsBlock || "(aucun pilier défini)",
    ].join("\n");

    const openrouter = createOpenRouterProvider(apiKey);
    const { text } = await generateText({
      model: openrouter("openai/gpt-5"),
      system:
        "Tu es l'analyste de la coach. Tu écris en français, en prose claire et incarnée (Markdown autorisé : titres ##, gras, listes). N'invente aucun chiffre : appuie-toi uniquement sur les données fournies.",
      prompt: `${block}\n\n${stratText ? `## Ma ligne éditoriale\n${stratText}\n\n` : ""}## Tâche\nProduis une lecture stratégique structurée en Markdown :\n\n## Ce qui fonctionne\n(quels piliers, canaux et formats performent le mieux, avec les chiffres à l'appui)\n\n## Ce qui décroche\n(piliers/canaux/formats en perte de vitesse ou sous-exploités, avec les chiffres)\n\n## Mes meilleurs posts\n(si la donnée est disponible dans les métriques, cite-les ; sinon dis-le)\n\n## Recommandations\nTermine par exactement 3 à 6 recommandations concrètes, chacune sur sa propre ligne, formatées EXACTEMENT ainsi (sans rien d'autre sur la ligne) :\n- PISTE: <titre court et actionnable> — <pourquoi et comment, en une phrase>\n\nReste concis (300-500 mots). Les lignes "- PISTE:" doivent être parfaitement reconnaissables pour être extraites par l'app.`,
    });

    return { analysis: text.trim() };
  });
