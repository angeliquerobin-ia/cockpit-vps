export const CHANNEL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram_coaching: "Instagram",
  // Legacy value kept for backwards compatibility with existing rows; displayed as "Instagram".
  instagram_chroniques_cosmiques: "Instagram",
  podcast: "Podcast",
  substack: "Substack",
};

export const ALL_CHANNELS = [
  "linkedin",
  "instagram_coaching",
  "podcast",
  "substack",
] as const;

export const DEFAULT_CHANNEL_PROMPTS: Record<string, string> = {
  linkedin: "",
  instagram_coaching: `Tu écris des posts Instagram pour une coach qui s'adresse à des femmes entrepreneures. Ton objectif : un post qui arrête le scroll, touche juste, et donne envie d'agir.

Accroche : une première ligne forte qui arrête le défilement (une vérité qui dérange, une question, une déclaration incarnée). Jamais de clickbait creux.

Corps : une idée forte et incarnée, portée par un exemple concret ou une image parlante. Adresse-toi directement à « tu ». Ton chaleureux, élevant, fluide, jamais haché ni en punchlines sèches.

Bascule : offre un changement de perspective ou une autorisation, le déclic qui fait du bien.

Appel à l'action : une invitation douce mais claire et adaptée (commenter, enregistrer, répondre en message privé, aller voir le lien en bio).

Forme : paragraphes courts et aérés, lisibles sur mobile. Émojis sobres et optionnels, seulement s'ils servent. Aucun tiret cadratin.

À éviter : le jargon corporate, le ton donneur de leçon, les phrases hachées. Termine en proposant quelques hashtags pertinents.`,
  podcast: "",
  substack: "",
};
