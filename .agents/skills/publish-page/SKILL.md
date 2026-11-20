---
name: publish-page
description: >-
  Publie l'Atelier Vie 3D (la galerie des assets et des mondes) ou une page HTML statique sur GitHub Pages, pour
  que l'utilisateur voie le résultat, depuis son téléphone comme depuis un ordinateur. À utiliser en fin de tâche
  avec un rendu graphique (asset, monde, effet, lot du Complexe), ou quand l'utilisateur demande de montrer,
  prévisualiser, publier ou partager un rendu. Jamais d'artefact ni d'autre hébergeur.
---

# Publier une page

Le site est construit par GitHub Actions (`.github/workflows/pages.yml`) à chaque push sur `main` : il lance
`npm run site` et publie `dist-site/`. Rien de généré n'est committé pour le site : l'Atelier est reconstruit à
partir du code.

- Adresse : https://mak-45.github.io/Projet_vie_3D/ (l'Atelier, avec les mondes dans la catégorie « Mondes »).
- Une page en plus, écrite dans `site/<nom>/index.html`, est servie sous https://mak-45.github.io/Projet_vie_3D/<nom>/.

## 1. Préparer

- **L'Atelier** (cas habituel : un asset, un monde, un lot) : rien à écrire. Les captures ont déjà été faites et
  regardées (skills `create-asset`, `create-world`). Lancer `npm run site` : il doit passer sans erreur, et
  `public/catalog/` régénéré doit être committé avec le reste.
- **Une autre page** (rapport, démo, comparaison) : l'écrire en HTML statique dans `site/<nom>/index.html`, avec
  ses fichiers CSS, JS et images à côté, en chemins relatifs. Pas de `site/index.html` : la racine est l'Atelier.
  La page est publique : rien de confidentiel.

## 2. Pousser et ouvrir la pull request

1. Committer sur la branche de travail (jamais directement sur `main`), puis pousser.
2. Ouvrir une pull request de cette branche vers `main`, titre et description en français : ce qu'il y a à voir
   et où cliquer. Si une pull request de cette branche vers `main` est déjà ouverte, pousser suffit : elle se met
   à jour.
3. Ne pas fusionner soi-même : c'est l'utilisateur qui fusionne, depuis l'app GitHub ou le navigateur.

## 3. Donner l'adresse

Donner le lien de la pull request et l'adresse de la page, en précisant qu'elle sera à jour quelques minutes
après la fusion (le déroulé est visible dans l'onglet Actions du dépôt).

## Mise en place (une seule fois, par l'utilisateur)

Sur GitHub : Settings > Pages > Source : « GitHub Actions » (sur téléphone, passer le navigateur en version
ordinateur si le réglage n'apparaît pas). Ce choix est obligatoire : le dépôt contient un lien symbolique
(`.claude/skills`). Avec l'offre gratuite, le dépôt et la page sont publics.
