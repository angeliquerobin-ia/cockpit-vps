import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  Trash2,
  Filter,
  Film,
  Play,
  X,
  Pencil,
  Crop,
  Loader2,
  Wand2,
  Lightbulb,
  PenLine,
  Captions,
} from "lucide-react";
import { CHANNEL_LABELS, ALL_CHANNELS } from "@/lib/channel-prompts";
import { convertReelToVertical } from "@/lib/cloudinary.functions";
import { subtitleReel } from "@/lib/reels.functions";

type Pillar = { id: string; name: string; color: string };
type ReelStatus = "a_sous_titrer" | "sous_titre" | "publie";
type Reel = {
  id: string;
  title: string;
  pillar_id: string | null;
  channel: string | null;
  status: ReelStatus;
  video_path: string;
  transcription: string;
  subtitled_video_url: string | null;
  created_at: string;
};

const STATUSES: { value: ReelStatus; label: string }[] = [
  { value: "a_sous_titrer", label: "À sous-titrer" },
  { value: "sous_titre", label: "Sous-titré" },
  { value: "publie", label: "Publié" },
];
const statusLabel = (s: ReelStatus) =>
  STATUSES.find((x) => x.value === s)?.label ?? s;

export const Route = createFileRoute("/_authenticated/reels")({
  head: () => ({ meta: [{ title: "Réels — Cockpit" }] }),
  component: ReelsPage,
});

function ReelsPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [transformFlash, setTransformFlash] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{
    name: string;
    progress: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Reel | null>(null);
  const [editing, setEditing] = useState<Reel | null>(null);

  const [fPillar, setFPillar] = useState("all");
  const [fChannel, setFChannel] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function loadAll(uid: string) {
    setLoading(true);
    const [p, r] = await Promise.all([
      supabase
        .from("content_pillars")
        .select("id,name,color")
        .eq("user_id", uid)
        .order("created_at"),
      supabase
        .from("reels")
        .select("id,title,pillar_id,channel,status,video_path,transcription,subtitled_video_url,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);
    const list = (r.data ?? []) as Reel[];
    setPillars((p.data ?? []) as Pillar[]);
    setReels(list);
    // Sign URLs in batch
    if (list.length) {
      const { data: signed } = await supabase.storage
        .from("reels")
        .createSignedUrls(
          list.map((x) => x.video_path),
          60 * 60,
        );
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) map[list[i].id] = s.signedUrl;
      });
      setSignedUrls(map);
    } else {
      setSignedUrls({});
    }
    setLoading(false);
  }

  useEffect(() => {
    if (userId) loadAll(userId);
  }, [userId]);

  const pillarById = useMemo(
    () => Object.fromEntries(pillars.map((p) => [p.id, p])),
    [pillars],
  );

  async function handleUpload(file: File) {
    if (!userId) return;
    setError(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
    const safeBase = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 60);
    const path = `${userId}/${Date.now()}_${safeBase}.${ext}`;
    setUploading({ name: file.name, progress: 0 });

    // Use XHR for real progress on the signed-upload URL
    try {
      const { data: signed, error: signErr } = await supabase.storage
        .from("reels")
        .createSignedUploadUrl(path);
      if (signErr || !signed) throw signErr ?? new Error("URL d'upload introuvable");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", signed.signedUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploading({
              name: file.name,
              progress: Math.round((e.loaded / e.total) * 100),
            });
          }
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error(`Upload échoué (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.send(file);
      });

      const title = file.name.replace(/\.[^.]+$/, "");
      const { error: insErr } = await supabase
        .from("reels")
        .insert({ user_id: userId, title, video_path: path });
      if (insErr) throw insErr;
      await loadAll(userId);
    } catch (e: any) {
      setError(e?.message ?? "Import impossible.");
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeReel(reel: Reel) {
    if (!confirm("Supprimer ce réel ? La vidéo sera supprimée du stockage.")) return;
    await supabase.storage.from("reels").remove([reel.video_path]);
    await supabase.from("reels").delete().eq("id", reel.id);
    setReels((prev) => prev.filter((r) => r.id !== reel.id));
  }

  async function saveReel(patch: Partial<Reel> & { id: string }) {
    const { id, ...rest } = patch;
    setReels((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...rest } : r)),
    );
    await supabase.from("reels").update(rest as any).eq("id", id);
  }

  async function transformToIdea(reel: Reel) {
    if (!userId || !reel.transcription?.trim()) return;
    const title = reel.title.trim() || "Idée tirée d'un réel";
    const { error } = await supabase.from("ideas").insert({
      user_id: userId,
      title,
      note: reel.transcription,
      pillar_id: reel.pillar_id,
      channel: reel.channel as any,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setTransformFlash(`« ${title} » ajoutée à vos idées.`);
    setTimeout(() => setTransformFlash(null), 4000);
  }

  async function transformToPost(reel: Reel) {
    if (!userId || !reel.transcription?.trim()) return;
    const { data, error } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        title: reel.title.trim() || "Post tiré d'un réel",
        content: reel.transcription,
        channel: reel.channel as any,
        pillar_id: reel.pillar_id,
        status: "en_redaction",
      })
      .select("id")
      .single();
    if (error || !data) {
      setError(error?.message ?? "Création du post impossible.");
      return;
    }
    navigate({ to: "/studio", search: { post: data.id } });
  }


  const filtered = reels.filter((r) => {
    if (fPillar !== "all" && r.pillar_id !== fPillar) return false;
    if (fChannel !== "all" && r.channel !== fChannel) return false;
    if (fStatus !== "all" && r.status !== fStatus) return false;
    return true;
  });

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] opacity-60">
            La bibliothèque vivante
          </p>
          <h1 className="text-5xl">Réels</h1>
          <p className="text-base opacity-75 max-w-2xl">
            <em>
              Importez vos vidéos, classez-les par pilier et par canal. Le
              sous-titrage arrivera à l'étape suivante.
            </em>
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={!!uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Upload className="h-4 w-4" /> Importer une vidéo
          </button>
        </div>
      </header>

      {uploading && (
        <div className="bg-card rounded-2xl p-4 shadow-[var(--shadow-soft)] space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="truncate"><em>Envoi en cours</em> — {uploading.name}</span>
            <span className="opacity-70">{uploading.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${uploading.progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}

      {transformFlash && (
        <p className="text-sm rounded-lg bg-primary/10 text-foreground px-3 py-2">
          <em>{transformFlash}</em>
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] opacity-70">
          <Filter className="h-3.5 w-3.5" /> Filtrer
        </span>
        <FilterSelect
          value={fStatus}
          onChange={setFStatus}
          options={[
            { value: "all", label: "Tous les statuts" },
            ...STATUSES.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
        <FilterSelect
          value={fChannel}
          onChange={setFChannel}
          options={[
            { value: "all", label: "Tous les canaux" },
            ...ALL_CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABELS[c] })),
          ]}
        />
        <FilterSelect
          value={fPillar}
          onChange={setFPillar}
          options={[
            { value: "all", label: "Tous les piliers" },
            ...pillars.map((p) => ({ value: p.id, label: p.name })),
          ]}
        />
      </div>

      {loading ? (
        <p className="text-sm opacity-60">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 shadow-[var(--shadow-soft)] text-center space-y-3">
          <Film className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-sm opacity-70">
            {reels.length === 0
              ? "Aucun réel pour l'instant. Importez votre première vidéo."
              : "Aucun réel ne correspond à ces filtres."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((r) => (
            <ReelCard
              key={r.id}
              reel={r}
              url={signedUrls[r.id]}
              pillar={r.pillar_id ? pillarById[r.pillar_id] : undefined}
              onPlay={() => setPlaying(r)}
              onEdit={() => setEditing(r)}
              onDelete={() => removeReel(r)}
              onTransformIdea={() => transformToIdea(r)}
              onTransformPost={() => transformToPost(r)}
            />
          ))}
        </div>
      )}

      {playing && signedUrls[playing.id] && (
        <PlayerModal
          url={signedUrls[playing.id]}
          title={playing.title || "Sans titre"}
          onClose={() => setPlaying(null)}
        />
      )}

      {editing && (
        <EditModal
          reel={editing}
          pillars={pillars}
          url={signedUrls[editing.id]}
          onClose={() => setEditing(null)}
          onConverted={async () => {
            if (userId) await loadAll(userId);
            setEditing(null);
          }}
          onSave={async (patch) => {
            await saveReel({ id: editing.id, ...patch });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg bg-card border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ReelCard({
  reel,
  url,
  pillar,
  onPlay,
  onEdit,
  onDelete,
  onTransformIdea,
  onTransformPost,
}: {
  reel: Reel;
  url?: string;
  pillar?: Pillar;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTransformIdea: () => void;
  onTransformPost: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasTranscription = !!reel.transcription?.trim();
  return (
    <article className="bg-card rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden group">
      <button
        onClick={onPlay}
        className="relative block w-full aspect-[9/16] bg-muted overflow-hidden"
        aria-label="Lire la vidéo"
      >
        {url ? (
          <video
            src={url + "#t=0.5"}
            preload="metadata"
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-40">
            <Film className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-background/90 flex items-center justify-center">
            <Play className="h-5 w-5 ml-0.5" />
          </div>
        </div>
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{ backgroundColor: pillar?.color ?? "#cdb48e" }}
        />
      </button>
      <div className="p-4 space-y-2">
        <h3 className="text-lg leading-snug">
          {reel.title.trim() || <span className="opacity-50">Sans titre</span>}
        </h3>
        <div className="flex items-center gap-1.5 flex-wrap">
          {pillar && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: pillar.color + "33", color: pillar.color }}
            >
              {pillar.name}
            </span>
          )}
          {reel.channel && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-popover text-foreground/70">
              {CHANNEL_LABELS[reel.channel] ?? reel.channel}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/80">
            {statusLabel(reel.status)}
          </span>
        </div>
        <div className="flex justify-end items-center gap-1 pt-1 relative">
          {hasTranscription && (
            <div className="relative mr-auto">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-muted text-foreground/80"
              >
                <Wand2 className="h-3.5 w-3.5" /> Transformer en contenu
              </button>
              {menuOpen && (
                <>
                  <button
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Fermer le menu"
                  />
                  <div className="absolute left-0 bottom-full mb-1 z-20 w-60 rounded-lg bg-popover border border-border shadow-[var(--shadow-soft)] py-1">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onTransformIdea();
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-start gap-2"
                    >
                      <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 opacity-70" />
                      <span>
                        <span className="block">Créer une idée</span>
                        <span className="block text-[11px] opacity-60">
                          Dans le réservoir d'idées
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onTransformPost();
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-start gap-2"
                    >
                      <PenLine className="h-4 w-4 mt-0.5 shrink-0 opacity-70" />
                      <span>
                        <span className="block">Créer un post</span>
                        <span className="block text-[11px] opacity-60">
                          Ouvre le Studio pré-rempli
                        </span>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={onEdit}
            aria-label="Modifier"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            aria-label="Supprimer"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function PlayerModal({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-[var(--shadow-soft)] max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="text-lg truncate">{title}</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <video
          src={url}
          controls
          autoPlay
          playsInline
          className="w-full aspect-[9/16] bg-black"
        />
      </div>
    </div>
  );
}

function EditModal({
  reel,
  pillars,
  url,
  onClose,
  onSave,
  onConverted,
}: {
  reel: Reel;
  pillars: Pillar[];
  url?: string;
  onClose: () => void;
  onSave: (patch: Partial<Reel>) => void;
  onConverted: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState(reel.title);
  const [pillarId, setPillarId] = useState(reel.pillar_id ?? "");
  const [channel, setChannel] = useState(reel.channel ?? "");
  const [status, setStatus] = useState<ReelStatus>(reel.status);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [gravityX, setGravityX] = useState(0.5);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const convertFn = useServerFn(convertReelToVertical);

  const isHorizontal = dims ? dims.w / dims.h > 9 / 16 + 0.001 : false;
  const cropFractionW = dims ? (dims.h * (9 / 16)) / dims.w : 1;
  // position du cadre 9:16 dans la preview, en % de la largeur affichée
  const overlayLeftPct = isHorizontal
    ? (1 - cropFractionW) * gravityX * 100
    : 0;
  const overlayWidthPct = cropFractionW * 100;

  async function handleConvert() {
    setConverting(true);
    setConvertError(null);
    try {
      await convertFn({ data: { reelId: reel.id, gravityX } });
      await onConverted();
    } catch (e: any) {
      setConvertError(e?.message ?? "Conversion impossible.");
    } finally {
      setConverting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-[var(--shadow-soft)] max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-2xl">Modifier le réel</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Field label="Titre">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label="Pilier">
          <select
            value={pillarId}
            onChange={(e) => setPillarId(e.target.value)}
            className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Choisir —</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Canal">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Choisir —</option>
            {ALL_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Statut">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ReelStatus)}
            className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        {url && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] opacity-70">
              <Crop className="h-3.5 w-3.5" /> Format vidéo
            </div>
            <div className="relative w-full bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                src={url + "#t=0.5"}
                muted
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  setDims({ w: v.videoWidth, h: v.videoHeight });
                }}
                className="w-full h-auto block"
              />
              {isHorizontal && (
                <div
                  className="absolute top-0 bottom-0 border-2 border-primary pointer-events-none transition-all"
                  style={{
                    left: `${overlayLeftPct}%`,
                    width: `${overlayWidthPct}%`,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                  }}
                />
              )}
            </div>

            {!dims ? (
              <p className="text-xs opacity-60">Analyse de la vidéo…</p>
            ) : !isHorizontal ? (
              <p className="text-xs opacity-70">
                <em>Cette vidéo est déjà au format vertical.</em>
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs opacity-70">
                    <span>Position du cadre</span>
                    <span>
                      {gravityX === 0
                        ? "Gauche"
                        : gravityX === 1
                          ? "Droite"
                          : gravityX === 0.5
                            ? "Centre"
                            : `${Math.round(gravityX * 100)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(gravityX * 100)}
                    onChange={(e) =>
                      setGravityX(Number(e.target.value) / 100)
                    }
                    className="w-full accent-primary"
                    disabled={converting}
                  />
                </div>
                {convertError && (
                  <p className="text-xs text-destructive">{convertError}</p>
                )}
                <button
                  onClick={handleConvert}
                  disabled={converting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm hover:opacity-90 disabled:opacity-50"
                >
                  {converting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Conversion en
                      cours…
                    </>
                  ) : (
                    <>
                      <Crop className="h-4 w-4" /> Convertir en vertical (9:16)
                    </>
                  )}
                </button>
                <p className="text-[11px] opacity-60 leading-relaxed">
                  La vidéo originale est conservée. Le traitement peut prendre
                  quelques secondes à une minute selon la durée.
                </p>
              </>
            )}
          </div>
        )}


        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
          >
            Annuler
          </button>
          <button
            onClick={() =>
              onSave({
                title,
                pillar_id: pillarId || null,
                channel: (channel || null) as any,
                status,
              })
            }
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-xs uppercase tracking-[0.15em] opacity-70">{label}</span>
      {children}
    </label>
  );
}
