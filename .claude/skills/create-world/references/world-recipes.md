# Recettes de mondes : ce qui marche, ce qui rate

Carnet de bord. Tout ce qui suit a été fait et regardé à l'écran sur la Prairie d'été, et chaque règle vient d'un
défaut que l'utilisateur a vu ou d'une mesure. **Après chaque monde, ajouter ici ce qui a servi.**

## Sommaire

1. Rendre un lieu crédible
2. Échelle
3. Sol
4. Semis et performance
5. Stabilité de l'image
6. Contours
7. Ciel, heure, météo
8. Bords du monde
9. Caméra et explorateur
10. Poids mesurés

## 1. Rendre un lieu crédible

Un semis uniforme sonne faux. Ce qui fait croire à un lieu, ce sont des **règles** :

- **Regrouper** : un champ de bruit lent (longueur d'onde 40 à 75 m) décide où sont les bosquets ; les arbres
  s'y serrent et laissent de grandes clairières. Un second champ choisit l'essence dominante de chaque bosquet.
- **Isoler** : quelques arbres seuls en plein pré, surtout la plus grande essence.
- **Espacer** : distance minimale entre deux troncs selon l'essence (chêne 7,5 m, tilleul 6,5 m, bouleau 3,4 m).
- **Faire dépendre du relief** : les rochers percent sur les hauteurs (garder le plus haut de trois tirages),
  l'herbe grasse et les boutons d'or vont dans les creux, la lavande sur les bosses sèches.
- **Faire dépendre des voisins** : l'herbe est deux fois plus rare sous les couronnes et absente au pied des
  troncs ; les fleurs des champs veulent le plein soleil ; la mousse se met du côté du tronc opposé au soleil ;
  rien ne pousse sur un rocher (prévoir le rayon large : un bloc est plus large que haut).
- **Faire des nappes** : chaque fleur a son propre champ de bruit ; on pose l'espèce dont le champ dépasse le
  plus son seuil. Quelques fleurs égarées hors des nappes.
- **Ajouter les petits signes de vie** : taupinières par colonies, cailloux autour d'un gros bloc.
- **Doser** : la lavande partout assombrissait le pré ; une espèce marquante doit rester rare.

Vérifier la composition sur des vues d'ensemble de plusieurs graines, pas sur une seule vue de près.

## 2. Échelle

- 1 unité = 1 mètre, 16 pixels d'art par mètre au zoom 1. Le promeneur fait 1,80 m.
- Prairie : fleurs 35 à 55 cm, touffes 40 à 60 cm, hautes herbes environ 1 m, rochers 0,4 à 2 m, bouleau 7 à
  11 m, chêne 9 à 13 m, tilleul 10 à 15 m.
- Les assets grossissent leurs détails pour rester lisibles (une marguerite fait 24 cm de large) : ne pas les
  rapetisser sous 0,85, un détail de moins de 0,07 m scintille.
- Vue de départ : zoom tel que l'écran montre environ 390 m² dans son plan, sur téléphone comme sur grand
  écran ; le promeneur fait alors une quarantaine de pixels.

## 3. Sol

- Morceaux de 16 m de l'asset de sol, un par case, même matériau partagé ; leur tranche est jetée et remplacée
  par celle de l'île (`buildIslandBand` : terre, puis roche).
- Le grain du sol peint passe de 16 à 10 cases par mètre : en vue inclinée, une case de 1/16 m fait moins d'un
  pixel de haut et ses points colorés clignotent dès que la vue bouge.
- `uSelfEdge = 4` sur le matériau du sol : sinon, en vue rasante, chaque bosse trace un trait sombre.
- Sol seul : lisible et léger, mais plat de près. Tout en volume sur sol uni : vivant, mais le sol uni se voit
  partout et le coût double. Les deux ensemble : choix de l'utilisateur.

## 4. Semis et performance

- `ScatterField` : trois familles de cases, `fine` (herbes, fleurs, 4 m), `low` (rochers, plaques, 6 m), `tall`
  (arbres, 3 m, soit à peu près un arbre par case). Chaque case est bornée à la hauteur réelle du sol : une
  case trop haute est « vue » de loin et ses copies dessinées pour rien.
- La marge d'une case couvre la couronne et l'ombre portée ; trop petite, les ombres surgissent au bord de
  l'image, trop grande, on dessine des arbres hors champ (les arbres sont ce qui coûte le plus).
- Les herbes ne projettent pas d'ombre (`castShadow: false`) : trop nombreuses, et invisible à cette taille.
- La carte d'ombre est refaite une image sur deux ; la lumière ne suit la vue que ces images-là, sinon les
  ombres glissent.
- La lumière se déplace par pas d'un texel de la carte d'ombre, sinon les ombres scintillent en marchant.
- Arbres à `fullness: 0.75` : indiscernable à l'écran, un quart de triangles en moins.
- Une touffe d'herbe coûte 36 à 64 triangles : on ne peut pas couvrir un pré entier en volume. Il manque à la
  bibliothèque une touffe allégée (une dizaine de triangles) pour le semis de masse.
- Les nappes en plein écran (mer de nuages, brume, teinte de l'heure, pluie) ne coûtent que des pixels de
  l'image basse résolution : 1 draw call au plus, aucune géométrie.

## 5. Stabilité de l'image

Deux défauts signalés par l'utilisateur, et leur cause :

- **Des herbes qui apparaissent et disparaissent en marchant.** La part d'herbe dessinée dépendait du nombre
  d'arbres en vue (un budget de triangles), donc changeait à chaque pas. Elle ne doit dépendre que du cadrage :
  `fraction = surface de référence / surface de sol vue`. L'arrondi par case est tiré une fois pour toutes
  (`cellDither`), jamais `Math.ceil`, qui dessine toujours l'unique fleur d'une case.
- **Un fourmillement de tout le décor quand la caméra tourne.** Chaque image d'une rotation redessine tous les
  pixels autrement. La caméra ne tourne donc jamais lentement d'elle-même : par crans de 45°, en 0,8 seconde,
  puis immobile. Une translation alignée sur la grille de pixels, elle, ne fait rien scintiller.

## 6. Contours

- La végétation fine prend l'identifiant de contour du sol (`uId = 11`) : sinon chaque touffe est cernée de
  sombre et le pré devient une résille noire. Les pétales et les cœurs gardent le leur.
- La motte sombre de la pelouse est retirée (`skip: ["sod"]`) : sur un pré, elle fait des disques sombres.
- Formes de quelques pixels (papillons, graines, lucioles) : `outline: false`, sinon le contour les mange.

## 7. Ciel, heure, météo

- **Ni soleil ni nuage visibles au-dessus de la carte** : vus d'en haut, ils cachent le promeneur, et
  l'utilisateur les a trouvés laids. On garde leurs ombres : des nuages de la bibliothèque dessinés seulement
  dans la carte d'ombre (`createCloudShadows`).
- L'heure et la météo ne touchent pas aux rampes des assets : `PixelRenderer.setMood` teinte toute l'image dans
  la passe finale. Les matières sans contour y échappent : une luciole reste vive la nuit.
- Pluie par beau temps sur téléphone : le test de goutte `step(hasard, 0,085 × pluie)` passait quand le hasard
  valait exactement 0, fréquent en précision réduite. Garde-fou dans le shader, fondu de la pluie coupé net
  sous 0,002, temps de la pluie gardé petit (modulo 600 s).
- La nuit sous la pluie devenait illisible : la pluie assombrit moins quand il fait déjà nuit.
- Sous la pluie, l'astre monte presque à la verticale : les ombres se ramassent sous les objets, on ne voit plus
  d'ombres nettes par temps couvert.
- Tous les changements sont fondus (1 s quand on choisit, 5 s dans le cycle).
- La nuit, les papillons se cachent et les graines deviennent des lucioles ; sous la pluie, plus rien ne vole.

## 8. Bords du monde

- Une île qui flotte : la mer de nuages loin dessous (30 m sous la pointe), en bancs modelés par la pente d'un
  bruit du côté de l'astre, qui se fond dans le ciel au loin. Le premier jet mettait la mer juste sous le sol et
  une brume au ras du pré qui noyait le bord : l'utilisateur voulait au contraire **voir le bord de l'île et la
  roche plonger**, avec les nuages tout en bas. D'où une falaise courte, puis un dessous qui s'effile en pointe
  (anneaux du carré vers un cercle, lobes tirés d'un bruit, faces à plat) et la brume autour de la pointe.
- En vue orthographique, la profondeur ne se lit que par ce qui la montre : la roche visible entre le pré et les
  nuages. Une pointe trop étroite laisse un surplomb plat ; une pointe trop large fait « posée sur les nuages ».
- La brume reste trouée par une trame de points (pas de transparence : la passe de contours ne la supporte pas).
- Les cadres de brume doivent être raccordés sommet à sommet : une marche entre deux cadres laisse voir un
  trait de mer.
- La balade automatique reste à 9 m du bord.

## 9. Caméra et explorateur

- Caméra orthographique, recul 220 m, portée 560 m ; inclinaison de 11° à 68°, zoom de 0,5 à 4.
- Le promeneur ne traverse ni les troncs ni les gros rochers (obstacles ronds), et ne sort pas de la carte.
- Réglages refaits seulement au relâchement d'un curseur ; le promeneur garde sa place.
- Sur téléphone : panneau de réglages replié, manette ronde, « Masquer l'interface » pour ne garder que le
  paysage.

## 10. Poids mesurés (Prairie d'été, carte moyenne, vue de départ sur téléphone)

| | Draw calls | Triangles par image |
|---|---|---|
| Clairière | 65 à 70 | environ 135 000 |
| Départ | 65 à 75 | environ 200 000 |
| Cœur d'un bosquet | 70 à 80 | jusqu'à 280 000 |

L'utilisateur tient 60 images par seconde sur un vieux téléphone à ce niveau : c'est la référence à ne pas
dépasser.
