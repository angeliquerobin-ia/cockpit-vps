import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  GripVertical,
  Sparkles,
  ListPlus,
  Save,
  CalendarClock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/idees")({
  head: () => ({ meta: [{ title: "Studio de Création — Cockpit" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    post: typeof s.post === "string" ? s.post : undefined,
  }),
  component: StudioCreationPage,
});

type Channel =
  | "linkedin"
  | "instagram_coaching"
  | "instagram_chroniques_cosmiques"
  | "podcast"
  | "substack";

type Status = "idee" | "en_redaction" | "pret" | "programme" | "publie";

type Pillar = { id: string; name: string; color: string };

type BoardColumn = { id: string; name: string; position: number; color: string };

const COLUMN_COLORS = [
  "#c98a6b",
  "#6f7a5b",
  "#a07c9c",
  "#cdb48e",
  "#5b6e7a",
  "#b87b5a",
  "#9c6b4f",
  "#7a8a6f",
];
const UNSORTED_COLOR = "#8a8276";

type Post = {
  id: string;
  title: string;
  content: string;
  channel: Channel | null;
  pillar_id: string | null;
  status: Status;
  scheduled_at: string | null;
  board_column_id: string | null;
  board_position: number;
  video_url: string | null;
  created_at: string;
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

const POST_SELECT =
  "id,title,content,channel,pillar_id,status,scheduled_at,board_column_id,board_position,video_url,created_at";

const channelLabel = (c: Channel | null) =>
  c ? (CHANNELS.find((x) => x.value === c)?.label ?? "Instagram") : null;
const statusLabel = (s: Status) => STATUSES.find((x) => x.value === s)?.label ?? s;

const UNSORTED_KEY = "__none__";
const colKeyOf = (id: string | null) => id ?? UNSORTED_KEY;

function StudioCreationPage() {
  const navigate = useNavigate();
  const { post: postParam } = Route.useSearch();
  const [userId, setUserId] = useState<string | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [quickTitle, setQuickTitle] = useState("");

  // Ajout multi-cartes (1 ligne = 1 carte), sans IA
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  // Filtres
  const [fChannel, setFChannel] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Renommage de colonne
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [editingColName, setEditingColName] = useState("");
  const [newColName, setNewColName] = useState("");
  const [addingCol, setAddingCol] = useState(false);

  // DnD cartes
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ col: string; index: number } | null>(null);

  // DnD colonnes
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function loadAll(uid: string) {
    const [p, c, i] = await Promise.all([
      supabase
        .from("content_pillars")
        .select("id,name,color")
        .eq("user_id", uid)
        .order("created_at", { ascending: true }),
      supabase
        .from("board_columns")
        .select("id,name,position,color")
        .eq("user_id", uid)
        .order("position", { ascending: true }),
      supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("user_id", uid)
        .eq("location" as any, "creation")
        .is("deleted_at", null)
        .is("scheduled_at", null)
        .order("board_position", { ascending: true })
        .order("created_at", { ascending: false }),
    ]);
    setPillars((p.data ?? []) as Pillar[]);
    setColumns((c.data ?? []) as BoardColumn[]);
    setPosts((i.data ?? []) as Post[]);
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
      .from("posts")
      .insert({ user_id: userId, title, content: "", status: "idee" } as any)
      .select(POST_SELECT)
      .single();
    if (data) setPosts((prev) => [data as Post, ...prev]);
  }

  async function runBulk() {
    if (!userId || !bulkText.trim()) return;
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const rows = lines.map((title) => ({
      user_id: userId,
      title,
      content: "",
      status: "idee",
    }));
    const { data } = await supabase
      .from("posts")
      .insert(rows as any)
      .select(POST_SELECT);
    if (data) {
      setPosts((prev) => [...(data as Post[]), ...prev]);
      setBulkText("");
      setBulkOpen(false);
    }
  }

  async function removePost(id: string) {
    if (!confirm("Mettre cette carte à la corbeille ?")) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", id);
  }

  // ------- Colonnes (board_columns) -------
  async function addColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !newColName.trim()) return;
    setAddingCol(true);
    const position = columns.length;
    const color = COLUMN_COLORS[columns.length % COLUMN_COLORS.length];
    const { data } = await supabase
      .from("board_columns")
      .insert({ user_id: userId, name: newColName.trim(), position, color } as any)
      .select("id,name,position,color")
      .single();
    if (data) {
      setColumns((prev) => [...prev, data as BoardColumn]);
      setNewColName("");
    }
    setAddingCol(false);
  }

  async function renameColumn(id: string, name: string) {
    const trimmed = name.trim();
    setEditingColId(null);
    if (!trimmed) return;
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
    await supabase.from("board_columns").update({ name: trimmed }).eq("id", id);
  }

  async function recolorColumn(id: string, color: string) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, color } : c)));
    await supabase.from("board_columns").update({ color }).eq("id", id);
  }

  async function deleteColumn(id: string) {
    const count = posts.filter((p) => p.board_column_id === id).length;
    const msg = count
      ? `Supprimer cette colonne ? Les ${count} carte(s) repartiront dans « À ranger ».`
      : "Supprimer cette colonne ?";
    if (!confirm(msg)) return;
    setPosts((prev) =>
      prev.map((p) => (p.board_column_id === id ? { ...p, board_column_id: null } : p)),
    );
    setColumns((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("posts").update({ board_column_id: null }).eq("board_column_id", id);
    await supabase.from("board_columns").delete().eq("id", id);
  }

  async function persistColumnOrder(next: BoardColumn[]) {
    const renumbered = next.map((c, idx) => ({ ...c, position: idx }));
    setColumns(renumbered);
    await Promise.all(
      renumbered.map((c) =>
        supabase.from("board_columns").update({ position: c.position }).eq("id", c.id),
      ),
    );
  }

  function moveColumn(colId: string, targetColId: string) {
    if (colId === targetColId) return;
    const from = columns.findIndex((c) => c.id === colId);
    const to = columns.findIndex((c) => c.id === targetColId);
    if (from < 0 || to < 0) return;
    const next = [...columns];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistColumnOrder(next);
  }

  // ------- Déplacement des cartes -------
  async function moveCard(cardId: string, targetColKey: string, targetIndex: number) {
    const targetColId = targetColKey === UNSORTED_KEY ? null : targetColKey;
    const card = posts.find((p) => p.id === cardId);
    if (!card) return;

    // Liste cible sans la carte déplacée, dans l'ordre courant
    const targetList = posts
      .filter((p) => colKeyOf(p.board_column_id) === targetColKey && p.id !== cardId)
      .sort((a, b) => a.board_position - b.board_position);
    const clamped = Math.max(0, Math.min(targetIndex, targetList.length));
    targetList.splice(clamped, 0, { ...card, board_column_id: targetColId });

    const reindexed = new Map(targetList.map((p, idx) => [p.id, idx]));
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === cardId) return { ...p, board_column_id: targetColId, board_position: reindexed.get(p.id)! };
        if (reindexed.has(p.id)) return { ...p, board_position: reindexed.get(p.id)! };
        return p;
      }),
    );

    await Promise.all(
      targetList.map((p, idx) =>
        supabase
          .from("posts")
          .update({ board_column_id: targetColId, board_position: idx })
          .eq("id", p.id),
      ),
    );
  }

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) => {
      if (fChannel !== "all" && p.channel !== fChannel) return false;
      if (q) {
        const hay = `${p.title} ${p.content ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, fChannel, search]);

  const renderColumns: { id: string | null; name: string; color: string; fixed: boolean }[] = [
    { id: null, name: "À ranger", color: UNSORTED_COLOR, fixed: true },
    ...columns.map((c) => ({ id: c.id, name: c.name, color: c.color, fixed: false })),
  ];
  const colorByKey = new Map(renderColumns.map((c) => [colKeyOf(c.id), c.color]));

  const postsByCol = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const col of renderColumns) map.set(colKeyOf(col.id), []);
    for (const post of filteredPosts) {
      const key = colKeyOf(post.board_column_id);
      if (!map.has(key)) map.set(UNSORTED_KEY, map.get(UNSORTED_KEY) ?? []);
      (map.get(key) ?? map.get(UNSORTED_KEY))!.push(post);
    }
    for (const list of map.values()) list.sort((a, b) => a.board_position - b.board_position);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPosts, columns]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">L'atelier des contenus</p>
        <h1 className="text-5xl">Studio de Création</h1>
        <p className="tagline text-base max-w-2xl">
          Capturez une étincelle, rédigez-la dans la carte, glissez-la de colonne en colonne. Datez
          une carte et elle part se ranger dans le calendrier éditorial.
        </p>
      </header>

      {/* Capture rapide */}
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
            aria-label="Ajouter la carte"
            className="h-10 w-10 shrink-0 grid place-items-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>
      </section>

      {/* Ajout multi-cartes — 1 ligne = 1 carte (sans IA) */}
      <section className="bg-card rounded-2xl p-5 shadow-[var(--shadow-soft)] space-y-3">
        <button
          onClick={() => setBulkOpen((v) => !v)}
          className="w-full flex items-center gap-3 text-left"
        >
          <ListPlus className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <h2 className="text-2xl">Ajouter plusieurs idées d'un coup</h2>
            <p className="tagline text-sm">
              Collez une liste : chaque ligne devient une carte rangée dans « À ranger ».
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
              placeholder={"Une idée par ligne…\nExemple : Repenser mon offre signature\nExemple : Épisode podcast sur la solitude entrepreneuriale"}
              className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setBulkText("")}
                className="rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
              >
                Effacer
              </button>
              <button
                onClick={runBulk}
                disabled={!bulkText.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <ListPlus className="h-4 w-4" /> Créer les cartes
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={fChannel}
          onChange={(e) => setFChannel(e.target.value)}
          className="rounded-lg bg-card border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Tous les canaux</option>
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg bg-background border border-input px-3 py-1.5 text-sm focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-3.5 w-3.5 opacity-60" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
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
            {renderColumns.map((col) => {
              const key = colKeyOf(col.id);
              const list = postsByCol.get(key) ?? [];
              const isColDragTarget = !col.fixed && dragOverColId === col.id && draggedColId;
              return (
                <div
                  key={key}
                  onDragOver={(e) => {
                    // réordonnancement de colonne
                    if (draggedColId && !col.fixed) {
                      e.preventDefault();
                      setDragOverColId(col.id);
                      return;
                    }
                    // dépôt d'une carte en fin de colonne
                    if (draggedCardId) {
                      e.preventDefault();
                      setDropTarget({ col: key, index: list.length });
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedColId && !col.fixed) {
                      moveColumn(draggedColId, col.id!);
                      setDraggedColId(null);
                      setDragOverColId(null);
                      return;
                    }
                    if (draggedCardId && dropTarget) {
                      moveCard(draggedCardId, dropTarget.col, dropTarget.index);
                    }
                    setDraggedCardId(null);
                    setDropTarget(null);
                  }}
                  className={`w-[300px] shrink-0 rounded-2xl p-3 transition-colors ${
                    isColDragTarget ? "ring-2 ring-primary/40" : ""
                  } ${dropTarget?.col === key && draggedCardId ? "bg-muted/70" : "bg-card/60"} shadow-[var(--shadow-soft)]`}
                >
                  {/* En-tête de colonne */}
                  <div
                    className="flex items-center gap-2 px-1 pb-3 group"
                    draggable={!col.fixed && editingColId !== col.id}
                    onDragStart={(e) => {
                      if (col.fixed) return;
                      setDraggedColId(col.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedColId(null);
                      setDragOverColId(null);
                    }}
                  >
                    {!col.fixed && (
                      <GripVertical className="h-4 w-4 opacity-30 shrink-0 cursor-grab active:cursor-grabbing" />
                    )}
                    {col.fixed ? (
                      <span
                        className="h-3.5 w-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: col.color }}
                        aria-hidden
                      />
                    ) : (
                      <input
                        type="color"
                        value={col.color}
                        onChange={(e) => recolorColumn(col.id!, e.target.value)}
                        aria-label="Couleur de la colonne"
                        title="Choisir la couleur de la colonne"
                        className="h-3.5 w-3.5 rounded-full shrink-0 border-0 p-0 bg-transparent cursor-pointer appearance-none [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0"
                        style={{ backgroundColor: col.color }}
                      />
                    )}
                    {!col.fixed && editingColId === col.id ? (
                      <input
                        autoFocus
                        value={editingColName}
                        onChange={(e) => setEditingColName(e.target.value)}
                        onBlur={() => renameColumn(col.id!, editingColName)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameColumn(col.id!, editingColName);
                          if (e.key === "Escape") setEditingColId(null);
                        }}
                        className="flex-1 min-w-0 rounded-md bg-background border border-input px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    ) : (
                      <h3 className="text-base flex-1 truncate">{col.name}</h3>
                    )}
                    <span className="text-xs opacity-60 tabular-nums">{list.length}</span>
                    {!col.fixed && editingColId !== col.id && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingColId(col.id);
                            setEditingColName(col.name);
                          }}
                          aria-label="Renommer la colonne"
                          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteColumn(col.id!)}
                          aria-label="Supprimer la colonne"
                          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-destructive/10 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cartes */}
                  <div className="space-y-2 min-h-[60px]">
                    {list.length === 0 ? (
                      <p className="text-xs opacity-50 italic px-2 py-3">Glissez une carte ici.</p>
                    ) : (
                      list.map((post, index) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          channelName={channelLabel(post.channel)}
                          columnColor={colorByKey.get(key) ?? UNSORTED_COLOR}
                          dragging={draggedCardId === post.id}
                          showDropLine={
                            dropTarget?.col === key && dropTarget.index === index && !!draggedCardId
                          }
                          onDragStart={(e) => {
                            setDraggedCardId(post.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggedCardId(null);
                            setDropTarget(null);
                          }}
                          onDragOverCard={(e) => {
                            if (!draggedCardId) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const after = e.clientY - rect.top > rect.height / 2;
                            setDropTarget({ col: key, index: index + (after ? 1 : 0) });
                          }}
                          onOpen={() => navigate({ to: "/idees", search: { post: post.id } })}
                          onDelete={() => removePost(post.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}

            {/* Nouvelle colonne */}
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
                placeholder="Nom de la colonne"
                className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={addingCol || !newColName.trim()}
                className="w-full rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {addingCol ? "Ajout…" : "Ajouter la colonne"}
              </button>
              <p className="text-xs opacity-60 leading-relaxed">
                <em>Les colonnes sont libres et n'ont aucun lien avec vos piliers éditoriaux.</em>
              </p>
            </form>
          </div>
        </div>
      )}

      {postParam && userId && (
        <PostEditorModal
          postId={postParam}
          pillars={pillars}
          onClose={() => {
            navigate({ to: "/idees", search: { post: undefined } });
            loadAll(userId);
          }}
        />
      )}
    </div>
  );
}

function PostCard({
  post,
  channelName,
  columnColor,
  dragging,
  showDropLine,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onOpen,
  onDelete,
}: {
  post: Post;
  channelName: string | null;
  columnColor: string;
  dragging: boolean;
  showDropLine: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOverCard: (e: React.DragEvent) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const preview = post.content.trim().slice(0, 160);
  return (
    <>
      {showDropLine && <div className="h-0.5 rounded-full bg-primary/70 mx-1" />}
      <article
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOverCard}
        onClick={onOpen}
        className={`bg-card rounded-xl shadow-[var(--shadow-soft)] p-3 space-y-2 group cursor-pointer transition-opacity ${
          dragging ? "opacity-40" : ""
        }`}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 mt-0.5 opacity-30 shrink-0 cursor-grab active:cursor-grabbing" />
          <span
            className="h-2.5 w-2.5 rounded-full shrink-0 mt-1"
            style={{ backgroundColor: columnColor }}
            aria-hidden
          />
          <h3 className="text-sm leading-snug flex-1">
            {post.title.trim() || <span className="opacity-50 italic">Sans titre</span>}
          </h3>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              aria-label="Ouvrir"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              aria-label="Supprimer"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {preview && <p className="text-xs opacity-70 leading-relaxed pl-6 line-clamp-3">{preview}</p>}

        <div className="flex items-center gap-1.5 flex-wrap pl-6">
          {channelName && (
            <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-popover text-foreground/70">
              {channelName}
            </span>
          )}
          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-muted text-foreground/80">
            {statusLabel(post.status)}
          </span>
        </div>
      </article>
    </>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PostEditorModal({
  postId,
  pillars,
  onClose,
}: {
  postId: string;
  pillars: Pillar[];
  onClose: () => void;
}) {
  const [post, setPost] = useState<Post | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [channel, setChannel] = useState<string>("");
  const [pillarId, setPillarId] = useState<string>("");
  const [status, setStatus] = useState<Status>("en_redaction");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("posts")
        .select(POST_SELECT)
        .eq("id", postId)
        .maybeSingle();
      if (!active) return;
      if (!data) {
        setNotFound(true);
        return;
      }
      const p = data as Post;
      setPost(p);
      setTitle(p.title);
      setContent(p.content);
      setChannel(p.channel ?? "");
      setPillarId(p.pillar_id ?? "");
      setStatus(p.status);
      setScheduledAt(p.scheduled_at ? toLocalInput(p.scheduled_at) : "");
    })();
    return () => {
      active = false;
    };
  }, [postId]);

  async function handleSave() {
    if (!post) return;
    setSaving("saving");
    const patch = {
      title,
      content,
      channel: (channel || null) as Channel | null,
      pillar_id: pillarId || null,
      status,
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };
    await supabase.from("posts").update(patch as any).eq("id", post.id);
    setPost({ ...post, ...(patch as any) });
    setSaving("saved");
    setTimeout(() => setSaving("idle"), 1500);
  }

  const pillar = pillarId ? pillars.find((p) => p.id === pillarId) : undefined;
  const willLeaveBoard = !!scheduledAt;

  return (
    <div
      className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-[var(--shadow-soft)] w-full max-w-3xl my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5" style={{ backgroundColor: pillar?.color ?? "#cdb48e" }} />

        {notFound ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm opacity-70">Cette carte est introuvable.</p>
            <button
              onClick={onClose}
              className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-muted"
            >
              Fermer
            </button>
          </div>
        ) : !post ? (
          <div className="p-10 text-center text-sm opacity-60">Chargement…</div>
        ) : (
          <>
            {/* Barre d'actions */}
            <div className="flex items-center justify-between gap-2 px-5 pt-4 flex-wrap">
              <span className="text-xs opacity-60">
                {saving === "saving" && "Enregistrement…"}
                {saving === "saved" && <em>Enregistré</em>}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 transition-opacity"
                >
                  <Save className="h-4 w-4" /> Enregistrer
                </button>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-5 md:p-8 space-y-5">
              {post.video_url && (
                <div className="rounded-xl overflow-hidden bg-muted/40 border border-border">
                  <video
                    src={post.video_url}
                    controls
                    playsInline
                    className="w-full max-h-[420px] object-contain bg-black"
                  />
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
                ref={contentRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Écrivez ici votre contenu, long ou court…"
                rows={16}
                className="w-full bg-transparent border-0 outline-none text-base leading-relaxed resize-y placeholder:opacity-40"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
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
                <Field label="Pilier éditorial (facultatif)">
                  <select
                    value={pillarId}
                    onChange={(e) => setPillarId(e.target.value)}
                    className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— Aucun —</option>
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
                <Field label="Date de publication">
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
              </div>

              {willLeaveBoard && (
                <p className="inline-flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
                  <CalendarClock className="h-3.5 w-3.5" />
                  <em>
                    En enregistrant, cette carte quitte le tableau et se range dans le calendrier
                    éditorial.
                  </em>
                </p>
              )}
            </div>
          </>
        )}
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
