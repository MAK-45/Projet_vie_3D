# Projet Vie 3D

Des mondes 3D en **pixel art moderne**, vus en isométrique (caméra orbitale : zoom, rotation), où une créature
humanoïde vit une vie **scénarisée à l'avance** par l'utilisateur : explorer, dormir, étudier, construire, faire de la
magie, passer d'un monde à l'autre. Ce n'est pas un jeu : pas de contrôle joueur, des scènes jouées comme un film.
Vision complète : `docs/VISION.md`.

L'utilisateur écrit en français : réponds, commente et documente en français. Code (noms de variables, fonctions,
fichiers) en anglais.

## Stack

- **three.js** (cible r186, comme les skills), JavaScript ES modules, Vite pour le dev et le build.
- Mobile d'abord : 60 fps sur un téléphone milieu de gamme est une exigence, pas un bonus.

## Règles de travail

1. **Toujours** charger les skills three.js utiles avant de coder du rendu (`threejs-fundamentals`,
   `threejs-performance` en permanence ; puis `-geometry`, `-materials`, `-shaders`, `-postprocessing`,
   `-lighting`, `-asset-pipeline`, `-loaders`, `-animation`, `-textures`, `-interaction` selon la tâche).
   Pas de `threejs-react-three-fiber` : le projet est en three.js pur.
2. `grill-me` / `grilling` et `pixelfx` : **uniquement quand l'utilisateur le demande** explicitement.
3. Le style graphique est non négociable : relire `docs/ART-DIRECTION.md` avant tout travail visuel.
4. Le poids et la perf aussi : relire `docs/PERFORMANCE.md` avant de créer un asset, un monde ou un effet.
5. **Fin de tâche avec rendu graphique → publier un Artifact** (page HTML autonome, three.js depuis
   cdn.jsdelivr.net/npm/ avec version exacte) pour que l'utilisateur voie le résultat, et donner le lien.
   Pour les assets, c'est toujours le même Artifact, « Atelier Vie 3D » :
   https://claude.ai/artifact/C8NQjFucdBRX4bo9eT4Jim — `npm run artifact`, puis publier
   `dist-artifact/atelier-vie-3d.html` en passant ce lien comme `url` (sinon un nouvel Artifact est créé).
6. Vérifier visuellement avant de dire « c'est fait » : capture Playwright (Chromium préinstallé) en viewport
   mobile et desktop, et regarder l'image.

## Organisation

```
src/
  engine/     toon-material (matériau à palette + vent), pixel-renderer (basse réso + contours), iso-camera
  assets/     les dessins 3D en JS : registre, taxonomie, kit, un fichier par asset (voir docs/ASSETS.md)
  gallery/    « Atelier Vie 3D » : galerie web des assets (visionneuse, catalogue par catégorie, code, fiche)
  worlds/     (à venir) un fichier par monde/biome : génération procédurale + données
  creature/   (à venir) modèle, squelette/animations, actions (marcher, dormir, lancer un sort...)
  script/     (à venir) moteur de scénario : timeline d'actions décidées à l'avance
  fx/         (à venir) effets (dont conversions pixelfx en 3D, voir docs/PIXELFX-3D.md)
scripts/      catalogue (catalog-lib, build-catalog), page Artifact (build-artifact), capture Playwright
public/catalog/  GÉNÉRÉ et versionné : catalog.json + un module autonome par asset, pour les agents IA
public/assets/   GLB (meshopt/Draco) et KTX2 seulement si la génération procédurale ne suffit pas
dev/test.html    page de capture d'un asset seul (options dans l'URL)
vendor/pixelfx/  bibliothèque d'effets 2D (source des conversions), voir vendor/README.md
```

## Assets

Tout nouveau dessin suit `docs/ASSETS.md` : contrat du module (`meta` + `create`), catégories, tags, budget,
marche à suivre. Un asset n'est terminé que s'il est dans le registre, visible dans la galerie, présent dans
`public/catalog/` et publié sur l'Artifact.

## Commandes

- `npm run dev` : galerie en local (http://127.0.0.1:5173), page de capture sur `/dev/test.html`.
- `npm run catalog` : régénère `public/catalog/` (à faire après tout changement d'asset ou du moteur).
- `npm run artifact` : catalogue + page autonome `dist-artifact/atelier-vie-3d.html` (three.js depuis jsDelivr).
- `npm run build` / `npm run preview` : build Vite classique de la galerie dans `dist/`.
- `node scripts/capture.cjs <url> <sortie.png> [largeur] [hauteur] [dpr]` : capture Playwright.

## Git

Commits petits et en français, branche de travail fournie par la session. Pas de PR sans demande.
