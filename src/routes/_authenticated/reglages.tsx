import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ALL_CHANNELS,
  CHANNEL_LABELS,
  DEFAULT_CHANNEL_PROMPTS,
} from "@/lib/channel-prompts";
import { Save, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reglages")({
  head: () => ({ meta: [{ title: "Réglages — Cockpit" }] }),
  component: ReglagesPage,
});

function ReglagesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("channel_prompts")
        .select("channel,prompt")
        .eq("user_id", userId);
      const initial: Record<string, string> = {};
      for (const ch of ALL_CHANNELS) {
        const row = (data ?? []).find((r: any) => r.channel === ch);
        initial[ch] = row
          ? (row as any).prompt
          : DEFAULT_CHANNEL_PROMPTS[ch] ?? "";
      }
      setPrompts(initial);
    })();
  }, [userId]);

  async function save(channel: string) {
    if (!userId) return;
    setSaving(channel);
    await supabase.from("channel_prompts").upsert(
      {
        user_id: userId,
        channel: channel as any,
        prompt: prompts[channel] ?? "",
      },
      { onConflict: "user_id,channel" },
    );
    setSaving(null);
    setSavedAt((s) => ({ ...s, [channel]: Date.now() }));
  }

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">
          L'établi
        </p>
        <h1 className="text-5xl">Réglages</h1>
        <p className="text-base opacity-75 max-w-2xl">
          <em>
            Ajustez les consignes que votre agent de rédaction suit pour chaque
            canal.
          </em>
        </p>
      </header>

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-3xl">Consignes de rédaction</h2>
        </div>
        <p className="text-sm opacity-70 max-w-2xl">
          <em>
            Chaque canal a sa propre voix. Écrivez ici comment vous voulez que
            l'agent rédige pour ce réseau&nbsp;: structure, ton, longueur, ce
            qu'il doit éviter. La consigne d'Instagram coaching est déjà
            préremplie.
          </em>
        </p>

        <div className="space-y-5">
          {ALL_CHANNELS.map((channel) => (
            <div
              key={channel}
              className="bg-card rounded-2xl shadow-[var(--shadow-soft)] p-5 space-y-3"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-xl">{CHANNEL_LABELS[channel]}</h3>
                <div className="flex items-center gap-3">
                  {savedAt[channel] &&
                    Date.now() - savedAt[channel] < 2500 && (
                      <span className="text-xs opacity-60">
                        <em>Enregistré</em>
                      </span>
                    )}
                  <button
                    onClick={() => save(channel)}
                    disabled={saving === channel}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving === channel ? "…" : "Enregistrer"}
                  </button>
                </div>
              </div>
              <textarea
                value={prompts[channel] ?? ""}
                onChange={(e) =>
                  setPrompts((p) => ({ ...p, [channel]: e.target.value }))
                }
                rows={10}
                placeholder="Décrivez à l'agent comment écrire pour ce canal…"
                className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
