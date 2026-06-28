import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StrategyEditor } from "@/components/strategy-editor";
import { PillarsManager } from "@/components/pillars-manager";

export const Route = createFileRoute("/_authenticated/strategie")({
  head: () => ({ meta: [{ title: "Stratégie — Cockpit" }] }),
  component: StrategiePage,
});

function StrategiePage() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  return (
    <div className="space-y-14">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">
          Vision et lignes directrices
        </p>
        <h1 className="text-5xl">Stratégie</h1>
        <p className="tagline text-base max-w-2xl">
          Posez votre cap, vos piliers, votre ton. C'est la boussole que toutes les autres pages suivront.
        </p>
      </header>

      <section className="space-y-5">
        <div>
          <h2 className="text-3xl">Ligne éditoriale</h2>
          <p className="tagline text-sm mt-1">
            Votre positionnement, votre audience, votre ton, vos objectifs.
          </p>
        </div>
        {userId ? (
          <StrategyEditor userId={userId} />
        ) : (
          <div className="bg-card rounded-2xl h-72 shadow-[var(--shadow-soft)]" />
        )}
      </section>

      <section>
        {userId && <PillarsManager userId={userId} />}
      </section>
    </div>
  );
}
