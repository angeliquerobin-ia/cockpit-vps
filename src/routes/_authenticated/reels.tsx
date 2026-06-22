import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/page-placeholder";

export const Route = createFileRoute("/_authenticated/reels")({
  head: () => ({ meta: [{ title: "Réels — Cockpit" }] }),
  component: () => (
    <PagePlaceholder
      title="Réels"
      kicker="Le format court"
      description="Concevez et organisez vos contenus vidéo verticaux."
    />
  ),
});
