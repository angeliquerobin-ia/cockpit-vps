export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Cette page n'a pas pu se charger</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 "Poppins", system-ui, -apple-system, sans-serif; background: #f7f3ed; color: #3d2b1f; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; background: #faeee0; border-radius: 1rem; box-shadow: 0 2px 6px rgba(90, 59, 42, 0.05), 0 8px 24px rgba(90, 59, 42, 0.07); }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; color: #5a3b2a; }
      p { color: #9e7e6a; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.625rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #a7421b; color: #faeee0; }
      .secondary { background: #f7f3ed; color: #5a3b2a; border-color: #e9dcc7; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Cette page n'a pas pu se charger</h1>
      <p>Une erreur est survenue de notre côté. Essayez de rafraîchir ou de revenir à l'accueil.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Réessayer</button>
        <a class="secondary" href="/">Accueil</a>
      </div>
    </div>
  </body>
</html>`;
}
