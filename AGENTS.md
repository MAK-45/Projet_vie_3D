# Projet Vie 3D

Des mondes 3D en **pixel art moderne**, vus en isométrique (caméra orbitale : zoom, rotation), où une créature
humanoïde vit une vie **scénarisée à l'avance** par l'utilisateur : explorer, dormir, étudier, construire, faire de la
magie, passer d'un monde à l'autre. Ce n'est pas un jeu : pas de contrôle joueur, des scènes jouées comme un film.
Vision complète : `docs/VISION.md`.

Ce fichier est la source commune des consignes, pour Claude Code (qui le lit à travers `CLAUDE.md`) comme pour
Mistral Vibe (qui le lit directement). Les skills sont dans `.agents/skills/`.

L'utilisateur écrit en français : réponds, commente et documente en français. Code (noms de variables, fonctions,
fichiers) en anglais.

## Stack

- **three.js** r186 (`three@0.186.0`), JavaScript ES modules, Vite pour le dev et le build.
- Mobile d'abord : 60 fps sur un téléphone milieu de gamme est une exigence, pas un bonus.

## Règles de travail

1. **Demande de création d'asset → skill `create-asset`.** Dès que l'utilisateur demande de créer, dessiner,
   générer, ajouter ou retoucher un asset (arbre, pierre, mur, maison, meuble, véhicule, vaisseau...), charger ce
   skill et le suivre jusqu'au bout. Ne pas l'utiliser pour autre chose (moteur, galerie, mondes, scénario).
   **Demande de création de monde → skill `create-world`.** Dès que l'utilisateur demande de créer, générer,
   assembler ou retoucher un monde, une carte, une île, un biome ou un décor à explorer, charger ce skill et le
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
6. **Vérifier à l'image avant de dire « c'est fait »** : capture Playwright en mobile et en desktop
   (`node scripts/capture.cjs ...`), puis ouvrir et regarder l'image produite. Pour un asset : `npm run check`
   puis `npm run sheet`.
7. **Montrer un résultat → skill `publish-page`.** En fin de tâche avec un rendu graphique (asset, monde, effet,
   lot du Complexe), ou quand l'utilisateur demande à voir : l'Atelier Vie 3D (la galerie, où les mondes sont des
   assets de la catégorie « Mondes ») est publié sur GitHub Pages après fusion dans `main`. Jamais d'artefact ni
   d'autre hébergeur.

## Code three.js (`src/`, `dev/`, tout `.js` et `.html`)

- Respecter `docs/ART-DIRECTION.md` et les budgets de `docs/PERFORMANCE.md`.
- Le rendu passe par `src/engine/` : `PixelRenderer` (cible basse résolution + passe de contours, canvas agrandi
  en CSS), `IsoCamera` (orthographique, orbitale), `ChaseCamera` (perspective, 3e personne de l'explorateur),
  `createToonMaterial` (rampe de couleurs, sRGB brut). Tout ce qui est dessiné utilise `createToonMaterial` : les
  matériaux standard de three.js n'écrivent pas la 2e sortie (normales + identifiants) que lit la passe de contours.
- Imports : `import * as THREE from "three"` et addons via `three/addons/...`.
- Tout ce qui est créé (géométrie, matériau, texture, render target) a un chemin de `dispose()`.
- Pas d'allocation dans la boucle de rendu ; animations du décor dans les shaders (uniform de temps partagé).

## Assets (`src/assets/`)

- Créer ou retoucher un asset se fait avec le skill `create-asset` ; le contrat d'un module est dans
  `docs/ASSETS.md`.
- Un asset = un fichier `src/assets/<catégorie>/<sous-catégorie>/<nom>.js` qui exporte `meta` et
  `create(params)`, inscrit dans `src/assets/index.js`. Catégories dans `src/assets/taxonomy.js`.
- Déterministe : tout hasard passe par `createRng(seed)`. Jamais `Math.random()` ni `Date` dans `create`.
- Paramètres construits avec `kit/variation.js` : `seed` toujours, puis les axes partagés de la famille
  (`season`, `stone`, `wood`...). Matières communes dans `kit/palettes.js`.
- Matériaux : uniquement `createToonMaterial`. Outils de géométrie généraux dans `kit/geometry.js`, pas dans le
  fichier d'un asset.
- Rien au chargement d'un module (pas de DOM, pas de `window`) : le catalogue l'importe dans Node.
- Après toute modification : `npm run check`, regarder `npm run sheet -- <id>`, puis `npm run artifact`
  (régénère `public/catalog/`, à committer avec le reste).
- Modifier le kit ou le moteur touche tous les assets : les revérifier tous à l'image.

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
              Le Complexe : ancient-complex (le vrai monde, pièce par pièce ; le Sas pour l'instant), complex-test
              (monde d'essai) ; kit/interior.js (pose instanciée, vue en coupe, halos, collisions).
              Chaque monde est aussi rangé comme asset dans assets/worlds/ (catégorie « Mondes »).
  explorer/   l'explorateur d'un monde (classe Explorer) : réglages, promeneur de 1,80 m, caméras (isométriques ou
              3e personne), heure, météo ;
              monté par la fiche de l'asset dans la galerie, et seul dans explorer.html pour les captures
  creature/   (à venir) comportement de la créature dans un scénario ; ses corps et mouvements sont déjà des assets :
              personnages importés (creatures/humanoid) et 26 animations (catégorie « Animations »), kit/humanoid.js
  script/     (à venir) moteur de scénario : timeline d'actions décidées à l'avance
  fx/         effets : ambient-life (papillons, graines au vent, lucioles la nuit), lamp-dust (poussière des lampes) ;
              à venir, conversions pixelfx en 3D (docs/PIXELFX-3D.md)
scripts/        catalogue, page autonome de la galerie, site GitHub Pages, vérification d'assets, planche de contrôle,
                capture ; hooks/ : scripts de hooks communs à Claude Code et Vibe ; check-agents (cohabitation)
public/catalog/ GÉNÉRÉ et versionné : catalog.json + un module autonome par asset, pour les agents IA
public/models/  modèles importés optimisés (personnages .glb + texture, bibliothèque d'animations) ; voir docs/ASSETS.md
dev/            test.html (un asset plein écran, options dans l'URL), sheet.html (planche variantes × graines)
vendor/pixelfx/ bibliothèque d'effets 2D (source des conversions), voir vendor/README.md
site/           pages statiques en plus de l'Atelier, publiées sur GitHub Pages (skill publish-page)
.agents/skills/ les skills, communs aux deux outils : create-asset, create-world, publish-page (maison),
                threejs-*, grill-me, grilling, pixelfx
.claude/        réglages Claude Code : settings.json (permissions, hooks) ; skills -> ../.agents/skills (lien)
.vibe/          réglages Mistral Vibe : config.toml (permissions), hooks.toml
.github/        workflows/pages.yml : construit et publie le site à chaque push sur main
```

## Commandes

- `npm run dev` : galerie en local (http://127.0.0.1:5173) ; pages de capture sous `/dev/` ; l'explorateur seul
  sous `/explorer.html` (options dans l'URL, voir `docs/WORLDS.md`). À lancer en tâche de fond.
- `npm run check [-- <id>]` : vérifie le contrat des assets (fiche, graine, variantes, matériaux, budget, emprise).
- `npm run sheet -- <id> [sortie.png]` : planche de contrôle d'un asset (variantes × graines, face, dessus).
- `npm run catalog` : régénère `public/catalog/` (après tout changement d'asset, du kit ou du moteur).
- `npm run artifact` : catalogue + page autonome de la galerie `dist-artifact/atelier-vie-3d.html` (three.js
  depuis jsDelivr).
- `npm run site` : la page autonome + `site/`, assemblées dans `dist-site/` comme sur GitHub Pages.
- `npm run check:agents` : vérifie que la configuration Claude Code et Mistral Vibe reste alignée.
- `npm run build` / `npm run preview` : build Vite classique de la galerie dans `dist/`.
- `node scripts/capture.cjs <url> <sortie.png> [largeur] [hauteur] [dpr]` : capture Playwright d'une page.

## Où trouver quoi

| Sujet | Fichier |
|---|---|
| Ce qu'on construit, et pourquoi | `docs/VISION.md` |
| Le rendu pixel art et où il est codé | `docs/ART-DIRECTION.md` |
| Budgets de poids et de perf | `docs/PERFORMANCE.md` |
| Assets : contrat d'un module, rangement, tags, catalogue pour IA | `docs/ASSETS.md` |
| Créer un asset pas à pas, axes de variation, recettes | `.agents/skills/create-asset/` |
| Mondes : assembler une carte, semis, ciel, explorateur, mesures | `docs/WORLDS.md` |
| Créer un monde pas à pas, modèles de fichiers, recettes | `.agents/skills/create-world/` |
| Montrer un résultat (GitHub Pages) | `.agents/skills/publish-page/` |
| Effets pixelfx portés en 3D | `docs/PIXELFX-3D.md` |
| Le Complexe : bible pixel art, plan par lots, **suivi de l'avancement** | `docs/complexe/` (commencer par `SUIVI.md`) |

## Configuration des agents (Claude Code et Mistral Vibe)

- Une règle pour tous les agents s'écrit ici, dans `AGENTS.md`, sans import d'autre fichier. `CLAUDE.md` ne garde
  que ce qui est propre à Claude Code.
- Un skill se crée dans `.agents/skills/<nom>/SKILL.md` (nom en minuscules et tirets, identique au dossier,
  description de moins de 1 024 caractères). Dans un skill : décrire des actions, sans nom d'outil propre à un
  agent, sans `$ARGUMENTS`, sans le nom d'une commande intégrée (`help`, `config`, `init`, `review`...).
- Permissions et hooks existent en double : `.claude/settings.json` d'un côté, `.vibe/config.toml` et
  `.vibe/hooks.toml` de l'autre. Les modifier ensemble, dans le même commit. Le script d'un hook est commun, dans
  `scripts/hooks/`.
- Serveurs MCP : aucun pour l'instant. S'il en faut un, le déclarer dans `.mcp.json` (Claude Code) et dans
  `.vibe/config.toml` (Vibe), clés dans des variables d'environnement.
- Après un changement de cette configuration : `npm run check:agents`.

## Git

- Commits petits et en français, sur la branche de travail fournie par la session ; jamais directement sur `main`.
- Une branche par outil et par session : une session Claude Code et une session Vibe ne poussent pas sur la même
  branche.
- Pas de pull request sans demande, sauf celle du skill `publish-page` pour montrer un résultat.
- Rien de secret dans le dépôt (`.env`, clés d'API) ; les préférences personnelles vont dans `CLAUDE.local.md` ou
  `~/.vibe/AGENTS.md`, jamais committés.
