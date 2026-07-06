import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { aiSuggestIdeas, aiSplitIdeas, aiOcrImages } from "@/lib/ai-writer.functions";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  Check,
  X,
  Filter,
  Sparkles,
  Scissors,
  GripVertical,
  ImagePlus,
  Search,
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
  { value: "instagram_coaching", label: "Instagram" },
  { value: "podcast", label: "Podcast" },
  { value: "substack", label: "Substack" },
];

const STATUSES: { value: Status; label: string }[] = [
  { value: "brouillon", label: "Brouillon" },
  { value: "a_developper", label: "À développer" },
  { value: "prete", label: "Prête" },
];

const PILLAR_COLORS = [
  "#cdb48e",
  "#b87b5a",
  "#9c6b4f",
  "#6f7a5b",
  "#5b6e7a",
  "#a07c9c",
  "#c98a6b",
  "#7a8a6f",
];

const channelLabel = (c: Channel | null) => (c ? CHANNELS.find((x) => x.value === c)?.label : null);
const statusLabel = (s: Status) => STATUSES.find((x) => x.value === s)?.label ?? s;

function IdeasPage() {
  const navigate = useNavigate();
  const suggestIdeasFn = useServerFn(aiSuggestIdeas);
  const splitIdeasFn = useServerFn(aiSplitIdeas);
  const ocrImagesFn = useServerFn(aiOcrImages);
  const [userId, setUserId] = useState<string | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [quickTitle, setQuickTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Bulk import
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  // AI suggestions
  type Suggestion = {
    key: string;
    title: string;
    angle: string;
    pillar_id: string | null;
    channel: Channel | null;
    added?: boolean;
  };
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestHint, setSuggestHint] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // filters (sur le kanban)
  const [fChannel, setFChannel] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  // édition d'une colonne (pilier)
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState("");

  // DnD
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Nouvelle colonne (= nouveau pilier)
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState(PILLAR_COLORS[0]);
  const [addingCol, setAddingCol] = useState(false);

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
        .is("deleted_at", null)
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
    if (!confirm("Mettre cette idée à la corbeille ?")) return;
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    await supabase
      .from("ideas")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", id);
  }

  async function runSplit() {
    if (!userId || !bulkText.trim()) return;
    setSplitting(true);
    setSplitError(null);
    try {
      const res = await splitIdeasFn({ data: { text: bulkText } });
      const list = res.ideas ?? [];
      if (list.length === 0) {
        setSplitError("Aucune idée identifiée dans ce texte.");
      } else {
        const rows = list.map((s) => ({
          user_id: userId,
          title: s.title,
          note: s.angle,
          pillar_id: s.pillar_id,
          channel: s.channel,
        }));
        const { data } = await supabase
          .from("ideas")
          .insert(rows as any)
          .select("id,title,note,pillar_id,channel,status,created_at");
        if (data) {
          setIdeas((prev) => [...(data as Idea[]), ...prev]);
          setBulkText("");
          setBulkOpen(false);
        }
      }
    } catch (e: any) {
      setSplitError(e?.message ?? "Erreur lors de la scission");
    } finally {
      setSplitting(false);
    }
  }

  async function runOcr(files: FileList | null) {
    if (!files || files.length === 0) return;
    setOcrLoading(true);
    setSplitError(null);
    try {
      const list = Array.from(files).slice(0, 8);
      const images = await Promise.all(
        list.map(
          (file) =>
            new Promise<{ dataUrl: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ dataUrl: reader.result as string });
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            }),
        ),
      );
      const res = await ocrImagesFn({ data: { images } });
      const extracted = (res.text ?? "").trim();
      if (!extracted) {
        setSplitError("Aucun texte n'a pu être lu sur cette image.");
      } else {
        setBulkText((prev) => (prev.trim() ? `${prev.trim()}\n\n${extracted}` : extracted));
        setBulkOpen(true);
      }
    } catch (e: any) {
      setSplitError(e?.message ?? "Erreur lors de la retranscription");
    } finally {
      setOcrLoading(false);
    }
  }

  async function runSuggest() {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await suggestIdeasFn({
        data: { count: 8, hint: suggestHint.trim() },
      });
      const list = (res.ideas ?? []).map((s, idx) => ({
        key: `${Date.now()}-${idx}`,
        title: s.title,
        angle: s.angle,
        pillar_id: s.pillar_id,
        channel: s.channel as Channel | null,
      }));
      setSuggestions(list);
    } catch (e: any) {
      setSuggestError(e?.message ?? "Erreur lors de la génération");
    } finally {
      setSuggesting(false);
    }
  }

  async function addSuggestion(s: Suggestion) {
    if (!userId) return;
    const { data } = await supabase
      .from("ideas")
      .insert({
        user_id: userId,
        title: s.title,
        note: s.angle,
        pillar_id: s.pillar_id,
        channel: s.channel,
      })
      .select("id,title,note,pillar_id,channel,status,created_at")
      .single();
    if (data) {
      setIdeas((prev) => [data as Idea, ...prev]);
      setSuggestions((prev) => prev.map((x) => (x.key === s.key ? { ...x, added: true } : x)));
    }
  }

  function updateSuggestion(key: string, patch: Partial<Suggestion>) {
    setSuggestions((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function dismissSuggestion(key: string) {
    setSuggestions((prev) => prev.filter((s) => s.key !== key));
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
    await supabase
      .from("ideas")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", idea.id);
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
    navigate({ to: "/studio", search: { post: data.id } });
  }

  async function addColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !newColName.trim()) return;
    setAddingCol(true);
    const { data } = await supabase
      .from("content_pillars")
      .insert({
        user_id: userId,
        name: newColName.trim(),
        color: newColColor,
      } as any)
      .select("id,name,color")
      .single();
    if (data) {
      setPillars((prev) => [...prev, data as Pillar]);
      setNewColName("");
      setNewColColor(PILLAR_COLORS[(pillars.length + 1) % PILLAR_COLORS.length]);
    }
    setAddingCol(false);
  }

  async function renamePillar(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPillars((prev) => prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    setEditingColId(null);
    await supabase.from("content_pillars").update({ name: trimmed }).eq("id", id);
  }

  async function recolorPillar(id: string, color: string) {
    setPillars((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
    await supabase.from("content_pillars").update({ color }).eq("id", id);
  }

  async function deletePillar(id: string) {
    const count = ideas.filter((i) => i.pillar_id === id).length;
    const msg = count
      ? `Supprimer ce pilier ? Les ${count} idée(s) associée(s) seront déplacées vers « À ranger ».`
      : "Supprimer ce pilier ?";
    if (!confirm(msg)) return;
    setIdeas((prev) => prev.map((i) => (i.pillar_id === id ? { ...i, pillar_id: null } : i)));
    setPillars((prev) => prev.filter((p) => p.id !== id));
    await supabase.from("ideas").update({ pillar_id: null }).eq("pillar_id", id);
    await supabase.from("content_pillars").delete().eq("id", id);
  }

  async function moveIdeaTo(ideaId: string, pillarId: string | null) {
    const current = ideas.find((i) => i.id === ideaId);
    if (!current || current.pillar_id === pillarId) return;
    await updateIdea(ideaId, { pillar_id: pillarId });
  }

  function onDragStart(e: React.DragEvent, ideaId: string) {
    setDraggedId(ideaId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ideaId);
  }

  function onColDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== colId) setDragOverCol(colId);
  }

  function onColDrop(e: React.DragEvent, pillarId: string | null) {
    e.preventDefault();
    const id = draggedId ?? e.dataTransfer.getData("text/plain");
    setDraggedId(null);
    setDragOverCol(null);
    if (id) moveIdeaTo(id, pillarId);
  }

  const pillarById = useMemo(() => Object.fromEntries(pillars.map((p) => [p.id, p])), [pillars]);

  const filteredIdeas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ideas.filter((i) => {
      if (fChannel !== "all" && i.channel !== fChannel) return false;
      if (fStatus !== "all" && i.status !== fStatus) return false;
      if (q) {
        const hay = `${i.title} ${i.note ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [ideas, fChannel, fStatus, search]);

  const columns: { id: string | null; name: string; color: string }[] = [
    ...pillars.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    { id: null, name: "À ranger", color: "#8a8276" },
  ];

  const ideasByCol = useMemo(() => {
    const map = new Map<string, Idea[]>();
    for (const col of columns) {
      map.set(col.id ?? "__none__", []);
    }
    for (const idea of filteredIdeas) {
      const key = idea.pillar_id ?? "__none__";
      if (!map.has(key)) map.set("__none__", map.get("__none__") ?? []);
      (map.get(key) ?? map.get("__none__"))!.push(idea);
    }
    return map;
  }, [filteredIdeas, columns]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">Réservoir d'inspirations</p>
        <h1 className="text-5xl">Idées</h1>
        <p className="tagline text-base max-w-2xl">
          Capturez chaque étincelle, scindez vos braindumps en cartes, glissez-les de pilier en
          pilier.
        </p>
      </header>

      {/* Quick capture — « Une nouvelle étincelle ? » */}
      <section className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">Une nouvelle étincelle ?</p>
        <form
          onSubmit={quickAdd}
          className="bg-card rounded-2xl p-3 pl-5 shadow-[var(--shadow-soft)] flex items-center gap-3"
        >
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Notez votre flash créatif ici…"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-base placeholder:opacity-50"
          />
          <button
            type="submit"
            disabled={!quickTitle.trim()}
            aria-label="Ajouter l'idée"
            className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>
      </section>

      {/* Bulk split */}
      <section className="bg-card rounded-2xl p-5 shadow-[var(--shadow-soft)] space-y-3">
        <button
          onClick={() => setBulkOpen((v) => !v)}
          className="w-full flex items-center gap-3 text-left"
        >
          <Scissors className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <h2 className="text-2xl">Scinder un texte en idées</h2>
            <p className="tagline text-sm">
              Collez un braindump, un vocal retranscrit, une note brute — l'app en extrait une carte
              par idée.
            </p>
          </div>
          <span className="text-xs opacity-60">{bulkOpen ? "Replier" : "Ouvrir"}</span>
        </button>

        {bulkOpen && (
          <div className="space-y-3 pt-2">
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={8}
              placeholder="Collez ici un texte contenant plusieurs idées mélangées. L'agent les séparera en cartes distinctes et les rangera dans le bon pilier quand c'est évident."
              className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y leading-relaxed"
            />
            {splitError && <p className="text-sm text-destructive">{splitError}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors">
                <ImagePlus className="h-4 w-4 text-primary" />
                {ocrLoading ? "Retranscription en cours…" : "Ajouter une photo de texte"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  disabled={ocrLoading}
                  onChange={(e) => {
                    runOcr(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setBulkText("");
                    setSplitError(null);
                  }}
                  className="rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  Effacer
                </button>
                <button
                  onClick={runSplit}
                  disabled={splitting || !bulkText.trim()}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <Scissors className="h-4 w-4" />
                  {splitting ? "Scission en cours…" : "Scinder en idées"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* AI suggestions */}
      <section className="bg-card rounded-2xl p-5 shadow-[var(--shadow-soft)] space-y-4">
        <button
          onClick={() => setSuggestOpen((v) => !v)}
          className="w-full flex items-center gap-3 text-left"
        >
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <h2 className="text-2xl">Suggérer des idées</h2>
            <p className="text-sm opacity-70">
              <em>
                L'agent IA lit votre stratégie et vos piliers, puis propose des pistes à garder ou
                écarter.
              </em>
            </p>
          </div>
          <span className="text-xs opacity-60">{suggestOpen ? "Replier" : "Ouvrir"}</span>
        </button>

        {suggestOpen && (
          <>
            <div className="flex items-center gap-2 w-full">
              <input
                value={suggestHint}
                onChange={(e) => setSuggestHint(e.target.value)}
                placeholder="Orientation facultative (saison, thème…)"
                className="flex-1 rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={runSuggest}
                disabled={suggesting}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Sparkles className="h-4 w-4" />
                {suggesting ? "Génération…" : "Suggérer"}
              </button>
            </div>

            {suggestError && <p className="text-sm text-destructive">{suggestError}</p>}

            {suggestions.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {suggestions.map((s) => (
                  <article
                    key={s.key}
                    className="bg-popover rounded-xl p-4 space-y-3 border border-border/60"
                  >
                    <div className="flex items-start gap-2">
                      <h3 className="text-lg leading-snug flex-1">{s.title}</h3>
                      <button
                        onClick={() => dismissSuggestion(s.key)}
                        aria-label="Écarter"
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/60"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {s.angle && <p className="text-sm opacity-80 leading-relaxed">{s.angle}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={s.pillar_id ?? ""}
                        onChange={(e) =>
                          updateSuggestion(s.key, {
                            pillar_id: e.target.value || null,
                          })
                        }
                        className="rounded-lg bg-background border border-input px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">— Pilier —</option>
                        {pillars.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={s.channel ?? ""}
                        onChange={(e) =>
                          updateSuggestion(s.key, {
                            channel: (e.target.value || null) as Channel | null,
                          })
                        }
                        className="rounded-lg bg-background border border-input px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">— Canal —</option>
                        {CHANNELS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => addSuggestion(s)}
                        disabled={s.added}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-60 transition-opacity"
                      >
                        {s.added ? (
                          <>
                            <Check className="h-4 w-4" /> Ajoutée
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" /> Ajouter à mes idées
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] opacity-70">
          <Filter className="h-3.5 w-3.5" /> Filtrer
        </span>
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
        <label className="inline-flex items-center gap-2 rounded-lg bg-background border border-input px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-3.5 w-3.5 opacity-60" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par mot-clé…"
            className="bg-transparent outline-none w-48 placeholder:opacity-50"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Effacer la recherche"
              className="opacity-60 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      </div>

      {/* Kanban */}
      {loading ? (
        <p className="text-sm opacity-60">Chargement…</p>
      ) : (
        <div className="-mx-2 overflow-x-auto pb-4">
          <div className="flex gap-4 px-2 min-w-min items-start">
            {columns.map((col) => {
              const colKey = col.id ?? "__none__";
              const list = ideasByCol.get(colKey) ?? [];
              const isOver = dragOverCol === colKey;
              return (
                <div
                  key={colKey}
                  onDragOver={(e) => onColDragOver(e, colKey)}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => onColDrop(e, col.id)}
                  className={`w-[300px] shrink-0 rounded-2xl p-3 transition-colors ${
                    isOver ? "bg-muted/80" : "bg-card/60"
                  } shadow-[var(--shadow-soft)]`}
                >
                  <div className="flex items-center gap-2 px-2 pb-3 group">
                    {col.id ? (
                      <input
                        type="color"
                        value={col.color}
                        onChange={(e) => recolorPillar(col.id!, e.target.value)}
                        aria-label="Couleur du pilier"
                        className="h-3 w-3 rounded-full border-0 p-0 bg-transparent cursor-pointer appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
                        style={{ backgroundColor: col.color }}
                      />
                    ) : (
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: col.color }}
                        aria-hidden
                      />
                    )}
                    {col.id && editingColId === col.id ? (
                      <input
                        autoFocus
                        value={editingColName}
                        onChange={(e) => setEditingColName(e.target.value)}
                        onBlur={() => renamePillar(col.id!, editingColName)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renamePillar(col.id!, editingColName);
                          if (e.key === "Escape") setEditingColId(null);
                        }}
                        className="flex-1 min-w-0 rounded-md bg-background border border-input px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : (
                      <h3 className="text-base flex-1 truncate">{col.name}</h3>
                    )}
                    <span className="text-xs opacity-60 tabular-nums">{list.length}</span>
                    {col.id && editingColId !== col.id && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingColId(col.id);
                            setEditingColName(col.name);
                          }}
                          aria-label="Renommer le pilier"
                          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePillar(col.id!)}
                          aria-label="Supprimer le pilier"
                          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 min-h-[60px]">
                    {list.length === 0 ? (
                      <p className="text-xs opacity-50 italic px-2 py-3">Glissez une carte ici.</p>
                    ) : (
                      list.map((idea) =>
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
                            onDragStart={(e) => onDragStart(e, idea.id)}
                            onDragEnd={() => {
                              setDraggedId(null);
                              setDragOverCol(null);
                            }}
                            dragging={draggedId === idea.id}
                            onEdit={() => setEditingId(idea.id)}
                            onDelete={() => removeIdea(idea.id)}
                            onTransform={() => transformToPost(idea)}
                          />
                        ),
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {/* Add column = add pillar */}
            <form
              onSubmit={addColumn}
              className="w-[260px] shrink-0 rounded-2xl p-4 bg-card/40 border border-dashed border-border space-y-3"
            >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h3 className="text-base">Nouvelle colonne</h3>
              </div>
              <input
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                placeholder="Nom du pilier"
                className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="flex flex-wrap gap-1.5">
                {PILLAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColColor(c)}
                    aria-label={`Couleur ${c}`}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      newColColor === c ? "ring-2 ring-foreground/60 scale-110" : ""
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={addingCol || !newColName.trim()}
                className="w-full rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {addingCol ? "Ajout…" : "Ajouter la colonne"}
              </button>
              <p className="text-xs opacity-60 leading-relaxed">
                <em>
                  Une colonne = un pilier. Vous pourrez l'éditer en détail depuis la Stratégie.
                </em>
              </p>
            </form>
          </div>
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
    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground/80">
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
  onDragStart,
  onDragEnd,
  dragging,
}: {
  idea: Idea;
  pillar?: Pillar;
  onEdit: () => void;
  onDelete: () => void;
  onTransform: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-card rounded-xl shadow-[var(--shadow-soft)] p-3 space-y-2 group cursor-grab active:cursor-grabbing transition-opacity ${
        dragging ? "opacity-40" : ""
      }`}
      style={{
        borderLeft: `3px solid ${pillar?.color ?? "#8a8276"}`,
      }}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 mt-0.5 opacity-30 shrink-0" />
        <h3 className="text-sm leading-snug flex-1">{idea.title}</h3>
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            aria-label="Modifier"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            aria-label="Supprimer"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {idea.note && (
        <p className="text-xs opacity-70 leading-relaxed pl-6 line-clamp-3">{idea.note}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap pl-6">
        {idea.channel && (
          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-popover text-foreground/70">
            {channelLabel(idea.channel)}
          </span>
        )}
        <StatusChip status={idea.status} />
      </div>

      <div className="pl-6 pt-1">
        <button
          type="button"
          onClick={onTransform}
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Transformer en post <ArrowRight className="h-3 w-3" />
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
    <div className="bg-popover rounded-xl shadow-[var(--shadow-soft)] p-3 space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titre"
        className="w-full bg-background rounded-lg border border-input px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Note libre…"
        className="w-full bg-background rounded-lg border border-input px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />

      <div className="grid grid-cols-1 gap-1.5">
        <select
          value={pillarId}
          onChange={(e) => setPillarId(e.target.value)}
          className="rounded-lg bg-background border border-input px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
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
          className="rounded-lg bg-background border border-input px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
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
          className="rounded-lg bg-background border border-input px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-1 pt-1">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Annuler
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
          className="inline-flex items-center gap-1 rounded-lg bg-primary text-primary-foreground px-2 py-1.5 text-xs hover:opacity-90 transition-opacity"
        >
          <Check className="h-3.5 w-3.5" /> Enregistrer
        </button>
      </div>
    </div>
  );
}
