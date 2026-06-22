type Props = {
  title: string;
  kicker?: string;
  description?: string;
};

export function PagePlaceholder({ title, kicker, description }: Props) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        {kicker && (
          <p className="text-xs uppercase tracking-[0.2em] opacity-60">{kicker}</p>
        )}
        <h1 className="text-5xl">{title}</h1>
        {description && (
          <p className="text-base opacity-75 max-w-2xl">
            <em>{description}</em>
          </p>
        )}
      </header>

      <div className="bg-card rounded-2xl p-12 shadow-[var(--shadow-soft)] text-center">
        <p className="text-sm opacity-60">
          Cette section est en cours de préparation. Le contenu sera ajouté lors d'une prochaine étape.
        </p>
      </div>
    </div>
  );
}
