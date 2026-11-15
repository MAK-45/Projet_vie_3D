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
6. Vérifier visuellement avant de dire « c'est fait » : capture Playwright (Chromium préinstallé) en viewport
   mobile et desktop, et regarder l'image.

## Organisation (cible)

```
src/
  engine/     renderer, pipeline pixel art (render target basse réso + upscale), caméra iso, boucle
  worlds/     un fichier par monde/biome : génération procédurale + données
  creature/   modèle, squelette/animations, actions (marcher, dormir, lancer un sort...)
  script/     moteur de scénario : timeline d'actions décidées à l'avance
  fx/         effets (dont conversions pixelfx en 3D, voir docs/PIXELFX-3D.md)
public/assets/  GLB (meshopt/Draco) et KTX2 seulement si la génération procédurale ne suffit pas
vendor/pixelfx/ bibliothèque d'effets 2D (source des conversions), voir vendor/README.md
```

## Commandes

À créer avec le premier code : `npm run dev`, `npm run build`, `npm run preview`. Mettre à jour ici.

## Git

Commits petits et en français, branche de travail fournie par la session. Pas de PR sans demande.
