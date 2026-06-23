import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const FREE_MONTHLY_LIMIT = 20;

const InputSchema = z.object({
  postId: z.string().uuid(),
  channel: z.string().min(1),
  // mode : "now" publie immédiatement ; "schedule" utilise scheduledAt ;
  // "auto" laisse Metricool choisir le meilleur créneau
  timing: z.enum(["now", "schedule", "auto"]),
  scheduledAt: z.string().datetime().optional(),
});

export const publishPostViaN8n = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Réglages utilisateur (webhook, plan, réseaux actifs)
    const { data: settings, error: sErr } = await supabase
      .from("user_settings")
      .select(
        "webhook_publish,metricool_plan,active_channels",
      )
      .eq("user_id", userId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!settings) throw new Error("Vos réglages n'ont pas été initialisés.");

    const s = settings as any;
    const webhook = (s.webhook_publish ?? "").trim();
    if (!webhook)
      throw new Error(
        "Aucun webhook N8N de publication n'est enregistré dans les Réglages.",
      );

    const activeChannels: string[] = s.active_channels ?? [];
    if (!activeChannels.includes(data.channel))
      throw new Error(
        "Ce réseau n'est pas actif dans vos Réglages.",
      );

    // 2) Quota plan gratuit
    if (s.metricool_plan === "gratuit") {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "publie" as any)
        .gte("published_at", start.toISOString());
      if ((count ?? 0) >= FREE_MONTHLY_LIMIT)
        throw new Error(
          `Limite du plan gratuit atteinte (${FREE_MONTHLY_LIMIT} publications ce mois). Passez à Starter ou Advanced pour continuer.`,
        );
    }

    // 3) Le post
    const { data: post, error: pErr } = await supabase
      .from("posts")
      .select(
        "id,user_id,title,content,channel,pillar_id,scheduled_at,status,video_url,source_reel_id",
      )
      .eq("id", data.postId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!post || (post as any).user_id !== userId)
      throw new Error("Post introuvable.");

    const p = post as any;

    // Vidéo : si le post a un source_reel_id, on (re)génère une URL fraîche
    // pour éviter qu'une URL signée expirée n'arrive à Metricool.
    let videoUrl: string | null = p.video_url ?? null;
    if (p.source_reel_id) {
      const { data: reel } = await supabase
        .from("reels")
        .select("video_path,subtitled_video_url")
        .eq("id", p.source_reel_id)
        .maybeSingle();
      const r = reel as any;
      if (r?.subtitled_video_url) {
        videoUrl = r.subtitled_video_url;
      } else if (r?.video_path) {
        const { data: signed } = await supabase.storage
          .from("reels")
          .createSignedUrl(r.video_path, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) videoUrl = signed.signedUrl;
      }
    }
    if (!p.content?.trim() && !videoUrl)
      throw new Error("Le post est vide (ni texte ni vidéo).");

    // 4) Détermine le moment
    let scheduledAtIso: string | null = null;
    if (data.timing === "schedule") {
      if (!data.scheduledAt)
        throw new Error("Date de programmation manquante.");
      scheduledAtIso = data.scheduledAt;
    } else if (data.timing === "now") {
      scheduledAtIso = new Date().toISOString();
    } // "auto" → null (Metricool décide)

    // 5) Appel webhook N8N
    const payload = {
      post: {
        id: p.id,
        title: p.title,
        content: p.content,
        channel: data.channel,
        pillar_id: p.pillar_id,
        video_url: videoUrl,
        kind: videoUrl ? "video" : "text",
      },
      timing: {
        mode: data.timing, // "now" | "schedule" | "auto"
        scheduled_at: scheduledAtIso,
      },
      user_id: userId,
    };

    let n8nResp: Response;
    try {
      n8nResp = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e: any) {
      throw new Error(
        `Le webhook N8N est injoignable (${e?.message ?? "réseau"}).`,
      );
    }
    if (!n8nResp.ok) {
      const txt = await n8nResp.text().catch(() => "");
      throw new Error(
        `Le webhook N8N a renvoyé une erreur (${n8nResp.status})${txt ? " : " + txt.slice(0, 200) : ""}.`,
      );
    }

    let n8nJson: any = null;
    try {
      n8nJson = await n8nResp.json();
    } catch {
      // Réponse non-JSON : on tolère, on prend juste un id éventuel dans le texte
    }

    const metricoolId: string | null =
      n8nJson?.metricool_id ??
      n8nJson?.id ??
      n8nJson?.data?.id ??
      null;

    // 6) Statut final + persistance
    const newStatus = data.timing === "now" ? "publie" : "programme";
    const update: Record<string, any> = {
      status: newStatus,
      channel: data.channel,
      metricool_id: metricoolId,
    };
    if (scheduledAtIso) update.scheduled_at = scheduledAtIso;
    if (data.timing === "now") update.published_at = new Date().toISOString();

    const { error: uErr } = await supabase
      .from("posts")
      .update(update as any)
      .eq("id", p.id);
    if (uErr) throw uErr;

    return {
      status: newStatus,
      metricool_id: metricoolId,
      scheduled_at: scheduledAtIso,
    };
  });
