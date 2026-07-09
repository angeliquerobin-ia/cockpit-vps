import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Send, X, Loader2, AlertTriangle, Sparkles, CheckCircle2, CalendarClock } from "lucide-react";
import { CHANNEL_LABELS, ALL_CHANNELS } from "@/lib/channel-prompts";
import { publishPostViaN8n } from "@/lib/publish.functions";

const FREE_LIMIT = 20;

type PublishablePost = {
  id: string;
  title: string;
  channel: string | null;
  scheduled_at: string | null;
};

type Timing = "now" | "schedule" | "auto";

type Settings = {
  metricool_plan: "gratuit" | "starter" | "advanced";
  active_channels: string[];
  webhook_publish: string;
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PublishDialog({
  post,
  userId,
  onClose,
  onPublished,
}: {
  post: PublishablePost;
  userId: string;
  onClose: () => void;
  onPublished: (result: {
    status: "publie" | "programme";
    scheduled_at: string | null;
    metricool_id: string | null;
  }) => void;
}) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [monthCount, setMonthCount] = useState<number>(0);
  const [loadingCtx, setLoadingCtx] = useState(true);

  const [timing, setTiming] = useState<Timing>(post.scheduled_at ? "schedule" : "now");
  const [scheduledAt, setScheduledAt] = useState<string>(
    post.scheduled_at
      ? toLocalInput(post.scheduled_at)
      : toLocalInput(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
  );
  const [channel, setChannel] = useState<string>(post.channel ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    status: "publie" | "programme";
    scheduled_at: string | null;
    metricool_id: string | null;
  } | null>(null);

  const publish = useServerFn(publishPostViaN8n);

  useEffect(() => {
    (async () => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const [sRes, cRes] = await Promise.all([
        supabase
          .from("user_settings")
          .select("metricool_plan,active_channels,webhook_publish")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("posts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "publie" as any)
          .gte("published_at", start.toISOString()),
      ]);
      const s = (sRes.data ?? {
        metricool_plan: "gratuit",
        active_channels: [...ALL_CHANNELS],
        webhook_publish: "",
      }) as any;
      setSettings({
        metricool_plan: s.metricool_plan,
        active_channels: s.active_channels ?? [],
        webhook_publish: s.webhook_publish ?? "",
      });
      setMonthCount(cRes.count ?? 0);
      // Si le canal du post n'est pas actif, propose le 1er canal actif
      if (post.channel && !(s.active_channels ?? []).includes(post.channel)) {
        setChannel((s.active_channels ?? [])[0] ?? "");
      } else if (!post.channel) {
        setChannel((s.active_channels ?? [])[0] ?? "");
      }
      setLoadingCtx(false);
    })();
  }, [userId, post.channel]);

  const isFree = settings?.metricool_plan === "gratuit";
  const wouldExceed = isFree && monthCount >= FREE_LIMIT;
  const isNearLimit =
    isFree && !wouldExceed && monthCount >= Math.ceil(FREE_LIMIT * 0.8);
  const noWebhook = settings ? !settings.webhook_publish.trim() : false;
  const noActiveChannels = settings
    ? settings.active_channels.length === 0
    : false;
  const canSubmit =
    !busy &&
    !loadingCtx &&
    !wouldExceed &&
    !noWebhook &&
    !noActiveChannels &&
    !!channel &&
    (timing !== "schedule" || !!scheduledAt);

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      const result = await publish({
        data: {
          postId: post.id,
          channel,
          timing,
          scheduledAt:
            timing === "schedule"
              ? new Date(scheduledAt).toISOString()
              : undefined,
        },
      });
      setDone({
        status: result.status as "publie" | "programme",
        scheduled_at: result.scheduled_at,
        metricool_id: result.metricool_id,
      });
    } catch (e: any) {
      setError(e?.message ?? "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl shadow-[var(--shadow-soft)] max-w-md w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <SuccessScreen
            result={done}
            channel={channel}
            onClose={() => onPublished(done)}
          />
        ) : (
        <>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            <h3 className="text-2xl">Publier ou programmer</h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs opacity-60">
          <em>
            La demande passe par votre workflow N8N, qui dialogue avec
            Metricool.
          </em>
        </p>

        {loadingCtx ? (
          <p className="text-sm opacity-60">Chargement…</p>
        ) : (
          <>
            {noWebhook && (
              <Callout tone="warn">
                Aucun webhook N8N de publication n'est enregistré.{" "}
                <em>Ajoutez-le dans la page Réglages.</em>
              </Callout>
            )}

            {noActiveChannels && (
              <Callout tone="warn">
                Aucun réseau n'est marqué comme actif dans vos Réglages.
              </Callout>
            )}

            {wouldExceed && (
              <Callout tone="error">
                Vous avez atteint la limite du plan gratuit&nbsp;:{" "}
                {FREE_LIMIT} publications ce mois. Passez à Starter ou
                Advanced pour continuer.
              </Callout>
            )}

            {!wouldExceed && isNearLimit && (
              <Callout tone="warn">
                <span>
                  Vous approchez de la limite du plan gratuit&nbsp;:{" "}
                  <strong>
                    {monthCount}/{FREE_LIMIT}
                  </strong>{" "}
                  publications ce mois.
                </span>
              </Callout>
            )}

            {/* Réseau */}
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-[0.15em] opacity-70">
                Réseau
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— Choisir —</option>
                {(settings?.active_channels ?? []).map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
              {post.channel &&
                !(settings?.active_channels ?? []).includes(post.channel) && (
                  <p className="text-[11px] opacity-60">
                    <em>
                      Le canal d'origine ({CHANNEL_LABELS[post.channel] ??
                        post.channel}) n'est pas actif. Activez-le dans les
                      Réglages pour le proposer ici.
                    </em>
                  </p>
                )}
            </div>

            {/* Moment */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.15em] opacity-70">
                Moment
              </label>
              <div className="grid grid-cols-1 gap-2">
                <TimingChoice
                  active={timing === "now"}
                  onClick={() => setTiming("now")}
                  label="Publier maintenant"
                  helper="Envoie tout de suite à Metricool."
                />
                <TimingChoice
                  active={timing === "schedule"}
                  onClick={() => setTiming("schedule")}
                  label="Programmer"
                  helper="Choisissez une date et une heure précises."
                />
                {timing === "schedule" && (
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
                <TimingChoice
                  active={timing === "auto"}
                  onClick={() => setTiming("auto")}
                  icon={<Sparkles className="h-3.5 w-3.5" />}
                  label="Laisser Metricool choisir"
                  helper="Metricool place ce post au meilleur créneau."
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={onClose}
                disabled={busy}
                className="rounded-lg px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Envoi en
                    cours…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {timing === "now"
                      ? "Publier"
                      : timing === "schedule"
                        ? "Programmer"
                        : "Envoyer à Metricool"}
                  </>
                )}
              </button>
            </div>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}

function SuccessScreen({
  result,
  channel,
  onClose,
}: {
  result: {
    status: "publie" | "programme";
    scheduled_at: string | null;
    metricool_id: string | null;
  };
  channel: string;
  onClose: () => void;
}) {
  const isScheduled = result.status === "programme";
  const channelLabel = CHANNEL_LABELS[channel] ?? channel;
  const whenText =
    isScheduled && result.scheduled_at
      ? new Date(result.scheduled_at).toLocaleString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="text-center py-4 space-y-5">
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          {isScheduled ? (
            <CalendarClock className="h-8 w-8 text-primary" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-primary" />
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-2xl">
          {isScheduled ? "Post programmé !" : "Post envoyé !"}
        </h3>
        <p className="text-sm opacity-70">
          {isScheduled ? (
            <>
              Votre post partira sur <strong>{channelLabel}</strong>
              {whenText ? (
                <>
                  {" "}
                  le <strong>{whenText}</strong>
                </>
              ) : null}
              .
            </>
          ) : (
            <>
              Votre post a été envoyé à Metricool pour{" "}
              <strong>{channelLabel}</strong>.
            </>
          )}
        </p>
      </div>

      {result.metricool_id && (
        <p className="text-[11px] opacity-50">
          <em>Référence Metricool : {result.metricool_id}</em>
        </p>
      )}

      <button
        onClick={onClose}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm hover:opacity-90 transition-opacity"
      >
        Terminé
      </button>
    </div>
  );
}

function TimingChoice({
  active,
  onClick,
  label,
  helper,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  helper: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl px-3 py-2.5 border transition-all ${
        active
          ? "border-primary bg-primary/10"
          : "border-border hover:bg-muted"
      }`}
    >
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-[11px] opacity-65 mt-0.5">
        <em>{helper}</em>
      </p>
    </button>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: "warn" | "error";
  children: React.ReactNode;
}) {
  const isError = tone === "error";
  return (
    <div
      className={`rounded-xl px-3 py-2.5 text-xs flex gap-2 ${
        isError
          ? "bg-destructive/10 text-destructive border border-destructive/30"
          : "bg-primary/10 text-foreground border border-primary/30"
      }`}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  );
}
