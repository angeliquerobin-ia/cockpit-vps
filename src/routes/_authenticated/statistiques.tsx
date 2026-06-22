import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/statistiques")({
  head: () => ({ meta: [{ title: "Statistiques — Cockpit" }] }),
  component: () => (
    <PagePlaceholder
      title="Statistiques"
      kicker="La mesure"
      description="Suivez la performance de vos publications et de vos formats."
    />
  ),
});
