import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
