import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MomentKind = "lancement" | "cohorte" | "vente" | "evenement" | "autre";

export const MOMENT_KIND_LABELS: Record<MomentKind, string> = {
  lancement: "Lancement",
  cohorte: "Cohorte",
  vente: "Fenêtre de vente",
  evenement: "Événement",
  autre: "Autre",
};

export type BusinessMoment = {
  id: string;
  title: string;
  kind: MomentKind;
  start_date: string;
  end_date: string | null;
  notes: string;
};

export type ArcPhase = {
  id: string;
  arc_id: string;
  name: string;
  anchor: "start" | "end";
  offset_days: number;
  post_count: number;
  intent: string;
  position: number;
};

export type ContentArc = {
  id: string;
  name: string;
  moment_kind: MomentKind;
  description: string;
  phases?: ArcPhase[];
};

// ---------- Moments ----------

export const listMoments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("business_moments" as any)
      .select("*")
      .order("start_date", { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as BusinessMoment[];
  });

export const saveMoment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; title: string; kind: MomentKind; start_date: string; end_date: string | null; notes: string }) => d)
  .handler(async ({ data, context }) => {
    const payload = {
      user_id: context.userId,
      title: data.title,
      kind: data.kind,
      start_date: data.start_date,
      end_date: data.end_date,
      notes: data.notes ?? "",
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("business_moments" as any)
        .update(payload)
        .eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("business_moments" as any)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return { id: (row as any).id as string };
  });

export const deleteMoment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("business_moments" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Arcs ----------

export const listArcs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: arcs, error } = await context.supabase
      .from("content_arcs" as any)
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw error;
    const { data: phases, error: pe } = await context.supabase
      .from("arc_phases" as any)
      .select("*")
      .order("position", { ascending: true });
    if (pe) throw pe;
    const byArc: Record<string, ArcPhase[]> = {};
    for (const p of (phases ?? []) as any[]) {
      (byArc[p.arc_id] ??= []).push(p as ArcPhase);
    }
    return ((arcs ?? []) as any[]).map((a) => ({ ...(a as ContentArc), phases: byArc[a.id] ?? [] }));
  });

export const saveArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id?: string;
      name: string;
      moment_kind: MomentKind;
      description: string;
      phases: Array<{
        name: string;
        anchor: "start" | "end";
        offset_days: number;
        post_count: number;
        intent: string;
      }>;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    let arcId = data.id;
    const base = {
      user_id: context.userId,
      name: data.name,
      moment_kind: data.moment_kind,
      description: data.description ?? "",
    };
    if (arcId) {
      const { error } = await context.supabase.from("content_arcs" as any).update(base).eq("id", arcId);
      if (error) throw error;
      await context.supabase.from("arc_phases" as any).delete().eq("arc_id", arcId);
    } else {
      const { data: row, error } = await context.supabase
        .from("content_arcs" as any)
        .insert(base)
        .select("id")
        .single();
      if (error) throw error;
      arcId = (row as any).id as string;
    }
    if (data.phases.length > 0) {
      const rows = data.phases.map((p, i) => ({
        arc_id: arcId!,
        user_id: context.userId,
        name: p.name,
        anchor: p.anchor,
        offset_days: p.offset_days,
        post_count: Math.max(1, p.post_count),
        intent: p.intent ?? "",
        position: i,
      }));
      const { error } = await context.supabase.from("arc_phases" as any).insert(rows);
      if (error) throw error;
    }
    return { id: arcId! };
  });

export const deleteArc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("content_arcs" as any).delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Rétroplanning ----------

export type PlanItem = {
  phase_name: string;
  intent: string;
  scheduled_at: string; // ISO
  index_in_phase: number; // 1-based
  total_in_phase: number;
};

function computePlan(moment: BusinessMoment, phases: ArcPhase[]): PlanItem[] {
  const start = new Date(moment.start_date + "T09:00:00");
  const end = moment.end_date ? new Date(moment.end_date + "T09:00:00") : start;
  const items: PlanItem[] = [];
  const sorted = [...phases].sort((a, b) => a.position - b.position);
  for (const p of sorted) {
    const anchor = p.anchor === "end" ? end : start;
    const base = new Date(anchor);
    base.setDate(base.getDate() + p.offset_days);
    const n = Math.max(1, p.post_count);
    for (let i = 0; i < n; i++) {
      const d = new Date(base);
      // Spread multiple posts of same phase over consecutive days
      d.setDate(d.getDate() + i);
      items.push({
        phase_name: p.name,
        intent: p.intent,
        scheduled_at: d.toISOString(),
        index_in_phase: i + 1,
        total_in_phase: n,
      });
    }
  }
  return items.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

export const previewPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { moment_id: string; arc_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: m, error: me } = await context.supabase
      .from("business_moments" as any)
      .select("*")
      .eq("id", data.moment_id)
      .single();
    if (me) throw me;
    const { data: ph, error: pe } = await context.supabase
      .from("arc_phases" as any)
      .select("*")
      .eq("arc_id", data.arc_id)
      .order("position", { ascending: true });
    if (pe) throw pe;
    const { data: existing } = await context.supabase
      .from("posts")
      .select("phase_name")
      .eq("moment_id", data.moment_id)
      .is("deleted_at", null);
    const existingByPhase: Record<string, number> = {};
    for (const p of (existing ?? []) as any[]) {
      if (p.phase_name) existingByPhase[p.phase_name] = (existingByPhase[p.phase_name] ?? 0) + 1;
    }
    const plan = computePlan(m as unknown as BusinessMoment, (ph ?? []) as unknown as ArcPhase[]);
    return { plan, existingByPhase };
  });

export const applyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { moment_id: string; arc_id: string; only_missing: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { data: m, error: me } = await context.supabase
      .from("business_moments" as any)
      .select("*")
      .eq("id", data.moment_id)
      .single();
    if (me) throw me;
    const { data: ph, error: pe } = await context.supabase
      .from("arc_phases" as any)
      .select("*")
      .eq("arc_id", data.arc_id)
      .order("position", { ascending: true });
    if (pe) throw pe;
    const plan = computePlan(m as unknown as BusinessMoment, (ph ?? []) as unknown as ArcPhase[]);

    let toCreate = plan;
    if (data.only_missing) {
      const { data: existing } = await context.supabase
        .from("posts")
        .select("phase_name")
        .eq("moment_id", data.moment_id)
        .is("deleted_at", null);
      const counts: Record<string, number> = {};
      for (const p of (existing ?? []) as any[]) {
        if (p.phase_name) counts[p.phase_name] = (counts[p.phase_name] ?? 0) + 1;
      }
      const remaining: PlanItem[] = [];
      const consumed: Record<string, number> = { ...counts };
      for (const item of plan) {
        const c = consumed[item.phase_name] ?? 0;
        if (c > 0) {
          consumed[item.phase_name] = c - 1;
        } else {
          remaining.push(item);
        }
      }
      toCreate = remaining;
    }

    if (toCreate.length === 0) return { created: 0 };

    const moment = m as unknown as BusinessMoment;
    const rows = toCreate.map((item) => ({
      user_id: context.userId,
      title: `${moment.title} — ${item.phase_name}${item.total_in_phase > 1 ? ` (${item.index_in_phase}/${item.total_in_phase})` : ""}`,
      content: "",
      status: "en_redaction" as const,
      scheduled_at: item.scheduled_at,
      moment_id: data.moment_id,
      phase_name: item.phase_name,
    }));
    // Store intent as initial note in content field so it's visible in Studio
    for (let i = 0; i < rows.length; i++) {
      const intent = toCreate[i].intent;
      if (intent) (rows[i] as any).content = `Intention : ${intent}`;
    }
    const { error } = await context.supabase.from("posts").insert(rows as any);
    if (error) throw error;
    return { created: rows.length };
  });
