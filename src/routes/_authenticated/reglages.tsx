import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  DEFAULT_CHANNEL_PROMPTS,
} from "@/lib/channel-prompts";
import {
  Save,
  Sparkles,
  Gauge,
  Radio,
  Webhook,
  BarChart3,
  AlertTriangle,
  Check,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/reglages")({
  head: () => ({ meta: [{ title: "Réglages — Cockpit" }] }),
  component: ReglagesPage,
});

type Plan = "gratuit" | "starter" | "advanced";

type Settings = {
  metricool_plan: Plan;
  active_channels: string[];
  webhook_publish: string;
  webhook_stats: string;
  webhook_competitors: string;
  webhook_competitors_content: string;
  webhook_transcription: string;
  webhook_subtitles: string;
};

const DEFAULT_SETTINGS: Settings = {
  metricool_plan: "gratuit",
  active_channels: [...ALL_CHANNELS],
  webhook_publish: "",
  webhook_stats: "",
  webhook_competitors: "",
  webhook_competitors_content: "",
  webhook_transcription: "",
  webhook_subtitles: "",
};

const PLAN_INFO: Record<Plan, { label: string; limits: string[] }> = {
  gratuit: {
    label: "Gratuit",
    limits: [
      "Réseaux limités",
      "20 publications par mois",
      "Historique de statistiques limité à 3 mois",
    ],
  },
  starter: {
    label: "Starter",
    limits: [
      "Tous les réseaux principaux",
      "Publications illimitées",
      "Historique de statistiques étendu",
    ],
  },
  advanced: {
    label: "Advanced",
    limits: [
      "Tous les réseaux",
      "Publications illimitées",
      "Statistiques avancées et exports",
      "Analyse concurrents",
    ],
  },
};

const FREE_MONTHLY_LIMIT = 20;

const WEBHOOKS: {
  key: keyof Settings;
  label: string;
  helper: string;
}[] = [
  {
    key: "webhook_publish",
    label: "Publication des posts",
    helper: "Reçoit les posts à publier sur les réseaux.",
  },
  {
    key: "webhook_stats",
    label: "Récupération des statistiques",
    helper: "Récupère les statistiques Metricool pour vos tableaux de bord.",
  },
  {
    key: "webhook_competitors",
    label: "Données concurrents",
    helper: "Met à jour la veille concurrentielle.",
  },
  {
    key: "webhook_competitors_content",
    label: "Analyse contenu concurrents",
    helper:
      "Récupère via Firecrawl les publications récentes des concurrents pour l'analyse IA.",
  },
  {
    key: "webhook_transcription",
    label: "Transcription des réels",
    helper: "Transcrit les vidéos importées dans la bibliothèque Réels.",
  },
  {
    key: "webhook_subtitles",
    label: "Incrustation des sous-titres",
    helper: "Génère la version sous-titrée d'un réel.",
  },
];

function ReglagesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [postsThisMonth, setPostsThisMonth] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);

      const [settingsRes, promptsRes, postsRes] = await Promise.all([
        supabase
          .from("user_settings")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("channel_prompts")
          .select("channel,prompt")
          .eq("user_id", userId),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "publie" as any)
          .gte("scheduled_at", start.toISOString()),
      ]);

      if (settingsRes.data) {
        const s = settingsRes.data as any;
        setSettings({
          metricool_plan: s.metricool_plan,
          active_channels: s.active_channels ?? [],
          webhook_publish: s.webhook_publish ?? "",
          webhook_stats: s.webhook_stats ?? "",
          webhook_competitors: s.webhook_competitors ?? "",
          webhook_competitors_content: s.webhook_competitors_content ?? "",
          webhook_transcription: s.webhook_transcription ?? "",
          webhook_subtitles: s.webhook_subtitles ?? "",
        });
      } else {
        // First time : seed row
        await supabase
          .from("user_settings")
          .insert({ user_id: userId } as any);
      }

      const initial: Record<string, string> = {};
      for (const ch of ALL_CHANNELS) {
        const row = (promptsRes.data ?? []).find(
          (r: any) => r.channel === ch,
        );
        initial[ch] = row
          ? (row as any).prompt
          : DEFAULT_CHANNEL_PROMPTS[ch] ?? "";
      }
      setPrompts(initial);
      setPostsThisMonth(postsRes.count ?? 0);
      setLoading(false);
    })();
  }, [userId]);

  const flash = (key: string) =>
    setSavedAt((s) => ({ ...s, [key]: Date.now() }));

  async function saveSettings(patch: Partial<Settings>, key: string) {
    if (!userId) return;
    setSaving(key);
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase
      .from("user_settings")
      .upsert(
        { user_id: userId, ...next } as any,
        { onConflict: "user_id" },
      );
    setSaving(null);
    flash(key);
  }

  async function savePrompt(channel: string) {
    if (!userId) return;
    setSaving(`prompt-${channel}`);
    await supabase.from("channel_prompts").upsert(
      {
        user_id: userId,
        channel: channel as any,
        prompt: prompts[channel] ?? "",
      },
      { onConflict: "user_id,channel" },
    );
    setSaving(null);
    flash(`prompt-${channel}`);
  }

  function toggleChannel(ch: string) {
    const next = settings.active_channels.includes(ch)
      ? settings.active_channels.filter((c) => c !== ch)
      : [...settings.active_channels, ch];
    saveSettings({ active_channels: next }, `channel-${ch}`);
  }

  const planInfo = PLAN_INFO[settings.metricool_plan];

  const counterRatio = useMemo(
    () => Math.min(postsThisMonth / FREE_MONTHLY_LIMIT, 1),
    [postsThisMonth],
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-5xl">Réglages</h1>
        <p className="text-sm opacity-60">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-16">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">
          L'établi
        </p>
        <h1 className="text-5xl">Réglages</h1>
        <p className="text-base opacity-75 max-w-2xl">
          <em>
            Le centre de configuration de l'app : plan, réseaux, voix de
            l'agent, et passerelles N8N.
          </em>
        </p>
      </header>

      {/* 1. Plan Metricool */}
      <Section
        icon={<Gauge className="h-5 w-5 text-primary" />}
        title="Mon plan Metricool"
        subtitle="Le plan choisi adapte les fonctionnalités proposées dans toute l'app."
      >
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex gap-3">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed opacity-85">
            <em>
              Cockpit ne se connecte pas directement à Metricool. La
              publication et la récupération des statistiques passent par vos
              workflows N8N (configurés plus bas). Le plan sélectionné sert à
              adapter ce que Cockpit vous propose — réseaux disponibles, quota
              mensuel, profondeur d'historique.
            </em>
          </p>
        </div>

        <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(PLAN_INFO) as Plan[]).map((p) => {
              const active = settings.metricool_plan === p;
              return (
                <button
                  key={p}
                  onClick={() =>
                    saveSettings({ metricool_plan: p }, "plan")
                  }
                  className={`text-left rounded-xl px-4 py-3 border transition-all ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{PLAN_INFO[p].label}</span>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-xs uppercase tracking-[0.15em] opacity-60 mb-2">
              Ce que comprend ce plan
            </p>
            <ul className="space-y-1.5 text-sm opacity-85">
              {planInfo.limits.map((l) => (
                <li key={l} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>

          {savedAt["plan"] && Date.now() - savedAt["plan"] < 2500 && (
            <p className="text-xs opacity-60">
              <em>Plan enregistré</em>
            </p>
          )}
        </div>

        {/* 5. Compteur — uniquement en plan gratuit */}
        {settings.metricool_plan === "gratuit" && (
          <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-6 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-xl">Publications ce mois</h3>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-3xl">
                {postsThisMonth}
                <span className="text-base opacity-50">
                  {" "}/ {FREE_MONTHLY_LIMIT}
                </span>
              </p>
              {postsThisMonth >= FREE_MONTHLY_LIMIT * 0.8 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {postsThisMonth >= FREE_MONTHLY_LIMIT
                    ? "Limite atteinte"
                    : "Vous approchez de la limite"}
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${
                  postsThisMonth >= FREE_MONTHLY_LIMIT
                    ? "bg-destructive"
                    : postsThisMonth >= FREE_MONTHLY_LIMIT * 0.8
                      ? "bg-destructive/70"
                      : "bg-primary"
                }`}
                style={{ width: `${counterRatio * 100}%` }}
              />
            </div>
            <p className="text-xs opacity-60">
              <em>
                Compteur basé sur les posts marqués comme publiés ce
                mois-ci.
              </em>
            </p>
          </div>
        )}
      </Section>

      {/* 2. Réseaux actifs */}
      <Section
        icon={<Radio className="h-5 w-5 text-primary" />}
        title="Mes réseaux actifs"
        subtitle="Seuls les réseaux actifs apparaissent comme cibles dans le Studio et le Calendrier."
      >
        <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-2">
          <ul className="divide-y divide-border">
            {ALL_CHANNELS.map((ch) => {
              const active = settings.active_channels.includes(ch);
              const flashed =
                savedAt[`channel-${ch}`] &&
                Date.now() - savedAt[`channel-${ch}`] < 2000;
              return (
                <li
                  key={ch}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{CHANNEL_LABELS[ch]}</span>
                    {flashed && (
                      <span className="text-xs opacity-60">
                        <em>Enregistré</em>
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={active}
                    onChange={() => toggleChannel(ch)}
                    disabled={saving === `channel-${ch}`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      {/* 3. Consignes de rédaction */}
      <Section
        icon={<Sparkles className="h-5 w-5 text-primary" />}
        title="Consignes de rédaction (agent IA)"
        subtitle="Chaque canal a sa propre voix : structure, ton, longueur, ce qu'il faut éviter. C'est ici que l'agent prend ses ordres."
      >
        <div className="space-y-5">
          {ALL_CHANNELS.map((channel) => {
            const flashed =
              savedAt[`prompt-${channel}`] &&
              Date.now() - savedAt[`prompt-${channel}`] < 2500;
            return (
              <div
                key={channel}
                className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-5 space-y-3"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className="text-xl">{CHANNEL_LABELS[channel]}</h3>
                  <div className="flex items-center gap-3">
                    {flashed && (
                      <span className="text-xs opacity-60">
                        <em>Enregistré</em>
                      </span>
                    )}
                    <button
                      onClick={() => savePrompt(channel)}
                      disabled={saving === `prompt-${channel}`}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {saving === `prompt-${channel}`
                        ? "…"
                        : "Enregistrer"}
                    </button>
                  </div>
                </div>
                <textarea
                  value={prompts[channel] ?? ""}
                  onChange={(e) =>
                    setPrompts((p) => ({
                      ...p,
                      [channel]: e.target.value,
                    }))
                  }
                  rows={8}
                  placeholder="Décrivez à l'agent comment écrire pour ce canal…"
                  className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>
            );
          })}
        </div>
      </Section>

      {/* 4. Webhooks N8N */}
      <Section
        icon={<Webhook className="h-5 w-5 text-primary" />}
        title="Webhooks N8N"
        subtitle="Les adresses que l'app appelle pour chacun de ses échanges avec N8N."
      >
        <div className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-6 space-y-5">
          {WEBHOOKS.map((w) => {
            const flashed =
              savedAt[`hook-${w.key}`] &&
              Date.now() - savedAt[`hook-${w.key}`] < 2500;
            return (
              <div key={w.key} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <label className="text-sm">
                    {w.label}
                    <span className="block text-xs opacity-60 mt-0.5">
                      <em>{w.helper}</em>
                    </span>
                  </label>
                  {flashed && (
                    <span className="text-xs opacity-60">
                      <em>Enregistré</em>
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://n8n.exemple.com/webhook/…"
                    value={(settings[w.key] as string) ?? ""}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        [w.key]: e.target.value,
                      }))
                    }
                    className="flex-1 rounded-lg bg-background border border-input px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() =>
                      saveSettings(
                        { [w.key]: settings[w.key] } as Partial<Settings>,
                        `hook-${w.key}`,
                      )
                    }
                    disabled={saving === `hook-${w.key}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                  </button>
                </div>
                {w.key === "webhook_stats" && <StatsWebhookHelp />}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function StatsWebhookHelp() {
  const [open, setOpen] = useState(false);
  const exampleOut = `{
  "instagram": {
    "followers": 4820,
    "engagement_rate": 3.2,
    "reach": 18500,
    "top_posts": [
      { "title": "Routine du matin", "engagement": 412, "date": "2026-06-14" }
    ]
  },
  "linkedin": {
    "followers": 1240,
    "engagement_rate": 5.1,
    "reach": 6200,
    "top_posts": []
  }
}`;
  const exampleIn = `{
  "user_id": "uuid de l'utilisateur",
  "channels": ["instagram", "linkedin", "tiktok"]
}`;
  return (
    <div className="mt-2 rounded-xl border border-border/60 bg-background/40 p-4 text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="font-serif text-base text-primary hover:opacity-80 transition-opacity"
        style={{ fontFamily: "'Cormorant Garamond', serif" }}
      >
        {open ? "▾" : "▸"} Comment brancher Metricool via N8N
      </button>
      {open && (
        <div className="mt-3 space-y-3 leading-relaxed opacity-90">
          <p>
            L'app n'appelle <em>pas</em> Metricool directement : elle envoie une
            requête à ton workflow N8N, qui interroge l'API Metricool (avec ton
            token), puis renvoie les chiffres au format attendu.
          </p>
          <div>
            <p className="font-medium mb-1">1. Payload envoyé par l'app (POST JSON) :</p>
            <pre className="rounded-lg bg-card/80 border border-border/50 p-3 text-xs font-mono overflow-x-auto">
{exampleIn}
            </pre>
          </div>
          <div>
            <p className="font-medium mb-1">2. Dans N8N :</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nœud <em>Webhook</em> (méthode POST) → colle son URL ci-dessus.</li>
              <li>Pour chaque canal de <code>channels</code>, appelle l'API Metricool correspondante (compte connecté, métriques, top posts).</li>
              <li>Nœud <em>Respond to Webhook</em> qui renvoie le JSON ci-dessous.</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">3. Format JSON attendu en retour :</p>
            <pre className="rounded-lg bg-card/80 border border-border/50 p-3 text-xs font-mono overflow-x-auto">
{exampleOut}
            </pre>
            <p className="text-xs opacity-70 mt-1">
              Une clé par canal (les mêmes identifiants que tes canaux actifs).
              <code>top_posts</code> est facultatif mais nourrit la section
              « Mes meilleurs posts » de l'analyse IA.
            </p>
          </div>
          <p className="text-xs opacity-70">
            Une fois branché, va dans <em>Statistiques</em> → <em>Rafraîchir</em>{" "}
            pour stocker un premier snapshot, puis <em>Analyser mes performances</em>.
          </p>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-3xl">{title}</h2>
        </div>
        {subtitle && (
          <p className="text-sm opacity-70 max-w-2xl">
            <em>{subtitle}</em>
          </p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
