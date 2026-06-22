import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/studio")({
  head: () => ({ meta: [{ title: "Studio de rédaction — Cockpit" }] }),
  component: () => (
    <PagePlaceholder
      title="Studio de rédaction"
      kicker="L'atelier"
      description="Rédigez, peaufinez et mettez en forme vos contenus longs."
    />
  ),
});
