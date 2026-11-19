# Projet Vie 3D

Mondes isométriques vivants en three.js, rendu pixel art moderne, et une créature dont la vie est scénarisée.

- Vision : [docs/VISION.md](docs/VISION.md)
- Direction artistique : [docs/ART-DIRECTION.md](docs/ART-DIRECTION.md)
- Performance et formats : [docs/PERFORMANCE.md](docs/PERFORMANCE.md)
- Effets pixelfx en 3D : [docs/PIXELFX-3D.md](docs/PIXELFX-3D.md)
- Assets (dessins 3D en JS, catalogue pour IA) : [docs/ASSETS.md](docs/ASSETS.md)
- Consignes pour les agents de code (Mistral Vibe, Claude Code...) : [AGENTS.md](AGENTS.md)

## Démarrer

```
npm install
npm run dev        # galerie « Atelier Vie 3D » : tous les assets, en 3D pixel art, avec leur code
npm run check      # vérifie que chaque asset respecte son contrat
npm run sheet -- nature/trees/birch   # planche de contrôle d'un asset (variantes × graines)
npm run artifact   # catalogue + page autonome à publier (dist-artifact/atelier-vie-3d.html)
```

## Skills des agents (`.agents/skills/`, format Agent Skills)

| Skill | Usage |
|---|---|
| `create-asset` | dès qu'on demande un nouvel asset : « génère un chêne », « dessine un mur en pierre » |
| `threejs-*` | toujours, dès qu'on code du rendu |
| `/grill-me` (+ `grilling`) | sur demande : interrogatoire pour cerner un objectif |
| `/pixelfx` | sur demande : effets pixel art (bibliothèque dans `vendor/pixelfx/`) |

Sources et licences : [vendor/README.md](vendor/README.md).
