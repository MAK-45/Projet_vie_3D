# Projet Vie 3D

Mondes isométriques vivants en three.js, rendu pixel art moderne, et une créature dont la vie est scénarisée.

- Vision : [docs/VISION.md](docs/VISION.md)
- Direction artistique : [docs/ART-DIRECTION.md](docs/ART-DIRECTION.md)
- Performance et formats : [docs/PERFORMANCE.md](docs/PERFORMANCE.md)
- Effets pixelfx en 3D : [docs/PIXELFX-3D.md](docs/PIXELFX-3D.md)
- Assets (dessins 3D en JS, catalogue pour IA) : [docs/ASSETS.md](docs/ASSETS.md)
- Consignes pour les agents de code : [AGENTS.md](AGENTS.md) (communes), [CLAUDE.md](CLAUDE.md) (Claude Code)
- L'Atelier en ligne : https://mak-45.github.io/Projet_vie_3D/ (GitHub Pages, republié à chaque fusion dans `main`)

## Démarrer

```
npm install
npm run dev        # galerie « Atelier Vie 3D » : tous les assets, en 3D pixel art, avec leur code
npm run check      # vérifie que chaque asset respecte son contrat
npm run sheet -- nature/trees/birch   # planche de contrôle d'un asset (variantes × graines)
npm run artifact   # catalogue + page autonome de la galerie (dist-artifact/atelier-vie-3d.html)
npm run site       # le site GitHub Pages, assemblé dans dist-site/
```

## Agents de code : Claude Code et Mistral Vibe

Le dépôt se travaille avec l'un ou l'autre. Ce qui est commun est écrit une fois, chaque outil garde ses réglages.

| Élément | Commun | Claude Code lit | Mistral Vibe lit |
|---|---|---|---|
| Consignes | `AGENTS.md` | `CLAUDE.md`, qui importe `AGENTS.md` | `AGENTS.md` |
| Skills | `.agents/skills/` | `.claude/skills` (lien vers `.agents/skills`) | `.agents/skills/` |
| Hooks | `scripts/hooks/guard-bash.mjs` | déclaré dans `.claude/settings.json` | déclaré dans `.vibe/hooks.toml` |
| Permissions | à aligner à la main | `.claude/settings.json` | `.vibe/config.toml` |
| Montrer un résultat | skill `publish-page` : pull request vers `main`, GitHub Pages | | |

`npm run check:agents` vérifie que les deux côtés restent alignés. Pour Vibe : approuver le dossier au premier
lancement (« Trust folder »), puis `/skills` doit lister les skills du projet. Sur Windows, activer le mode
développeur et `git config core.symlinks true` avant de cloner, sinon le lien `.claude/skills` devient un fichier.

| Skill | Usage |
|---|---|
| `create-asset` | dès qu'on demande un nouvel asset : « génère un chêne », « dessine un mur en pierre » |
| `create-world` | dès qu'on demande un monde : « crée une forêt enneigée », « une île de plage » |
| `publish-page` | en fin de tâche avec un rendu, ou « montre-moi » : l'Atelier sur GitHub Pages |
| `threejs-*` | toujours, dès qu'on code du rendu |
| `/grill-me` (+ `grilling`) | sur demande : interrogatoire pour cerner un objectif |
| `/pixelfx` | sur demande : effets pixel art (bibliothèque dans `vendor/pixelfx/`) |

Sources et licences : [vendor/README.md](vendor/README.md).
