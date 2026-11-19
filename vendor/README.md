# vendor/

Code tiers copié dans le dépôt (pas de sous-module, pour que tout marche hors ligne et dans une session cloud).

| Dossier | Source | Commit | Licence | Modifs locales |
|---|---|---|---|---|
| `pixelfx/` | https://github.com/patch-gg/pixelfx | `5294518` | MIT (voir `pixelfx/LICENSE`, `pixelfx/NOTICE.md`) | retirés : `docs/readme/` (12 Mo de GIF de démo), `gallery/fonts/` (police non MIT), `skills/` (le skill vit dans `.agents/skills/pixelfx/`) |

Skills copiés dans `.agents/skills/` (communs à Claude Code, par le lien `.claude/skills`, et à Mistral Vibe) :

| Skills | Source | Commit | Licence |
|---|---|---|---|
| `threejs-*` (13) | https://github.com/cloudai-x/threejs-skills | `0e18186` | MIT (`.agents/skills/THREEJS-SKILLS-LICENSE`) — adapté : `threejs-react-three-fiber` en invocation manuelle (`disable-model-invocation: true`) |
| `grill-me`, `grilling` | https://github.com/mattpocock/skills | `5863806` | MIT (`.agents/skills/MATTPOCOCK-SKILLS-LICENSE`) — adapté : `grill-me` charge `grilling` sans nommer d'outil propre à un agent |
| `pixelfx` | https://github.com/patch-gg/pixelfx | `5294518` | MIT — adapté : `disable-model-invocation: true`, chemin `vendor/pixelfx/`, section « Publish on Patch » retirée |

Les skills `create-asset`, `create-world` et `publish-page` (`.agents/skills/`) sont écrits pour ce projet : ils ne
sont pas copiés d'ailleurs.

Pour mettre à jour : re-cloner la source, recopier, et refaire les modifs listées ci-dessus.
