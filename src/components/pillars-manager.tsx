import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";

type Channel =
  | "linkedin"
  | "instagram_coaching"
  | "instagram_chroniques_cosmiques"
  | "podcast"
  | "substack";

type Pillar = {
  id: string;
  name: string;
  description: string;
  color: string;
  channel: Channel;
};

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram_coaching", label: "Instagram coaching" },
  { value: "instagram_chroniques_cosmiques", label: "Instagram Chroniques Cosmiques" },
  { value: "podcast", label: "Podcast" },
  { value: "substack", label: "Substack" },
];

const PRESET_COLORS = [
  "#a7421b",
  "#c97b4b",
  "#d9a566",
  "#8a6f3f",
  "#6b8a5a",
  "#4f6b6b",
  "#7a4a6b",
  "#5a3b2a",
];

function channelLabel(c: Channel) {
  return CHANNELS.find((x) => x.value === c)?.label ?? c;
}

type Draft = {
  id?: string;
  name: string;
  description: string;
  color: string;
  channel: Channel;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  description: "",
  color: PRESET_COLORS[0],
  channel: "linkedin",
};

export function PillarsManager({ userId }: { userId: string }) {
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("content_pillars")
      .select("id,name,description,color,channel")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    setPillars((data ?? []) as Pillar[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function save() {
    if (!draft || !draft.name.trim()) return;
    if (draft.id) {
      await supabase
        .from("content_pillars")
        .update({
          name: draft.name.trim(),
          description: draft.description,
          color: draft.color,
          channel: draft.channel,
        })
        .eq("id", draft.id);
    } else {
      await supabase.from("content_pillars").insert({
        user_id: userId,
        name: draft.name.trim(),
        description: draft.description,
        color: draft.color,
        channel: draft.channel,
      });
    }
    setDraft(null);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce pilier ?")) return;
    await supabase.from("content_pillars").delete().eq("id", id);
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl">Piliers de contenu</h2>
          <p className="text-sm opacity-70 mt-1">
            <em>Les thèmes qui structurent toute votre création.</em>
          </p>
        </div>
        {!draft && (
          <button
            onClick={() => setDraft({ ...EMPTY_DRAFT })}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Nouveau pilier
          </button>
        )}
      </div>

      {draft && (
        <PillarForm
          draft={draft}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={save}
        />
      )}

      {loading ? (
        <p className="text-sm opacity-60">Chargement…</p>
      ) : pillars.length === 0 && !draft ? (
        <div className="bg-card rounded-2xl p-10 shadow-[var(--shadow-soft)] text-center">
          <p className="text-sm opacity-70">
            Aucun pilier pour l'instant. Créez votre premier pilier pour commencer à organiser votre contenu.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pillars.map((p) => (
            <article
              key={p.id}
              className="bg-card rounded-2xl shadow-[var(--shadow-soft)] overflow-hidden group"
            >
              <div className="h-2" style={{ backgroundColor: p.color }} />
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="h-9 w-9 rounded-full shrink-0 shadow-[var(--shadow-soft)]"
                      style={{ backgroundColor: p.color }}
                      aria-hidden
                    />
                    <h3 className="text-xl truncate">{p.name}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setDraft({ ...p })}
                      aria-label="Modifier"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      aria-label="Supprimer"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-foreground/70"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {p.description && (
                  <p className="text-sm opacity-80 leading-relaxed">{p.description}</p>
                )}
                <span
                  className="inline-block text-xs px-3 py-1 rounded-full"
                  style={{ backgroundColor: p.color + "33", color: p.color }}
                >
                  {channelLabel(p.channel)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function PillarForm({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="bg-popover rounded-2xl p-6 shadow-[var(--shadow-soft)] space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="space-y-1.5 block">
          <span className="text-xs uppercase tracking-[0.15em] opacity-70">Nom</span>
          <input
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
            placeholder="ex. Rituels du matin"
            className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="space-y-1.5 block">
          <span className="text-xs uppercase tracking-[0.15em] opacity-70">Canal</span>
          <select
            value={draft.channel}
            onChange={(e) =>
              onChange({ ...draft, channel: e.target.value as Channel })
            }
            className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-1.5 block">
        <span className="text-xs uppercase tracking-[0.15em] opacity-70">Description courte</span>
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          rows={2}
          placeholder="En une phrase, ce que ce pilier raconte…"
          className="w-full rounded-lg bg-background border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </label>

      <div className="space-y-1.5">
        <span className="text-xs uppercase tracking-[0.15em] opacity-70">Couleur</span>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ ...draft, color: c })}
              aria-label={`Couleur ${c}`}
              className={`h-8 w-8 rounded-full transition-transform ${
                draft.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""
              }`}
              style={{ backgroundColor: c, ['--tw-ring-offset-color' as string]: "var(--popover)" }}
            />
          ))}
          <label className="ml-2 inline-flex items-center gap-2 text-xs opacity-70 cursor-pointer">
            <input
              type="color"
              value={draft.color}
              onChange={(e) => onChange({ ...draft, color: e.target.value })}
              className="h-8 w-8 rounded-full border border-border bg-transparent cursor-pointer"
            />
            <span>Personnaliser</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" /> Annuler
        </button>
        <button
          onClick={onSave}
          disabled={!draft.name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Check className="h-4 w-4" />
          {draft.id ? "Enregistrer" : "Créer le pilier"}
        </button>
      </div>
    </div>
  );
}
