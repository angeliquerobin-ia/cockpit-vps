import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  AI_FUNCTION_KEYS,
  type AiFunctionKey,
} from "./ai-router.shared";

export type AiProvider = {
  id: string;
  name: string;
  endpoint: string;
  models: string[];
  has_key: boolean;
  created_at: string;
};

export type AiRoute = {
  function_key: AiFunctionKey;
  provider_id: string;
  model: string;
};

export const listAiProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiProvider[]> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin
      .from("ai_providers" as any)
      .select("id, name, endpoint, models, api_key, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      name: r.name,
      endpoint: r.endpoint,
      models: (r.models as string[]) ?? [],
      has_key: Boolean(r.api_key && String(r.api_key).length > 0),
      created_at: r.created_at,
    }));
  });

const UpsertProviderSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(80),
  endpoint: z.string().trim().url().max(300),
  api_key: z.string().trim().max(500).optional().default(""),
  models: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
});

export const upsertAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertProviderSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const models = Array.from(new Set(data.models.map((m) => m.trim()).filter(Boolean)));

    if (data.id) {
      const patch: any = {
        name: data.name,
        endpoint: data.endpoint,
        models,
      };
      if (data.api_key && data.api_key.length > 0) patch.api_key = data.api_key;
      const { error } = await supabaseAdmin
        .from("ai_providers" as any)
        .update(patch)
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    if (!data.api_key || data.api_key.length === 0) {
      throw new Error("Une clé API est requise pour créer un fournisseur.");
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("ai_providers" as any)
      .insert({
        user_id: context.userId,
        name: data.name,
        endpoint: data.endpoint,
        api_key: data.api_key,
        models,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as any).id };
  });

export const deleteAiProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { error } = await supabaseAdmin
      .from("ai_providers" as any)
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAiRoutes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiRoute[]> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin
      .from("ai_function_routes" as any)
      .select("function_key, provider_id, model")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[])
      .filter((r) => AI_FUNCTION_KEYS.includes(r.function_key))
      .map((r) => ({
        function_key: r.function_key as AiFunctionKey,
        provider_id: r.provider_id,
        model: r.model,
      }));
  });

const SetRouteSchema = z.object({
  function_key: z.enum(AI_FUNCTION_KEYS as [AiFunctionKey, ...AiFunctionKey[]]),
  provider_id: z.string().uuid().nullable(),
  model: z.string().trim().max(120).nullable(),
});

export const setAiRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SetRouteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    if (!data.provider_id || !data.model) {
      const { error } = await supabaseAdmin
        .from("ai_function_routes" as any)
        .delete()
        .eq("user_id", context.userId)
        .eq("function_key", data.function_key);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await supabaseAdmin
      .from("ai_function_routes" as any)
      .upsert(
        {
          user_id: context.userId,
          function_key: data.function_key,
          provider_id: data.provider_id,
          model: data.model,
        },
        { onConflict: "user_id,function_key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
