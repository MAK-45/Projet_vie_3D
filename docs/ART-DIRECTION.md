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

## À éviter

- Antialiasing, bloom flou, textures haute résolution, ombres douces PCF larges, dégradés lisses partout.
- Perspective forte (sauf choix délibéré pour un plan cinématique).
- Recréer les visuels d'un jeu existant : on s'inspire du style, pas des assets.
