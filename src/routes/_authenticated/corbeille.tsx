import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Lightbulb,
  Film,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/corbeille")({
  head: () => ({ meta: [{ title: "Corbeille — Cockpit" }] }),
  component: CorbeillePage,
});

type Kind = "posts" | "ideas" | "reels" | "competitors";

type Item = {
  id: string;
  label: string;
  sub?: string | null;
  deleted_at: string;
};

const KIND_META: Record<
  Kind,
  { title: string; icon: any; empty: string }
> = {
  posts: { title: "Posts", icon: FileText, empty: "Aucun post à la corbeille." },
  ideas: { title: "Idées", icon: Lightbulb, empty: "Aucune idée à la corbeille." },
  reels: { title: "Réels", icon: Film, empty: "Aucun réel à la corbeille." },
  competitors: { title: "Concurrents", icon: Users, empty: "Aucun concurrent à la corbeille." },
};

function CorbeillePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Record<Kind, Item[]>>({
    posts: [],
    ideas: [],
    reels: [],
    competitors: [],
  });
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function loadAll(uid: string) {
    setLoading(true);
    const [p, i, r, c] = await Promise.all([
      supabase
        .from("posts")
        .select("id,title,content,channel,deleted_at")
        .eq("user_id", uid)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("ideas")
        .select("id,title,note,channel,deleted_at")
        .eq("user_id", uid)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("reels")
        .select("id,title,video_path,channel,deleted_at")
        .eq("user_id", uid)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
      supabase
        .from("competitors")
        .select("id,name,channel,handle,deleted_at")
        .eq("user_id", uid)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false }),
    ]);
    setData({
      posts: ((p.data ?? []) as any[]).map((x) => ({
        id: x.id,
        label: x.title?.trim() || "(post sans titre)",
        sub: x.channel,
        deleted_at: x.deleted_at,
      })),
      ideas: ((i.data ?? []) as any[]).map((x) => ({
        id: x.id,
        label: x.title?.trim() || "(idée sans titre)",
        sub: x.channel,
        deleted_at: x.deleted_at,
      })),
      reels: ((r.data ?? []) as any[]).map((x) => ({
        id: x.id,
        label: x.title?.trim() || "(réel sans titre)",
        sub: x.channel,
        deleted_at: x.deleted_at,
      })),
      competitors: ((c.data ?? []) as any[]).map((x) => ({
        id: x.id,
        label: x.name?.trim() || "(concurrent)",
        sub: x.handle || x.channel,
        deleted_at: x.deleted_at,
      })),
    });
    setLoading(false);
  }

  useEffect(() => {
    if (userId) loadAll(userId);
  }, [userId]);

  async function restore(kind: Kind, id: string) {
    setBusy(`${kind}:${id}`);
    await supabase.from(kind).update({ deleted_at: null } as any).eq("id", id);
    setData((prev) => ({ ...prev, [kind]: prev[kind].filter((x) => x.id !== id) }));
    setBusy(null);
  }

  async function hardDeleteReel(id: string) {
    // remove video from storage too
    const { data: row } = await supabase
      .from("reels")
      .select("video_path")
      .eq("id", id)
      .maybeSingle();
    if (row?.video_path) {
      await supabase.storage.from("reels").remove([row.video_path as string]);
    }
    await supabase.from("reels").delete().eq("id", id);
  }

  async function hardDelete(kind: Kind, id: string) {
    if (!confirm("Supprimer définitivement ? Cette action est irréversible.")) return;
    setBusy(`${kind}:${id}`);
    if (kind === "reels") await hardDeleteReel(id);
    else await supabase.from(kind).delete().eq("id", id);
    setData((prev) => ({ ...prev, [kind]: prev[kind].filter((x) => x.id !== id) }));
    setBusy(null);
  }

  async function emptyAll() {
    if (!userId) return;
    if (
      !confirm(
        "Vider entièrement la corbeille ? Tous les éléments seront supprimés définitivement.",
      )
    )
      return;
    setBusy("ALL");
    // hard-delete reel files first
    for (const r of data.reels) {
      await hardDeleteReel(r.id);
    }
    await Promise.all([
      supabase.from("posts").delete().eq("user_id", userId).not("deleted_at", "is", null),
      supabase.from("ideas").delete().eq("user_id", userId).not("deleted_at", "is", null),
      supabase
        .from("competitors")
        .delete()
        .eq("user_id", userId)
        .not("deleted_at", "is", null),
    ]);
    setData({ posts: [], ideas: [], reels: [], competitors: [] });
    setBusy(null);
  }

  const total = useMemo(
    () => data.posts.length + data.ideas.length + data.reels.length + data.competitors.length,
    [data],
  );

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">
          Suppressions récentes
        </p>
        <h1 className="text-5xl">Corbeille</h1>
        <p className="text-base opacity-75 max-w-2xl">
          <em>
            Vos éléments mis à la corbeille restent ici jusqu'à ce que vous les
            restauriez ou les supprimiez définitivement.
          </em>
        </p>
      </header>

      <div className="flex items-center justify-between bg-card rounded-2xl p-5 shadow-[var(--shadow-soft)]">
        <div className="text-sm opacity-80">
          {loading
            ? "Chargement…"
            : total === 0
              ? "La corbeille est vide."
              : `${total} élément${total > 1 ? "s" : ""} dans la corbeille.`}
        </div>
        <button
          onClick={emptyAll}
          disabled={loading || total === 0 || busy === "ALL"}
          className="inline-flex items-center gap-2 rounded-lg bg-destructive text-destructive-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40"
        >
          <AlertTriangle className="h-4 w-4" />
          {busy === "ALL" ? "Vidage…" : "Vider la corbeille"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(Object.keys(KIND_META) as Kind[]).map((kind) => {
          const meta = KIND_META[kind];
          const items = data[kind];
          const Icon = meta.icon;
          return (
            <section
              key={kind}
              className="bg-card rounded-2xl p-5 shadow-[var(--shadow-soft)] space-y-4"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 text-primary" />
                <h2 className="text-2xl">{meta.title}</h2>
                <span className="ml-auto text-xs opacity-60">
                  {items.length}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="text-sm opacity-60">
                  <em>{meta.empty}</em>
                </p>
              ) : (
                <ul className="space-y-2">
                  {items.map((it) => {
                    const isBusy = busy === `${kind}:${it.id}`;
                    return (
                      <li
                        key={it.id}
                        className="flex items-center gap-3 rounded-lg bg-background/60 border border-border px-3 py-2"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{it.label}</div>
                          <div className="text-[11px] opacity-60 flex gap-2">
                            {it.sub && <span>{it.sub}</span>}
                            <span>
                              supprimé le{" "}
                              {new Date(it.deleted_at).toLocaleDateString(
                                "fr-FR",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                },
                              )}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => restore(kind, it.id)}
                          disabled={isBusy}
                          aria-label="Restaurer"
                          title="Restaurer"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70 disabled:opacity-40"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => hardDelete(kind, it.id)}
                          disabled={isBusy}
                          aria-label="Supprimer définitivement"
                          title="Supprimer définitivement"
                          className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-destructive/10 text-destructive disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
