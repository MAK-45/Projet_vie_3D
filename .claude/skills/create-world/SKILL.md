---
name: create-world
description: >-
  Crée un monde (une carte entière à parcourir) pour le Projet Vie 3D, assemblé à partir des assets de la
  bibliothèque comme la « Prairie d'été » : générateur procédural piloté par une graine (relief, sol, semis
  d'arbres, de rochers, d'herbes et de fleurs en bosquets et en nappes crédibles), échelle réelle en mètres, ciel
  (lumière, ombres de nuages, mer de nuages, heure, météo), vie d'ambiance, réglages de personnalisation, puis
  rangement comme asset de la catégorie « Mondes », visite dans l'explorateur de l'Atelier, vérification à
  l'image et publication. À utiliser dès que l'utilisateur demande de créer, générer, assembler ou retoucher un
  monde, une carte, une île, un biome, un terrain ou un décor à explorer : « crée une forêt enneigée », « fais-moi
  une carte de désert », « génère un monde de plage », « ajoute un village sur une île », « rends la prairie plus
  boisée », « un nouveau biome avec des marais ». Ne pas utiliser pour dessiner un asset isolé (arbre, rocher,
  maison : skill create-asset), ni pour le moteur de rendu ou le scénario.
---

# Créer un monde

Un monde est une carte entière fabriquée par du code à partir d'une **graine**. Il n'a pas de dessin propre : il
**assemble les assets de la bibliothèque**. Le premier, la Prairie d'été, sert de modèle : lire
`src/worlds/summer-meadow.js` en entier avant d'écrire quoi que ce soit, puis `docs/WORLDS.md`.

Ce que l'utilisateur attend d'un monde :

- **on s'y croit** : un endroit cohérent et contemplatif, qui donne envie de s'y promener, pas un tapis d'objets
  semés au hasard ;
- **les ordres de grandeur de la vraie vie** : 1 unité = 1 mètre, un promeneur de 1,80 m, des fleurs au genou,
  des arbres de dix mètres ;
- le **rendu pixel art** du projet, stable : rien ne clignote, rien n'apparaît au milieu de l'image ;
- **60 images par seconde sur un vieux téléphone** : c'est une exigence, vérifiée par des mesures ;
- des **réglages** (graine, taille, abondance de chaque élément) et l'heure et la météo qui varient ;
- un monde **rangé dans l'Atelier comme un asset**, dont la fiche ouvre l'explorateur. Un seul Artifact.

## Avant de commencer

1. Charger les skills three.js : `threejs-fundamentals`, `threejs-performance`, `threejs-geometry`,
   `threejs-lighting`, et `threejs-shaders` s'il faut toucher à un matériau.
2. Lire `docs/ART-DIRECTION.md`, `docs/PERFORMANCE.md`, `docs/WORLDS.md` et `docs/ASSETS.md`.
3. Lire `references/world-recipes.md` : ce qui a marché, ce qui a raté, et pourquoi.
4. Lire `public/catalog/catalog.json` pour savoir quels assets existent, leurs paramètres et leur poids.

Si la demande est claire (« une forêt enneigée »), ne pas poser de questions : décider et le dire dans le compte
rendu. Demander seulement si deux lectures donneraient des mondes vraiment différents.

## 1. Concevoir (avant le code)

Trancher ces points en quelques lignes :

- **Le lieu en une phrase**, et les 3 ou 4 choses qui le font reconnaître d'un coup d'œil (prairie : bosquets
  et clairières, nappes de fleurs, rochers qui percent, ombres de nuages).
- **Les assets disponibles et ceux qui manquent.** Lister ce que la bibliothèque offre pour ce lieu. S'il manque
  un asset indispensable (un sapin pour une forêt de montagne), le créer d'abord avec le skill `create-asset`,
  mené jusqu'au bout, puis revenir ici. Ne pas remplacer un asset manquant par un bricolage dans le monde.
- **La taille réelle de chaque chose**, écrite en mètres à côté du promeneur de 1,80 m. Rester dans les plages
  de paramètres prévues par chaque asset ; les copies ne varient que de ±20 %.
- **Les règles du lieu** : où pousse quoi, et pourquoi. C'est ce qui rend un monde crédible. Voir « Rendre un
  lieu crédible » dans les recettes : regroupements, exclusions, dépendance au relief, à l'ombre, à l'humidité.
- **Le sol** : un asset de sol raccordable (comme `nature/terrain/meadow-ground`) donne la couleur et couvre
  tout pour presque rien ; les assets en volume par-dessus donnent le relief et le mouvement. Cette combinaison
  a été comparée aux deux autres (sol seul, tout en volume) et retenue par l'utilisateur.
- **Les bords** : un monde borné est une île dans une mer de nuages (`kit/cloud-sea.js`).
- **Les réglages** : graine, taille, et une abondance de 0 à 2 par famille d'éléments.
- **L'ambiance** : moments et météos utiles à ce lieu (`kit/atmosphere.js`), vie d'ambiance (`src/fx/`).

## 2. Écrire le générateur

Partir de `assets/world-template.js` : le copier vers `src/worlds/<nom>.js` et le remplir. Il expose
`create<Nom>(options)` et rend un objet monde : `group`, `bounds`, `spawn`, `counts`, `heightAt`, `collide`,
`setMood`, `update`, `dispose`.

- **Tout hasard passe par `createRng(seed)`**, et chaque tirage est fait dans le même ordre quoi qu'il arrive
  (tirer d'abord, tester ensuite). Sinon changer un réglage déplace tout le reste du monde.
- **Le semis passe par `ScatterField`** (`kit/scatter.js`) : un asset modèle devient une couche instanciée,
  triée par cases. Ne jamais ajouter un `Mesh` par objet posé.
- **Peu de modèles, beaucoup de copies** : 2 graines par essence d'arbre, 2 ou 3 par herbe, 1 par fleur ; la
  rotation et la taille de chaque copie font la variété. Chaque modèle coûte ses draw calls.
- **Le relief vient d'une fonction de hauteur** en coordonnées du monde, partagée par le sol, le semis, le
  promeneur. Les plaques posées au sol sont couchées sur la pente (`tilt`), les arbres un peu enfoncés.
- **Les réglages d'abondance** élargissent les zones (bosquets plus étendus, nappes plus larges), pas seulement
  leur densité, sinon « × 2 » ne se voit pas.
- **`diorama`** : l'île seule, toutes copies dessinées, sans lumière ni ciel, pour la fiche et la vignette.
- Uniquement `createToonMaterial` pour ce qui est cerné. Les nappes sans contour (brume, mer) ont leur shader
  dans le kit ; un nouvel effet de ce genre va dans `src/worlds/kit/` ou `src/fx/`, pas dans le fichier du monde.

## 3. Le ranger comme asset et l'ouvrir dans l'explorateur

1. Copier `assets/world-asset-template.js` vers `src/assets/worlds/<sous-catégorie>/<nom>.js` : `meta` avec
   `composite: true` (pas de budget d'objet) et `experience: "explorer"` (la fiche ouvre l'explorateur),
   paramètres construits avec `kit/variation.js`, `create()` qui rend le monde en `diorama`.
2. L'inscrire dans `src/assets/index.js` ; ajouter la sous-catégorie à `worlds` dans `src/assets/taxonomy.js`
   si aucune ne convient.
3. **Brancher l'explorateur.** `src/explorer/explorer.js` a été écrit pour un seul monde : il importe
   `createSummerMeadow` et ses curseurs en dur. Pour un deuxième monde, le rendre générique : il reçoit le
   module du monde (fonction de création, réglages décrits par `meta.params`, tailles) et fabrique ses contrôles
   à partir de là ; `src/gallery/main.js` lui passe l'asset affiché. Vérifier ensuite que la Prairie d'été
   marche toujours.

## 4. Vérifier, regarder, reprendre

Un premier jet n'est jamais bon. Compter plusieurs allers-retours « regarder puis corriger ».

```bash
npm run check -- worlds/<sous-catégorie>/<nom>     # contrat de l'asset, graine déterministe
npm run dev                                          # en tâche de fond
node scripts/capture.cjs "http://127.0.0.1:5173/explorer.html?<options>" <sortie.png> 1280 720 1 4000
node scripts/capture.cjs "http://127.0.0.1:5173/explorer.html?<options>" <sortie.png> 412 915 2.6 4000
```

Options d'URL : voir `src/explorer/main.js` (`seed`, `size`, `moment`, `weather`, `az`, `el`, `zoom`, `x`, `z`,
`clean=1`, `stroll=1`). Captures à faire et à **regarder** :

- la vue de départ, grand écran et téléphone ;
- l'île entière (`size=small&zoom=0.5&el=38&clean=1`) pour 3 ou 4 graines : la composition change-t-elle ?
- un gros plan (`zoom=2.5`) : les proportions tiennent-elles à côté de la barre de 1,80 m ?
- une vue rasante (`el=12`) et un bord de l'île ;
- chaque moment et chaque météo ;
- chaque réglage d'abondance à 0 et à 2.

Questions à se poser devant les images :

- Reconnaît-on le lieu sans lire le titre ? A-t-on envie d'y marcher ?
- Voit-on des zones (dense, clairsemé, vide) ou une répartition uniforme ? L'uniforme sonne faux.
- Rien ne pousse à travers un rocher, rien ne flotte, rien ne sort de l'île ?
- Les couleurs restent-elles lisibles de nuit et sous la pluie ?

**Mesures**, lues dans le coin de l'explorateur (`window.explorer.stats` dans une capture scriptée), en vue
de départ sur téléphone, à plusieurs endroits dont le plus chargé : viser moins de 100 draw calls et rester au
niveau de la Prairie d'été (environ 200 000 triangles par image). Au-delà, alléger avant d'aller plus loin : les
arbres pèsent le plus, puis l'herbe.

**Stabilité**, à tester par un script Playwright qui lance la balade : la part d'herbe dessinée
(`world.stats().fraction`) ne doit pas changer pendant qu'on marche sans toucher à la caméra.

La fluidité réelle ne se mesure pas dans le navigateur de capture (rendu logiciel) : le dire dans le compte
rendu, et demander à l'utilisateur ce que donne son téléphone.

## 5. Publier

```bash
npm run artifact     # régénère public/catalog/ puis dist-artifact/atelier-vie-3d.html
```

Publier `dist-artifact/atelier-vie-3d.html` avec l'outil Artifact en passant comme `url` le lien de l'Artifact
« Atelier Vie 3D » noté dans `CLAUDE.md`. Les mondes vivent dans l'Atelier : ne pas créer d'autre Artifact.

Mettre à jour `docs/WORLDS.md` (le monde, ses réglages, ses mesures) et noter dans
`references/world-recipes.md` ce qui a marché ou raté. Commits en français, petits.

## 6. Compte rendu

Dire à l'utilisateur, en peu de lignes : le lien, ce qu'on voit, ce que change la graine, les réglages, les
assets utilisés et ceux créés pour l'occasion, les mesures (draw calls, triangles), ce qui a été décidé à sa
place, ce qui n'a pas pu être vérifié (la fluidité sur son téléphone) et ce qui reste imparfait.

## Retoucher un monde existant

Lire le générateur, changer le moins possible, puis refaire les captures concernées et les mesures : un monde
est un équilibre, et densifier une couche déplace le coût de toutes les autres. Augmenter `meta.version` de
l'asset si le monde change à l'écran.
