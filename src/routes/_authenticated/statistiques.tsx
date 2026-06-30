import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  RefreshCw,
  Sparkles,
  Loader2,
  Check,
  Lightbulb,
  BarChart3,
  Quote,
  Grid3x3,
  FileText,
  TrendingDown,
} from "lucide-react";
import { refreshStats, analyzePerformance } from "@/lib/stats.functions";
import { createIdeaFromSuggestion } from "@/lib/competitors.functions";
import { CHANNEL_LABELS } from "@/lib/channel-prompts";
import { STATS_MODE_LABELS, type StatsMode } from "@/lib/stats-prompts";

export const Route = createFileRoute("/_authenticated/statistiques")({
  head: () => ({ meta: [{ title: "Statistiques — Cockpit" }] }),
  component: StatsPage,
});

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

function StatsPage() {
  const navigate = useNavigate();
  const refresh = useServerFn(refreshStats);
  const analyze = useServerFn(analyzePerformance);
  const addIdea = useServerFn(createIdeaFromSuggestion);

  const [userId, setUserId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    metrics: Record<string, any>;
    fetched_at: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const [analyses, setAnalyses] = useState<Record<StatsMode, string | null>>({
    full: null,
    hooks: null,
    matrix: null,
    monthly: null,
    drop: null,
  });
  const [analyzingMode, setAnalyzingMode] = useState<StatsMode | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [addedIdeas, setAddedIdeas] = useState<Set<string>>(new Set());
  const [activeMode, setActiveMode] = useState<StatsMode>("full");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("user_metrics_snapshot")
      .select("metrics, fetched_at")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => setSnapshot((data as any) ?? null));
  }, [userId]);

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refresh({});
      if (userId) {
        const { data } = await supabase
          .from("user_metrics_snapshot")
          .select("metrics, fetched_at")
          .eq("user_id", userId)
          .maybeSingle();
        setSnapshot((data as any) ?? null);
      }
    } catch (e: any) {
      setRefreshError(e?.message ?? "Connexion impossible.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleAnalyze(mode: StatsMode) {
    setAnalyzingMode(mode);
    setAnalyzeError(null);
    setActiveMode(mode);
    try {
      const r = await analyze({ data: { mode } });
      setAnalyses((a) => ({ ...a, [mode]: r.analysis }));
    } catch (e: any) {
      setAnalyzeError(e?.message ?? "Analyse impossible.");
    } finally {
      setAnalyzingMode(null);
    }
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

  const channelSummary = useMemo(() => {
    if (!snapshot?.metrics) return [];
    const m = snapshot.metrics;
    // Heuristic: top-level keys that look like channels
    const out: { channel: string; metrics: Record<string, any> }[] = [];
    for (const [k, v] of Object.entries(m)) {
      if (k.startsWith("_")) continue;
      if (k === "top_posts" || k === "by_channel") continue;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        out.push({ channel: k, metrics: v as any });
      }
    }
    // Also support by_channel envelope
    if (m.by_channel && typeof m.by_channel === "object") {
      for (const [k, v] of Object.entries(m.by_channel)) {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          out.push({ channel: k, metrics: v as any });
        }
      }
    }
    return out;
  }, [snapshot]);

  const topPosts = useMemo(() => {
    const m = snapshot?.metrics as any;
    if (!m) return [];
    const arr = (m.top_posts ?? m._top_posts ?? []) as any[];
    return Array.isArray(arr) ? arr.slice(0, 5) : [];
  }, [snapshot]);

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] opacity-60">La mesure</p>
          <h1 className="text-5xl">Statistiques</h1>
          <p className="text-base opacity-75 max-w-2xl">
            <em>
              Une lecture posée de vos performances : ce qui résonne, ce qui
              décroche, ce qu'il y aurait à tenter.
            </em>
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {snapshot?.fetched_at && (
            <span className="text-xs opacity-60">
              Dernier rafraîchissement : {timeAgo(snapshot.fetched_at)}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-card border border-border px-3.5 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Rafraîchir
          </button>
          <button
            onClick={() => handleAnalyze("full")}
            disabled={analyzingMode !== null || !snapshot}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          >
            {analyzingMode === "full" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Analyser mes performances
          </button>
        </div>
      </header>

      {/* Modes spécialisés */}
      {snapshot && (
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] opacity-60">
            Modes d'analyse
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <ModeButton
              icon={<Quote className="h-4 w-4" />}
              label={STATS_MODE_LABELS.hooks}
              active={activeMode === "hooks" && !!analyses.hooks}
              loading={analyzingMode === "hooks"}
              disabled={analyzingMode !== null}
              onClick={() => handleAnalyze("hooks")}
            />
            <ModeButton
              icon={<Grid3x3 className="h-4 w-4" />}
              label={STATS_MODE_LABELS.matrix}
              active={activeMode === "matrix" && !!analyses.matrix}
              loading={analyzingMode === "matrix"}
              disabled={analyzingMode !== null}
              onClick={() => handleAnalyze("matrix")}
            />
            <ModeButton
              icon={<FileText className="h-4 w-4" />}
              label={STATS_MODE_LABELS.monthly}
              active={activeMode === "monthly" && !!analyses.monthly}
              loading={analyzingMode === "monthly"}
              disabled={analyzingMode !== null}
              onClick={() => handleAnalyze("monthly")}
            />
            <ModeButton
              icon={<TrendingDown className="h-4 w-4" />}
              label={STATS_MODE_LABELS.drop}
              active={activeMode === "drop" && !!analyses.drop}
              loading={analyzingMode === "drop"}
              disabled={analyzingMode !== null}
              onClick={() => handleAnalyze("drop")}
            />
          </div>
        </section>
      )}

      {refreshError && (
        <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
          {refreshError}
        </p>
      )}

      {/* Summary */}
      {!snapshot ? (
        <div className="bg-card rounded-2xl p-12 shadow-[var(--shadow-soft)] text-center space-y-3">
          <BarChart3 className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-sm opacity-70">
            Aucune statistique pour l'instant. Cliquez sur « Rafraîchir » pour
            interroger Metricool via votre webhook N8N.
          </p>
        </div>
      ) : (
        <section className="space-y-6">
          {channelSummary.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {channelSummary.map((c) => (
                <article
                  key={c.channel}
                  className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-5 space-y-3"
                >
                  <h3
                    className="text-xl"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {CHANNEL_LABELS[c.channel] ?? c.channel}
                  </h3>
                  <dl className="space-y-1.5 text-sm">
                    {Object.entries(c.metrics)
                      .slice(0, 6)
                      .map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3">
                          <dt className="opacity-65">{k}</dt>
                          <dd className="text-primary font-medium">
                            {typeof v === "number"
                              ? v.toLocaleString("fr-FR")
                              : String(v)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </article>
              ))}
            </div>
          )}

          {topPosts.length > 0 && (
            <article className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-6 space-y-3">
              <h3
                className="text-2xl"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                Mes meilleurs posts
              </h3>
              <ul className="space-y-2">
                {topPosts.map((p: any, i: number) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-3 text-sm rounded-lg bg-popover/60 px-3 py-2"
                  >
                    <span className="flex-1">
                      <span className="opacity-60 mr-2">#{i + 1}</span>
                      {p.title ?? p.text ?? p.caption ?? "(sans titre)"}
                      {p.channel && (
                        <span className="ml-2 text-xs opacity-60">
                          · {CHANNEL_LABELS[p.channel] ?? p.channel}
                        </span>
                      )}
                    </span>
                    {p.engagement != null && (
                      <span className="text-primary font-medium">
                        {p.engagement}
                        {typeof p.engagement === "number" ? "%" : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          )}
        </section>
      )}

      {/* AI analysis */}
      {analyzeError && (
        <p className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
          {analyzeError}
        </p>
      )}

      {analysis && (
        <section className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-7 space-y-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-65">
            <Sparkles className="h-3.5 w-3.5" /> Lecture stratégique
          </div>
          <MarkdownLite text={analysis} />
          <SuggestionsBlock
            text={analysis}
            addedIdeas={addedIdeas}
            onAdd={handleAddIdea}
            onGoToIdeas={() => navigate({ to: "/idees" })}
          />
        </section>
      )}
    </div>
  );
}

function MarkdownLite({ text }: { text: string }) {
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
    if (/^- PISTE:/i.test(l.trim())) return;
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
          Recommandations à transformer en idée
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
                  {s.note && <span className="opacity-75"> — {s.note}</span>}
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
