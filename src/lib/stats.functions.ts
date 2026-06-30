import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { createOpenRouterProvider } from "./openrouter-provider.server";
import { CHANNEL_LABELS } from "./channel-prompts";
import {
  DEFAULT_STATS_PROMPT,
  STATS_MODE_PROMPTS,
  type StatsMode,
} from "./stats-prompts";

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

const VALID_MODES: StatsMode[] = ["full", "hooks", "matrix", "monthly", "drop"];

export const analyzePerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const raw = (input ?? {}) as { mode?: string };
    const mode = (VALID_MODES as string[]).includes(raw.mode ?? "full")
      ? ((raw.mode ?? "full") as StatsMode)
      : ("full" as StatsMode);
    return { mode };
  })
  .handler(async ({ context, data }) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY manquant");
    const { supabase, userId } = context;
    const mode = data.mode;

    const [snapRes, pillarsRes, postsRes, stratRes, settingsRes] =
      await Promise.all([
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
          .select(
            "title, channel, pillar_id, status, published_at, scheduled_at",
          )
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("published_at", { ascending: false })
          .limit(200),
        supabase
          .from("strategy_documents")
          .select("content")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("user_settings")
          .select("stats_prompt")
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
      scheduled_at: string | null;
    }>;
    const stratText =
      typeof (stratRes.data as any)?.content === "string"
        ? (stratRes.data as any).content
        : "";
    const customStatsPrompt =
      typeof (settingsRes.data as any)?.stats_prompt === "string"
        ? ((settingsRes.data as any).stats_prompt as string).trim()
        : "";

    if (Object.keys(snap).length === 0) {
      throw new Error(
        "Aucune statistique récupérée. Clique d'abord sur « Rafraîchir ».",
      );
    }

    const pillarById = new Map(pillars.map((p) => [p.id, p]));

    const byPillar = new Map<string, number>();
    const byChannel = new Map<string, number>();
    const byDay = new Map<string, number>();
    const byHour = new Map<string, number>();
    const published = posts.filter((p) => p.status === "publie");
    const DAY_LABELS = [
      "Dimanche",
      "Lundi",
      "Mardi",
      "Mercredi",
      "Jeudi",
      "Vendredi",
      "Samedi",
    ];
    for (const p of published) {
      const pname = p.pillar_id
        ? (pillarById.get(p.pillar_id)?.name ?? "(à ranger)")
        : "(à ranger)";
      byPillar.set(pname, (byPillar.get(pname) ?? 0) + 1);
      const cname = p.channel
        ? (CHANNEL_LABELS[p.channel] ?? p.channel)
        : "(sans canal)";
      byChannel.set(cname, (byChannel.get(cname) ?? 0) + 1);
      const when = p.published_at ?? p.scheduled_at;
      if (when) {
        const d = new Date(when);
        const day = DAY_LABELS[d.getDay()];
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
        const h = d.getHours();
        const slot =
          h < 6
            ? "Nuit (0-6h)"
            : h < 12
              ? "Matin (6-12h)"
              : h < 14
                ? "Midi (12-14h)"
                : h < 18
                  ? "Après-midi (14-18h)"
                  : "Soir (18-24h)";
        byHour.set(slot, (byHour.get(slot) ?? 0) + 1);
      }
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
      "## Publications publiées — répartition par jour de semaine",
      Array.from(byDay.entries())
        .map(([k, v]) => `- ${k} : ${v} post(s)`)
        .join("\n") || "(non disponible)",
      "",
      "## Publications publiées — répartition par créneau horaire",
      Array.from(byHour.entries())
        .map(([k, v]) => `- ${k} : ${v} post(s)`)
        .join("\n") || "(non disponible)",
      "",
      "## Mes piliers",
      pillarsBlock || "(aucun pilier défini)",
    ].join("\n");

    const system =
      mode === "full"
        ? customStatsPrompt || DEFAULT_STATS_PROMPT
        : STATS_MODE_PROMPTS[mode].system;

    const openrouter = createOpenRouterProvider(apiKey);
    const { text } = await generateText({
      model: openrouter("openai/gpt-5"),
      system,
      prompt: `${block}\n\n${stratText ? `## Ma ligne éditoriale\n${stratText}\n\n` : ""}## Tâche\nAnalyse les données ci-dessus selon la trame qui t'a été donnée. Reste concise, factuelle, et n'invente jamais un chiffre.`,
    });

    return { analysis: text.trim(), mode };
  });
