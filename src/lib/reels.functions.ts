import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SubtitleSchema = z.object({
  reelId: z.string().min(1),
});

export const subtitleReel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubtitleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [reelRes, settingsRes] = await Promise.all([
      supabase
        .from("reels")
        .select("id,title,video_path,transcription")
        .eq("id", data.reelId)
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select("webhook_subtitles")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (reelRes.error) throw new Error(reelRes.error.message);
    const reel = reelRes.data;
    if (!reel) throw new Error("Réel introuvable.");
    if (!reel.transcription?.trim())
      throw new Error("Ce réel n'a pas encore de transcription.");

    const webhook = ((settingsRes.data as any)?.webhook_subtitles ?? "").trim();
    if (!webhook)
      throw new Error(
        "Aucun webhook N8N de sous-titrage n'est enregistré dans les Réglages.",
      );

    const { data: signed, error: signErr } = await supabase.storage
      .from("reels")
      .createSignedUrl(reel.video_path, 60 * 60);
    if (signErr || !signed?.signedUrl)
      throw new Error("Impossible de générer un lien vers la vidéo.");

    let resp: Response;
    try {
      resp = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          reel_id: reel.id,
          title: reel.title,
          video_url: signed.signedUrl,
          transcription: reel.transcription,
        }),
      });
    } catch (e: any) {
      throw new Error(
        `Le webhook N8N est injoignable (${e?.message ?? "réseau"}).`,
      );
    }

    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(
        `Le webhook N8N a renvoyé une erreur (${resp.status})${txt ? " : " + txt.slice(0, 200) : ""}.`,
      );
    }

    let subtitledUrl: string | null = null;
    try {
      const json: any = await resp.json();
      subtitledUrl =
        (typeof json?.video_url === "string" && json.video_url) ||
        (typeof json?.subtitled_video_url === "string" &&
          json.subtitled_video_url) ||
        (typeof json?.url === "string" && json.url) ||
        null;
    } catch {
      subtitledUrl = null;
    }

    const patch: Record<string, unknown> = { status: "sous_titre" };
    if (subtitledUrl) patch.subtitled_video_url = subtitledUrl;

    const { error: upErr } = await supabase
      .from("reels")
      .update(patch as any)
      .eq("id", reel.id)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    return { subtitledUrl };
  });
