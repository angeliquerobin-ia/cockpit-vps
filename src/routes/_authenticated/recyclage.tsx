import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Recycle, Filter, Undo2 } from "lucide-react";

type Pillar = { id: string; name: string; color: string };

type Row = {
  id: string;
  title: string;
  channel: string | null;
  pillar_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const CHANNELS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram_coaching", label: "Instagram" },
  { value: "podcast", label: "Podcast" },
  { value: "substack", label: "Substack" },
];

export const Route = createFileRoute("/_authenticated/recyclage")({
  head: () => ({ meta: [{ title: "Recyclage — Cockpit" }] }),
  component: RecyclagePage,
});

function RecyclagePage() {
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
        .select("id,title,channel,pillar_id,status,created_at,updated_at")
        .eq("user_id", uid)
        .is("deleted_at", null)
        .eq("location" as any, "recyclage")
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

  async function backToStudio(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await supabase
      .from("posts")
      .update({ location: "creation", status: "en_redaction" } as any)
      .eq("id", id);
    navigate({ to: "/idees", search: { post: id } });
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
        <h1 className="text-5xl">Recyclage</h1>
        <p className="tagline text-base max-w-2xl">
          Vos posts mis de côté pour être réutilisés. Remettez-en un en création
          quand vous êtes prêt·e à le retravailler.
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
          <Recycle className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-sm opacity-70">Aucun post au recyclage.</p>
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
                    <span>· d'origine {new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
                <button
                  onClick={() => backToStudio(r.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90"
                >
                  <Undo2 className="h-4 w-4" /> Remettre en création
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
