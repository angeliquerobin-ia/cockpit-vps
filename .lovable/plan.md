# Clarifier la relation Cockpit ↔ Metricool

## Décision

Pas de connexion directe à Metricool. Cockpit dialogue avec Metricool **via vos workflows N8N** (déjà prévus dans la section Webhooks de Réglages). C'est N8N qui détient les identifiants Metricool ; Cockpit n'a donc rien à stocker côté API ni de compte à créer maintenant.

Le sélecteur de plan reste utile : il dit à l'app *quelles limites respecter* (réseaux disponibles, quota mensuel, profondeur d'historique), même si la publication réelle se fait ailleurs.

## Ce que je vais ajouter

Trois petites touches dans la page Réglages, sans changer l'architecture :

1. **Encart explicatif** en haut de la section *Mon plan Metricool* :
   > « Cockpit ne se connecte pas directement à Metricool. La publication et la récupération des statistiques passent par vos workflows N8N (configurés plus bas). Le plan sélectionné sert à adapter ce que Cockpit vous propose. »

2. **Indicateur d'état** discret à côté de chaque webhook : un petit point vert si l'URL est renseignée, gris sinon, avec la mention *« Prêt »* / *« À configurer »*. Ça rend visible d'un coup d'œil ce qui manque pour que Metricool soit réellement joignable.

3. **Source du compteur** rendue explicite sous le compteur du plan gratuit :
   > « Compté à partir des posts marqués *publiés* dans Cockpit. Pour suivre vos publications réellement envoyées via Metricool, le webhook *Récupération des statistiques* devra être branché. »

## Notes techniques

- Aucune migration nécessaire.
- Aucun nouveau secret ni clé API.
- Modifs uniquement dans `src/routes/_authenticated/reglages.tsx`.

## Et après ?

Si plus tard vous voulez que Cockpit lise vraiment vos chiffres Metricool (compteur d'envois réel, stats live), on aura deux options à reposer à ce moment-là : continuer via N8N (un workflow *« retourne-moi le nombre de publications du mois »*), ou brancher l'API Metricool directement (nécessite un plan Metricool payant + un *user token*). Pas besoin de trancher aujourd'hui.
