import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/concurrents")({
  head: () => ({ meta: [{ title: "Concurrents — Cockpit" }] }),
  component: () => (
    <PagePlaceholder
      title="Concurrents"
      kicker="Le paysage"
      description="Gardez un œil attentif sur les comptes qui inspirent ou défient."
    />
  ),
});
