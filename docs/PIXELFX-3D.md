# Effets pixelfx → 3D

`vendor/pixelfx/` contient 244 effets pixel art **2D** (feu, magie, eau, glace, éclairs, portails, météo...).
On les utilisera plus tard (à la demande de l'utilisateur, avec le skill `pixelfx`). Ils doivent être convertis
pour vivre dans la scène 3D. Trois approches, de la plus simple à la plus intégrée :

1. **Sprite sheet sur billboard** : `node tools/render.mjs <id> --sheet` (depuis `vendor/pixelfx/`) → PNG +
   JSON. Dans three.js : un `Sprite`/quad face caméra, texture `NearestFilter`, UV animées selon `meta.pixelfx.fps`,
   pivot = `meta.pixelfx.pivot`, profondeur testée pour être cachée par le décor. Taille réglée pour que
   1 pixel de l'effet = 1 pixel du render target basse réso. Couche « light » en `AdditiveBlending`.
2. **Rendu live sur texture** : faire tourner l'effet JS (`createFx`) dans un petit buffer, l'envoyer dans une
   `DataTexture` à chaque frame. Paramétrable (couleurs, seed) mais coût CPU : réservé aux effets vedettes.
3. **Port natif 3D** : réécrire l'effet en particules/shader three.js (positions 3D réelles, visible sous tous les
   angles), en gardant les principes pixelfx : rampe de palette, alpha en dithering Bayer 4×4, buffer couleur +
   buffer lumière, timing « act » (anticipation, freeze à l'impact, récupération). Comparer côte à côte avec
   l'original.

Choix par défaut : (1) pour les effets ponctuels, (3) pour les effets volumétriques autour de la créature
(cercle magique au sol, tornade, portail).
