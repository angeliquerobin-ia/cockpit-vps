import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/idees")({
  head: () => ({ meta: [{ title: "Idées — Cockpit" }] }),
  component: () => (
    <PagePlaceholder
      title="Idées"
      kicker="Le terreau"
      description="Capturez et organisez toutes les idées qui nourriront votre contenu."
    />
  ),
});
