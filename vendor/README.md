# vendor/

Code tiers copié dans le dépôt (pas de sous-module, pour que tout marche hors ligne et dans une session cloud).

| Dossier | Source | Commit | Licence | Modifs locales |
|---|---|---|---|---|
| `pixelfx/` | https://github.com/patch-gg/pixelfx | `5294518` | MIT (voir `pixelfx/LICENSE`, `pixelfx/NOTICE.md`) | retirés : `docs/readme/` (12 Mo de GIF de démo), `gallery/fonts/` (police non MIT), `skills/` (le skill vit dans `.claude/skills/pixelfx/`) |

Skills Claude Code copiés dans `.claude/skills/` :

| Skills | Source | Commit | Licence |
|---|---|---|---|
| `threejs-*` (13) | https://github.com/cloudai-x/threejs-skills | `0e18186` | MIT (`.claude/skills/THREEJS-SKILLS-LICENSE`) |
| `grill-me`, `grilling` | https://github.com/mattpocock/skills | `5863806` | MIT (`.claude/skills/MATTPOCOCK-SKILLS-LICENSE`) |
| `pixelfx` | https://github.com/patch-gg/pixelfx | `5294518` | MIT — adapté : `disable-model-invocation: true`, chemin `vendor/pixelfx/`, section « Publish on Patch » retirée |

Le skill `create-asset` (`.claude/skills/create-asset/`) est écrit pour ce projet : il n'est pas copié d'ailleurs.

Pour mettre à jour : re-cloner la source, recopier, et refaire les modifs listées ci-dessus.
