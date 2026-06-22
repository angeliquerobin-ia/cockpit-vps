import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  reelId: z.string().uuid(),
  // 0 = focus extrême gauche, 0.5 = centre, 1 = extrême droite
  gravityX: z.number().min(0).max(1).default(0.5),
});

async function sha1Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const convertReelToVertical = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret)
      throw new Error("Clés Cloudinary manquantes.");

    const { supabase, userId } = context;

    const { data: reel, error: rErr } = await supabase
      .from("reels")
      .select("id,user_id,video_path,original_video_path")
      .eq("id", data.reelId)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!reel || reel.user_id !== userId) throw new Error("Réel introuvable.");

    const { data: dl, error: dlErr } = await supabase.storage
      .from("reels")
      .download(reel.video_path);
    if (dlErr || !dl) throw dlErr ?? new Error("Téléchargement impossible.");
    const videoBytes = new Uint8Array(await dl.arrayBuffer());

    // Upload signé sur Cloudinary
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `lovable_reels/${userId}`;
    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = await sha1Hex(toSign);

    const form = new FormData();
    form.append(
      "file",
      new Blob([videoBytes], { type: "video/mp4" }),
      "input.mp4",
    );
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("folder", folder);
    form.append("signature", signature);

    const upRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      { method: "POST", body: form },
    );
    const upJson: any = await upRes.json();
    if (!upRes.ok)
      throw new Error(upJson?.error?.message ?? "Upload Cloudinary échoué.");

    const publicId: string = upJson.public_id;
    const width: number = upJson.width;
    const height: number = upJson.height;

    const targetRatio = 9 / 16;
    const sourceRatio = width / height;
    let transformedUrl: string;

    if (sourceRatio <= targetRatio + 0.001) {
      transformedUrl = upJson.secure_url;
    } else {
      const cropW = Math.round(height * targetRatio);
      const maxOffset = width - cropW;
      const offsetX = Math.round(maxOffset * data.gravityX);
      transformedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/c_crop,w_${cropW},h_${height},x_${offsetX},y_0/${publicId}.mp4`;
    }

    let transformed: ArrayBuffer | null = null;
    for (let i = 0; i < 6; i++) {
      const resp = await fetch(transformedUrl);
      if (resp.ok) {
        transformed = await resp.arrayBuffer();
        break;
      }
      if (resp.status !== 423 && resp.status !== 404 && resp.status !== 425)
        throw new Error(`Récupération Cloudinary échouée (${resp.status}).`);
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
    if (!transformed)
      throw new Error("La vidéo verticale n'a pas pu être générée à temps.");

    const newPath = `${userId}/${Date.now()}_vertical.mp4`;
    const { error: upErr } = await supabase.storage
      .from("reels")
      .upload(newPath, new Uint8Array(transformed), {
        contentType: "video/mp4",
        upsert: false,
      });
    if (upErr) throw upErr;

    const update: Record<string, any> = { video_path: newPath };
    if (!reel.original_video_path) update.original_video_path = reel.video_path;
    const { error: updErr } = await supabase
      .from("reels")
      .update(update)
      .eq("id", reel.id);
    if (updErr) throw updErr;

    // Nettoyage Cloudinary (best-effort)
    try {
      const delTs = Math.floor(Date.now() / 1000);
      const delSig = await sha1Hex(
        `public_id=${publicId}&timestamp=${delTs}${apiSecret}`,
      );
      const delForm = new FormData();
      delForm.append("public_id", publicId);
      delForm.append("timestamp", String(delTs));
      delForm.append("api_key", apiKey);
      delForm.append("signature", delSig);
      await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/destroy`,
        { method: "POST", body: delForm },
      );
    } catch {
      /* ignore */
    }

    return { ok: true, video_path: newPath };
  });
