import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { aiSuggestIdeas } from "@/lib/ai-writer.functions";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Check,
  X,
  Filter,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/idees")({
  head: () => ({ meta: [{ title: "Idées — Cockpit" }] }),
  component: IdeasPage,
});

type Channel =
  | "linkedin"
  | "instagram_coaching"
  | "instagram_chroniques_cosmiques"
  | "podcast"
  | "substack";

type Status = "brouillon" | "a_developper" | "prete";

type Pillar = { id: string; name: string; color: string };

type Idea = {
  id: string;
  title: string;
  note: string;
  pillar_id: string | null;
  channel: Channel | null;
  status: Status;
  created_at: string;
};

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram_coaching", label: "Instagram coaching" },
  { value: "instagram_chroniques_cosmiques", label: "Instagram Chroniques Cosmiques" },
  { value: "podcast", label: "Podcast" },
  { value: "substack", label: "Substack" },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: "brouillon", label: "Brouillon" },
  { value: "a_developper", label: "À développer" },
  { value: "prete", label: "Prête" },
];

const channelLabel = (c: Channel | null) =>
  c ? CHANNELS.find((x) => x.value === c)?.label : null;
const statusLabel = (s: Status) =>
  STATUSES.find((x) => x.value === s)?.label ?? s;

function IdeasPage() {
  const navigate = useNavigate();
  const suggestIdeasFn = useServerFn(aiSuggestIdeas);
  const [userId, setUserId] = useState<string | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [quickTitle, setQuickTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // AI suggestions
  type Suggestion = {
    key: string;
    title: string;
    angle: string;
    pillar_id: string | null;
    channel: Channel | null;
    added?: boolean;
  };
  const [suggestHint, setSuggestHint] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // filters
  const [fPillar, setFPillar] = useState<string>("all");
  const [fChannel, setFChannel] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function loadAll(uid: string) {
    const [p, i] = await Promise.all([
      supabase
        .from("content_pillars")
        .select("id,name,color")
        .eq("user_id", uid)
        .order("created_at", { ascending: true }),
      supabase
        .from("ideas")
        .select("id,title,note,pillar_id,channel,status,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);
    setPillars((p.data ?? []) as Pillar[]);
    setIdeas((i.data ?? []) as Idea[]);
    setLoading(false);
  }

  useEffect(() => {
    if (userId) loadAll(userId);
  }, [userId]);

  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !quickTitle.trim()) return;
    const title = quickTitle.trim();
    setQuickTitle("");
    const { data } = await supabase
      .from("ideas")
      .insert({ user_id: userId, title })
      .select("id,title,note,pillar_id,channel,status,created_at")
      .single();
    if (data) setIdeas((prev) => [data as Idea, ...prev]);
  }

  async function updateIdea(id: string, patch: Partial<Idea>) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    await supabase.from("ideas").update(patch).eq("id", id);
  }

  async function removeIdea(id: string) {
    if (!confirm("Supprimer cette idée ?")) return;
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("ideas").delete().eq("id", id);
  }

  async function transformToPost(idea: Idea) {
    if (!userId) return;
    const { data } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        title: idea.title,
        content: idea.note ?? "",
        pillar_id: idea.pillar_id,
        channel: idea.channel,
        status: "en_redaction",
      })
      .select("id")
      .single();
    if (!data) return;
    await supabase.from("ideas").delete().eq("id", idea.id);
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    navigate({ to: "/studio", search: { post: data.id } });
  }

  const pillarById = useMemo(
    () => Object.fromEntries(pillars.map((p) => [p.id, p])),
    [pillars],
  );

  const filtered = ideas.filter((i) => {
    if (fPillar !== "all" && i.pillar_id !== fPillar) return false;
    if (fChannel !== "all" && i.channel !== fChannel) return false;
    if (fStatus !== "all" && i.status !== fStatus) return false;
    return true;
  });

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">
          Réservoir d'inspirations
        </p>
        <h1 className="text-5xl">Idées</h1>
        <p className="text-base opacity-75 max-w-2xl">
          <em>Capturez chaque étincelle en un geste. Affinez quand le temps vient.</em>
        </p>
      </header>

      {/* Quick capture */}
      <form
        onSubmit={quickAdd}
        className="bg-card rounded-2xl p-5 shadow-[var(--shadow-soft)] flex items-center gap-3"
      >
        <Plus className="h-5 w-5 text-primary shrink-0" />
        <input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Une idée qui passe…"
          className="flex-1 bg-transparent border-0 outline-none text-base placeholder:opacity-50"
        />
        <button
          type="submit"
          disabled={!quickTitle.trim()}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          Ajouter
        </button>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] opacity-70">
          <Filter className="h-3.5 w-3.5" /> Filtrer
        </span>
        <FilterSelect
          value={fPillar}
          onChange={setFPillar}
          options={[
            { value: "all", label: "Tous les piliers" },
            ...pillars.map((p) => ({ value: p.id, label: p.name })),
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
          value={fStatus}
          onChange={setFStatus}
          options={[
            { value: "all", label: "Tous les statuts" },
            ...STATUSES.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm opacity-60">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-10 shadow-[var(--shadow-soft)] text-center">
          <p className="text-sm opacity-70">
            {ideas.length === 0
              ? "Aucune idée pour l'instant. Tapez votre première étincelle ci-dessus."
              : "Aucune idée ne correspond à ces filtres."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((idea) =>
            editingId === idea.id ? (
              <IdeaEditor
                key={idea.id}
                idea={idea}
                pillars={pillars}
                onCancel={() => setEditingId(null)}
                onSave={async (patch) => {
                  await updateIdea(idea.id, patch);
                  setEditingId(null);
                }}
              />
            ) : (
              <IdeaCard
                key={idea.id}
                idea={idea}
                pillar={idea.pillar_id ? pillarById[idea.pillar_id] : undefined}
                onEdit={() => setEditingId(idea.id)}
                onDelete={() => removeIdea(idea.id)}
                onTransform={() => transformToPost(idea)}
              />
            ),
          )}
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

function StatusChip({ status }: { status: Status }) {
  return (
    <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-muted text-foreground/80">
      {statusLabel(status)}
    </span>
  );
}

function IdeaCard({
  idea,
  pillar,
  onEdit,
  onDelete,
  onTransform,
}: {
  idea: Idea;
  pillar?: Pillar;
  onEdit: () => void;
  onDelete: () => void;
  onTransform: () => void;
}) {
  return (
    <article className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-5 space-y-3 group">
      <div className="flex items-start gap-3">
        <span
          className="h-3 w-3 rounded-full shrink-0 mt-1.5"
          style={{ backgroundColor: pillar?.color ?? "#cdb48e" }}
          aria-hidden
        />
        <h3 className="text-lg leading-snug flex-1">{idea.title}</h3>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {idea.note && (
        <p className="text-sm opacity-75 leading-relaxed pl-6">{idea.note}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap pl-6">
        {pillar && (
          <span
            className="inline-block text-xs px-2.5 py-1 rounded-full"
            style={{ backgroundColor: pillar.color + "33", color: pillar.color }}
          >
            {pillar.name}
          </span>
        )}
        {idea.channel && (
          <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-popover text-foreground/70">
            {channelLabel(idea.channel)}
          </span>
        )}
        <StatusChip status={idea.status} />
      </div>

      <div className="pt-2 pl-6">
        <button
          type="button"
          onClick={onTransform}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          Transformer en post <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}

function IdeaEditor({
  idea,
  pillars,
  onCancel,
  onSave,
}: {
  idea: Idea;
  pillars: Pillar[];
  onCancel: () => void;
  onSave: (patch: Partial<Idea>) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(idea.title);
  const [note, setNote] = useState(idea.note);
  const [pillarId, setPillarId] = useState<string>(idea.pillar_id ?? "");
  const [channel, setChannel] = useState<string>(idea.channel ?? "");
  const [status, setStatus] = useState<Status>(idea.status);

  return (
    <div className="bg-popover rounded-2xl shadow-[var(--shadow-soft)] p-5 space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre"
        className="w-full bg-background rounded-lg border border-input px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Note libre…"
        className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select
          value={pillarId}
          onChange={(e) => setPillarId(e.target.value)}
          className="rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Pilier —</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Canal —</option>
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Status)}
          className="rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" /> Annuler
        </button>
        <button
          onClick={() =>
            onSave({
              title: title.trim() || idea.title,
              note,
              pillar_id: pillarId || null,
              channel: (channel || null) as Channel | null,
              status,
            })
          }
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 transition-opacity"
        >
          <Check className="h-4 w-4" /> Enregistrer
        </button>
      </div>
    </div>
  );
}
