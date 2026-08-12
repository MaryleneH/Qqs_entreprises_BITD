# BITD France — Cartographie industrielle & indicateurs publics

Dashboard documentaire sur **30 acteurs de la Base industrielle et technologique de défense française**.

> Sources publiques — situation au 12 août 2026

## Aperçu

Le site comprend :

- **Vue d'ensemble** : carte interactive Leaflet, KPI factuels et filtres territoriaux
- **Entreprises** : tableau filtrable des 30 acteurs
- **Comprendre les données** : glossaire central et définitions pédagogiques
- **Méthodologie** : périmètre, sources et règles de lecture

## Architecture

```text
.
├── _quarto.yml
├── index.qmd
├── entreprises.qmd
├── comprendre.qmd
├── risques.qmd
├── methodologie.qmd
├── data/
│   ├── entreprises.csv
│   ├── etablissements.csv
│   └── glossaire.json
├── scripts/
│   ├── glossary.js
│   ├── comprendre.js
│   ├── dashboard.js
│   ├── map.js
│   ├── filters.js
│   └── table.js
├── styles/
│   └── dashboard.scss
└── sources/
```

## Rendu

```bash
quarto clean
quarto render
```

Le site statique est généré dans `_site/`.

## Données

Les indicateurs affichés proviennent principalement de :

- `data/entreprises.csv`
- `data/etablissements.csv`
- `data/glossaire.json`

Les fichiers du dossier `sources/` restent le référentiel documentaire historique et ne sont pas modifiés.

## Déploiement GitHub Pages

Le workflow `.github/workflows/pages.yml` rend le projet avec Quarto puis publie `_site` sur GitHub Pages à chaque push sur `main`.
