import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Archive, Filter, Recycle, Undo2, FileText } from "lucide-react";

type Pillar = { id: string; name: string; color: string };

type Row = {
  id: string;
  title: string;
  channel: string | null;
  pillar_id: string | null;
  status: string;
  scheduled_at: string | null;
  updated_at: string;
};

const CHANNELS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram_coaching", label: "Instagram" },
  { value: "podcast", label: "Podcast" },
  { value: "substack", label: "Substack" },
];

export const Route = createFileRoute("/_authenticated/archive")({
  head: () => ({ meta: [{ title: "Archive — Cockpit" }] }),
  component: ArchivePage,
});

function ArchivePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [loading, setLoading] = useState(true);
  const [fPillar, setFPillar] = useState("all");
  const [fChannel, setFChannel] = useState("all");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function load(uid: string) {
    setLoading(true);
    const [p, r] = await Promise.all([
      supabase.from("content_pillars").select("id,name,color").eq("user_id", uid),
      supabase
        .from("posts")
        .select("id,title,channel,pillar_id,status,scheduled_at,updated_at")
        .eq("user_id", uid)
        .is("deleted_at", null)
        .eq("location" as any, "archive")
        .order("updated_at", { ascending: false }),
    ]);
    setPillars((p.data ?? []) as Pillar[]);
    setRows((r.data ?? []) as Row[]);
    setLoading(false);
  }

  useEffect(() => {
    if (userId) load(userId);
  }, [userId]);

  const pillarById = useMemo(
    () => Object.fromEntries(pillars.map((p) => [p.id, p])),
    [pillars],
  );

  async function move(id: string, dest: "creation" | "recyclage") {
    setRows((prev) => prev.filter((r) => r.id !== id));
    const patch: any = { location: dest };
    if (dest === "creation") patch.status = "en_redaction";
    await supabase.from("posts").update(patch).eq("id", id);
    if (dest === "creation") navigate({ to: "/idees", search: { post: id } });
  }

  const filtered = rows.filter((r) => {
    if (fPillar !== "all" && r.pillar_id !== fPillar) return false;
    if (fChannel !== "all" && r.channel !== fChannel) return false;
    return true;
  });

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">Rangement</p>
        <h1 className="text-5xl">Archive</h1>
        <p className="tagline text-base max-w-2xl">
          Vos posts rangés hors du Studio. Rien n'est supprimé : statistiques et
          identifiants Metricool sont préservés.
        </p>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] opacity-70">
          <Filter className="h-3.5 w-3.5" /> Filtrer
        </span>
        <select
          value={fChannel}
          onChange={(e) => setFChannel(e.target.value)}
          className="rounded-lg bg-card border border-border px-3 py-1.5 text-sm"
        >
          <option value="all">Tous les canaux</option>
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <select
          value={fPillar}
          onChange={(e) => setFPillar(e.target.value)}
          className="rounded-lg bg-card border border-border px-3 py-1.5 text-sm"
        >
          <option value="all">Tous les piliers</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm opacity-60">Chargement…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-12 shadow-[var(--shadow-soft)] text-center space-y-3">
          <Archive className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-sm opacity-70">L'archive est vide.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const pillar = r.pillar_id ? pillarById[r.pillar_id] : undefined;
            return (
              <article
                key={r.id}
                className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-5 flex items-center gap-4 flex-wrap"
              >
                <div className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: pillar?.color ?? "#cdb48e" }} />
                <div className="flex-1 min-w-[240px] space-y-1">
                  <h3 className="text-xl">
                    {r.title.trim() || <span className="opacity-50">Sans titre</span>}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap text-xs opacity-70">
                    {pillar && <span>{pillar.name}</span>}
                    {r.channel && <span>· {CHANNELS.find((c) => c.value === r.channel)?.label ?? r.channel}</span>}
                    <span>· {r.status}</span>
                    <span>· {new Date(r.updated_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => move(r.id, "creation")}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted text-foreground/80"
                  >
                    <Undo2 className="h-4 w-4" /> Remettre en création
                  </button>
                  <button
                    onClick={() => move(r.id, "recyclage")}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted text-foreground/80"
                  >
                    <Recycle className="h-4 w-4" /> Recyclage
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
