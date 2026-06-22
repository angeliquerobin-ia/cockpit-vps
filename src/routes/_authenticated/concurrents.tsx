import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  refreshCompetitors,
  analyzeCompetitorsMetrics,
  analyzeCompetitorsContent,
  createIdeaFromSuggestion,
} from "@/lib/competitors.functions";
import { CHANNEL_LABELS } from "@/lib/channel-prompts";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  Sparkles,
  BookOpen,
  Lightbulb,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/concurrents")({
  head: () => ({ meta: [{ title: "Concurrents — Cockpit" }] }),
  component: CompetitorsPage,
});

type Competitor = {
  id: string;
  name: string;
  channel: string;
  handle: string;
  notes: string;
};
type Metrics = Record<string, number>;
type CompetitorMetrics = {
  competitor_id: string;
  metrics: Metrics;
  fetched_at: string;
};
type SelfSnapshot = { metrics: Record<string, Metrics>; fetched_at: string };

const INDICATORS: { key: string; label: string; suffix?: string }[] = [
  { key: "engagement", label: "Engagement", suffix: "%" },
  { key: "publishing_rhythm", label: "Rythme de publication", suffix: "/sem" },
  { key: "audience_growth", label: "Croissance audience (30j)", suffix: "%" },
];

function timeAgo(iso?: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

function CompetitorsPage() {
  const refresh = useServerFn(refreshCompetitors);
  const analyzeMetrics = useServerFn(analyzeCompetitorsMetrics);
  const analyzeContent = useServerFn(analyzeCompetitorsContent);
  const addIdea = useServerFn(createIdeaFromSuggestion);
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeChannels, setActiveChannels] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [metricsByCompetitor, setMetricsByCompetitor] = useState<
    Record<string, CompetitorMetrics>
  >({});
  const [selfSnapshot, setSelfSnapshot] = useState<SelfSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Analyse IA — chiffres
  const [metricsAnalysis, setMetricsAnalysis] = useState<string | null>(null);
  const [analyzingMetrics, setAnalyzingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Analyse IA — contenu
  const [contentSelection, setContentSelection] = useState<Set<string>>(
    new Set(),
  );
  const [contentAnalysis, setContentAnalysis] = useState<string | null>(null);
  const [analyzingContent, setAnalyzingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [addedIdeas, setAddedIdeas] = useState<Set<string>>(new Set());

  async function handleAnalyzeMetrics() {
    setAnalyzingMetrics(true);
    setMetricsError(null);
    try {
      const r = await analyzeMetrics();
      setMetricsAnalysis(r.analysis);
    } catch (e: any) {
      setMetricsError(e?.message ?? "Erreur inconnue");
    } finally {
      setAnalyzingMetrics(false);
    }
  }

  async function handleAnalyzeContent() {
    if (contentSelection.size === 0) return;
    setAnalyzingContent(true);
    setContentError(null);
    try {
      const r = await analyzeContent({
        data: { competitorIds: Array.from(contentSelection) },
      });
      setContentAnalysis(r.analysis);
    } catch (e: any) {
      setContentError(e?.message ?? "Erreur inconnue");
    } finally {
      setAnalyzingContent(false);
    }
  }

  function toggleSelection(id: string) {
    setContentSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddIdea(title: string, note: string) {
    const key = `${title}::${note}`;
    if (addedIdeas.has(key)) return;
    try {
      await addIdea({ data: { title, note } });
      setAddedIdeas((s) => new Set(s).add(key));
    } catch (e) {
      console.error(e);
    }
  }


  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  async function loadAll(uid: string) {
    const [c, m, s, settings] = await Promise.all([
      supabase
        .from("competitors")
        .select("id,name,channel,handle,notes")
        .eq("user_id", uid)
        .order("created_at", { ascending: true }),
      supabase
        .from("competitor_metrics")
        .select("competitor_id,metrics,fetched_at")
        .eq("user_id", uid),
      supabase
        .from("user_metrics_snapshot")
        .select("metrics,fetched_at")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select("active_channels")
        .eq("user_id", uid)
        .maybeSingle(),
    ]);
    setCompetitors((c.data ?? []) as Competitor[]);
    const map: Record<string, CompetitorMetrics> = {};
    for (const row of (m.data ?? []) as CompetitorMetrics[])
      map[row.competitor_id] = row;
    setMetricsByCompetitor(map);
    setSelfSnapshot(s.data ? (s.data as any) : null);
    setActiveChannels(((settings.data as any)?.active_channels ?? []) as string[]);
    setLoading(false);
  }

  useEffect(() => {
    if (userId) loadAll(userId);
  }, [userId]);

  async function removeCompetitor(id: string) {
    if (!confirm("Supprimer ce concurrent ?")) return;
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("competitors").delete().eq("id", id);
  }

  async function saveCompetitor(patch: Partial<Competitor> & { id?: string }) {
    if (!userId) return;
    if (patch.id) {
      const id = patch.id;
      setCompetitors((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } as Competitor : c)),
      );
      await supabase
        .from("competitors")
        .update({
          name: patch.name,
          channel: patch.channel,
          handle: patch.handle,
          notes: patch.notes,
        })
        .eq("id", id);
      setEditingId(null);
    } else {
      const { data } = await supabase
        .from("competitors")
        .insert({
          user_id: userId,
          name: patch.name ?? "",
          channel: patch.channel ?? activeChannels[0] ?? "linkedin",
          handle: patch.handle ?? "",
          notes: patch.notes ?? "",
        })
        .select("id,name,channel,handle,notes")
        .single();
      if (data) setCompetitors((prev) => [...prev, data as Competitor]);
      setAdding(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refresh();
      if (userId) await loadAll(userId);
    } catch (e: any) {
      setRefreshError(e?.message ?? "Erreur inconnue");
    } finally {
      setRefreshing(false);
    }
  }

  const lastFetched = useMemo(() => {
    const arr = Object.values(metricsByCompetitor).map((m) => m.fetched_at);
    if (selfSnapshot?.fetched_at) arr.push(selfSnapshot.fetched_at);
    return arr.length
      ? arr.sort().slice(-1)[0]
      : null;
  }, [metricsByCompetitor, selfSnapshot]);

  const competitorsByChannel = useMemo(() => {
    const g: Record<string, Competitor[]> = {};
    for (const c of competitors) {
      (g[c.channel] ??= []).push(c);
    }
    return g;
  }, [competitors]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">
          Le paysage
        </p>
        <h1 className="text-5xl">Concurrents</h1>
        <p className="text-base opacity-75 max-w-2xl">
          <em>
            Gardez un œil attentif sur les comptes qui inspirent ou défient.
          </em>
        </p>
      </header>

      {/* Action bar */}
      <div className="bg-card rounded-2xl p-5 shadow-[var(--shadow-soft)] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Connexion à Metricool…" : "Rafraîchir"}
          </button>
          {refreshError && (
            <span className="text-sm text-destructive">{refreshError}</span>
          )}
        </div>
        <span className="text-xs opacity-60">
          {lastFetched
            ? `Dernier rafraîchissement : ${timeAgo(lastFetched)}`
            : "Aucun rafraîchissement encore"}
        </span>
      </div>

      {/* Competitors list */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Mes comptes suivis</h2>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" /> Ajouter un concurrent
          </button>
        </div>

        {loading ? (
          <p className="text-sm opacity-60">Chargement…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {adding && (
              <CompetitorEditor
                activeChannels={activeChannels}
                onCancel={() => setAdding(false)}
                onSave={(patch) => saveCompetitor(patch)}
              />
            )}
            {competitors.map((c) =>
              editingId === c.id ? (
                <CompetitorEditor
                  key={c.id}
                  initial={c}
                  activeChannels={activeChannels}
                  onCancel={() => setEditingId(null)}
                  onSave={(patch) => saveCompetitor({ ...patch, id: c.id })}
                />
              ) : (
                <CompetitorCard
                  key={c.id}
                  competitor={c}
                  onEdit={() => setEditingId(c.id)}
                  onDelete={() => removeCompetitor(c.id)}
                />
              ),
            )}
            {!adding && competitors.length === 0 && (
              <div className="md:col-span-2 bg-card rounded-2xl p-10 shadow-[var(--shadow-soft)] text-center">
                <p className="text-sm opacity-70">
                  Aucun concurrent suivi. Ajoutez le premier compte à observer.
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Comparison */}
      <section className="space-y-6">
        <h2 className="text-2xl">Comparaison côte à côte</h2>
        {Object.keys(competitorsByChannel).length === 0 ? (
          <div className="bg-card rounded-2xl p-10 shadow-[var(--shadow-soft)] text-center">
            <p className="text-sm opacity-70">
              Ajoutez des concurrents pour afficher la comparaison.
            </p>
          </div>
        ) : !lastFetched ? (
          <div className="bg-card rounded-2xl p-10 shadow-[var(--shadow-soft)] text-center">
            <p className="text-sm opacity-70">
              Cliquez sur « Rafraîchir » pour récupérer les métriques depuis
              Metricool via N8N.
            </p>
          </div>
        ) : (
          Object.entries(competitorsByChannel).map(([channel, list]) => (
            <ComparisonTable
              key={channel}
              channel={channel}
              competitors={list}
              metricsByCompetitor={metricsByCompetitor}
              selfMetrics={selfSnapshot?.metrics?.[channel] ?? null}
            />
          ))
        )}
      </section>

      {/* Analyse IA — chiffres */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-2xl">Analyse intelligente</h2>
          <button
            onClick={handleAnalyzeMetrics}
            disabled={analyzingMetrics || (!lastFetched && competitors.length === 0)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {analyzingMetrics ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {analyzingMetrics ? "Analyse en cours…" : "Analyser"}
          </button>
        </div>
        {metricsError && (
          <p className="text-sm text-destructive">{metricsError}</p>
        )}
        {metricsAnalysis ? (
          <article className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-6">
            <MarkdownLite text={metricsAnalysis} />
          </article>
        ) : (
          <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-soft)] text-center">
            <p className="text-sm opacity-70">
              <em>
                Lance une analyse pour voir où tu te situes, qui te devance et
                sur quels indicateurs.
              </em>
            </p>
          </div>
        )}
      </section>

      {/* Analyse IA — contenu */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-2xl">Analyser leur contenu</h2>
          <button
            onClick={handleAnalyzeContent}
            disabled={analyzingContent || contentSelection.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {analyzingContent ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BookOpen className="h-4 w-4" />
            )}
            {analyzingContent
              ? "Lecture des publications…"
              : `Analyser le contenu${contentSelection.size ? ` (${contentSelection.size})` : ""}`}
          </button>
        </div>

        {competitors.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 shadow-[var(--shadow-soft)] text-center">
            <p className="text-sm opacity-70">
              Ajoute des concurrents pour analyser leur contenu.
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-5 space-y-3">
            <p className="text-xs uppercase tracking-[0.15em] opacity-60">
              Sélectionne les comptes à explorer
            </p>
            <div className="flex flex-wrap gap-2">
              {competitors.map((c) => {
                const on = contentSelection.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggleSelection(c.id)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-all ${
                      on
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {c.name}
                    <span className="opacity-50 ml-1.5 text-xs">
                      {CHANNEL_LABELS[c.channel] ?? c.channel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {contentError && (
          <p className="text-sm text-destructive">{contentError}</p>
        )}

        {contentAnalysis && (
          <article className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-6 space-y-4">
            <MarkdownLite text={contentAnalysis} />
            <SuggestionsBlock
              text={contentAnalysis}
              addedIdeas={addedIdeas}
              onAdd={handleAddIdea}
              onGoToIdeas={() => navigate({ to: "/idees" })}
            />
          </article>
        )}
      </section>
    </div>
  );
}

function MarkdownLite({ text }: { text: string }) {
  // Lightweight renderer for ##, **, and lists. Keep terre/Cormorant identity.
  const lines = text.split("\n");
  const out: any[] = [];
  let list: string[] = [];
  const flushList = () => {
    if (list.length === 0) return;
    out.push(
      <ul key={`ul-${out.length}`} className="list-disc pl-5 space-y-1 my-2">
        {list.map((l, i) => (
          <li key={i} className="opacity-85 leading-relaxed">
            {inline(l)}
          </li>
        ))}
      </ul>,
    );
    list = [];
  };
  function inline(s: string) {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={i} className="text-primary font-medium">
          {p.slice(2, -2)}
        </strong>
      ) : (
        <span key={i}>{p}</span>
      ),
    );
  }
  lines.forEach((raw, idx) => {
    const l = raw.trimEnd();
    if (/^- PISTE:/i.test(l.trim())) return; // handled separately
    if (l.startsWith("## ")) {
      flushList();
      out.push(
        <h3
          key={idx}
          className="text-xl mt-5 first:mt-0"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {l.slice(3)}
        </h3>,
      );
    } else if (l.startsWith("# ")) {
      flushList();
      out.push(
        <h2
          key={idx}
          className="text-2xl mt-5 first:mt-0"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {l.slice(2)}
        </h2>,
      );
    } else if (/^\s*[-*]\s+/.test(l)) {
      list.push(l.replace(/^\s*[-*]\s+/, ""));
    } else if (l.trim() === "") {
      flushList();
    } else {
      flushList();
      out.push(
        <p key={idx} className="opacity-85 leading-relaxed my-2">
          {inline(l)}
        </p>,
      );
    }
  });
  flushList();
  return <div className="space-y-1">{out}</div>;
}

function SuggestionsBlock({
  text,
  addedIdeas,
  onAdd,
  onGoToIdeas,
}: {
  text: string;
  addedIdeas: Set<string>;
  onAdd: (title: string, note: string) => void;
  onGoToIdeas: () => void;
}) {
  const suggestions = useMemo(() => {
    const out: { title: string; note: string }[] = [];
    for (const raw of text.split("\n")) {
      const m = raw.trim().match(/^-\s*PISTE\s*:\s*(.+)$/i);
      if (!m) continue;
      const body = m[1].trim();
      const sep = body.match(/\s[—–-]\s/);
      if (sep) {
        const i = body.indexOf(sep[0]);
        out.push({
          title: body.slice(0, i).trim(),
          note: body.slice(i + sep[0].length).trim(),
        });
      } else {
        out.push({ title: body, note: "" });
      }
    }
    return out;
  }, [text]);

  if (suggestions.length === 0) return null;

  return (
    <div className="pt-2 border-t border-border/40 space-y-3">
      <div className="flex items-center justify-between">
        <h4
          className="text-lg"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          Pistes à transformer en idée
        </h4>
        <button
          onClick={onGoToIdeas}
          className="text-xs text-primary hover:underline"
        >
          Voir mes idées →
        </button>
      </div>
      <ul className="space-y-2">
        {suggestions.map((s, i) => {
          const key = `${s.title}::${s.note}`;
          const added = addedIdeas.has(key);
          return (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl bg-popover/60 p-3"
            >
              <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-snug">
                  <strong className="text-primary font-medium">
                    {s.title}
                  </strong>
                  {s.note && (
                    <span className="opacity-75"> — {s.note}</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => onAdd(s.title, s.note)}
                disabled={added}
                className="text-xs rounded-md border border-border px-2.5 py-1 hover:bg-muted disabled:opacity-50 transition-colors shrink-0"
              >
                {added ? (
                  <span className="inline-flex items-center gap-1 text-primary">
                    <Check className="h-3 w-3" />
                    Ajoutée
                  </span>
                ) : (
                  "Ajouter à mes idées"
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


function CompetitorCard({
  competitor,
  onEdit,
  onDelete,
}: {
  competitor: Competitor;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-5 space-y-3 group">
      <div className="flex items-start gap-3">
        <h3 className="text-lg leading-snug flex-1">{competitor.name}</h3>
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
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-popover text-foreground/80">
          {CHANNEL_LABELS[competitor.channel] ?? competitor.channel}
        </span>
        <span className="text-xs opacity-70 font-mono">{competitor.handle}</span>
      </div>
      {competitor.notes && (
        <p className="text-sm opacity-75 leading-relaxed whitespace-pre-wrap">
          {competitor.notes}
        </p>
      )}
    </article>
  );
}

function CompetitorEditor({
  initial,
  activeChannels,
  onCancel,
  onSave,
}: {
  initial?: Competitor;
  activeChannels: string[];
  onCancel: () => void;
  onSave: (patch: Partial<Competitor>) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState(
    initial?.channel ?? activeChannels[0] ?? "linkedin",
  );
  const [handle, setHandle] = useState(initial?.handle ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <div className="bg-popover rounded-2xl shadow-[var(--shadow-soft)] p-5 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nom du compte"
        className="w-full bg-background rounded-lg border border-input px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          className="rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {(activeChannels.length ? activeChannels : Object.keys(CHANNEL_LABELS)).map(
            (c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c] ?? c}
              </option>
            ),
          )}
        </select>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="@identifiant ou URL"
          className="rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Observations : ligne éditoriale, formats, ce qui marche…"
        className="w-full bg-background rounded-lg border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
      />
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" /> Annuler
        </button>
        <button
          onClick={() => onSave({ name: name.trim(), channel, handle: handle.trim(), notes })}
          disabled={!name.trim() || !handle.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <Check className="h-4 w-4" /> Enregistrer
        </button>
      </div>
    </div>
  );
}

function ComparisonTable({
  channel,
  competitors,
  metricsByCompetitor,
  selfMetrics,
}: {
  channel: string;
  competitors: Competitor[];
  metricsByCompetitor: Record<string, CompetitorMetrics>;
  selfMetrics: Metrics | null;
}) {
  const cols: { key: string; label: string; metrics: Metrics | null }[] = [
    { key: "self", label: "Moi", metrics: selfMetrics },
    ...competitors.map((c) => ({
      key: c.id,
      label: c.name,
      metrics: (metricsByCompetitor[c.id]?.metrics as Metrics) ?? null,
    })),
  ];

  return (
    <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden">
      <div className="px-5 py-4 border-b border-border/40">
        <h3 className="text-lg">{CHANNEL_LABELS[channel] ?? channel}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="px-5 py-3 font-normal opacity-60 text-xs uppercase tracking-[0.15em]">
                Indicateur
              </th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`px-5 py-3 font-normal text-xs uppercase tracking-[0.15em] ${
                    c.key === "self" ? "text-primary" : "opacity-60"
                  }`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {INDICATORS.map((ind) => {
              const values = cols.map((c) => {
                const v = c.metrics?.[ind.key];
                return typeof v === "number" ? v : null;
              });
              const numeric = values.filter((v): v is number => v !== null);
              const best = numeric.length ? Math.max(...numeric) : null;
              const selfVal = values[0];
              return (
                <tr key={ind.key} className="border-t border-border/30">
                  <td className="px-5 py-4 opacity-80">{ind.label}</td>
                  {cols.map((c, i) => {
                    const v = values[i];
                    const isBest = best !== null && v === best;
                    const cmp =
                      i > 0 && typeof v === "number" && typeof selfVal === "number"
                        ? v - selfVal
                        : null;
                    return (
                      <td key={c.key} className="px-5 py-4">
                        {v === null ? (
                          <span className="opacity-40">—</span>
                        ) : (
                          <div className="flex items-baseline gap-2">
                            <span
                              className={
                                isBest
                                  ? "text-primary text-base"
                                  : "text-foreground/70"
                              }
                            >
                              {v}
                              {ind.suffix ?? ""}
                            </span>
                            {cmp !== null && cmp !== 0 && (
                              <span
                                className={`inline-flex items-center gap-0.5 text-xs ${
                                  cmp > 0
                                    ? "text-primary"
                                    : "text-[hsl(var(--destructive))]"
                                }`}
                              >
                                {cmp > 0 ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                {cmp > 0 ? "+" : ""}
                                {cmp.toFixed(1)}
                              </span>
                            )}
                            {cmp === 0 && (
                              <Minus className="h-3 w-3 opacity-40" />
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
