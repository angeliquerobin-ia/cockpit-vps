import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  X,
  Send,
  Pencil,
  Film,
} from "lucide-react";
import { PublishDialog } from "@/components/publish-dialog";

type Channel =
  | "linkedin"
  | "instagram_coaching"
  | "instagram_chroniques_cosmiques"
  | "podcast"
  | "substack";

type Pillar = { id: string; name: string; color: string };

type Post = {
  id: string;
  title: string;
  channel: Channel | null;
  pillar_id: string | null;
  scheduled_at: string | null;
  video_url: string | null;
};

const CHANNEL_INITIAL: Record<Channel, string> = {
  linkedin: "in",
  instagram_coaching: "Ig",
  instagram_chroniques_cosmiques: "Cc",
  podcast: "Po",
  substack: "Sb",
};
const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: "LinkedIn",
  instagram_coaching: "Instagram coaching",
  instagram_chroniques_cosmiques: "Instagram Chroniques Cosmiques",
  podcast: "Podcast",
  substack: "Substack",
};

export const Route = createFileRoute("/_authenticated/calendrier")({
  head: () => ({ meta: [{ title: "Calendrier — Cockpit" }] }),
  component: CalendarPage,
});

function startOfWeek(d: Date) {
  const r = new Date(d);
  const day = (r.getDay() + 6) % 7; // Monday = 0
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtMonth(d: Date) {
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function CalendarPage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overDay, setOverDay] = useState<string | null>(null);
  const [openedPost, setOpenedPost] = useState<Post | null>(null);
  const [publishPost, setPublishPost] = useState<Post | null>(null);

  async function reloadPosts(uid: string) {
    const { data } = await supabase
      .from("posts")
      .select("id,title,channel,pillar_id,scheduled_at,video_url")
      .eq("user_id", uid)
      .is("deleted_at", null)
      .not("scheduled_at", "is", null);
    setPosts((data ?? []) as Post[]);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [p, ps] = await Promise.all([
        supabase
          .from("content_pillars")
          .select("id,name,color")
          .eq("user_id", userId),
        supabase
          .from("posts")
          .select("id,title,channel,pillar_id,scheduled_at,video_url")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .not("scheduled_at", "is", null),
      ]);
      setPillars((p.data ?? []) as Pillar[]);
      setPosts((ps.data ?? []) as Post[]);
    })();
  }, [userId]);

  const pillarById = useMemo(
    () => Object.fromEntries(pillars.map((p) => [p.id, p])),
    [pillars],
  );

  const days = useMemo(() => {
    if (view === "week") {
      const s = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => addDays(s, i));
    }
    // month: 6 weeks grid starting Monday of first week
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const s = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => addDays(s, i));
  }, [cursor, view]);

  const postsByDay = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const k = ymd(new Date(p.scheduled_at));
      (map[k] ||= []).push(p);
    }
    return map;
  }, [posts]);

  function move(delta: number) {
    const c = new Date(cursor);
    if (view === "month") c.setMonth(c.getMonth() + delta);
    else c.setDate(c.getDate() + 7 * delta);
    setCursor(c);
  }

  async function dropOnDay(day: Date) {
    if (!dragId) return;
    const original = posts.find((p) => p.id === dragId);
    if (!original) return;
    const old = original.scheduled_at ? new Date(original.scheduled_at) : new Date();
    const next = new Date(day);
    next.setHours(old.getHours() || 9, old.getMinutes() || 0, 0, 0);
    const iso = next.toISOString();
    setPosts((prev) =>
      prev.map((p) => (p.id === dragId ? { ...p, scheduled_at: iso } : p)),
    );
    setDragId(null);
    setOverDay(null);
    await supabase.from("posts").update({ scheduled_at: iso }).eq("id", dragId);
  }

  async function createOnDay(day: Date) {
    if (!userId) return;
    const at = new Date(day);
    at.setHours(9, 0, 0, 0);
    const { data } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        title: "",
        content: "",
        status: "en_redaction",
        scheduled_at: at.toISOString(),
      })
      .select("id")
      .single();
    if (data) navigate({ to: "/studio", search: { post: data.id } });
  }

  const headerLabel =
    view === "month"
      ? fmtMonth(cursor)
      : (() => {
          const s = startOfWeek(cursor);
          const e = addDays(s, 6);
          return `${s.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} — ${e.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
        })();

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] opacity-60">Le rythme</p>
          <h1 className="text-5xl">Calendrier</h1>
          <p className="text-base opacity-75 max-w-2xl">
            <em>
              Une vue d'ensemble de vos publications. Glissez pour replanifier,
              cliquez pour ouvrir dans le Studio.
            </em>
          </p>
        </div>
      </header>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => move(-1)}
            aria-label="Précédent"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-card hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setCursor(d);
            }}
            className="rounded-lg bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => move(1)}
            aria-label="Suivant"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-card hover:bg-muted transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="text-2xl ml-3 capitalize">{headerLabel}</h2>
        </div>

        <div className="inline-flex rounded-lg bg-card p-1">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/70 hover:bg-muted"
              }`}
            >
              {v === "month" ? "Mois" : "Semaine"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div
              key={d}
              className="px-3 py-2.5 text-xs uppercase tracking-[0.15em] opacity-60 text-center"
            >
              {d}
            </div>
          ))}
        </div>

        <div
          className={`grid grid-cols-7 ${view === "week" ? "" : "auto-rows-fr"}`}
        >
          {days.map((day) => {
            const key = ymd(day);
            const dayPosts = postsByDay[key] ?? [];
            const inMonth = view === "week" || day.getMonth() === cursor.getMonth();
            const isToday = sameDay(day, new Date());
            const isOver = overDay === key;
            return (
              <div
                key={key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverDay(key);
                }}
                onDragLeave={() => setOverDay((k) => (k === key ? null : k))}
                onDrop={() => dropOnDay(day)}
                className={`group relative border-r border-b border-border p-2 flex flex-col gap-1.5 ${
                  view === "week" ? "min-h-[420px]" : "min-h-[120px]"
                } ${inMonth ? "" : "opacity-50"} ${
                  isOver ? "bg-muted/60" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${
                      isToday
                        ? "h-6 w-6 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground"
                        : "opacity-70"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <button
                    onClick={() => createOnDay(day)}
                    aria-label="Nouveau post ce jour"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-1 flex-1">
                  {dayPosts.map((p) => {
                    const pillar = p.pillar_id ? pillarById[p.pillar_id] : undefined;
                    const color = pillar?.color ?? "#cdb48e";
                    return (
                      <button
                        key={p.id}
                        draggable
                        onDragStart={() => setDragId(p.id)}
                        onDragEnd={() => setDragId(null)}
                        onClick={() =>
                          setOpenedPost(p)
                        }
                        title={`${pillar?.name ?? "Sans pilier"}${p.channel ? " · " + CHANNEL_LABEL[p.channel] : ""}`}
                        className="text-left rounded-md px-2 py-1.5 text-xs leading-snug cursor-grab active:cursor-grabbing hover:brightness-95 transition-all"
                        style={{
                          backgroundColor: color + "26",
                          borderLeft: `3px solid ${color}`,
                          color: "var(--foreground)",
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          {p.channel && (
                            <span
                              className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-sm text-[10px] font-medium"
                              style={{ backgroundColor: color, color: "#fff" }}
                            >
                              {CHANNEL_INITIAL[p.channel]}
                            </span>
                          )}
                          {p.video_url && (
                            <Film
                              className="h-3 w-3 shrink-0 opacity-80"
                              style={{ color }}
                              aria-label="Post vidéo"
                            />
                          )}
                          <span className="truncate">
                            {p.title.trim() || (
                              <em className="opacity-60">Sans titre</em>
                            )}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {pillars.length === 0 && posts.length === 0 && (
        <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-soft)] text-center space-y-2">
          <CalendarDays className="h-7 w-7 mx-auto opacity-40" />
          <p className="text-sm opacity-70">
            Vos posts programmés apparaîtront ici. Datez un post dans le Studio
            ou cliquez sur un jour vide pour en créer un.
          </p>
        </div>
      )}

      {pillars.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-xs opacity-80">
          <span className="uppercase tracking-[0.15em] opacity-60">Piliers</span>
          {pillars.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
            </span>
          ))}
        </div>
      )}

      {openedPost && !publishPost && (
        <PostCardModal
          post={openedPost}
          pillar={
            openedPost.pillar_id ? pillarById[openedPost.pillar_id] : undefined
          }
          onClose={() => setOpenedPost(null)}
          onOpenStudio={() => {
            navigate({ to: "/studio", search: { post: openedPost.id } });
          }}
          onPublish={() => setPublishPost(openedPost)}
        />
      )}

      {publishPost && userId && (
        <PublishDialog
          post={{
            id: publishPost.id,
            title: publishPost.title,
            channel: publishPost.channel,
            scheduled_at: publishPost.scheduled_at,
          }}
          userId={userId}
          onClose={() => setPublishPost(null)}
          onPublished={async () => {
            setPublishPost(null);
            setOpenedPost(null);
            if (userId) await reloadPosts(userId);
          }}
        />
      )}
    </div>
  );
}

function PostCardModal({
  post,
  pillar,
  onClose,
  onOpenStudio,
  onPublish,
}: {
  post: Post;
  pillar?: Pillar;
  onClose: () => void;
  onOpenStudio: () => void;
  onPublish: () => void;
}) {
  const when = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <div
      className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-[var(--shadow-soft)] max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1.5"
          style={{ backgroundColor: pillar?.color ?? "#cdb48e" }}
        />
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-2xl leading-tight">
              {post.title.trim() || (
                <span className="opacity-50">Sans titre</span>
              )}
            </h3>
            <button
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {pillar && (
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: pillar.color + "33",
                  color: pillar.color,
                }}
              >
                {pillar.name}
              </span>
            )}
            {post.channel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/80">
                {CHANNEL_LABEL[post.channel]}
              </span>
            )}
          </div>

          {when && (
            <p className="text-sm opacity-75">
              <em>Programmé : {when}</em>
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={onOpenStudio}
              className="inline-flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Pencil className="h-4 w-4" /> Ouvrir dans le Studio
            </button>
            <button
              onClick={onPublish}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 transition-opacity"
            >
              <Send className="h-4 w-4" /> Publier ou programmer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

