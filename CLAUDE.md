@AGENTS.md

## Spécifique à Claude Code

- Les skills sont dans `.agents/skills/` ; Claude Code les voit par le lien `.claude/skills`. Les charger par leur
  nom (ou `/<nom>`). Un nouveau skill se crée dans `.agents/skills/`, jamais directement dans `.claude/`.
- Réglages : `.claude/settings.json` (permissions, hook `scripts/hooks/guard-bash.mjs` avant chaque commande
  shell). Tout changement s'y reporte aussi dans `.vibe/config.toml` ou `.vibe/hooks.toml`, dans le même commit.
- Session Claude Code sur le web : Chromium et Playwright sont préinstallés (`require("playwright")` marche, ne pas
  lancer `playwright install`). Le dépôt est cloné depuis GitHub : seul ce qui est poussé compte.
- Montrer un résultat : skill `publish-page` (pull request vers `main`, GitHub Pages), avec les outils GitHub de la
  session. Plus d'Artifact : l'ancien « Atelier Vie 3D » (https://claude.ai/artifact/C8NQjFucdBRX4bo9eT4Jim) n'est
  plus mis à jour.
