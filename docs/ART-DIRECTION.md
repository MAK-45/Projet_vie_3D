# Direction artistique : pixel art moderne en 3D

Référence de l'utilisateur : https://youtube.com/shorts/pdeHKKDPfbM — dioramas isométriques en vraie 3D qui
**ressemblent à du pixel art** : gros pixels nets, palette limitée, contours fins, lumière douce et ombres
nettes, éléments animés (vent, eau, lumières). On garde ce rendu même quand on tourne ou zoome la caméra.

## Technique (le « 3D pixel art »)

1. **Rendu basse résolution** : la scène est rendue dans un `WebGLRenderTarget` petit (ex. hauteur 180–270 px,
   largeur selon le ratio), `minFilter`/`magFilter` = `NearestFilter`, puis affiché plein écran sans lissage.
   Le canvas final : `image-rendering: pixelated`, `antialias: false`, pixel ratio 1 sur la passe basse réso.
2. **Caméra orthographique** isométrique (angle ~35,26° en élévation, 45° en azimut au repos). Rotation libre
   autour d'une cible ; zoom = changer `camera.zoom` (pas la distance), de préférence par paliers entiers de
   pixels pour garder des pixels de taille constante.
3. **Pixel snapping** : aligner la position de la caméra sur la grille des texels du render target pour éviter
   le « shimmering » quand elle bouge ; compenser le décalage sous-pixel à l'upscale pour un mouvement fluide.
4. **Ombrage toon** : `MeshToonMaterial` ou shader maison avec 2 à 4 paliers de lumière, une lumière directionnelle
   principale (ombres nettes, shadow map petite et `NearestFilter`), une ambiante colorée (ciel/sol via
   `HemisphereLight`).
5. **Contours** : passe de post-traitement qui détecte les ruptures de profondeur et de normales sur le render target
   basse réso → contour sombre d'1 pixel sur les silhouettes, liseré clair sur les arêtes convexes.
6. **Palette limitée** : couleurs choisies par biome ; optionnellement quantification vers la palette en fin de
   passe (+ léger dithering Bayer 4×4 sur les dégradés de ciel/brouillard uniquement).
7. **Textures** : très petites (8–32 px), `NearestFilter`, pas de mipmaps floues ; souvent pas de texture du tout,
   juste des couleurs par face/vertex.
8. **Vie** : vent dans l'herbe/feuilles via vertex shader (InstancedMesh), eau animée en shader, particules en
   points ou sprites pixel, lumières qui vacillent. Animations à cadence réduite possible (12 fps) pour l'effet
   « sprite ».

## Où c'est codé

| Technique | Fichier |
|---|---|
| Rendu basse résolution, contours, fond tramé | `src/engine/pixel-renderer.js` |
| Caméra orthographique orbitale, alignement sur la grille de pixels | `src/engine/iso-camera.js` |
| Caméra perspective à la 3e personne (exploration immersive), brume de lointain | `src/engine/chase-camera.js`, `src/engine/pixel-renderer.js` |
| Ombrage par rampe de couleurs, ombres nettes, vent, motifs (écorce, grain) | `src/engine/toon-material.js` |
| Lumières de halo (créature qui brille, lanterne) : le décor proche prend leur couleur dans le noir, en 3 paliers tramés qui échappent à la teinte de nuit | `src/engine/toon-material.js` (`createGlowLight`, `setDarkness`), `src/engine/pixel-renderer.js` |
| Lueurs qui s'allument en vague (glyphes, rainures du Complexe) : sphère du monde, couleur éteinte au-delà | `src/engine/toon-material.js` (`enableReveal`) |
| Brume tramée d'intérieur (voile sombre au fond de la pièce, en 4 paliers de Bayer) | `src/engine/pixel-renderer.js` (`fog.max`, `orthoFog`) |
| Poussière en suspension dans la lumière des lampes | `src/fx/lamp-dust.js` |
| Scène de présentation (soleil, socle), exemple complet d'utilisation | `src/gallery/viewer.js` |

Repères chiffrés : 16 pixels d'art par mètre au zoom 1 ; rampes de 4 ou 5 couleurs avec glissement de teinte
(ombres froides, lumières chaudes) ; animations du décor à 12 images par seconde. Les recettes éprouvées asset
par asset sont dans `.agents/skills/create-asset/references/recipes.md`.

## À éviter

- Antialiasing, bloom flou, textures haute résolution, ombres douces PCF larges, dégradés lisses partout.
- Perspective forte (sauf choix délibéré : plan cinématique, ou la vue à la 3e personne de l'explorateur, voulue
  pour se promener dans le décor ; le rendu pixel art, les contours et la palette restent les mêmes, et une brume
  tramée cache la fin de la vue).
- Recréer les visuels d'un jeu existant : on s'inspire du style, pas des assets.
