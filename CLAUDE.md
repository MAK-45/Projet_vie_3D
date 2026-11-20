# Projet Vie 3D

Des mondes 3D en **pixel art moderne**, vus en isométrique (caméra orbitale : zoom, rotation), où une créature
humanoïde vit une vie **scénarisée à l'avance** par l'utilisateur : explorer, dormir, étudier, construire, faire de la
magie, passer d'un monde à l'autre. Ce n'est pas un jeu : pas de contrôle joueur, des scènes jouées comme un film.
Vision complète : `docs/VISION.md`.

L'utilisateur écrit en français : réponds, commente et documente en français. Code (noms de variables, fonctions,
fichiers) en anglais.

## Stack

- **three.js** r186 (`three@0.186.0`), JavaScript ES modules, Vite pour le dev et le build.
- Mobile d'abord : 60 fps sur un téléphone milieu de gamme est une exigence, pas un bonus.

## Règles de travail

1. **Demande de création d'asset → skill `create-asset`.** Dès que l'utilisateur demande de créer, dessiner,
   générer, ajouter ou retoucher un asset (arbre, pierre, mur, maison, meuble, véhicule, vaisseau...), lancer ce
   skill et le suivre jusqu'au bout. Ne pas l'utiliser pour autre chose (moteur, galerie, mondes, scénario).
   **Demande de création de monde → skill `create-world`.** Dès que l'utilisateur demande de créer, générer,
   assembler ou retoucher un monde, une carte, une île, un biome ou un décor à explorer, lancer ce skill et le
   suivre jusqu'au bout. Un asset qui manque au monde se crée d'abord avec `create-asset`.
   **Projet « Le Complexe »** (le lieu ancien-technologique et ses artefacts, implémenté par lots) : dès que
   l'utilisateur en parle (« on en est où ? », « on continue le Complexe », un lot, une salle, un artefact), lire
   d'abord `docs/complexe/SUIVI.md` et suivre sa marche ; ne marquer un lot validé que sur son feu vert.
2. **Toujours** charger les skills three.js utiles avant de coder du rendu (`threejs-fundamentals`,
   `threejs-performance` en permanence ; puis `-geometry`, `-materials`, `-shaders`, `-postprocessing`,
   `-lighting`, `-asset-pipeline`, `-loaders`, `-animation`, `-textures`, `-interaction` selon la tâche).
   Pas de `threejs-react-three-fiber` : le projet est en three.js pur.
3. `grill-me` / `grilling` et `pixelfx` : **uniquement quand l'utilisateur le demande** explicitement.
4. Le style graphique est non négociable : relire `docs/ART-DIRECTION.md` avant tout travail visuel.
5. Le poids et la perf aussi : relire `docs/PERFORMANCE.md` avant de créer un asset, un monde ou un effet.
6. **Vérifier à l'image avant de dire « c'est fait »** : capture Playwright (Chromium préinstallé) en mobile et en
   desktop, et regarder l'image. Pour un asset : `npm run check` puis `npm run sheet`.
7. **Fin de tâche avec rendu graphique → publier un Artifact** et donner le lien. Pour les assets, c'est toujours
   le même, « Atelier Vie 3D » : https://claude.ai/artifact/C8NQjFucdBRX4bo9eT4Jim — `npm run artifact`, puis
   publier `dist-artifact/atelier-vie-3d.html` en passant ce lien comme `url` (sinon un nouvel Artifact est créé).
   Les mondes y sont aussi : un monde est un asset (catégorie « Mondes ») dont la fiche ouvre l'explorateur.
   Un seul Artifact pour tout le projet. Les modèles importés (personnages, animations) sont embarqués
   dans la page : rien d'autre à publier.

## Organisation

```
src/
  engine/     toon-material (matériau à palette + vent), pixel-renderer (basse réso + contours), iso-camera,
              chase-camera (3e personne, perspective)
  assets/     les dessins 3D en JS : index (registre), taxonomy (catégories), kit/ (outils), un fichier par asset
  gallery/    « Atelier Vie 3D » : galerie web des assets (visionneuse, catalogue par catégorie, code, fiche)
  worlds/     un fichier par monde/biome : génération procédurale + données (summer-meadow : la prairie d'été,
              en île ou infinie : summer-meadow-endless, règles partagées dans summer-meadow-rules) ;
              kit/ : semis instancié trié par cases (scatter), semis par morceaux d'un monde sans bord
              (streaming-scatter), lumière et ombres de nuages (sky), mer de nuages et brume (cloud-sea), heure et
              météo (atmosphere), tranche d'île et sol en morceaux (terrain).
              Le Complexe : ancient-complex (le vrai monde, pièce par pièce : Sas, Archives, Atelier, un fichier par
              pièce), complex-test
              (monde d'essai) ; kit/interior.js (pose instanciée, vue en coupe, halos, collisions).
              Chaque monde est aussi rangé comme asset dans assets/worlds/ (catégorie « Mondes »).
  explorer/   l'explorateur d'un monde (classe Explorer) : réglages, promeneur de 1,80 m, caméras (isométriques ou
              3e personne), heure, météo ;
              monté par la fiche de l'asset dans la galerie, et seul dans explorer.html pour les captures
  creature/   (à venir) comportement de la créature dans un scénario ; ses corps et mouvements sont déjà des assets :
              personnages importés (creatures/humanoid) et 26 animations (catégorie « Animations »), kit/humanoid.js
  script/     (à venir) moteur de scénario : timeline d'actions décidées à l'avance
  fx/         effets : ambient-life (papillons, graines au vent, lucioles la nuit), lamp-dust (poussière des lampes) ; à venir, conversions pixelfx en 3D
              (docs/PIXELFX-3D.md)
scripts/        catalogue, page Artifact, vérification d'assets, planche de contrôle, capture
public/catalog/ GÉNÉRÉ et versionné : catalog.json + un module autonome par asset, pour les agents IA
public/models/  modèles importés optimisés (personnages .glb + texture, bibliothèque d'animations) ; voir docs/ASSETS.md
dev/            test.html (un asset plein écran, options dans l'URL), sheet.html (planche variantes × graines)
vendor/pixelfx/ bibliothèque d'effets 2D (source des conversions), voir vendor/README.md
.claude/skills/ create-asset et create-world (maison), threejs-*, grill-me, grilling, pixelfx
.claude/rules/  règles chargées selon les fichiers touchés : threejs.md, assets.md
```

## Commandes

- `npm run dev` : galerie en local (http://127.0.0.1:5173) ; pages de capture sous `/dev/` ; l'explorateur seul
  sous `/explorer.html` (options dans l'URL, voir `docs/WORLDS.md`).
- `npm run check [-- <id>]` : vérifie le contrat des assets (fiche, graine, variantes, matériaux, budget, emprise).
- `npm run sheet -- <id> [sortie.png]` : planche de contrôle d'un asset (variantes × graines, face, dessus).
- `npm run catalog` : régénère `public/catalog/` (après tout changement d'asset, du kit ou du moteur).
- `npm run artifact` : catalogue + page autonome `dist-artifact/atelier-vie-3d.html` (three.js depuis jsDelivr).
- `npm run build` / `npm run preview` : build Vite classique de la galerie dans `dist/`.
- `node scripts/capture.cjs <url> <sortie.png> [largeur] [hauteur] [dpr]` : capture Playwright d'une page.

## Où trouver quoi

| Sujet | Fichier |
|---|---|
| Ce qu'on construit, et pourquoi | `docs/VISION.md` |
| Le rendu pixel art et où il est codé | `docs/ART-DIRECTION.md` |
| Budgets de poids et de perf | `docs/PERFORMANCE.md` |
| Assets : contrat d'un module, rangement, tags, catalogue pour IA | `docs/ASSETS.md` |
| Créer un asset pas à pas, axes de variation, recettes | `.claude/skills/create-asset/` |
| Mondes : assembler une carte, semis, ciel, explorateur, mesures | `docs/WORLDS.md` |
| Créer un monde pas à pas, modèles de fichiers, recettes | `.claude/skills/create-world/` |
| Effets pixelfx portés en 3D | `docs/PIXELFX-3D.md` |
| Le Complexe : bible pixel art, plan par lots, **suivi de l'avancement** | `docs/complexe/` (commencer par `SUIVI.md`) |

## Git

Commits petits et en français, branche de travail fournie par la session. Pas de PR sans demande.
