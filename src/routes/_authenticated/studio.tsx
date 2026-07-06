import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Trash2,
  Filter,
  FileText,
  Sparkles,
  Save,
  ArrowLeft,
  Send,
  Shuffle,
  Loader2,
  SpellCheck,
  Archive,
  Recycle,
  FolderInput,
} from "lucide-react";
import { PublishDialog } from "@/components/publish-dialog";
import { aiDeriveForChannel } from "@/lib/ai-writer.functions";

type Channel =
  | "linkedin"
  | "instagram_coaching"
  | "instagram_chroniques_cosmiques"
  | "podcast"
  | "substack";

type Status = "idee" | "en_redaction" | "pret" | "programme" | "publie";

type Pillar = { id: string; name: string; color: string };

type Post = {
  id: string;
  title: string;
  content: string;
  channel: Channel | null;
  pillar_id: string | null;
  status: Status;
  scheduled_at: string | null;
  idea_id: string | null;
  updated_at: string;
  video_url: string | null;
};

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram_coaching", label: "Instagram" },
  { value: "podcast", label: "Podcast" },
  { value: "substack", label: "Substack" },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: "idee", label: "Idée" },
  { value: "en_redaction", label: "En rédaction" },
  { value: "pret", label: "Prêt" },
  { value: "programme", label: "Programmé" },
  { value: "publie", label: "Publié" },
];

const channelLabel = (c: Channel | null) =>
  c ? CHANNELS.find((x) => x.value === c)?.label : null;
const statusLabel = (s: Status) =>
  STATUSES.find((x) => x.value === s)?.label ?? s;

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({ meta: [{ title: "Studio de rédaction — Cockpit" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    post: typeof s.post === "string" ? s.post : undefined,
  }),
  component: StudioPage,
});

function StudioPage() {
  const navigate = useNavigate();
  const { post: postParam } = Route.useSearch();
  const [userId, setUserId] = useState<string | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(postParam ?? null);

  const [fPillar, setFPillar] = useState("all");
  const [fChannel, setFChannel] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function loadAll(uid: string) {
    const [p, posts] = await Promise.all([
      supabase
        .from("content_pillars")
        .select("id,name,color")
        .eq("user_id", uid)
        .order("created_at", { ascending: true }),
      supabase
        .from("posts")
        .select("id,title,content,channel,pillar_id,status,scheduled_at,idea_id,updated_at,video_url")
        .eq("user_id", uid)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
    ]);
    setPillars((p.data ?? []) as Pillar[]);
    setPosts((posts.data ?? []) as Post[]);
    setLoading(false);
  }

  useEffect(() => {
    if (userId) loadAll(userId);
  }, [userId]);

  useEffect(() => {
    setSelectedId(postParam ?? null);
  }, [postParam]);

  const pillarById = useMemo(
    () => Object.fromEntries(pillars.map((p) => [p.id, p])),
    [pillars],
  );

  async function createBlank() {
    if (!userId) return;
    const { data } = await supabase
      .from("posts")
      .insert({ user_id: userId, title: "", content: "", status: "en_redaction" })
      .select("id,title,content,channel,pillar_id,status,scheduled_at,idea_id,updated_at,video_url")
      .single();
    if (data) {
      setPosts((prev) => [data as Post, ...prev]);
      navigate({ to: "/studio", search: { post: data.id } });
    }
  }

  async function savePost(id: string, patch: Partial<Post>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    await supabase.from("posts").update(patch).eq("id", id);
  }

  async function removePost(id: string) {
    if (!confirm("Mettre ce post à la corbeille ?")) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("posts").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (selectedId === id) navigate({ to: "/studio", search: {} });
  }

  const filtered = posts.filter((p) => {
    if (fPillar !== "all" && p.pillar_id !== fPillar) return false;
    if (fChannel !== "all" && p.channel !== fChannel) return false;
    if (fStatus !== "all" && p.status !== fStatus) return false;
    return true;
  });

  const selected = posts.find((p) => p.id === selectedId) ?? null;

  if (selected) {
    return (
      <PostEditor
        key={selected.id}
        post={selected}
        pillars={pillars}
        pillarById={pillarById}
        userId={userId}
        onBack={() => navigate({ to: "/studio", search: {} })}
        onSave={(patch) => savePost(selected.id, patch)}
        onDelete={() => removePost(selected.id)}
        onRefresh={() => userId && loadAll(userId)}
      />
    );
  }


  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] opacity-60">L'atelier</p>
          <h1 className="text-5xl">Studio de rédaction</h1>
          <p className="tagline text-base max-w-2xl">
            Rédigez, peaufinez, organisez vos posts par canal et par pilier.
          </p>
        </div>
        <button
          onClick={createBlank}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" /> Nouveau post
        </button>
      </header>

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
            ...CHANNELS.map((c) => ({ value: c.value, label: c.label })),
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
          <FileText className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-sm opacity-70">
            {posts.length === 0
              ? "Aucun post pour l'instant. Créez votre premier post pour commencer à écrire."
              : "Aucun post ne correspond à ces filtres."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              pillar={p.pillar_id ? pillarById[p.pillar_id] : undefined}
              onOpen={() => navigate({ to: "/studio", search: { post: p.id } })}
              onDelete={() => removePost(p.id)}
            />
          ))}
        </div>
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

function PostCard({
  post,
  pillar,
  onOpen,
  onDelete,
}: {
  post: Post;
  pillar?: Pillar;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const preview = post.content.trim().slice(0, 140);
  return (
    <article className="bg-card rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden group">
      <div className="h-1.5" style={{ backgroundColor: pillar?.color ?? "#cdb48e" }} />
      <button
        onClick={onOpen}
        className="w-full text-left p-5 space-y-3"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-xl leading-snug flex-1">
            {post.title.trim() || <span className="opacity-50">Sans titre</span>}
          </h3>
        </div>
        {preview && (
          <p className="text-sm opacity-70 leading-relaxed line-clamp-2">{preview}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {pillar && (
            <span
              className="inline-block text-xs px-2.5 py-1 rounded-full"
              style={{ backgroundColor: pillar.color + "33", color: pillar.color }}
            >
              {pillar.name}
            </span>
          )}
          {post.channel && (
            <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-popover text-foreground/70">
              {channelLabel(post.channel)}
            </span>
          )}
          <StatusChip status={post.status} />
        </div>
      </button>
      <div className="px-5 pb-4 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDelete}
          aria-label="Supprimer"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function StatusChip({ status }: { status: Status }) {
  return (
    <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-muted text-foreground/80">
      {statusLabel(status)}
    </span>
  );
}

function PostEditor({
  post,
  pillars,
  pillarById,
  userId,
  onBack,
  onSave,
  onDelete,
  onRefresh,
}: {
  post: Post;
  pillars: Pillar[];
  pillarById: Record<string, Pillar>;
  userId: string | null;
  onBack: () => void;
  onSave: (patch: Partial<Post>) => Promise<void>;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState(post.content);
  const [channel, setChannel] = useState<string>(post.channel ?? "");
  const [pillarId, setPillarId] = useState<string>(post.pillar_id ?? "");
  const [status, setStatus] = useState<Status>(post.status);
  const [scheduledAt, setScheduledAt] = useState<string>(
    post.scheduled_at ? toLocalInput(post.scheduled_at) : "",
  );
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const [showPublish, setShowPublish] = useState(false);
  const [deriveOpen, setDeriveOpen] = useState(false);
  const [deriving, setDeriving] = useState<string | null>(null);
  const [deriveError, setDeriveError] = useState<string | null>(null);
  const derive = useServerFn(aiDeriveForChannel);
  const navigate = useNavigate();

  async function handleDerive(target: string) {
    setDeriveError(null);
    setDeriving(target);
    try {
      await onSave({ title, content, channel: (channel || null) as Channel | null, pillar_id: pillarId || null, status, scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null });
      const r = await derive({ data: { sourcePostId: post.id, targetChannel: target } });
      onRefresh();
      setDeriveOpen(false);
      navigate({ to: "/studio", search: { post: r.postId } });
    } catch (e: any) {
      setDeriveError(e?.message ?? "Déclinaison impossible.");
    } finally {
      setDeriving(null);
    }
  }

  async function handleSave() {
    setSaving("saving");
    await onSave({
      title,
      content,
      channel: (channel || null) as Channel | null,
      pillar_id: pillarId || null,
      status,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    });
    setSaving("saved");
    setTimeout(() => setSaving("idle"), 1500);
  }

  const pillar = pillarId ? pillarById[pillarId] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm opacity-75 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" /> Tous les posts
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-60 mr-2">
            {saving === "saving" && "Enregistrement…"}
            {saving === "saved" && <em>Enregistré</em>}
          </span>
          <div className="relative">
            <button
              onClick={() => setDeriveOpen((v) => !v)}
              disabled={!!deriving}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted text-foreground/80 transition-colors disabled:opacity-50"
            >
              {deriving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shuffle className="h-4 w-4" />
              )}
              Décliner sur un autre canal
            </button>
            {deriveOpen && !deriving && (
              <>
                <button
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setDeriveOpen(false)}
                  aria-label="Fermer"
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg bg-popover border border-border shadow-[var(--shadow-soft)] py-1">
                  <p className="px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] opacity-60">
                    Choisir un canal cible
                  </p>
                  {CHANNELS.filter((c) => c.value !== channel).map((c) => (
                    <button
                      key={c.value}
                      onClick={() => handleDerive(c.value)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    >
                      {c.label}
                    </button>
                  ))}
                  {CHANNELS.filter((c) => c.value !== channel).length === 0 && (
                    <p className="px-3 py-2 text-xs opacity-60">
                      Aucun autre canal disponible.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted text-foreground/70 transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted transition-colors"
          >
            <Save className="h-4 w-4" /> Enregistrer
          </button>
          <button
            onClick={async () => {
              await handleSave();
              setShowPublish(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 transition-opacity"
          >
            <Send className="h-4 w-4" /> Publier ou programmer
          </button>
        </div>
      </div>

      {deriveError && (
        <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
          {deriveError}
        </p>
      )}


      {showPublish && userId && (
        <PublishDialog
          post={{
            id: post.id,
            title,
            channel: (channel || null) as string | null,
            scheduled_at: scheduledAt
              ? new Date(scheduledAt).toISOString()
              : null,
          }}
          userId={userId}
          onClose={() => setShowPublish(false)}
          onPublished={({ status: s, scheduled_at }) => {
            setStatus(s as Status);
            if (scheduled_at)
              setScheduledAt(toLocalInput(scheduled_at));
            setShowPublish(false);
            onRefresh();
          }}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* Main editor */}
        <div className="space-y-5">
          <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden">
            <div
              className="h-1.5"
              style={{ backgroundColor: pillar?.color ?? "#cdb48e" }}
            />
            <div className="p-6 md:p-8 space-y-5">
              {post.video_url && (
                <div className="rounded-xl overflow-hidden bg-muted/40 border border-border">
                  <video
                    src={post.video_url}
                    controls
                    playsInline
                    className="w-full max-h-[420px] object-contain bg-black"
                  />
                  <p className="px-3 py-2 text-[11px] opacity-65">
                    <em>
                      Post vidéo — la légende ci-dessous accompagnera cette
                      vidéo lors de la publication.
                    </em>
                  </p>
                </div>
              )}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titre du post"
                className="w-full bg-transparent border-0 outline-none text-3xl md:text-4xl placeholder:opacity-40"
                style={{ fontFamily: "var(--font-display, 'Cormorant Garamond', serif)" }}
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Commencez à écrire…"
                rows={18}
                className="w-full bg-transparent border-0 outline-none text-base leading-relaxed resize-none placeholder:opacity-40"
              />
              <SpellCheckButton
                content={content}
                onCorrected={setContent}
              />
            </div>
          </div>

          <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Canal">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Choisir —</option>
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
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
            <Field label="Statut">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date de programmation">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </Field>
          </div>
        </div>

        <AssistantPanel
          channel={(channel || null) as Channel | null}
          pillarId={pillarId || null}
          currentContent={content}
          onInsert={(text) =>
            setContent((prev) =>
              prev.trim() ? prev.trimEnd() + "\n\n" + text : text,
            )
          }
        />
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

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const QUICK_ACTIONS: { mode: AiMode; label: string }[] = [
  { mode: "shorten", label: "Raccourcir" },
  { mode: "rewrite_hook", label: "Réécrire l'accroche" },
  { mode: "more_embodied", label: "Plus incarné" },
  { mode: "add_cta", label: "Ajouter un appel à l'action" },
  { mode: "hashtags", label: "Proposer des hashtags" },
];

type AiMode =
  | "generate"
  | "shorten"
  | "rewrite_hook"
  | "more_embodied"
  | "add_cta"
  | "hashtags";

function AssistantPanel({
  channel,
  pillarId,
  currentContent,
  onInsert,
}: {
  channel: Channel | null;
  pillarId: string | null;
  currentContent: string;
  onInsert: (text: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [generated, setGenerated] = useState("");
  const [busy, setBusy] = useState<AiMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(mode: AiMode) {
    setBusy(mode);
    setError(null);
    try {
      const { aiWrite } = await import("@/lib/ai-writer.functions");
      const result = await aiWrite({
        data: {
          mode,
          channel,
          pillarId,
          subject,
          currentContent: generated.trim() || currentContent,
        },
      });
      setGenerated(result.text);
    } catch (e: any) {
      setError(e?.message ?? "Génération impossible.");
    } finally {
      setBusy(null);
    }
  }

  const channelReady = !!channel;

  return (
    <aside className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-5 space-y-4 h-fit lg:sticky lg:top-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-xl">Assistant</h2>
      </div>
      <p className="text-xs uppercase tracking-[0.15em] opacity-60">
        Agent de rédaction
      </p>

      {!channelReady && (
        <p className="text-xs opacity-70 rounded-lg bg-muted/50 px-3 py-2">
          <em>Choisissez un canal pour activer l'agent.</em>
        </p>
      )}

      <div className="space-y-2">
        <label className="text-xs uppercase tracking-[0.15em] opacity-70">
          Sujet ou angle
        </label>
        <textarea
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          rows={3}
          placeholder="Ex. l'imposture qui revient quand on lance une nouvelle offre…"
          className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
        <button
          onClick={() => run("generate")}
          disabled={!channelReady || busy !== null}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Sparkles className="h-4 w-4" />
          {busy === "generate" ? "Génération…" : "Générer"}
        </button>
      </div>

      {(generated || busy) && (
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-[0.15em] opacity-70">
            Texte généré
          </label>
          <textarea
            value={generated}
            onChange={(e) => setGenerated(e.target.value)}
            rows={12}
            placeholder={busy ? "L'agent rédige…" : ""}
            className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.mode}
                onClick={() => run(a.mode)}
                disabled={!channelReady || busy !== null || !generated.trim()}
                className="text-xs rounded-full bg-muted hover:bg-muted/70 px-2.5 py-1 transition-colors disabled:opacity-40"
              >
                {busy === a.mode ? "…" : a.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (generated.trim()) {
                onInsert(generated.trim());
                setGenerated("");
              }
            }}
            disabled={!generated.trim()}
            className="w-full rounded-lg border border-primary/40 text-primary px-3 py-2 text-sm hover:bg-primary/10 transition-colors disabled:opacity-40"
          >
            Insérer dans le post
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive rounded-lg bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}
    </aside>
  );
}

function SpellCheckButton({
  content,
  onCorrected,
}: {
  content: string;
  onCorrected: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  async function run() {
    if (!content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { aiWrite } = await import("@/lib/ai-writer.functions");
      const result = await aiWrite({
        data: {
          mode: "spellcheck",
          channel: null,
          pillarId: null,
          subject: "",
          currentContent: content,
        },
      });
      if (result.text) {
        onCorrected(result.text);
        setFlash(true);
        setTimeout(() => setFlash(false), 2500);
      }
    } catch (e: any) {
      setError(e?.message ?? "Correction impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 pt-2 border-t border-border/60">
      <button
        type="button"
        onClick={run}
        disabled={!content.trim() || busy}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted transition-colors disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <SpellCheck className="h-3.5 w-3.5" />
        )}
        {busy ? "Correction…" : "Corriger l'orthographe"}
      </button>
      <span className="text-[11px] opacity-60">
        <em>Corrige les fautes sans changer vos tournures.</em>
      </span>
      {flash && (
        <span className="text-[11px] text-primary"><em>Texte corrigé</em></span>
      )}
      {error && (
        <span className="text-[11px] text-destructive">{error}</span>
      )}
    </div>
  );
}
