---
name: create-asset
description: >-
  Crée un asset 3D en pixel art pour le Projet Vie 3D (arbre, plante, pierre, élément de construction, bâtiment,
  meuble, objet, véhicule, vaisseau, créature d'ambiance...) sous forme de module JavaScript procédural, avec
  une graine (seed) qui change la forme et des axes de variation propres à sa famille (saisons pour la nature,
  type de pierre ou de bois pour la construction, modèle et couleur pour les véhicules...), puis le range, le
  tague, le vérifie à l'image et le publie dans la galerie « Atelier Vie 3D ». À utiliser uniquement quand
  l'utilisateur demande explicitement de créer, dessiner, générer ou ajouter un asset, ou de retoucher un asset
  existant : « génère un chêne », « dessine-moi un mur en pierre », « ajoute une lanterne », « fais un vaisseau
  », « refais le bouleau plus touffu ». Ne pas utiliser pour le moteur de rendu, la galerie, les mondes
  (skill create-world), la créature animée ou le scénario.
---

# Créer un asset

Un asset est un dessin 3D réutilisable, écrit en JavaScript, sans fichier de modèle : `create(params)` construit
l'objet à partir d'une **graine** et de quelques réglages. Le premier, le bouleau
(`src/assets/nature/trees/birch.js`), sert de modèle : le lire avant d'écrire quoi que ce soit.

Ce que l'utilisateur attend de chaque asset :

- le **rendu pixel art moderne** du projet (aplats nets, ombres froides et lumières chaudes, contours sombres,
  ombre portée nette), qui tient quand on tourne et qu'on zoome ;
- une **graine qui change vraiment la silhouette**, pour poser dix fois le même asset sans répétition visible ;
- des **variations qui ont du sens pour sa famille** : les saisons pour le vivant, la matière pour le bâti... ;
- un asset **rangé et tagué** pour qu'une autre IA le retrouve, visible dans la galerie, et léger.

## Avant de commencer

1. Charger les skills three.js : `threejs-fundamentals`, `threejs-performance`, `threejs-geometry`, et
   `threejs-shaders` s'il faut toucher au matériau.
2. Lire `docs/ART-DIRECTION.md`, `docs/PERFORMANCE.md` et `docs/ASSETS.md` (le contrat d'un module).
3. Lire `references/recipes.md` (ce qui a marché, ce qui a raté) et `references/variation-axes.md`.

Si l'utilisateur a joint des images, les regarder pour la silhouette, les proportions et les couleurs. On
s'inspire d'un style, on ne recopie pas les visuels d'un jeu existant.

Si la demande est claire (« un chêne »), ne pas poser de questions : décider et le dire dans le compte rendu.
Ne demander que si deux lectures donneraient des assets vraiment différents. Plusieurs assets demandés d'un
coup : un fichier par asset, chacun mené jusqu'au bout avant le suivant.

## 1. Concevoir (avant le code)

Trancher ces points, en quelques lignes, avant d'écrire :

- **Rangement** : catégorie et sous-catégorie dans `src/assets/taxonomy.js`, nom de fichier en anglais.
  L'identifiant est le chemin : `nature/rocks/boulder`. N'ajouter une sous-catégorie que si aucune ne convient
  (véhicules et vaisseaux n'en ont pas encore : la créer à ce moment-là, avec son libellé français).
- **Les 2 ou 3 traits qui font reconnaître l'objet à 100 pixels de haut.** Pour le bouleau : tronc blanc à tirets
  sombres, brins qui pendent. Tout le reste est secondaire ; si ces traits ne se lisent pas, l'asset est raté.
- **Taille réelle en mètres** (la créature mesure environ 1,7 m ; 16 pixels par mètre au zoom 1).
- **Ce que la graine change.** Des choses visibles de loin : inclinaison, nombre et place des parties,
  proportions, asymétries. Pas seulement du bruit de surface.
- **Les axes de variation de sa famille** : voir `references/variation-axes.md`. Reprendre les noms et valeurs
  partagés (`season`, `stone`, `wood`...) plutôt que d'en inventer : un monde doit pouvoir dire « tout en
  automne » ou « tout en granit ».
- **Les parties et leurs matériaux** : 3 draw calls au plus, donc 3 matériaux au plus, géométries fusionnées par
  matériau. Un identifiant de contour par partie qui doit être cernée séparément.

## 2. Écrire le module

Partir de `assets/asset-template.js` (dans ce skill) : le copier vers `src/assets/<id>.js` et le remplir.

- **Tout hasard passe par `createRng(seed)`** : jamais `Math.random()` ni `Date`. Même réglages, même objet —
  c'est ce qui permet de rejouer une scène à l'identique.
- **Paramètres** : les construire avec `kit/variation.js` (`seedParam`, `seasonParam`, `stoneParam`,
  `woodParam`, `choiceParam`, `numberParam`) et les variantes avec `variantsOf`. La galerie fabrique ses
  contrôles à partir de ce schéma, le catalogue mesure chaque variante.
- **Matières** : rampes de `kit/palettes.js` pour la pierre et le bois ; sinon une rampe de 4 ou 5 couleurs
  propre à l'asset, de l'ombre vers la lumière. Une matière qui servira ailleurs va dans `palettes.js`.
- **Matériaux** : uniquement `createToonMaterial`. Un matériau standard de three.js n'écrit pas les normales et
  identifiants dont la passe de contours a besoin, et ressort faux à l'écran.
- **Géométrie** : outils de `kit/geometry.js`. S'il en manque un (bloc, toit, forme tournée...), l'ajouter là
  comme outil général réutilisable, pas dans le fichier de l'asset. Même règle pour un nouveau motif de matériau
  (briques, planches) : il va dans `src/engine/toon-material.js`, et on revérifie ensuite les assets existants.
- **Rien au chargement du module** : pas de DOM, pas de `window`. Le catalogue importe le fichier dans Node.
- **Tags** : minuscules, en français puis en anglais ; du précis au général, ce qui le distingue, ce qu'il sait
  faire, intérieur ou extérieur. Détails dans `docs/ASSETS.md`.

Puis l'ajouter à la liste de `src/assets/index.js`.

## 3. Vérifier, regarder, reprendre

Le code est de la pâte à modeler : un premier jet n'est jamais bon. Compter au moins deux allers-retours
« regarder puis corriger » avant de montrer quoi que ce soit.

```bash
npm run check -- <id>                      # contrat : fiche, graine, variantes, matériaux, budget, emprise
npm run sheet -- <id> <dossier temporaire>/planche.png   # une image : variantes × graines + face + dessus
```

Corriger tous les ✗ de `check` ; chaque ⚠ se corrige ou se justifie. Puis **ouvrir la planche et la regarder**
avec ces questions :

- Reconnaît-on l'objet dans une case, sans lire le titre ? Ses traits signature se voient-ils ?
- Les graines donnent-elles des silhouettes différentes, ou le même objet à peine bougé ?
- Chaque variante se distingue-t-elle au premier coup d'œil ?
- Voit-on 3 ou 4 tons bien répartis ? Ni bouillie sombre, ni aplat unique, ni confettis.
- Les contours cernent-ils les formes sans salir l'intérieur ? L'ombre portée est-elle crédible ?
- De face et de dessus : pas de trou, pas de partie qui flotte, rien sous le sol.
- La taille est-elle plausible à côté d'un personnage de 1,7 m ?

Pour un gros plan ou un réglage précis, lancer `npm run dev` en tâche de fond puis :

```bash
node scripts/capture.cjs "http://127.0.0.1:5173/dev/test.html?asset=<id>&zoom=2.2&px=4" <sortie.png> 900 900
node scripts/capture.cjs "http://127.0.0.1:5173/dev/test.html?asset=<id>&pixelArt=0" <sortie.png> 900 900
```

(options de l'URL : tout paramètre de l'asset, `view=front|side|top`, `outline=0`, `wireframe=1`, `wind=0`.)
Si l'asset bouge (vent), prendre deux captures à une seconde d'écart et vérifier que le mouvement est léger.

Noter dans `references/recipes.md` ce qui a marché ou raté et qui servira au prochain asset de cette famille.

## 4. Publier

```bash
npm run artifact     # régénère public/catalog/ puis dist-artifact/atelier-vie-3d.html
```

La publication en ligne dépend de l'agent (voir la règle 7 de `AGENTS.md`) : avec l'outil Artifact de
claude.ai, publier `dist-artifact/atelier-vie-3d.html` **en passant comme `url` le lien de l'Artifact « Atelier
Vie 3D » noté dans `AGENTS.md`** (sans lui, un deuxième Artifact est créé au lieu de mettre à jour la galerie) et
donner le lien ; sans cet outil, dire à l'utilisateur que la page est prête dans `dist-artifact/`.

Commit en français : le fichier de l'asset, `src/assets/index.js`, `public/catalog/`, et les outils ajoutés au
kit. Pour une retouche d'asset existant, augmenter `meta.version` si le dessin change.

## 5. Compte rendu

Dire à l'utilisateur, en peu de lignes : ce qu'on voit, ce que change la graine, les variations disponibles, le
poids (triangles, draw calls), ce qui a été décidé à sa place, et ce qui reste imparfait.
