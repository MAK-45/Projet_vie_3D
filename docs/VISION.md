# Vision

## L'idée

Une collection de **mondes vivants** en 3D, au rendu pixel art moderne, et une **créature humanoïde** qui y mène sa
vie. L'utilisateur ne joue pas : il **écrit à l'avance** ce que fait la créature, puis regarde la scène se dérouler,
librement ou en plan cadré sur le personnage.

## Les mondes

- Beaucoup de biomes différents, **extérieurs et intérieurs** : forêt, prairie, désert, neige, marais, volcan, plage,
  grotte, montagne, ville/village, maison, bibliothèque, atelier, laboratoire de magie, temple, monde onirique...
- Chaque monde est **vivant** : herbe et feuillage qui bougent au vent, eau animée, cycle jour/nuit, météo, lumières
  (torches, bougies), particules (lucioles, poussière, neige, braises), petites créatures d'ambiance.
- Diorama isométrique : un îlot/une pièce de taille bornée, lisible d'un coup d'œil.
- Passage de monde en monde (portails, portes, transitions).

## La créature

Humanoïde, stylisée, lisible à petite taille. Actions prévues : marcher, explorer, observer, dormir, étudier/lire,
construire, faire de la magie, interagir avec des objets, traverser un portail.

## La caméra

- Vue isométrique par défaut (caméra orthographique).
- Zoom / dézoom, rotation libre autour de la scène (3D réelle, pas des sprites 2D).
- Mode « scène » : caméra centrée sur la créature pendant une action, avec cadrages prévus par le scénario.

## Le scénario

Une timeline écrite à l'avance (format à définir, probablement un fichier JS/JSON lisible) :
`aller à X`, `dormir 8 h`, `lire le livre`, `lancer un sort sur Y`, `prendre le portail vers le monde Z`,
plus les mouvements de caméra et l'heure du jour.

## Questions ouvertes (à trancher avec l'utilisateur, éventuellement via `grill-me`)

- Format exact du scénario et outil pour l'écrire.
- Taille d'un monde, nombre de mondes visés en premier.
- Apparence de la créature ; animations procédurales ou squelettiques.
- Export vidéo des scènes ?
- Son / musique ?
