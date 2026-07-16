export type AiFunctionKey = "writer" | "ideas" | "stats" | "competitors";

export const AI_FUNCTION_KEYS: AiFunctionKey[] = [
  "writer",
  "ideas",
  "stats",
  "competitors",
];

export const AI_FUNCTION_LABELS: Record<AiFunctionKey, string> = {
  writer: "Agent de rédaction (posts)",
  ideas: "Génération d'idées",
  stats: "Analyse des statistiques",
  competitors: "Analyse de la veille stratégique",
};

export const AI_FUNCTION_DESCRIPTIONS: Record<AiFunctionKey, string> = {
  writer:
    "Rédaction, réécriture, correction et déclinaison des posts dans le Studio.",
  ideas:
    "Scission d'un braindump en cartes dans l'espace Idées.",
  stats:
    "Lecture et recommandations sur vos statistiques dans l'espace Statistiques.",
  competitors:
    "Comparaison et lecture des contenus de vos concurrents dans Veille stratégique.",
};
