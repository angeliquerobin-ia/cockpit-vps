import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/calendrier")({
  head: () => ({ meta: [{ title: "Calendrier — Cockpit" }] }),
  component: () => (
    <PagePlaceholder
      title="Calendrier"
      kicker="Le rythme"
      description="Planifiez vos publications et gardez une vue d'ensemble du mois."
    />
  ),
});
