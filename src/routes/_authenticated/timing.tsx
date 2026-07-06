import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  CalendarClock,
  Sparkles,
  Loader2,
  X,
  Check,
  Wand2,
  FileDown,
} from "lucide-react";
import {
  listMoments,
  saveMoment,
  deleteMoment,
  listArcs,
  saveArc,
  previewPlan,
  applyPlan,
  MOMENT_KIND_LABELS,
  type BusinessMoment,
  type ContentArc,
  type MomentKind,
  type ArcPhase,
  type PlanItem,
} from "@/lib/timing.functions";

export const Route = createFileRoute("/_authenticated/timing")({
  head: () => ({ meta: [{ title: "Timing Business — Cockpit" }] }),
  component: TimingPage,
});

const KINDS: MomentKind[] = ["lancement", "cohorte", "vente", "evenement", "autre"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

const DEFAULT_LAUNCH_ARC = {
  name: "Lancement classique",
  moment_kind: "lancement" as MomentKind,
  description: "Un arc de référence pour un lancement : semer, teaser, ouvrir, urgence, clôture.",
  phases: [
    {
      name: "Semer",
      anchor: "start" as const,
      offset_days: -21,
      post_count: 3,
      intent: "Poser le contexte, ouvrir le sujet, réveiller le besoin sans rien vendre.",
    },
    {
      name: "Teaser",
      anchor: "start" as const,
      offset_days: -7,
      post_count: 3,
      intent: "Annoncer l'arrivée de l'offre, créer l'attente, donner les grandes lignes.",
    },
    {
      name: "Ouverture",
      anchor: "start" as const,
      offset_days: 0,
      post_count: 2,
      intent: "Ouvrir les inscriptions, expliquer clairement l'offre, appeler à agir.",
    },
    {
      name: "Urgence",
      anchor: "end" as const,
      offset_days: -2,
      post_count: 2,
      intent: "Rappeler la deadline, lever les dernières objections, montrer les preuves.",
    },
    {
      name: "Clôture",
      anchor: "end" as const,
      offset_days: 0,
      post_count: 1,
      intent: "Dernier appel, ton direct, focus sur la décision.",
    },
  ],
};

function TimingPage() {
  const fnListMoments = useServerFn(listMoments);
  const fnSaveMoment = useServerFn(saveMoment);
  const fnDeleteMoment = useServerFn(deleteMoment);
  const fnListArcs = useServerFn(listArcs);
  const fnSaveArc = useServerFn(saveArc);
  const fnPreview = useServerFn(previewPlan);
  const fnApply = useServerFn(applyPlan);

  const [moments, setMoments] = useState<BusinessMoment[]>([]);
  const [arcs, setArcs] = useState<ContentArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [momentDraft, setMomentDraft] = useState<Partial<BusinessMoment> | null>(null);
  const [planFor, setPlanFor] = useState<BusinessMoment | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const [m, a] = await Promise.all([fnListMoments(), fnListArcs()]);
      setMoments(m);
      setArcs(a);
      // Seed default arc if empty
      if (a.length === 0) {
        await fnSaveArc({ data: DEFAULT_LAUNCH_ARC });
        const a2 = await fnListArcs();
        setArcs(a2);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Le chargement a échoué.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-10 print:space-y-6">
      <header className="space-y-2 print:hidden">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">Le tempo</p>
        <h1 className="text-5xl">Timing Business</h1>
        <p className="tagline max-w-2xl">
          Vos temps forts (lancements, cohortes, fenêtres de vente) et le rétroplanning de contenu
          qui prépare le terrain.
        </p>
      </header>

      <TimingPrintSheet moments={moments} />

      {loading ? (
        <div className="flex items-center gap-2 opacity-60 text-sm print:hidden">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
        </div>
      ) : loadError ? (
        <div className="bg-card rounded-2xl p-8 text-center space-y-3 shadow-[var(--shadow-soft)]">
          <p className="text-sm opacity-70">
            Le chargement a échoué. Reconnectez-vous si le problème persiste.
          </p>
          <button
            onClick={reload}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <MomentsList
          moments={moments}
          arcs={arcs}
          onNew={() =>
            setMomentDraft({
              title: "",
              kind: "lancement",
              start_date: new Date().toISOString().slice(0, 10),
              end_date: null,
              notes: "",
            })
          }
          onEdit={(m) => setMomentDraft(m)}
          onDelete={async (id) => {
            if (!confirm("Supprimer ce temps fort ?")) return;
            await fnDeleteMoment({ data: { id } });
            reload();
          }}
          onPlan={(m) => setPlanFor(m)}
        />
      )}

      {momentDraft && (
        <MomentDialog
          draft={momentDraft}
          onCancel={() => setMomentDraft(null)}
          onSave={async (d) => {
            await fnSaveMoment({ data: d });
            setMomentDraft(null);
            reload();
          }}
        />
      )}

      {planFor && (
        <PlanDialog
          moment={planFor}
          arcs={
            arcs.filter((a) => a.moment_kind === planFor.kind).length > 0
              ? arcs.filter((a) => a.moment_kind === planFor.kind)
              : arcs
          }
          allArcs={arcs}
          onClose={() => setPlanFor(null)}
          onPreview={(arcId) => fnPreview({ data: { moment_id: planFor.id, arc_id: arcId } })}
          onApply={(arcId, onlyMissing) =>
            fnApply({ data: { moment_id: planFor.id, arc_id: arcId, only_missing: onlyMissing } })
          }
        />
      )}
    </div>
  );
}

// ------------------ Feuille imprimable (export PDF) ------------------

function TimingPrintSheet({ moments }: { moments: BusinessMoment[] }) {
  const sorted = [...moments].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const years = [...new Set(sorted.map((m) => m.start_date.slice(0, 4)))];
  return (
    <section className="hidden print:block text-[#3d2b1f]">
      <header className="mb-8 border-b border-[#e9dcc7] pb-4">
        <h1 className="text-4xl">Timing Business</h1>
        <p className="text-sm mt-1 opacity-70">
          {years.join(" · ")} — exporté le{" "}
          {new Date().toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>
      {sorted.length === 0 ? (
        <p className="text-sm opacity-70">Aucun temps fort déclaré.</p>
      ) : (
        <div className="space-y-6">
          {sorted.map((m) => (
            <article key={m.id} className="break-inside-avoid border-b border-[#e9dcc7] pb-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-2xl">{m.title}</h2>
                <span className="text-xs uppercase tracking-widest opacity-60 shrink-0">
                  {MOMENT_KIND_LABELS[m.kind]}
                </span>
              </div>
              <p className="text-sm mt-1">
                {fmtDate(m.start_date)}
                {m.end_date && ` → ${fmtDate(m.end_date)}`}
              </p>
              {m.notes && <p className="text-sm mt-2 opacity-80 whitespace-pre-wrap">{m.notes}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

// ------------------ Moments list ------------------

function MomentsList({
  moments,
  arcs,
  onNew,
  onEdit,
  onDelete,
  onPlan,
}: {
  moments: BusinessMoment[];
  arcs: ContentArc[];
  onNew: () => void;
  onEdit: (m: BusinessMoment) => void;
  onDelete: (id: string) => void;
  onPlan: (m: BusinessMoment) => void;
}) {
  return (
    <section className="space-y-4 print:hidden">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-3xl">Vos temps forts</h2>
        <div className="flex items-center gap-2">
          {moments.length > 0 && (
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm hover:bg-muted"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Exporter en PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
          )}
          <button
            onClick={onNew}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nouveau temps fort
          </button>
        </div>
      </div>

      {moments.length === 0 ? (
        <div className="bg-card rounded-2xl p-10 text-center space-y-2 shadow-[var(--shadow-soft)]">
          <CalendarClock className="h-8 w-8 mx-auto opacity-40" />
          <p className="text-sm opacity-70">
            Aucun temps fort pour l'instant. Commencez par déclarer un lancement, une cohorte ou une
            fenêtre de vente.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {moments.map((m) => {
            return (
              <article
                key={m.id}
                className="bg-card rounded-2xl p-6 shadow-[var(--shadow-soft)] flex flex-col sm:flex-row sm:items-start gap-4"
              >
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-2xl">{m.title}</h3>
                    <span className="text-xs uppercase tracking-widest opacity-60 border border-border rounded-full px-2 py-0.5">
                      {MOMENT_KIND_LABELS[m.kind]}
                    </span>
                  </div>
                  <p className="text-sm opacity-75">
                    {fmtDate(m.start_date)}
                    {m.end_date && ` → ${fmtDate(m.end_date)}`}
                  </p>
                  {m.notes && <p className="text-sm opacity-70 whitespace-pre-wrap">{m.notes}</p>}
                </div>
                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => onPlan(m)}
                    disabled={arcs.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2 text-sm hover:opacity-90 disabled:opacity-40"
                  >
                    <Wand2 className="h-4 w-4" /> Générer le rétroplanning
                  </button>
                  <button
                    onClick={() => onEdit(m)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted"
                  >
                    <Pencil className="h-4 w-4" /> Modifier
                  </button>
                  <button
                    onClick={() => onDelete(m.id)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ------------------ Moment dialog ------------------

function MomentDialog({
  draft,
  onCancel,
  onSave,
}: {
  draft: Partial<BusinessMoment>;
  onCancel: () => void;
  onSave: (d: {
    id?: string;
    title: string;
    kind: MomentKind;
    start_date: string;
    end_date: string | null;
    notes: string;
  }) => void;
}) {
  const [title, setTitle] = useState(draft.title ?? "");
  const [kind, setKind] = useState<MomentKind>((draft.kind as MomentKind) ?? "lancement");
  const [start, setStart] = useState(draft.start_date ?? "");
  const [end, setEnd] = useState(draft.end_date ?? "");
  const [notes, setNotes] = useState(draft.notes ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <Modal onClose={onCancel} title={draft.id ? "Modifier le temps fort" : "Nouveau temps fort"}>
      <div className="space-y-4">
        <Field label="Titre">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Type">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MomentKind)}
            className={inputCls}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {MOMENT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date de début">
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Date de fin (facultatif)">
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            Annuler
          </button>
          <button
            disabled={!title || !start || saving}
            onClick={async () => {
              setSaving(true);
              await onSave({
                id: draft.id,
                title,
                kind,
                start_date: start,
                end_date: end || null,
                notes,
              });
              setSaving(false);
            }}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------ Plan dialog ------------------

function PlanDialog({
  moment,
  arcs,
  allArcs,
  onClose,
  onPreview,
  onApply,
}: {
  moment: BusinessMoment;
  arcs: ContentArc[];
  allArcs: ContentArc[];
  onClose: () => void;
  onPreview: (
    arcId: string,
  ) => Promise<{ plan: PlanItem[]; existingByPhase: Record<string, number> }>;
  onApply: (arcId: string, onlyMissing: boolean) => Promise<{ created: number }>;
}) {
  const [arcId, setArcId] = useState<string>(arcs[0]?.id ?? "");
  const [preview, setPreview] = useState<{
    plan: PlanItem[];
    existingByPhase: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const hasExisting = useMemo(
    () => preview && Object.values(preview.existingByPhase).some((v) => v > 0),
    [preview],
  );
  const [onlyMissing, setOnlyMissing] = useState(true);

  async function loadPreview(id: string) {
    if (!id) return;
    setLoading(true);
    setDone(null);
    try {
      const r = await onPreview(id);
      setPreview(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (arcId) loadPreview(arcId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arcId]);

  return (
    <Modal onClose={onClose} title={`Rétroplanning — ${moment.title}`} wide>
      <div className="space-y-5">
        <Field label="Arc de contenu">
          {arcs.length === 0 ? (
            <p className="text-sm opacity-70 rounded-lg border border-border bg-popover/60 px-3 py-2">
              Aucun arc pour un type « {MOMENT_KIND_LABELS[moment.kind]} ».
              {allArcs.length > 0 && " Créez-en un ou changez le type du temps fort."}
            </p>
          ) : (
            <select value={arcId} onChange={(e) => setArcId(e.target.value)} className={inputCls}>
              {arcs.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </Field>

        {loading && (
          <p className="text-sm opacity-70 inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Calcul du rétroplanning…
          </p>
        )}

        {preview && !loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-65">
              <Sparkles className="h-3.5 w-3.5" /> Aperçu ({preview.plan.length} contenus)
            </div>
            <ol className="max-h-72 overflow-auto rounded-xl border border-border divide-y divide-border/60">
              {preview.plan.map((it, i) => (
                <li key={i} className="px-4 py-2.5 text-sm flex items-baseline gap-3">
                  <span className="w-28 shrink-0 opacity-60 text-xs">
                    {fmtDateTime(it.scheduled_at)}
                  </span>
                  <span className="text-primary font-medium w-28 shrink-0">{it.phase_name}</span>
                  <span className="opacity-75 flex-1 truncate">{it.intent || "—"}</span>
                  {it.total_in_phase > 1 && (
                    <span className="text-xs opacity-50">
                      {it.index_in_phase}/{it.total_in_phase}
                    </span>
                  )}
                </li>
              ))}
              {preview.plan.length === 0 && (
                <li className="px-4 py-3 text-sm opacity-60">Cet arc n'a aucune phase.</li>
              )}
            </ol>

            {hasExisting && (
              <label className="flex items-start gap-2 text-sm rounded-xl bg-popover/60 px-3 py-2">
                <input
                  type="checkbox"
                  checked={onlyMissing}
                  onChange={(e) => setOnlyMissing(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  Ce temps fort contient déjà des posts. Ne créer que <strong>ce qui manque</strong>{" "}
                  et ne pas écraser l'existant.
                </span>
              </label>
            )}

            {done !== null && (
              <p className="text-sm text-primary inline-flex items-center gap-2">
                <Check className="h-4 w-4" /> {done} post{done > 1 ? "s" : ""} créé
                {done > 1 ? "s" : ""} en brouillon dans le Studio & le Calendrier.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            Fermer
          </button>
          <button
            disabled={!preview || preview.plan.length === 0 || applying || arcs.length === 0}
            onClick={async () => {
              setApplying(true);
              try {
                const r = await onApply(arcId, onlyMissing);
                setDone(r.created);
                await loadPreview(arcId);
              } finally {
                setApplying(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          >
            {applying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Créer les brouillons
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------ Shared UI ------------------

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs uppercase tracking-widest opacity-65">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm">
      <div
        className={`bg-card rounded-2xl shadow-xl w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[90vh] overflow-auto`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <h3 className="text-2xl">{title}</h3>
          <button onClick={onClose} className="p-2 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
