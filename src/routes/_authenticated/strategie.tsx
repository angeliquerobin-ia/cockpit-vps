import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/strategie")({
  head: () => ({ meta: [{ title: "Stratégie — Cockpit" }] }),
  component: () => (
    <PagePlaceholder
      title="Stratégie"
      kicker="Vision et lignes directrices"
      description="Définissez les piliers, le ton et les axes de votre création de contenu."
    />
  ),
});
