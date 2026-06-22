import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/reglages")({
  head: () => ({ meta: [{ title: "Réglages — Cockpit" }] }),
  component: () => (
    <PagePlaceholder
      title="Réglages"
      kicker="L'établi"
      description="Ajustez les préférences de votre cockpit."
    />
  ),
});
